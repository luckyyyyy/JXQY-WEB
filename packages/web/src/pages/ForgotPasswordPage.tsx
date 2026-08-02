/**
 * 忘记密码页面 - 输入邮箱，发送重置链接
 */

import { trpc } from "@miu2d/shared";
import { FloatingOrb, GridLine, GridNode, GridPattern } from "@miu2d/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const forgotMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      setSent(true);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    forgotMutation.mutate({ email });
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
            <h1 className="text-2xl font-bold text-white">{t("auth.forgot.title")}</h1>
            <p className="mt-2 text-sm text-zinc-400">{t("auth.forgot.subtitle")}</p>
          </div>

          {sent ? (
            <div className="space-y-6">
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
                <span>{t("auth.forgot.sentHint")}</span>
              </div>
              <Link
                to="/login"
                className="block w-full py-2.5 px-4 text-center bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_0_20px_-4px_rgba(249,115,22,0.5)]"
              >
                {t("auth.forgot.backToLogin")}
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
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  {t("auth.forgot.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_12px_-2px_rgba(249,115,22,0.3)] transition-all"
                  style={{ background: "rgba(255, 255, 255, 0.04)" }}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={forgotMutation.isPending}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-4px_rgba(249,115,22,0.5)] hover:shadow-[0_0_28px_-4px_rgba(249,115,22,0.6)]"
              >
                {forgotMutation.isPending ? t("auth.forgot.loading") : t("auth.forgot.submit")}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              {t("auth.forgot.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
