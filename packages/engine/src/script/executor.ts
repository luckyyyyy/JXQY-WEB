/**
 * Script Executor - based on JxqyHD Engine/Script/ScriptExecuter.cs
 * Executes parsed scripts with game commands
 *
 * Commands are organized in separate files under ./commands/
 *
 * Blocking operations are handled via BlockingResolver:
 * - Command handlers `await` async GameAPI methods (which use BlockingResolver internally)
 * - The execute() loop naturally suspends at `await executeCommand()`
 * - update() calls resolver.tick() each frame to resolve completed conditions
 * - When a condition resolves, the awaiting handler resumes via microtask
 */
import { logger } from "../core/logger";
import { resourceLoader } from "../resource/resource-loader";
import type { GameAPI } from "./api/game-api";
import { BlockingEvent, type BlockingResolver } from "./blocking-resolver";
import { type CommandHelpers, type CommandRegistry, createCommandRegistry } from "./commands";
import { loadScript, parseScript } from "./parser";
import type { ScriptData, ScriptState } from "./types";

/**
 * Debug hooks for script execution (optional)
 */
export interface ScriptDebugHooks {
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;
}

/**
 * 并行脚本项
 */
interface ParallelScriptItem {
  filePath: string;
  waitMilliseconds: number;
  scriptInRun: ParallelScriptRunner | null;
}

/**
 * 并行脚本运行器（简化版 ScriptRunner）
 *
 * 并行脚本用于在主脚本执行时运行独立的后台脚本。
 * 典型用例：延迟触发事件、循环检查条件等。
 */
class ParallelScriptRunner {
  private script: ScriptData;
  private currentLine: number = 0;
  private commandRegistry: CommandRegistry;
  private api: GameAPI;
  private isFinished: boolean = false;
  private pendingPromise: Promise<boolean> | null = null;

  constructor(script: ScriptData, commandRegistry: CommandRegistry, api: GameAPI) {
    this.script = script;
    this.commandRegistry = commandRegistry;
    this.api = api;
  }

  get finished(): boolean {
    return this.isFinished;
  }

  /**
   * Continue executing the parallel script
   * Returns true if script should continue, false if finished
   */
  continue(): boolean {
    if (this.isFinished) return false;

    // If waiting for an async handler to complete, check if it's done
    if (this.pendingPromise) {
      return true; // Still waiting for async handler
    }

    while (this.currentLine < this.script.codes.length) {
      const code = this.script.codes[this.currentLine];

      // Skip labels
      if (code.isLabel) {
        this.currentLine++;
        continue;
      }

      // Execute command
      const handler = this.commandRegistry.get(code.name.toLowerCase());
      if (handler) {
        const helpers: CommandHelpers = {
          state: {
            currentScript: this.script,
            currentLine: this.currentLine,
            isRunning: true,
            isPaused: false,
            callStack: [],
            belongObject: null,
          },
          api: this.api,
          resolveString: (expr: string) => this.resolveString(expr),
          resolveNumber: (expr: string) => this.resolveNumber(expr),
          gotoLabel: (label: string) => this.gotoLabel(label),
          endScript: () => {
            this.isFinished = true;
          },
        };

        // CommandHandler returns true to continue, false to pause
        // For async handlers, wait for resolution before continuing
        const shouldContinue = handler(code.parameters, code.result, helpers);

        if (shouldContinue instanceof Promise) {
          // Async handler — wait for it to resolve before continuing
          this.currentLine++;
          this.pendingPromise = shouldContinue;
          shouldContinue.then((result) => {
            this.pendingPromise = null;
            if (!result) {
              // Handler said to stop
              this.isFinished = true;
            }
          });
          return true;
        }

        if (shouldContinue === false) {
          // Pause execution, next call will continue from next line
          this.currentLine++;
          return true;
        }
      }

      this.currentLine++;
    }

    // Script finished
    this.isFinished = true;
    return false;
  }

