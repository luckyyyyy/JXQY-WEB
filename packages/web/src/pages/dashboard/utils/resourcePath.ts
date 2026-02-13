/**
 * Dashboard 资源路径工具
 * 统一管理后台/游戏的资源路径
 *
 * 资源路径格式: /game/{gameSlug}/resources/{path}
 * 这个格式在游戏运行时和后台编辑器中都是一致的
 */

/**
 * 获取资源根路径
 * @param gameSlug 游戏标识符
 * @returns 资源根路径，例如 /game/william-chan/resources
 */
export function getResourceRoot(gameSlug: string): string {
  return `/game/${gameSlug}/resources`;
}

/**
 * .asf → .msf 扩展名重写
 * 所有 ASF 资源已统一转换为 MSF 格式存储，URL 必须使用 .msf 扩展名
 */
export function rewriteAsfToMsf(path: string): string {
  return path.replace(/\.asf$/i, ".msf");
}

/**
 * 构建完整的资源 URL
 * @param gameSlug 游戏标识符
 * @param path 资源相对路径（如 asf/goods/item.asf）
 * @returns 完整的资源 URL（自动将 .asf 重写为 .msf）
 */
export function buildResourceUrl(gameSlug: string, path: string): string {
  // 标准化路径
  let normalized = path.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  // .asf → .msf
  normalized = rewriteAsfToMsf(normalized);

  // URL 编码路径中的特殊字符（保留斜杠）
  const encodedPath = normalized
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return `${getResourceRoot(gameSlug)}/${encodedPath}`;
}

/**
 * 构建物品图像资源路径
 * @param gameSlug 游戏标识符
 * @param imagePath 物品图像路径（可能只是文件名，如 tm050-金葵花.asf）
 * @returns 完整的资源 URL
 */
export function buildGoodsImageUrl(
  gameSlug: string,
  imagePath: string | null | undefined
): string | null {
  if (!imagePath) return null;

  let path = imagePath;
  // 如果不包含路径分隔符，添加默认目录
  if (!path.includes("/")) {
    path = `asf/goods/${path}`;
  }

  return buildResourceUrl(gameSlug, path);
}

/**
 * 构建武功图标资源路径
 * @param gameSlug 游戏标识符
 * @param iconPath 武功图标路径
 * @returns 完整的资源 URL
 */
export function buildMagicIconUrl(
  gameSlug: string,
  iconPath: string | null | undefined
): string | null {
  if (!iconPath) return null;

  let path = iconPath;
  // 如果不以 asf/ 开头，添加默认目录
  if (!path.startsWith("asf/")) {
    path = `asf/magic/${path}`;
  }

  return buildResourceUrl(gameSlug, path);
}

/**
 * 构建角色/NPC 图标资源路径
 * @param gameSlug 游戏标识符
 * @param iconPath 角色图标路径
 * @returns 完整的资源 URL
 */
export function buildCharacterIconUrl(
  gameSlug: string,
  iconPath: string | null | undefined
): string | null {
  if (!iconPath) return null;

  let path = iconPath;
  // 如果不包含路径分隔符，添加默认目录
  if (!path.includes("/")) {
    path = `asf/character/${path}`;
  }

  return buildResourceUrl(gameSlug, path);
}

/**
 * 构建 UI 资源路径
 * @param gameSlug 游戏标识符
 * @param uiPath UI 资源路径（如 common/tipbox.asf）
 * @returns 完整的资源 URL
 */
export function buildUIResourceUrl(
  gameSlug: string,
  uiPath: string
): string {
  let path = uiPath;
  // 如果不以 asf/ui/ 开头，添加前缀
  if (!path.startsWith("asf/ui/")) {
    path = `asf/ui/${path}`;
  }

  return buildResourceUrl(gameSlug, path);
}

/**
 * 构建特效资源路径
 * @param gameSlug 游戏标识符
 * @param effectPath 特效资源路径
 * @returns 完整的资源 URL
 */
export function buildEffectResourceUrl(
  gameSlug: string,
  effectPath: string | null | undefined
): string | null {
  if (!effectPath) return null;

  const path = effectPath.startsWith("/") ? effectPath.slice(1) : effectPath;

  // 如果已经是完整路径，直接使用
  if (path.startsWith("asf/") || path.startsWith("content/")) {
    return buildResourceUrl(gameSlug, path.toLowerCase());
  }

  // 否则添加默认目录
  return buildResourceUrl(gameSlug, `asf/effect/${path}`.toLowerCase());
}
