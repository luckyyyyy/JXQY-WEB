/**
 * 配置模块统一导出
 */

export {
  // 配置接口和函数
  type ResourcePathsConfig,
  setResourcePaths,
  getResourcePaths,
  getResourceRoot,
  resetResourcePaths,
  // 目录结构
  ResourceDirs,
  // 路径构建器
  buildPath,
  extractRelativePath,
  ResourcePath,
  // 预定义路径
  DefaultPaths,
  // 工具函数
  isResourcePath,
  ensureResourcePath,
} from "./resourcePaths";
