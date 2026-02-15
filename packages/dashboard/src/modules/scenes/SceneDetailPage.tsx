/**
 * 场景详情页
 *
 * SceneDetailPage: 外部 wrapper — 提供 SceneEntriesProvider context
 * SceneDetailContent: 核心内容 — 地图预览 + 右侧 tab 面板（NPC/OBJ/脚本/陷阱）
 */
import type { MiuMapData } from "@miu2d/engine/map/types";
import { dtoToMiuMapData } from "@miu2d/engine/resource/format/mmf-dto";
import { trpc, useToast } from "@miu2d/shared";
import type {
  NpcListItem,
  ObjListItem,
  SceneData,
  SceneNpcEntry,
  SceneObjEntry,
} from "@miu2d/types";
import { NpcKindValues, NpcRelationValues, ObjKindValues } from "@miu2d/types";
import type { MapMarker, MapViewerHandle, SidePanelTab } from "@miu2d/viewer";
import { MapViewer } from "@miu2d/viewer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EntitySelectDialog } from "../../components/common/pickers/EntitySelectDialog";
import { useDashboard } from "../../DashboardContext";
import { useNpcSimulation } from "../../hooks/useNpcSimulation";
import { DashboardIcons } from "../../icons";
import { ContextMenu } from "../fileTree/ContextMenu";
import { ConfirmDialog } from "../fileTree/Dialogs";
import { MapDataPanel } from "./MapDataPanel";
import { SceneEntriesProvider, useSceneEntries } from "./SceneEntriesContext";
import { SceneItemEditorPanel } from "./SceneItemEditorPanel";
import { createDefaultNpcEntry, createDefaultObjEntry } from "./scene-constants";
import { useGameData, useSpriteCache } from "./scene-sprites";

// ============= 外部 Wrapper =============

export function SceneDetailPage() {
  const { sceneId } = useParams();
  const [searchParams] = useSearchParams();
  const npcKey = searchParams.get("npcKey");
  const objKey = searchParams.get("objKey");
  const scriptKey = searchParams.get("scriptKey");
  const trapKey = searchParams.get("trapKey");
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: scene } = trpc.scene.get.useQuery(
    { gameId: gameId!, id: sceneId! },
    { enabled: !!gameId && !!sceneId }
  );

  const sceneData = useMemo(() => (scene?.data ?? {}) as SceneData, [scene?.data]);

  return (
    <SceneEntriesProvider
      sceneData={sceneData}
      npcKey={npcKey}
      objKey={objKey}
      scriptKey={scriptKey}
      trapKey={trapKey}
    >
      <SceneDetailContent />
    </SceneEntriesProvider>
  );
}

// ============= 核心内容 =============

