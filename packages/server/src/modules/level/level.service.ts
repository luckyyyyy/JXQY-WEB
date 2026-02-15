/**
 * 等级配置服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 */

import type {
  CreateLevelConfigInput,
  ImportLevelConfigInput,
  LevelConfig,
  LevelConfigListItem,
  LevelDetail,
  LevelUserType,
  ListLevelConfigInput,
  UpdateLevelConfigInput,
} from "@miu2d/types";
import { createDefaultLevelConfigLevels } from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, levelConfigs } from "../../db/schema";
import type { Language } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";

export class LevelConfigService {
  /**
   * 将数据库记录转换为 LevelConfig 类型
   */
  private toLevelConfig(row: typeof levelConfigs.$inferSelect): LevelConfig {
    const levels = row.data as LevelDetail[];
    return {
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      name: row.name,
      userType: row.userType as LevelUserType,
      maxLevel: row.maxLevel,
      levels,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有等级配置（无需认证）
   */
  async listPublicBySlug(gameSlug: string): Promise<LevelConfig[]> {
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
      .from(levelConfigs)
      .where(eq(levelConfigs.gameId, game.id))
      .orderBy(desc(levelConfigs.updatedAt));

    return rows.map((row) => this.toLevelConfig(row));
  }

  /**
   * 公开接口：通过 slug 和 key 获取单个等级配置（无需认证）
   */
  async getPublicBySlugAndKey(gameSlug: string, key: string): Promise<LevelConfig | null> {
    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.slug, gameSlug))
      .limit(1);

    if (!game) {
      throw new Error("Game not found");
    }

    const [row] = await db
      .select()
      .from(levelConfigs)
      .where(and(eq(levelConfigs.gameId, game.id), eq(levelConfigs.key, key)))
      .limit(1);

    if (!row) return null;
    return this.toLevelConfig(row);
  }

  /**
   * 获取单个等级配置
   */
  async get(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<LevelConfig | null> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db
      .select()
      .from(levelConfigs)
      .where(and(eq(levelConfigs.id, id), eq(levelConfigs.gameId, gameId)))
      .limit(1);

    if (!row) return null;
    return this.toLevelConfig(row);
  }

  /**
   * 列出等级配置
   */
  async list(
    input: ListLevelConfigInput,
    userId: string,
    language: Language
  ): Promise<LevelConfigListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const conditions = [eq(levelConfigs.gameId, input.gameId)];
    if (input.userType) {
      conditions.push(eq(levelConfigs.userType, input.userType));
    }

