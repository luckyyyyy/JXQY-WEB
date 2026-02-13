/**
 * Command Handler Types
 * Shared types for script command handlers
 */
import type { ScriptState, SelectionOption } from "../../core/types";
import type { TalkTextListManager } from "../../data/talk-text-list";

export interface ScriptContext {
  // System access
  talkTextList: TalkTextListManager;

  // Game state access
  getVariable: (name: string) => number;
  setVariable: (name: string, value: number) => void;

  // Dialog (blocking → Promise)
  showDialog: (text: string, portraitIndex: number) => Promise<void>;
  showTalk: (startId: number, endId: number) => Promise<void>;
  showMessage: (text: string) => void;
  showDialogSelection: (message: string, selectA: string, selectB: string) => Promise<number>;
  showSelection: (options: SelectionOption[], message?: string) => Promise<number>;

  // Map functions
  loadMap: (mapName: string) => Promise<void>;
  loadNpc: (fileName: string) => Promise<void>;
  loadGame: (index: number) => Promise<void>;
  setPlayerPosition: (x: number, y: number, characterName?: string) => void;
  setPlayerDirection: (direction: number) => void;
  setPlayerState: (state: number) => void;

  // Player movement (blocking → Promise)
  playerGoto: (x: number, y: number) => Promise<void>;
  playerGotoDir: (direction: number, steps: number) => Promise<void>;
  playerRunTo: (x: number, y: number) => Promise<void>;
  playerJumpTo: (x: number, y: number) => Promise<void>;
  playerGotoEx: (x: number, y: number) => void; // walk to (non-blocking)
  playerRunToEx: (x: number, y: number) => void; // run to (non-blocking)

  // NPC functions
  addNpc: (npcFile: string, x: number, y: number, direction?: number) => Promise<void>;
  deleteNpc: (name: string) => void;
  getNpcPosition: (name: string) => { x: number; y: number } | null;
  setNpcPosition: (name: string, x: number, y: number) => void;
  npcGoto: (name: string, x: number, y: number) => Promise<void>;
  npcGotoNonBlocking: (name: string, x: number, y: number) => void;
  npcGotoDir: (name: string, direction: number, steps: number) => Promise<void>;
  setNpcActionFile: (name: string, stateType: number, asfFile: string) => Promise<void>;
  npcSpecialAction: (name: string, asfFile: string) => Promise<void>;
  npcSpecialActionNonBlocking: (name: string, asfFile: string) => void;
  setNpcLevel: (name: string, level: number) => void;
  setNpcDirection: (name: string, direction: number) => void;
  setNpcState: (name: string, state: number) => void;
  setNpcRelation: (name: string, relation: number) => void;
  setNpcDeathScript: (name: string, scriptFile: string) => void;
  setNpcScript: (name: string, scriptFile: string) => void;
  showNpc: (name: string, show: boolean) => void;
  mergeNpc: (npcFile: string) => Promise<void>;
  saveNpc: (fileName?: string) => Promise<void>;
  watch: (char1: string, char2: string, watchType: number) => void;
  enableNpcAI: () => void;
  disableNpcAI: () => void;

  // Camera (blocking → Promise)
  moveScreen: (direction: number, distance: number, speed: number) => Promise<void>;
  moveScreenEx: (x: number, y: number, speed: number) => Promise<void>;
  setMapPos: (x: number, y: number) => void;
  openWaterEffect: () => void;
  closeWaterEffect: () => void;

  // Player items/stats
  addGoods: (goodsName: string, count: number) => void;
  removeGoods: (goodsName: string, count: number) => void;
  equipGoods: (equipType: number, goodsId: number) => void;
  addMoney: (amount: number) => void;
  addExp: (amount: number) => void;
  fullLife: () => void;
  fullMana: () => void;
  fullThew: () => void;
  addLife: (amount: number) => void;
  addMana: (amount: number) => void;
  addThew: (amount: number) => void;

  // Magic functions
  addMagic: (magicFile: string) => Promise<void>;
  setMagicLevel: (magicFile: string, level: number) => void;

  // Memo functions (任务系统)
  addMemo: (text: string) => void;
  delMemo: (text: string) => void;
  addToMemo: (memoId: number) => Promise<void>;
  delMemoById: (memoId: number) => Promise<void>;

  // Obj (interactive objects)
  loadObj: (fileName: string) => Promise<void>;
  addObj: (fileName: string, x: number, y: number, direction: number) => Promise<void>;
  delCurObj: () => void;
  delObj: (objName: string) => void;
  openBox: (objName?: string) => void;
  closeBox: (objName?: string) => void;
  addRandGoods: (buyFileName: string) => Promise<void>;
  setObjScript: (objNameOrId: string, scriptFile: string) => void;
  saveObj: (fileName?: string) => Promise<void>;
  clearBody: () => void;
  getObjPosition: (objNameOrId: string) => { x: number; y: number } | null;

  // Trap functions
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;

  // Game flow (blocking → Promise)
  sleep: (ms: number) => Promise<void>;
  playMusic: (file: string) => void;
  stopMusic: () => void;
  playSound: (file: string, emitterPosition?: { x: number; y: number }) => void;
  playMovie: (file: string) => Promise<void>;
  fadeIn: () => Promise<void>;
  fadeOut: () => Promise<void>;
  changeMapColor: (r: number, g: number, b: number) => void;
  changeAsfColor: (r: number, g: number, b: number) => void;
  beginRain: (fileName: string) => void;
  endRain: () => void;
  showSnow: (show: boolean) => void;
  freeMap: () => void;
  setLevelFile: (file: string) => Promise<void>;

