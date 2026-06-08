/**
 * Engine Map Loader — map loading and switching logic
 *
 * Extracted from GameEngine to reduce God Class size.
 * Handles:
 * - Map file resolution (path → sceneKey → MMF binary)
 * - Scene API integration (load from /game/:slug/api/scenes/:key/mmf)
 * - WASM pathfinder initialization after map load
 * - Map MPC/MSF resource loading with progress reporting
 */

import { logger } from "../core/logger";
import { getGameSlug, loadSceneManifest, loadSceneMapMmf } from "../data/game-data-api";
import type { TypedEventEmitter } from "../events/event-emitter";
import type { GameEventMap } from "../events/game-events";
import type { MapBase } from "../map";
import type { MapRenderer } from "../map/map-renderer";
import {
  loadMapMpcs,
  prewarmMpcAtlasTextures,
  releaseMapTextures,
  renderMapToOffscreen,
} from "../map/map-renderer";
import type { MiuMapData } from "../map/types";
import type { Renderer } from "../renderer/renderer";
import type { ScreenEffects } from "../renderer/screen-effects";
import { clearAsfCache } from "../resource/format/asf";
import { parseMMF } from "../resource/format/mmf";
import { resourceLoader } from "../resource/resource-loader";
import { ResourcePath } from "../resource/resource-paths";
import { parseScript } from "../script/parser";
import { Sprite } from "../sprite/sprite";
import { initWasmAiSearch } from "../wasm/wasm-ai-search";
import { initWasmPathfinder, syncStaticObstacles } from "../wasm/wasm-path-finder";
import type { EngineCamera } from "./engine-camera";
import type { GameEngineState } from "./game-engine";
import type { GameManager } from "./game-manager";

// ============= Types =============

export interface EngineMapLoaderDeps {
  readonly getState: () => GameEngineState;
  readonly setState: (state: GameEngineState) => void;
  readonly getMapRenderer: () => MapRenderer;
  readonly getGameManager: () => GameManager;
  readonly getRenderer: () => Renderer | null;
  readonly map: MapBase;
  readonly screenEffects: ScreenEffects;
  readonly events: TypedEventEmitter<GameEventMap>;
  readonly engineCamera: EngineCamera;
  readonly emitLoadProgress: (progress: number, text: string) => void;
  readonly getMapLoadProgressCallback: () => ((progress: number, text: string) => void) | null;
}

// ============= Map Loader =============

/**
 * 处理地图切换
 *
 * 状态管理：
 * - 初始加载时：外部流程已设置 state="loading"，此函数不改变状态
 * - 游戏内切换：当前 state="running"，临时切换到 loading 显示进度，完成后恢复
 */
