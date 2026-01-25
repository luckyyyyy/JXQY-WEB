/**
 * Script Executor - based on JxqyHD Engine/Script/ScriptExecuter.cs
 * Executes parsed scripts with game commands
 */
import type {
  ScriptData,
  ScriptState,
  GameVariables,
  GameState,
  Vector2,
  SelectionOption,
} from "../core/types";
import { loadScript, parseScript } from "./parser";
import { getTalkTextList } from "../listManager";

export interface ScriptContext {
  // Game state access
  getVariable: (name: string) => number;
  setVariable: (name: string, value: number) => void;

  // Dialog functions
  showDialog: (text: string, portraitIndex: number) => void;
  showMessage: (text: string) => void;
  showSelection: (options: SelectionOption[]) => void;

  // Map functions
  loadMap: (mapName: string) => Promise<void>;
  loadNpc: (fileName: string) => Promise<void>;
  loadGame: (index: number) => Promise<void>;
  setPlayerPosition: (x: number, y: number) => void;
  setPlayerDirection: (direction: number) => void;
  setPlayerState: (state: number) => void;
  playerGoto: (x: number, y: number) => void;

  // NPC functions
  addNpc: (npcFile: string, x: number, y: number) => void;
  deleteNpc: (name: string) => void;
  getNpcPosition: (name: string) => Vector2 | null;
  setNpcPosition: (name: string, x: number, y: number) => void;
  npcGoto: (name: string, x: number, y: number) => void;
  setNpcActionFile: (name: string, stateType: number, asfFile: string) => void;
  npcSpecialAction: (name: string, asfFile: string) => void;
  setNpcLevel: (name: string, level: number) => void;
  setNpcDirection: (name: string, direction: number) => void;
  setNpcState: (name: string, state: number) => void;

  // Player functions
  addGoods: (goodsName: string, count: number) => void;
  removeGoods: (goodsName: string, count: number) => void;
  equipGoods: (equipType: number, goodsId: number) => void;
  addMoney: (amount: number) => void;
  addExp: (amount: number) => void;
  addToMemo: (memoId: number) => void;

  // Obj (interactive objects) functions
  loadObj: (fileName: string) => Promise<void>;
  addObj: (fileName: string, x: number, y: number, direction: number) => Promise<void>;

  // Trap functions
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;

  // Game flow
  sleep: (ms: number) => void;
  playMusic: (file: string) => void;
  stopMusic: () => void;
  playSound: (file: string) => void;
  fadeIn: () => void;
  fadeOut: () => void;
  changeMapColor: (r: number, g: number, b: number) => void;
  changeAsfColor: (r: number, g: number, b: number) => void;
  setLevelFile: (file: string) => void;

  // Wait for user input
  waitForDialogClose: () => void;
  waitForSelection: () => void;
  getSelectionResult: () => number;

  // Script management
  runScript: (scriptFile: string) => Promise<void>;
  getCurrentMapPath: () => string;
}

export class ScriptExecutor {
  private state: ScriptState;
  private context: ScriptContext;
  private scriptCache: Map<string, ScriptData> = new Map();
  private variables: GameVariables;

