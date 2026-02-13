/**
 * Resource Module - 资源管理
 *
 * 结构:
 * - format/         格式解析器 (asf, mpc, shd, xnb, mmf, map-parser)
 * - resource-loader 统一资源加载器
 * - resource-paths  资源路径配置
 * - cache-registry  缓存注册表基础设施
 */
export * from "./format";
export * from "./cache-registry";
export * from "./resource-loader";
export * from "./resource-paths";