function SceneDetailContent() {
  const { sceneId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const npcKey = searchParams.get("npcKey");
  const objKey = searchParams.get("objKey");
  const scriptKey = searchParams.get("scriptKey");
  const trapKey = searchParams.get("trapKey");
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;
  const gameSlug = currentGame?.slug;

  const { data: scene, refetch: refetchScene } = trpc.scene.get.useQuery(
    { gameId: gameId!, id: sceneId! },
    { enabled: !!gameId && !!sceneId }
  );

  // 从 Context 获取条目（唯一数据源）
  const { npcEntries, setNpcEntries, objEntries, setObjEntries, isAnyDirty } = useSceneEntries();

  // 地图数据加载
  const [mapData, setMapData] = useState<MiuMapData | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  /** 手动选中高亮的 trap indices（从 MapDataPanel 选择） */
  const [panelHighlightTraps, setPanelHighlightTraps] = useState<number[] | null>(null);

  /** 用户自定义陷阱号码（记住上次输入） */
  const [customTrapIndex, setCustomTrapIndex] = useState("");
  /** 用户自定义障碍号码（记住上次输入） */
  const [customBarrierValue, setCustomBarrierValue] = useState("");
  /** 自定义陷阱号码输入弹窗（保存 tileX/tileY 以避免依赖 mapContextMenu） */
  const [trapInputDialog, setTrapInputDialog] = useState<{
    open: boolean;
    value: string;
    tileX: number;
    tileY: number;
  } | null>(null);
  /** 自定义障碍号码输入弹窗（保存 tileX/tileY 以避免依赖 mapContextMenu） */
  const [barrierInputDialog, setBarrierInputDialog] = useState<{
    open: boolean;
    value: string;
    tileX: number;
    tileY: number;
  } | null>(null);

  const mapName = scene?.mapFileName?.replace(/\.(map|mmf)$/i, "") ?? null;
  const resourceRoot = gameSlug ? `/game/${gameSlug}/resources` : undefined;

  const mapViewerRef = useRef<MapViewerHandle>(null);

  // 右侧面板 tab
  type RightTab = "map" | "npc" | "obj" | "script" | "trap";
  const [rightTab, setRightTab] = useState<RightTab>("map");
  const savedCameraRef = useRef<{ mapX: number; mapY: number } | null>(null);

  // NPC/OBJ 选中索引（独立，互不干扰）
  const [selectedNpcIdx, setSelectedNpcIdx] = useState<number | null>(null);
  const [selectedObjIdx, setSelectedObjIdx] = useState<number | null>(null);
  const npcCountRef = useRef(0);
  npcCountRef.current = npcEntries.length;

  // 场景切换时清除旧状态（包括 rightTab 重置）
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset all state when sceneId changes
  useEffect(() => {
    setMapData(null);
    setMapError(null);
    setMapLoading(false);
    setSelectedNpcIdx(null);
    setSelectedObjIdx(null);
    setRightTab("map");
  }, [sceneId]);

  // NPC/OBJ 文件切换时重置选中索引
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when npcKey changes
  useEffect(() => {
    setSelectedNpcIdx(null);
  }, [npcKey]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset when objKey changes
  useEffect(() => {
    setSelectedObjIdx(null);
  }, [objKey]);

  // 侧边栏选中子项时自动切换到对应 tab
  const prevKeysRef = useRef({ npcKey, objKey, scriptKey, trapKey });
  useEffect(() => {
    const prev = prevKeysRef.current;
    if (npcKey && npcKey !== prev.npcKey) setRightTab("npc");
    else if (objKey && objKey !== prev.objKey) setRightTab("obj");
    else if (scriptKey && scriptKey !== prev.scriptKey) setRightTab("script");
    else if (trapKey && trapKey !== prev.trapKey) setRightTab("trap");
    prevKeysRef.current = { npcKey, objKey, scriptKey, trapKey };
  }, [npcKey, objKey, scriptKey, trapKey]);

  // 导航拦截：有未保存修改时，刷新/关闭页面弹出浏览器原生提示
  useEffect(() => {
    if (!isAnyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isAnyDirty]);

  // 侧边栏点击拦截：dirty 时阻止导航
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const isAnyDirtyRef = useRef(false);
  isAnyDirtyRef.current = isAnyDirty;
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!isAnyDirtyRef.current) return;
      const anchor = (e.target as HTMLElement).closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href?.startsWith("/")) return;
      if (href === window.location.pathname + window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNavHref(href);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  // 从 API 响应解析地图数据（后端已完成 MMF 解析）
  useEffect(() => {
    if (!scene?.mapFileName) return;

    setMapLoading(true);
    setMapError(null);
    setMapData(null);

    try {
      if (scene.mapParsed) {
        // 后端返回的结构化 MMF 数据，转换为引擎运行时类型
        const data = dtoToMiuMapData(scene.mapParsed);
        setMapData(data);
      } else {
        setMapError("无地图数据");
      }
    } catch (e) {
      setMapError(e instanceof Error ? e.message : "解析地图数据失败");
    } finally {
      setMapLoading(false);
    }
  }, [scene?.mapFileName, scene?.mapParsed]);

  const handleMarkerClick = useCallback((index: number) => {
    if (index < npcCountRef.current) {
      setSelectedNpcIdx(index);
      setSelectedObjIdx(null);
      setRightTab("npc");
    } else {
      setSelectedObjIdx(index - npcCountRef.current);
      setSelectedNpcIdx(null);
      setRightTab("obj");
    }
  }, []);

  const handleEmptyClick = useCallback(() => {
    setSelectedNpcIdx(null);
    setSelectedObjIdx(null);
  }, []);

  const handleMarkerDrag = useCallback(
    (index: number, mapX: number, mapY: number) => {
      if (index < npcCountRef.current) {
        setNpcEntries((prev) => {
          const next = [...prev];
          if (index < next.length) {
            next[index] = { ...next[index], mapX, mapY };
          }
          return next;
        });
      } else {
        const objIdx = index - npcCountRef.current;
        setObjEntries((prev) => {
          const next = [...prev];
          if (objIdx < next.length) {
            next[objIdx] = { ...next[objIdx], mapX, mapY };
          }
          return next;
        });
      }
    },
    [setNpcEntries, setObjEntries]
  );

  const sceneData = useMemo(() => (scene?.data ?? {}) as SceneData, [scene?.data]);

  // 点击地图陷阱瓦片 → 切换到对应的陷阱 tab
  const handleTrapTileClick = useCallback(
    (trapIndex: number) => {
      if (!mapData) return;
      const entry = mapData.trapTable.find((e) => e.trapIndex === trapIndex);
      if (!entry) return;
      // 大小写不敏感匹配 sceneData.traps 中的实际 key（原系统文件名不区分大小写）
      const actualKey = sceneData.traps
        ? (Object.keys(sceneData.traps).find(
            (k) => k.toLowerCase() === entry.scriptPath.toLowerCase()
          ) ?? entry.scriptPath)
        : entry.scriptPath;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("trapKey", actualKey);
        // 清除旧的 kind/key 参数
        next.delete("kind");
        next.delete("key");
        return next;
      });
      setRightTab("trap");
    },
    [mapData, sceneData.traps, setSearchParams]
  );

  // latest-value refs（用于稳定的回调）
  const npcEntriesRef = useRef(npcEntries);
  npcEntriesRef.current = npcEntries;
  const objEntriesRef = useRef(objEntries);
  objEntriesRef.current = objEntries;
  const selectedNpcIdxRef = useRef(selectedNpcIdx);
  selectedNpcIdxRef.current = selectedNpcIdx;
  const selectedObjIdxRef = useRef(selectedObjIdx);
  selectedObjIdxRef.current = selectedObjIdx;

  // 加载引擎数据
  const gameDataReady = useGameData(gameSlug);
  const spriteCache = useSpriteCache(npcEntries, objEntries, gameDataReady);
  const { getMarkerPosition } = useNpcSimulation(npcEntries, mapData, mapViewerRef);

  // 选中 NPC/OBJ 时镜头跟随
  const handleSelectNpc = useCallback((idx: number | null) => {
    setSelectedNpcIdx(idx);
    if (idx !== null) setSelectedObjIdx(null);
    if (idx !== null && npcEntriesRef.current[idx]) {
      mapViewerRef.current?.panTo(npcEntriesRef.current[idx].mapX, npcEntriesRef.current[idx].mapY);
    }
  }, []);
  const handleSelectObj = useCallback((idx: number | null) => {
    setSelectedObjIdx(idx);
    if (idx !== null) setSelectedNpcIdx(null);
    if (idx !== null && objEntriesRef.current[idx]) {
      mapViewerRef.current?.panTo(objEntriesRef.current[idx].mapX, objEntriesRef.current[idx].mapY);
    }
  }, []);

  // hover 预览
  const handleHoverEntry = useCallback((mapX: number, mapY: number) => {
    if (selectedNpcIdxRef.current !== null || selectedObjIdxRef.current !== null) return;
    const renderer = mapViewerRef.current;
    if (!renderer) return;
    if (!savedCameraRef.current) {
      savedCameraRef.current = { mapX: -1, mapY: -1 };
      if (renderer.getZoom() < 1) {
        renderer.setZoom(1);
      }
    }
    renderer.panTo(mapX, mapY);
  }, []);
  const handleHoverLeave = useCallback(() => {
    if (savedCameraRef.current) {
      savedCameraRef.current = null;
    }
  }, []);

  // ============= 拖放 NPC/OBJ 到地图 =============

  const handleMapDrop = useCallback(
    (mapX: number, mapY: number, data: DataTransfer) => {
      const npcJson = data.getData("application/miu2d-npc");
      const objJson = data.getData("application/miu2d-obj");

      if (npcJson) {
        if (!npcKey) {
          toast.error("请先在左侧场景树中选中一个 NPC 文件，再拖放添加");
          return;
        }
        try {
          const npcInfo = JSON.parse(npcJson) as {
            id: string;
            key: string;
            name: string;
            kind: string;
            relation: string;
            npcIni: string;
          };
          const newEntry: SceneNpcEntry = {
            ...createDefaultNpcEntry(),
            name: npcInfo.name,
            npcIni: npcInfo.npcIni,
            kind: NpcKindValues[npcInfo.kind as keyof typeof NpcKindValues] ?? 0,
            relation: NpcRelationValues[npcInfo.relation as keyof typeof NpcRelationValues] ?? 0,
            mapX,
            mapY,
          };
          setNpcEntries((prev) => [...prev, newEntry]);
          toast.success("已添加 NPC 到地图（未保存）");
        } catch {
          toast.error("拖放数据解析失败");
        }
        return;
      }

      if (objJson) {
        if (!objKey) {
          toast.error("请先在左侧场景树中选中一个 OBJ 文件，再拖放添加");
          return;
        }
        try {
          const objInfo = JSON.parse(objJson) as {
            id: string;
            key: string;
            name: string;
            kind: string;
            objFile: string;
          };
          const newEntry: SceneObjEntry = {
            ...createDefaultObjEntry(),
            objName: objInfo.name,
            objFile: objInfo.objFile,
            kind: ObjKindValues[objInfo.kind as keyof typeof ObjKindValues] ?? 0,
            mapX,
            mapY,
          };
          setObjEntries((prev) => [...prev, newEntry]);
          toast.success("已添加 OBJ 到地图（未保存）");
        } catch {
          toast.error("拖放数据解析失败");
        }
      }
    },
    [npcKey, objKey, toast, setNpcEntries, setObjEntries]
  );

  const hasNpcTab = !!npcKey;
  const hasObjTab = !!objKey;
  const hasScriptTab = !!scriptKey;
  const hasTrapTab = !!trapKey;
  const mapFileName = scene?.mapFileName ?? "";

  // ============= 右键菜单（新建陷阱/脚本/NPC/OBJ 条目） =============

  const [mapContextMenu, setMapContextMenu] = useState<{
    clientX: number;
    clientY: number;
    tileX: number;
    tileY: number;
  } | null>(null);

  // NPC/OBJ 选择器弹窗状态
  const [entityPicker, setEntityPicker] = useState<{
    kind: "npc" | "obj";
    mapX: number;
    mapY: number;
  } | null>(null);

  // 选择 NPC/OBJ 后添加条目到当前文件，并自动切换 tab + 选中
  const handleEntitySelect = useCallback(
    (entity: NpcListItem | ObjListItem) => {
      if (!entityPicker) return;
      const { kind, mapX, mapY } = entityPicker;
      if (kind === "npc") {
        const npc = entity as NpcListItem;
        const newEntry: SceneNpcEntry = {
          ...createDefaultNpcEntry(),
          name: npc.name,
          npcIni: npc.npcIni,
          kind: NpcKindValues[npc.kind as keyof typeof NpcKindValues] ?? 0,
          relation:
            NpcRelationValues[(npc as NpcListItem).relation as keyof typeof NpcRelationValues] ?? 0,
          mapX,
          mapY,
        };
        setNpcEntries((prev) => [...prev, newEntry]);
        setSelectedNpcIdx(npcEntriesRef.current.length); // 新条目的索引
        setSelectedObjIdx(null);
        setRightTab("npc");
        toast.success(`已添加 NPC「${npc.name}」`);
      } else {
        const obj = entity as ObjListItem;
        const newEntry: SceneObjEntry = {
          ...createDefaultObjEntry(),
          objName: obj.name,
          objFile: obj.objFile,
          kind: ObjKindValues[obj.kind as keyof typeof ObjKindValues] ?? 0,
          mapX,
          mapY,
        };
        setObjEntries((prev) => [...prev, newEntry]);
        setSelectedObjIdx(objEntriesRef.current.length);
        setSelectedNpcIdx(null);
        setRightTab("obj");
        toast.success(`已添加 OBJ「${obj.name}」`);
      }
      setEntityPicker(null);
    },
    [entityPicker, toast, setNpcEntries, setObjEntries]
  );

  const handleMapContextMenu = useCallback(
    (info: { tileX: number; tileY: number; clientX: number; clientY: number }) => {
      setMapContextMenu(info);
    },
    []
  );

  /** 通过右键菜单创建条目（所有操作仅修改本地状态，不自动保存） */
  const handleContextMenuCreate = useCallback(
    (
      kind: "trap" | "npc" | "obj",
      specifiedTrapIndex?: number,
      overrideTile?: { tileX: number; tileY: number }
    ) => {
      const ctx = overrideTile ?? mapContextMenu;
      if (!ctx) return;
      const { tileX, tileY } = ctx;
      // NPC/OBJ 坐标使用瓦片坐标（与 onDrop / onMarkerDrag 一致）
      const mapX = tileX;
      const mapY = tileY;

      if (kind === "trap") {
        // 在地图瓦片上放置陷阱
        if (!mapData) return;
        const tileIdx = tileY * mapData.mapColumnCounts + tileX;

        const usedIndices = new Set(mapData.trapTable.map((e) => e.trapIndex));
        // 收集已在地图瓦片中使用的 trapIndex
        for (let i = 0; i < mapData.traps.length; i++) {
          if (mapData.traps[i] !== 0) usedIndices.add(mapData.traps[i]);
        }

        const trapIndex =
          specifiedTrapIndex ??
          (() => {
            let next = 1;
            while (usedIndices.has(next) && next < 255) next++;
            return next;
          })();

        if (trapIndex < 1 || trapIndex > 254) {
          toast.error("陷阱号码必须在 1-254 之间");
          return;
        }

        // 检查当前瓦片是否已有陷阱
        if (mapData.traps[tileIdx] !== 0) {
          toast.error(`此瓦片已有陷阱 #${mapData.traps[tileIdx]}`);
          return;
        }

        const newTraps = new Uint8Array(mapData.traps);
        newTraps[tileIdx] = trapIndex;

        // 不自动关联脚本文件，仅在瓦片上放置陷阱号码
        const newTrapTable = mapData.trapTable;

        const updatedMapData: MiuMapData = {
          ...mapData,
          traps: newTraps,
          trapTable: newTrapTable,
        };
        setMapData(updatedMapData);
        setPanelHighlightTraps([trapIndex]);
        toast.success(`已在瓦片放置陷阱 #${trapIndex}（未保存）`);
      } else {
        // NPC/OBJ：弹出选择器
        setEntityPicker({ kind, mapX, mapY });
      }
      setMapContextMenu(null);
    },
    [mapData, mapContextMenu, toast]
  );

  /** 通过右键菜单放置/清除障碍 */
  const handleContextMenuBarrier = useCallback(
    (barrierValue: number, overrideTile?: { tileX: number; tileY: number }) => {
      const ctx = overrideTile ?? mapContextMenu;
      if (!ctx || !mapData) return;
      const { tileX, tileY } = ctx;
      const tileIdx = tileY * mapData.mapColumnCounts + tileX;
      if (!mapData.barriers) return;

      const newBarriers = new Uint8Array(mapData.barriers);
      newBarriers[tileIdx] = barrierValue;
      setMapData({ ...mapData, barriers: newBarriers });
      if (barrierValue === 0) {
        toast.success(`已清除障碍（未保存）`);
      } else {
        toast.success(`已放置障碍 0x${barrierValue.toString(16).toUpperCase()}（未保存）`);
      }
      setMapContextMenu(null);
    },
    [mapData, mapContextMenu, toast]
  );

  /** 通过右键菜单删除瓦片上的陷阱 */
  const handleContextMenuDeleteTrap = useCallback(() => {
    if (!mapContextMenu || !mapData) return;
    const { tileX, tileY } = mapContextMenu;
    const tileIdx = tileY * mapData.mapColumnCounts + tileX;
    const newTraps = new Uint8Array(mapData.traps);
    newTraps[tileIdx] = 0;
    setMapData({ ...mapData, traps: newTraps });
    toast.success("已清除瓦片陷阱（未保存）");
    setMapContextMenu(null);
  }, [mapData, mapContextMenu, toast]);

  /** 通过右键菜单删除指定 NPC */
  const handleContextMenuDeleteNpc = useCallback(
    (idx: number) => {
      setNpcEntries((prev) => prev.filter((_, i) => i !== idx));
      if (selectedNpcIdx === idx) setSelectedNpcIdx(null);
      toast.success("已删除 NPC（未保存）");
      setMapContextMenu(null);
    },
    [toast, setNpcEntries, selectedNpcIdx]
  );

  /** 通过右键菜单删除指定 OBJ */
  const handleContextMenuDeleteObj = useCallback(
    (idx: number) => {
      setObjEntries((prev) => prev.filter((_, i) => i !== idx));
      if (selectedObjIdx === idx) setSelectedObjIdx(null);
      toast.success("已删除 OBJ（未保存）");
      setMapContextMenu(null);
    },
    [toast, setObjEntries, selectedObjIdx]
  );

  // 点击 trapTable 条目 → 高亮对应的陷阱瓦片
  const handleMapPanelTrapSelect = useCallback((trapIndex: number) => {
    setPanelHighlightTraps([trapIndex]);
  }, []);

  // mapData 被 MapDataPanel 修改后同步到本地状态
  const handleMapDataChanged = useCallback((newMapData: MiuMapData) => {
    setMapData(newMapData);
  }, []);

  // 构建 sidePanelTabs — 地图 / NPC / OBJ / 脚本 / 陷阱 统一排列
  const sidePanelTabs = useMemo((): SidePanelTab[] => {
    if (!scene) return [];
    const tabs: SidePanelTab[] = [];

    // 地图数据 tab（始终显示）
    tabs.push({
      id: "map",
      label: "地图",
      content: (
        <MapDataPanel
          mapData={mapData}
          sceneData={sceneData}
          onMapDataChanged={handleMapDataChanged}
          onTrapSelect={handleMapPanelTrapSelect}
          gameId={gameId ?? ""}
          gameSlug={gameSlug ?? ""}
        />
      ),
    });

    if (hasNpcTab) {
      tabs.push({
        id: "npc",
        label: `NPC (${npcEntries.length})`,
        content: (
          <SceneItemEditorPanel
            key={`${sceneId}-npc-${npcKey}`}
            kind="npc"
            itemKey={npcKey}
            sceneData={sceneData}
            sceneId={sceneId!}
            gameId={gameId!}
            gameSlug={gameSlug!}
            mapFileName={mapFileName}
            onSaved={refetchScene}
            selectedIdx={selectedNpcIdx}
            onSelectIdx={handleSelectNpc}
            onHoverEntry={handleHoverEntry}
            onHoverLeave={handleHoverLeave}
          />
        ),
      });
    }

    if (hasObjTab) {
      tabs.push({
        id: "obj",
        label: `物件 (${objEntries.length})`,
        content: (
          <SceneItemEditorPanel
            key={`${sceneId}-obj-${objKey}`}
            kind="obj"
            itemKey={objKey}
            sceneData={sceneData}
            sceneId={sceneId!}
            gameId={gameId!}
            gameSlug={gameSlug!}
            mapFileName={mapFileName}
            onSaved={refetchScene}
            selectedIdx={selectedObjIdx}
            onSelectIdx={handleSelectObj}
            onHoverEntry={handleHoverEntry}
            onHoverLeave={handleHoverLeave}
          />
        ),
      });
    }

    if (hasScriptTab) {
      tabs.push({
        id: "script",
        label: `脚本`,
        content: (
          <SceneItemEditorPanel
            key={`${sceneId}-script-${scriptKey}`}
            kind="script"
            itemKey={scriptKey}
            sceneData={sceneData}
            sceneId={sceneId!}
            gameId={gameId!}
            gameSlug={gameSlug!}
            mapFileName={mapFileName}
            onSaved={refetchScene}
            onHoverEntry={handleHoverEntry}
            onHoverLeave={handleHoverLeave}
          />
        ),
      });
    }

    if (hasTrapTab) {
      tabs.push({
        id: "trap",
        label: `陷阱`,
        content: (
          <SceneItemEditorPanel
            key={`${sceneId}-trap-${trapKey}`}
            kind="trap"
            itemKey={trapKey}
            sceneData={sceneData}
            sceneId={sceneId!}
            gameId={gameId!}
            gameSlug={gameSlug!}
            mapFileName={mapFileName}
            onSaved={refetchScene}
            onHoverEntry={handleHoverEntry}
            onHoverLeave={handleHoverLeave}
          />
        ),
      });
    }

    return tabs;
  }, [
    scene,
    mapData,
    hasNpcTab,
    hasObjTab,
    hasScriptTab,
    hasTrapTab,
    npcKey,
    objKey,
    scriptKey,
    trapKey,
    npcEntries.length,
    objEntries.length,
    sceneId,
    sceneData,
    gameId,
    gameSlug,
    mapFileName,
    refetchScene,
    selectedNpcIdx,
    selectedObjIdx,
    handleSelectNpc,
    handleSelectObj,
    handleHoverEntry,
    handleHoverLeave,
    handleMapDataChanged,
    handleMapPanelTrapSelect,
  ]);

  // markers
  const allMarkers = useMemo((): MapMarker[] => {
    const npcM: MapMarker[] = npcEntries.map((e, i) => {
      const s = spriteCache.get(`npc:${e.npcIni}`);
      let selColor = "rgba(255, 255, 0, 0.8)";
      if (e.relation === 1) {
        selColor = "rgba(255, 0, 0, 0.8)";
      } else if ((e.kind === 1 || e.kind === 3) && e.relation === 0) {
        selColor = "rgba(0, 255, 0, 0.8)";
      } else if (e.relation === 3 && e.kind === 1) {
        selColor = "rgba(0, 0, 255, 0.8)";
      }
      return {
        mapX: e.mapX,
        mapY: e.mapY,
        label: e.name || `N${i}`,
        color: "#4fc3f7",
        selected: selectedNpcIdx === i,
        selectedColor: selColor,
        direction: e.dir ?? 0,
        sprite: s
          ? {
              frames: s.frames,
              interval: s.interval,
              offsetX: s.offsetX,
              offsetY: s.offsetY,
              asf: s.asf,
              isObj: false,
              walkAsf: s.walkAsf,
            }
          : undefined,
      };
    });
    const objM: MapMarker[] = objEntries.map((e, i) => {
      const s = spriteCache.get(`obj:${e.objFile}`);
      return {
        mapX: e.mapX,
        mapY: e.mapY,
        label: e.objName || `O${i}`,
        color: "#81c784",
        selected: selectedObjIdx === i,
        sprite: s
          ? {
              frames: s.frames,
              interval: s.interval,
              offsetX: s.offsetX,
              offsetY: s.offsetY,
              asf: s.asf,
              isObj: true,
              objOffX: e.offX ?? 0,
              objOffY: e.offY ?? 0,
            }
          : undefined,
      };
    });
    return [...npcM, ...objM];
  }, [npcEntries, objEntries, selectedNpcIdx, selectedObjIdx, spriteCache]);

  const handleRightTabChange = useCallback((id: string) => {
    setRightTab(id as RightTab);
  }, []);

  // 选中陷阱脚本时高亮对应瓦片（合并 trap tab 选择 + map panel 选择）
  const highlightTrapIndices = useMemo((): ReadonlySet<number> | null => {
    const indices = new Set<number>();
    // 从 trap tab 选中的脚本
    if (trapKey && mapData) {
      for (const entry of mapData.trapTable) {
        if (entry.scriptPath === trapKey) {
          indices.add(entry.trapIndex);
        }
      }
    }
    // 从 map panel 手动选择的
    if (panelHighlightTraps) {
      for (const idx of panelHighlightTraps) {
        indices.add(idx);
      }
    }
    return indices.size > 0 ? indices : null;
  }, [trapKey, mapData, panelHighlightTraps]);

  if (!scene) {
    return <div className="h-full flex items-center justify-center text-[#858585]">加载中...</div>;
  }

  return (
    <div className="flex h-full">
      {/* 地图预览 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-panel-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#858585]">{DashboardIcons.map}</span>
            <span className="text-sm text-white font-medium">{scene.name}</span>
            <span className="text-xs text-[#858585]">({scene.key})</span>
          </div>
          <div className="text-xs text-[#858585]">{scene.mapFileName}</div>
        </div>

        <div className="flex-1 relative min-h-0">
          <MapViewer
            ref={mapViewerRef}
            rendererBackend="canvas2d"
            mmfData={mapData}
            mapName={mapName}
            fileName={scene.mapFileName}
            isLoading={mapLoading}
            error={mapError}
            resourceRoot={resourceRoot}
            markers={allMarkers}
            onMarkerClick={handleMarkerClick}
            onMarkerDrag={handleMarkerDrag}
            onEmptyClick={handleEmptyClick}
            onTrapTileClick={handleTrapTileClick}
            onDrop={handleMapDrop}
            getMarkerPosition={getMarkerPosition}
            sidePanelTabs={sidePanelTabs}
            activeTabId={rightTab}
            onTabChange={handleRightTabChange}
            highlightTrapIndices={highlightTrapIndices}
            onContextMenu={handleMapContextMenu}
          />
        </div>
      </div>

      {/* 地图右键菜单 */}
      {mapContextMenu && (
        <ContextMenu
          x={mapContextMenu.clientX}
          y={mapContextMenu.clientY}
          onClose={() => setMapContextMenu(null)}
          items={(() => {
            const { tileX, tileY } = mapContextMenu;
            const tileIdx = mapData ? tileY * mapData.mapColumnCounts + tileX : -1;
            const trapAtTile = mapData && tileIdx >= 0 ? mapData.traps[tileIdx] : 0;
            const barrierAtTile = mapData?.barriers && tileIdx >= 0 ? mapData.barriers[tileIdx] : 0;
            // 查找此瓦片上的 NPC/OBJ
            const npcsAtTile = npcEntries
              .map((e, i) => ({ ...e, idx: i }))
              .filter((e) => e.mapX === tileX && e.mapY === tileY);
            const objsAtTile = objEntries
              .map((e, i) => ({ ...e, idx: i }))
              .filter((e) => e.mapX === tileX && e.mapY === tileY);

            const items: Parameters<typeof ContextMenu>[0]["items"] = [
              {
                label: `${mapFileName}  (${tileX}, ${tileY})`,
                disabled: true,
                onClick: () => {},
              },
              { label: "", divider: true, onClick: () => {} },
              {
                label: "放置陷阱",
                onClick: () => {},
                children: [
                  {
                    label: `自定义: ${customTrapIndex || "_"}`,
                    onClick: () =>
                      setTrapInputDialog({
                        open: true,
                        value: customTrapIndex || "1",
                        tileX,
                        tileY,
                      }),
                  },
                  { label: "", divider: true, onClick: () => {} },
                  ...Array.from({ length: 10 }, (_, i) => ({
                    label: `陷阱 #${i + 1}`,
                    onClick: () => handleContextMenuCreate("trap", i + 1),
                  })),
                ],
              },
              {
                label: "放置障碍",
                onClick: () => {},
                children: [
                  {
                    label: `自定义: ${customBarrierValue || "_"}`,
                    onClick: () =>
                      setBarrierInputDialog({
                        open: true,
                        value: customBarrierValue || "128",
                        tileX,
                        tileY,
                      }),
                  },
                  { label: "", divider: true, onClick: () => {} },
                  { label: "障碍物 (0x80)", onClick: () => handleContextMenuBarrier(0x80) },
                  { label: "可越过障碍 (0xA0)", onClick: () => handleContextMenuBarrier(0xa0) },
                  { label: "传送点 (0x40)", onClick: () => handleContextMenuBarrier(0x40) },
                  { label: "可越过传送点 (0x60)", onClick: () => handleContextMenuBarrier(0x60) },
                  { label: "可越过 (0x20)", onClick: () => handleContextMenuBarrier(0x20) },
                ],
              },
              { label: "", divider: true, onClick: () => {} },
              {
                label: "添加 NPC",
                disabled: !hasNpcTab,
                onClick: () => {
                  if (!hasNpcTab) {
                    toast.error("请先在左侧场景树中选中一个 NPC 文件");
                    return;
                  }
                  handleContextMenuCreate("npc");
                },
              },
              {
                label: "添加 OBJ",
                disabled: !hasObjTab,
                onClick: () => {
                  if (!hasObjTab) {
                    toast.error("请先在左侧场景树中选中一个 OBJ 文件");
                    return;
                  }
                  handleContextMenuCreate("obj");
                },
              },
            ];

            // ── 删除区域 ──
            const deleteItems: Parameters<typeof ContextMenu>[0]["items"] = [];
            if (trapAtTile) {
              deleteItems.push({
                label: `删除陷阱 #${trapAtTile}`,
                danger: true,
                onClick: handleContextMenuDeleteTrap,
              });
            }
            if (barrierAtTile) {
              deleteItems.push({
                label: `清除障碍 (0x${barrierAtTile.toString(16).toUpperCase()})`,
                danger: true,
                onClick: () => handleContextMenuBarrier(0),
              });
            }
            for (const npc of npcsAtTile) {
              deleteItems.push({
                label: `删除 NPC「${npc.name || `N${npc.idx}`}」`,
                danger: true,
                onClick: () => handleContextMenuDeleteNpc(npc.idx),
              });
            }
            for (const obj of objsAtTile) {
              deleteItems.push({
                label: `删除 OBJ「${obj.objName || `O${obj.idx}`}」`,
                danger: true,
                onClick: () => handleContextMenuDeleteObj(obj.idx),
              });
            }

            if (deleteItems.length > 0) {
              items.push({ label: "", divider: true, onClick: () => {} });
              items.push(...deleteItems);
            }

            return items;
          })()}
        />
      )}

      {/* NPC/OBJ 选择器弹窗 */}
      {entityPicker && gameId && (
        <EntitySelectDialog
          kind={entityPicker.kind}
          open
          onClose={() => setEntityPicker(null)}
          onSelect={handleEntitySelect}
          gameId={gameId}
          gameSlug={gameSlug}
        />
      )}

      {/* 未保存修改确认对话框 */}
      {pendingNavHref && (
        <ConfirmDialog
          title="未保存的修改"
          message="当前有未保存的修改，确认离开？离开后修改将丢失。"
          confirmText="离开"
          cancelText="留下"
          danger
          onConfirm={() => {
            const href = pendingNavHref;
            setPendingNavHref(null);
            navigate(href);
          }}
          onCancel={() => setPendingNavHref(null)}
        />
      )}

      {/* 自定义陷阱号码输入弹窗 */}
      {trapInputDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTrapInputDialog(null);
          }}
        >
          <div className="bg-[#252526] border border-[#555] rounded-lg shadow-xl w-72 p-4">
            <h3 className="text-sm text-zinc-200 font-medium mb-3">输入陷阱号码</h3>
            <input
              autoFocus
              type="number"
              min={1}
              max={254}
              className="w-full bg-[#3c3c3c] border border-[#555] rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500"
              value={trapInputDialog.value}
              onChange={(e) => setTrapInputDialog({ ...trapInputDialog, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const num = Number.parseInt(trapInputDialog.value, 10);
                  if (Number.isNaN(num) || num < 1 || num > 254) {
                    toast.error("陷阱号码必须在 1-254 之间");
                    return;
                  }
                  setCustomTrapIndex(trapInputDialog.value);
                  const { tileX, tileY } = trapInputDialog;
                  setTrapInputDialog(null);
                  handleContextMenuCreate("trap", num, { tileX, tileY });
                } else if (e.key === "Escape") {
                  setTrapInputDialog(null);
                }
              }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                onClick={() => setTrapInputDialog(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
                onClick={() => {
                  const num = Number.parseInt(trapInputDialog.value, 10);
                  if (Number.isNaN(num) || num < 1 || num > 254) {
                    toast.error("陷阱号码必须在 1-254 之间");
                    return;
                  }
                  setCustomTrapIndex(trapInputDialog.value);
                  const { tileX, tileY } = trapInputDialog;
                  setTrapInputDialog(null);
                  handleContextMenuCreate("trap", num, { tileX, tileY });
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自定义障碍号码输入弹窗 */}
      {barrierInputDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBarrierInputDialog(null);
          }}
        >
          <div className="bg-[#252526] border border-[#555] rounded-lg shadow-xl w-72 p-4">
            <h3 className="text-sm text-zinc-200 font-medium mb-3">
              输入障碍值 (十进制, 如 128=0x80)
            </h3>
            <input
              autoFocus
              type="number"
              min={1}
              max={255}
              className="w-full bg-[#3c3c3c] border border-[#555] rounded px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-blue-500"
              value={barrierInputDialog.value}
              onChange={(e) =>
                setBarrierInputDialog({ ...barrierInputDialog, value: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const num = Number.parseInt(barrierInputDialog.value, 10);
                  if (Number.isNaN(num) || num < 1 || num > 255) {
                    toast.error("障碍值必须在 1-255 之间");
                    return;
                  }
                  setCustomBarrierValue(barrierInputDialog.value);
                  const { tileX, tileY } = barrierInputDialog;
                  setBarrierInputDialog(null);
                  handleContextMenuBarrier(num, { tileX, tileY });
                } else if (e.key === "Escape") {
                  setBarrierInputDialog(null);
                }
              }}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                className="px-3 py-1 text-xs text-zinc-400 hover:text-white transition-colors"
                onClick={() => setBarrierInputDialog(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
                onClick={() => {
                  const num = Number.parseInt(barrierInputDialog.value, 10);
                  if (Number.isNaN(num) || num < 1 || num > 255) {
                    toast.error("障碍值必须在 1-255 之间");
                    return;
                  }
                  setCustomBarrierValue(barrierInputDialog.value);
                  const { tileX, tileY } = barrierInputDialog;
                  setBarrierInputDialog(null);
                  handleContextMenuBarrier(num, { tileX, tileY });
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
