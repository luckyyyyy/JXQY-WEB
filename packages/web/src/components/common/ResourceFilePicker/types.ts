/**
 * 资源文件选择器类型定义
 */

export type ResourceFileType = "asf" | "audio" | "script" | "ini" | "other";

/**
 * 资源文件的默认基础路径配置
 */
export const ResourceBasePaths: Record<string, string> = {
  // ASF 文件
  image: "asf/magic",           // 武功主图像
  icon: "asf/magic",            // 武功图标
  flyingImage: "asf/effect",    // 飞行特效
  vanishImage: "asf/effect",    // 消失特效
  superModeImage: "asf/effect", // 超级模式特效
  leapImage: "asf/effect",      // 跳跃特效
  actionFile: "asf/character",  // 动作文件

  // 音频文件
  flyingSound: "content/sound", // 飞行音效
  vanishSound: "content/sound", // 消失音效

  // NPC 动画资源（asf/character/）
  npc_stand_image: "asf/character",
  npc_stand1_image: "asf/character",
  npc_walk_image: "asf/character",
  npc_run_image: "asf/character",
  npc_jump_image: "asf/character",
  npc_fightStand_image: "asf/character",
  npc_fightWalk_image: "asf/character",
  npc_fightRun_image: "asf/character",
  npc_fightJump_image: "asf/character",
  npc_attack_image: "asf/character",
  npc_attack1_image: "asf/character",
  npc_attack2_image: "asf/character",
  npc_hurt_image: "asf/character",
  npc_death_image: "asf/character",
  npc_sit_image: "asf/character",
  npc_special1_image: "asf/character",
  npc_special2_image: "asf/character",
  // NpcResource 页面使用的字段名（npcResource_xxx_image）
  npcResource_stand_image: "asf/character",
  npcResource_stand1_image: "asf/character",
  npcResource_walk_image: "asf/character",
  npcResource_run_image: "asf/character",
  npcResource_jump_image: "asf/character",
  npcResource_fightStand_image: "asf/character",
  npcResource_fightWalk_image: "asf/character",
  npcResource_fightRun_image: "asf/character",
  npcResource_fightJump_image: "asf/character",
  npcResource_attack_image: "asf/character",
  npcResource_attack1_image: "asf/character",
  npcResource_attack2_image: "asf/character",
  npcResource_hurt_image: "asf/character",
  npcResource_death_image: "asf/character",
  npcResource_sit_image: "asf/character",
  npcResource_special1_image: "asf/character",
  npcResource_special2_image: "asf/character",

  // NPC 音效资源（content/sound/）
  npc_stand_sound: "content/sound",
  npc_stand1_sound: "content/sound",
  npc_walk_sound: "content/sound",
  npc_run_sound: "content/sound",
  npc_jump_sound: "content/sound",
  npc_fightStand_sound: "content/sound",
  npc_fightWalk_sound: "content/sound",
  npc_fightRun_sound: "content/sound",
  npc_fightJump_sound: "content/sound",
  npc_attack_sound: "content/sound",
  npc_attack1_sound: "content/sound",
  npc_attack2_sound: "content/sound",
  npc_hurt_sound: "content/sound",
  npc_death_sound: "content/sound",
  npc_sit_sound: "content/sound",
  npc_special1_sound: "content/sound",
  npc_special2_sound: "content/sound",
  // NpcResource 页面使用的字段名（npcResource_xxx_sound）
  npcResource_stand_sound: "content/sound",
  npcResource_stand1_sound: "content/sound",
  npcResource_walk_sound: "content/sound",
  npcResource_run_sound: "content/sound",
  npcResource_jump_sound: "content/sound",
  npcResource_fightStand_sound: "content/sound",
  npcResource_fightWalk_sound: "content/sound",
  npcResource_fightRun_sound: "content/sound",
  npcResource_fightJump_sound: "content/sound",
  npcResource_attack_sound: "content/sound",
  npcResource_attack1_sound: "content/sound",
  npcResource_attack2_sound: "content/sound",
  npcResource_hurt_sound: "content/sound",
  npcResource_death_sound: "content/sound",
  npcResource_sit_sound: "content/sound",
  npcResource_special1_sound: "content/sound",
  npcResource_special2_sound: "content/sound",

  // Obj 动画资源（asf/object/）
  obj_common_image: "asf/object",
  obj_open_image: "asf/object",
  obj_opened_image: "asf/object",
  obj_closed_image: "asf/object",
  // ObjResource 页面使用的字段名（objResource_xxx_image）
  objResource_common_image: "asf/object",
  objResource_open_image: "asf/object",
  objResource_opened_image: "asf/object",
  objResource_closed_image: "asf/object",

  // Obj 音效资源（content/sound/）
  obj_common_sound: "content/sound",
  obj_open_sound: "content/sound",
  obj_opened_sound: "content/sound",
  obj_closed_sound: "content/sound",

  // 头像资源（asf/portrait/）
  portrait_image: "asf/portrait",
  // ObjResource 页面使用的字段名（objResource_xxx_sound）
  objResource_common_sound: "content/sound",
  objResource_open_sound: "content/sound",
  objResource_opened_sound: "content/sound",
  objResource_closed_sound: "content/sound",

  // 脚本文件（仅存储文件名，引擎根据地图动态查找）
  // 路径查找优先级：script/map/{mapName}/ -> script/common/
  scriptFile: "",
  deathScript: "",
  npc_scriptFile: "",
  npc_deathScript: "",

  // INI 配置文件（仅存储文件名）
  // 路径查找优先级：ini/obj/
  bodyIni: "",
  npc_bodyIni: "",

  // 通用
  default: "",
} as const;

