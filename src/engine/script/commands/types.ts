/**
 * Command Handler Types
 * Shared types for script command handlers
 */
import type { ScriptState, SelectionOption, Vector2 } from "@/engine/core/types";
import type { TalkTextListManager } from "@/engine/listManager/talkTextList";

export interface ScriptContext {
  // System access
  talkTextList: TalkTextListManager;

  // Game state access
  getVariable: (name: string) => number;
  setVariable: (name: string, value: number) => void;

  // Dialog functions
  showDialog: (text: string, portraitIndex: number) => void;
  showMessage: (text: string) => void;
  showDialogSelection: (message: string, selectA: string, selectB: string) => void;
  showSelection: (options: SelectionOption[], message?: string) => void;

  // Map functions
  loadMap: (mapName: string) => Promise<void>;
  loadNpc: (fileName: string) => Promise<void>;
  loadGame: (index: number) => Promise<void>;
  setPlayerPosition: (x: number, y: number, characterName?: string) => void;
  setPlayerDirection: (direction: number) => void;
  setPlayerState: (state: number) => void;
  playerGoto: (x: number, y: number) => void;
  isPlayerGotoEnd: (destination: Vector2) => boolean;
  playerGotoDir: (direction: number, steps: number) => void;
  isPlayerGotoDirEnd: () => boolean;
  playerRunTo: (x: number, y: number) => void;
  isPlayerRunToEnd: (destination: Vector2) => boolean;

  // NPC functions
  addNpc: (npcFile: string, x: number, y: number, direction?: number) => void;
  deleteNpc: (name: string) => void;
  getNpcPosition: (name: string) => Vector2 | null;
  setNpcPosition: (name: string, x: number, y: number) => void;
  npcGoto: (name: string, x: number, y: number) => void;
  isNpcGotoEnd: (name: string, destination: Vector2) => boolean;
  npcGotoDir: (name: string, direction: number, steps: number) => void;
  isNpcGotoDirEnd: (name: string) => boolean;
  setNpcActionFile: (name: string, stateType: number, asfFile: string) => void;
  npcSpecialAction: (name: string, asfFile: string) => void;
  isNpcSpecialActionEnd: (name: string) => boolean;
  setNpcLevel: (name: string, level: number) => void;
  setNpcDirection: (name: string, direction: number) => void;
  setNpcState: (name: string, state: number) => void;
  setNpcRelation: (name: string, relation: number) => void;
  setNpcDeathScript: (name: string, scriptFile: string) => void;
  setNpcScript: (name: string, scriptFile: string) => void; // C#: SetNpcScript - set NPC interaction script
  showNpc: (name: string, show: boolean) => void; // C#: ShowNpc - show/hide NPC
  mergeNpc: (npcFile: string) => Promise<void>; // C#: MergeNpc - merge NPC file without clearing
  saveNpc: (fileName?: string) => Promise<void>; // C#: SaveNpc - save NPC state
  watch: (char1: string, char2: string, watchType: number) => void; // C#: Watch - make characters face each other
  enableNpcAI: () => void;
  disableNpcAI: () => void;

  // Camera functions
  moveScreen: (direction: number, distance: number, speed: number) => void;
  isMoveScreenEnd: () => boolean;

  // Player functions
  addGoods: (goodsName: string, count: number) => void;
  removeGoods: (goodsName: string, count: number) => void;
  equipGoods: (equipType: number, goodsId: number) => void;
  addMoney: (amount: number) => void;
  addExp: (amount: number) => void;

  // Player stats (C#: Globals.ThePlayer.FullLife/AddLife/etc.)
  fullLife: () => void;
  fullMana: () => void;
  fullThew: () => void;
  addLife: (amount: number) => void;
  addMana: (amount: number) => void;
  addThew: (amount: number) => void;

  // Magic functions (C#: AddMagic, SetMagicLevel)
  addMagic: (magicFile: string) => Promise<void>;
  setMagicLevel: (magicFile: string, level: number) => void;

  // Memo functions (任务系统)
  addMemo: (text: string) => void;
  delMemo: (text: string) => void;
  addToMemo: (memoId: number) => Promise<void>;
  delMemoById: (memoId: number) => Promise<void>;

  // Obj (interactive objects) functions
  loadObj: (fileName: string) => Promise<void>;
  addObj: (fileName: string, x: number, y: number, direction: number) => Promise<void>;
  delCurObj: () => void; // C#: DelCurObj - removes the object that triggered the script
  delObj: (objName: string) => void; // C#: DelObj - removes object by name
  openBox: (objName?: string) => void; // C#: OpenBox - plays box opening animation
  closeBox: (objName?: string) => void; // C#: CloseBox - plays box closing animation
  addRandGoods: (buyFileName: string) => Promise<void>; // C#: AddRandGoods - adds random item from buy file
  setObjScript: (objNameOrId: string, scriptFile: string) => void; // C#: SetObjScript - set object script file
  saveObj: (fileName?: string) => Promise<void>; // C#: SaveObj - save object state
  clearBody: () => void; // C#: ClearBody - clear dead NPC bodies
  getObjPosition: (objNameOrId: string) => Vector2 | null; // Get OBJ tile position

