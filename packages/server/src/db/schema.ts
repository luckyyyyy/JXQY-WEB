import { boolean, jsonb, pgTable, text, timestamp, uuid, integer, unique } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  settings: jsonb("settings"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});

/**
 * 邮箱验证令牌表
 * type: "verify" = 验证当前邮箱, "change" = 修改邮箱
 */
export const emailTokens = pgTable("email_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: text("token").notNull().unique(),
  type: text("type", { enum: ["verify", "change"] }).notNull(),
  /** 修改邮箱时记录新邮箱地址 */
  newEmail: text("new_email"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/**
 * 游戏表（原 workspaces，重命名为 games）
 */
export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/**
 * 游戏成员表
 */
export const gameMembers = pgTable("game_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id").references(() => games.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/**
 * 文件系统表
 * 使用 PostgreSQL 存储文件元数据，S3 只存储文件内容
 * 这样重命名、移动等操作只需修改 PG 记录，无需操作 S3
 */
export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏 */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 父目录 ID，null 表示根目录（自引用外键，应用层处理级联删除） */
  parentId: uuid("parent_id"),
  /** 文件/目录名 */
  name: text("name").notNull(),
  /** 类型：file 或 folder */
  type: text("type", { enum: ["file", "folder"] }).notNull(),
  /** S3 存储键，仅文件有值，格式: {gameId}/{fileId} */
  storageKey: text("storage_key"),
  /** 文件大小（字节），仅文件有值 */
  size: text("size"),
  /** MIME 类型，仅文件有值 */
  mimeType: text("mime_type"),
  /** 文件内容校验和（SHA-256），仅文件有值 */
  checksum: text("checksum"),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  /** 软删除时间，null 表示未删除 */
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});

/**
 * 游戏全局配置表
 * 每个游戏有且仅有一条配置记录
 * data 字段存储 GameConfigData 类型的完整 JSON
 */
export const gameConfigs = pgTable("game_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（唯一，每个游戏只有一条配置） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull().unique(),
  /** 完整配置数据（JSONB） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

/**
 * 武功表
 * 使用简化设计：只存储索引字段 + 完整的 JSON 数据
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const magics = pgTable("magics", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（索引字段，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 武功类型（索引字段）: player / npc */
  userType: text("user_type", { enum: ["player", "npc"] }).notNull().default("player"),
  /** 武功名称（索引字段，便于搜索） */
  name: text("name").notNull(),
  /** 完整武功配置（JSONB，存储 Magic 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("magics_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 等级配置表
 * 存储玩家和 NPC 的等级属性配置
 * 类型定义在 @miu2d/types 中
 */
export const levelConfigs = pgTable("level_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（如 level-easy, level-hard, level-npc） */
  key: text("key").notNull(),
  /** 配置名称（如 "简单模式", "困难模式"） */
  name: text("name").notNull(),
  /** 配置类型: player / npc */
  userType: text("user_type", { enum: ["player", "npc"] }).notNull().default("player"),
  /** 最大等级数 */
  maxLevel: integer("max_level").notNull().default(80),
  /** 等级数据（JSONB，存储 LevelDetail[] 数组） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("level_configs_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 物品表
 * 使用简化设计：只存储索引字段 + 完整的 JSON 数据
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const goods = pgTable("goods", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（索引字段，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 物品种类（索引字段）: Consumable / Equipment / Quest */
  kind: text("kind", { enum: ["Consumable", "Equipment", "Quest"] }).notNull().default("Consumable"),
  /** 完整物品配置（JSONB，存储 Goods 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("goods_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 商店表
 * 存储商店配置（原 ini/buy/*.ini）
 * key = 文件名，data = 商品列表及配置
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const shops = pgTable("shops", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（文件名，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 商店名称（索引字段，便于搜索） */
  name: text("name").notNull(),
  /** 完整商店配置（JSONB，存储 Shop 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("shops_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * NPC 表
 * 存储 NPC 配置（原 npc/*.ini，资源配置分离到 npc_resources 表）
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const npcs = pgTable("npcs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（文件名，gameId + key 唯一） */
  key: text("key").notNull(),
  /** NPC 名称（索引字段，便于搜索） */
  name: text("name").notNull(),
  /** NPC 类型（索引字段）: Normal / Fighter / Flyer / GroundAnimal / WaterAnimal / Decoration / Intangible */
  kind: text("kind", { enum: ["Normal", "Fighter", "Flyer", "GroundAnimal", "WaterAnimal", "Decoration", "Intangible"] }).notNull().default("Normal"),
  /** NPC 与玩家的关系（索引字段）: Friendly / Neutral / Hostile / Partner */
  relation: text("relation", { enum: ["Friendly", "Neutral", "Hostile", "Partner"] }).notNull().default("Friendly"),
  /** 关联的资源配置 ID */
  resourceId: uuid("resource_id"),
  /** 完整 NPC 配置（JSONB，存储所有属性，不含资源配置） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("npcs_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * NPC 资源配置表（原 npcres/*.ini）
 * 存储 NPC 各状态的动画和音效资源
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const npcResources = pgTable("npc_resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（文件名，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 资源名称（用于显示和搜索） */
  name: text("name").notNull(),
  /** 完整资源配置（JSONB，存储 NpcResource 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("npc_resources_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * Object 表
 * 存储 Object 配置（原 obj/*.ini）
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const objs = pgTable("objs", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（文件名，gameId + key 唯一） */
  key: text("key").notNull(),
  /** Object 名称（索引字段，便于搜索） */
  name: text("name").notNull(),
  /** Object 类型（索引字段）: Dynamic / Static / Body / LoopingSound / RandSound / Door / Trap / Drop */
  kind: text("kind", { enum: ["Dynamic", "Static", "Body", "LoopingSound", "RandSound", "Door", "Trap", "Drop"] }).notNull().default("Static"),
  /** 关联的资源配置 ID */
  resourceId: uuid("resource_id"),
  /** 完整 Object 配置（JSONB，存储所有属性，不含资源配置） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("objs_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * Object 资源配置表（原 objres/*.ini）
 * 存储 Object 各状态的动画和音效资源
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const objResources = pgTable("obj_resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（文件名，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 资源名称（用于显示和搜索） */
  name: text("name").notNull(),
  /** 完整资源配置（JSONB，存储 ObjResource 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("obj_resources_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 玩家角色表
 * 存储玩家角色配置（原 save/game/PlayerX.ini）
 * 包括主角（Player0）和队伍同伴（Player1 等）
 * 类型定义在 @miu2d/types 中，供引擎、前端、后端共用
 */
export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（索引字段） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 唯一标识符（文件名如 Player0.ini，gameId + key 唯一） */
  key: text("key").notNull(),
  /** 角色名称（索引字段，便于搜索） */
  name: text("name").notNull(),
  /** 角色索引（Player0=0, Player1=1 ...） */
  index: integer("index").notNull().default(0),
  /** 完整角色配置（JSONB，存储 PlayerBase 类型的所有数据） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("players_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 对话头像映射表
 * 存储 HeadFile.ini 中的 idx -> ASF 文件名映射
 * 每个游戏一条记录，data 字段存 PortraitEntry[] 数组
 */
export const talkPortraits = pgTable("talk_portraits", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（唯一，每个游戏只有一条记录） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull().unique(),
  /** 头像映射数据（JSONB，存储 PortraitEntry[] 数组） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

/**
 * 对话数据表（原 TalkIndex.txt）
 * 每个游戏一条记录，data 字段存 TalkEntry[] 数组
 * 格式: [talkId, portraitIndex] 对话文本
 */
export const talks = pgTable("talks", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏（唯一，每个游戏只有一条记录） */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull().unique(),
  /** 对话数据（JSONB，存储 TalkEntry[] 数组） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

/**
 * 存档表
 * 存储用户的服务端存档
 * 元数据存 PG，完整存档数据也存 JSONB（一般 < 1MB）
 */
export const saves = pgTable("saves", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏 */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 所属用户 */
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  /** 存档名称（用户自定义） */
  name: text("name").notNull(),
  /** 地图名称（便于预览） */
  mapName: text("map_name"),
  /** 玩家等级 */
  level: integer("level"),
  /** 玩家名称 */
  playerName: text("player_name"),
  /** 截图 (base64 JPEG, ~50KB) */
  screenshot: text("screenshot"),
  /** 是否公开分享 */
  isShared: boolean("is_shared").notNull().default(false),
  /** 分享码（随机生成，用于分享链接） */
  shareCode: text("share_code").unique(),
  /** 完整存档数据（JSONB，存储引擎 SaveData） */
  data: jsonb("data").notNull(),
  /** 创建时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  /** 更新时间 */
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

// ============= 场景系统 =============

/**
 * 场景表（每张地图 = 一个场景）
 * key 来自地图文件名（如 "map_003_武当山下"）
 * name 来自文件名解析（如 "武当山下"）
 * 类型定义在 @miu2d/types 中
 */
export const scenes = pgTable("scenes", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏 */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 场景唯一标识（地图文件名去掉扩展名，如 map_003_武当山下） */
  key: text("key").notNull(),
  /** 场景显示名（如 武当山下） */
  name: text("name").notNull(),
  /** 地图文件名（如 map_003_武当山下.mmf） */
  mapFileName: text("map_file_name").notNull(),
  /** MMF 地图二进制数据（base64 编码） */
  mmfData: text("mmf_data"),
  /** 额外数据（JSONB，地图尺寸等元信息） */
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("scenes_game_id_key_unique").on(t.gameId, t.key)
]);

/**
 * 场景子项表（脚本/陷阱/NPC/物件）
 * 关联到具体场景，存储脚本内容或 NPC/物件配置
 * kind: script=对话脚本, trap=陷阱脚本, npc=NPC配置, obj=物件配置
 */
export const sceneItems = pgTable("scene_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** 所属游戏 */
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  /** 所属场景 */
  sceneId: uuid("scene_id").references(() => scenes.id, { onDelete: "cascade" }).notNull(),
  /** 子项类型 */
  kind: text("kind", { enum: ["script", "trap", "npc", "obj"] }).notNull(),
  /** 子项唯一标识（文件名去掉扩展名） */
  key: text("key").notNull(),
  /** 显示名 */
  name: text("name").notNull(),
  /** 关联的资源管理器文件 ID（可选） */
  fileId: uuid("file_id"),
  /** 额外数据（JSONB） */
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (t) => [
  unique("scene_items_game_scene_kind_key_unique").on(t.gameId, t.sceneId, t.kind, t.key)
]);
