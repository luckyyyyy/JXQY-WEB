/**
 * NPC 服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  BatchImportNpcInput,
  BatchImportNpcResult,
  CreateNpcInput,
  ImportNpcInput,
  ListNpcInput,
  Npc,
  NpcKind,
  NpcListItem,
  NpcRelation,
  NpcResource,
  UpdateNpcInput,
} from "@miu2d/types";
import {
  createDefaultNpc,
  createDefaultNpcResource,
  NpcKindFromValue,
  NpcRelationFromValue,
} from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, npcResources, npcs } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";
import { npcResourceService } from "./npcResource.service";

export class NpcService {
  /**
   * 将数据库记录转换为 Npc 类型
   */
  private toNpc(row: typeof npcs.$inferSelect): Npc {
    const data = row.data as Omit<
      Npc,
      | "id"
      | "gameId"
      | "key"
      | "name"
      | "kind"
      | "relation"
      | "resourceId"
      | "createdAt"
      | "updatedAt"
    >;
    return {
      ...data,
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      kind: row.kind as Npc["kind"],
      relation: row.relation as Npc["relation"],
      resourceId: row.resourceId ?? null,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有 NPC（无需认证）
   * 用于游戏客户端加载 NPC 数据
   */
  async listPublicBySlug(gameSlug: string): Promise<Npc[]> {
    // 通过 slug 查找游戏
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      throw new Error("Game not found");
    }

    const rows = await db
      .select()
      .from(npcs)
      .where(eq(npcs.gameId, game.id))
      .orderBy(desc(npcs.updatedAt));

    return rows.map((row) => this.toNpc(row));
  }

  /**
   * 获取单个 NPC
   */
  async get(
    gameId: string,
    npcId: string,
    userId: string,
    language: Language
  ): Promise<Npc | null> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db
      .select()
      .from(npcs)
      .where(and(eq(npcs.id, npcId), eq(npcs.gameId, gameId)))
      .limit(1);

    if (!row) return null;
    return this.toNpc(row);
  }

  /**
   * 列出 NPC
   */
  async list(input: ListNpcInput, userId: string, language: Language): Promise<NpcListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const conditions = [eq(npcs.gameId, input.gameId)];
    if (input.kind) {
      conditions.push(eq(npcs.kind, input.kind));
    }
    if (input.relation) {
      conditions.push(eq(npcs.relation, input.relation));
    }

    const rows = await db
      .select()
      .from(npcs)
      .where(and(...conditions))
      .orderBy(desc(npcs.updatedAt));

    // 获取关联的资源信息用于显示图标
    const resourceIds = rows.map((r) => r.resourceId).filter((id): id is string => !!id);
    const resourceMap = new Map<string, { icon: string | null; key: string }>();

    if (resourceIds.length > 0) {
      const resources = await db
        .select()
        .from(npcResources)
        .where(eq(npcResources.gameId, input.gameId));

      for (const res of resources) {
        if (resourceIds.includes(res.id)) {
          const data = res.data as { resources?: NpcResource };
          resourceMap.set(res.id, {
            icon: data.resources?.stand?.image ?? null,
            key: res.key,
          });
        }
      }
    }

    return rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      const resources = data.resources as NpcResource | undefined;
      // 优先使用关联资源的图标，其次使用内嵌资源的图标
      const resInfo = row.resourceId ? resourceMap.get(row.resourceId) : null;
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        kind: row.kind as NpcKind,
        relation: row.relation as NpcRelation,
        level: (data.level as number) ?? 1,
        npcIni: resInfo?.key ?? row.key,
        icon: resInfo?.icon ?? resources?.stand?.image ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建 NPC
   */
  async create(input: CreateNpcInput, userId: string, language: Language): Promise<Npc> {
    await verifyGameAccess(input.gameId, userId, language);

    const defaultNpc = createDefaultNpc(input.gameId, input.key);
    const fullNpc = {
      ...defaultNpc,
      ...input,
    };

    // 分离索引字段和 data 字段
    const { gameId, key, name, kind, relation, resourceId, ...data } = fullNpc;

    const [row] = await db
      .insert(npcs)
      .values({
        gameId,
        key,
        name: name ?? "未命名NPC",
        kind: kind ?? "Normal",
        relation: relation ?? "Friend",
        resourceId: resourceId ?? null,
        data,
      })
      .returning();

    return this.toNpc(row);
  }

  /**
   * 更新 NPC
   */
  async update(input: UpdateNpcInput, userId: string, language: Language): Promise<Npc> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在
    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.npc.notFound"),
      });
    }

    // 合并更新
    const { id, gameId, ...inputData } = input;
    const merged = { ...existing, ...inputData };

    // 分离索引字段和 data 字段
    const {
      id: _id,
      gameId: _gameId,
      key,
      name,
      kind,
      relation,
      resourceId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = merged;

    const [row] = await db
      .update(npcs)
      .set({
        key,
        name,
        kind,
        relation,
        resourceId: resourceId ?? null,
        data,
        updatedAt: new Date(),
      })
      .where(and(eq(npcs.id, id), eq(npcs.gameId, gameId)))
      .returning();

    return this.toNpc(row);
  }

  /**
   * 删除 NPC
   */
  async delete(
    gameId: string,
    npcId: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db.delete(npcs).where(and(eq(npcs.id, npcId), eq(npcs.gameId, gameId)));

    return { id: npcId };
  }

  /**
   * 从 INI 导入 NPC
   */
  async importFromIni(input: ImportNpcInput, userId: string, language: Language): Promise<Npc> {
    await verifyGameAccess(input.gameId, userId, language);

    if (!input.iniContent) {
      throw new Error("NPC 配置内容为空");
    }

    const parsed = this.parseNpcIni(input.iniContent);
    let resourceId: string | null = null;

    // 如果有资源配置 INI，创建资源数据并关联
    if (input.npcResContent) {
      const resources = this.parseNpcResIni(input.npcResContent);
      // 从 NPC INI 中解析 NpcIni 字段作为资源的 key
      const npcIniField = this.parseNpcIniField(input.iniContent);
      const resourceKey = npcIniField || input.fileName;
      const resourceName = resourceKey.replace(/\.ini$/i, "");

      const npcRes = await npcResourceService.upsert(
        input.gameId,
        resourceKey,
        resourceName,
        resources,
        userId,
        language
      );
      resourceId = npcRes.id;
    }

    // 使用文件名作为 key
    const key = input.fileName;

    return this.create(
      {
        gameId: input.gameId,
        key,
        name: parsed.name ?? key.replace(/\.ini$/i, ""),
        kind: parsed.kind,
        relation: parsed.relation,
        resourceId,
        ...parsed,
      },
      userId,
      language
    );
  }

  /**
   * 批量导入 NPC 和资源
   * 支持两种类型：
   * - type="npc": 导入 NPC 配置（npc/*.ini），可选关联 npcres
   * - type="resource": 导入独立资源配置（npcres/*.ini）
   */
  async batchImportFromIni(
    input: BatchImportNpcInput,
    userId: string,
    language: Language
  ): Promise<BatchImportNpcResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const success: BatchImportNpcResult["success"] = [];
    const failed: BatchImportNpcResult["failed"] = [];

    for (const item of input.items) {
      try {
        const itemType = item.type ?? "npc";

        if (itemType === "resource") {
          // 导入独立资源配置
          if (!item.npcResContent) {
            throw new Error("资源配置内容为空");
          }

          const resources = this.parseNpcResIni(item.npcResContent);
          // key 保留 .ini 后缀，与 NPC 的 key 格式一致
          const resourceKey = item.fileName;
          const resourceName = item.fileName.replace(/\.ini$/i, "");

          const npcRes = await npcResourceService.upsert(
            input.gameId,
            resourceKey,
            resourceName,
            resources,
            userId,
            language
          );

          success.push({
            fileName: item.fileName,
            id: npcRes.id,
            name: npcRes.name,
            type: "resource",
            hasResources: true,
          });
        } else {
          // 导入 NPC 配置
          if (!item.iniContent) {
            throw new Error("NPC 配置内容为空");
          }

          const parsed = this.parseNpcIni(item.iniContent);
          const hasResources = !!item.npcResContent;
          let resourceId: string | null = null;

          // 如果有资源配置 INI，创建资源数据并关联
          if (item.npcResContent) {
            const resources = this.parseNpcResIni(item.npcResContent);
            // 从 NPC INI 中解析 NpcIni 字段作为资源的 key
            const npcIniField = this.parseNpcIniField(item.iniContent);
            const resourceKey = npcIniField || item.fileName;
            const resourceName = resourceKey.replace(/\.ini$/i, "");

            const npcRes = await npcResourceService.upsert(
              input.gameId,
              resourceKey,
              resourceName,
              resources,
              userId,
              language
            );
            resourceId = npcRes.id;
          }

          // 使用文件名作为 key
          const key = item.fileName;

          const npc = await this.create(
            {
              gameId: input.gameId,
              key,
              name: parsed.name ?? item.fileName.replace(/\.ini$/i, ""),
              kind: parsed.kind,
              relation: parsed.relation,
              resourceId,
              ...parsed,
            },
            userId,
            language
          );

          success.push({
            fileName: item.fileName,
            id: npc.id,
            name: npc.name,
            type: "npc",
            hasResources,
          });
        }
      } catch (error) {
        failed.push({
          fileName: item.fileName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success, failed };
  }

  /**
   * 从 NPC INI 中解析 NpcIni 字段
   */
  private parseNpcIniField(content: string): string | null {
    const match = content.match(/^\s*NpcIni\s*=\s*(.+?)\s*$/im);
    return match ? match[1].trim() : null;
  }

  /**
   * 解析 NPC INI 内容（npc/*.ini）
   */
  private parseNpcIni(content: string): Partial<Npc> {
    const result: Partial<Npc> = {};
    const lines = content.split(/\r?\n/);
    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].toUpperCase();
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (!kvMatch || currentSection !== "INIT") continue;

      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      switch (key) {
        case "Name":
          result.name = value;
          break;
        case "NpcIni":
          // 存储原始的 npcres 文件名，用于自动关联
          // 但我们不需要这个字段了，因为资源已经内嵌到 resources 中
          break;
        case "FlyIni":
          result.flyIni = value || null;
          break;
        case "BodyIni":
          result.bodyIni = value || null;
          break;
        case "Kind":
          result.kind = NpcKindFromValue[parseInt(value, 10)] ?? "Normal";
          break;
        case "Relation":
          result.relation = NpcRelationFromValue[parseInt(value, 10)] ?? "Friend";
          break;
        case "Life":
          result.life = parseInt(value, 10) || 100;
          break;
        case "LifeMax":
          result.lifeMax = parseInt(value, 10) || 100;
          break;
        case "Thew":
          result.thew = parseInt(value, 10) || 100;
          break;
        case "ThewMax":
          result.thewMax = parseInt(value, 10) || 100;
          break;
        case "Mana":
          result.mana = parseInt(value, 10) || 100;
          break;
        case "ManaMax":
          result.manaMax = parseInt(value, 10) || 100;
          break;
        case "Attack":
          result.attack = parseInt(value, 10) || 10;
          break;
        case "Defence":
        case "Defend":
          result.defend = parseInt(value, 10) || 5;
          break;
        case "Evade":
          result.evade = parseInt(value, 10) || 10;
          break;
        case "Exp":
          result.exp = parseInt(value, 10) || 0;
          break;
        case "ExpBonus":
          result.expBonus = parseInt(value, 10) || 0;
          break;
        case "WalkSpeed":
          result.walkSpeed = parseInt(value, 10) || 1;
          break;
        case "Dir":
          result.dir = parseInt(value, 10) || 0;
          break;
        case "Lum":
          result.lum = parseInt(value, 10) || 0;
          break;
        case "Level":
          result.level = parseInt(value, 10) || 1;
          break;
        case "AttackRadius":
          result.attackRadius = parseInt(value, 10) || 1;
          break;
        case "AttackLevel":
          result.attackLevel = parseInt(value, 10) || 1;
          break;
        case "PathFinder":
          result.pathFinder = parseInt(value, 10) || 1;
          break;
        case "Idle":
          result.idle = parseInt(value, 10) || 0;
          break;
        case "DeathScript":
          result.deathScript = value || null;
          break;
        case "ScriptFile":
          result.scriptFile = value || null;
          break;
        // ─── Basic Info ───
        case "Intro":
          result.intro = value || undefined;
          break;
        // ─── Type ───
        case "Group":
          result.group = value ? parseInt(value, 10) : null;
          break;
        // ─── Stats ───
        case "Attack2":
          result.attack2 = value ? parseInt(value, 10) : null;
          break;
        case "Attack3":
          result.attack3 = value ? parseInt(value, 10) : null;
          break;
        case "Defend2":
          result.defend2 = value ? parseInt(value, 10) : null;
          break;
        case "Defend3":
          result.defend3 = value ? parseInt(value, 10) : null;
          break;
        case "LevelUpExp":
          result.levelUpExp = value ? parseInt(value, 10) : null;
          break;
        case "CanLevelUp":
          result.canLevelUp = value ? parseInt(value, 10) : null;
          break;
        // ─── Behavior ───
        case "AddMoveSpeedPercent":
          result.addMoveSpeedPercent = value ? parseInt(value, 10) : null;
          break;
        case "VisionRadius":
          result.visionRadius = value ? parseInt(value, 10) : null;
          break;
        case "DialogRadius":
          result.dialogRadius = value ? parseInt(value, 10) : null;
          break;
        case "Action":
          result.action = value ? parseInt(value, 10) : null;
          break;
        case "FixedPos":
          result.fixedPos = value || null;
          break;
        // ─── AI Config ───
        case "AIType":
        case "AiType":
          result.aiType = value ? parseInt(value, 10) : null;
          break;
        case "NoAutoAttackPlayer":
          result.noAutoAttackPlayer = value ? parseInt(value, 10) : null;
          break;
        case "Invincible":
          result.invincible = value ? parseInt(value, 10) : null;
          break;
        case "StopFindingTarget":
          result.stopFindingTarget = value ? parseInt(value, 10) : null;
          break;
        case "KeepRadiusWhenLifeLow":
          result.keepRadiusWhenLifeLow = value ? parseInt(value, 10) : null;
          break;
        case "LifeLowPercent":
          result.lifeLowPercent = value ? parseInt(value, 10) : null;
          break;
        case "KeepRadiusWhenFriendDeath":
          result.keepRadiusWhenFriendDeath = value ? parseInt(value, 10) : null;
          break;
        case "KeepAttackX":
          result.keepAttackX = value ? parseInt(value, 10) : null;
          break;
        case "KeepAttackY":
          result.keepAttackY = value ? parseInt(value, 10) : null;
          break;
        // ─── Association / Scripts ───
        case "FlyIni2":
          result.flyIni2 = value || null;
          break;
        case "FlyInis":
          result.flyInis = value || null;
          break;
        case "ScriptFileRight":
          result.scriptFileRight = value || null;
          break;
        case "TimerScriptFile":
          result.timerScriptFile = value || null;
          break;
        case "TimerScriptInterval":
          result.timerScriptInterval = value ? parseInt(value, 10) : null;
          break;
        case "CanInteractDirectly":
          result.canInteractDirectly = value ? parseInt(value, 10) : null;
          break;
        // ─── Drop & Shop ───
        case "DropIni":
          result.dropIni = value || null;
          break;
        case "NoDropWhenDie":
          result.noDropWhenDie = value ? parseInt(value, 10) : null;
          break;
        case "BuyIniFile":
          result.buyIniFile = value || null;
          break;
        case "BuyIniString":
          result.buyIniString = value || null;
          break;
        // ─── Magic on Event ───
        case "MagicToUseWhenLifeLow":
          result.magicToUseWhenLifeLow = value || null;
          break;
        case "MagicToUseWhenBeAttacked":
          result.magicToUseWhenBeAttacked = value || null;
          break;
        case "MagicDirectionWhenBeAttacked":
          result.magicDirectionWhenBeAttacked = value ? parseInt(value, 10) : null;
          break;
        case "MagicToUseWhenDeath":
          result.magicToUseWhenDeath = value || null;
          break;
        case "MagicDirectionWhenDeath":
          result.magicDirectionWhenDeath = value ? parseInt(value, 10) : null;
          break;
        // ─── Visibility Control ───
        case "VisibleVariableName":
          result.visibleVariableName = value || null;
          break;
        case "VisibleVariableValue":
          result.visibleVariableValue = value ? parseInt(value, 10) : null;
          break;
        // ─── Revive / Contact Damage ───
        case "ReviveMilliseconds":
          result.reviveMilliseconds = value ? parseInt(value, 10) : null;
          break;
        case "HurtPlayerInterval":
          result.hurtPlayerInterval = value ? parseInt(value, 10) : null;
          break;
        case "HurtPlayerLife":
          result.hurtPlayerLife = value ? parseInt(value, 10) : null;
          break;
        case "HurtPlayerRadius":
          result.hurtPlayerRadius = value ? parseInt(value, 10) : null;
          break;
        // ─── Level Config ───
        case "LevelIni":
          result.levelIniFile = value || null;
          break;
        // ─── Equipment ───
        case "CanEquip":
          result.canEquip = value ? parseInt(value, 10) : null;
          break;
        case "HeadEquip":
          result.headEquip = value || null;
          break;
        case "NeckEquip":
          result.neckEquip = value || null;
          break;
        case "BodyEquip":
          result.bodyEquip = value || null;
          break;
        case "BackEquip":
          result.backEquip = value || null;
          break;
        case "HandEquip":
          result.handEquip = value || null;
          break;
        case "WristEquip":
          result.wristEquip = value || null;
          break;
        case "FootEquip":
          result.footEquip = value || null;
          break;
        case "BackgroundTextureEquip":
          result.backgroundTextureEquip = value || null;
          break;
        // ─── State ───
        case "PoisonByCharacterName":
          result.poisonByCharacterName = value || null;
          break;
      }
    }

    return result;
  }

  /**
   * 解析 NPC 资源 INI 内容（npcres/*.ini）
   */
  private parseNpcResIni(content: string): NpcResource {
    const result = createDefaultNpcResource();
    const lines = content.split(/\r?\n/);
    let currentSection = "";

    // INI section 名称（小写）→ NpcResource key 映射
    // INI 使用 CharacterState 名称（如 [FightStand], [Magic]）
    // NpcResource 使用 camelCase key（如 fightStand, special1）
    const sectionToKey: Record<string, keyof NpcResource> = {
      stand: "stand",
      stand1: "stand1",
      walk: "walk",
      run: "run",
      jump: "jump",
      fightstand: "fightStand",
      fightwalk: "fightWalk",
      fightrun: "fightRun",
      fightjump: "fightJump",
      attack: "attack",
      attack1: "attack1",
      attack2: "attack2",
      magic: "special1", // INI [Magic] → API special1
      hurt: "hurt",
      death: "death",
      sit: "sit",
      special: "special2", // INI [Special] → API special2
      special1: "special1",
      special2: "special2",
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].toLowerCase();
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (!kvMatch) continue;

      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      // 根据 section 名称映射到资源字段
      const stateKey = sectionToKey[currentSection];
      if (stateKey && stateKey in result) {
        if (key === "Image") {
          // 原封不动存储，路径规范化由前端/引擎处理
          result[stateKey] = {
            ...result[stateKey],
            image: value || null,
          };
        } else if (key === "Sound") {
          // 原封不动存储，路径规范化由前端/引擎处理
          result[stateKey] = {
            ...result[stateKey],
            sound: value || null,
          };
        }
      }
    }

    return result;
  }
}

export const npcService = new NpcService();
