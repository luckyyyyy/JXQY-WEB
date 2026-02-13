/**
 * AuthModal - 登录/注册弹窗
 *
 * 毛玻璃半透明弹窗，样式与 WebSaveLoadPanel 的 InlineAuthForm 一致
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts";
import { GlassModal } from "./GlassModal";

export interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AuthModal({ visible, onClose }: AuthModalProps) {
  const { login: setAuthUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setAuthUser(data.user);
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setAuthUser(data.user);
      onClose();
    },
    onError: (err) => setError(err.message),
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
    <GlassModal
      visible={visible}
      onClose={onClose}
      title={mode === "login" ? "登录" : "注册"}
      widthClass="w-[400px]"
    >
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
              ? mode === "login" ? "登录中..." : "注册中..."
              : mode === "login" ? "登录" : "注册"}
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
    </GlassModal>
  );
}