  // Timer commands
  openTimeLimit: (seconds: number) => void;
  closeTimeLimit: () => void;
  hideTimerWnd: () => void;
  setTimeScript: (triggerSeconds: number, scriptFileName: string) => void;

  // Input/ability control
  disableInput: () => void;
  enableInput: () => void;
  disableFight: () => void;
  enableFight: () => void;
  disableJump: () => void;
  enableJump: () => void;
  disableRun: () => void;
  enableRun: () => void;

  // Player extended commands
  setPlayerScn: () => void; // center camera on player
  getMoneyNum: () => number;
  setMoneyNum: (amount: number) => void;
  getPlayerExp: () => number;
  getPlayerState: (stateName: string) => number;
  getPlayerMagicLevel: (magicFile: string) => number;
  limitMana: (limit: boolean) => void;
  addMoveSpeedPercent: (percent: number) => void;
  useMagic: (magicFile: string, x?: number, y?: number) => void;
  isEquipWeapon: () => boolean;
  addAttack: (value: number, type?: number) => void;
  addDefend: (value: number, type?: number) => void;
  addEvade: (value: number) => void;
  addLifeMax: (value: number) => void;
  addManaMax: (value: number) => void;
  addThewMax: (value: number) => void;
  delMagic: (magicFile: string) => void;
  setPlayerMagicToUseWhenBeAttacked: (magicFile: string, direction: number) => void;
  setWalkIsRun: (value: number) => void;

  // NPC extended commands
  setNpcKind: (name: string, kind: number) => void;
  setNpcMagicFile: (name: string, magicFile: string) => void;
  setNpcRes: (name: string, resFile: string) => void | Promise<void>;
  setNpcAction: (name: string, action: number, x?: number, y?: number) => void;
  setNpcActionType: (name: string, actionType: number) => void;
  setAllNpcScript: (name: string, scriptFile: string) => void;
  setAllNpcDeathScript: (name: string, scriptFile: string) => void;
  npcAttack: (name: string, x: number, y: number) => void;
  followNpc: (follower: string, target: string) => void;
  setNpcMagicToUseWhenBeAttacked: (name: string, magicFile: string, direction: number) => void;
  addNpcProperty: (name: string, property: string, value: number) => void;
  changeFlyIni: (name: string, magicFile: string) => void;
  changeFlyIni2: (name: string, magicFile: string) => void;
  addFlyInis: (name: string, magicFile: string, distance: number) => void;
  setNpcDestination: (name: string, x: number, y: number) => void;
  getNpcCount: (kind1: number, kind2: number) => number;
  setKeepAttack: (name: string, x: number, y: number) => void;

  // Goods extended (blocking → Promise)
  buyGoods: (buyFile: string, canSellSelfGoods: boolean) => Promise<void>;
  getGoodsNum: (goodsFile: string) => number;
  getGoodsNumByName: (goodsName: string) => number;
  clearGoods: () => void;
  clearMagic: () => void;
  delGoodByName: (name: string, count?: number) => void;
  checkFreeGoodsSpace: () => boolean;
  checkFreeMagicSpace: () => boolean;
  setDropIni: (name: string, dropFile: string) => void;
  enableDrop: () => void;
  disableDrop: () => void;

  // Save commands
  saveMapTrap: () => void;
  clearAllSave: () => void;
  enableSave: () => void;
  disableSave: () => void;

  // Variable commands
  clearAllVar: (keepsVars?: string[]) => void;
  getPartnerIdx: () => number;

  // Effect commands
  petrifyMillisecond: (ms: number) => void;
  poisonMillisecond: (ms: number) => void;
  frozenMillisecond: (ms: number) => void;

  // Misc commands
  runParallelScript: (scriptFile: string, delay?: number) => void;
  setObjOfs: (objName: string, x: number, y: number) => void;
  setShowMapPos: (show: boolean) => void;
  showSystemMsg: (msg: string, stayTime?: number) => void;
  randRun: (probability: number, script1: string, script2: string) => void;
  stopSound: () => void;

  // Dialog extended (blocking → Promise)
  chooseEx: (
    message: string,
    options: Array<{ text: string; condition?: string }>,
    resultVar: string
  ) => Promise<number>;
  chooseMultiple: (
    columns: number,
    rows: number,
    varPrefix: string,
    message: string,
    options: Array<{ text: string; condition?: string }>
  ) => Promise<number[]>;

  // Character state commands
  toNonFightingState: () => void;

  // Script management
  runScript: (scriptFile: string) => Promise<void>;
  getCurrentMapPath: () => string;
  returnToTitle: () => void;

  // Map time
  setMapTime: (time: number) => void;

  // Player change
  playerChange: (index: number) => Promise<void>;

  // Debug hooks (optional)
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;
}

/**
 * Command handler function signature
 * Returns true to continue execution, false to pause
 */
export type CommandHandler = (
  params: string[],
  result: string,
  helpers: CommandHelpers
) => Promise<boolean> | boolean;

/**
 * Helper functions available to command handlers
 * 变量通过 context.getVariable/setVariable 访问，不再直接传递 variables 对象
 */
export interface CommandHelpers {
  context: ScriptContext;
  state: ScriptState;
  resolveString: (value: string) => string;
  resolveNumber: (value: string) => number;
  gotoLabel: (label: string) => void;
  endScript: () => void;
}

/**
 * Command registry type
 */
export type CommandRegistry = Map<string, CommandHandler>;
