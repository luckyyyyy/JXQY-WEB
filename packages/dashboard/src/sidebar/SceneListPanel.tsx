/**
 * 场景列表侧边栏面板
 * 3 层树形结构：场景 → 分类(脚本/陷阱/NPC/物件) → 子项
 *
 * 子项数据全部来自 scene.data（不再调用 listItems API）
 * URL 参数: ?kind=script&key=fileName / ?kind=npc
 *
 * 支持操作：
 * - 删除场景（从数据库删除）
 * - 删除子项文件（从 scene.data JSONB 中删除 key）
 * - 新建子项文件（在 scene.data JSONB 中新增 key）
 */

import { trpc, useToast } from "@miu2d/shared";
import type { SceneData, SceneItemKind, SceneListItem } from "@miu2d/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";
import { ContextMenu } from "../modules/fileTree/ContextMenu";
import { ImportScenesModal } from "../modules/scenes";

interface ContextMenuState {
  x: number;
  y: number;
}

const kindLabels: Record<SceneItemKind, string> = {
  script: "脚本",
  trap: "陷阱",
  npc: "NPC",
  obj: "物件",
};

const kindIcons: Record<SceneItemKind, keyof typeof DashboardIcons> = {
  script: "script",
  trap: "trap",
  npc: "npc",
  obj: "obj",
};

const kindOrder: SceneItemKind[] = ["script", "trap", "npc", "obj"];

