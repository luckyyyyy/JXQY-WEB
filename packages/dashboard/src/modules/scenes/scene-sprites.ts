/**
 * 精灵加载工具：NPC / OBJ 精灵资源解析和缓存
 */
import { loadCharacterImage, loadNpcRes } from "@miu2d/engine/character";
import { type GameDataResponse, setGameData } from "@miu2d/engine/data/game-data-api";
import { getObjResFromCache } from "@miu2d/engine/obj/obj-config-loader";
import { setResourcePaths } from "@miu2d/engine/resource";
import type { AsfData } from "@miu2d/engine/resource/format/asf";
import { getFrameCanvas, loadAsf } from "@miu2d/engine/resource/format/asf";
import { ResourcePath } from "@miu2d/engine/resource/resource-paths";
import { trpc } from "@miu2d/shared";
import type { SceneNpcEntry, SceneObjEntry } from "@miu2d/types";
import { useEffect, useRef, useState } from "react";

export interface SpriteInfo {
  /** 所有帧的画布（仅第一方向，作为回退） */
  frames: HTMLCanvasElement[];
  /** 帧间隔（毫秒） */
  interval: number;
  offsetX: number;
  offsetY: number;
  /** ASF 数据（用于 WebGL atlas 渲染） */
  asf: AsfData;
  /** 是否为 OBJ 类型 */
  isObj?: boolean;
  /** 行走状态 ASF 数据（NPC 专用，用于行走动画） */
  walkAsf?: AsfData;
}

/** 将 AsfData 转为 SpriteInfo（取第一方向所有帧 + 保留 ASF 引用） */
export function asfToSpriteInfo(asf: AsfData, isObj = false): SpriteInfo {
  const fpd = asf.framesPerDirection || asf.frames.length;
  const frames = asf.frames.slice(0, fpd).map((f) => getFrameCanvas(f));
  return {
    frames,
    interval: asf.interval || 150,
    offsetX: asf.left,
    offsetY: asf.bottom,
    asf,
    isObj,
  };
}

/** 加载 NPC 精灵：从引擎缓存中获取 NpcRes → 取 Stand 状态 → loadCharacterImage */
export async function loadNpcSprite(npcIni: string): Promise<SpriteInfo | null> {
  try {
    const stateMap = await loadNpcRes(npcIni);
    if (!stateMap) return null;
    const standInfo = stateMap.get(0) ?? stateMap.values().next().value;
    if (!standInfo?.imagePath) return null;
    const asf = await loadCharacterImage(standInfo.imagePath);
    if (!asf || asf.frames.length === 0) return null;
    const info = asfToSpriteInfo(asf, false);
    const walkInfo = stateMap.get(2);
    if (walkInfo?.imagePath) {
      try {
        const walkAsf = await loadCharacterImage(walkInfo.imagePath);
        if (walkAsf && walkAsf.frames.length > 0) {
          info.walkAsf = walkAsf;
        }
      } catch {
        /* walk ASF optional, ignore */
      }
    }
    return info;
  } catch (e) {
    console.warn("[loadNpcSprite] failed:", npcIni, e);
    return null;
  }
}

/** 加载 OBJ 精灵：从引擎缓存中获取 ObjRes → 取 imagePath → loadAsf */
export async function loadObjSprite(objFile: string): Promise<SpriteInfo | null> {
  try {
    const resInfo = getObjResFromCache(objFile);
    if (!resInfo?.imagePath) return null;
    const asf = await loadAsf(ResourcePath.asfObject(resInfo.imagePath));
    if (!asf || asf.frames.length === 0) return null;
    return asfToSpriteInfo(asf, true);
  } catch (e) {
    console.warn("[loadObjSprite] failed:", objFile, e);
    return null;
  }
}

/**
 * Hook: 通过 tRPC data.getAll 加载游戏数据，
 * 然后注入引擎缓存，使 loadNpcRes/getObjConfigFromCache 可直接使用
 */
export function useGameData(gameSlug: string | undefined) {
  const [ready, setReady] = useState(false);
  const { data: gameData } = trpc.data.getAll.useQuery(
    { gameSlug: gameSlug! },
    { enabled: !!gameSlug }
  );
  useEffect(() => {
    if (!gameSlug || !gameData) return;
    setResourcePaths({ root: `/game/${gameSlug}/resources` });
    setGameData(gameSlug, gameData as GameDataResponse);
    setReady(true);
  }, [gameSlug, gameData]);
  return ready;
}

/**
 * Hook: 管理 NPC/OBJ 精灵的加载缓存
 * 使用 Map<cacheKey, SpriteInfo> 避免重复加载
 */
export function useSpriteCache(
  npcEntries: SceneNpcEntry[],
  objEntries: SceneObjEntry[],
  gameDataReady: boolean
) {
  const [spriteCache, setSpriteCache] = useState<Map<string, SpriteInfo>>(new Map());
  const loadingRef = useRef(new Set<string>());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!gameDataReady) return;

    const keysNeeded = new Set<string>();
    for (const e of npcEntries) {
      if (e.npcIni) keysNeeded.add(`npc:${e.npcIni}`);
    }
    for (const e of objEntries) {
      if (e.objFile) keysNeeded.add(`obj:${e.objFile}`);
    }

    for (const key of keysNeeded) {
      if (spriteCache.has(key) || loadingRef.current.has(key)) continue;
      loadingRef.current.add(key);

      const [type, id] = key.split(":", 2);
      const promise = type === "npc" ? loadNpcSprite(id) : loadObjSprite(id);
      promise.then((info) => {
        if (!mountedRef.current) return;
        loadingRef.current.delete(key);
        if (info) {
          setSpriteCache((prev) => {
            const next = new Map(prev);
            next.set(key, info);
            return next;
          });
        }
      });
    }
  }, [npcEntries, objEntries, gameDataReady, spriteCache]);

  return spriteCache;
}
