/**
 * 重置密码页面 - 通过邮件链接携带的 token 设置新密码
 */

import { trpc } from "@miu2d/shared";
import { FloatingOrb, GridLine, GridNode, GridPattern } from "@miu2d/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const resetMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setDone(true);
        setTimeout(() => navigate("/login"), 2500);
      } else {
        setError(data.message);
      }
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

    resetMutation.mutate({ token, newPassword: password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* 背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />

      {/* 动态装饰球 */}
      <FloatingOrb className="w-[600px] h-[600px] bg-orange-600/30 -top-40 -left-40" delay={0} />
      <FloatingOrb className="w-[500px] h-[500px] bg-amber-500/25 top-20 -right-40" delay={2} />
      <FloatingOrb className="w-[400px] h-[400px] bg-yellow-500/20 bottom-20 left-1/4" delay={4} />

      {/* 网格背景 */}
      <GridPattern className="!opacity-[0.08] text-white" />
      <GridLine row={4} duration={6} delay={1.5} isHorizontal />
      <GridLine row={8} duration={5.5} delay={0.8} isHorizontal />
      <GridLine row={8} duration={6} delay={2} isHorizontal={false} />
      <GridNode row={5} col={12} delay={1} />
      <GridNode row={7} col={8} delay={2} />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <span className="text-3xl group-hover:scale-110 transition-transform">⚡</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            Miu2D
          </span>
        </Link>

        {/* Card */}
        <div
          className="rounded-2xl p-8 border border-orange-500/20 shadow-[0_0_40px_-10px_rgba(249,115,22,0.2),0_0_80px_-20px_rgba(249,115,22,0.1),inset_0_1px_0_0_rgba(255,255,255,0.06)]"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(20px) saturate(1.4)",
            WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          }}
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">{t("auth.reset.title")}</h1>
            <p className="mt-2 text-sm text-zinc-400">{t("auth.reset.subtitle")}</p>
          </div>

          {done ? (
            <div className="flex items-start gap-3 px-4 py-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <svg
                className="w-5 h-5 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{t("auth.reset.successHint")}</span>
            </div>
          ) : !token ? (
            <div className="space-y-6">
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {t("auth.reset.invalidLink")}
              </div>
              <Link
                to="/forgot-password"
                className="block w-full py-2.5 px-4 text-center bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_0_20px_-4px_rgba(249,115,22,0.5)]"
              >
                {t("auth.reset.requestAgain")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  {t("auth.reset.newPassword")}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] transition-all"
                  style={{ background: "rgba(255, 255, 255, 0.04)" }}
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
                  {t("auth.reset.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] transition-all"
                  style={{ background: "rgba(255, 255, 255, 0.04)" }}
                  placeholder="••••••••"
                  required
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={resetMutation.isPending}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-4px_rgba(249,115,22,0.5)] hover:shadow-[0_0_28px_-4px_rgba(249,115,22,0.6)]"
              >
                {resetMutation.isPending ? t("auth.reset.loading") : t("auth.reset.submit")}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              {t("auth.reset.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
