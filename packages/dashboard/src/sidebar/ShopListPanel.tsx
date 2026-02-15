/**
 * 商店列表侧边栏面板
 */

import { trpc } from "@miu2d/shared";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ImportIniModal, readDroppedFiles } from "../components/common";
import { useDashboard } from "../DashboardContext";
import { DashboardIcons } from "../icons";

export function ShopListPanel({ basePath }: { basePath: string }) {
  const { currentGame } = useDashboard();
  const navigate = useNavigate();
  const gameId = currentGame?.id;
  const [showImportModal, setShowImportModal] = useState(false);

  const {
    data: shopList,
    isLoading,
    refetch,
  } = trpc.shop.list.useQuery({ gameId: gameId! }, { enabled: !!gameId });

  const createMutation = trpc.shop.create.useMutation({
    onSuccess: (data) => {
      refetch();
      navigate(`${basePath}/${data.id}`);
    },
  });

  const batchImportMutation = trpc.shop.batchImportFromIni.useMutation({
    onSuccess: (result) => {
      refetch();
      setShowImportModal(false);
      if (result.success.length > 0) {
        navigate(`${basePath}/${result.success[0].id}`);
      }
    },
  });

  const handleCreate = () => {
    if (!gameId) return;
    createMutation.mutate({
      gameId,
      key: `shop_${Date.now()}.ini`,
      name: "新商店",
    });
  };

  return (
    <>
      <div className="flex h-full w-60 flex-col bg-[#252526] border-r border-panel-border">
        {/* 标题栏 */}
        <div className="flex h-9 items-center justify-between px-4 border-b border-panel-border">
          <span className="text-xs font-medium uppercase tracking-wide text-[#bbbbbb]">
            商店列表
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
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#cccccc] hover:bg-[#3c3c3c] rounded transition-colors"
          >
            {DashboardIcons.add}
            <span>新建商店</span>
          </button>
        </div>

        {/* 商店列表 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="px-4 py-2 text-sm text-[#858585]">加载中...</div>
          ) : !shopList || shopList.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[#858585]">暂无商店</div>
          ) : (
            shopList.map((shop) => (
              <NavLink
                key={shop.id}
                to={`${basePath}/${shop.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-[#094771] text-white" : "hover:bg-[#2a2d2e]"
                  }`
                }
              >
                <span className="text-lg">🏪</span>
                <div className="flex-1 min-w-0">
                  <span className="truncate block">{shop.name}</span>
                  <span className="text-xs text-[#858585] truncate block">{shop.key}</span>
                </div>
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-[#3c3c3c] text-[#0098ff] font-mono">
                  {shop.itemCount}
                </span>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* INI 导入弹窗 */}
      {showImportModal && gameId && (
        <ImportIniModal<{ fileName: string; iniContent: string }>
          title="从 INI 导入商店"
          icon="📁"
          dropHint="拖放 INI 文件或 buy 目录到这里"
          dropSubHint="支持拖放整个 ini/buy 目录，批量导入所有商店配置"
          entityLabel="商店"
          onClose={() => setShowImportModal(false)}
          onImport={(items) => batchImportMutation.mutate({ gameId: gameId!, items })}
          isLoading={batchImportMutation.isPending}
          batchResult={batchImportMutation.data}
          processFiles={async (dt) => {
            const files = await readDroppedFiles(dt);
            return files.map((f) => ({ fileName: f.fileName, iniContent: f.content }));
          }}
          renderSuccessItem={(s) => (
            <>
              {s.name} ({(s as { itemCount?: number }).itemCount} 件商品)
            </>
          )}
          width="w-[550px]"
        />
      )}
    </>
  );
}
