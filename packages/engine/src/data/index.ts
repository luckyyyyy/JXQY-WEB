/**
 * Data Module - 游戏业务数据加载与缓存
 *
 * 与 resource/ 模块（底层 fetch + 二进制解析）分离，
 * 专注于从服务端 API 加载游戏配置和业务数据（NPC/物品/武功/等级/玩家/场景等）。
 */
export * from "./game-data-api";
