/**
 * 数据统计页面
 */
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardIcons } from "../icons";
import { trpc } from "../../../lib/trpc";
import { ResponsiveGrid } from "../../../components/ui/ResponsiveGrid";

const MonacoEditor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

export function StatisticsHomePage() {
  const { gameId } = useParams();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">数据统计</h1>

        {/* 概览卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "总玩家数", value: "1,234", change: "+12%" },
            { label: "今日活跃", value: "567", change: "+5%" },
            { label: "平均游戏时长", value: "45分钟", change: "+8%" },
            { label: "完成度", value: "23%", change: "-" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 bg-[#252526] border border-widget-border rounded-lg"
            >
              <p className="text-sm text-[#858585] mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-[#4ec9b0] mt-1">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-[#252526] border border-widget-border rounded-lg p-4">
            <h3 className="text-[#bbbbbb] font-medium mb-4">玩家活跃趋势</h3>
            <div className="h-48 flex items-center justify-center text-[#444]">
              图表区域
            </div>
          </div>
          <div className="bg-[#252526] border border-widget-border rounded-lg p-4">
            <h3 className="text-[#bbbbbb] font-medium mb-4">关卡完成分布</h3>
            <div className="h-48 flex items-center justify-center text-[#444]">
              图表区域
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerDataPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl">
        <h1 className="text-xl font-bold text-white mb-6">玩家数据</h1>
        <div className="bg-[#252526] border border-widget-border rounded-lg p-12 text-center">
          <div className="text-[#858585] text-4xl mb-3">🚧</div>
          <p className="text-[#cccccc] font-medium">功能开发中</p>
          <p className="text-[#555] text-sm mt-1">玩家数据分析功能正在开发中，敬请期待</p>
        </div>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars -- placeholder for future */
function _PlayerDataPageOld() {
  const _placeholder = DashboardIcons.search; // keep import used
  return null;
}

export function PlayerSavesPage() {
  const { gameId: gameSlug } = useParams<{ gameId: string }>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const utils = trpc.useUtils();

  const savesQuery = trpc.save.adminList.useQuery(
    { gameSlug, page, pageSize: 20 },
    { enabled: !!gameSlug },
  );

  const saveDetailQuery = trpc.save.adminGet.useQuery(
    { saveId: selectedSaveId! },
    { enabled: !!selectedSaveId },
  );

  const deleteMutation = trpc.save.adminDelete.useMutation({
    onSuccess: () => {
      utils.save.adminList.invalidate();
      setConfirmDelete(null);
      setSelectedSaveId(null);
    },
  });

  const createMutation = trpc.save.adminCreate.useMutation({
    onSuccess: () => {
      utils.save.adminList.invalidate();
      setShowCreateModal(false);
    },
  });

  const updateMutation = trpc.save.adminUpdate.useMutation({
    onSuccess: () => {
      utils.save.adminList.invalidate();
      if (selectedSaveId) utils.save.adminGet.invalidate({ saveId: selectedSaveId });
    },
  });

  const shareMutation = trpc.save.adminShare.useMutation({
    onSuccess: () => {
      utils.save.adminList.invalidate();
      if (selectedSaveId) utils.save.adminGet.invalidate({ saveId: selectedSaveId });
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("zh-CN");
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const now = Date.now();
      const then = new Date(dateStr).getTime();
      const diff = now - then;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return "刚刚";
      if (minutes < 60) return `${minutes}分钟前`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}小时前`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}天前`;
      return formatDate(dateStr);
    } catch {
      return dateStr;
    }
  };

  // 客户端过滤（简单搜索）
  const filteredItems = savesQuery.data?.items.filter((save) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (save.userName ?? "").toLowerCase().includes(q) ||
      save.name.toLowerCase().includes(q) ||
      (save.playerName ?? "").toLowerCase().includes(q) ||
      (save.mapName ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = savesQuery.data ? Math.ceil(savesQuery.data.total / 20) : 1;

  return (
    <div className="h-full overflow-auto p-6">
      <div>
        {/* 标题和统计 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">玩家存档管理</h1>
            <p className="text-sm text-[#858585] mt-1">
              查看和管理所有玩家的存档数据
              {savesQuery.data && (
                <span className="ml-2">
                  · 共 <span className="text-[#4ec9b0]">{savesQuery.data.total}</span> 个存档
                </span>
              )}
            </p>
          </div>
        </div>

        {/* 搜索 */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]">
              {DashboardIcons.search}
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索玩家名、存档名、角色名、地图..."
              className="w-full pl-10 pr-4 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm placeholder-[#858585] focus:outline-none focus:border-focus-border"
            />
          </div>
          <button
            onClick={() => savesQuery.refetch()}
            className="px-3 py-2 text-sm bg-[#3c3c3c] border border-widget-border rounded text-[#cccccc] hover:bg-[#454545] transition-colors"
          >
            刷新
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
          >
            创建存档
          </button>
        </div>

        {/* 存档卡片网格 */}
        {savesQuery.isLoading ? (
          <ResponsiveGrid minColWidth={280} gap={4}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-[#252526] border border-widget-border rounded-lg p-4 animate-pulse">
                <div className="h-32 bg-[#3c3c3c] rounded mb-3" />
                <div className="h-4 bg-[#3c3c3c] rounded w-3/4 mb-2" />
                <div className="h-3 bg-[#3c3c3c] rounded w-1/2" />
              </div>
            ))}
          </ResponsiveGrid>
        ) : filteredItems?.length === 0 ? (
          <div className="bg-[#252526] border border-widget-border rounded-lg p-12 text-center">
            <div className="text-[#858585] text-4xl mb-3">📂</div>
            <p className="text-[#858585]">{search ? "没有匹配的存档" : "暂无存档"}</p>
            <p className="text-[#555] text-sm mt-1">
              {search ? "尝试修改搜索关键词" : "玩家在游戏中存档后将显示在这里"}
            </p>
          </div>
        ) : (
          <ResponsiveGrid minColWidth={280} gap={4}>
            {filteredItems?.map((save) => (
              <div
                key={save.id}
                className="bg-[#252526] border border-widget-border rounded-lg overflow-hidden hover:border-[#0098ff]/50 transition-colors group"
              >
                {/* 截图预览 */}
                <div
                  className="h-36 bg-[#1a1a1a] relative cursor-pointer"
                  onClick={() => setSelectedSaveId(save.id)}
                >
                  {save.screenshot ? (
                    <img
                      src={save.screenshot}
                      alt={save.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#444]">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="size-12 opacity-30">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                      </svg>
                    </div>
                  )}
                  {/* 分享状态角标 */}
                  {save.isShared && (
                    <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 bg-green-600/80 text-white rounded">
                      已分享
                    </span>
                  )}
                  {/* 悬停遮罩 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-sm bg-black/50 px-3 py-1.5 rounded">查看详情</span>
                  </div>
                </div>

                {/* 信息区域 */}
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#cccccc] font-medium text-sm truncate">{save.name}</h3>
                      <p className="text-[#858585] text-xs mt-0.5 flex items-center gap-1">
                        <span className="text-[#4ec9b0]">{save.userName ?? "未知用户"}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(save.updatedAt)}</span>
                      </p>
                    </div>
                  </div>

                  {/* 角色信息标签 */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {save.playerName && (
                      <span className="text-xs px-1.5 py-0.5 bg-[#1e1e1e] text-[#cccccc] rounded border border-widget-border">
                        👤 {save.playerName}
                      </span>
                    )}
                    {save.level != null && (
                      <span className="text-xs px-1.5 py-0.5 bg-[#1e1e1e] text-[#4ec9b0] rounded border border-widget-border">
                        Lv.{save.level}
                      </span>
                    )}
                    {save.mapName && (
                      <span className="text-xs px-1.5 py-0.5 bg-[#1e1e1e] text-[#858585] rounded border border-widget-border">
                        📍 {save.mapName}
                      </span>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedSaveId(save.id)}
                      className="flex-1 px-2 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
                    >
                      查看数据
                    </button>
                    <a
                      href={`/game/${gameSlug}?loadSave=${save.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-2 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#454545] text-[#cccccc] rounded transition-colors text-center"
                    >
                      读档测试
                    </a>
                    <button
                      onClick={() => setConfirmDelete(save.id)}
                      className="px-2 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#5a1d1d] text-[#858585] hover:text-[#f48771] rounded transition-colors"
                      title="删除存档"
                    >
                      {DashboardIcons.delete}
                    </button>
                    <button
                      onClick={() => shareMutation.mutate({ saveId: save.id, isShared: !save.isShared })}
                      disabled={shareMutation.isPending}
                      className={`px-2 py-1.5 text-xs rounded transition-colors ${
                        save.isShared
                          ? "bg-green-600/30 text-green-400 hover:bg-red-500/20 hover:text-red-300"
                          : "bg-[#3c3c3c] text-[#858585] hover:bg-green-600/20 hover:text-green-400"
                      }`}
                      title={save.isShared ? "取消分享" : "分享"}
                    >
                      🔗
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </ResponsiveGrid>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm bg-[#3c3c3c] text-[#cccccc] rounded disabled:opacity-40 hover:bg-[#454545] transition-colors"
            >
              上一页
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 text-sm rounded transition-colors ${
                      page === pageNum
                        ? "bg-[#0e639c] text-white"
                        : "bg-[#3c3c3c] text-[#cccccc] hover:bg-[#454545]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm bg-[#3c3c3c] text-[#cccccc] rounded disabled:opacity-40 hover:bg-[#454545] transition-colors"
            >
              下一页
            </button>
          </div>
        )}

        {/* 存档数据详情弹窗 */}
        {selectedSaveId && (
          <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setSelectedSaveId(null)}
          >
            <div
              className="bg-[#1e1e1e] border border-widget-border rounded-lg w-full max-w-5xl h-[75vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 弹窗头部 */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-widget-border shrink-0">
                <div>
                  <h3 className="text-white font-medium">存档详情</h3>
                  {saveDetailQuery.data && (
                    <p className="text-xs text-[#858585] mt-0.5">
                      {saveDetailQuery.data.userName} · {saveDetailQuery.data.name} · {formatDate(saveDetailQuery.data.updatedAt)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSaveId(null)}
                  className="text-[#858585] hover:text-white transition-colors p-1"
                >
                  ✕
                </button>
              </div>

              {/* 弹窗内容 */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {saveDetailQuery.isLoading ? (
                  <div className="text-[#858585] text-center py-8">加载中...</div>
                ) : saveDetailQuery.data ? (
                  <>
                    {/* 摘要信息条 - 紧凑单行 */}
                    <div className="flex items-center gap-3 px-4 py-2 border-b border-panel-border shrink-0">
                      {saveDetailQuery.data.screenshot && (
                        <img
                          src={saveDetailQuery.data.screenshot}
                          alt=""
                          className="w-16 h-10 rounded object-cover border border-widget-border shrink-0"
                        />
                      )}
                      <div className="flex items-center gap-3 text-xs text-[#858585] min-w-0 flex-wrap">
                        <span>玩家 <span className="text-[#4ec9b0]">{saveDetailQuery.data.userName ?? "未知"}</span></span>
                        {saveDetailQuery.data.playerName && (
                          <span>角色 <span className="text-[#cccccc]">{saveDetailQuery.data.playerName}</span></span>
                        )}
                        {saveDetailQuery.data.level != null && (
                          <span className="text-[#4ec9b0]">Lv.{saveDetailQuery.data.level}</span>
                        )}
                        {saveDetailQuery.data.mapName && (
                          <span>地图 <span className="text-[#cccccc]">{saveDetailQuery.data.mapName}</span></span>
                        )}
                      </div>
                    </div>

                    {/* JSON 数据 - 填满剩余空间 */}
                    <div className="flex-1 min-h-0">
                      <SaveDataEditor
                        saveId={selectedSaveId!}
                        data={saveDetailQuery.data.data}
                        onSave={(saveId, newData) => updateMutation.mutate({ saveId, data: newData })}
                        isSaving={updateMutation.isPending}
                        saveError={updateMutation.error?.message}
                        saveSuccess={updateMutation.isSuccess}
                        onResetStatus={() => updateMutation.reset()}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-[#858585] text-center py-8">加载失败</div>
                )}
              </div>

              {/* 弹窗底部操作 */}
              {saveDetailQuery.data && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-widget-border shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#858585]">
                      ID: {saveDetailQuery.data.id}
                    </span>
                    {saveDetailQuery.data.isShared && saveDetailQuery.data.shareCode && (
                      <span className="text-xs text-green-400">
                        分享码: {saveDetailQuery.data.shareCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/game/${gameSlug}?loadSave=${saveDetailQuery.data.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors"
                    >
                      读档测试
                    </a>
                    <button
                      onClick={() => shareMutation.mutate({ saveId: saveDetailQuery.data!.id, isShared: !saveDetailQuery.data!.isShared })}
                      disabled={shareMutation.isPending}
                      className={`px-3 py-1.5 text-sm rounded transition-colors ${
                        saveDetailQuery.data.isShared
                          ? "bg-green-600/30 text-green-400 hover:bg-red-500/20 hover:text-red-300"
                          : "bg-[#3c3c3c] text-[#858585] hover:bg-green-600/20 hover:text-green-400"
                      }`}
                    >
                      {saveDetailQuery.data.isShared ? "取消分享" : "分享"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(saveDetailQuery.data!.id)}
                      className="px-3 py-1.5 text-sm bg-[#5a1d1d] hover:bg-[#742a2a] text-[#f48771] rounded transition-colors"
                    >
                      删除存档
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 删除确认弹窗 */}
        {confirmDelete && (
          <div
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="bg-[#1e1e1e] border border-widget-border rounded-lg w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-white font-medium mb-2">确认删除</h3>
              <p className="text-[#858585] text-sm mb-4">
                此操作将永久删除该存档，无法恢复。确定要继续吗？
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-3 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#454545] text-[#cccccc] rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => deleteMutation.mutate({ saveId: confirmDelete })}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-[#5a1d1d] hover:bg-[#742a2a] text-[#f48771] rounded transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "删除中..." : "确认删除"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 创建存档弹窗 */}
        {showCreateModal && gameSlug && (
          <AdminCreateSaveModal
            gameSlug={gameSlug}
            isPending={createMutation.isPending}
            error={createMutation.error?.message}
            onSubmit={(input) => createMutation.mutate(input)}
            onClose={() => { setShowCreateModal(false); createMutation.reset(); }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 管理员创建存档弹窗 - 输入 JSON 数据创建存档
 */
function AdminCreateSaveModal({
  gameSlug,
  isPending,
  error,
  onSubmit,
  onClose,
}: {
  gameSlug: string;
  isPending: boolean;
  error?: string;
  onSubmit: (input: { gameSlug: string; name: string; mapName?: string; level?: number; playerName?: string; data: Record<string, unknown> }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState("");

  const handleSubmit = () => {
    setParseError("");

    const trimmed = jsonText.trim();
    if (!trimmed) {
      setParseError("请输入存档 JSON 数据");
      return;
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      setParseError("JSON 格式不正确");
      return;
    }

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      setParseError("JSON 必须是一个对象");
      return;
    }

    const saveName = name.trim() || `管理员存档 ${new Date().toLocaleString("zh-CN")}`;

    onSubmit({
      gameSlug,
      name: saveName,
      data,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] border border-widget-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-widget-border shrink-0">
          <h3 className="text-white font-medium">创建存档</h3>
          <button
            onClick={onClose}
            className="text-[#858585] hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* 存档名称 */}
          <div>
            <label className="text-[#858585] text-xs mb-1.5 block">存档名称（可选）</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="留空则自动生成"
              maxLength={100}
              className="w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded text-white text-sm placeholder-[#858585] focus:outline-none focus:border-focus-border"
            />
          </div>

          {/* JSON 数据 */}
          <div>
            <label className="text-[#858585] text-xs mb-1.5 block">存档 JSON 数据</label>
            <div className="border border-widget-border rounded overflow-hidden">
              <Suspense fallback={<div className="h-[400px] bg-[#1a1a1a] flex items-center justify-center text-[#858585] text-sm">加载编辑器...</div>}>
                <MonacoEditor
                  height="400px"
                  language="json"
                  theme="vs-dark"
                  value={jsonText}
                  onChange={(v) => { setJsonText(v ?? ""); setParseError(""); }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 12,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                  }}
                />
              </Suspense>
            </div>
          </div>

          {/* 错误提示 */}
          {(parseError || error) && (
            <p className="text-[#f48771] text-sm">{parseError || error}</p>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-widget-border shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm bg-[#3c3c3c] hover:bg-[#454545] text-[#cccccc] rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors disabled:opacity-50"
          >
            {isPending ? "创建中..." : "创建存档"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 存档数据编辑器 - 使用 Monaco Editor 编辑 JSON，支持保存
 * 过滤掉 screenshot 等超大 base64 字段避免卡顿
 */
function SaveDataEditor({
  saveId,
  data,
  onSave,
  isSaving,
  saveError,
  saveSuccess,
  onResetStatus,
}: {
  saveId: string;
  data: Record<string, unknown>;
  onSave: (saveId: string, data: Record<string, unknown>) => void;
  isSaving: boolean;
  saveError?: string;
  saveSuccess: boolean;
  onResetStatus: () => void;
}) {
  // 记录被过滤的 screenshot 原始值，保存时还原
  const screenshotRef = useRef<string | null>(null);
  const [parseError, setParseError] = useState("");
  const editorValueRef = useRef("");
  const [isDirty, setIsDirty] = useState(false);

  const jsonString = useMemo(() => {
    // 过滤掉 screenshot 等超大 base64 字段，避免渲染卡死
    let screenshotValue: string | null = null;
    const filtered = Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        if (key === "screenshot" && typeof value === "string" && value.length > 1000) {
          screenshotValue = value;
          return [key, `[base64 image, ${(value.length / 1024).toFixed(0)}KB]`];
        }
        return [key, value];
      }),
    );
    screenshotRef.current = screenshotValue;
    const str = JSON.stringify(filtered, null, 2);
    editorValueRef.current = str;
    return str;
  }, [data]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    editorValueRef.current = value ?? "";
    setIsDirty(true);
    setParseError("");
    onResetStatus();
  }, [onResetStatus]);

  const handleSave = useCallback(() => {
    setParseError("");
    const text = editorValueRef.current.trim();
    if (!text) {
      setParseError("JSON 数据不能为空");
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      setParseError("JSON 格式不正确，请检查语法");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setParseError("JSON 必须是一个对象");
      return;
    }
    // 还原被过滤的 screenshot
    if (screenshotRef.current && typeof parsed.screenshot === "string" && parsed.screenshot.startsWith("[base64")) {
      parsed.screenshot = screenshotRef.current;
    }
    onSave(saveId, parsed);
    setIsDirty(false);
  }, [saveId, onSave]);

  return (
    <div className="h-full flex flex-col">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-widget-border shrink-0">
        <div className="flex items-center gap-2 text-xs">
          {parseError && <span className="text-[#f48771]">{parseError}</span>}
          {saveError && <span className="text-[#f48771]">保存失败: {saveError}</span>}
          {saveSuccess && <span className="text-[#4ec9b0]">保存成功</span>}
          {isDirty && !parseError && !saveError && !saveSuccess && (
            <span className="text-[#cca700]">已修改</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || (!isDirty && !parseError)}
          className="px-3 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-colors disabled:opacity-40"
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
      </div>
      {/* 编辑器 */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="h-full bg-[#1a1a1a] flex items-center justify-center text-[#858585] text-sm">加载编辑器...</div>}>
          <MonacoEditor
            height="100%"
            language="json"
            theme="vs-dark"
            defaultValue={jsonString}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              folding: true,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