export function SceneListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const { sceneId: activeSceneId } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = currentGame?.id;
  const toast = useToast();

  const [showImportModal, setShowImportModal] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [expandedKinds, setExpandedKinds] = useState<Set<string>>(new Set());
  /** 正在确认删除的场景 ID */
  const [confirmDeleteSceneId, setConfirmDeleteSceneId] = useState<string | null>(null);

  // 根据 URL 参数自动展开树节点
  useEffect(() => {
    if (!activeSceneId) return;
    setExpandedScenes((prev) => {
      if (prev.has(activeSceneId)) return prev;
      const next = new Set(prev);
      next.add(activeSceneId);
      return next;
    });

    const kind = searchParams.get("kind");
    const npcKey = searchParams.get("npcKey");
    const objKey = searchParams.get("objKey");

    setExpandedKinds((prev) => {
      const next = new Set(prev);
      let changed = false;
      if (npcKey) {
        const npcKindKey = `${activeSceneId}_npc`;
        if (!next.has(npcKindKey)) {
          next.add(npcKindKey);
          changed = true;
        }
      }
      if (objKey) {
        const objKindKey = `${activeSceneId}_obj`;
        if (!next.has(objKindKey)) {
          next.add(objKindKey);
          changed = true;
        }
      }
      if (kind === "script" || kind === "trap") {
        const kindKey = `${activeSceneId}_${kind}`;
        if (!next.has(kindKey)) {
          next.add(kindKey);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeSceneId, searchParams]);

  const {
    data: scenes,
    isLoading,
    refetch,
  } = trpc.scene.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const toggleScene = useCallback((sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }, []);

  const toggleKind = useCallback((key: string) => {
    setExpandedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // 删除场景
  const deleteSceneMutation = trpc.scene.delete.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("场景已删除");
      refetch();
      setConfirmDeleteSceneId(null);
      // 如果删除的是当前正在查看的场景，跳回场景首页
      if (activeSceneId === variables.id) {
        navigate(basePath);
      }
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
      setConfirmDeleteSceneId(null);
    },
  });

  const handleDeleteScene = useCallback(
    (sceneId: string) => {
      if (!gameId) return;
      deleteSceneMutation.mutate({ gameId, id: sceneId });
    },
    [gameId, deleteSceneMutation]
  );

  return (
    <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
      {/* 标题栏 */}
      <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border shrink-0">
        <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">场景编辑</span>
        <button
          type="button"
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-[#cccccc] hover:bg-[#3c3c3c] transition-colors"
          title="批量导入"
        >
          {DashboardIcons.upload}
          <span>导入</span>
        </button>
      </div>

      {/* 场景列表 */}
      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {isLoading ? (
          <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
        ) : !scenes || scenes.length === 0 ? (
          <div className="px-4 py-3 text-center">
            <p className="text-sm text-[#858585] mb-2">暂无场景数据</p>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="text-xs text-[#0098ff] hover:text-[#1177bb] transition-colors"
            >
              点击批量导入
            </button>
          </div>
        ) : (
          scenes.map((scene) => (
            <SceneTreeNode
              key={scene.id}
              scene={scene}
              basePath={basePath}
              isActive={activeSceneId === scene.id}
              isExpanded={expandedScenes.has(scene.id)}
              expandedKinds={expandedKinds}
              onToggle={() => toggleScene(scene.id)}
              onToggleKind={toggleKind}
              onNavigate={() => navigate(`${basePath}/${scene.id}`)}
              gameId={gameId!}
              confirmDeleteSceneId={confirmDeleteSceneId}
              onConfirmDelete={setConfirmDeleteSceneId}
              onDeleteScene={handleDeleteScene}
              isDeleting={deleteSceneMutation.isPending}
              onRefetch={refetch}
            />
          ))
        )}
      </div>

      {/* 底部 NPC/OBJ 条目列表面板 */}
      {activeSceneId && gameId && <SceneEntryListPanels sceneId={activeSceneId} gameId={gameId} />}

      {/* 导入弹窗 */}
      {showImportModal && (
        <ImportScenesModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}

/** 单个场景的树节点 */
function SceneTreeNode({
  scene,
  basePath,
  isActive,
  isExpanded,
  expandedKinds,
  onToggle,
  onToggleKind,
  gameId,
  confirmDeleteSceneId,
  onConfirmDelete,
  onDeleteScene,
  isDeleting,
  onRefetch,
}: {
  scene: SceneListItem;
  basePath: string;
  isActive: boolean;
  isExpanded: boolean;
  expandedKinds: Set<string>;
  onToggle: () => void;
  onToggleKind: (key: string) => void;
  onNavigate: () => void;
  gameId: string;
  confirmDeleteSceneId: string | null;
  onConfirmDelete: (id: string | null) => void;
  onDeleteScene: (id: string) => void;
  isDeleting: boolean;
  onRefetch: () => void;
}) {
  const counts: Record<SceneItemKind, number> = {
    script: scene.scriptCount,
    trap: scene.trapCount,
    npc: scene.npcCount,
    obj: scene.objCount,
  };

  /** 获取分类下的子项 key 列表 */
  const getItemKeys = (kind: SceneItemKind): string[] => {
    switch (kind) {
      case "script":
        return scene.scriptKeys;
      case "trap":
        return scene.trapKeys;
      case "npc":
        return scene.npcKeys;
      case "obj":
        return scene.objKeys;
    }
  };

  const isConfirmingDelete = confirmDeleteSceneId === scene.id;
  const [sceneContextMenu, setSceneContextMenu] = useState<ContextMenuState | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(scene.name);
  const utils = trpc.useUtils();
  const toast = useToast();

  const renameMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已重命名");
      setIsRenaming(false);
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => toast.error(`重命名失败: ${err.message}`),
  });

  const handleRename = useCallback(() => {
    const trimmed = renameName.trim();
    if (!trimmed || trimmed === scene.name) {
      setIsRenaming(false);
      setRenameName(scene.name);
      return;
    }
    renameMutation.mutate({ gameId, id: scene.id, name: trimmed });
  }, [renameName, scene.name, scene.id, gameId, renameMutation]);

  return (
    <div>
      {/* 场景名称 (Level 1) */}
      <div className="flex items-center">
        <button type="button" onClick={onToggle} className="shrink-0 p-0.5 ml-1">
          <span
            className={`text-[#858585] text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}
          >
            {DashboardIcons.chevronRight}
          </span>
        </button>
        {isRenaming ? (
          <input
            autoFocus
            className="flex-1 bg-[#3c3c3c] border border-focus-border rounded px-1.5 py-0.5 text-sm text-[#cccccc] outline-none mx-1 min-w-0"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setIsRenaming(false);
                setRenameName(scene.name);
              }
            }}
            onBlur={handleRename}
          />
        ) : (
          <NavLink
            to={`${basePath}/${scene.id}`}
            className={`flex-1 flex items-center gap-1.5 py-1 pr-2 text-sm transition-colors truncate ${
              isActive ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e] text-[#cccccc]"
            }`}
            onClick={() => {
              if (!isExpanded) {
                onToggle();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setSceneContextMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <span className="text-[#858585]">{DashboardIcons.map}</span>
            <span className="truncate">{scene.name}</span>
          </NavLink>
        )}
      </div>

      {/* 右键菜单 */}
      {sceneContextMenu && (
        <ContextMenu
          x={sceneContextMenu.x}
          y={sceneContextMenu.y}
          onClose={() => setSceneContextMenu(null)}
          items={[
            { label: scene.name, disabled: true, onClick: () => {} },
            { label: "", divider: true, onClick: () => {} },
            {
              label: "重命名",
              onClick: () => {
                setIsRenaming(true);
                setRenameName(scene.name);
              },
            },
            { label: "删除", danger: true, onClick: () => onConfirmDelete(scene.id) },
          ]}
        />
      )}

      {/* 删除确认条 */}
      {isConfirmingDelete && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#3c1f1f] border-y border-[#5c2020] text-xs">
          <span className="text-red-300 flex-1 truncate">确认删除「{scene.name}」？</span>
          <button
            type="button"
            onClick={() => onDeleteScene(scene.id)}
            disabled={isDeleting}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs transition-colors"
          >
            {isDeleting ? "..." : "删除"}
          </button>
          <button
            type="button"
            onClick={() => onConfirmDelete(null)}
            className="px-2 py-0.5 text-[#999] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {/* 展开后显示分类 (Level 2 + 3) */}
      {isExpanded && (
        <div>
          {kindOrder.map((kind) => {
            const count = counts[kind];
            const kindKey = `${scene.id}_${kind}`;
            const itemKeys = getItemKeys(kind);

            return (
              <SceneKindGroup
                key={kind}
                kind={kind}
                count={count}
                isExpanded={expandedKinds.has(kindKey)}
                onToggle={() => onToggleKind(kindKey)}
                sceneId={scene.id}
                basePath={basePath}
                itemKeys={itemKeys}
                gameId={gameId}
                onRefetch={onRefetch}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 分类组 (脚本/陷阱/NPC/物件) */
function SceneKindGroup({
  kind,
  count,
  isExpanded,
  onToggle,
  sceneId,
  basePath,
  itemKeys,
  gameId,
  onRefetch,
}: {
  kind: SceneItemKind;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  sceneId: string;
  basePath: string;
  itemKeys: string[];
  gameId: string;
  onRefetch: () => void;
}) {
  const [showNewInput, setShowNewInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [kindContextMenu, setKindContextMenu] = useState<ContextMenuState | null>(null);
  const utils = trpc.useUtils();
  const toast = useToast();

  // 获取当前场景完整数据（用于构建更新后的 data）
  const { data: scene } = trpc.scene.get.useQuery(
    { gameId, id: sceneId },
    { enabled: showNewInput }
  );

  const updateMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已新建");
      setShowNewInput(false);
      setNewName("");
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => toast.error(`新建失败: ${err.message}`),
  });

  /** 新建子项文件（在 scene.data 中添加 key） */
  const handleCreate = useCallback(() => {
    if (!newName.trim() || !scene) return;

    const sceneData = (scene.data ?? {}) as SceneData;
    const newData: SceneData = { ...sceneData };
    const fileName = newName.trim();
    if (kind === "script" || kind === "trap") {
      const field = kind === "trap" ? "traps" : "scripts";
      if (sceneData[field]?.[fileName]) {
        toast.error("同名文件已存在");
        return;
      }
      newData[field] = { ...(sceneData[field] ?? {}), [fileName]: "" };
    } else if (kind === "npc") {
      if (sceneData.npc?.[fileName]) {
        toast.error("同名文件已存在");
        return;
      }
      newData.npc = { ...(sceneData.npc ?? {}), [fileName]: { key: fileName, entries: [] } };
    } else {
      if (sceneData.obj?.[fileName]) {
        toast.error("同名文件已存在");
        return;
      }
      newData.obj = { ...(sceneData.obj ?? {}), [fileName]: { key: fileName, entries: [] } };
    }

    updateMutation.mutate({ gameId, id: sceneId, data: newData as Record<string, unknown> });
  }, [newName, scene, kind, gameId, sceneId, updateMutation, toast]);

  return (
    <div>
      {/* 分类标题 — 右键菜单新建 */}
      <button
        type="button"
        onClick={onToggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setKindContextMenu({ x: e.clientX, y: e.clientY });
        }}
        className="flex w-full items-center gap-1 py-0.5 pr-2 text-left text-xs hover:bg-[#2a2d2e] transition-colors"
        style={{ paddingLeft: 28 }}
      >
        <span
          className={`text-[#858585] text-xs transition-transform inline-block ${isExpanded ? "rotate-90" : ""}`}
        >
          {DashboardIcons.chevronRight}
        </span>
        <span className="text-[#858585]">{DashboardIcons[kindIcons[kind]]}</span>
        <span className="text-[#cccccc]">{kindLabels[kind]}</span>
        <span className="text-[#555] ml-auto">{count}</span>
      </button>

      {/* 右键菜单 */}
      {kindContextMenu && (
        <ContextMenu
          x={kindContextMenu.x}
          y={kindContextMenu.y}
          onClose={() => setKindContextMenu(null)}
          items={[
            { label: kindLabels[kind], disabled: true, onClick: () => {} },
            { label: "", divider: true, onClick: () => {} },
            {
              label: `新建${kindLabels[kind]}`,
              onClick: () => {
                setShowNewInput(true);
                if (!isExpanded) onToggle();
              },
            },
          ]}
        />
      )}

      {/* 新建输入框 */}
      {showNewInput && (
        <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: 48 }}>
          <input
            autoFocus
            className="flex-1 bg-[#3c3c3c] border border-[#555] rounded px-1.5 py-0.5 text-xs text-[#cccccc] outline-none focus:border-focus-border min-w-0"
            placeholder={`文件名`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setShowNewInput(false);
                setNewName("");
              }
            }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || updateMutation.isPending}
            className="text-xs text-[#0098ff] hover:text-[#1177bb] disabled:opacity-30 transition-colors"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewInput(false);
              setNewName("");
            }}
            className="text-xs text-[#666] hover:text-[#ccc] transition-colors"
          >
            ✗
          </button>
        </div>
      )}

      {isExpanded && (
        <SceneKindItems
          sceneId={sceneId}
          kind={kind}
          basePath={basePath}
          itemKeys={itemKeys}
          gameId={gameId}
          onRefetch={onRefetch}
        />
      )}
    </div>
  );
}

