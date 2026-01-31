/**
 * Script Executor - based on JxqyHD Engine/Script/ScriptExecuter.cs
 * Executes parsed scripts with game commands
 *
 * Commands are organized in separate files under ./commands/
 */
import { logger } from "../core/logger";
import type { ScriptData, ScriptState } from "../core/types";
import { resourceLoader } from "../resource/resourceLoader";
import {
  type CommandHelpers,
  type CommandRegistry,
  createCommandRegistry,
  type ScriptContext,
} from "./commands";
import { loadScript, parseScript } from "./parser";

// Re-export ScriptContext for backwards compatibility
export type { ScriptContext } from "./commands";

/**
 * 并行脚本项
 * C# Reference: ScriptManager.ParallelScriptItem
 */
interface ParallelScriptItem {
  filePath: string;
  waitMilliseconds: number;
  scriptInRun: ParallelScriptRunner | null;
}

/**
 * 并行脚本运行器（简化版 ScriptRunner）
 * C# Reference: ScriptManager.ParallelScriptItem.ScriptInRun
 *
 * 并行脚本用于在主脚本执行时运行独立的后台脚本。
 * 典型用例：延迟触发事件、循环检查条件等。
 */
class ParallelScriptRunner {
  private script: ScriptData;
  private currentLine: number = 0;
  private commandRegistry: CommandRegistry;
  private context: ScriptContext;
  private waitTime: number = 0;
  private isFinished: boolean = false;

  constructor(script: ScriptData, commandRegistry: CommandRegistry, context: ScriptContext) {
    this.script = script;
    this.commandRegistry = commandRegistry;
    this.context = context;
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

    // Handle wait time
    if (this.waitTime > 0) {
      return true; // Still waiting
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
            waitTime: 0,
            waitingForInput: false,
            callStack: [],
            isInTalk: false,
            talkQueue: [],
            belongObject: null,
            waitingForPlayerGoto: false,
            playerGotoDestination: null,
            waitingForPlayerGotoDir: false,
            waitingForPlayerRunTo: false,
            playerRunToDestination: null,
            waitingForNpcGoto: false,
            npcGotoName: null,
            npcGotoDestination: null,
            waitingForNpcGotoDir: false,
            npcGotoDirName: null,
            waitingForFadeIn: false,
            waitingForFadeOut: false,
            waitingForNpcSpecialAction: false,
            npcSpecialActionName: null,
            waitingForMoveScreen: false,
          },
          context: this.context,
          resolveString: (expr: string) => this.resolveString(expr),
          resolveNumber: (expr: string) => this.resolveNumber(expr),
          gotoLabel: (label: string) => this.gotoLabel(label),
          endScript: () => { this.isFinished = true; },
        };

        // CommandHandler 返回 true 继续执行，false 暂停
        const shouldContinue = handler(code.parameters, code.result, helpers);

        // 处理同步或异步返回
        if (shouldContinue === false) {
          // 暂停执行，下次继续从下一行开始
          this.currentLine++;
          return true;
        }

