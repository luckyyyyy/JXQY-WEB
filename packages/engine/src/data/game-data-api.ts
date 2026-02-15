/**
 * Game Data API - 游戏数据加载与缓存
 *
 * 从服务端 API 加载游戏配置和数据（NPC/物品/武功/等级/玩家/场景等），
 * 并缓存供引擎各模块使用。
 *
 * 与 ResourceLoader（底层 fetch/缓存）分离，专注于「游戏业务数据」的获取和管理。
 */

import type {
  DropConfig,
  Good,
  LevelConfig,
  LevelDetail,
  Magic,
  MagicExpConfig,
  Npc,
  NpcResource,
  Obj,
  ObjRes,
  Player,
  PlayerConfig,
  Shop,
} from "@miu2d/types";
import { logger } from "../core/logger";

// ==================== 数据类型 ====================

/**
 * NPC 数据（继承 Npc 类型 + 服务端注入的 npcIni）
 */
export type NpcData = Npc & {
  /** 资源文件名（npcRes key），由 data endpoint 注入 */
  npcIni?: string | null;
};

/**
 * Obj 数据（继承 Obj 类型 + 服务端注入的 objFile）
 */
export type ObjData = Obj & {
  /** 资源文件名（objRes key），由 data endpoint 注入 */
  objFile?: string | null;
};

export interface MagicResponse {
  player: Magic[];
  npc: Magic[];
}

/** NPC 资源文件数据（npcres） */
export interface NpcResData {
  id: string;
  gameId: string;
  key: string;
  name: string;
  resources: NpcResource;
  createdAt?: string;
  updatedAt?: string;
}

export interface NpcResponse {
  npcs: NpcData[];
  resources: NpcResData[];
}

/** Obj 资源文件数据（objres）— 直接复用 @miu2d/types */
export type ObjResData = ObjRes;

export interface ObjResponse {
  objs: ObjData[];
  resources: ObjResData[];
}

/**
 * API 返回的游戏全局配置
 */
export interface GameConfigResponse {
  gameEnabled: boolean;
  gameName: string;
  gameVersion: string;
  gameDescription: string;
  logoUrl: string;
  playerKey: string;
  initialMap: string;
  initialNpc: string;
  initialObj: string;
  initialBgm: string;
  titleMusic: string;
  newGameScript: string;
  portraitAsf: string;
  player: PlayerConfig;
  drop: DropConfig;
  magicExp?: MagicExpConfig;
}

export interface GameDataResponse {
  magics: MagicResponse;
  goods: Good[];
  shops: Shop[];
  npcs: NpcResponse;
  objs: ObjResponse;
  players: Player[];
  portraits: Array<{ index: number; asfFile: string }>;
  talks: Array<{ id: number; portraitIndex: number; text: string }>;
}

/** 等级配置 */
export interface LevelConfigData {
  id: LevelConfig["id"];
  gameId: LevelConfig["gameId"];
  key: LevelConfig["key"];
  name: LevelConfig["name"];
  userType: LevelConfig["userType"];
  maxLevel?: LevelConfig["maxLevel"];
  levels: LevelDetail[];
  createdAt?: string;
  updatedAt?: string;
}

/** API 返回的等级配置列表 */
export interface LevelResponse {
  player: LevelConfigData[];
  npc: LevelConfigData[];
}

// ========== 公共 fetch 入口 ==========

/**
 * 统一的游戏 API JSON 请求入口
 *
 * @param gameSlug - 游戏 slug
 * @param path    - 相对于 `/game/:slug/api/` 的路径，例如 `config`、`scenes/npc/xxx/yyy`
 */
