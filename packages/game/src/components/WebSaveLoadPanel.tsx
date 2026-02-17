/**
 * WebSaveLoadPanel - 新的服务端存档/读档面板
 *
 * 特点：
 * - 磨砂玻璃半透明效果
 * - 无档位数量限制
 * - 存档保存到服务器
 * - 支持分享功能
 */

import { api, useAuth } from "@miu2d/shared";
import type { SaveDataResponse, SaveSlot, User } from "@miu2d/types";
import { useCallback, useEffect, useState } from "react";

export interface WebSaveLoadPanelProps {
  gameSlug: string;
  /** 是否可见 */
  visible: boolean;
  /** 是否允许存档（战斗中或未登录时 false） */
  canSave: boolean;
  /** 嵌入模式：不渲染自带的遮罩和外壳，仅输出内容部分 */
  embedded?: boolean;
  /** 存档回调：收集当前游戏状态 */
  onCollectSaveData: () => {
    data: Record<string, unknown>;
    screenshot?: string;
    mapName?: string;
    level?: number;
    playerName?: string;
  } | null;
  /** 读档回调：加载存档数据 */
  onLoadSaveData: (data: Record<string, unknown>) => Promise<boolean>;
  /** 关闭回调 */
  onClose: () => void;
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function WebSaveLoadPanel({
  gameSlug,
  visible,
  canSave,
  embedded = false,
  onCollectSaveData,
  onLoadSaveData,
  onClose,
}: WebSaveLoadPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const [saveName, setSaveName] = useState("");
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "save" | "load" | "delete" | "share";
    id?: string;
  } | null>(null);

  const utils = api.useUtils();

  const savesQuery = api.save.list.useQuery({ gameSlug }, { enabled: visible && isAuthenticated });

  const upsertMutation = api.save.upsert.useMutation({
    onSuccess: () => {
      utils.save.list.invalidate({ gameSlug });
      setMessage({ text: "存档成功", type: "success" });
      setSaveName("");
    },
    onError: (e) => setMessage({ text: e.message, type: "error" }),
  });

  const deleteMutation = api.save.delete.useMutation({
    onSuccess: () => {
      utils.save.list.invalidate({ gameSlug });
      setMessage({ text: "删除成功", type: "success" });
    },
    onError: (e) => setMessage({ text: e.message, type: "error" }),
  });

  const shareMutation = api.save.share.useMutation({
    onSuccess: (data) => {
      utils.save.list.invalidate({ gameSlug });
      const { isShared, shareCode } = data as { isShared: boolean; shareCode?: string };
      if (isShared && shareCode) {
        setMessage({ text: "已开启分享", type: "success" });
      } else {
        setMessage({ text: "已取消分享", type: "info" });
      }
    },
    onError: (e) => setMessage({ text: e.message, type: "error" }),
  });

  const getSaveQuery = api.save.get.useQuery(
    { gameSlug, saveId: operatingId! },
    { enabled: !!operatingId && confirmAction?.type === "load" }
  );

  // Clear messages after 3s
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Reset state on close
  useEffect(() => {
    if (!visible) {
      setConfirmAction(null);
      setOperatingId(null);
    }
  }, [visible]);

  const handleNewSave = useCallback(() => {
    const collected = onCollectSaveData();
    if (!collected) {
      setMessage({ text: "无法获取游戏状态", type: "error" });
      return;
    }

    const name = saveName.trim() || `存档 ${new Date().toLocaleString("zh-CN")}`;

    upsertMutation.mutate({
      gameSlug,
      name,
      mapName: collected.mapName,
      level: collected.level,
      playerName: collected.playerName,
      screenshot: collected.screenshot,
      data: collected.data,
    });
  }, [gameSlug, saveName, onCollectSaveData, upsertMutation]);

  const handleOverwriteSave = useCallback(
    (saveId: string) => {
      const collected = onCollectSaveData();
      if (!collected) {
        setMessage({ text: "无法获取游戏状态", type: "error" });
        return;
      }

      const save = (savesQuery.data as SaveSlot[] | undefined)?.find((s) => s.id === saveId);
      upsertMutation.mutate({
        gameSlug,
        saveId,
        name: save?.name ?? `存档 ${new Date().toLocaleString("zh-CN")}`,
        mapName: collected.mapName,
        level: collected.level,
        playerName: collected.playerName,
        screenshot: collected.screenshot,
        data: collected.data,
      });
      setConfirmAction(null);
    },
    [gameSlug, onCollectSaveData, upsertMutation, savesQuery.data]
  );

  const handleLoad = useCallback(
    async (saveId: string) => {
      setOperatingId(saveId);
      setConfirmAction(null);
      try {
        const result = (await utils.save.get.fetch({ gameSlug, saveId })) as SaveDataResponse;
        if (result?.data) {
          const success = await onLoadSaveData(result.data as Record<string, unknown>);
          if (success) {
            setMessage({ text: "读档成功", type: "success" });
            setTimeout(onClose, 500);
          } else {
            setMessage({ text: "读档失败", type: "error" });
          }
        }
      } catch {
        setMessage({ text: "读档失败", type: "error" });
      } finally {
        setOperatingId(null);
      }
    },
    [onLoadSaveData, onClose, utils, gameSlug]
  );

