/**
 * GameAPI - Structured interface for all script engines (custom, JS, Lua)
 *
 * This is the single source of truth for game functionality exposed to scripts.
 *
 * Design principles:
 * - Domain-grouped sub-interfaces (player, npc, goods, etc.)
 * - Blocking operations return Promise (powered by BlockingResolver internally)
 * - Both DSL executor and JS/Lua engines share the same API
 * - No engine internals leaked - only script-level operations
 */

import type { SelectionOptionData } from "../../core/gui-state-types";
import type { Vector2 } from "../../core/types";
import type { TalkTextListManager } from "../../gui/talk-text-list";

// ===== Top-level GameAPI =====

export interface GameAPI {
  readonly player: PlayerAPI;
  readonly npc: NpcAPI;
  readonly goods: GoodsAPI;
  readonly magic: MagicAPI;
  readonly memo: MemoAPI;
  readonly map: MapAPI;
  readonly obj: ObjAPI;
  readonly camera: CameraAPI;
  readonly audio: AudioAPI;
  readonly effects: EffectsAPI;
  readonly dialog: DialogAPI;
  readonly timer: TimerAPI;
  readonly variables: VariableAPI;
  readonly input: InputAPI;
  readonly save: SaveAPI;
  readonly script: ScriptRunnerAPI;
}

// ===== Player =====

export interface PlayerAPI {
  // Position & movement (blocking → Promise)
  setPosition(x: number, y: number, characterName?: string): void;
  setDirection(direction: number): void;
  setState(state: number): void;
  walkTo(x: number, y: number): Promise<void>;
  walkToDir(direction: number, steps: number): Promise<void>;
  runTo(x: number, y: number): Promise<void>;
  jumpTo(x: number, y: number): Promise<void>;
  walkToNonBlocking(x: number, y: number): void;
  runToNonBlocking(x: number, y: number): void;
  centerCamera(): void;
  setWalkIsRun(value: number): void;
  toNonFightingState(): void;
  change(index: number): Promise<void>;

  // Stats
  getMoney(): number;
  setMoney(amount: number): void;
  addMoney(amount: number): void;
  getExp(): number;
  addExp(amount: number): void;
  getStat(name: string): number;
  fullLife(): void;
  fullMana(): void;
  fullThew(): void;
  addLife(amount: number): void;
  addMana(amount: number): void;
  addThew(amount: number): void;
  addLifeMax(value: number): void;
  addManaMax(value: number): void;
  addThewMax(value: number): void;
  addAttack(value: number, type?: number): void;
  addDefend(value: number, type?: number): void;
  addEvade(value: number): void;
  limitMana(limit: boolean): void;
  addMoveSpeedPercent(percent: number): void;
  isEquipWeapon(): boolean;

  // Abilities
  setFightEnabled(enabled: boolean): void;
  setJumpEnabled(enabled: boolean): void;
  setRunEnabled(enabled: boolean): void;

  // Magic when attacked
  setMagicWhenAttacked(magicFile: string, direction: number): void;
}

// ===== NPC =====

export interface NpcAPI {
  add(npcFile: string, x: number, y: number, direction?: number): Promise<void>;
  delete(name: string): void;
  getPosition(name: string): Vector2 | null;
  setPosition(name: string, x: number, y: number): void;
  walkTo(name: string, x: number, y: number): Promise<void>;
  walkToDir(name: string, direction: number, steps: number): Promise<void>;
  setActionFile(name: string, stateType: number, asfFile: string): Promise<void>;
  specialAction(name: string, asfFile: string): Promise<void>;
  /** Fire-and-forget version (used by NpcSpecialAction non-blocking command) */
  specialActionNonBlocking(name: string, asfFile: string): void;
  /** Fire-and-forget walk (used by NpcGotoEx non-blocking command) */
  walkToNonBlocking(name: string, x: number, y: number): void;
  setLevel(name: string, level: number): void;
  setDirection(name: string, direction: number): void;
  setState(name: string, state: number): void;
  setRelation(name: string, relation: number): void;
  setDeathScript(name: string, scriptFile: string): void;
  setScript(name: string, scriptFile: string): void;
  show(name: string, visible: boolean): void;
  merge(npcFile: string): Promise<void>;
  save(fileName?: string): Promise<void>;
  watch(char1: string, char2: string, watchType: number): void;
  setAIEnabled(enabled: boolean): void;
  setKind(name: string, kind: number): void;
  setMagicFile(name: string, magicFile: string): void;
  setResource(name: string, resFile: string): void | Promise<void>;
  setAction(name: string, action: number, x?: number, y?: number): void;
  setActionType(name: string, actionType: number): void;
  setAllScript(name: string, scriptFile: string): void;
  setAllDeathScript(name: string, scriptFile: string): void;
  attack(name: string, x: number, y: number): void;
  follow(follower: string, target: string): void;
  setMagicWhenAttacked(name: string, magicFile: string, direction: number): void;
  addProperty(name: string, property: string, value: number): void;
  changeFlyIni(name: string, magicFile: string): void;
  changeFlyIni2(name: string, magicFile: string): void;
  addFlyInis(name: string, magicFile: string, distance: number): void;
  setDestination(name: string, x: number, y: number): void;
  getCount(kind1: number, kind2: number): number;
  setKeepAttack(name: string, x: number, y: number): void;
}