export async function fetchGameApi<T>(gameSlug: string, path: string): Promise<T> {
  const apiUrl = `/game/${gameSlug}/api/${path}${path.includes("?") ? "&" : "?"}_t=${Date.now()}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`[GameDataApi] ${apiUrl} → HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

/**
 * 统一的游戏 API 二进制请求入口（返回 ArrayBuffer）
 */
export async function fetchGameApiBinary(gameSlug: string, path: string): Promise<ArrayBuffer> {
  const apiUrl = `/game/${gameSlug}/api/${path}${path.includes("?") ? "&" : "?"}_t=${Date.now()}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`[GameDataApi] ${apiUrl} → HTTP ${response.status}: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

// ========== 共享状态 ==========

let currentGameSlug = "";

// ========== 游戏配置缓存 ==========

let cachedGameConfig: GameConfigResponse | null = null;
let isGameConfigLoadedFlag = false;
let configLoadingPromise: Promise<void> | null = null;

/**
 * 从 API 加载游戏全局配置
 */
export async function loadGameConfig(gameSlug: string, force = false): Promise<void> {
  if (!force && isGameConfigLoadedFlag && currentGameSlug === gameSlug) {
    return;
  }

  if (configLoadingPromise && currentGameSlug === gameSlug) {
    await configLoadingPromise;
    return;
  }

  configLoadingPromise = (async () => {
    logger.info(`[GameDataApi] Loading game config for ${gameSlug}`);

    try {
      cachedGameConfig = await fetchGameApi<GameConfigResponse>(gameSlug, "config");

      // 游戏未开放（不存在/未公开/未启用均返回 gameEnabled: false）
      if (!cachedGameConfig?.gameEnabled) {
        cachedGameConfig = null;
        throw new Error("GAME_NOT_AVAILABLE");
      }

      isGameConfigLoadedFlag = true;
      currentGameSlug = gameSlug;

      logger.info(
        `[GameDataApi] Loaded config: playerKey=${cachedGameConfig?.playerKey}, gameName=${cachedGameConfig?.gameName}`
      );
    } catch (error) {
      logger.error(`[GameDataApi] Failed to load game config:`, error);
      throw error;
    } finally {
      configLoadingPromise = null;
    }
  })();

  await configLoadingPromise;
}

export function isGameConfigLoaded(): boolean {
  return isGameConfigLoadedFlag;
}

export function getGameConfig(): GameConfigResponse | null {
  return cachedGameConfig;
}

// ========== 游戏数据缓存 ==========

let cachedGameData: GameDataResponse | null = null;
let isGameDataLoadedFlag = false;
let loadingPromise: Promise<void> | null = null;
const cacheBuilders: Array<() => void | Promise<void>> = [];

// ========== 等级配置缓存 ==========

let cachedLevelsData: LevelResponse | null = null;
let isLevelsDataLoadedFlag = false;
let levelsLoadingPromise: Promise<void> | null = null;

async function runCacheBuilders(): Promise<void> {
  for (const builder of cacheBuilders) {
    await builder();
  }
}

/**
 * 注册缓存构建回调（数据加载完成后自动调用）
 */
export function registerCacheBuilder(builder: () => void | Promise<void>): void {
  cacheBuilders.push(builder);
}

/**
 * 从 API 加载所有游戏数据
 */
export async function loadGameData(gameSlug: string, force = false): Promise<void> {
  if (!force && isGameDataLoadedFlag && currentGameSlug === gameSlug) {
    return;
  }

  if (loadingPromise && currentGameSlug === gameSlug) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    logger.info(`[GameDataApi] Loading game data for ${gameSlug}`);

    try {
      cachedGameData = await fetchGameApi<GameDataResponse>(gameSlug, "data");
      isGameDataLoadedFlag = true;
      currentGameSlug = gameSlug;

      try {
        await loadLevelsData(gameSlug, force, false);
      } catch (error) {
        logger.warn(`[GameDataApi] Failed to preload levels data:`, error);
      }

      // 构建所有模块的缓存
      await runCacheBuilders();

      const magicCount =
        (cachedGameData?.magics.player.length ?? 0) + (cachedGameData?.magics.npc.length ?? 0);
      const goodsCount = cachedGameData?.goods.length ?? 0;
      const shopCount = cachedGameData?.shops.length ?? 0;
      const npcCount = cachedGameData?.npcs.npcs.length ?? 0;
      const npcResCount = cachedGameData?.npcs.resources.length ?? 0;
      const objCount = cachedGameData?.objs.objs.length ?? 0;
      const objResCount = cachedGameData?.objs.resources.length ?? 0;
      const portraitCount = cachedGameData?.portraits?.length ?? 0;
      const talkCount = cachedGameData?.talks?.length ?? 0;

      logger.info(
        `[GameDataApi] Loaded: ${magicCount} magics, ${goodsCount} goods, ${shopCount} shops, ${npcCount} npcs, ${npcResCount} npcres, ${objCount} objs, ${objResCount} objres, ${portraitCount} portraits, ${talkCount} talks`
      );
    } catch (error) {
      logger.error(`[GameDataApi] Failed to load game data:`, error);
      throw error;
    } finally {
      loadingPromise = null;
    }
  })();

  await loadingPromise;
}

export async function reloadGameData(gameSlug: string): Promise<void> {
  await loadGameData(gameSlug, true);
}

/**
 * 直接注入游戏数据（跳过 REST fetch），用于 Dashboard 等已有 tRPC 数据的场景
 *
 * 注入后会自动运行 cacheBuilders，使各模块缓存就绪
 */
