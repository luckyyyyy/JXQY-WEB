/**
 * 物品列表侧边栏面板
 */

import { api } from "@miu2d/shared";
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CreateEntityModal, ImportIniModal, readDroppedFiles, type ImportResult } from "../components/common";
import { LazyAsfIcon } from "../components/common/LazyAsfIcon";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function GoodsListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // 分组折叠状态 (支持二级分组，如 "Equipment" 或 "Equipment:Hand")
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const {
    data: goodsList,
    isLoading,
    refetch,
  } = api.goods.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  // 装备部位标签
  const partLabels: Record<string, string> = {
    Hand: "武器",
    Head: "头部",
    Body: "身体",
    Foot: "鞋子",
    Neck: "项链",
    Back: "披风",
    Wrist: "手镯",
  };

  const partIcons: Record<string, string> = {
    Hand: "🗡️",
    Head: "👒",
    Body: "👘",
    Foot: "👟",
    Neck: "📿",
    Back: "🧥",
    Wrist: "⌚",
  };

  // 按种类分组，装备类继续按 Part 分组
  const groupedGoods = useMemo(() => {
    if (!goodsList) return { Consumable: [], Equipment: {}, Quest: [] };

    const consumables: typeof goodsList = [];
    const quests: typeof goodsList = [];
    const equipmentByPart: Record<string, typeof goodsList> = {};

    for (const g of goodsList) {
      if (g.kind === "Drug") {
        consumables.push(g);
      } else if (g.kind === "Event") {
        quests.push(g);
      } else if (g.kind === "Equipment") {
        const part = g.part || "Other";
        if (!equipmentByPart[part]) {
          equipmentByPart[part] = [];
        }
        equipmentByPart[part].push(g);
      }
    }

    return {
      Consumable: consumables,
      Equipment: equipmentByPart,
      Quest: quests,
    };
  }, [goodsList]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const batchImportMutation = api.goods.batchImportFromIni.useMutation({
    onSuccess: (_result) => {
      const result = _result as ImportResult;
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  const kindLabels = {
    Consumable: "消耗品",
    Equipment: "装备",
    Quest: "任务道具",
  };

  const kindIcons = {
    Consumable: "🍵",
    Equipment: "⚔️",
    Quest: "📜",
  };

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            物品列表
          </span>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col gap-1 p-2 border-b border-panel-border">
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.upload}
            <span>从 INI 导入</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建物品</span>
          </button>
        </div>

        {/* 物品列表 - 按种类分组树形展示 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !goodsList || goodsList.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无物品</div>
          ) : (
            <>
              {/* 消耗品分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Drug")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span
                    className={`transition-transform ${collapsedGroups.Consumable ? "" : "rotate-90"}`}
                  >
                    ▶
                  </span>
                  <span>{kindIcons.Consumable}</span>
                  <span>{kindLabels.Consumable}</span>
                  <span className="text-[#666]">({groupedGoods.Consumable.length})</span>
                </button>
                {!collapsedGroups.Consumable &&
                  groupedGoods.Consumable.map((goods) => (
                    <NavLink
                      key={goods.id}
                      to={`${basePath}/${goods.id}`}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                          isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                        }`
                      }
                    >
                      <LazyAsfIcon
                        iconPath={goods.icon}
                        gameSlug={currentGame?.slug}
                        size={32}
                        prefix="asf/goods/"
                        fallback="📦"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">{goods.name}</span>
                        <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                      </div>
                    </NavLink>
                  ))}
              </div>

              {/* 装备分组 - 带二级子分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Equipment")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span
                    className={`transition-transform ${collapsedGroups.Equipment ? "" : "rotate-90"}`}
                  >
                    ▶
                  </span>
                  <span>{kindIcons.Equipment}</span>
                  <span>{kindLabels.Equipment}</span>
                  <span className="text-[#666]">
                    ({Object.values(groupedGoods.Equipment).flat().length})
                  </span>
                </button>
                {!collapsedGroups.Equipment &&
                  Object.entries(groupedGoods.Equipment).map(([part, items]) => (
                    <div key={part}>
                      {/* 二级分组标题 - Part */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(`Equipment:${part}`)}
                        className="w-full px-3 py-1 pl-6 text-xs text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                      >
                        <span
                          className={`transition-transform text-[10px] ${collapsedGroups[`Equipment:${part}`] ? "" : "rotate-90"}`}
                        >
                          ▶
                        </span>
                        <span>{partIcons[part] || "📦"}</span>
                        <span>{partLabels[part] || part}</span>
                        <span className="text-[#555]">({items.length})</span>
                      </button>
                      {/* 二级分组内容 */}
                      {!collapsedGroups[`Equipment:${part}`] &&
                        items.map((goods) => (
                          <NavLink
                            key={goods.id}
                            to={`${basePath}/${goods.id}`}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 pl-10 text-sm transition-colors ${
                                isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                              }`
                            }
                          >
                            <LazyAsfIcon
                              iconPath={goods.icon}
                              gameSlug={currentGame?.slug}
                              size={32}
                              prefix="asf/goods/"
                              fallback="📦"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">{goods.name}</span>
                              <span className="text-xs text-[#858585] truncate block">
                                {goods.key}
                              </span>
                            </div>
                          </NavLink>
                        ))}
                    </div>
                  ))}
              </div>

              {/* 任务道具分组 */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleGroup("Event")}
                  className="w-full px-3 py-1.5 text-xs font-medium text-[#858585] flex items-center gap-2 hover:bg-[#2a2d2e] transition-colors"
                >
                  <span
                    className={`transition-transform ${collapsedGroups.Quest ? "" : "rotate-90"}`}
                  >
                    ▶
                  </span>
                  <span>{kindIcons.Quest}</span>
                  <span>{kindLabels.Quest}</span>
                  <span className="text-[#666]">({groupedGoods.Quest.length})</span>
                </button>
                {!collapsedGroups.Quest &&
                  groupedGoods.Quest.map((goods) => (
                    <NavLink
                      key={goods.id}
                      to={`${basePath}/${goods.id}`}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 pl-6 text-sm transition-colors ${
                          isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                        }`
                      }
                    >
                      <LazyAsfIcon
                        iconPath={goods.icon}
                        gameSlug={currentGame?.slug}
                        size={32}
                        prefix="asf/goods/"
                        fallback="📦"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">{goods.name}</span>
                        <span className="text-xs text-[#858585] truncate block">{goods.key}</span>
                      </div>
                    </NavLink>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* INI 导入模态框 */}
      {showImportModal && (
        <ImportIniModal<{ fileName: string; iniContent: string }>
          title="从 INI 导入物品"
          icon="📦"
          dropHint="拖放 INI 文件或文件夹到此处"
          dropSubHint="支持批量导入"
          entityLabel="物品"
          onClose={() => setShowImportModal(false)}
          onImport={(items) => batchImportMutation.mutate({ gameId: gameId!, items })}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data as ImportResult | undefined}
          processFiles={async (dt) => {
            const files = await readDroppedFiles(dt);
            return files.map((f) => ({ fileName: f.fileName, iniContent: f.content }));
          }}
        />
      )}

      {/* 新建物品模态框 */}
      {showCreateModal && (
        <CreateGoodsModal
          onClose={() => setShowCreateModal(false)}
          basePath={basePath}
          gameId={gameId!}
          onSuccess={() => refetch()}
        />
      )}
    </>
  );
}

// ========== 新建物品弹窗 ==========
function CreateGoodsModal({
  onClose,
  basePath,
  gameId,
  onSuccess,
}: {
  onClose: () => void;
  basePath: string;
  gameId: string;
  onSuccess: () => void;
}) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<"Drug" | "Equipment" | "Event">("Drug");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [intro, setIntro] = useState("");

  const createMutation = api.goods.create.useMutation({
    onSuccess: (data) => {
      onSuccess();
      onClose();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const kindOptions: Array<{
    value: "Drug" | "Equipment" | "Event";
    icon: string;
    label: string;
    activeClass: string;
  }> = [
    {
      value: "Drug",
      icon: "🍵",
      label: "消耗品",
      activeClass: "bg-green-600/20 border-green-500 text-green-400",
    },
    {
      value: "Equipment",
      icon: "⚔️",
      label: "装备",
      activeClass: "bg-blue-600/20 border-blue-500 text-blue-400",
    },
    {
      value: "Event",
      icon: "📜",
      label: "任务道具",
      activeClass: "bg-yellow-600/20 border-yellow-500 text-yellow-400",
    },
  ];

  return (
    <CreateEntityModal
      title="新建物品"
      onClose={onClose}
      onCreate={() =>
        createMutation.mutate({
          gameId,
          kind,
          key: key || `goods_${Date.now()}`,
          name: name || "新物品",
          intro: intro || undefined,
        })
      }
      createDisabled={!name.trim()}
      isPending={createMutation.isPending}
      error={createMutation.error}
      width="w-[480px]"
    >
      {/* 类型选择 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-2">物品类型</label>
        <div className="flex gap-2">
          {kindOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setKind(opt.value)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded-lg border transition-colors ${
                kind === opt.value
                  ? opt.activeClass
                  : "bg-[#3c3c3c] border-[#555] text-[#cccccc] hover:border-[#666]"
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              <span className="text-xs">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* 物品名称 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">
          物品名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：金创药"
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
        />
      </div>
      {/* 标识符 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">标识符 (Key)</label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="例如：goods-m00-金创药.ini（留空自动生成）"
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border"
        />
      </div>
      {/* 物品介绍 */}
      <div>
        <label className="block text-sm text-[#cccccc] mb-1">物品介绍</label>
        <textarea
          rows={2}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="简单描述物品的用途..."
          className="w-full px-3 py-2 bg-[#1e1e1e] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border resize-none"
        />
      </div>
    </CreateEntityModal>
  );
}