  private resolveString(expr: string): string {
    if (expr.startsWith("$")) {
      return this.api.variables.get(expr.substring(1)).toString();
    }
    return expr.replace(/^["']|["']$/g, "");
  }

  private resolveNumber(expr: string): number {
    if (expr.startsWith("$")) {
      return this.api.variables.get(expr.substring(1));
    }
    return parseFloat(expr) || 0;
  }

  private gotoLabel(label: string): void {
    for (let i = 0; i < this.script.codes.length; i++) {
      const code = this.script.codes[i];
      if (code.isLabel && code.name.toLowerCase() === label.toLowerCase()) {
        this.currentLine = i;
        return;
      }
    }
    logger.warn(`[ParallelScript] Label not found: ${label}`);
  }
}

/**
 * 脚本队列项
 */
interface ScriptQueueItem {
  scriptPath: string;
  belongObject?: { type: "npc" | "obj"; id: string };
}

export class ScriptExecutor {
  private state: ScriptState;
  private api: GameAPI;
  private debugHooks: ScriptDebugHooks;
  private commandRegistry: CommandRegistry;
  private resolver: BlockingResolver;

  // 脚本队列
  // 外部触发的脚本加入队列，Update 中逐帧处理
  private scriptQueue: ScriptQueueItem[] = [];

  // 并行脚本列表
  private parallelListDelayed: ParallelScriptItem[] = [];
  private parallelListImmediately: ParallelScriptItem[] = [];

  constructor(api: GameAPI, resolver: BlockingResolver, debugHooks?: ScriptDebugHooks) {
    this.api = api;
    this.resolver = resolver;
    this.debugHooks = debugHooks ?? {};
    this.commandRegistry = createCommandRegistry();
    this.state = {
      currentScript: null,
      currentLine: 0,
      isRunning: false,
      isPaused: false,
      callStack: [],
      belongObject: null,
    };
  }

  /**
   * Get script state
   */
  getState(): ScriptState {
    return this.state;
  }

  /**
   * Check if script is running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Check if waiting for user input (dialog, selection, or any blocking operation)
   * Used by external callers (gameManager, mapBase) to suppress trap checking etc.
   */
  isWaitingForInput(): boolean {
    return this.resolver.hasPending;
  }

  /**
   * Load and run a script file
   * Following ScriptManager.RunScript - uses callStack for nested execution
   *
   * @param scriptPath Path to the script file
   * @param belongObject Optional target (NPC or Obj) that triggered this script
   */
  async runScript(
    scriptPath: string,
    belongObject?: { type: "npc" | "obj"; id: string }
  ): Promise<void> {
    // Set isRunning = true BEFORE any await to prevent race conditions
    this.state.isRunning = true;

    // loadScript now handles caching via resourceLoader
    const script = await loadScript(scriptPath);

    if (!script) {
      logger.error(`Failed to load script: ${scriptPath}`);
      // Don't set isRunning = false here if we have parent script in callStack
      if (this.state.callStack.length === 0) {
        this.state.isRunning = false;
      }
      return;
    }

    // Save current script state to callStack before switching
    // Save currentLine as-is; after Return, the execute loop will do currentLine++
    // which will move to the next command after RunScript
    if (this.state.currentScript) {
      this.state.callStack.push({
        script: this.state.currentScript,
        line: this.state.currentLine, // Will be incremented by execute loop after Return
      });
      logger.log(
        `[ScriptExecutor] Pushed to callStack: ${this.state.currentScript.fileName} at line ${this.state.currentLine}`
      );
    }

    this.state.currentScript = script;
    this.state.currentLine = 0;
    this.state.isPaused = false;

    // Set belongObject if provided (for commands like DelCurObj)
    if (belongObject) {
      this.state.belongObject = belongObject;
    }

    logger.log(`[ScriptExecutor] Running script: ${scriptPath}`);

    // Notify debug hook with all codes
    const allCodes = script.codes.map((c) => c.literal);
    this.debugHooks.onScriptStart?.(script.fileName, script.codes.length, allCodes);

    await this.execute();
  }

  /**
   * Queue a script for execution (外部触发入口)
   * 把脚本添加到 _list 队列
   *
   * 外部事件（如 NPC 死亡、物体交互）应使用此方法。
   * 脚本会被加入队列，在 Update 中按顺序执行。
   * 这是非阻塞的，不等待脚本执行完成。
   *
   * @param scriptPath Path to the script file
   * @param belongObject Optional target that triggered this script
   */
  queueScript(scriptPath: string, belongObject?: { type: "npc" | "obj"; id: string }): void {
    logger.log(
      `[ScriptExecutor] Queueing script: ${scriptPath} (queue size: ${this.scriptQueue.length})`
    );
    this.scriptQueue.push({ scriptPath, belongObject });
  }

  /**
   * Run a script from content string
   * @param skipHistory - 如果为true，不记录到脚本历史
   */
  async runScriptContent(content: string, fileName: string, skipHistory = false): Promise<void> {
    const script = parseScript(content, fileName);
    this.state.currentScript = script;
    this.state.currentLine = 0;
    this.state.isRunning = true;
    this.state.isPaused = false;

    // Notify debug hook with all codes (unless skipping history)
    if (!skipHistory) {
      const allCodes = script.codes.map((c) => c.literal);
      this.debugHooks.onScriptStart?.(script.fileName, script.codes.length, allCodes);
    }

    await this.execute();
  }

  /**
   * Execute current script
   *
   * With the Promise-based model, blocking operations are handled by async command handlers.
   * When a handler awaits a blocking GameAPI method, this loop naturally suspends.
   * The resolver.tick() in update() will resolve the condition, resuming the handler.
   */
  private async execute(): Promise<void> {
    while (this.state.isRunning && this.state.currentScript) {
      if (this.state.isPaused) {
        return;
      }

      if (this.state.currentLine >= this.state.currentScript.codes.length) {
        this.endScript();
        // After endScript(), if we restored a parent script, continue the loop
        // Otherwise isRunning will be false and loop will exit naturally
        continue;
      }

      const code = this.state.currentScript.codes[this.state.currentLine];

      // Skip labels (but record that we visited this line)
      if (code.isLabel) {
        // 标签行也记录为已执行（跳转目标）
        this.debugHooks.onLineExecuted?.(this.state.currentScript.fileName, this.state.currentLine);
        this.state.currentLine++;
        continue;
      }

      // Record this line as executed (for debug panel)
      this.debugHooks.onLineExecuted?.(this.state.currentScript.fileName, this.state.currentLine);

      // Execute command
      const shouldContinue = await this.executeCommand(code.name, code.parameters, code.result);
      if (!shouldContinue) {
        return;
      }

      this.state.currentLine++;
    }

    // 确保状态同步：如果 currentScript 为 null 且没有 callStack，isRunning 应该为 false
    if (!this.state.currentScript && this.state.callStack.length === 0) {
      this.state.isRunning = false;
    }
  }

  /**
   * Create helpers object for command handlers
   */
  private createHelpers(): CommandHelpers {
    return {
      api: this.api,
      state: this.state,
      resolveString: this.resolveString.bind(this),
      resolveNumber: this.resolveNumber.bind(this),
      gotoLabel: this.gotoLabel.bind(this),
      endScript: this.endScript.bind(this),
    };
  }

  /**
   * Execute a single command
   */
  private async executeCommand(name: string, params: string[], result: string): Promise<boolean> {
    const cmd = name.toLowerCase();
    logger.log(`[ScriptExecutor] Executing: ${name}(${params.join(", ")})`);

    const handler = this.commandRegistry.get(cmd);
    if (handler) {
      return handler(params, result, this.createHelpers());
    }

    logger.log(`Unknown command: ${name}`, params);
    return true;
  }

  /**
   * Go to a label in the current script
   */
  private gotoLabel(label: string): void {
    if (!this.state.currentScript) return;

    let labelName = label;
    if (!labelName.startsWith("@")) {
      labelName = `@${labelName}`;
    }
    if (!labelName.endsWith(":")) {
      labelName = `${labelName}:`;
    }

    const lineIndex = this.state.currentScript.labels.get(labelName);

    if (lineIndex !== undefined) {
      // 记录标签行为已执行（因为跳转后 execute 循环会 currentLine++ 跳过标签行）
      this.debugHooks.onLineExecuted?.(this.state.currentScript.fileName, lineIndex);
      this.state.currentLine = lineIndex;
    } else {
      logger.warn(`Label not found: ${labelName}`);
    }
  }

  /**
   * End current script and restore parent script if available
   * Following ScriptManager behavior - when script ends, continue with parent
   */
  private endScript(): void {
    // Check if there's a parent script in the callStack
    if (this.state.callStack.length > 0) {
      const parent = this.state.callStack.pop()!;
      logger.log(
        `[ScriptExecutor] Restoring from callStack: ${parent.script.fileName} at line ${parent.line}`
      );
      this.state.currentScript = parent.script;
      this.state.currentLine = parent.line;
      // Keep isRunning = true, continue executing parent script
      // The execute() loop will continue from here
    } else {
      // No parent script, fully end execution
      this.state.isRunning = false;
      this.state.currentScript = null;
      this.state.currentLine = 0;
    }
  }

  /**
   * Resolve a string parameter (handle variables)
   */
  private resolveString(value: string): string {
    return value.replace(/\$(\w+)/g, (_, varName) => {
      return String(this.api.variables.get(varName));
    });
  }

  /**
   * Resolve a number parameter (handle variables)
   */
  private resolveNumber(value: string): number {
    if (value.startsWith("$")) {
      const varName = value.slice(1);
      return this.api.variables.get(varName);
    }
    return parseInt(value, 10) || 0;
  }

  /**
   * Update executor (called each frame)
   */
  update(deltaTime: number): void {
    // Update parallel scripts
    void this.updateParallelScripts(deltaTime);

    // Tick the resolver to check/resolve pending conditions
    this.resolver.tick();

    // If no script running, process queue
    if (!this.state.isRunning && this.scriptQueue.length > 0) {
      const next = this.scriptQueue.shift()!;
      logger.log(
        `[ScriptExecutor] Processing queued script: ${next.scriptPath} (${this.scriptQueue.length} remaining)`
      );
      void this.runScript(next.scriptPath, next.belongObject);
    }
  }

  /**
   * Handle dialog closed (called by UI layer)
   */
  onDialogClosed(): void {
    this.resolver.resolveEvent(BlockingEvent.DIALOG_CLOSED);
  }

  /**
   * Handle selection made (called by UI layer)
   */
  onSelectionMade(index: number): void {
    this.resolver.resolveEvent(BlockingEvent.SELECTION_MADE, index);
  }

  /**
   * Handle multi-selection made (ChooseMultiple) (called by UI layer)
   */
  onMultiSelectionMade(selectedIndices: number[]): void {
    this.resolver.resolveEvent(BlockingEvent.CHOOSE_MULTIPLE_DONE, selectedIndices);
  }

  /**
   * Clear script cache (委托给 resourceLoader)
   */
  clearCache(): void {
    resourceLoader.clearCache("script");
  }

  /**
   * Stop all running scripts and reset state
   * Reference: ScriptManager.Clear()
   *
   * This should be called before loading a save to prevent
   * script state from persisting across loads.
   */
  stopAllScripts(): void {
    logger.debug("[ScriptExecutor] Stopping all scripts and resetting state");

    // Reset state
    this.state.currentScript = null;
    this.state.currentLine = 0;
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.callStack = [];
    this.state.belongObject = null;

    // Clear all pending blocking operations
    this.resolver.clear();

    // Clear script queue
    this.scriptQueue = [];

    // Clear parallel scripts
    this.parallelListDelayed = [];
    this.parallelListImmediately = [];

    logger.debug("[ScriptExecutor] All scripts stopped");
  }

  // ============= 并行脚本管理 =============

  /**
   * Run a script in parallel
   * Reference: ScriptManager.RunParallelScript(scriptFilePath, delayMilliseconds)
   */
  runParallelScript(scriptFilePath: string, delayMilliseconds: number = 0): void {
    const item: ParallelScriptItem = {
      filePath: scriptFilePath,
      waitMilliseconds: delayMilliseconds,
      scriptInRun: null,
    };

    if (delayMilliseconds <= 0) {
      this.parallelListImmediately.push(item);
    } else {
      this.parallelListDelayed.push(item);
    }

    logger.log(
      `[ScriptExecutor] RunParallelScript: ${scriptFilePath}, delay=${delayMilliseconds}ms`
    );
  }

  /**
   * Update parallel scripts
   * 中的并行脚本更新逻辑
   */
  private async updateParallelScripts(deltaTime: number): Promise<void> {
    // "New item may added when script run, count items added before this frame."
    // 只处理本帧之前添加的脚本，防止新添加的脚本在同一帧被执行

    // Update delayed parallel scripts
    const delayedItemSum = this.parallelListDelayed.length;
    const delayedToRemove: number[] = [];
    for (let i = 0; i < delayedItemSum && i < this.parallelListDelayed.length; i++) {
      const item = this.parallelListDelayed[i];

      // Decrease wait time
      if (item.waitMilliseconds > 0) {
        item.waitMilliseconds -= deltaTime;
      }

      // If wait time expired, create script runner
      if (item.waitMilliseconds <= 0 && item.scriptInRun === null) {
        const script = await loadScript(item.filePath);
        if (script) {
          item.scriptInRun = new ParallelScriptRunner(script, this.commandRegistry, this.api);
        } else {
          logger.error(`[ScriptExecutor] Failed to load parallel script: ${item.filePath}`);
          delayedToRemove.push(i);
          continue;
        }
      }

      // Run script if ready
      if (item.scriptInRun) {
        if (!item.scriptInRun.continue()) {
          delayedToRemove.push(i);
        }
      }
    }

    // Remove finished delayed scripts (reverse order to maintain indices)
    for (let i = delayedToRemove.length - 1; i >= 0; i--) {
      this.parallelListDelayed.splice(delayedToRemove[i], 1);
    }

    // Update immediate parallel scripts
    const immediateToRemove: number[] = [];
    for (let i = 0; i < this.parallelListImmediately.length; i++) {
      const item = this.parallelListImmediately[i];

      // Create script runner if not exists
      if (item.scriptInRun === null) {
        const script = await loadScript(item.filePath);
        if (script) {
          item.scriptInRun = new ParallelScriptRunner(script, this.commandRegistry, this.api);
        } else {
          logger.error(`[ScriptExecutor] Failed to load parallel script: ${item.filePath}`);
          immediateToRemove.push(i);
          continue;
        }
      }

      // Run script
      if (item.scriptInRun) {
        if (!item.scriptInRun.continue()) {
          immediateToRemove.push(i);
        }
      }
    }

    // Remove finished immediate scripts (reverse order to maintain indices)
    for (let i = immediateToRemove.length - 1; i >= 0; i--) {
      this.parallelListImmediately.splice(immediateToRemove[i], 1);
    }
  }

  /**
   * Clear all parallel scripts
   * Reference: ScriptManager.ClearParallelScript()
   */
  clearParallelScripts(): void {
    this.parallelListDelayed = [];
    this.parallelListImmediately = [];
    logger.log("[ScriptExecutor] Cleared all parallel scripts");
  }

  /**
   * Get parallel scripts for saving
   * Reference: ScriptManager.SaveParallelScript()
   */
  getParallelScriptsForSave(): Array<{ filePath: string; waitMilliseconds: number }> {
    const result: Array<{ filePath: string; waitMilliseconds: number }> = [];

    // Save delayed scripts with remaining wait time
    // uses (int)parallelScriptItem.WaitMilliseconds to truncate to integer
    for (const item of this.parallelListDelayed) {
      result.push({
        filePath: item.filePath,
        waitMilliseconds: Math.max(0, Math.floor(item.waitMilliseconds)),
      });
    }

    // Save immediate scripts with wait time 0
    for (const item of this.parallelListImmediately) {
      result.push({
        filePath: item.filePath,
        waitMilliseconds: 0,
      });
    }

    return result;
  }

  /**
   * Load parallel scripts from save data
   * Reference: ScriptManager.LoadParallelScript()
   */
  loadParallelScriptsFromSave(
    scripts: Array<{ filePath: string; waitMilliseconds: number }>
  ): void {
    this.parallelListDelayed = [];
    this.parallelListImmediately = [];

    for (const script of scripts) {
      const item: ParallelScriptItem = {
        filePath: script.filePath,
        waitMilliseconds: script.waitMilliseconds,
        scriptInRun: null,
      };

      if (script.waitMilliseconds <= 0) {
        this.parallelListImmediately.push(item);
      } else {
        this.parallelListDelayed.push(item);
      }
    }

    logger.log(`[ScriptExecutor] Loaded ${scripts.length} parallel scripts from save`);
  }
}
