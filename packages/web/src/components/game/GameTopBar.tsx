/**
 * GameTopBar - 游戏页面顶栏
 *
 * 左侧显示游戏名字，中间显示工具栏图标，右侧显示登录头像
 */

import { useAuth } from "@/contexts";

export interface ToolbarButton {
  id: string;
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  active?: boolean;
}

export interface GameTopBarProps {
  gameName: string;
  logoUrl?: string;
  /** 工具栏按钮列表 */
  toolbarButtons?: ToolbarButton[];
  /** 未登录时点击登录的回调（弹窗式） */
  onLoginClick?: () => void;
}

export function GameTopBar({ gameName, logoUrl, toolbarButtons, onLoginClick }: GameTopBarProps) {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="h-10 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 z-20 flex-shrink-0">
      {/* 左侧：Logo + 游戏名称 */}
      <div className="flex items-center gap-2 text-white/80 text-sm font-medium truncate min-w-0">
        {logoUrl && (
          <img src={logoUrl} alt="" className="w-6 h-6 rounded object-contain flex-shrink-0" />
        )}
        <span className="truncate">{gameName}</span>
      </div>

      {/* 中间：工具栏按钮 */}
      {toolbarButtons && toolbarButtons.length > 0 && (
        <div className="flex items-center gap-1">
          {toolbarButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={btn.onClick}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-base transition-all duration-150 relative group
                ${btn.active
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/10"}`}
              title={btn.tooltip}
            >
              {btn.icon}
              <span className="absolute top-full mt-1 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {btn.tooltip}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 右侧：用户信息 */}
      <div className="flex items-center gap-2">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs">{user.name}</span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLoginClick}
            className="px-3 py-1 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            登录
          </button>
        )}
      </div>
    </div>
  );
}
