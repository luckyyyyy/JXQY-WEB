/**
 * Storage - 存档系统
 *
 * 包含:
 * - storage.ts: 存档数据结构定义
 * - loader.ts: 游戏加载/保存逻辑
 */
export * from "./storage";
export { Loader, type LoadProgressCallback, type LoaderDependencies } from "./loader";