    const rows = await db
      .select()
      .from(levelConfigs)
      .where(and(...conditions))
      .orderBy(desc(levelConfigs.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      userType: row.userType as LevelUserType,
      maxLevel: row.maxLevel,
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  /**
   * 创建等级配置
   */
  async create(
    input: CreateLevelConfigInput,
    userId: string,
    language: Language
  ): Promise<LevelConfig> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查 key 是否已存在
    const [existing] = await db
      .select({ id: levelConfigs.id })
      .from(levelConfigs)
      .where(and(eq(levelConfigs.gameId, input.gameId), eq(levelConfigs.key, input.key)))
      .limit(1);

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `等级配置 key "${input.key}" 已存在`,
      });
    }

    // 生成默认等级数据
    const levels =
      input.levels || createDefaultLevelConfigLevels(input.maxLevel || 80, input.userType);

    const [row] = await db
      .insert(levelConfigs)
      .values({
        gameId: input.gameId,
        key: input.key,
        name: input.name,
        userType: input.userType,
        maxLevel: input.maxLevel || 80,
        data: levels,
      })
      .returning();

    return this.toLevelConfig(row);
  }

  /**
   * 更新等级配置
   */
  async update(
    input: UpdateLevelConfigInput,
    userId: string,
    language: Language
  ): Promise<LevelConfig> {
    await verifyGameAccess(input.gameId, userId, language);

    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "等级配置不存在",
      });
    }

    // 如果修改了 key，检查是否冲突
    if (input.key && input.key !== existing.key) {
      const [conflict] = await db
        .select({ id: levelConfigs.id })
        .from(levelConfigs)
        .where(and(eq(levelConfigs.gameId, input.gameId), eq(levelConfigs.key, input.key)))
        .limit(1);

      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `等级配置 key "${input.key}" 已存在`,
        });
      }
    }

    const [row] = await db
      .update(levelConfigs)
      .set({
        key: input.key ?? existing.key,
        name: input.name ?? existing.name,
        userType: input.userType ?? existing.userType,
        maxLevel: input.maxLevel ?? existing.maxLevel,
        data: input.levels ?? existing.levels,
        updatedAt: new Date(),
      })
      .where(and(eq(levelConfigs.id, input.id), eq(levelConfigs.gameId, input.gameId)))
      .returning();

    return this.toLevelConfig(row);
  }

  /**
   * 删除等级配置
   */
  async delete(
    gameId: string,
    id: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db
      .delete(levelConfigs)
      .where(and(eq(levelConfigs.id, id), eq(levelConfigs.gameId, gameId)));

    return { id };
  }

  /**
   * 从 INI 导入等级配置
   */
  async importFromIni(
    input: ImportLevelConfigInput,
    userId: string,
    language: Language
  ): Promise<LevelConfig> {
    await verifyGameAccess(input.gameId, userId, language);

    const levels = this.parseIni(input.iniContent, input.userType);
    const maxLevel = levels.length;

    // 使用完整文件名作为 key（保留 .ini 扩展名）
    const key = input.fileName;

    // 提取名称（如 Level-easy -> 简单模式）
    const name = this.extractNameFromFileName(input.fileName);

    // 检查是否已存在，如存在则更新
    const [existing] = await db
      .select({ id: levelConfigs.id })
      .from(levelConfigs)
      .where(and(eq(levelConfigs.gameId, input.gameId), eq(levelConfigs.key, key)))
      .limit(1);

    if (existing) {
      // 已存在，执行更新
      return this.update(
        {
          gameId: input.gameId,
          id: existing.id,
          key,
          name,
          userType: input.userType,
          maxLevel,
          levels,
        },
        userId,
        language
      );
    }

    // 不存在，创建新的
    return this.create(
      {
        gameId: input.gameId,
        key,
        name,
        userType: input.userType,
        maxLevel,
        levels,
      },
      userId,
      language
    );
  }

  /**
   * 从文件名提取友好名称
   */
  private extractNameFromFileName(fileName: string): string {
    const baseName = fileName.replace(/\.ini$/i, "").toLowerCase();

    if (baseName.includes("easy")) return "简单模式";
    if (baseName.includes("hard")) return "困难模式";
    if (baseName.includes("npc")) return "NPC等级";

    return fileName.replace(/\.ini$/i, "");
  }

  /**
   * 解析等级配置 INI 文件
   */
  private parseIni(content: string, userType: LevelUserType): LevelDetail[] {
    const levels: LevelDetail[] = [];
    const lines = content.split(/\r?\n/);

    let currentLevel = 0;
    let currentDetail: Partial<LevelDetail> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 匹配 [LevelN] 或 [Head]
      const sectionMatch = trimmed.match(/^\[Level(\d+)\]$/i);
      if (sectionMatch) {
        // 保存上一个等级
        if (currentLevel > 0) {
          levels.push({ ...currentDetail, level: currentLevel } as LevelDetail);
        }
        currentLevel = parseInt(sectionMatch[1], 10);
        currentDetail = { level: currentLevel };
        continue;
      }

      if (trimmed.startsWith("[")) continue; // 跳过 [Head] 等其他 section

      // 解析键值对
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0 && currentLevel > 0) {
        const key = trimmed.substring(0, eqIdx).trim();
        const valueStr = trimmed.substring(eqIdx + 1).trim();
        const value = parseInt(valueStr, 10);

        switch (key.toLowerCase()) {
          case "exp":
            currentDetail.exp = value || 0;
            break;
          case "levelupexp":
            currentDetail.levelUpExp = value || 100;
            break;
          case "lifemax":
            currentDetail.lifeMax = value || 100;
            break;
          case "life":
            currentDetail.life = value || 0;
            break;
          case "thewmax":
            currentDetail.thewMax = value || 100;
            break;
          case "manamax":
            currentDetail.manaMax = value || 100;
            break;
          case "attack":
            currentDetail.attack = value || 10;
            break;
          case "attack2":
            currentDetail.attack2 = value || 0;
            break;
          case "attack3":
            currentDetail.attack3 = value || 0;
            break;
          case "defend":
            currentDetail.defend = value || 10;
            break;
          case "defend2":
            currentDetail.defend2 = value || 0;
            break;
          case "defend3":
            currentDetail.defend3 = value || 0;
            break;
          case "evade":
            currentDetail.evade = value || 0;
            break;
          case "newmagic":
            currentDetail.newMagic = valueStr || "";
            break;
          case "newgood":
            currentDetail.newGood = valueStr || "";
            break;
        }
      }
    }

    // 保存最后一个等级
    if (currentLevel > 0) {
      levels.push({ ...currentDetail, level: currentLevel } as LevelDetail);
    }

    // 按等级排序
    levels.sort((a, b) => a.level - b.level);

    return levels;
  }
}

export const levelConfigService = new LevelConfigService();
