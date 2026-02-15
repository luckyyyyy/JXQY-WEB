/**
 * Storage - 存档系统
 *
 * 包含:
 * - save-types.ts: 存档数据结构定义
 * - game-save-manager.ts: 游戏加载/保存逻辑
 */

export { Loader, type LoaderDependencies, type LoadProgressCallback } from "./game-save-manager";
export * from "./save-types";
