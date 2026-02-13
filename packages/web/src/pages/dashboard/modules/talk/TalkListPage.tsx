/**
 * 对话管理页面 - 独立路由页面
 * 复用 TalkManagementPanel 组件
 */
import { useDashboard } from "../../DashboardContext";
import { TalkManagementPanel } from "../gameConfig/TalkManagementPanel";

export function TalkListPage() {
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id ?? "";

  return (
    <div className="h-full flex flex-col">
      {/* 固定顶部栏 */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b border-panel-border">
        <h2 className="text-base font-semibold text-white tracking-tight">对话管理</h2>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TalkManagementPanel gameId={gameId} />
      </div>
    </div>
  );
}
