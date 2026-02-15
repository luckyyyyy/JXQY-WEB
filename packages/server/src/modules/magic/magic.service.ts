/**
 * 武功服务
 * 使用 PostgreSQL 数据库存储，数据以 JSON 形式存储在 data 字段中
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */

import type {
  AttackFile,
  BatchImportMagicInput,
  BatchImportMagicResult,
  CreateMagicInput,
  ImportMagicInput,
  ListMagicInput,
  Magic,
  MagicLevel,
  MagicListItem,
  MagicMoveKind,
  UpdateMagicInput,
} from "@miu2d/types";
import {
  createDefaultAttackFile,
  createDefaultMagic,
  MagicBelongFromValue,
  MagicMoveKindFromValue,
  MagicSpecialKindFromValue,
} from "@miu2d/types";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { games, magics } from "../../db/schema";
import type { Language } from "../../i18n";
import { getMessage } from "../../i18n";
import { verifyGameAccess } from "../../utils/gameAccess";

export class MagicService {
  /**
   * 将数据库记录转换为 Magic 类型
   */
  private toMagic(row: typeof magics.$inferSelect): Magic {
    const data = row.data as Omit<
      Magic,
      "id" | "gameId" | "key" | "userType" | "name" | "createdAt" | "updatedAt"
    >;
    return {
      ...data,
      id: row.id,
      gameId: row.gameId,
      key: row.key,
      userType: row.userType as Magic["userType"],
      name: row.name,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  /**
   * 公开接口：通过 slug 列出游戏的所有武功（无需认证）
   * 用于游戏客户端加载武功数据
   */
  async listPublicBySlug(gameSlug: string): Promise<Magic[]> {
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
      .from(magics)
      .where(eq(magics.gameId, game.id))
      .orderBy(desc(magics.updatedAt));

    return rows.map((row) => this.toMagic(row));
  }

  /**
   * 获取单个武功
   */
  async get(
    gameId: string,
    magicId: string,
    userId: string,
    language: Language
  ): Promise<Magic | null> {
    await verifyGameAccess(gameId, userId, language);

    const [row] = await db
      .select()
      .from(magics)
      .where(and(eq(magics.id, magicId), eq(magics.gameId, gameId)))
      .limit(1);

    if (!row) return null;
    return this.toMagic(row);
  }

  /**
   * 列出武功
   */
  async list(input: ListMagicInput, userId: string, language: Language): Promise<MagicListItem[]> {
    await verifyGameAccess(input.gameId, userId, language);

    const conditions = [eq(magics.gameId, input.gameId)];
    if (input.userType) {
      conditions.push(eq(magics.userType, input.userType));
    }

    const rows = await db
      .select()
      .from(magics)
      .where(and(...conditions))
      .orderBy(desc(magics.updatedAt));

    return rows.map((row) => {
      const data = row.data as Record<string, unknown>;
      return {
        id: row.id,
        key: row.key,
        name: row.name,
        userType: row.userType as MagicListItem["userType"],
        moveKind: (data.moveKind as MagicMoveKind) ?? "SingleMove",
        belong: (data.belong as MagicListItem["belong"]) ?? null,
        icon: (data.icon as string) ?? null,
        updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * 创建武功
   */
  async create(input: CreateMagicInput, userId: string, language: Language): Promise<Magic> {
    await verifyGameAccess(input.gameId, userId, language);

    const defaultMagic = createDefaultMagic(input.gameId, input.userType, input.key);
    const fullMagic = {
      ...defaultMagic,
      ...input,
    };

    // 分离索引字段和 data 字段
    const { gameId, key, userType, name, ...data } = fullMagic;

    const [row] = await db
      .insert(magics)
      .values({
        gameId,
        key,
        userType,
        name,
        data,
      })
      .returning();

    return this.toMagic(row);
  }

  /**
   * 更新武功
   */
  async update(input: UpdateMagicInput, userId: string, language: Language): Promise<Magic> {
    await verifyGameAccess(input.gameId, userId, language);

    // 检查是否存在
    const existing = await this.get(input.gameId, input.id, userId, language);
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: getMessage(language, "errors.magic.notFound"),
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
      userType,
      name,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = merged;

    const [row] = await db
      .update(magics)
      .set({
        key,
        userType,
        name,
        data,
        updatedAt: new Date(),
      })
      .where(and(eq(magics.id, id), eq(magics.gameId, gameId)))
      .returning();

    return this.toMagic(row);
  }

  /**
   * 删除武功
   */
  async delete(
    gameId: string,
    magicId: string,
    userId: string,
    language: Language
  ): Promise<{ id: string }> {
    await verifyGameAccess(gameId, userId, language);

    await db.delete(magics).where(and(eq(magics.id, magicId), eq(magics.gameId, gameId)));

    return { id: magicId };
  }

  /**
   * 从 INI 导入武功
   */
  async importFromIni(input: ImportMagicInput, userId: string, language: Language): Promise<Magic> {
    await verifyGameAccess(input.gameId, userId, language);

    const parsed = this.parseIni(input.iniContent, input.userType);

    // 如果有 AttackFile INI，解析并设置 attackFile 字段
    if (input.attackFileContent) {
      parsed.attackFile = this.parseAttackFileIni(input.attackFileContent);
    }

    // 使用文件名作为 key
    const key = input.fileName;

    return this.create(
      {
        gameId: input.gameId,
        userType: input.userType,
        key,
        name: parsed.name ?? "未命名武功",
        intro: parsed.intro,
        moveKind: parsed.moveKind,
        specialKind: parsed.specialKind,
        belong: parsed.belong,
        ...parsed,
      },
      userId,
      language
    );
  }

  /**
   * 批量导入武功
   * 支持自动识别飞行武功（有 AttackFile 的武功）
   * 支持每个文件单独指定 userType（用于自动识别玩家/NPC武功）
   */
  async batchImportFromIni(
    input: BatchImportMagicInput,
    userId: string,
    language: Language
  ): Promise<BatchImportMagicResult> {
    await verifyGameAccess(input.gameId, userId, language);

    const success: BatchImportMagicResult["success"] = [];
    const failed: BatchImportMagicResult["failed"] = [];

    for (const item of input.items) {
      try {
        // 优先使用每个文件的 userType，否则使用全局 userType，最后默认为 npc
        const userType = item.userType ?? input.userType ?? "npc";
        const parsed = this.parseIni(item.iniContent, userType);
        const isFlyingMagic = !!item.attackFileContent;

        // 如果有 AttackFile INI，解析并设置 attackFile 字段
        if (item.attackFileContent) {
          parsed.attackFile = this.parseAttackFileIni(item.attackFileContent);
        }

        // 使用文件名作为 key
        const key = item.fileName;

        const magic = await this.create(
          {
            gameId: input.gameId,
            userType,
            key,
            name: parsed.name ?? item.fileName.replace(/\.ini$/i, "") ?? "未命名武功",
            intro: parsed.intro,
            moveKind: parsed.moveKind,
            specialKind: parsed.specialKind,
            belong: parsed.belong,
            ...parsed,
          },
          userId,
          language
        );

        success.push({
          fileName: item.fileName,
          id: magic.id,
          name: magic.name,
          isFlyingMagic,
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
   * 解析 AttackFile INI 内容
   */
  private parseAttackFileIni(content: string): AttackFile {
    const result = createDefaultAttackFile();
    const lines = content.split(/\r?\n/);
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
        case "Intro":
          result.intro = value;
          break;
        case "MoveKind":
          result.moveKind = MagicMoveKindFromValue[parseInt(value, 10)] ?? "SingleMove";
          break;
        case "Speed":
          result.speed = parseInt(value, 10) || 8;
          break;
        case "Region":
          result.region = parseInt(value, 10) || 0;
          break;
        case "SpecialKind":
          result.specialKind = MagicSpecialKindFromValue[parseInt(value, 10)] ?? "None";
          break;
        case "SpecialKindValue":
          result.specialKindValue = parseInt(value, 10) || 0;
          break;
        case "SpecialKindMilliSeconds":
          result.specialKindMilliSeconds = parseInt(value, 10) || 0;
          break;
        case "AlphaBlend":
          result.alphaBlend = parseInt(value, 10) || 0;
          break;
        case "FlyingLum":
          result.flyingLum = parseInt(value, 10) || 0;
          break;
        case "VanishLum":
          result.vanishLum = parseInt(value, 10) || 0;
          break;
        case "WaitFrame":
          result.waitFrame = parseInt(value, 10) || 0;
          break;
        case "LifeFrame":
          result.lifeFrame = parseInt(value, 10) || 4;
          break;
        case "FlyingImage":
          result.flyingImage = value || null;
          break;
        case "FlyingSound":
          result.flyingSound = value || null;
          break;
        case "VanishImage":
          result.vanishImage = value || null;
          break;
        case "VanishSound":
          result.vanishSound = value || null;
          break;
        case "PassThrough":
          result.passThrough = parseInt(value, 10) || 0;
          break;
        case "PassThroughWall":
          result.passThroughWall = parseInt(value, 10) || 0;
          break;
        case "TraceEnemy":
          result.traceEnemy = parseInt(value, 10) || 0;
          break;
        case "TraceSpeed":
          result.traceSpeed = parseInt(value, 10) || 0;
          break;
        case "RangeRadius":
          result.rangeRadius = parseInt(value, 10) || 0;
          break;
        case "AttackAll":
          result.attackAll = parseInt(value, 10) || 0;
          break;
        case "Bounce":
          result.bounce = parseInt(value, 10) || 0;
          break;
        case "BounceHurt":
          result.bounceHurt = parseInt(value, 10) || 0;
          break;
        case "VibratingScreen":
          result.vibratingScreen = parseInt(value, 10) || 0;
          break;
      }
    }

    return result;
  }

  /**
   * 解析 INI 文件
   */
  private parseIni(content: string, userType: "player" | "npc"): Partial<Magic> {
    const lines = content.split(/\r?\n/);
    const result: Partial<Magic> = {};
    const levels: MagicLevel[] = [];
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
      if (!kvMatch) continue;

      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();

      if (currentSection === "Init") {
        this.parseInitSection(key, value, result);
      } else if (currentSection.startsWith("Level")) {
        const levelNum = parseInt(currentSection.replace("Level", ""), 10);
        if (!Number.isNaN(levelNum)) {
          let level = levels.find((l) => l.level === levelNum);
          if (!level) {
            level = { level: levelNum, effect: 0, manaCost: 0 };
            levels.push(level);
          }
          this.parseLevelSection(key, value, level);
        }
      }
    }

    result.userType = userType;

    if (userType === "player") {
      // 如果 INI 有 [Level] 段，使用解析的等级数据
      // 如果没有，显式设置 levels=null 以覆盖 createDefaultMagic 的默认值
      // （默认值的 effect=100,200... 会导致引擎不使用 realAttack）
      result.levels = levels.length > 0 ? levels.sort((a, b) => a.level - b.level) : null;
    }

    return result;
  }

  /**
   * 解析 [Init] 段
   */
  private parseInitSection(key: string, value: string, result: Partial<Magic>): void {
    switch (key) {
      case "Name":
        result.name = value;
        break;
      case "Intro":
        result.intro = value.trim();
        break;
      case "MoveKind":
        result.moveKind = MagicMoveKindFromValue[parseInt(value, 10)] ?? "SingleMove";
        break;
      case "SpecialKind":
        result.specialKind = MagicSpecialKindFromValue[parseInt(value, 10)] ?? "None";
        break;
      case "Speed":
        result.speed = parseInt(value, 10) || 8;
        break;
      case "Region":
        result.region = parseInt(value, 10) || 0;
        break;
      case "AlphaBlend":
        result.alphaBlend = parseInt(value, 10) || 0;
        break;
      case "FlyingLum":
        result.flyingLum = parseInt(value, 10) || 0;
        break;
      case "VanishLum":
        result.vanishLum = parseInt(value, 10) || 0;
        break;
      case "WaitFrame":
        result.waitFrame = parseInt(value, 10) || 0;
        break;
      case "LifeFrame":
        result.lifeFrame = parseInt(value, 10) || 0;
        break;
      case "Image":
        result.image = value || null;
        break;
      case "Icon":
        result.icon = value || null;
        break;
      case "FlyingImage":
        result.flyingImage = value || null;
        break;
      case "FlyingSound":
        result.flyingSound = value || null;
        break;
      case "VanishImage":
        result.vanishImage = value || null;
        break;
      case "VanishSound":
        result.vanishSound = value || null;
        break;
      case "SuperModeImage":
        result.superModeImage = value || null;
        break;
      case "Belong":
        if (value) {
          result.belong = MagicBelongFromValue[parseInt(value, 10)] ?? "Neutral";
        }
        break;
      case "ActionFile":
        result.actionFile = value || null;
        break;
      case "PassThrough":
        result.passThrough = parseInt(value, 10) || 0;
        break;
      case "PassThroughWall":
        result.passThroughWall = parseInt(value, 10) || 0;
        break;
      case "TraceEnemy":
        result.traceEnemy = parseInt(value, 10) || 0;
        break;
      case "TraceSpeed":
        result.traceSpeed = parseInt(value, 10) || 0;
        break;
      case "ColdMilliSeconds":
        result.coldMilliSeconds = parseInt(value, 10) || 0;
        break;
      case "RangeRadius":
        result.rangeRadius = parseInt(value, 10) || 0;
        break;
      case "AttackAll":
        result.attackAll = parseInt(value, 10) || 0;
        break;
      case "Bounce":
        result.bounce = parseInt(value, 10) || 0;
        break;
      case "BounceHurt":
        result.bounceHurt = parseInt(value, 10) || 0;
        break;
      case "VibratingScreen":
        result.vibratingScreen = parseInt(value, 10) || 0;
        break;
      case "SpecialKindValue":
        result.specialKindValue = parseInt(value, 10) || 0;
        break;
      case "SpecialKindMilliSeconds":
        result.specialKindMilliSeconds = parseInt(value, 10) || 0;
        break;
      // ─── Effect & Cost ───
      case "Effect":
        result.effect = parseInt(value, 10) || 0;
        break;
      case "Effect2":
        result.effect2 = parseInt(value, 10) || 0;
        break;
      case "Effect3":
        result.effect3 = parseInt(value, 10) || 0;
        break;
      case "EffectExt":
        result.effectExt = parseInt(value, 10) || 0;
        break;
      case "EffectMana":
        result.effectMana = parseInt(value, 10) || 0;
        break;
      case "ManaCost":
        result.manaCost = parseInt(value, 10) || 0;
        break;
      case "ThewCost":
        result.thewCost = parseInt(value, 10) || 0;
        break;
      case "LifeCost":
        result.lifeCost = parseInt(value, 10) || 0;
        break;
      case "LevelupExp":
        result.levelupExp = parseInt(value, 10) || 0;
        break;
      // ─── Count & Level ───
      case "Count":
        result.count = parseInt(value, 10) || 0;
        break;
      case "MaxCount":
        result.maxCount = parseInt(value, 10) || 0;
        break;
      case "MaxLevel":
        result.maxLevel = parseInt(value, 10) || 0;
        break;
      case "EffectLevel":
        result.effectLevel = parseInt(value, 10) || 0;
        break;
      // ─── Special Effect ───
      case "NoSpecialKindEffect":
        result.noSpecialKindEffect = parseInt(value, 10) || 0;
        break;
      // ─── Penetration & Body ───
      case "PassThroughWithDestroyEffect":
        result.passThroughWithDestroyEffect = parseInt(value, 10) || 0;
        break;
      case "Solid":
        result.solid = parseInt(value, 10) || 0;
        break;
      case "BodyRadius":
        result.bodyRadius = parseInt(value, 10) || 0;
        break;
      // ─── Tracking ───
      case "TraceEnemyDelayMilliseconds":
        result.traceEnemyDelayMilliseconds = parseInt(value, 10) || 0;
        break;
      // ─── Time / Duration ───
      case "KeepMilliseconds":
        result.keepMilliseconds = parseInt(value, 10) || 0;
        break;
      case "ChangeToFriendMilliseconds":
        result.changeToFriendMilliseconds = parseInt(value, 10) || 0;
        break;
      // ─── Range Effect ───
      case "RangeEffect":
        result.rangeEffect = parseInt(value, 10) || 0;
        break;
      case "RangeAddLife":
        result.rangeAddLife = parseInt(value, 10) || 0;
        break;
      case "RangeAddMana":
        result.rangeAddMana = parseInt(value, 10) || 0;
        break;
      case "RangeAddThew":
        result.rangeAddThew = parseInt(value, 10) || 0;
        break;
      case "RangeSpeedUp":
        result.rangeSpeedUp = parseInt(value, 10) || 0;
        break;
      case "RangeFreeze":
        result.rangeFreeze = parseInt(value, 10) || 0;
        break;
      case "RangePoison":
        result.rangePoison = parseInt(value, 10) || 0;
        break;
      case "RangePetrify":
        result.rangePetrify = parseInt(value, 10) || 0;
        break;
      case "RangeDamage":
        result.rangeDamage = parseInt(value, 10) || 0;
        break;
      case "RangeTimeInerval":
      case "RangeTimeInterval":
        result.rangeTimeInterval = parseInt(value, 10) || 0;
        break;
      // ─── Ball / Bounce ───
      case "Ball":
        result.ball = parseInt(value, 10) || 0;
        break;
      case "Sticky":
        result.sticky = parseInt(value, 10) || 0;
        break;
      // ─── BounceFly ───
      case "BounceFly":
        result.bounceFly = parseInt(value, 10) || 0;
        break;
      case "BounceFlySpeed":
        result.bounceFlySpeed = parseInt(value, 10) || 0;
        break;
      case "BounceFlyEndHurt":
        result.bounceFlyEndHurt = parseInt(value, 10) || 0;
        break;
      case "BounceFlyTouchHurt":
        result.bounceFlyTouchHurt = parseInt(value, 10) || 0;
        break;
      case "BounceFlyEndMagic":
        result.bounceFlyEndMagic = value || null;
        break;
      case "MagicDirectionWhenBounceFlyEnd":
        result.magicDirectionWhenBounceFlyEnd = parseInt(value, 10) || 0;
        break;
      // ─── Start Position ───
      case "BeginAtMouse":
        result.beginAtMouse = parseInt(value, 10) || 0;
        break;
      case "BeginAtUser":
        result.beginAtUser = parseInt(value, 10) || 0;
        break;
      case "BeginAtUserAddDirectionOffset":
        result.beginAtUserAddDirectionOffset = parseInt(value, 10) || 0;
        break;
      case "BeginAtUserAddUserDirectionOffset":
        result.beginAtUserAddUserDirectionOffset = parseInt(value, 10) || 0;
        break;
      // ─── Movement / Trajectory ───
      case "RandomMoveDegree":
        result.randomMoveDegree = parseInt(value, 10) || 0;
        break;
      case "FollowMouse":
        result.followMouse = parseInt(value, 10) || 0;
        break;
      case "MeteorMove":
        result.meteorMove = parseInt(value, 10) || 0;
        break;
      case "MeteorMoveDir":
        result.meteorMoveDir = parseInt(value, 10) || 0;
        break;
      case "MoveBack":
        result.moveBack = parseInt(value, 10) || 0;
        break;
      case "MoveImitateUser":
        result.moveImitateUser = parseInt(value, 10) || 0;
        break;
      // ─── Circular Motion ───
      case "CircleMoveColockwise":
      case "CircleMoveClockwise":
        result.circleMoveClockwise = parseInt(value, 10) || 0;
        break;
      case "CircleMoveAnticlockwise":
        result.circleMoveAnticlockwise = parseInt(value, 10) || 0;
        break;
      case "RoundMoveColockwise":
      case "RoundMoveClockwise":
        result.roundMoveClockwise = parseInt(value, 10) || 0;
        break;
      case "RoundMoveAnticlockwise":
        result.roundMoveAnticlockwise = parseInt(value, 10) || 0;
        break;
      case "RoundMoveCount":
        result.roundMoveCount = parseInt(value, 10) || 0;
        break;
      case "RoundMoveDegreeSpeed":
        result.roundMoveDegreeSpeed = parseInt(value, 10) || 0;
        break;
      case "RoundRadius":
        result.roundRadius = parseInt(value, 10) || 0;
        break;
      // ─── Carry User ───
      case "CarryUser":
        result.carryUser = parseInt(value, 10) || 0;
        break;
      case "CarryUserSpriteIndex":
        result.carryUserSpriteIndex = parseInt(value, 10) || 0;
        break;
      case "HideUserWhenCarry":
        result.hideUserWhenCarry = parseInt(value, 10) || 0;
        break;
      // ─── Explosion / Lifecycle ───
      case "NoExplodeWhenLifeFrameEnd":
        result.noExplodeWhenLifeFrameEnd = parseInt(value, 10) || 0;
        break;
      case "ExplodeWhenLifeFrameEnd":
        result.explodeWhenLifeFrameEnd = parseInt(value, 10) || 0;
        break;
      case "NoInterruption":
        result.noInterruption = parseInt(value, 10) || 0;
        break;
      case "DiscardOppositeMagic":
        result.discardOppositeMagic = parseInt(value, 10) || 0;
        break;
      case "ExchangeUser":
        result.exchangeUser = parseInt(value, 10) || 0;
        break;
      // ─── Buff / Debuff ───
      case "AttackAddPercent":
        result.attackAddPercent = parseInt(value, 10) || 0;
        break;
      case "DefendAddPercent":
        result.defendAddPercent = parseInt(value, 10) || 0;
        break;
      case "EvadeAddPercent":
        result.evadeAddPercent = parseInt(value, 10) || 0;
        break;
      case "SpeedAddPercent":
        result.speedAddPercent = parseInt(value, 10) || 0;
        break;
      case "MorphMilliseconds":
        result.morphMilliseconds = parseInt(value, 10) || 0;
        break;
      case "WeakMilliseconds":
        result.weakMilliseconds = parseInt(value, 10) || 0;
        break;
      case "WeakAttackPercent":
        result.weakAttackPercent = parseInt(value, 10) || 0;
        break;
      case "WeakDefendPercent":
        result.weakDefendPercent = parseInt(value, 10) || 0;
        break;
      case "BlindMilliseconds":
        result.blindMilliseconds = parseInt(value, 10) || 0;
        break;
      // ─── Disable / Restrict ───
      case "DisableUse":
        result.disableUse = parseInt(value, 10) || 0;
        break;
      case "LifeFullToUse":
        result.lifeFullToUse = parseInt(value, 10) || 0;
        break;
      case "DisableMoveMilliseconds":
        result.disableMoveMilliseconds = parseInt(value, 10) || 0;
        break;
      case "DisableSkillMilliseconds":
        result.disableSkillMilliseconds = parseInt(value, 10) || 0;
        break;
      // ─── Side Effect / Restore ───
      case "SideEffectProbability":
        result.sideEffectProbability = parseInt(value, 10) || 0;
        break;
      case "SideEffectPercent":
        result.sideEffectPercent = parseInt(value, 10) || 0;
        break;
      case "SideEffectType":
        result.sideEffectType = parseInt(value, 10) || 0;
        break;
      case "RestoreProbability":
        result.restoreProbability = parseInt(value, 10) || 0;
        break;
      case "RestorePercent":
        result.restorePercent = parseInt(value, 10) || 0;
        break;
      case "RestoreType":
        result.restoreType = parseInt(value, 10) || 0;
        break;
      case "DieAfterUse":
        result.dieAfterUse = parseInt(value, 10) || 0;
        break;
      // ─── Base Stat Bonus ───
      case "LifeMax":
        result.lifeMax = parseInt(value, 10) || 0;
        break;
      case "ThewMax":
        result.thewMax = parseInt(value, 10) || 0;
        break;
      case "ManaMax":
        result.manaMax = parseInt(value, 10) || 0;
        break;
      case "Attack":
        result.attack = parseInt(value, 10) || 0;
        break;
      case "Attack2":
        result.attack2 = parseInt(value, 10) || 0;
        break;
      case "Attack3":
        result.attack3 = parseInt(value, 10) || 0;
        break;
      case "Defend":
        result.defend = parseInt(value, 10) || 0;
        break;
      case "Defend2":
        result.defend2 = parseInt(value, 10) || 0;
        break;
      case "Defend3":
        result.defend3 = parseInt(value, 10) || 0;
        break;
      case "Evade":
        result.evade = parseInt(value, 10) || 0;
        break;
      // ─── Restore Speed ───
      case "AddLifeRestorePercent":
        result.addLifeRestorePercent = parseInt(value, 10) || 0;
        break;
      case "AddManaRestorePercent":
        result.addManaRestorePercent = parseInt(value, 10) || 0;
        break;
      case "AddThewRestorePercent":
        result.addThewRestorePercent = parseInt(value, 10) || 0;
        break;
      // ─── Parasitic ───
      case "Parasitic":
        result.parasitic = parseInt(value, 10) || 0;
        break;
      case "ParasiticMagic":
        result.parasiticMagic = value || null;
        break;
      case "ParasiticInterval":
        result.parasiticInterval = parseInt(value, 10) || 0;
        break;
      case "ParasiticMaxEffect":
        result.parasiticMaxEffect = parseInt(value, 10) || 0;
        break;
      // ─── Leap / Jump ───
      case "LeapTimes":
        result.leapTimes = parseInt(value, 10) || 0;
        break;
      case "LeapFrame":
        result.leapFrame = parseInt(value, 10) || 0;
        break;
      case "EffectReducePercentage":
        result.effectReducePercentage = parseInt(value, 10) || 0;
        break;
      case "LeapImage":
        result.leapImage = value || null;
        break;
      case "JumpToTarget":
        result.jumpToTarget = parseInt(value, 10) || 0;
        break;
      case "JumpMoveSpeed":
        result.jumpMoveSpeed = parseInt(value, 10) || 0;
        break;
      // ─── Revive Body ───
      case "ReviveBodyRadius":
        result.reviveBodyRadius = parseInt(value, 10) || 0;
        break;
      case "ReviveBodyMaxCount":
        result.reviveBodyMaxCount = parseInt(value, 10) || 0;
        break;
      case "ReviveBodyLifeMilliSeconds":
        result.reviveBodyLifeMilliSeconds = parseInt(value, 10) || 0;
        break;
      // ─── Hit Count ───
      case "HitCountToChangeMagic":
        result.hitCountToChangeMagic = parseInt(value, 10) || 0;
        break;
      case "HitCountFlyRadius":
        result.hitCountFlyRadius = parseInt(value, 10) || 0;
        break;
      case "HitCountFlyAngleSpeed":
        result.hitCountFlyAngleSpeed = parseInt(value, 10) || 0;
        break;
      case "HitCountFlyingImage":
        result.hitCountFlyingImage = value || null;
        break;
      case "HitCountVanishImage":
        result.hitCountVanishImage = value || null;
        break;
      // ─── Related Magic ───
      case "ExplodeMagicFile":
        result.explodeMagicFile = value || null;
        break;
      case "FlyMagic":
        result.flyMagic = value || null;
        break;
      case "FlyInterval":
        result.flyInterval = parseInt(value, 10) || 0;
        break;
      case "FlyIni":
        result.flyIni = value || null;
        break;
      case "FlyIni2":
        result.flyIni2 = value || null;
        break;
      case "RandMagicFile":
        result.randMagicFile = value || null;
        break;
      case "RandMagicProbability":
        result.randMagicProbability = parseInt(value, 10) || 0;
        break;
      case "SecondMagicFile":
        result.secondMagicFile = value || null;
        break;
      case "SecondMagicDelay":
        result.secondMagicDelay = parseInt(value, 10) || 0;
        break;
      case "MagicToUseWhenKillEnemy":
        result.magicToUseWhenKillEnemy = value || null;
        break;
      case "MagicDirectionWhenKillEnemy":
        result.magicDirectionWhenKillEnemy = parseInt(value, 10) || 0;
        break;
      case "ChangeMagic":
        result.changeMagic = value || null;
        break;
      case "JumpEndMagic":
        result.jumpEndMagic = value || null;
        break;
      case "MagicToUseWhenBeAttacked":
        result.magicToUseWhenBeAttacked = value || null;
        break;
      case "MagicDirectionWhenBeAttacked":
        result.magicDirectionWhenBeAttacked = parseInt(value, 10) || 0;
        break;
      case "MagicWhenNewPos":
        result.magicWhenNewPos = value || null;
        break;
      case "ReplaceMagic":
        result.replaceMagic = value || null;
        break;
      case "SpecialKind9ReplaceFlyIni":
        result.specialKind9ReplaceFlyIni = value || null;
        break;
      case "SpecialKind9ReplaceFlyIni2":
        result.specialKind9ReplaceFlyIni2 = value || null;
        break;
      // ─── NPC / Resource / Tag ───
      case "NpcFile":
        result.npcFile = value || null;
        break;
      case "NpcIni":
        result.npcIni = value || null;
        break;
      case "UseActionFile":
        result.useActionFile = value || null;
        break;
      case "RegionFile":
        result.regionFile = value || null;
        break;
      case "GoodsName":
        result.goodsName = value || null;
        break;
      case "Type":
        result.type = value || null;
        break;
    }
  }

  /**
   * 解析 [LevelN] 段
   */
  private parseLevelSection(key: string, value: string, level: MagicLevel): void {
    switch (key) {
      case "Effect":
        level.effect = parseInt(value, 10) || 0;
        break;
      case "ManaCost":
        level.manaCost = parseInt(value, 10) || 0;
        break;
      case "LevelupExp":
        level.levelupExp = value ? parseInt(value, 10) || null : null;
        break;
      case "Speed":
        if (value) {
          level.speed = parseInt(value, 10);
        }
        break;
      case "MoveKind":
        if (value) {
          level.moveKind = MagicMoveKindFromValue[parseInt(value, 10)];
        }
        break;
      case "LifeFrame":
        if (value) {
          level.lifeFrame = parseInt(value, 10);
        }
        break;
    }
  }
}

export const magicService = new MagicService();
