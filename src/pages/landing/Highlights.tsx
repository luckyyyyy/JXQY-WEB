/**
 * Highlights - 核心亮点展示
 *
 * 用动画展示引擎的核心亮点功能
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { SiWebassembly, SiPython, SiLua, SiJavascript } from "react-icons/si";

// AI 图标
function AIIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

// 闪电图标 - 性能
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
      />
    </svg>
  );
}

// 代码图标 - 脚本
function CodeBracketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
      />
    </svg>
  );
}

// 碰撞图标
function CollisionIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"
      />
    </svg>
  );
}

// 陷阱图标
function TrapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

// ============ 动画演示组件 ============

// AI 生成动画 - 展示 AI 正在创作的效果
function AIGenerationDemo() {
  const { t } = useTranslation();
  return (
    <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-violet-950 to-purple-900 dark:from-violet-950 dark:to-purple-900 shadow-2xl">
      {/* 背景网格 */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      {/* AI 生成的内容 - 对话气泡 */}
      <div className="absolute left-4 top-4 space-y-2">
        <motion.div
          initial={{ opacity: 0, x: -20, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY, repeatDelay: 4 }}
          className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/80"
        >
          🎭 {t("highlights.ai.demo.generatingScript")}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -20, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.8,
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 4,
          }}
          className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/80"
        >
          🗺️ {t("highlights.ai.demo.creatingMap")}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -20, scale: 0.8 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{
            duration: 0.5,
            delay: 1.6,
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 4,
          }}
          className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-white/80"
        >
          ⚔️ {t("highlights.ai.demo.configuringNpc")}
        </motion.div>
      </div>

      {/* 中心 AI 图标 - 旋转发光 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="absolute w-32 h-32 rounded-full border border-violet-400/30"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          className="absolute w-24 h-24 rounded-full border border-purple-400/40"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          className="relative z-10 p-4 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/50"
        >
          <AIIcon className="w-8 h-8 text-white" />
        </motion.div>
      </div>

      {/* 生成的内容预览 - 右侧 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3 }}
        className="absolute right-4 bottom-4 bg-gradient-to-br from-violet-500/20 to-purple-500/20 backdrop-blur-sm rounded-lg p-3 border border-violet-400/30"
      >
        <div className="text-xs text-violet-200 font-medium mb-1">✨ {t("highlights.ai.demo.complete")}</div>
        <div className="text-[10px] text-violet-300/70 space-y-0.5">
          <div>• 3 {t("highlights.ai.demo.scenes")}</div>
          <div>• 12 {t("highlights.ai.demo.dialogues")}</div>
          <div>• 5 {t("highlights.ai.demo.triggers")}</div>
        </div>
      </motion.div>

      {/* 浮动粒子 */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-violet-400"
          style={{
            left: `${20 + i * 12}%`,
            top: `${30 + (i % 3) * 20}%`,
          }}
          animate={{
            y: [0, -10, 0],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// 多语言脚本动画 - 展示不同语言切换
function ScriptEngineDemo() {
  const languages = [
    { name: "WASM", color: "from-purple-500 to-violet-500", Icon: SiWebassembly, iconColor: "#654FF0" },
    { name: "Python", color: "from-blue-500 to-yellow-500", Icon: SiPython, iconColor: "#3776AB" },
    { name: "Lua", color: "from-blue-600 to-blue-800", Icon: SiLua, iconColor: "#2C2D72" },
    { name: "JavaScript", color: "from-yellow-400 to-yellow-500", Icon: SiJavascript, iconColor: "#F7DF1E" },
  ];

  return (
    <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-cyan-950 to-blue-900 shadow-2xl">
      {/* 背景光效 */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            "radial-gradient(circle at 30% 50%, rgba(34,211,238,0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 70% 50%, rgba(59,130,246,0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 30% 50%, rgba(34,211,238,0.15) 0%, transparent 50%)",
          ],
        }}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
      />

      {/* 中心代码图标 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
          className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 backdrop-blur-sm border border-cyan-400/30"
        >
          <CodeBracketIcon className="w-10 h-10 text-cyan-300" />
        </motion.div>
      </div>

      {/* 环绕的语言图标 */}
      {languages.map((lang, i) => {
        const angle = (i * 90 - 45) * (Math.PI / 180);
        const radius = 80;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const LangIcon = lang.Icon;

        return (
          <motion.div
            key={lang.name}
            className="absolute left-1/2 top-1/2"
            style={{ x: x - 24, y: y - 24 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [0.9, 1.1, 0.9],
            }}
            transition={{
              duration: 3,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.5,
            }}
          >
            <div
              className={`w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-lg`}
            >
              <LangIcon className="w-7 h-7" style={{ color: lang.iconColor }} />
            </div>
            <div className="text-[10px] text-center mt-1 text-cyan-200 font-medium">
              {lang.name}
            </div>
          </motion.div>
        );
      })}

      {/* 连接线动画 */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {languages.map((_, i) => {
          const angle = (i * 90 - 45) * (Math.PI / 180);
          const radius = 55;
          const x = 50 + (Math.cos(angle) * radius * 100) / 200;
          const y = 50 + (Math.sin(angle) * radius * 100) / 150;
          return (
            <motion.line
              key={i}
              x1="50%"
              y1="50%"
              x2={`${x}%`}
              y2={`${y}%`}
              stroke="rgba(34,211,238,0.3)"
              strokeWidth="1"
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 0] }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.3,
              }}
            />
          );
        })}
      </svg>

      {/* 底部标签 */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
        {languages.map((lang, i) => (
          <motion.div
            key={lang.name}
            className="px-2 py-1 rounded bg-cyan-500/20 text-[10px] text-cyan-300"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: i * 0.3 }}
          >
            ✓ {lang.name}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// 脚本调试演示 - 带 macOS 窗口装饰的斜向截图
function ScriptDebugDemo() {
  return (
    <div className="relative w-full max-w-lg aspect-[4/3] flex items-center justify-center">
      {/* 斜向的 macOS 风格窗口 */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 30, rotateY: -15, rotateX: 5 }}
        whileInView={{ opacity: 1, y: 0, rotateY: -8, rotateX: 3 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
      >
        {/* 窗口阴影 */}
        <div className="absolute -inset-4 bg-gradient-to-br from-rose-500/20 via-purple-500/20 to-indigo-500/20 rounded-3xl blur-2xl" />

        {/* macOS 窗口 */}
        <div className="relative bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden w-[340px] sm:w-[420px]">
          {/* macOS 标题栏 */}
          <div className="bg-slate-900/90 px-4 py-3 flex items-center gap-3 border-b border-slate-700">
            {/* 红绿灯按钮 */}
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-inner" />
              <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-inner" />
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-inner" />
            </div>
            {/* 标题 */}
            <div className="flex-1 text-center">
              <span className="text-xs text-slate-400 font-medium">Vibe2D Engine — Debug Panel</span>
            </div>
            {/* 占位 */}
            <div className="w-14" />
          </div>

          {/* 截图内容 */}
          <div className="relative aspect-video overflow-hidden">
            <img
              src="/screenshot/screenshot.png"
              alt="Script Debug Screenshot"
              className="w-full h-full object-cover object-center"
            />
            {/* 调试面板高亮效果 */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-rose-500/10 via-transparent to-transparent"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
            />
          </div>
        </div>

        {/* 装饰性光点 */}
        <motion.div
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-rose-400"
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        />
        <motion.div
          className="absolute -bottom-3 -left-3 w-3 h-3 rounded-full bg-purple-400"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2.5, repeat: Number.POSITIVE_INFINITY, delay: 0.5 }}
        />
      </motion.div>
    </div>
  );
}

// 亮点卡片组件 - 用于小卡片
interface HighlightCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  delay?: number;
}

function HighlightCard({
  icon,
  title,
  description,
  gradient,
  delay = 0,
}: HighlightCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className="group relative"
    >
      {/* 发光背景 */}
      <div
        className={`absolute -inset-1 bg-gradient-to-r ${gradient} rounded-2xl opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-500`}
      />

      <div className="relative h-full p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-lg">
        {/* 图标 */}
        <div
          className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg mb-4`}
        >
          {icon}
        </div>

        {/* 标题 */}
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-3">
          {title}
        </h3>

        {/* 描述 */}
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// 大型亮点组件 - 带动画演示
interface LargeHighlightProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  demo: React.ReactNode;
  stats?: { label: string; value: string }[];
  reversed?: boolean;
  delay?: number;
}

function LargeHighlight({
  icon,
  title,
  description,
  gradient,
  demo,
  stats,
  reversed = false,
  delay = 0,
}: LargeHighlightProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay }}
      className={`flex flex-col ${reversed ? "lg:flex-row-reverse" : "lg:flex-row"} gap-8 lg:gap-12 items-center`}
    >
      {/* 内容区 */}
      <div className="flex-1 text-center lg:text-left">
        {/* 图标 */}
        <div
          className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-xl mb-6`}
        >
          {icon}
        </div>

        {/* 标题 */}
        <h3 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
          {title}
        </h3>

        {/* 描述 */}
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
          {description}
        </p>

        {/* 统计数据 */}
        {stats && (
          <div className="flex flex-wrap justify-center lg:justify-start gap-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center lg:text-left">
                <div
                  className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-500">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 动画演示区 */}
      <div className="flex-1 w-full flex justify-center">{demo}</div>
    </motion.div>
  );
}

export function Highlights() {
  const { t } = useTranslation();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-zinc-50 to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />

      {/* 装饰 */}
      <div className="absolute top-1/4 left-0 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white">
            {t("highlights.title")}
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            {t("highlights.subtitle")}
          </p>
        </motion.div>

        {/* AI Agent 大卡片 */}
        <div className="mb-20">
          <LargeHighlight
            icon={<AIIcon className="w-8 h-8" />}
            title={t("highlights.ai.title")}
            description={t("highlights.ai.desc")}
            gradient="from-violet-500 to-purple-600"
            demo={<AIGenerationDemo />}
            stats={[
              { label: t("highlights.ai.stat1Label"), value: "AI" },
              { label: t("highlights.ai.stat2Label"), value: "∞" },
              { label: t("highlights.ai.stat3Label"), value: "10x" },
            ]}
          />
        </div>

        {/* 脚本调试 大卡片 */}
        <div className="mb-20">
          <LargeHighlight
            icon={<CodeBracketIcon className="w-8 h-8" />}
            title={t("highlights.debug.title")}
            description={t("highlights.debug.desc")}
            gradient="from-rose-500 to-purple-600"
            demo={<ScriptDebugDemo />}
            reversed
            delay={0.1}
          />
        </div>

        {/* 脚本系统 大卡片 */}
        <div className="mb-20">
          <LargeHighlight
            icon={<CodeBracketIcon className="w-8 h-8" />}
            title={t("highlights.scripting.title")}
            description={t("highlights.scripting.desc")}
            gradient="from-cyan-500 to-blue-600"
            demo={<ScriptEngineDemo />}
            delay={0.2}
          />
        </div>

        {/* 小卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <HighlightCard
            icon={<CollisionIcon className="w-6 h-6" />}
            title={t("highlights.collision.title")}
            description={t("highlights.collision.desc")}
            gradient="from-rose-500 to-pink-600"
            delay={0.1}
          />
          <HighlightCard
            icon={<TrapIcon className="w-6 h-6" />}
            title={t("highlights.trap.title")}
            description={t("highlights.trap.desc")}
            gradient="from-emerald-500 to-teal-600"
            delay={0.2}
          />
        </div>
      </div>
    </section>
  );
}
