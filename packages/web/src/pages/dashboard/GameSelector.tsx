/**
 * 游戏空间选择器
 * 显示在顶部左上角，可切换不同的游戏空间
 */
import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Game } from "@miu2d/types";
import { DashboardIcons } from "./icons";
import { useDashboard } from "./DashboardContext";
import { trpc } from "../../lib/trpc";
import { GameSettingsModal } from "./components/GameSettingsModal";

interface GameSelectorProps {
  games: Game[];
  isLoading?: boolean;
  onCreateGame?: () => void;
}

export function GameSelector({
  games,
  isLoading = false,
  onCreateGame,
}: GameSelectorProps) {
  const { currentGame, setCurrentGame } = useDashboard();
  const [isOpen, setIsOpen] = useState(false);
  const [settingsGame, setSettingsGame] = useState<Game | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { gameId } = useParams();

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 根据 URL 参数自动选中游戏
  useEffect(() => {
    if (gameId && games.length > 0) {
      const game = games.find((g) => g.slug === gameId || g.id === gameId);
      if (game && (!currentGame || currentGame.id !== game.id)) {
        setCurrentGame(game);
      }
    }
  }, [gameId, games, currentGame, setCurrentGame]);

  const handleSelectGame = (game: Game) => {
    setCurrentGame(game);
    setIsOpen(false);
    navigate(`/dashboard/${game.slug}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#3c3c3c] hover:bg-[#4a4a4a] transition-colors min-w-[180px]"
        disabled={isLoading}
      >
        <span className="text-[#0098ff]">{DashboardIcons.game}</span>
        <span className="flex-1 text-left truncate text-sm">
          {isLoading
            ? "加载中..."
            : currentGame
              ? currentGame.name
              : "选择游戏空间"}
        </span>
        <span
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          {DashboardIcons.chevronDown}
        </span>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-[#252526] border border-widget-border rounded-md shadow-xl z-50 overflow-hidden">
          {/* 游戏列表 */}
          <div className="max-h-64 overflow-y-auto">
            {games.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[#858585]">
                暂无游戏空间
              </div>
            ) : (
              games.map((game) => (
                <div
                  key={game.id}
                  className={`flex items-center gap-1 px-2 py-1 transition-colors ${
                    currentGame?.id === game.id
                      ? "bg-[#094771] text-white"
                      : "hover:bg-[#2a2d2e]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectGame(game)}
                    className="flex-1 flex items-center gap-3 px-2 py-1 text-left min-w-0"
                  >
                    <span className="text-[#0098ff]">{DashboardIcons.game}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{game.name}</div>
                      {game.description && (
                        <div className="text-xs text-[#858585] truncate">
                          {game.description}
                        </div>
                      )}
                    </div>
                    {currentGame?.id === game.id && (
                      <span className="text-[#0098ff] text-xs shrink-0">当前</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setSettingsGame(game);
                    }}
                    title="空间设置"
                    className="p-1 rounded hover:bg-[#4a4a4a] text-[#858585] hover:text-white transition-colors shrink-0"
                  >
                    {DashboardIcons.settings}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 分隔线和操作按钮 */}
          <div className="border-t border-widget-border">
            {onCreateGame && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onCreateGame();
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[#2a2d2e] transition-colors text-[#0098ff]"
              >
                {DashboardIcons.add}
                <span className="text-sm">创建新游戏</span>
              </button>
            )}
          </div>
        </div>
      )}
      {/* 空间设置弹窗 */}
      {settingsGame && (
        <GameSettingsModal
          game={settingsGame}
          onClose={() => setSettingsGame(null)}
        />
      )}
    </div>
  );
}

/**
 * 带数据获取的游戏选择器包装组件
 */
export function GameSelectorWithData({
  onCreateGame,
}: {
  onCreateGame?: () => void;
}) {
  const { data: games = [], isLoading } = trpc.game.list.useQuery();

  return (
    <GameSelector
      games={games}
      isLoading={isLoading}
      onCreateGame={onCreateGame}
    />
  );
}
