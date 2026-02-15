/**
 * 场景首页（未选中场景时显示）
 */
import { trpc } from "@miu2d/shared";
import { useDashboard } from "../../DashboardContext";
import { DashboardIcons } from "../../icons";

export function ScenesHomePage() {
  const { currentGame } = useDashboard();
  const gameId = currentGame?.id;

  const { data: scenes, isLoading } = trpc.scene.list.useQuery(
    { gameId: gameId! },
    { enabled: !!gameId }
  );

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 opacity-20">{DashboardIcons.map}</div>
        <h2 className="text-lg font-medium text-[#cccccc] mb-2">场景编辑器</h2>
        <p className="text-sm text-[#858585]">
          {isLoading
            ? "加载中..."
            : scenes?.length
              ? `共 ${scenes.length} 个场景，选择左侧场景开始编辑`
              : "还没有场景数据，点击左侧「批量导入」开始"}
        </p>
      </div>
    </div>
  );
}