        // Promise 情况在并行脚本中简化处理，视为继续
      }

      this.currentLine++;
    }

    // Script finished
    this.isFinished = true;
    return false;
  }

  private resolveString(expr: string): string {
    if (expr.startsWith("$")) {
      return this.context.getVariable(expr.substring(1)).toString();
    }
    return expr.replace(/^["']|["']$/g, "");
  }

  private resolveNumber(expr: string): number {
    if (expr.startsWith("$")) {
      return this.context.getVariable(expr.substring(1));
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

  updateWaitTime(deltaTime: number): void {
    if (this.waitTime > 0) {
      this.waitTime -= deltaTime;
    }
  }
}

/**
 * 脚本队列项
 * C# Reference: ScriptManager._list 中的 LinkedList<ScriptRunner>
 */
interface ScriptQueueItem {
  scriptPath: string;
  belongObject?: { type: "npc" | "obj"; id: string };
}

export class ScriptExecutor {
  private state: ScriptState;
  private context: ScriptContext;
  private commandRegistry: CommandRegistry;

  // 脚本队列（C# Reference: ScriptManager._list）
  // 外部触发的脚本加入队列，Update 中逐帧处理
  private scriptQueue: ScriptQueueItem[] = [];

  // 并行脚本列表（C# Reference: ScriptManager._parallelListDelayed, _parallelListImmediately）
  private parallelListDelayed: ParallelScriptItem[] = [];
  private parallelListImmediately: ParallelScriptItem[] = [];

  constructor(context: ScriptContext) {
    this.context = context;
    this.commandRegistry = createCommandRegistry();
    this.state = {
      currentScript: null,
      currentLine: 0,
      isRunning: false,
      isPaused: false,
      waitTime: 0,
      waitingForInput: false,
      callStack: [],
      isInTalk: false,
      talkQueue: [],
      // C#: ScriptRunner.BelongObject - the target that triggered this script
      belongObject: null,
      // Blocking wait states
      waitingForPlayerGoto: false,
      playerGotoDestination: null,
      waitingForPlayerGotoDir: false,
      waitingForPlayerRunTo: false,
      playerRunToDestination: null,
      waitingForNpcGoto: false,
      npcGotoName: null,
      npcGotoDestination: null,
      waitingForNpcGotoDir: false,
      npcGotoDirName: null,
      waitingForFadeIn: false,
      waitingForFadeOut: false,
      waitingForNpcSpecialAction: false,
      npcSpecialActionName: null,
      waitingForMoveScreen: false,
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
   * Check if waiting for input
   */
  isWaitingForInput(): boolean {
    return this.state.waitingForInput;
  }

  /**
   * Resume from waiting for input
   */
  resumeFromInput(): void {
    this.state.waitingForInput = false;
  }

  /**
   * Load and run a script file
   * Following C# ScriptManager.RunScript - uses callStack for nested execution
   *
   * @param scriptPath Path to the script file
   * @param belongObject Optional target (NPC or Obj) that triggered this script
   *                     C# Reference: ScriptRunner.BelongObject
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

    // Save current script state to callStack before switching (like C# LinkedList)
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
    this.state.waitingForInput = false;

    // Set belongObject if provided (for commands like DelCurObj)
    if (belongObject) {
      this.state.belongObject = belongObject;
    }

    logger.log(`[ScriptExecutor] Running script: ${scriptPath}`);

    // Notify debug hook with all codes
    const allCodes = script.codes.map((c) => c.literal);
    this.context.onScriptStart?.(script.fileName, script.codes.length, allCodes);

    await this.execute();
  }

  /**
   * Queue a script for execution (外部触发入口)
   * C# Reference: ScriptManager.RunScript - 把脚本添加到 _list 队列
   *
   * 外部事件（如 NPC 死亡、物体交互）应使用此方法。
   * 脚本会被加入队列，在 Update 中按顺序执行。
   * 这是非阻塞的，不等待脚本执行完成。
   *
   * @param scriptPath Path to the script file
   * @param belongObject Optional target that triggered this script
   */
  queueScript(
    scriptPath: string,
    belongObject?: { type: "npc" | "obj"; id: string }
  ): void {
    logger.log(`[ScriptExecutor] Queueing script: ${scriptPath} (queue size: ${this.scriptQueue.length})`);
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
    this.state.waitingForInput = false;

    // Notify debug hook with all codes (unless skipping history)
    if (!skipHistory) {
      const allCodes = script.codes.map((c) => c.literal);
      this.context.onScriptStart?.(script.fileName, script.codes.length, allCodes);
    }

    await this.execute();
  }

  /**
   * Execute current script
   */
  private async execute(): Promise<void> {
    while (this.state.isRunning && this.state.currentScript) {
      if (this.state.isPaused || this.state.waitingForInput) {
        return;
      }

      if (this.state.waitTime > 0) {
        return;
      }

      // Check all blocking wait states
      if (this.isBlocked()) {
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
        this.context.onLineExecuted?.(this.state.currentScript.fileName, this.state.currentLine);
        this.state.currentLine++;
        continue;
      }

      // Record this line as executed (for debug panel)
      this.context.onLineExecuted?.(this.state.currentScript.fileName, this.state.currentLine);

      // Execute command
      const shouldContinue = await this.executeCommand(code.name, code.parameters, code.result);
      if (!shouldContinue) {
        return;
      }

      this.state.currentLine++;
    }
  }

  /**
   * Check if execution is blocked by any wait state
   */
  private isBlocked(): boolean {
    return (
      this.state.waitingForPlayerGoto ||
      this.state.waitingForPlayerGotoDir ||
      this.state.waitingForPlayerRunTo ||
      !!this.state.waitingForPlayerJumpTo ||
      this.state.waitingForNpcGoto ||
      this.state.waitingForNpcGotoDir ||
      this.state.waitingForFadeIn ||
      this.state.waitingForFadeOut ||
      this.state.waitingForNpcSpecialAction ||
      this.state.waitingForMoveScreen ||
      !!this.state.waitingForMoveScreenEx ||
      !!this.state.waitingForBuyGoods ||
      !!this.state.waitingForMovie
    );
  }

  /**
   * Create helpers object for command handlers
   */
  private createHelpers(): CommandHelpers {
    return {
      context: this.context,
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
      this.context.onLineExecuted?.(this.state.currentScript.fileName, lineIndex);
      this.state.currentLine = lineIndex;
    } else {
      logger.warn(`Label not found: ${labelName}`);
    }
  }

  /**
   * End current script and restore parent script if available
   * Following C# ScriptManager behavior - when script ends, continue with parent
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
      return String(this.context.getVariable(varName));
    });
  }

  /**
   * Resolve a number parameter (handle variables)
   */
  private resolveNumber(value: string): number {
    if (value.startsWith("$")) {
      const varName = value.slice(1);
      return this.context.getVariable(varName);
    }
    return parseInt(value, 10) || 0;
  }

  /**
   * Update executor (called each frame)
   */
  update(deltaTime: number): void {
    // Update parallel scripts first (C# Reference: ScriptManager.Update)
    // 使用 void 忽略 Promise，因为并行脚本是异步执行的
    void this.updateParallelScripts(deltaTime);

    // Check sleep/wait timer
    if (this.state.waitTime > 0) {
      this.state.waitTime -= deltaTime;
      if (this.state.waitTime <= 0) {
        this.state.waitTime = 0;
        this.execute();
      }
      return;
    }

    // Check PlayerGoto blocking wait
    if (this.state.waitingForPlayerGoto && this.state.playerGotoDestination) {
      if (this.context.isPlayerGotoEnd(this.state.playerGotoDestination)) {
        this.state.waitingForPlayerGoto = false;
        this.state.playerGotoDestination = null;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check PlayerRunTo blocking wait
    if (this.state.waitingForPlayerRunTo && this.state.playerRunToDestination) {
      if (this.context.isPlayerRunToEnd(this.state.playerRunToDestination)) {
        this.state.waitingForPlayerRunTo = false;
        this.state.playerRunToDestination = null;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check NpcGoto blocking wait
    if (this.state.waitingForNpcGoto && this.state.npcGotoName && this.state.npcGotoDestination) {
      if (this.context.isNpcGotoEnd(this.state.npcGotoName, this.state.npcGotoDestination)) {
        this.state.waitingForNpcGoto = false;
        this.state.npcGotoName = null;
        this.state.npcGotoDestination = null;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check FadeIn blocking wait
    if (this.state.waitingForFadeIn) {
      if (this.context.isFadeInEnd()) {
        this.state.waitingForFadeIn = false;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check FadeOut blocking wait
    if (this.state.waitingForFadeOut) {
      if (this.context.isFadeOutEnd()) {
        this.state.waitingForFadeOut = false;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check NpcSpecialActionEx blocking wait
    if (this.state.waitingForNpcSpecialAction && this.state.npcSpecialActionName) {
      if (this.context.isNpcSpecialActionEnd(this.state.npcSpecialActionName)) {
        this.state.waitingForNpcSpecialAction = false;
        this.state.npcSpecialActionName = null;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check PlayerGotoDir blocking wait
    if (this.state.waitingForPlayerGotoDir) {
      if (this.context.isPlayerGotoDirEnd()) {
        this.state.waitingForPlayerGotoDir = false;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check PlayerJumpTo blocking wait
    if (this.state.waitingForPlayerJumpTo) {
      if (this.context.isPlayerJumpToEnd()) {
        this.state.waitingForPlayerJumpTo = false;
        this.state.playerJumpToDestination = null;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check NpcGotoDir blocking wait
    if (this.state.waitingForNpcGotoDir && this.state.npcGotoDirName) {
      if (this.context.isNpcGotoDirEnd(this.state.npcGotoDirName)) {
        this.state.waitingForNpcGotoDir = false;
        this.state.npcGotoDirName = null;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check MoveScreen blocking wait
    if (this.state.waitingForMoveScreen) {
      if (this.context.isMoveScreenEnd()) {
        this.state.waitingForMoveScreen = false;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check MoveScreenEx blocking wait
    if (this.state.waitingForMoveScreenEx) {
      if (this.context.isMoveScreenExEnd()) {
        this.state.waitingForMoveScreenEx = false;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check BuyGoods blocking wait
    if (this.state.waitingForBuyGoods) {
      if (this.context.isBuyGoodsEnd()) {
        this.state.waitingForBuyGoods = false;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // Check PlayMovie blocking wait
    if (this.state.waitingForMovie) {
      if (this.context.isMovieEnd()) {
        this.state.waitingForMovie = false;
        this.state.currentLine++;
        this.execute();
      }
      return;
    }

    // C# Reference: ScriptManager.Update 中的队列处理
    // 如果当前没有脚本在运行，从队列取一个执行
    if (!this.state.isRunning && this.scriptQueue.length > 0) {
      const next = this.scriptQueue.shift()!;
      logger.log(
        `[ScriptExecutor] Processing queued script: ${next.scriptPath} (${this.scriptQueue.length} remaining)`
      );
      void this.runScript(next.scriptPath, next.belongObject);
    }
  }

  /**
   * Handle dialog closed
   */
  onDialogClosed(): void {
    if (this.state.waitingForInput) {
      // If we're waiting for a selection result, don't continue execution here
      // The selection callback (onSelectionMade) will handle it
      if (this.state.selectionResultVar) {
        return;
      }

      // Check if we're in a Talk sequence with more dialogs
      if (this.state.isInTalk && this.state.talkQueue.length > 0) {
        const next = this.state.talkQueue.shift()!;
        this.context.showDialog(next.text, next.portraitIndex);
        return;
      }

      // Talk sequence finished or regular Say command
      this.state.isInTalk = false;
      this.state.talkQueue = [];
      this.state.waitingForInput = false;
      this.state.currentLine++;
      this.execute();
    }
  }

  /**
   * Handle selection made
   */
  onSelectionMade(index: number): void {
    if (this.state.waitingForInput) {
      if (this.state.selectionResultVar) {
        this.context.setVariable(this.state.selectionResultVar, index);
        this.state.selectionResultVar = undefined;
      }

      this.state.waitingForInput = false;
      this.state.currentLine++;
      this.execute();
    }
  }

  /**
   * Handle multi-selection made (ChooseMultiple)
   * C# Reference: IsChooseMultipleEnd - stores results in varPrefix0, varPrefix1, ...
   */
  onMultiSelectionMade(selectedIndices: number[]): void {
    if (this.state.waitingForInput && this.state.waitingForChooseMultiple) {
      const varPrefix = this.state.chooseMultipleVarPrefix;
      if (varPrefix) {
        // C#: Variables[varName + i] = result[i];
        for (let i = 0; i < selectedIndices.length; i++) {
          this.context.setVariable(`${varPrefix}${i}`, selectedIndices[i]);
        }
        logger.log(`[ScriptExecutor] ChooseMultiple results: ${varPrefix}0...${varPrefix}${selectedIndices.length - 1} = ${selectedIndices.join(', ')}`);
      }
      this.state.chooseMultipleVarPrefix = undefined;
      this.state.waitingForChooseMultiple = false;
      this.state.waitingForInput = false;
      this.state.currentLine++;
      this.execute();
    }
  }

  /**
   * Clear script cache (委托给 resourceLoader)
   */
  clearCache(): void {
    resourceLoader.clearCache("script");
  }

  /**
   * Stop all running scripts and reset state
   * C# Reference: ScriptManager.Clear()
   *
   * This should be called before loading a save to prevent
   * script state from persisting across loads.
   */
  stopAllScripts(): void {
    logger.debug("[ScriptExecutor] Stopping all scripts and resetting state");

    // Reset all state to initial values
    this.state.currentScript = null;
    this.state.currentLine = 0;
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.waitTime = 0;
    this.state.waitingForInput = false;
    this.state.callStack = [];
    this.state.isInTalk = false;
    this.state.talkQueue = [];
    this.state.belongObject = null;

    // Reset all blocking wait states
    this.state.waitingForPlayerGoto = false;
    this.state.playerGotoDestination = null;
    this.state.waitingForPlayerGotoDir = false;
    this.state.waitingForPlayerRunTo = false;
    this.state.playerRunToDestination = null;
    this.state.waitingForNpcGoto = false;
    this.state.npcGotoName = null;
    this.state.npcGotoDestination = null;
    this.state.waitingForNpcGotoDir = false;
    this.state.npcGotoDirName = null;
    this.state.waitingForNpcSpecialAction = false;
    this.state.npcSpecialActionName = null;
    this.state.waitingForFadeIn = false;
    this.state.waitingForFadeOut = false;
    this.state.waitingForMoveScreen = false;

    // Reset selection state if exists
    this.state.selectionResultVar = undefined;

    // Clear script queue (C# Reference: ScriptManager.Clear)
    this.scriptQueue = [];

    // Clear parallel scripts (C# Reference: ScriptManager.ClearParallelScript)
    this.parallelListDelayed = [];
    this.parallelListImmediately = [];

    logger.debug("[ScriptExecutor] All scripts stopped");
  }

  // ============= 并行脚本管理 =============

  /**
   * Run a script in parallel
   * C# Reference: ScriptManager.RunParallelScript(scriptFilePath, delayMilliseconds)
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

    logger.log(`[ScriptExecutor] RunParallelScript: ${scriptFilePath}, delay=${delayMilliseconds}ms`);
  }

  /**
   * Update parallel scripts
   * C# Reference: ScriptManager.Update 中的并行脚本更新逻辑
   */
  private async updateParallelScripts(deltaTime: number): Promise<void> {
    // C# Reference: ScriptManager.Update
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
          item.scriptInRun = new ParallelScriptRunner(script, this.commandRegistry, this.context);
        } else {
          logger.error(`[ScriptExecutor] Failed to load parallel script: ${item.filePath}`);
          delayedToRemove.push(i);
          continue;
        }
      }

      // Run script if ready
      if (item.scriptInRun) {
        item.scriptInRun.updateWaitTime(deltaTime);
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
          item.scriptInRun = new ParallelScriptRunner(script, this.commandRegistry, this.context);
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
   * C# Reference: ScriptManager.ClearParallelScript()
   */
  clearParallelScripts(): void {
    this.parallelListDelayed = [];
    this.parallelListImmediately = [];
    logger.log("[ScriptExecutor] Cleared all parallel scripts");
  }

  /**
   * Get parallel scripts for saving
   * C# Reference: ScriptManager.SaveParallelScript()
   */
  getParallelScriptsForSave(): Array<{ filePath: string; waitMilliseconds: number }> {
    const result: Array<{ filePath: string; waitMilliseconds: number }> = [];

    // Save delayed scripts with remaining wait time
    // C# uses (int)parallelScriptItem.WaitMilliseconds to truncate to integer
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
   * C# Reference: ScriptManager.LoadParallelScript()
   */
  loadParallelScriptsFromSave(scripts: Array<{ filePath: string; waitMilliseconds: number }>): void {
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
