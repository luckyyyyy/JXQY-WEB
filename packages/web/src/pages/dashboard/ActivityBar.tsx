/**
 * Dashboard 活动条 (Activity Bar)
 * VS Code 风格的左侧图标导航栏
 */
import { NavLink, useParams, useLocation } from "react-router-dom";
import { useDashboard } from "./DashboardContext";
import { DashboardIcons, type IconName } from "./icons";
import type { ModuleId } from "./types";

interface ActivityBarItem {
  id: ModuleId;
  icon: IconName;
  label: string;
  path: string;
  /** 子模块路径前缀（点击此项时，如果当前已在子模块中则保持不跳转） */
  childPaths?: string[];
}

const activityBarItems: ActivityBarItem[] = [
  { id: "gameSettings", icon: "game", label: "游戏", path: "game" },
  { id: "player", icon: "character", label: "角色", path: "player" },
  {
    id: "gameModules",
    icon: "gameModules",
    label: "模块",
    path: "game-modules",
    childPaths: ["npcs", "magic", "goods", "objs", "shops", "levels", "talks"],
  },
  { id: "scenes", icon: "map", label: "场景", path: "scenes" },
  { id: "resources", icon: "folder", label: "资源", path: "resources" },
  { id: "statistics", icon: "chart", label: "统计", path: "statistics" },
];

export function ActivityBar() {
  const { gameId } = useParams();
  const { activeModule, setActiveModule } = useDashboard();
  const location = useLocation();

  const basePath = gameId ? `/dashboard/${gameId}` : "/dashboard";

  return (
    <div className="flex w-12 flex-col bg-[#333333] border-r border-panel-border">
      {/* 主导航图标 */}
      <nav className="flex flex-1 flex-col">
        {activityBarItems.map((item) => {
          // 判断是否激活：自身路径 或 子模块路径
          const isSelfActive = location.pathname.startsWith(`${basePath}/${item.path}`);
          const isChildActive = item.childPaths?.some((cp) =>
            location.pathname.startsWith(`${basePath}/${cp}`)
          );
          const isActive = isSelfActive || !!isChildActive;

          return (
            <NavLink
              key={item.id}
              to={`${basePath}/${item.path}`}
              onClick={() => setActiveModule(item.id)}
              title={item.label}
              className={`group relative flex h-12 w-full flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive
                  ? "bg-[#252526] text-white before:absolute before:left-0 before:h-full before:w-0.5 before:bg-white"
                  : "text-[#858585] hover:bg-[#2a2d2e] hover:text-white"
              }`}
            >
              {DashboardIcons[item.icon]}
              <span className="text-[9px] leading-none">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* 底部图标 */}
      <div className="flex flex-col border-t border-panel-border">
        <a
          href={gameId ? `/game/${gameId}` : "/"}
          target="_blank"
          rel="noopener noreferrer"
          title="进入游戏"
          className="group relative flex h-12 w-full flex-col items-center justify-center gap-0.5 text-[#858585] transition-colors hover:bg-[#2a2d2e] hover:text-white"
        >
          {DashboardIcons.game}
          <span className="text-[9px] leading-none">游戏</span>
        </a>
      </div>
    </div>
  );
}