/**
 * 脚本文件的搜索目录
 * 引擎会按顺序尝试这些目录
 */
export const ScriptSearchPaths = [
  "script/common",
  "script/map",  // 实际使用时需要加上地图名
] as const;

/**
 * INI 配置文件的搜索目录
 */
export const IniSearchPaths = [
  "ini/obj",
] as const;

/**
 * 根据字段名获取文件类型
 */
export function getResourceFileType(fieldName: string, fileName?: string): ResourceFileType {
  if (!fileName) return "other";

  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "asf" || ext === "msf" || ext === "mpc") {
    return "asf";
  }

  // .xnb 是 XNA 打包的音频格式
  if (ext === "wav" || ext === "ogg" || ext === "mp3" || ext === "xnb") {
    return "audio";
  }

  // 脚本文件
  if (ext === "txt") {
    return "script";
  }

  // INI 配置文件
  if (ext === "ini") {
    return "ini";
  }

  // 根据字段名判断
  if (fieldName.includes("_sound") || fieldName.includes("Sound")) {
    return "audio";
  }
  if (fieldName.includes("_image") || fieldName.includes("Image")) {
    return "asf";
  }
  if (fieldName.includes("script") || fieldName.includes("Script")) {
    return "script";
  }
  if (fieldName.includes("Ini") || fieldName.includes("_ini")) {
    return "ini";
  }

  return "other";
}

/**
 * 获取字段的默认基础路径
 */
export function getBasePath(fieldName: string): string {
  return ResourceBasePaths[fieldName] ?? ResourceBasePaths.default;
}

/**
 * NPC/角色 ASF 的搜索路径（按优先级）
 * 引擎会按顺序尝试这些目录
 */
export const CharacterAsfSearchPaths = [
  "asf/character",
  "asf/interlude",
] as const;

/**
 * 构建完整的资源路径
 * @param fieldName 字段名（用于获取默认基础路径）
 * @param value 当前值（可能是相对路径或绝对路径）
 * 注意：返回的路径已经是小写
 */