  constructor(context: ScriptContext, variables: GameVariables) {
    this.context = context;
    this.variables = variables;
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
   */
  async runScript(scriptPath: string): Promise<void> {
    let script: ScriptData | undefined = this.scriptCache.get(scriptPath);
    if (!script) {
      const loadedScript = await loadScript(scriptPath);
      if (loadedScript) {
        script = loadedScript;
        this.scriptCache.set(scriptPath, script);
      }
    }

    if (!script) {
      console.error(`Failed to load script: ${scriptPath}`);
      return;
    }

    this.state.currentScript = script;
    this.state.currentLine = 0;
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.waitingForInput = false;

    await this.execute();
  }

  /**
   * Run a script from content string
   */
  async runScriptContent(content: string, fileName: string): Promise<void> {
    const script = parseScript(content, fileName);
    this.state.currentScript = script;
    this.state.currentLine = 0;
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.waitingForInput = false;

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

      if (this.state.currentLine >= this.state.currentScript.codes.length) {
        // Script finished
        this.endScript();
        return;
      }

      const code = this.state.currentScript.codes[this.state.currentLine];

      // Skip labels
      if (code.isLabel) {
        this.state.currentLine++;
        continue;
      }

      // Execute command
      const shouldContinue = await this.executeCommand(code.name, code.parameters, code.result);
      if (!shouldContinue) {
        return;
      }

      this.state.currentLine++;
    }
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

    switch (cmd) {
      case "say": {
        const text = this.resolveString(params[0] || "");
        const portrait = params[1] ? this.resolveNumber(params[1]) : 0;
        console.log(`[ScriptExecutor] Say: "${text.substring(0, 50)}..." portrait=${portrait}`);
        this.context.showDialog(text, portrait);
        this.state.waitingForInput = true;
        return false;
      }

      case "talk": {
        // Talk uses text from TalkIndex.txt
        const startId = this.resolveNumber(params[0] || "0");
        const endId = this.resolveNumber(params[1] || "0");

        const talkTextList = getTalkTextList();
        const details = talkTextList.getTextDetails(startId, endId);

        if (details.length > 0) {
          // Start talk sequence
          this.state.isInTalk = true;
          this.state.talkQueue = details.map(d => ({
            text: d.text,
            portraitIndex: d.portraitIndex
          }));

          // Show first dialog
          const first = this.state.talkQueue.shift()!;
          this.context.showDialog(first.text, first.portraitIndex);
          this.state.waitingForInput = true;
        } else {
          console.warn(`[ScriptExecutor] Talk: no dialog found for ${startId}-${endId}`);
          this.state.isInTalk = false;
        }
        return false;
      }

      case "if": {
        const condition = params[0] || "";
        if (this.evaluateCondition(condition)) {
          this.gotoLabel(result);
        }
        return true;
      }

      case "goto": {
        this.gotoLabel(params[0]);
        return true;
      }

      case "return": {
        if (this.state.callStack.length > 0) {
          const caller = this.state.callStack.pop()!;
          this.state.currentScript = caller.script;
          this.state.currentLine = caller.line;
        } else {
          this.endScript();
        }
        return false;
      }

      case "assign": {
        const varName = params[0]?.replace("$", "") || "";
        const value = this.resolveNumber(params[1] || "0");
        this.variables[varName] = value;
        this.context.setVariable(varName, value);
        return true;
      }

      case "add": {
        const varName = params[0]?.replace("$", "") || "";
        const value = this.resolveNumber(params[1] || "0");
        const current = this.variables[varName] || 0;
        this.variables[varName] = current + value;
        this.context.setVariable(varName, current + value);
        return true;
      }

      case "sub": {
        const varName = params[0]?.replace("$", "") || "";
        const value = this.resolveNumber(params[1] || "0");
        const current = this.variables[varName] || 0;
        this.variables[varName] = current - value;
        this.context.setVariable(varName, current - value);
        return true;
      }

      case "sleep": {
        const ms = this.resolveNumber(params[0] || "0");
        this.state.waitTime = ms;
        this.context.sleep(ms);
        // Move to next line before returning so we don't repeat this command
        this.state.currentLine++;
        return false;
      }

      case "loadmap": {
        const mapName = this.resolveString(params[0] || "");
        await this.context.loadMap(mapName);
        return true;
      }

      case "setplayerpos": {
        const x = this.resolveNumber(params[0] || "0");
        const y = this.resolveNumber(params[1] || "0");
        this.context.setPlayerPosition(x, y);
        return true;
      }

      case "addnpc": {
        const npcFile = this.resolveString(params[0] || "");
        const x = this.resolveNumber(params[1] || "0");
        const y = this.resolveNumber(params[2] || "0");
        this.context.addNpc(npcFile, x, y);
        return true;
      }

      case "deletenpc": {
        const npcName = this.resolveString(params[0] || "");
        this.context.deleteNpc(npcName);
        return true;
      }

      case "npcgoto": {
        const npcName = this.resolveString(params[0] || "");
        const x = this.resolveNumber(params[1] || "0");
        const y = this.resolveNumber(params[2] || "0");
        this.context.npcGoto(npcName, x, y);
        return true;
      }

      case "addgoods": {
        const goodsName = this.resolveString(params[0] || "");
        const count = this.resolveNumber(params[1] || "1");
        this.context.addGoods(goodsName, count);
        return true;
      }

      case "addmoney": {
        const amount = this.resolveNumber(params[0] || "0");
        this.context.addMoney(amount);
        return true;
      }

      case "addexp": {
        const amount = this.resolveNumber(params[0] || "0");
        this.context.addExp(amount);
        return true;
      }

      case "playmusic": {
        const file = this.resolveString(params[0] || "");
        this.context.playMusic(file);
        return true;
      }

      case "stopmusic": {
        this.context.stopMusic();
        return true;
      }

      case "playsound": {
        const file = this.resolveString(params[0] || "");
        this.context.playSound(file);
        return true;
      }

      case "runscript": {
        const scriptFile = this.resolveString(params[0] || "");
        // Push current state to call stack
        if (this.state.currentScript) {
          this.state.callStack.push({
            script: this.state.currentScript,
            line: this.state.currentLine + 1,
          });
        }
        await this.context.runScript(scriptFile);
        return false;
      }

      case "choose": {
        // Format: Choose("prompt", "option1", "option2", ..., $resultVar)
        // Or: Choose("option1Label", "@label1", "option2Label", "@label2")

        // Check if last param is a variable (result storage)
        const lastParam = params[params.length - 1] || "";
        const hasResultVar = lastParam.startsWith("$");

        const options: SelectionOption[] = [];

        if (hasResultVar) {
          // Format: Choose("prompt", "option1", "option2", $resultVar)
          // Skip first param (prompt) and last param (result var)
          const prompt = this.resolveString(params[0] || "");
          for (let i = 1; i < params.length - 1; i++) {
            options.push({
              text: this.resolveString(params[i]),
              label: String(i - 1), // Use index as label
            });
          }
          // Store result variable name for later
          this.state.selectionResultVar = lastParam.slice(1); // Remove $
        } else {
          // Format: Choose("option1", "@label1", "option2", "@label2")
          for (let i = 0; i < params.length; i += 2) {
            if (params[i] && params[i + 1]) {
              options.push({
                text: this.resolveString(params[i]),
                label: params[i + 1],
              });
            }
          }
        }

        this.context.showSelection(options);
        this.state.waitingForInput = true;
        return false;
      }

      case "message": {
        const text = this.resolveString(params[0] || "");
        this.context.showMessage(text);
        return true;
      }

      case "loadgame": {
        // Load game from save slot
        const index = this.resolveNumber(params[0] || "0");
        console.log("LoadGame:", index);
        await this.context.loadGame(index);
        return true;
      }

      case "loadnpc": {
        // Load NPC file
        const npcFile = this.resolveString(params[0] || "");
        console.log("LoadNpc:", npcFile);
        await this.context.loadNpc(npcFile);
        return true;
      }

      case "playmovie": {
        // Placeholder for movie playback
        console.log("PlayMovie:", params[0]);
        return true;
      }

      // ============= New commands from Begin.txt =============

      case "setplayerdir": {
        const direction = this.resolveNumber(params[0] || "0");
        this.context.setPlayerDirection(direction);
        return true;
      }

      case "setplayerstate": {
        const state = this.resolveNumber(params[0] || "0");
        this.context.setPlayerState(state);
        return true;
      }

      case "playergoto": {
        const x = this.resolveNumber(params[0] || "0");
        const y = this.resolveNumber(params[1] || "0");
        this.context.playerGoto(x, y);
        return true;
      }

      case "setnpcactionfile": {
        const npcName = this.resolveString(params[0] || "");
        const stateType = this.resolveNumber(params[1] || "0");
        const asfFile = this.resolveString(params[2] || "");
        this.context.setNpcActionFile(npcName, stateType, asfFile);
        return true;
      }

      case "npcspecialaction": {
        const npcName = this.resolveString(params[0] || "");
        const asfFile = this.resolveString(params[1] || "");
        this.context.npcSpecialAction(npcName, asfFile);
        return true;
      }

      case "setnpclevel": {
        const npcName = this.resolveString(params[0] || "");
        const level = this.resolveNumber(params[1] || "1");
        this.context.setNpcLevel(npcName, level);
        return true;
      }

      case "equipgoods": {
        const equipType = this.resolveNumber(params[0] || "0");
        const goodsId = this.resolveNumber(params[1] || "0");
        this.context.equipGoods(equipType, goodsId);
        return true;
      }

      case "addtomemo": {
        // Get memo text from TalkIndex.txt and add to memo log
        const memoId = this.resolveNumber(params[0] || "0");
        const talkTextList = getTalkTextList();
        const detail = talkTextList.getTextDetail(memoId);
        if (detail) {
          // Use the text from TalkIndex as memo content
          console.log(`[ScriptExecutor] AddToMemo ${memoId}: ${detail.text}`);
        }
        this.context.addToMemo(memoId);
        return true;
      }

      case "fadein": {
        this.context.fadeIn();
        return true;
      }

      case "fadeout": {
        this.context.fadeOut();
        return true;
      }

      case "changemapcolor": {
        const r = this.resolveNumber(params[0] || "255");
        const g = this.resolveNumber(params[1] || "255");
        const b = this.resolveNumber(params[2] || "255");
        this.context.changeMapColor(r, g, b);
        return true;
      }

      case "changeasfcolor": {
        const r = this.resolveNumber(params[0] || "255");
        const g = this.resolveNumber(params[1] || "255");
        const b = this.resolveNumber(params[2] || "255");
        this.context.changeAsfColor(r, g, b);
        return true;
      }

      case "setlevelfile": {
        const file = this.resolveString(params[0] || "");
        this.context.setLevelFile(file);
        return true;
      }

      // ============= NPC Control Commands =============

      case "setnpcdir": {
        const npcName = this.resolveString(params[0] || "");
        const direction = this.resolveNumber(params[1] || "0");
        this.context.setNpcDirection(npcName, direction);
        return true;
      }

      case "setnpcpos": {
        const npcName = this.resolveString(params[0] || "");
        const x = this.resolveNumber(params[1] || "0");
        const y = this.resolveNumber(params[2] || "0");
        this.context.setNpcPosition(npcName, x, y);
        return true;
      }

      case "delnpc": {
        const npcName = this.resolveString(params[0] || "");
        this.context.deleteNpc(npcName);
        return true;
      }

      case "shownpc": {
        // Show/hide NPC (1 = show, 0 = hide)
        const npcName = this.resolveString(params[0] || "");
        const show = this.resolveNumber(params[1] || "1");
        console.log(`ShowNpc: ${npcName}, show=${show}`);
        return true;
      }

      // ============= Player Control Commands =============

      case "fulllife": {
        // Fully restore player health
        console.log("FullLife");
        return true;
      }

      case "fullmana": {
        // Fully restore player mana
        console.log("FullMana");
        return true;
      }

      case "fullthew": {
        // Fully restore player stamina
        console.log("FullThew");
        return true;
      }

      case "addlife": {
        const amount = this.resolveNumber(params[0] || "0");
        console.log(`AddLife: ${amount}`);
        return true;
      }

      case "addmana": {
        const amount = this.resolveNumber(params[0] || "0");
        console.log(`AddMana: ${amount}`);
        return true;
      }

      case "addthew": {
        const amount = this.resolveNumber(params[0] || "0");
        console.log(`AddThew: ${amount}`);
        return true;
      }

      case "delgoods": {
        const goodsName = this.resolveString(params[0] || "");
        const count = this.resolveNumber(params[1] || "1");
        this.context.removeGoods(goodsName, count);
        return true;
      }

      case "addmagic": {
        const magicId = this.resolveString(params[0] || "");
        console.log(`AddMagic: ${magicId}`);
        return true;
      }

      case "setmagiclevel": {
        const magicId = this.resolveString(params[0] || "");
        const level = this.resolveNumber(params[1] || "1");
        console.log(`SetMagicLevel: ${magicId}, level=${level}`);
        return true;
      }

      // ============= Game State Commands =============

      case "disableinput": {
        console.log("DisableInput");
        return true;
      }

      case "enableinput": {
        console.log("EnableInput");
        return true;
      }

      case "disablenpcai": {
        console.log("DisableNpcAI");
        // TODO: Implement NPC AI disable
        return true;
      }

      case "enablenpcai": {
        console.log("EnableNpcAI");
        // TODO: Implement NPC AI enable
        return true;
      }

      case "savenpc": {
        console.log("SaveNpc - saving current NPCs state");
        // TODO: Implement NPC state saving
        return true;
      }

      case "saveobj": {
        console.log("SaveObj - saving current Objs state");
        // TODO: Implement Obj state saving
        return true;
      }

      case "disablefight": {
        console.log("DisableFight");
        return true;
      }

      case "enablefight": {
        console.log("EnableFight");
        return true;
      }

      case "disablejump": {
        console.log("DisableJump");
        return true;
      }

      case "enablejump": {
        console.log("EnableJump");
        return true;
      }

      case "disablerun": {
        console.log("DisableRun");
        return true;
      }

      case "enablerun": {
        console.log("EnableRun");
        return true;
      }

      // ============= Weather Commands =============

      case "beginrain": {
        const intensity = this.resolveNumber(params[0] || "5");
        console.log(`BeginRain: intensity=${intensity}`);
        return true;
      }

      case "endrain": {
        console.log("EndRain");
        return true;
      }

      case "showsnow": {
        const intensity = this.resolveNumber(params[0] || "5");
        console.log(`ShowSnow: intensity=${intensity}`);
        return true;
      }

      // ============= Trap/Object Commands =============
      // C# SetTrap: SetMapTrap(int.Parse(parameters[1]), Utils.RemoveStringQuotes(parameters[2]), Utils.RemoveStringQuotes(parameters[0]))
      // Parameters: mapName, trapIndex, trapFileName

      case "settrap": {
        // SetTrap(mapName, trapIndex, trapFileName) - C# format
        const mapName = this.resolveString(params[0] || "");
        const trapIndex = this.resolveNumber(params[1] || "0");
        const trapFileName = this.resolveString(params[2] || "");
        console.log(`SetTrap: map=${mapName}, index=${trapIndex}, file=${trapFileName}`);
        this.context.setMapTrap(trapIndex, trapFileName, mapName || undefined);
        return true;
      }

      case "setmaptrap": {
        // SetMapTrap(trapIndex, trapFileName) - C# format
        const trapIndex = this.resolveNumber(params[0] || "0");
        const trapFileName = this.resolveString(params[1] || "");
        console.log(`SetMapTrap: index=${trapIndex}, file=${trapFileName}`);
        this.context.setMapTrap(trapIndex, trapFileName);
        return true;
      }

      case "loadobj": {
        const objFile = this.resolveString(params[0] || "");
        console.log(`LoadObj: ${objFile}`);
        return true;
      }

      case "addobj": {
        const objFile = this.resolveString(params[0] || "");
        const x = this.resolveNumber(params[1] || "0");
        const y = this.resolveNumber(params[2] || "0");
        console.log(`AddObj: ${objFile} at (${x},${y})`);
        return true;
      }

      case "delobj": {
        const objName = this.resolveString(params[0] || "");
        console.log(`DelObj: ${objName}`);
        return true;
      }

      // ============= Script/NPC Script Commands =============

      case "setnpcscript": {
        const npcName = this.resolveString(params[0] || "");
        const scriptFile = this.resolveString(params[1] || "");
        console.log(`SetNpcScript: ${npcName} -> ${scriptFile}`);
        return true;
      }

      case "setnpcdeathscript": {
        const npcName = this.resolveString(params[0] || "");
        const scriptFile = this.resolveString(params[1] || "");
        console.log(`SetNpcDeathScript: ${npcName} -> ${scriptFile}`);
        return true;
      }

      case "setobjscript": {
        const objName = this.resolveString(params[0] || "");
        const scriptFile = this.resolveString(params[1] || "");
        console.log(`SetObjScript: ${objName} -> ${scriptFile}`);
        return true;
      }

      // ============= Memo Commands =============

      case "memo": {
        const memoId = this.resolveNumber(params[0] || "0");
        console.log(`Memo: ${memoId}`);
        return true;
      }

      case "delmemo": {
        const memoId = this.resolveNumber(params[0] || "0");
        console.log(`DelMemo: ${memoId}`);
        return true;
      }

      // ============= Random Commands =============

      case "getrandnum": {
        const varName = params[0]?.replace("$", "") || "";
        const max = this.resolveNumber(params[1] || "100");
        const randValue = Math.floor(Math.random() * max);
        this.variables[varName] = randValue;
        this.context.setVariable(varName, randValue);
        return true;
      }

      case "addrandmoney": {
        const min = this.resolveNumber(params[0] || "0");
        const max = this.resolveNumber(params[1] || "100");
        const amount = min + Math.floor(Math.random() * (max - min + 1));
        this.context.addMoney(amount);
        return true;
      }

      // ============= Watch/Look Commands =============

      case "watch": {
        const char1 = this.resolveString(params[0] || "");
        const char2 = this.resolveString(params[1] || "");
        console.log(`Watch: ${char1} -> ${char2}`);
        return true;
      }

      // ============= Load Commands =============

      case "loadnpc": {
        const npcFile = this.resolveString(params[0] || "");
        console.log(`LoadNpc: ${npcFile}`);
        return true;
      }

      case "loadobj": {
        const fileName = this.resolveString(params[0] || "");
        console.log(`[ScriptExecutor] Executing LoadObj: ${fileName}`);
        await this.context.loadObj(fileName);
        console.log(`[ScriptExecutor] LoadObj completed: ${fileName}`);
        return true;
      }

      case "addobj": {
        const fileName = this.resolveString(params[0] || "");
        const x = this.resolveNumber(params[1] || "0");
        const y = this.resolveNumber(params[2] || "0");
        const direction = this.resolveNumber(params[3] || "0");
        await this.context.addObj(fileName, x, y, direction);
        return true;
      }

      case "loadonenpc": {
        const npcFile = this.resolveString(params[0] || "");
        const x = this.resolveNumber(params[1] || "0");
        const y = this.resolveNumber(params[2] || "0");
        this.context.addNpc(npcFile, x, y);
        return true;
      }

      case "mergenpc": {
        const npcFile = this.resolveString(params[0] || "");
        console.log(`MergeNpc: ${npcFile}`);
        return true;
      }

      case "freemap": {
        console.log("FreeMap");
        return true;
      }

      // ============= Misc Commands =============

      case "clearbody": {
        console.log("ClearBody");
        return true;
      }

      case "displaymessage": {
        const text = this.resolveString(params[0] || "");
        this.context.showMessage(text);
        return true;
      }

      case "showmessage": {
        const text = this.resolveString(params[0] || "");
        this.context.showMessage(text);
        return true;
      }

      default:
        console.log(`Unknown command: ${name}`, params);
        return true;
    }
  }