  // Trap functions
  setMapTrap: (trapIndex: number, trapFileName: string, mapName?: string) => void;

  // Game flow
  sleep: (ms: number) => void;
  playMusic: (file: string) => void;
  stopMusic: () => void;
  playSound: (file: string, emitterPosition?: Vector2) => void;
  playMovie: (file: string) => void; // C#: PlayMovie - play video file
  fadeIn: () => void;
  fadeOut: () => void;
  isFadeInEnd: () => boolean;
  isFadeOutEnd: () => boolean;
  changeMapColor: (r: number, g: number, b: number) => void;
  changeAsfColor: (r: number, g: number, b: number) => void;
  beginRain: (fileName: string) => void; // C#: BeginRain - start rain effect with config file
  endRain: () => void; // C#: EndRain - stop rain effect
  showSnow: (show: boolean) => void; // C#: ShowSnow - show/hide snow effect
  freeMap: () => void; // C#: FreeMap - release map resources
  setLevelFile: (file: string) => void | Promise<void>;

  // Timer commands (C#: TimerGui, ScriptExecuter)
  openTimeLimit: (seconds: number) => void; // C#: OpenTimeLimit - start countdown
  closeTimeLimit: () => void; // C#: CloseTimeLimit - stop countdown
  hideTimerWnd: () => void; // C#: HideTimerWnd - hide timer but keep running
  setTimeScript: (triggerSeconds: number, scriptFileName: string) => void; // C#: SetTimeScript - run script at specified time

  // Input/ability control (C#: Globals.IsInputDisabled, Player.IsFightDisabled, etc.)
  disableInput: () => void;
  enableInput: () => void;
  disableFight: () => void;
  enableFight: () => void;
  disableJump: () => void;
  enableJump: () => void;
  disableRun: () => void;
  enableRun: () => void;

  // Player extended commands
  playerJumpTo: (x: number, y: number) => void; // C#: PlayerJumpTo - player jumps to tile
  isPlayerJumpToEnd: () => boolean; // C#: IsPlayerJumpToEnd - check if jump finished
  playerGotoEx: (x: number, y: number) => void; // C#: PlayerGotoEx - walk to (non-blocking)
  playerRunToEx: (x: number, y: number) => void; // C#: PlayerRunToEx - run to (non-blocking)
  setPlayerScn: () => void; // C#: SetPlayerScn - center camera on player
  getMoneyNum: () => number; // C#: GetMoneyNum
  setMoneyNum: (amount: number) => void; // C#: SetMoneyNum
  getPlayerExp: () => number; // C#: GetPlayerExp
  getPlayerState: (stateName: string) => number; // C#: GetPlayerState(Level/Attack/Defend/etc)
  getPlayerMagicLevel: (magicFile: string) => number; // C#: GetPlayerMagicLevel
  limitMana: (limit: boolean) => void; // C#: LimitMana
  addMoveSpeedPercent: (percent: number) => void; // C#: AddMoveSpeedPercent
  useMagic: (magicFile: string, x?: number, y?: number) => void; // C#: UseMagic
  isEquipWeapon: () => boolean; // C#: IsEquipWeapon
  addAttack: (value: number, type?: number) => void; // C#: AddAttack
  addDefend: (value: number, type?: number) => void; // C#: AddDefend
  addEvade: (value: number) => void; // C#: AddEvade
  addLifeMax: (value: number) => void; // C#: AddLifeMax
  addManaMax: (value: number) => void; // C#: AddManaMax
  addThewMax: (value: number) => void; // C#: AddThewMax
  delMagic: (magicFile: string) => void; // C#: DelMagic
  setPlayerMagicToUseWhenBeAttacked: (magicFile: string, direction: number) => void; // C#: SetPlayerMagicToUseWhenBeAttacked
  setWalkIsRun: (value: number) => void; // C#: SetWalkIsRun

