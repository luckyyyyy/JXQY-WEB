/**
 * 游戏空间守卫组件
 * 验证当前路由的游戏空间是否存在且用户有权限访问
 */

import { trpc } from "@miu2d/shared";
import { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { DashboardProvider, useDashboard } from "./DashboardContext";

/**
 * 加载中状态
 */
function LoadingState() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#1e1e1e]">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#858585]">加载游戏空间...</p>
      </div>
    </div>
  );
}

/**
 * 游戏空间不存在错误页面
 */
function GameNotFound({ slug }: { slug: string }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#1e1e1e]">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🎮</div>
        <h1 className="text-2xl font-bold text-white mb-4">游戏空间不存在</h1>
        <p className="text-[#858585] mb-2">
          找不到名为 <code className="bg-[#2d2d2d] px-2 py-1 rounded text-[#ce9178]">{slug}</code>{" "}
          的游戏空间
        </p>
        <p className="text-[#858585] mb-8">请检查链接是否正确，或者该空间可能已被删除</p>
        <a
          href="/dashboard"
          className="inline-block px-6 py-3 bg-[#0e639c] hover:bg-[#1177bb] rounded-lg text-white transition-colors"
        >
          返回游戏列表
        </a>
      </div>
    </div>
  );
}

/**
 * 内部组件：设置当前游戏到 Context
 */
function GameContextSetter({ children }: { children: React.ReactNode }) {
  const { gameId: gameSlug } = useParams<{ gameId: string }>();
  const { setCurrentGame } = useDashboard();

  const {
    data: game,
    isLoading,
    isError,
  } = trpc.game.getBySlug.useQuery({ slug: gameSlug! }, { enabled: !!gameSlug });

  useEffect(() => {
    if (game) {
      setCurrentGame(game);
    }
  }, [game, setCurrentGame]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !game) {
    return <GameNotFound slug={gameSlug || ""} />;
  }

  return <>{children}</>;
}

/**
 * 游戏空间守卫
 * 包裹需要验证游戏空间的路由
 */
export function GameGuard() {
  const { gameId: gameSlug } = useParams<{ gameId: string }>();

  // 没有 gameSlug 参数，重定向到游戏选择页面
  if (!gameSlug) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardProvider>
      <GameContextSetter>
        <Outlet />
      </GameContextSetter>
    </DashboardProvider>
  );
}