  /**
   * Go to a label in the current script
   * In C#, when jumping: gotoPosition += ":" to match "@LabelName:" format
   */
  private gotoLabel(label: string): void {
    if (!this.state.currentScript) return;

    // Normalize label format: ensure it starts with @ and ends with :
    // C# adds colon when jumping: gotoPosition += ":"
    let labelName = label;
    if (!labelName.startsWith("@")) {
      labelName = `@${labelName}`;
    }
    if (!labelName.endsWith(":")) {
      labelName = `${labelName}:`;
    }

    const lineIndex = this.state.currentScript.labels.get(labelName);

    if (lineIndex !== undefined) {
      this.state.currentLine = lineIndex;
    } else {
      console.warn(`Label not found: ${labelName}`);
    }
  }

  /**
   * End current script
   */
  private endScript(): void {
    this.state.isRunning = false;
    this.state.currentScript = null;
    this.state.currentLine = 0;
  }

  /**
   * Resolve a string parameter (handle variables)
   */
  private resolveString(value: string): string {
    // Replace $varName with variable value
    return value.replace(/\$(\w+)/g, (_, varName) => {
      return String(this.variables[varName] || 0);
    });
  }

  /**
   * Resolve a number parameter (handle variables)
   */
  private resolveNumber(value: string): number {
    // Check if it's a variable
    if (value.startsWith("$")) {
      const varName = value.slice(1);
      return this.variables[varName] || 0;
    }
    return parseInt(value, 10) || 0;
  }

