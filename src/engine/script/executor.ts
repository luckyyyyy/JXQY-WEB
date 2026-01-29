/**
 * Script Executor - based on JxqyHD Engine/Script/ScriptExecuter.cs
 * Executes parsed scripts with game commands
 *
 * Commands are organized in separate files under ./commands/
 */
import type {
  ScriptData,
  ScriptState,
} from "../core/types";
import { loadScript, parseScript } from "./parser";
import {
  createCommandRegistry,
  type ScriptContext,
  type CommandRegistry,
  type CommandHelpers
} from "./commands";
import { resourceLoader } from "../resource/resourceLoader";

// Re-export ScriptContext for backwards compatibility
export type { ScriptContext } from "./commands";

export class ScriptExecutor {
  private state: ScriptState;
  private context: ScriptContext;
  private commandRegistry: CommandRegistry;

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
   * Following C# ScriptManager.RunScript - adds to script list and continues from there
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
      console.error(`Failed to load script: ${scriptPath}`);
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
      console.log(`[ScriptExecutor] Pushed to callStack: ${this.state.currentScript.fileName} at line ${this.state.currentLine}`);
    }

    this.state.currentScript = script;
    this.state.currentLine = 0;
    this.state.isPaused = false;
    this.state.waitingForInput = false;

    // Set belongObject if provided (for commands like DelCurObj)
    if (belongObject) {
      this.state.belongObject = belongObject;
    }

    console.log(`[ScriptExecutor] Running script: ${scriptPath}`);

    // Notify debug hook with all codes
    const allCodes = script.codes.map(c => c.literal);
    this.context.onScriptStart?.(script.fileName, script.codes.length, allCodes);

    await this.execute();
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
      const allCodes = script.codes.map(c => c.literal);
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
      this.state.waitingForNpcGoto ||
      this.state.waitingForNpcGotoDir ||
      this.state.waitingForFadeIn ||
      this.state.waitingForFadeOut ||
      this.state.waitingForNpcSpecialAction ||
      this.state.waitingForMoveScreen
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
  private async executeCommand(
    name: string,
    params: string[],
    result: string
  ): Promise<boolean> {
    const cmd = name.toLowerCase();
    console.log(`[ScriptExecutor] Executing: ${name}(${params.join(", ")})`);

    const handler = this.commandRegistry.get(cmd);
    if (handler) {
      return handler(params, result, this.createHelpers());
    }

    console.log(`Unknown command: ${name}`, params);
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
      console.warn(`Label not found: ${labelName}`);
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
      console.log(`[ScriptExecutor] Restoring from callStack: ${parent.script.fileName} at line ${parent.line}`);
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
    console.log("[ScriptExecutor] Stopping all scripts and resetting state");

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

    console.log("[ScriptExecutor] All scripts stopped");
  }
}