/** 构建保留所有独立 key 的搜索参数 — npcKey / objKey / scriptKey / trapKey */
function buildSearchParams(
  currentParams: URLSearchParams,
  kind: SceneItemKind,
  key: string
): string {
  const params = new URLSearchParams();

  // 保留所有现有的独立 key
  const existingNpcKey = currentParams.get("npcKey");
  const existingObjKey = currentParams.get("objKey");
  const existingScriptKey = currentParams.get("scriptKey");
  const existingTrapKey = currentParams.get("trapKey");
  if (existingNpcKey) params.set("npcKey", existingNpcKey);
  if (existingObjKey) params.set("objKey", existingObjKey);
  if (existingScriptKey) params.set("scriptKey", existingScriptKey);
  if (existingTrapKey) params.set("trapKey", existingTrapKey);

  // 覆盖当前 kind 对应的 key
  if (kind === "npc") {
    params.set("npcKey", key);
  } else if (kind === "obj") {
    params.set("objKey", key);
  } else if (kind === "script") {
    params.set("scriptKey", key);
  } else if (kind === "trap") {
    params.set("trapKey", key);
  }

  return params.toString();
}

/** 分类下的子项列表 (Level 3) - 直接从 scene 数据派生，无需 API 请求 */
function SceneKindItems({
  sceneId,
  kind,
  basePath,
  itemKeys,
  gameId,
  onRefetch,
}: {
  sceneId: string;
  kind: SceneItemKind;
  basePath: string;
  itemKeys: string[];
  gameId: string;
  onRefetch: () => void;
}) {
  const { sceneId: activeSceneId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [itemContextMenu, setItemContextMenu] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const utils = trpc.useUtils();
  const toast = useToast();

  const updateMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      setConfirmDeleteKey(null);
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
      setConfirmDeleteKey(null);
    },
  });

  const renameMutation = trpc.scene.update.useMutation({
    onSuccess: () => {
      toast.success("已重命名");
      setRenamingKey(null);
      utils.scene.get.invalidate({ gameId, id: sceneId });
      utils.scene.list.invalidate({ gameId });
      onRefetch();
    },
    onError: (err) => toast.error(`重命名失败: ${err.message}`),
  });

  // 获取当前场景完整数据 — 删除或重命名时需要
  const { data: scene } = trpc.scene.get.useQuery(
    { gameId, id: sceneId },
    { enabled: confirmDeleteKey !== null || renamingKey !== null }
  );

  /** 删除子项文件（从 scene.data JSONB 中移除该 key） */
  const handleDeleteItem = useCallback(
    (key: string) => {
      if (!scene) return;

      const sceneData = (scene.data ?? {}) as SceneData;
      const newData: SceneData = { ...sceneData };

      if (kind === "script") {
        const { [key]: _, ...rest } = sceneData.scripts ?? {};
        newData.scripts = rest;
      } else if (kind === "trap") {
        const { [key]: _, ...rest } = sceneData.traps ?? {};
        newData.traps = rest;
      } else if (kind === "npc") {
        const { [key]: _, ...rest } = sceneData.npc ?? {};
        newData.npc = rest;
      } else {
        const { [key]: _, ...rest } = sceneData.obj ?? {};
        newData.obj = rest;
      }

      updateMutation.mutate({ gameId, id: sceneId, data: newData as Record<string, unknown> });

      // 如果删除的恰好是当前正选中的子项，清除对应 URL 参数
      const currentNpcKey = searchParams.get("npcKey");
      const currentObjKey = searchParams.get("objKey");
      const currentScriptKey = searchParams.get("scriptKey");
      const currentTrapKey = searchParams.get("trapKey");
      if (
        (kind === "script" && currentScriptKey === key) ||
        (kind === "trap" && currentTrapKey === key) ||
        (kind === "npc" && currentNpcKey === key) ||
        (kind === "obj" && currentObjKey === key)
      ) {
        navigate(`${basePath}/${sceneId}`);
      }
    },
    [scene, kind, gameId, sceneId, updateMutation, searchParams, navigate, basePath]
  );

  /** 重命名子项文件（在 scene.data JSONB 中换 key） */
  const handleRenameItem = useCallback(
    (oldKey: string) => {
      if (!scene) return;
      const newKey = renameValue.trim();
      if (!newKey || newKey === oldKey) {
        setRenamingKey(null);
        return;
      }

      const sceneData = (scene.data ?? {}) as SceneData;
      const newData: SceneData = { ...sceneData };

      if (kind === "script" || kind === "trap") {
        const field = kind === "trap" ? "traps" : "scripts";
        const bucket = sceneData[field] ?? {};
        if (newKey !== oldKey && bucket[newKey]) {
          toast.error("同名文件已存在");
          return;
        }
        const { [oldKey]: content, ...rest } = bucket;
        newData[field] = { ...rest, [newKey]: content ?? "" };
      } else if (kind === "npc") {
        const bucket = sceneData.npc ?? {};
        if (newKey !== oldKey && bucket[newKey]) {
          toast.error("同名文件已存在");
          return;
        }
        const { [oldKey]: entry, ...rest } = bucket;
        newData.npc = { ...rest, [newKey]: entry ?? { key: newKey, entries: [] } };
      } else {
        const bucket = sceneData.obj ?? {};
        if (newKey !== oldKey && bucket[newKey]) {
          toast.error("同名文件已存在");
          return;
        }
        const { [oldKey]: entry, ...rest } = bucket;
        newData.obj = { ...rest, [newKey]: entry ?? { key: newKey, entries: [] } };
      }

      renameMutation.mutate({ gameId, id: sceneId, data: newData as Record<string, unknown> });
    },
    [scene, renameValue, kind, gameId, sceneId, renameMutation, toast]
  );

  if (itemKeys.length === 0) {
    return <div className="pl-12 py-0.5 text-xs text-[#555]">暂无</div>;
  }

  /** 渲染单个子项（右键菜单 + 内联重命名 + 确认删除） */
  const renderItem = (key: string, isActive: boolean, qs: string) => (
    <div key={key}>
      {renamingKey === key ? (
        <div className="flex items-center gap-1 px-1 py-0.5" style={{ paddingLeft: 44 }}>
          <input
            autoFocus
            className="flex-1 bg-[#3c3c3c] border border-focus-border rounded px-1.5 py-0.5 text-xs text-[#cccccc] outline-none min-w-0"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameItem(key);
              if (e.key === "Escape") setRenamingKey(null);
            }}
            onBlur={() => handleRenameItem(key)}
          />
        </div>
      ) : (
        <NavLink
          to={`${basePath}/${sceneId}?${qs}`}
          className={`flex items-center gap-1.5 py-0.5 pr-2 text-xs transition-colors truncate ${
            isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e] text-[#999]"
          }`}
          style={{ paddingLeft: 48 }}
          onContextMenu={(e) => {
            e.preventDefault();
            setItemContextMenu({ key, x: e.clientX, y: e.clientY });
          }}
        >
          <span className="text-[#666]">{DashboardIcons.file}</span>
          <span className="truncate">{key}</span>
        </NavLink>
      )}
      {/* 删除确认 */}
      {confirmDeleteKey === key && (
        <div
          className="flex items-center gap-1 px-2 py-1 bg-[#3c1f1f] text-xs"
          style={{ paddingLeft: 48 }}
        >
          <span className="text-red-300 flex-1 truncate">确认删除？</span>
          <button
            type="button"
            onClick={() => handleDeleteItem(key)}
            disabled={updateMutation.isPending}
            className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded text-xs transition-colors"
          >
            {updateMutation.isPending ? "..." : "删除"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteKey(null)}
            className="px-1.5 py-0.5 text-[#999] hover:text-white transition-colors"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );

  /** 共享的右键菜单（名称 + 分割线 + 重命名 + 删除） */
  const renderContextMenu = () =>
    itemContextMenu ? (
      <ContextMenu
        x={itemContextMenu.x}
        y={itemContextMenu.y}
        onClose={() => setItemContextMenu(null)}
        items={[
          { label: itemContextMenu.key, disabled: true, onClick: () => {} },
          { label: "", divider: true, onClick: () => {} },
          {
            label: "重命名",
            onClick: () => {
              setRenamingKey(itemContextMenu.key);
              setRenameValue(itemContextMenu.key);
            },
          },
          { label: "删除", danger: true, onClick: () => setConfirmDeleteKey(itemContextMenu.key) },
        ]}
      />
    ) : null;

  // NPC/OBJ/Script/Trap: 统一使用独立 key 参数
  const paramName =
    kind === "npc"
      ? "npcKey"
      : kind === "obj"
        ? "objKey"
        : kind === "script"
          ? "scriptKey"
          : "trapKey";
  const activeKey = searchParams.get(paramName);
  return (
    <>
      {itemKeys.map((key) => {
        const isActive = activeSceneId === sceneId && activeKey === key;
        const qs = buildSearchParams(searchParams, kind, key);
        return renderItem(key, isActive, qs);
      })}
      {renderContextMenu()}
    </>
  );
}