export async function setGameData(gameSlug: string, data: GameDataResponse): Promise<void> {
  cachedGameData = data;
  isGameDataLoadedFlag = true;
  currentGameSlug = gameSlug;

  await runCacheBuilders();

  const magicCount = (data.magics.player.length ?? 0) + (data.magics.npc.length ?? 0);
  const npcCount = data.npcs.npcs.length ?? 0;
  const objCount = data.objs.objs.length ?? 0;
  logger.info(
    `[GameDataApi] setGameData: ${magicCount} magics, ${npcCount} npcs, ${objCount} objs`
  );
}

export function isGameDataLoaded(): boolean {
  return isGameDataLoadedFlag;
}

/**
 * 获取当前游戏 slug
 */
export function getGameSlug(): string {
  return currentGameSlug;
}

export function getMagicsData(): MagicResponse | null {
  return cachedGameData?.magics ?? null;
}

export function getGoodsData(): Good[] | null {
  return cachedGameData?.goods ?? null;
}

export function getNpcsData(): NpcResponse | null {
  return cachedGameData?.npcs ?? null;
}

export function getObjsData(): ObjResponse | null {
  return cachedGameData?.objs ?? null;
}

export function getShopsData(): Shop[] | null {
  return cachedGameData?.shops ?? null;
}

export function getPlayersData(): Player[] | null {
  return cachedGameData?.players ?? null;
}

export function getPortraitsData(): Array<{ index: number; asfFile: string }> | null {
  return cachedGameData?.portraits ?? null;
}

export function getTalksData(): Array<{ id: number; portraitIndex: number; text: string }> | null {
  return cachedGameData?.talks ?? null;
}

/**
 * 从 API 加载等级配置数据（player + npc）
 */
export async function loadLevelsData(
  gameSlug: string,
  force = false,
  rebuildCaches = true
): Promise<void> {
  if (!force && isLevelsDataLoadedFlag && currentGameSlug === gameSlug) {
    return;
  }

  if (levelsLoadingPromise && currentGameSlug === gameSlug) {
    await levelsLoadingPromise;
    return;
  }

  levelsLoadingPromise = (async () => {
    logger.info(`[GameDataApi] Loading levels data for ${gameSlug}`);

    try {
      cachedLevelsData = await fetchGameApi<LevelResponse>(gameSlug, "level");
      isLevelsDataLoadedFlag = true;
      currentGameSlug = gameSlug;

      const playerCount = cachedLevelsData?.player.length ?? 0;
      const npcCount = cachedLevelsData?.npc.length ?? 0;
      logger.info(`[GameDataApi] Loaded levels: ${playerCount} player, ${npcCount} npc`);

      if (rebuildCaches) {
        await runCacheBuilders();
      }
    } catch (error) {
      logger.error(`[GameDataApi] Failed to load levels data:`, error);
      throw error;
    } finally {
      levelsLoadingPromise = null;
    }
  })();

  await levelsLoadingPromise;
}

export function isLevelsDataLoaded(): boolean {
  return isLevelsDataLoadedFlag;
}

export function getLevelsData(): LevelResponse | null {
  return cachedLevelsData;
}

/**
 * 从 Scene API 加载 NPC 条目
 */
export async function loadSceneNpcEntries(
  sceneKey: string,
  fileName: string
): Promise<Record<string, unknown>[] | null> {
  if (!currentGameSlug) {
    logger.warn(`[GameDataApi] loadSceneNpcEntries failed: game slug is empty`);
    return null;
  }

  try {
    return await fetchGameApi<Record<string, unknown>[]>(
      currentGameSlug,
      `scenes/npc/${encodeURIComponent(sceneKey)}/${encodeURIComponent(fileName)}`
    );
  } catch {
    return null;
  }
}

/**
 * 从 Scene API 加载 MMF 地图二进制数据
 */
export async function loadSceneMapMmf(sceneKey: string): Promise<ArrayBuffer | null> {
  if (!currentGameSlug) {
    logger.warn(`[GameDataApi] loadSceneMapMmf failed: game slug is empty`);
    return null;
  }

  try {
    const buffer = await fetchGameApiBinary(
      currentGameSlug,
      `scenes/${encodeURIComponent(sceneKey)}/mmf`
    );
    return buffer.byteLength > 0 ? buffer : null;
  } catch {
    return null;
  }
}

/**
 * 从 Scene API 加载 OBJ 条目列表
 */
export async function loadSceneObjEntries(
  sceneKey: string,
  fileName: string
): Promise<Record<string, unknown>[] | null> {
  if (!currentGameSlug) {
    logger.warn(`[GameDataApi] loadSceneObjEntries failed: game slug is empty`);
    return null;
  }

  try {
    return await fetchGameApi<Record<string, unknown>[]>(
      currentGameSlug,
      `scenes/obj/${encodeURIComponent(sceneKey)}/${encodeURIComponent(fileName)}`
    );
  } catch {
    return null;
  }
}