// ===== Good =====

export interface GoodsAPI {
  add(goodsName: string, count: number): void;
  remove(goodsName: string, count: number): void;
  equip(equipType: number, goodsId: number): void;
  getCountByFile(goodsFile: string): number;
  getCountByName(goodsName: string): number;
  clear(): void;
  deleteByName(name: string, count?: number): void;
  hasFreeSpace(): boolean;
  addRandom(buyFileName: string): Promise<void>;
  buy(buyFile: string, canSellSelfGoods: boolean): Promise<void>;
  setDropIni(name: string, dropFile: string): void;
  setDropEnabled(enabled: boolean): void;
}

// ===== Magic =====

export interface MagicAPI {
  add(magicFile: string): Promise<void>;
  delete(magicFile: string): void;
  setLevel(magicFile: string, level: number): void;
  getLevel(magicFile: string): number;
  clear(): void;
  hasFreeSpace(): boolean;
  use(magicFile: string, x?: number, y?: number): void;
}

// ===== Memo =====

export interface MemoAPI {
  add(text: string): void;
  delete(text: string): void;
  addById(id: number): Promise<void>;
  deleteById(id: number): Promise<void>;
}

// ===== Map =====

export interface MapAPI {
  load(mapName: string): Promise<void>;
  loadNpc(fileName: string): Promise<void>;
  free(): void;
  getCurrentPath(): string;
  setTime(time: number): void;
  setTrap(trapIndex: number, trapFileName: string, mapName?: string): void;
  saveTrap(): void;
}

// ===== Obj =====

export interface ObjAPI {
  load(fileName: string): Promise<void>;
  add(fileName: string, x: number, y: number, direction: number): Promise<void>;
  deleteCurrent(): void;
  delete(nameOrId: string): void;
  openBox(nameOrId?: string): void;
  closeBox(nameOrId?: string): void;
  setScript(nameOrId: string, scriptFile: string): void;
  save(fileName?: string): Promise<void>;
  clearBody(): void;
  getPosition(nameOrId: string): Vector2 | null;
  setOffset(objName: string, x: number, y: number): void;
}

// ===== Camera =====

export interface CameraAPI {
  move(direction: number, distance: number, speed: number): Promise<void>;
  moveTo(x: number, y: number, speed: number): Promise<void>;
  setPosition(x: number, y: number): void;
  openWaterEffect(): void;
  closeWaterEffect(): void;
}

// ===== Audio =====

export interface AudioAPI {
  playMusic(file: string): void;
  stopMusic(): void;
  playSound(file: string, emitterPosition?: Vector2): void;
  stopSound(): void;
  playMovie(file: string): Promise<void>;
}

// ===== Effects =====

export interface EffectsAPI {
  fadeIn(): Promise<void>;
  fadeOut(): Promise<void>;
  changeMapColor(r: number, g: number, b: number): void;
  changeSpriteColor(r: number, g: number, b: number): void;
  beginRain(fileName: string): void;
  endRain(): void;
  showSnow(show: boolean): void;
  petrify(ms: number): void;
  poison(ms: number): void;
  frozen(ms: number): void;
  setLevelFile(file: string): Promise<void>;
}

// ===== Dialog =====

export interface DialogAPI {
  show(text: string, portraitIndex: number): Promise<void>;
  showTalk(startId: number, endId: number): Promise<void>;
  showMessage(text: string): void;
  showSelection(message: string, selectA: string, selectB: string): Promise<number>;
  showSelectionList(options: SelectionOptionData[], message?: string): Promise<number>;
  chooseEx(
    message: string,
    options: Array<{ text: string; condition?: string }>,
    resultVar: string
  ): Promise<number>;
  chooseMultiple(
    columns: number,
    rows: number,
    varPrefix: string,
    message: string,
    options: Array<{ text: string; condition?: string }>
  ): Promise<number[]>;
  showSystemMessage(msg: string, stayTime?: number): void;
  /** Access to TalkTextList for Say/Talk commands */
  talkTextList: TalkTextListManager;
}

// ===== Timer =====

export interface TimerAPI {
  open(seconds: number): void;
  close(): void;
  hide(): void;
  setScript(triggerSeconds: number, scriptFileName: string): void;
}

// ===== Variables =====

export interface VariableAPI {
  get(name: string): number;
  set(name: string, value: number): void;
  clearAll(keepsVars?: string[]): void;
  getPartnerIndex(): number;
}

// ===== Input =====

export interface InputAPI {
  setEnabled(enabled: boolean): void;
}

// ===== Save =====

export interface SaveAPI {
  setEnabled(enabled: boolean): void;
  clearAll(): void;
}

// ===== Script Runner =====

export interface ScriptRunnerAPI {
  run(scriptFile: string): Promise<void>;
  runParallel(scriptFile: string, delay?: number): void;
  returnToTitle(): void;
  randRun(probability: number, script1: string, script2: string): void;
  setShowMapPos(show: boolean): void;
  sleep(ms: number): Promise<void>;
  loadGame(index: number): Promise<void>;
}