// ============= 数据库 NPC/OBJ 列表面板 (底部可折叠，用于拖拽到地图) =============

const NPC_RELATION_COLORS: Record<string, string> = {
  Friendly: "#4caf50",
  Hostile: "#f44336",
  Neutral: "#ffb300",
  Partner: "#42a5f5",
};

const NPC_RELATION_LABELS: Record<string, string> = {
  Friendly: "友好",
  Hostile: "敌对",
  Neutral: "中立",
  Partner: "伙伴",
};

const OBJ_KIND_LABELS: Record<string, string> = {
  Static: "静态",
  Dynamic: "动态",
  Body: "尸体",
  LoopingSound: "循环音效",
  RandSound: "随机音效",
  Door: "门",
  Trap: "陷阱",
  Drop: "掉落",
};

/**
 * 底部面板：显示数据库中的 NPC 和 OBJ 列表
 * 作为素材面板，用于将来拖拽添加到地图
 * 可折叠，编辑器风格，支持拖拽调整高度
 */
function SceneEntryListPanels({ sceneId, gameId }: { sceneId: string; gameId: string }) {
  const { currentGame } = useDashboard();
  const gameSlug = currentGame?.slug;

  const [npcCollapsed, setNpcCollapsed] = useState(false);
  const [objCollapsed, setObjCollapsed] = useState(false);
  const [npcSearch, setNpcSearch] = useState("");
  const [objSearch, setObjSearch] = useState("");

  // 拖拽调整高度
  const [panelHeight, setPanelHeight] = useState(280);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = panelHeight;

      const onMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = startYRef.current - ev.clientY;
        setPanelHeight(Math.max(80, Math.min(600, startHeightRef.current + delta)));
      };
      const onUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelHeight]
  );

  // 从数据库加载 NPC 和 OBJ 列表
  const { data: npcList, isLoading: npcLoading } = trpc.npc.list.useQuery(
    { gameId },
    { enabled: !!gameId }
  );
  const { data: objList, isLoading: objLoading } = trpc.obj.list.useQuery(
    { gameId },
    { enabled: !!gameId }
  );

  // 搜索过滤
  const filteredNpcs = useMemo(() => {
    if (!npcList) return [];
    if (!npcSearch.trim()) return npcList;
    const q = npcSearch.trim().toLowerCase();
    return npcList.filter(
      (n) => n.name.toLowerCase().includes(q) || n.key.toLowerCase().includes(q)
    );
  }, [npcList, npcSearch]);

  const filteredObjs = useMemo(() => {
    if (!objList) return [];
    if (!objSearch.trim()) return objList;
    const q = objSearch.trim().toLowerCase();
    return objList.filter(
      (o) => o.name.toLowerCase().includes(q) || o.key.toLowerCase().includes(q)
    );
  }, [objList, objSearch]);

  const bothCollapsed = npcCollapsed && objCollapsed;

  return (
    <div
      className="shrink-0 border-t border-panel-border flex flex-col"
      style={{ height: bothCollapsed ? "auto" : panelHeight }}
    >
      {/* 拖拽手柄 */}
      {!bothCollapsed && (
        <div
          className="h-[3px] shrink-0 cursor-ns-resize hover:bg-focus-border active:bg-focus-border transition-colors"
          onMouseDown={handleDragStart}
        />
      )}

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* NPC 列表 */}
        <CollapsibleDbList
          label="NPC 列表"
          icon={DashboardIcons.npc}
          count={npcList?.length ?? 0}
          collapsed={npcCollapsed}
          onToggle={() => setNpcCollapsed((v) => !v)}
          search={npcSearch}
          onSearchChange={setNpcSearch}
          isLoading={npcLoading}
        >
          {filteredNpcs.map((npc) => (
            <NpcDbRow key={npc.id} npc={npc} gameSlug={gameSlug} />
          ))}
          {filteredNpcs.length === 0 && !npcLoading && (
            <div className="px-3 py-2 text-xs text-[#555]">
              {npcSearch ? "无匹配结果" : "暂无 NPC"}
            </div>
          )}
        </CollapsibleDbList>

        {/* OBJ 列表 */}
        <CollapsibleDbList
          label="OBJ 列表"
          icon={DashboardIcons.obj}
          count={objList?.length ?? 0}
          collapsed={objCollapsed}
          onToggle={() => setObjCollapsed((v) => !v)}
          search={objSearch}
          onSearchChange={setObjSearch}
          isLoading={objLoading}
        >
          {filteredObjs.map((obj) => (
            <ObjDbRow key={obj.id} obj={obj} gameSlug={gameSlug} />
          ))}
          {filteredObjs.length === 0 && !objLoading && (
            <div className="px-3 py-2 text-xs text-[#555]">
              {objSearch ? "无匹配结果" : "暂无 OBJ"}
            </div>
          )}
        </CollapsibleDbList>
      </div>
    </div>
  );
}

