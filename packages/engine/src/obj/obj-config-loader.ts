/**
 * OBJ Config Loader - 从 API 缓存获取物体配置
 *
 * 替代原有的 INI 文件加载，从统一数据加载器获取配置。
 */

import { getObjsData, type ObjData } from "../data/game-data-api";
import { createConfigCache } from "../resource/cache-registry";
import { ObjKind } from "./types";

// ========== 类型定义 ==========

export interface ObjResInfo {
  imagePath: string;
  soundPath: string;
}

export interface ObjConfig {
  name: string;
  kind: number;
  image: string;
  shadow: string;
  script: string;
  scriptRight: string;
  sound: string;
  switchSound: string;
  triggerRadius: number;
  interval: number;
  level: number;
  height: number;
  dir: number;
  frame: number;
  offX: number;
  offY: number;
  damage: number;
  lum: number;
  canInteractDirectly: number;
  scriptFileJustTouch: number;
  timerScriptFile: string;
  timerScriptInterval: number;
  reviveNpcIni: string;
  wavFile: string;
  /** 移除延迟（毫秒），>0 表示到时后自动移除 */
  millisecondsToRemove: number;
  /** objres 文件名（如 body-卓非凡.ini），用于存档保存/加载时查找纹理 */
  objFile: string;
}

// ========== 缓存 ==========

const OBJ_KEY_PREFIXES = ["ini/obj/", "ini/objres/"] as const;

// ========== Kind 映射 ==========

const KIND_MAP: Record<string, number> = {
  Dynamic: ObjKind.Dynamic,
  Static: ObjKind.Static,
  Body: ObjKind.Body,
  LoopingSound: ObjKind.LoopingSound,
  RandSound: ObjKind.RandSound,
  Door: ObjKind.Door,
  Trap: ObjKind.Trap,
  Drop: ObjKind.Drop,
};

// ========== API -> ObjConfig 转换 ==========

function convertApiObjToConfig(api: ObjData): ObjConfig {
  return {
    name: api.name ?? "",
    kind: KIND_MAP[api.kind] ?? ObjKind.Dynamic,
    objFile: api.objFile ?? "",
    // 从 resources.common 读取资源
    image: api.resources?.common?.image ?? "",
    shadow: "",
    script: api.scriptFile ?? "",
    scriptRight: api.scriptFileRight ?? "",
    sound: api.resources?.common?.sound ?? "",
    switchSound: api.switchSound ?? "",
    triggerRadius: api.triggerRadius ?? 0,
    interval: api.interval ?? 0,
    level: api.level ?? 0,
    height: api.height ?? 0,
    dir: api.dir ?? 0,
    frame: api.frame ?? 0,
    offX: api.offX ?? 0,
    offY: api.offY ?? 0,
    damage: api.damage ?? 0,
    lum: api.lum ?? 0,
    canInteractDirectly: api.canInteractDirectly ?? 0,
    scriptFileJustTouch: api.scriptFileJustTouch ?? 0,
    timerScriptFile: api.timerScriptFile ?? "",
    timerScriptInterval: api.timerScriptInterval ?? 3000,
    reviveNpcIni: api.reviveNpcIni ?? "",
    wavFile: api.wavFile ?? "",
    millisecondsToRemove: api.millisecondsToRemove ?? 0,
  };
}

// ========== 缓存（使用通用 CacheRegistry） ==========

type ObjApiData = NonNullable<ReturnType<typeof getObjsData>>;

const objConfigCacheStore = createConfigCache<ObjApiData, ObjConfig>({
  name: "ObjConfig",
  keyPrefixes: OBJ_KEY_PREFIXES,
  getData: getObjsData,
  build(data, cache, normalizeKey) {
    for (const api of data.objs) {
      cache.set(normalizeKey(api.key), convertApiObjToConfig(api));
    }
  },
});

const objResCacheStore = createConfigCache<ObjApiData, ObjResInfo>({
  name: "ObjRes",
  keyPrefixes: OBJ_KEY_PREFIXES,
  getData: getObjsData,
  build(data, cache, normalizeKey) {
    for (const resData of data.resources) {
      cache.set(normalizeKey(resData.key), {
        imagePath: resData.resources?.common?.image ?? "",
        soundPath: resData.resources?.common?.sound ?? "",
      });
    }
    // 为有 objFile 的 OBJ 创建别名（使 obj.key 也能查到资源）
    for (const api of data.objs) {
      const objKey = normalizeKey(api.key);
      if (!cache.has(objKey) && api.objFile) {
        const res = cache.get(normalizeKey(api.objFile));
        if (res) cache.set(objKey, res);
      }
    }
  },
});

// ========== 公共 API ==========

export function getObjConfigFromCache(fileName: string): ObjConfig | null {
  return objConfigCacheStore.get(fileName);
}

/** 获取 ObjRes 资源映射 */
export function getObjResFromCache(fileName: string): ObjResInfo | null {
  return objResCacheStore.get(fileName);
}
