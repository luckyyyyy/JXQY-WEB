/**
 * 物品服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  BatchImportGoodInput,
  BatchImportGoodResult,
  CreateGoodInput,
  Good,
  GoodKind,
  GoodListItem,
  ImportGoodInput,
  ListGoodInput,
  UpdateGoodInput,
} from "@miu2d/types";
import { createDefaultGood, GoodKindFromValue } from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, goods } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";

export class GoodsService {
  /**
   * 将数据库记录转换为 Good 类型
   */
  private toGoods(row: typeof goods.$inferSelect): Good {
    const data = row.data as Omit<
      Good,
      "id" | "gameId" | "key" | "kind" | "createdAt" | "updatedAt"
    >;
    return {
      ...data,
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      kind: row.kind as GoodKind,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有物品（无需认证）
   * 用于游戏客户端加载物品数据
   */
  async listPublicBySlug(gameSlug: string): Promise<Good[]> {
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
      .from(goods)
      .where(eq(goods.gameId, game.id))
      .orderBy(desc(goods.updatedAt));

    return rows.map((row) => this.toGoods(row));
  }

  /**
   * 获取单个物品
   */
  async get(
    gameId: string,
    goodsId: string,
    userId: string,
    language: Language
  ): Promise<Good | null> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db
      .select()
      .from(goods)
      .where(and(eq(goods.id, goodsId), eq(goods.gameId, gameId)))
      .limit(1);

    if (!row) return null;
    return this.toGoods(row);
  }

  /**
   * 列出物品
   */
  async list(input: ListGoodInput, userId: string, language: Language): Promise<GoodListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const conditions = [eq(goods.gameId, input.gameId)];
    if (input.kind) {
      conditions.push(eq(goods.kind, input.kind));
    }

    const rows = await db
      .select()
      .from(goods)
      .where(and(...conditions))
      .orderBy(desc(goods.updatedAt));

    return rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      return {
        id: row.id,
        key: row.key,
        name: (data.name as string) ?? "",
        kind: row.kind as GoodKind,
        part: (data.part as GoodListItem["part"]) ?? null,
        icon: (data.icon as string) ?? null,
        cost: (data.cost as number) ?? null,
        life: (data.life as number) ?? null,
        thew: (data.thew as number) ?? null,
        mana: (data.mana as number) ?? null,
        lifeMax: (data.lifeMax as number) ?? null,
        thewMax: (data.thewMax as number) ?? null,
        manaMax: (data.manaMax as number) ?? null,
        attack: (data.attack as number) ?? null,
        defend: (data.defend as number) ?? null,
        evade: (data.evade as number) ?? null,
        effectType: (data.effectType as number) ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建物品
   */
  async create(input: CreateGoodInput, userId: string, language: Language): Promise<Good> {
    await verifyGameAccess(input.gameId, userId, language);

    const defaultGoods = createDefaultGood(input.gameId, input.kind, input.key);
    const fullGoods = {
      ...defaultGoods,
      ...input,
    };

    // 分离索引字段和 data 字段
    const { gameId, key, kind, ...data } = fullGoods;

    const [row] = await db
      .insert(goods)
      .values({
        gameId,
        key: key.toLowerCase(), // key 统一小写
        kind,
        data,
      })
      .returning();

    return this.toGoods(row);
  }

  /**
   * 更新物品
   */
  async update(input: UpdateGoodInput, userId: string, language: Language): Promise<Good> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在
    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.goods.notFound"),
      });
    }

    // 合并更新
    const { id, gameId, createdAt, updatedAt, ...inputData } = input;
    const merged = { ...existing, ...inputData };

    // 分离索引字段和 data 字段
    const {
      id: _id,
      gameId: _gameId,
      key,
      kind,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = merged;

    const [row] = await db
      .update(goods)
      .set({
        key: key.toLowerCase(), // key 统一小写
        kind,
        data,
        updatedAt: new Date(),
      })
      .where(and(eq(goods.id, id), eq(goods.gameId, gameId)))
      .returning();

    return this.toGoods(row);
  }

  /**
   * 删除物品
   */
  async delete(
    gameId: string,
    goodsId: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db.delete(goods).where(and(eq(goods.id, goodsId), eq(goods.gameId, gameId)));

    return { id: goodsId };
  }

  /**
   * 从 INI 导入物品
   */
  async importFromIni(input: ImportGoodInput, userId: string, language: Language): Promise<Good> {
    await verifyGameAccess(input.gameId, userId, language);

    const parsed = this.parseIni(input.iniContent);

    // 使用文件名作为 key
    const key = input.fileName;

    return this.create(
      {
        gameId: input.gameId,
        key,
        kind: parsed.kind ?? "Drug",
        name: parsed.name ?? "未命名物品",
        intro: parsed.intro,
        ...parsed,
      },
      userId,
      language
    );
  }

  /**
   * 批量导入物品
   */
  async batchImportFromIni(
    input: BatchImportGoodInput,
    userId: string,
    language: Language
  ): Promise<BatchImportGoodResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const success: BatchImportGoodResult["success"] = [];
    const failed: BatchImportGoodResult["failed"] = [];

    for (const item of input.items) {
      try {
        const parsed = this.parseIni(item.iniContent);

        // 使用文件名作为 key
        const key = item.fileName;

        const result = await this.create(
          {
            gameId: input.gameId,
            key,
            kind: parsed.kind ?? "Drug",
            name: parsed.name ?? item.fileName.replace(/\.ini$/i, "") ?? "未命名物品",
            intro: parsed.intro,
            ...parsed,
          },
          userId,
          language
        );

        success.push({
          fileName: item.fileName,
          id: result.id,
          name: result.name,
          kind: result.kind,
        });
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
   * 解析 INI 文件
   */
  private parseIni(content: string): Partial<Good> {
    const lines = content.split(/\r?\n/);
    const result: Partial<Good> = {};
    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith(";")) {
        continue;
      }

      const sectionMatch = trimmed.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (!kvMatch || currentSection !== "Init") continue;

      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      switch (key) {
        case "Name":
          result.name = value;
          break;
        case "Kind":
          result.kind = GoodKindFromValue[parseInt(value, 10)] ?? "Drug";
          break;
        case "Cost":
          result.cost = value ? parseInt(value, 10) : null;
          break;
        case "Intro":
          result.intro = value.trim();
          break;
        case "Effect":
          result.effect = value || null;
          break;
        case "Image":
          result.image = value || null;
          break;
        case "Icon":
          result.icon = value || null;
          break;
        // 消耗品字段
        case "Life":
          result.life = value ? parseInt(value, 10) : null;
          break;
        case "Thew":
          result.thew = value ? parseInt(value, 10) : null;
          break;
        case "Mana":
          result.mana = value ? parseInt(value, 10) : null;
          break;
        // 装备字段
        case "Part":
          result.part = value as Good["part"];
          break;
        case "LifeMax":
          result.lifeMax = value ? parseInt(value, 10) : null;
          break;
        case "ThewMax":
          result.thewMax = value ? parseInt(value, 10) : null;
          break;
        case "ManaMax":
          result.manaMax = value ? parseInt(value, 10) : null;
          break;
        case "Attack":
          result.attack = value ? parseInt(value, 10) : null;
          break;
        case "Defend":
          result.defend = value ? parseInt(value, 10) : null;
          break;
        case "Evade":
          result.evade = value ? parseInt(value, 10) : null;
          break;
        case "EffectType":
          // 保存原始数值 (0-3)，实际效果由 Kind + Part 组合决定
          result.effectType = value ? parseInt(value, 10) : null;
          break;
        // 任务道具字段
        case "Script":
          result.script = value || null;
          break;
        // 扩展战斗属性
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
        // 特殊效果
        case "SpecialEffect":
          result.specialEffect = value ? parseInt(value, 10) : null;
          break;
        case "SpecialEffectValue":
          result.specialEffectValue = value ? parseInt(value, 10) : null;
          break;
        // 价格
        case "SellPrice":
          result.sellPrice = value ? parseInt(value, 10) : null;
          break;
        // 武功关联
        case "FlyIni":
          result.flyIni = value || null;
          break;
        case "FlyIni2":
          result.flyIni2 = value || null;
          break;
        case "MagicIniWhenUse":
          result.magicIniWhenUse = value || null;
          break;
        case "ReplaceMagic":
          result.replaceMagic = value || null;
          break;
        case "UseReplaceMagic":
          result.useReplaceMagic = value || null;
          break;
        case "MagicToUseWhenBeAttacked":
          result.magicToUseWhenBeAttacked = value || null;
          break;
        case "MagicDirectionWhenBeAttacked":
          result.magicDirectionWhenBeAttacked = value ? parseInt(value, 10) : null;
          break;
        // 武功增幅
        case "AddMagicEffectPercent":
          result.addMagicEffectPercent = value ? parseInt(value, 10) : null;
          break;
        case "AddMagicEffectAmount":
          result.addMagicEffectAmount = value ? parseInt(value, 10) : null;
          break;
        case "AddMagicEffectName":
          result.addMagicEffectName = value || null;
          break;
        case "AddMagicEffectType":
          result.addMagicEffectType = value || null;
          break;
        // 使用限制
        case "User":
          result.user = value
            ? value
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : null;
          break;
        case "MinUserLevel":
          result.minUserLevel = value ? parseInt(value, 10) : null;
          break;
        case "NoNeedToEquip":
          result.noNeedToEquip = value ? parseInt(value, 10) : null;
          break;
        // 移动与冷却
        case "ChangeMoveSpeedPercent":
          result.changeMoveSpeedPercent = value ? parseInt(value, 10) : null;
          break;
        case "ColdMilliSeconds":
          result.coldMilliSeconds = value ? parseInt(value, 10) : null;
          break;
        // 队友效果
        case "FollowPartnerHasDrugEffect":
          result.followPartnerHasDrugEffect = value ? parseInt(value, 10) : null;
          break;
        case "FighterFriendHasDrugEffect":
          result.fighterFriendHasDrugEffect = value ? parseInt(value, 10) : null;
          break;
      }
    }

    return result;
  }
}

export const goodsService = new GoodsService();
