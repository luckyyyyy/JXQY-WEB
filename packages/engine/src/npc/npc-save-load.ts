/**
 * NPC 存档与加载 — Save/Load/Merge/Groups/Partner 管理
 *
 * 从 NpcManager 提取，NpcManager 通过薄委托方法调用这些函数。
 */

import { applyFlatDataToCharacter } from "../character/character-config";
import { getDefaultNpcLevelKey, loadLevelConfig } from "../character/level/level-config-loader";
import { getNpcLevelDetail } from "../character/level/level-manager";
import { logger } from "../core/logger";
import type { CharacterConfig, Direction, Vector2 } from "../core/types";
import { getGameSlug, loadSceneNpcEntries } from "../data/game-data-api";
import { loadGoodsContainer, loadMagicContainer } from "../storage/loader-data-helpers";
import type { GoodsContainerSave, MagicContainerSave, NpcSaveItem } from "../storage/save-types";
import type { Npc } from "./npc";
import { collectNpcSnapshot, parseNpcData } from "./npc-persistence";

/** 存档/加载操作所需的 NpcManager 回调 */
export interface NpcSaveLoadDeps {
  readonly npcs: Map<string, Npc>;
  readonly npcGroups: Map<string, NpcSaveItem[]>;
  getFileName(): string;
  setFileName(name: string): void;
  clearAllNpcAndKeepPartner(): void;
  removeAllPartner(): void;
  addNpcWithConfig(
    config: CharacterConfig,
    mapX: number,
    mapY: number,
    dir?: Direction
  ): Promise<Npc>;
  getCurrentMapName(): string;
}

// ============= 快照 / Groups =============

export function collectSnapshot(npcs: Map<string, Npc>, partnersOnly: boolean): NpcSaveItem[] {
  return collectNpcSnapshot(npcs, partnersOnly);
}

export function saveNpc(deps: NpcSaveLoadDeps, fileName?: string): void {
  const saveFileName = fileName || deps.getFileName();
  if (!saveFileName) {
    logger.warn("[NpcManager] SaveNpc: No file name provided and no file loaded");
    return;
  }
  deps.setFileName(saveFileName);
  const items = collectSnapshot(deps.npcs, false);
  deps.npcGroups.set(saveFileName.toLowerCase(), items);
  const npcNames = items
    .map((i) => (i as unknown as Record<string, unknown>).name ?? "?")
    .join(", ");
  logger.log(
    `[NpcManager] SaveNpc: ${saveFileName} (${items.length} NPCs saved to groups) [${npcNames}]`
  );
}

export function savePartner(deps: NpcSaveLoadDeps, fileName: string): void {
  if (!fileName) {
    logger.warn("[NpcManager] SavePartner: No file name provided");
    return;
  }
  const items = collectSnapshot(deps.npcs, true);
  deps.npcGroups.set(fileName.toLowerCase(), items);
  logger.log(`[NpcManager] SavePartner: ${fileName} (${items.length} partners saved to groups)`);
}

export function setNpcGroups(
  npcGroups: Map<string, NpcSaveItem[]>,
  store: Record<string, NpcSaveItem[]>
): void {
  npcGroups.clear();
  for (const [key, value] of Object.entries(store)) {
    npcGroups.set(key.toLowerCase(), value);
  }
}

// ============= 加载 =============

export async function loadPartner(deps: NpcSaveLoadDeps, filePath: string): Promise<void> {
  try {
    deps.removeAllPartner();
    await loadNpcFileInternal(deps, filePath, false);
    logger.log(`[NpcManager] LoadPartner: ${filePath}`);
  } catch (error) {
    logger.error(`[NpcManager] Error loading partner file: ${filePath}`, error);
  }
}

export async function mergeNpc(deps: NpcSaveLoadDeps, fileName: string): Promise<void> {
  logger.log(`[NpcManager] Merging NPC file: ${fileName}`);
  await loadNpcFileInternal(deps, fileName, false);
}

