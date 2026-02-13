/**
 * 注册页面 - 游戏风格设计，与官网配色一致
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FloatingOrb, GridLine, GridNode, GridPattern } from "@miu2d/ui";
import { useAuth } from "../contexts";
import { trpc } from "../lib/trpc";

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login: setAuthUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setAuthUser(data.user);
      navigate("/dashboard");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("errors.auth.passwordMismatch"));
      return;
    }

    registerMutation.mutate({ name, email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* 背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />

      {/* 动态装饰球 - 增强亮度让模糊可见 */}
      <FloatingOrb className="w-[600px] h-[600px] bg-orange-600/30 -top-40 -left-40" delay={0} />
      <FloatingOrb className="w-[500px] h-[500px] bg-amber-500/25 top-20 -right-40" delay={2} />
      <FloatingOrb className="w-[400px] h-[400px] bg-yellow-500/20 bottom-20 left-1/4" delay={4} />
      <FloatingOrb className="w-[350px] h-[350px] bg-orange-500/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" delay={1} />

      {/* 网格背景 */}
      <GridPattern className="!opacity-[0.08] text-white" />

      {/* 沿网格线移动的发光流线 - 水平 */}
      <GridLine row={2} duration={5} delay={0} isHorizontal />
      <GridLine row={4} duration={6} delay={1.5} isHorizontal />
      <GridLine row={6} duration={4.5} delay={3} isHorizontal />
      <GridLine row={8} duration={5.5} delay={0.8} isHorizontal />
      <GridLine row={10} duration={6.5} delay={2.2} isHorizontal />

      {/* 沿网格线移动的发光流线 - 垂直 */}
      <GridLine row={4} duration={5} delay={0.5} isHorizontal={false} />
      <GridLine row={8} duration={6} delay={2} isHorizontal={false} />
      <GridLine row={12} duration={4.5} delay={1} isHorizontal={false} />
      <GridLine row={16} duration={5.5} delay={3.5} isHorizontal={false} />
      <GridLine row={20} duration={6} delay={1.8} isHorizontal={false} />

      {/* 网格交叉点闪烁 */}
      <GridNode row={3} col={5} delay={0} />
      <GridNode row={5} col={12} delay={1} />
      <GridNode row={7} col={8} delay={2} />
      <GridNode row={4} col={18} delay={0.5} />
      <GridNode row={9} col={3} delay={1.5} />
      <GridNode row={6} col={22} delay={2.5} />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center justify-center gap-2 mb-8 group"
        >
          <span className="text-3xl group-hover:scale-110 transition-transform">⚡</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            Miu2D
          </span>
        </Link>

        {/* Card - 毛玻璃 + 发光 */}
        <div
          className="rounded-2xl p-8 border border-orange-500/20 shadow-[0_0_40px_-10px_rgba(249,115,22,0.2),0_0_80px_-20px_rgba(249,115,22,0.1),inset_0_1px_0_0_rgba(255,255,255,0.06)]"
          style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)' }}
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">
              {t("auth.register.title")}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {t("auth.register.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                {t("auth.register.name")}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] transition-all"
                style={{ background: 'rgba(255, 255, 255, 0.04)' }}
                placeholder="Your Name"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-300 mb-1.5"
              >
                {t("auth.register.email")}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] transition-all"
                style={{ background: 'rgba(255, 255, 255, 0.04)' }}
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  {t("auth.register.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] transition-all"
                  style={{ background: 'rgba(255, 255, 255, 0.04)' }}
                  placeholder="••••••••"
                  required
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  {t("auth.register.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] transition-all"
                  style={{ background: 'rgba(255, 255, 255, 0.04)' }}
                  placeholder="••••••••"
                  required
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-4px_rgba(249,115,22,0.5)] hover:shadow-[0_0_28px_-4px_rgba(249,115,22,0.6)] mt-2"
            >
              {registerMutation.isPending
                ? t("auth.register.loading")
                : t("auth.register.submit")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-zinc-500 text-sm">
              {t("auth.register.hasAccount")}{" "}
            </span>
            <Link
              to="/login"
              className="text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              {t("auth.register.toLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
