/**
 * Dashboard 首页
 */
import { useParams, Link } from "react-router-dom";
import { useDashboard } from "./DashboardContext";
import { DashboardIcons } from "./icons";

export function DashboardHome() {
  const { gameId } = useParams();
  const { currentGame } = useDashboard();

  const basePath = gameId ? `/dashboard/${gameId}` : "/dashboard";

  const quickLinks = [
    { icon: "game", label: "游戏配置", path: `${basePath}/game/config`, color: "#0098ff" },
    { icon: "character", label: "玩家角色", path: `${basePath}/player`, color: "#4ec9b0" },
    { icon: "npc", label: "NPC编辑", path: `${basePath}/npcs`, color: "#dcdcaa" },
    { icon: "map", label: "场景编辑", path: `${basePath}/scenes`, color: "#ce9178" },
    { icon: "magic", label: "武功编辑", path: `${basePath}/magic`, color: "#c586c0" },
    { icon: "script", label: "脚本编辑", path: `${basePath}/scripts`, color: "#9cdcfe" },
  ] as const;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* 欢迎区域 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            {currentGame ? `${currentGame.name} - 控制台` : "游戏控制台"}
          </h1>
          <p className="text-[#858585]">
            {currentGame?.description || "选择左侧菜单开始编辑您的游戏"}
          </p>
        </div>

        {/* 快速入口 */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">快速入口</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {quickLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-3 p-4 bg-[#252526] hover:bg-[#2a2d2e] border border-widget-border rounded-lg transition-colors group"
              >
                <span style={{ color: link.color }}>
                  {DashboardIcons[link.icon]}
                </span>
                <span className="text-[#cccccc] group-hover:text-white transition-colors">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 最近编辑 */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">最近编辑</h2>
          <div className="bg-[#252526] border border-widget-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-widget-border text-sm text-[#858585]">
              暂无最近编辑记录
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <div>
          <h2 className="text-lg font-medium text-[#bbbbbb] mb-4">项目统计</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "角色", count: 3, icon: "character" },
              { label: "NPC", count: 25, icon: "npc" },
              { label: "物品", count: 128, icon: "goods" },
              { label: "场景", count: 15, icon: "map" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-4 bg-[#252526] border border-widget-border rounded-lg"
              >
                <div className="flex items-center gap-2 mb-2 text-[#858585]">
                  {DashboardIcons[stat.icon as keyof typeof DashboardIcons]}
                  <span className="text-sm">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{stat.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