  const handleDelete = useCallback(
    (saveId: string) => {
      const save = (savesQuery.data as SaveSlot[] | undefined)?.find((s) => s.id === saveId);
      deleteMutation.mutate({ gameId: save?.gameId ?? "", saveId });
      setConfirmAction(null);
    },
    [deleteMutation, savesQuery.data]
  );

  const handleShare = useCallback(
    (saveId: string, _currentlyShared: boolean) => {
      const save = (savesQuery.data as SaveSlot[] | undefined)?.find((s) => s.id === saveId);
      shareMutation.mutate({ gameId: save?.gameId ?? "", saveId });
      setConfirmAction(null);
    },
    [shareMutation, savesQuery.data]
  );

  if (!visible) return null;

  const saves = [...((savesQuery.data ?? []) as SaveSlot[])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // 内容部分（可嵌入或独立使用）
  const content = (
    <>
      {/* 未登录提示 - 内嵌登录/注册表单，不跳转页面 */}
      {!isAuthenticated && <InlineAuthForm />}

      {isAuthenticated && (
        <>
          {/* 新建存档区域 */}
          {canSave && (
            <div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="输入存档名称（可选）"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white
                    placeholder-white/30 focus:outline-none focus:border-white/30"
                maxLength={100}
              />
              <button
                onClick={handleNewSave}
                disabled={upsertMutation.isPending}
                className="px-4 py-2 bg-blue-500/60 hover:bg-blue-500/80 disabled:opacity-40
                    text-white text-sm rounded-lg transition-colors whitespace-nowrap"
              >
                {upsertMutation.isPending ? "保存中..." : "新建存档"}
              </button>
            </div>
          )}

          {/* 存档列表 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {savesQuery.isLoading ? (
              <div className="text-center text-white/40 py-8">加载中...</div>
            ) : saves.length === 0 ? (
              <div className="text-center text-white/40 py-8">暂无存档</div>
            ) : (
              saves.map((save) => (
                <SaveSlotCard
                  key={save.id}
                  save={save}
                  gameSlug={gameSlug}
                  isOperating={operatingId === save.id}
                  confirmAction={confirmAction?.id === save.id ? confirmAction.type : null}
                  canSave={canSave}
                  onOverwrite={() => setConfirmAction({ type: "save", id: save.id })}
                  onLoad={() => setConfirmAction({ type: "load", id: save.id })}
                  onDelete={() => setConfirmAction({ type: "delete", id: save.id })}
                  onShare={() => handleShare(save.id, save.isShared)}
                  onConfirm={() => {
                    if (!confirmAction) return;
                    if (confirmAction.type === "save") handleOverwriteSave(save.id);
                    else if (confirmAction.type === "load") handleLoad(save.id);
                    else if (confirmAction.type === "delete") handleDelete(save.id);
                  }}
                  onCancelConfirm={() => setConfirmAction(null)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* 状态消息 */}
      {message && (
        <div
          className={`px-6 py-2 text-center text-sm ${
            message.type === "success"
              ? "text-green-300"
              : message.type === "error"
                ? "text-red-300"
                : "text-blue-300"
          }`}
        >
          {message.text}
        </div>
      )}
    </>
  );

  // 嵌入模式：仅返回内容
  if (embedded) {
    return content;
  }

  // 独立模式：包含遮罩和外壳
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative w-[520px] h-[520px] flex flex-col rounded-2xl overflow-hidden
          bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white/90">存档管理</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {content}
      </div>
    </div>
  );
}

function SaveSlotCard({
  save,
  gameSlug,
  isOperating,
  confirmAction,
  canSave,
  onOverwrite,
  onLoad,
  onDelete,
  onShare,
  onConfirm,
  onCancelConfirm,
}: {
  save: SaveSlot;
  gameSlug: string;
  isOperating: boolean;
  confirmAction: "save" | "load" | "delete" | "share" | null;
  canSave: boolean;
  onOverwrite: () => void;
  onLoad: () => void;
  onDelete: () => void;
  onShare: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const confirmLabel =
    confirmAction === "delete" ? "删除" : confirmAction === "save" ? "覆盖" : "读档";

  return (
    <div className="rounded-xl bg-white/5 border border-white/[0.06] overflow-hidden hover:bg-white/10 transition-colors">
      <div className="flex gap-3 px-3 py-2.5">
        {/* 截图 */}
        <div className="w-16 h-12 rounded-lg overflow-hidden bg-black/30 flex-shrink-0">
          {save.screenshot ? (
            <img src={save.screenshot} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
              空
            </div>
          )}
        </div>

        {/* 信息 + 操作 */}
        <div className="flex-1 min-w-0">
          {/* 第一行：名称 + 标签 + 时间 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-white/80 font-medium truncate min-w-0 flex-1">
              {save.name}
            </span>
            {save.isShared && (
              <span className="text-[10px] leading-none px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded flex-shrink-0">
                已分享
              </span>
            )}
            <span className="text-[11px] text-white/25 whitespace-nowrap flex-shrink-0">
              {formatDate(save.updatedAt)}
            </span>
          </div>

          {/* 第二行：元信息 + 操作按钮 */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 text-xs text-white/35 min-w-0 overflow-hidden">
              {save.playerName && <span className="truncate max-w-[72px]">{save.playerName}</span>}
              {save.playerName && save.mapName && (
                <span className="text-white/15 flex-shrink-0">·</span>
              )}
              {save.mapName && <span className="truncate max-w-[100px]">{save.mapName}</span>}
              {(save.playerName || save.mapName) && save.level != null && (
                <span className="text-white/15 flex-shrink-0">·</span>
              )}
              {save.level != null && (
                <span className="whitespace-nowrap flex-shrink-0">Lv.{save.level}</span>
              )}
            </div>

            {/* 操作按钮 - 始终可见 */}
            {isOperating ? (
              <span className="text-[11px] text-white/30 flex-shrink-0">处理中...</span>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={onLoad}
                  className="px-1.5 py-0.5 text-[11px] rounded bg-green-500/20 text-green-300 hover:bg-green-500/35 transition-colors"
                >
                  读档
                </button>
                {canSave && (
                  <button
                    onClick={onOverwrite}
                    className="px-1.5 py-0.5 text-[11px] rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/35 transition-colors"
                  >
                    覆盖
                  </button>
                )}
                <button
                  onClick={onShare}
                  className={`w-6 h-5 flex items-center justify-center text-[11px] rounded transition-colors ${
                    save.isShared
                      ? "bg-green-500/20 text-green-300 hover:bg-green-500/35"
                      : "bg-white/5 text-white/30 hover:bg-white/15 hover:text-white/50"
                  }`}
                  title={save.isShared ? "取消分享" : "分享"}
                >
                  🔗
                </button>
                <button
                  onClick={onDelete}
                  className="w-6 h-5 flex items-center justify-center text-[11px] rounded bg-white/5 text-white/25 hover:bg-red-500/25 hover:text-red-300 transition-colors"
                  title="删除"
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 确认操作栏 */}
      {confirmAction && !isOperating && (
        <div className="px-3 py-2 border-t border-white/5 bg-white/[0.03] flex items-center justify-between">
          <span className="text-xs text-white/40">确认{confirmLabel}此存档？</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirm}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                confirmAction === "delete"
                  ? "bg-red-500/50 text-white hover:bg-red-500/70"
                  : "bg-blue-500/50 text-white hover:bg-blue-500/70"
              }`}
            >
              确认
            </button>
            <button
              onClick={onCancelConfirm}
              className="px-2.5 py-1 text-xs bg-white/10 text-white/50 rounded hover:bg-white/20 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 已分享链接 */}
      {save.isShared && save.shareCode && (
        <div className="px-3 py-1.5 border-t border-white/5 bg-white/[0.02] flex items-center gap-1.5">
          <input
            type="text"
            readOnly
            value={`${window.location.origin}/game/${gameSlug}/share/${save.shareCode}`}
            className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] text-white/50 min-w-0"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={() => {
              const url = `${window.location.origin}/game/${gameSlug}/share/${save.shareCode}`;
              copyToClipboard(url);
            }}
            className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white/50 text-[11px] rounded transition-colors flex-shrink-0"
          >
            复制
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * InlineAuthForm - 内嵌在存档面板中的登录/注册表单
 * 登录或注册成功后 AuthContext 自动更新，面板立即切换到已登录状态
 */
function InlineAuthForm() {
  const { login: setAuthUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = api.auth.login.useMutation({
    onSuccess: (data) => {
      setAuthUser((data as { user: User }).user);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const registerMutation = api.auth.register.useMutation({
    onSuccess: (data) => {
      setAuthUser((data as { user: User }).user);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
      registerMutation.mutate({ name, email, password });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  return (
    <div className="px-6 py-6">
      <p className="text-white/60 text-sm text-center mb-4">
        {mode === "login" ? "登录后即可使用云存档功能" : "注册账号即可使用云存档功能"}
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "register" && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="昵称"
            required
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white
              placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          required
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white
            placeholder-white/30 focus:outline-none focus:border-white/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          required
          minLength={4}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white
            placeholder-white/30 focus:outline-none focus:border-white/30"
        />
        {mode === "register" && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="确认密码"
            required
            minLength={4}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white
              placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        )}
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2 bg-blue-500/70 hover:bg-blue-500/90 disabled:opacity-40
            text-white text-sm rounded-lg transition-colors"
        >
          {isPending
            ? mode === "login"
              ? "登录中..."
              : "注册中..."
            : mode === "login"
              ? "登录"
              : "注册"}
        </button>
      </form>
      <p className="text-center mt-3">
        <button
          type="button"
          onClick={switchMode}
          className="text-blue-400/70 hover:text-blue-400 text-xs transition-colors"
        >
          {mode === "login" ? "没有账号？点此注册" : "已有账号？点此登录"}
        </button>
      </p>
    </div>
  );
}