export async function loadNpcFile(
  deps: NpcSaveLoadDeps,
  fileName: string,
  clearCurrentNpcs: boolean = true
): Promise<boolean> {
  return loadNpcFileInternal(deps, fileName, clearCurrentNpcs);
}

/**
 * Internal: load NPC file with clear option
 * NpcManager.Load(fileName, clearCurrentNpcs, randOne)
 */
async function loadNpcFileInternal(
  deps: NpcSaveLoadDeps,
  fileName: string,
  clearCurrentNpcs: boolean
): Promise<boolean> {
  logger.log(`[NpcManager] Loading NPC file: ${fileName} (clear=${clearCurrentNpcs})`);

  if (!fileName) {
    if (clearCurrentNpcs) {
      deps.clearAllNpcAndKeepPartner();
    }
    deps.setFileName(fileName);
    return true;
  }

  const normalizedKey = fileName.toLowerCase();
  const storedData = deps.npcGroups.get(normalizedKey);
  logger.log(
    `[NpcManager] LoadNpc lookup: key="${normalizedKey}" found=${!!storedData} count=${storedData?.length ?? 0} groupKeys=[${[...deps.npcGroups.keys()].join(", ")}]`
  );
  if (storedData) {
    if (clearCurrentNpcs) {
      deps.clearAllNpcAndKeepPartner();
    }

    const storedNames = storedData
      .map((i) => {
        const d = i as unknown as Record<string, unknown>;
        const death = d.isDeath ? "(dead)" : "";
        return `${d.name ?? "?"}${death}`;
      })
      .join(", ");
    logger.log(
      `[NpcManager] Loading ${storedData.length} NPCs from groups: ${fileName} [${storedNames}]`
    );
    const loadPromises: Promise<void>[] = [];
    for (const npcData of storedData) {
      if (npcData.isDeath && npcData.isDeathInvoked) continue;
      loadPromises.push(
        createNpcFromData(deps, npcData as unknown as Record<string, unknown>).then(() => {})
      );
    }
    await Promise.all(loadPromises);
    deps.setFileName(fileName);
    logger.log(`[NpcManager] Loaded ${deps.npcs.size} NPCs from groups: ${fileName}`);
    return true;
  }

  // 2. 从 Scene API 加载（数据库存储的 NPC JSON 数据）
  const gameSlug = getGameSlug();
  const sceneKey = deps.getCurrentMapName();
  if (gameSlug && sceneKey) {
    try {
      const entries = await loadSceneNpcEntries(sceneKey, fileName);
      if (entries) {
        if (clearCurrentNpcs) {
          deps.clearAllNpcAndKeepPartner();
        }
        if (entries.length > 0) {
          logger.log(`[NpcManager] Loading ${entries.length} NPCs from Scene API: ${fileName}`);
          const loadPromises: Promise<void>[] = [];
          for (const entry of entries) {
            loadPromises.push(createNpcFromData(deps, entry).then(() => {}));
          }
          await Promise.all(loadPromises);
        }
        deps.setFileName(fileName);
        logger.log(`[NpcManager] Loaded ${deps.npcs.size} NPCs from Scene API: ${fileName}`);
        return true;
      }
    } catch (error) {
      logger.error(`[NpcManager] Scene API error for ${fileName}:`, error);
    }
  } else {
    logger.warn(`[NpcManager] Cannot load from API: gameSlug=${gameSlug}, sceneKey=${sceneKey}`);
  }

  logger.error(`[NpcManager] Failed to load NPC file: ${fileName}`);
  return false;
}

/**
 * 从存档/API 数据创建 NPC
 */