  // NPC extended commands
  setNpcKind: (name: string, kind: number) => void; // C#: SetNpcKind
  setNpcMagicFile: (name: string, magicFile: string) => void; // C#: SetNpcMagicFile
  setNpcRes: (name: string, resFile: string) => void; // C#: SetNpcRes
  setNpcAction: (name: string, action: number, x?: number, y?: number) => void; // C#: SetNpcAction
  setNpcActionType: (name: string, actionType: number) => void; // C#: SetNpcActionType
  setAllNpcScript: (name: string, scriptFile: string) => void; // C#: SetAllNpcScript
  setAllNpcDeathScript: (name: string, scriptFile: string) => void; // C#: SetAllNpcDeathScript
  npcAttack: (name: string, x: number, y: number) => void; // C#: NpcAttack
  followNpc: (follower: string, target: string) => void; // C#: FollowNpc
  setNpcMagicToUseWhenBeAttacked: (name: string, magicFile: string, direction: number) => void; // C#: SetNpcMagicToUseWhenBeAttacked
  addNpcProperty: (name: string, property: string, value: number) => void; // C#: AddNpcProperty
  changeFlyIni: (name: string, magicFile: string) => void; // C#: ChangeFlyIni
  changeFlyIni2: (name: string, magicFile: string) => void; // C#: ChangeFlyIni2
  addFlyInis: (name: string, magicFile: string, distance: number) => void; // C#: AddFlyInis
  setNpcDestination: (name: string, x: number, y: number) => void; // C#: SetNpcDestination
  getNpcCount: (kind1: number, kind2: number) => number; // C#: GetNpcCount
  setKeepAttack: (name: string, x: number, y: number) => void; // C#: SetKeepAttack

  // Goods extended commands
  buyGoods: (buyFile: string, canSellSelfGoods: boolean) => void; // C#: BuyGoods
  isBuyGoodsEnd: () => boolean; // C#: IsBuyGoodsEnd
  getGoodsNum: (goodsFile: string) => number; // C#: GetGoodsNum
  getGoodsNumByName: (goodsName: string) => number; // C#: GetGoodsNumByName
  clearGoods: () => void; // C#: ClearGoods
  clearMagic: () => void; // C#: ClearMagic
  delGoodByName: (name: string, count?: number) => void; // C#: DelGoodByName
  checkFreeGoodsSpace: () => boolean; // C#: CheckFreeGoodsSpace
  checkFreeMagicSpace: () => boolean; // C#: CheckFreeMagicSpace
  setDropIni: (name: string, dropFile: string) => void; // C#: SetDropIni
  enableDrop: () => void; // C#: EnableDrop
  disableDrop: () => void; // C#: DisableDrop

  // Camera extended commands
  moveScreenEx: (x: number, y: number, speed: number) => void; // C#: MoveScreenEx
  isMoveScreenExEnd: () => boolean; // C#: IsMoveScreenExEnd
  setMapPos: (x: number, y: number) => void; // C#: SetMapPos
  openWaterEffect: () => void; // C#: OpenWaterEffect
  closeWaterEffect: () => void; // C#: CloseWaterEffect

  // Save commands
  saveMapTrap: () => void; // C#: SaveMapTrap
  clearAllSave: () => void; // C#: ClearAllSave
  enableSave: () => void; // C#: EnableSave
  disableSave: () => void; // C#: DisableSave

  // Variable commands
  clearAllVar: (keepsVars?: string[]) => void; // C#: ClearAllVar
  getPartnerIdx: () => number; // C#: GetPartnerIdx

  // Effect commands
  petrifyMillisecond: (ms: number) => void; // C#: PetrifyMillisecond
  poisonMillisecond: (ms: number) => void; // C#: PoisonMillisecond
  frozenMillisecond: (ms: number) => void; // C#: FrozenMillisecond

  // Misc commands
  runParallelScript: (scriptFile: string, delay?: number) => void; // C#: RunParallelScript
  setObjOfs: (objName: string, x: number, y: number) => void; // C#: SetObjOfs
  setShowMapPos: (show: boolean) => void; // C#: SetShowMapPos
  showSystemMsg: (msg: string, stayTime?: number) => void; // C#: ShowSystemMsg
  randRun: (probability: number, script1: string, script2: string) => void; // C#: RandRun
  stopSound: () => void; // C#: StopSound

  // Dialog extended commands
  chooseEx: (message: string, options: Array<{text: string; condition?: string}>, resultVar: string) => void; // C#: ChooseEx
  chooseMultiple: (columns: number, rows: number, varPrefix: string, message: string, options: Array<{text: string; condition?: string}>) => void; // C#: ChooseMultiple
  isChooseExEnd: () => boolean; // C#: IsChooseExEnd
  isChooseMultipleEnd: () => boolean; // C#: IsChooseMultipleEnd
  getMultiSelectionResult: () => number; // C#: GetMultiSelectionResult
  getChooseMultipleResult: () => number[]; // C#: GetChooseMultipleResult

  // Character state commands
  toNonFightingState: () => void; // C#: PlayerKindCharacter.ToNonFightingState() - exit fighting mode

  // Wait for user input
  waitForDialogClose: () => void;
  waitForSelection: () => void;
  getSelectionResult: () => number;

  // Script management
  runScript: (scriptFile: string) => Promise<void>;
  getCurrentMapPath: () => string;
  returnToTitle: () => void;

  // Map time
  setMapTime: (time: number) => void; // C#: MapBase.MapTime

  // Player change
  playerChange: (index: number) => Promise<void>; // C#: Loader.ChangePlayer

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