  /**
   * Evaluate a condition
   * C# regex: (\$[_a-zA-Z0-9]+) *([><=]+).*?([-]?[0-9]+)
   * C# operators: ==, >>, >=, <<, <=, <>
   */
  private evaluateCondition(condition: string): boolean {
    // Parse condition like "$Event == 302" or "$Money >= 100"
    // Support C# style operators: <> (not equal), >> (greater than), << (less than)
    const match = condition.match(/\$([_a-zA-Z0-9]+)\s*([><=]+)\s*([-]?\d+|\$[_a-zA-Z0-9]+)/);
    if (!match) {
      // Simple variable check - non-zero is true
      if (condition.startsWith("$")) {
        const varName = condition.slice(1).trim();
        return (this.variables[varName] || 0) !== 0;
      }
      return false;
    }

    const [, varName, operator, rightValue] = match;
    const leftVal = this.variables[varName] || 0;
    const rightVal = rightValue.startsWith("$")
      ? this.variables[rightValue.slice(1)] || 0
      : parseInt(rightValue, 10);

    switch (operator) {
      case "==":
        return leftVal === rightVal;
      case "!=":
      case "<>":  // C# style not equal
        return leftVal !== rightVal;
      case ">=":
        return leftVal >= rightVal;
      case "<=":
        return leftVal <= rightVal;
      case ">":
      case ">>":  // C# style greater than
        return leftVal > rightVal;
      case "<":
      case "<<":  // C# style less than
        return leftVal < rightVal;
      default:
        return false;
    }
  }

  /**
   * Update executor (called each frame)
   */
  update(deltaTime: number): void {
    if (this.state.waitTime > 0) {
      this.state.waitTime -= deltaTime;
      if (this.state.waitTime <= 0) {
        this.state.waitTime = 0;
        // Resume execution
        this.execute();
      }
    }
  }

  /**
   * Handle dialog closed
   */
  onDialogClosed(): void {
    if (this.state.waitingForInput) {
      // Check if we're in a Talk sequence with more dialogs
      if (this.state.isInTalk && this.state.talkQueue.length > 0) {
        // Show next dialog in the queue
        const next = this.state.talkQueue.shift()!;
        this.context.showDialog(next.text, next.portraitIndex);
        // Stay in waitingForInput state
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
      // Store result in variable if specified
      if (this.state.selectionResultVar) {
        this.variables[this.state.selectionResultVar] = index;
        this.context.setVariable(this.state.selectionResultVar, index);
        this.state.selectionResultVar = undefined;
      }

      this.state.waitingForInput = false;
      this.state.currentLine++;
      this.execute();
    }
  }

  /**
   * Clear script cache
   */
  clearCache(): void {
    this.scriptCache.clear();
  }
}