export async function createNpcFromData(
  deps: NpcSaveLoadDeps,
  data: Record<string, unknown>
): Promise<Npc | null> {
  const { config, extraState, mapX, mapY, dir } = parseNpcData(data);

  // Skip dead NPCs that have been fully removed
  if (extraState.isDeath && extraState.isDeathInvoked) {
    logger.log(`[NpcManager] Skipping dead NPC: ${config.name}`);
    return null;
  }

  // Create NPC with config (loads ini + sprites)
  logger.log(
    `[NpcManager] createNpcFromData: ${config.name} npcIni=${config.npcIni || "none"} pos=(${mapX},${mapY}) dir=${dir}`
  );
  const npc = await deps.addNpcWithConfig(config, mapX, mapY, dir as Direction);

  // 字段名已统一，直接赋值
  // 伙伴 NPC 的等级表由全局 difficulty 控制（与主角共享 LevelManager），
  // 不读取存档里残留的 levelIniFile，避免 setter 触发 setLevelFile() 污染主角等级表。
  const applyData = npc.isPartner
    ? (() => {
        const { levelIniFile: _ignoredPartnerLevelIni, ...rest } = data;
        return rest;
      })()
    : data;
  applyFlatDataToCharacter(applyData, npc, false);
  npc.applyConfigSetters();

  // === NPC 特有字段（不在 FIELD_DEFS 中） ===
  npc.isHide = extraState.isHide;
  npc.isAIDisabled = extraState.isAIDisabled;
  if (extraState.actionPathTilePositions && extraState.actionPathTilePositions.length > 0) {
    npc.actionPathTilePositions = extraState.actionPathTilePositions.map((p: Vector2) => ({
      x: p.x,
      y: p.y,
    }));
  }

  // 伙伴武功/物品容器
  if (npc.isPartner) {
    npc.initPartnerContainers();
    const magicData = (data as Record<string, unknown>).magicContainer as
      | MagicContainerSave
      | undefined;
    const goodsData = (data as Record<string, unknown>).goodsContainer as
      | GoodsContainerSave
      | undefined;
    if (magicData && npc.magicInventory) {
      await loadMagicContainer(magicData, npc.magicInventory);
    }
    if (goodsData && npc.goodsManager) {
      loadGoodsContainer(goodsData, npc.goodsManager);
    }
  }

  // 等级配置（异步加载配置文件）
  // 伙伴共享主角的 LevelManager（在 initPartnerContainers 中已设置），
  // 不允许覆盖，否则会污染主角的等级配置。
  if (npc.levelIniFile && !npc.isPartner) {
    await npc.levelManager.setLevelFile(npc.levelIniFile);
  }

  // 从等级配置重算属性
  // - 敌对 NPC：仅在 lifeMax === 0 时恢复血量（兼容旧逻辑）
  // - 伙伴 NPC：调用 recalculateBaseStats，与 Player.recalculateBaseStats() 对齐
  //   （基础值 = 等级难度表 + 武功加成 + 装备加成，避免存档中累积/重复的装备 delta）
  logger.debug(
    `[NpcManager] NPC ${npc.name} check: isEnemy=${npc.isEnemy} isPartner=${npc.isPartner} lifeMax=${npc.lifeMax} level=${npc.level}`
  );
  if (npc.isPartner) {
    npc.recalculateBaseStats();
  } else if (npc.isEnemy && npc.lifeMax === 0) {
    let levelDetail = npc.levelManager.getLevelDetail(npc.level) ?? getNpcLevelDetail(npc.level);
    if (!levelDetail) {
      const cfg = await loadLevelConfig(getDefaultNpcLevelKey());
      levelDetail = cfg?.get(npc.level) ?? null;
    }
    const restoredLife = levelDetail?.life ?? levelDetail?.lifeMax ?? 0;
    if (restoredLife > 0) {
      npc.setLifeMax(restoredLife);
      npc.life = npc.lifeMax;
      logger.log(
        `[NpcManager] NPC ${npc.name} lifeMax=0, restored from level ${npc.level}: lifeMax=${npc.lifeMax}`
      );
    } else {
      logger.warn(
        `[NpcManager] NPC ${npc.name} lifeMax=0 at level ${npc.level}, no level data found`
      );
    }
  }

  return npc;
}
