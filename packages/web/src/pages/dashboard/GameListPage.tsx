/**
 * 游戏空间列表页面
 * 显示用户的所有游戏空间，如果没有则自动创建一个
 */
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../contexts";
import { DashboardIcons } from "./icons";

export function GameListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // 获取游戏列表
  const { data: games, isLoading, isError, error } = trpc.game.list.useQuery();

  // 创建游戏 mutation
  const createGameMutation = trpc.game.create.useMutation({
    onSuccess: (newGame) => {
      // 创建成功后刷新列表并跳转
      utils.game.list.invalidate();
      navigate(`/dashboard/${newGame.slug}`);
    },
  });

  // 用于防止重复创建
  const isCreatingRef = useRef(false);

  // 如果没有游戏空间，自动创建一个
  useEffect(() => {
    if (
      !isLoading &&
      !isError &&
      games &&
      games.length === 0 &&
      user &&
      !isCreatingRef.current &&
      !createGameMutation.isPending
    ) {
      isCreatingRef.current = true;
      createGameMutation.mutate({
        name: `${user.name}的游戏`,
        description: "默认游戏空间",
      });
    }
  }, [games, isLoading, isError, user, createGameMutation]);

  // 加载中状态
  if (isLoading || createGameMutation.isPending) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#1e1e1e]">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-[#0e639c] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-[#858585]">
            {createGameMutation.isPending ? "正在创建游戏空间..." : "加载中..."}
          </p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (isError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#1e1e1e]">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-4">加载失败</h1>
          <p className="text-[#858585] mb-8">
            {error?.message || "无法加载游戏列表，请稍后重试"}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-block px-6 py-3 bg-[#0e639c] hover:bg-[#1177bb] rounded-lg text-white transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 游戏列表
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#1e1e1e]">
      <div className="w-full max-w-2xl px-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">游戏空间</h1>
          <p className="text-[#858585]">选择一个游戏空间开始编辑</p>
        </div>

        {/* 游戏列表 */}
        <div className="grid gap-4">
          {games?.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => navigate(`/dashboard/${game.slug}`)}
              className="flex items-center gap-4 p-4 bg-[#252526] hover:bg-[#2a2d2e] border border-widget-border rounded-lg transition-colors text-left group"
            >
              <div className="w-12 h-12 flex items-center justify-center bg-[#0e639c] rounded-lg text-white text-xl">
                {DashboardIcons.game}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-white truncate group-hover:text-[#0098ff] transition-colors">
                  {game.name}
                </h2>
                {game.description && (
                  <p className="text-sm text-[#858585] truncate">
                    {game.description}
                  </p>
                )}
              </div>
              <span className="text-[#858585] group-hover:text-[#0098ff] transition-colors">
                {DashboardIcons.chevronRight}
              </span>
            </button>
          ))}
        </div>

        {/* 创建新游戏按钮 */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              const name = prompt("请输入游戏名称：");
              if (name?.trim()) {
                createGameMutation.mutate({ name: name.trim() });
              }
            }}
            disabled={createGameMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#3c3c3c] hover:bg-[#4a4a4a] border border-widget-border rounded-lg text-[#cccccc] transition-colors"
          >
            {DashboardIcons.add}
            <span>创建新游戏</span>
          </button>
        </div>
      </div>
    </div>
  );
}