/** 可折叠数据库列表容器 */
function CollapsibleDbList({
  label,
  icon,
  count,
  collapsed,
  onToggle,
  search,
  onSearchChange,
  isLoading,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col min-h-0 ${collapsed ? "" : "flex-1"}`}>
      {/* 折叠头部 */}
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 h-[22px] px-2 text-xs font-medium bg-[#2d2d2d] hover:bg-[#323232] transition-colors shrink-0 border-b border-panel-border select-none w-full text-left"
      >
        <span
          className={`text-[#858585] text-[10px] transition-transform inline-block ${collapsed ? "" : "rotate-90"}`}
        >
          {DashboardIcons.chevronRight}
        </span>
        <span className="text-[#858585]">{icon}</span>
        <span className="text-[#cccccc] uppercase tracking-wide">{label}</span>
        <span className="text-[#555] ml-auto font-normal">{count}</span>
      </button>

      {/* 搜索框 + 条目列表 */}
      {!collapsed && (
        <>
          <div className="px-1.5 py-1 border-b border-panel-border shrink-0">
            <input
              className="w-full bg-[#3c3c3c] border border-[#555] rounded px-1.5 py-0.5 text-xs text-[#cccccc] outline-none focus:border-focus-border placeholder-[#666]"
              placeholder="搜索..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="px-3 py-2 text-xs text-[#858585]">加载中...</div>
            ) : (
              children
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** 数据库 NPC 行 */
function NpcDbRow({
  npc,
  gameSlug,
}: {
  npc: {
    id: string;
    key: string;
    name: string;
    kind: string;
    relation: string;
    level?: number | null;
    npcIni: string;
    icon?: string | null;
  };
  gameSlug: string | undefined;
}) {
  const relationColor = NPC_RELATION_COLORS[npc.relation] ?? "#999";
  const relationLabel = NPC_RELATION_LABELS[npc.relation] ?? npc.relation;

  return (
    <div
      className="flex items-center gap-1.5 w-full py-[3px] px-2 text-xs hover:bg-[#2a2d2e] text-[#cccccc] cursor-grab active:cursor-grabbing transition-colors"
      title={`${npc.name} (${npc.key})\n${relationLabel} · ${npc.kind}\n拖拽到地图添加`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/miu2d-npc",
          JSON.stringify({
            id: npc.id,
            key: npc.key,
            name: npc.name,
            kind: npc.kind,
            relation: npc.relation,
            npcIni: npc.npcIni,
          })
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <LazyAsfIcon
        iconPath={npc.icon ?? undefined}
        gameSlug={gameSlug}
        size={20}
        prefix="asf/character/"
        fallback="🧙"
      />
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: relationColor }}
        title={relationLabel}
      />
      <span className="truncate flex-1">{npc.name}</span>
      {npc.level != null && (
        <span className="text-[10px] shrink-0 text-[#569cd6]">Lv.{npc.level}</span>
      )}
      <span className="text-[10px] shrink-0 text-[#555]">
        {npc.kind === "Fighter" ? "战斗" : "普通"}
      </span>
    </div>
  );
}

/** 数据库 OBJ 行 */
function ObjDbRow({
  obj,
  gameSlug,
}: {
  obj: {
    id: string;
    key: string;
    name: string;
    kind: string;
    objFile: string;
    icon?: string | null;
  };
  gameSlug: string | undefined;
}) {
  const kindLabel = OBJ_KIND_LABELS[obj.kind] ?? obj.kind;

  return (
    <div
      className="flex items-center gap-1.5 w-full py-[3px] px-2 text-xs hover:bg-[#2a2d2e] text-[#cccccc] cursor-grab active:cursor-grabbing transition-colors"
      title={`${obj.name} (${obj.key})\n${kindLabel}\n拖拽到地图添加`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/miu2d-obj",
          JSON.stringify({
            id: obj.id,
            key: obj.key,
            name: obj.name,
            kind: obj.kind,
            objFile: obj.objFile,
          })
        );
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <LazyAsfIcon
        iconPath={obj.icon ?? undefined}
        gameSlug={gameSlug}
        size={20}
        prefix="asf/object/"
        fallback="📦"
      />
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#81c784]" />
      <span className="truncate flex-1">{obj.name}</span>
      <span className="text-[10px] shrink-0 text-[#555]">{kindLabel}</span>
    </div>
  );
}