export function buildResourcePath(fieldName: string, value: string): string {
  if (!value) return "";

  let result: string;

  // 规范化路径分隔符
  let normalizedValue = value.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (normalizedValue.startsWith("/")) {
    normalizedValue = normalizedValue.slice(1);
  }

  // 获取文件名（脚本和 INI 可能只存储文件名）
  const fileName = normalizedValue.split("/").pop() || normalizedValue;

  // 判断是否是绝对路径
  const lowerValue = normalizedValue.toLowerCase();
  if (lowerValue.startsWith("asf/") || lowerValue.startsWith("mpc/") || lowerValue.startsWith("content/") || lowerValue.startsWith("script/") || lowerValue.startsWith("ini/")) {
    result = normalizedValue;
  } else {
    // 否则添加默认基础路径
    let basePath = getBasePath(fieldName);

    // 特殊处理：如果是 NPC/Obj 的 image 字段，根据文件扩展名判断路径
    // .mpc 文件在 mpc/character/ 或 mpc/object/，.asf 文件在 asf/character/ 或 asf/object/
    if (basePath === "asf/character" && lowerValue.endsWith(".mpc")) {
      basePath = "mpc/character";
    } else if (basePath === "asf/object" && lowerValue.endsWith(".mpc")) {
      basePath = "mpc/object";
    }

    result = basePath ? `${basePath}/${normalizedValue}` : normalizedValue;
  }

  // 对于音效文件，将 .wav 转换为 .xnb
  if (fieldName.includes("_sound") || fieldName.includes("Sound")) {
    result = result.replace(/\.wav$/i, ".xnb");
  }

  // 统一转小写
  return result.toLowerCase();
}

/**
 * 构建角色资源的所有可能路径（用于预览时依次尝试）
 * @param fieldName 字段名
 * @param value 文件名或相对路径
 * @returns 可能路径数组，按优先级排序
 */
export function buildCharacterResourcePaths(fieldName: string, value: string): string[] {
  if (!value) return [];

  // 规范化路径分隔符
  let normalizedValue = value.replace(/\\/g, "/");

  // 移除开头的斜杠
  if (normalizedValue.startsWith("/")) {
    normalizedValue = normalizedValue.slice(1);
  }

  const lowerValue = normalizedValue.toLowerCase();

  // 如果已经是完整路径，直接返回
  if (lowerValue.startsWith("asf/") || lowerValue.startsWith("mpc/") || lowerValue.startsWith("content/")) {
    return [lowerValue];
  }

  const basePath = getBasePath(fieldName);

  // 如果是角色动画资源，需要尝试多个目录
  if (basePath === "asf/character") {
    if (lowerValue.endsWith(".mpc")) {
      return [`mpc/character/${lowerValue}`];
    }
    // ASF 文件尝试 character 和 interlude 两个目录
    return CharacterAsfSearchPaths.map(dir => `${dir}/${lowerValue}`);
  }

  // 其他资源使用单一路径
  const result = basePath ? `${basePath}/${normalizedValue}` : normalizedValue;
  return [result.toLowerCase()];
}

/**
 * 构建脚本文件的预览路径
 * 脚本文件存储的是文件名，需要尝试多个位置
 * @returns 优先使用 script/common/{fileName}
 */
export function buildScriptPreviewPath(value: string): string {
  if (!value) return "";

  // 获取文件名
  const normalized = value.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || normalized;

  // 如果已经有完整路径，直接返回
  if (normalized.toLowerCase().startsWith("script/")) {
    return normalized.toLowerCase();
  }

  // 默认使用 script/common/
  return `script/common/${fileName}`.toLowerCase();
}

/**
 * 构建 INI 配置文件的预览路径
 * @returns 使用 ini/obj/{fileName}
 */
export function buildIniPreviewPath(value: string): string {
  if (!value) return "";

  // 获取文件名
  const normalized = value.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || normalized;

  // 如果已经有完整路径，直接返回
  if (normalized.toLowerCase().startsWith("ini/")) {
    return normalized.toLowerCase();
  }

  // 默认使用 ini/obj/
  return `ini/obj/${fileName}`.toLowerCase();
}

/**
 * 获取资源的下载 URL
 * 注意：路径会自动转换为小写，.asf 扩展名会重写为 .msf
 */
export { buildResourceUrl as getResourceUrl } from "../../../pages/dashboard/utils/resourcePath";