export async function handleMapChange(
  deps: EngineMapLoaderDeps,
  mapPath: string
): Promise<MiuMapData> {
  const {
    getState,
    setState,
    getMapRenderer,
    getGameManager,
    getRenderer,
    map,
    screenEffects,
    events,
    engineCamera,
    emitLoadProgress,
    getMapLoadProgressCallback,
  } = deps;

  // 确保屏幕是黑的，防止在地图加载过程中看到摄像机移动
  if (!screenEffects.isScreenBlack()) {
    screenEffects.setFadeTransparency(1);
  }

  const wasRunning = getState() === "running";
  const progressCallback = getMapLoadProgressCallback();

  if (wasRunning) {
    setState("loading");
    emitLoadProgress(0, "加载地图...");
  } else if (progressCallback) {
    progressCallback(0, "加载地图...");
  }

  // 构建完整地图路径（MMF 格式）
  let fullMapPath = mapPath;
  if (!mapPath.startsWith("/")) {
    const mapName = mapPath.replace(/\.(map|mmf)$/i, "");
    fullMapPath = ResourcePath.map(`${mapName}.mmf`);
  }

  logger.debug(`[EngineMapLoader] Loading map: ${fullMapPath}`);

  try {
    const mapData = await loadMapFromSceneApi(fullMapPath);
    if (mapData) {
      const mapName =
        fullMapPath
          .split("/")
          .pop()
          ?.replace(/\.(map|mmf)$/i, "") || "";

      // 让 GameManager 在摄像机计算前就拥有 mapData
      const gm = getGameManager();
      gm.setMapData(mapData);

      // 初始化 WASM 寻路器并同步静态障碍物
      await initWasmPathfinder(mapData.mapColumnCounts, mapData.mapRowCounts);
      syncStaticObstacles(mapData.barriers, mapData.mapColumnCounts, mapData.mapRowCounts);

      // 初始化 WASM AI 目标搜索（共享内存 SoA，与地图无关，幂等）
      await initWasmAiSearch();

      // 进入地图时初始化陷阱状态：
      // - 重建 _mapTrapTable[mapName]（MMF 基础数据）
      // - _snapshotTrap = clone(_groupTrap[mapName])  ← group 是跨地图常驻
      // 读档时 Phase 1 已 resetTrapState() 清空全部，Phase 2 进入这里时 _groupTrap 还是空的；
      // Phase 4 的 loadTrapsFromSave 会再覆盖 _groupTrap 和 _snapshotTrap 为存档值。
      map.initTrapsForMap(mapName);

      // 更新地图渲染器
      const mapRenderer = getMapRenderer();
      mapRenderer.mapData = mapData;

      // 释放旧地图的 GPU 纹理
      const renderer = getRenderer();
      if (renderer) {
        releaseMapTextures(mapRenderer, renderer);
      }

      // 清理 ASF sprite 缓存：atlas canvas 是 CPU+GPU 双份内存大户
      // （单文件最大 38MB，中都地图 ~100 个 NPC × 多个动作状态 ≈ GB 级），
      // 不清理会跨地图累积，在 iPad 等内存受限设备上导致进程被杀。
      // ASF 二进制数据保留在 resourceLoader binary cache，重进地图时 WASM 重新解码构建。
      Sprite.clearCache();
      clearAsfCache();

      // 加载地图 MSF 资源
      await loadMapMpcs(mapRenderer, mapData, mapName, (progress) => {
        if (wasRunning) {
          const mappedProgress = Math.round(progress * 100);
          emitLoadProgress(mappedProgress, "加载地图资源...");
        } else if (progressCallback) {
          progressCallback(progress, "加载地图资源...");
        }
      });

      // 在 atlas 像素数据被释放前，渲染全图到离屏 canvas（小地图用）
      mapRenderer.minimapCanvas = renderMapToOffscreen(mapRenderer);

      // 预热 MPC atlas GPU 纹理并释放 CPU 侧 canvas 像素数据（节省 ~130MB RAM）
      if (renderer) {
        prewarmMpcAtlasTextures(mapRenderer.mpcAtlases, renderer);
      }

      // 更新游戏管理器的地图名称
      gm.setCurrentMapName(mapName);

      // 地图加载后立即居中摄像机到玩家位置
      engineCamera.centerCameraOnPlayer();

      // 发送地图加载事件
      events.emit(
        "game:map:load" as keyof GameEventMap,
        {
          mapPath: fullMapPath,
          mapName,
        } as GameEventMap[keyof GameEventMap]
      );

      logger.log(`[EngineMapLoader] Map loaded: ${mapName}`);

      if (wasRunning) {
        setState("running");
        emitLoadProgress(100, "地图加载完成");
      }

      return mapData;
    }

    if (wasRunning) {
      setState("running");
      emitLoadProgress(100, "");
    }
    throw new Error(`Failed to load map: ${fullMapPath}`);
  } catch (error) {
    logger.error(`[EngineMapLoader] Failed to load map: ${fullMapPath}`, error);
    if (wasRunning) {
      setState("running");
      emitLoadProgress(100, "");
    }
    throw error;
  }
}

/**
 * 从 Scene API 加载 MMF 地图二进制数据，并并发请求资源清单
 *
 * 从地图路径提取 sceneKey（如 "map_003_武当山下"），
 * 请求 /game/:gameSlug/api/scenes/:sceneKey/mmf
 * 同时请求 /game/:gameSlug/api/scenes/:sceneKey/manifest，
 * 将 manifest.missing 预置到 resourceLoader.failedPaths，消除无效 404 请求。
 */
async function loadMapFromSceneApi(fullMapPath: string): Promise<MiuMapData | null> {
  const gameSlug = getGameSlug();
  if (!gameSlug) return null;

  const fileName = fullMapPath.split("/").pop() || "";
  const sceneKey = fileName.replace(/\.(mmf|map)$/i, "");
  if (!sceneKey) return null;

  try {
    // 并发请求 MMF 二进制和资源清单
    const [buffer, manifest] = await Promise.all([
      loadSceneMapMmf(sceneKey),
      loadSceneManifest(sceneKey),
    ]);

    // 将已知缺失路径写入失败缓存（跳过无效 404 网络请求）
    if (manifest?.missing && manifest.missing.length > 0) {
      resourceLoader.prewarmMissing(manifest.missing);
    }

    // 将场景脚本及陷阱脚本分别预热到 parsedCache（随 manifest 下发，避免去文件存储查找）
    const allEntries: [string, string][] = [
      ...Object.entries(manifest?.scripts ?? {}),
      ...Object.entries(manifest?.traps ?? {}),
    ];
    for (const [fileName, content] of allEntries) {
      const url = `${ResourcePath.scriptMap(sceneKey)}/${fileName}`;
      const relPath = `script/map/${sceneKey}/${fileName}`;
      resourceLoader.prewarmCache(url, parseScript(content, relPath), "script");
    }
    if (manifest) {
      logger.log(
        `[EngineMapLoader] Manifest: ${manifest.tiles.length} tiles, ${manifest.missing?.length ?? 0} missing, ${Object.keys(manifest.scripts).length} scripts + ${Object.keys(manifest.traps).length} traps prewarmed`
      );
    }

    if (!buffer) return null;

    const mapData = parseMMF(buffer, fullMapPath);
    if (mapData) {
      logger.log(`[EngineMapLoader] Map loaded from Scene API: ${sceneKey}`);
    }
    return mapData;
  } catch (_error) {
    return null;
  }
}
