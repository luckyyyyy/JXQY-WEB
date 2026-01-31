/**
 * CrossPlatformSection - 跨平台优势专题页
 *
 * 独立的全屏 section，详细展示：
 * - 传统客户端的兼容性问题（Win98/XP 时代开发，不兼容现代系统）
 * - 网页版的跨平台优势（天然支持所有设备）
 * - 按需加载的技术优势（2GB 资源只需 5MB 即可开始）
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FaWindows, FaApple, FaLinux, FaMobileAlt, FaSteam, FaAndroid, FaCompactDisc, FaGlobe, FaBolt, FaCube, FaSyncAlt, FaHdd, FaRocket, FaCheck, FaTimes, FaChrome, FaSafari, FaFirefox, FaEdge } from "react-icons/fa";
import { HiSparkles, HiLightningBolt } from "react-icons/hi";

// 对比行组件 - 现代霓虹风格
function ComparisonRow({
  icon,
  iconBg,
  label,
  legacy,
  legacyNote,
  web,
  webNote,
  highlight,
  highlightGradient,
  delay,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  legacy: string;
  legacyNote: string;
  web: string;
  webNote: string;
  highlight: string;
  highlightGradient: string;
  delay: number;
}) {
  return (
    <motion.div
      className="group relative"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      {/* 悬浮发光效果 */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(90deg, rgba(239, 68, 68, 0.1), transparent, rgba(16, 185, 129, 0.1))`,
        }}
      />

      <div className="relative rounded-2xl bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 p-4 sm:p-5 group-hover:border-slate-300 dark:group-hover:border-slate-600/50 transition-all duration-300">
        {/* 移动端：垂直布局 */}
        <div className="flex flex-col gap-4 sm:hidden">
          {/* 指标名称 */}
          <div className="flex items-center gap-3">
            <motion.div
              className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              {icon}
            </motion.div>
            <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{label}</span>
          </div>

          {/* 对比数据 */}
          <div className="flex items-center justify-between gap-2">
            {/* 传统 */}
            <div className="flex-1 text-center p-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
              <div className="text-[10px] text-slate-500 mb-0.5">{legacyNote}</div>
              <div className="text-lg font-black text-red-500 dark:text-red-400">{legacy}</div>
            </div>

            {/* 徽章 */}
            <motion.div className="relative shrink-0" whileHover={{ scale: 1.1 }}>
              <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${highlightGradient} blur-lg opacity-60`} />
              <div className={`relative px-2.5 py-1 rounded-full bg-gradient-to-r ${highlightGradient} text-white text-[10px] font-black shadow-xl`}>
                {highlight}
              </div>
            </motion.div>

            {/* 网页版 */}
            <div className="flex-1 text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20">
              <div className="text-[10px] text-slate-500 mb-0.5">{webNote}</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">{web}</div>
            </div>
          </div>
        </div>

        {/* 桌面端：水平布局，固定列宽 */}
        <div className="hidden sm:grid sm:grid-cols-[180px_1fr_100px_1fr] sm:items-center sm:gap-6">
          {/* 指标名称 */}
          <div className="flex items-center gap-3">
            <motion.div
              className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              {icon}
            </motion.div>
            <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{label}</span>
          </div>

          {/* 传统 - 右对齐 */}
          <div className="flex items-center justify-end gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-500">{legacyNote}</div>
              <div className="text-xl font-black text-red-400">{legacy}</div>
            </div>
            <motion.div
              className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50 shrink-0"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            />
          </div>

          {/* 分隔徽章 */}
          <motion.div className="relative flex justify-center" whileHover={{ scale: 1.1 }}>
            <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${highlightGradient} blur-lg opacity-60`} />
            <div className={`relative px-4 py-1.5 rounded-full bg-gradient-to-r ${highlightGradient} text-white text-xs font-black shadow-xl whitespace-nowrap text-center`}>
              {highlight}
            </div>
          </motion.div>

          {/* 网页版 - 左对齐 */}
          <div className="flex items-center gap-3">
            <motion.div
              className="w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 shrink-0"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, delay: 1 }}
            />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-500">{webNote}</div>
              <div className="text-xl font-black text-emerald-400">{web}</div>
            </div>
          </div>
        </div>

        {/* 底部进度条动画 */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-red-500/50 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-emerald-500/50 to-transparent" />
        </motion.div>
      </div>
    </motion.div>
  );
}

// 传统客户端错误演示
function LegacyClientDemo() {
  const { t } = useTranslation();
  const [errorIndex, setErrorIndex] = React.useState(0);

  const errors = [
    { icon: "🪟", key: "win11Error" },
    { icon: "🍎", key: "macError" },
    { icon: "🐧", key: "linuxError" },
    { icon: "💻", key: "cpuError" },
    { icon: "📱", key: "mobileError" },
  ];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setErrorIndex(prev => (prev + 1) % errors.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const currentError = errors[errorIndex];

  return (
    <div className="relative">
      {/* 旧电脑外框 */}
      <div className="relative mx-auto w-64 sm:w-80">
        {/* 显示器 */}
        <div className="bg-gradient-to-b from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700 rounded-t-xl p-3 pb-0">
          <div className="bg-slate-900 rounded-t-lg overflow-hidden aspect-[4/3] relative">
            {/* Windows XP 桌面 */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#245edb] to-[#1e4db8]">
              {/* 图标 */}
              <div className="absolute top-2 left-2 flex flex-col gap-2">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                    <span className="text-xs">📁</span>
                  </div>
                  <span className="text-[6px] text-white/80">My Files</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                    <span className="text-xs">🎮</span>
                  </div>
                  <span className="text-[6px] text-white/80">Game.exe</span>
                </div>
              </div>

              {/* 错误弹窗 */}
              <motion.div
                key={errorIndex}
                initial={{ scale: 0.8, opacity: 0, y: -20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%]"
              >
                <div className="bg-[#ece9d8] dark:bg-slate-200 rounded shadow-xl border-2 border-[#0054e3] overflow-hidden">
                  {/* Windows 标题栏 */}
                  <div className="bg-gradient-to-r from-[#0054e3] to-[#2e8bcc] px-2 py-0.5 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]">⚠️</span>
                      <span className="text-[8px] text-white font-bold truncate">
                        {t("asyncLoading.demo.errorTitle")}
                      </span>
                    </div>
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 bg-[#c4c4c4] rounded-sm border border-white/50 flex items-center justify-center text-[8px]">_</div>
                      <div className="w-3 h-3 bg-red-500 rounded-sm border border-white/50 flex items-center justify-center text-[8px] text-white">✕</div>
                    </div>
                  </div>
                  {/* 错误内容 */}
                  <div className="p-2 flex items-start gap-2">
                    <motion.span
                      className="text-xl"
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 0.6, repeat: Number.POSITIVE_INFINITY }}
                    >
                      {currentError.icon}
                    </motion.span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[8px] text-red-700 font-medium leading-snug">
                        {t(`asyncLoading.demo.${currentError.key}`)}
                      </div>
                    </div>
                  </div>
                  {/* 按钮 */}
                  <div className="px-2 pb-2 flex justify-center gap-2">
                    <div className="px-3 py-0.5 bg-[#dbd8d1] border border-[#8e8f8f] rounded-sm text-[8px] text-slate-700 shadow-sm">
                      {t("asyncLoading.demo.ok")}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* 任务栏 */}
              <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-r from-[#245edb] via-[#3c83eb] to-[#245edb] border-t border-[#6699ff]/50 flex items-center px-1">
                <div className="h-4 px-1.5 bg-gradient-to-b from-[#3c9a3c] to-[#2d7d2d] rounded flex items-center gap-1 text-[7px] text-white font-bold">
                  <span>🪟</span>
                  <span>Start</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 显示器底座 */}
        <div className="bg-gradient-to-b from-slate-400 to-slate-500 dark:from-slate-600 dark:to-slate-700 h-3 mx-8 rounded-b" />
        <div className="bg-gradient-to-b from-slate-500 to-slate-400 dark:from-slate-700 dark:to-slate-600 h-8 mx-16 rounded-b-lg" />
      </div>

      {/* 标签 */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 rounded-full">
          <FaCompactDisc className="text-xs text-slate-500" />
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t("asyncLoading.demo.legacyClient")}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t("asyncLoading.demo.developedFor")}
        </div>
      </div>
    </div>
  );
}

// 网页版演示 - 使用真实截图
function WebVersionDemo() {
  const { t } = useTranslation();

  return (
    <div className="relative">
      {/* 现代浏览器窗口 */}
      <div className="relative mx-auto w-64 sm:w-80">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* 浏览器标题栏 */}
          <div className="bg-slate-100 dark:bg-slate-900 px-3 py-2 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 mx-2">
              <div className="bg-white dark:bg-slate-800 rounded-md px-3 py-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>🔒</span>
                <span>vibe2d.vercel.app</span>
              </div>
            </div>
          </div>

          {/* 游戏画面 - 真实截图 */}
          <div className="aspect-video relative bg-slate-900 overflow-hidden">
            <img
              src="/screenshot/screenshot.png"
              alt="Game Screenshot"
              className="w-full h-full object-cover object-center"
            />
            {/* 正在游玩标识 */}
            <motion.div
              className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                className="w-2 h-2 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
              />
              <span className="text-[10px] text-white font-medium">{t("asyncLoading.demo.playing")}</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* 标签 */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
          <FaGlobe className="text-xs text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            {t("asyncLoading.demo.webVersion")}
          </span>
        </div>
        <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          {t("asyncLoading.demo.anyDevice")}
        </div>
      </div>
    </div>
  );
}

// 按需加载数据流演示
function OnDemandLoadingDemo() {
  const { t } = useTranslation();
  const [loadedChunks, setLoadedChunks] = React.useState<Set<number>>(new Set([0, 1]));
  const [playerPos, setPlayerPos] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setPlayerPos(prev => {
        const next = (prev + 1) % 16;
        setLoadedChunks(loaded => {
          const newLoaded = new Set(loaded);
          newLoaded.add(next);
          // 加载相邻区块
          const row = Math.floor(next / 4);
          const col = next % 4;
          if (col > 0) newLoaded.add(next - 1);
          if (col < 3) newLoaded.add(next + 1);
          if (row > 0) newLoaded.add(next - 4);
          if (row < 3) newLoaded.add(next + 4);
          return newLoaded;
        });
        return next;
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  const icons = ["🏠", "🌲", "⛰️", "🏯", "🌊", "🌳", "🗿", "🏰", "🌾", "🌸", "🎋", "⛩️", "🏔️", "🌴", "🎪", "🗼"];

  return (
    <div className="max-w-sm mx-auto">
      {/* 地图网格 */}
      <div className="grid grid-cols-4 gap-2 p-4 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/50 dark:to-orange-900/50 rounded-2xl border border-amber-200 dark:border-amber-800">
        {[...Array(16)].map((_, i) => {
          const isLoaded = loadedChunks.has(i);
          const isPlayer = playerPos === i;
          return (
            <motion.div
              key={i}
              className={`aspect-square rounded-lg flex items-center justify-center text-xl relative border-2 transition-all duration-300 ${
                isLoaded
                  ? "bg-amber-200/80 dark:bg-amber-700/50 border-amber-400 dark:border-amber-600"
                  : "bg-slate-300/50 dark:bg-slate-800/50 border-slate-400/30 dark:border-slate-600/30"
              }`}
              animate={{
                scale: isPlayer ? 1.1 : 1,
                opacity: isLoaded ? 1 : 0.4,
              }}
            >
              {isLoaded ? (
                <span className="drop-shadow">{icons[i]}</span>
              ) : (
                <span className="text-sm text-slate-400">?</span>
              )}
              {isPlayer && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-lg border-2 border-blue-500"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.8, repeat: Number.POSITIVE_INFINITY }}
                  />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                    🎮 {t("asyncLoading.demo.player")}
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* 统计数据 */}
      <div className="mt-4 flex justify-center gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">2GB</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("asyncLoading.stats.total")}</div>
        </div>
        <div className="text-center">
          <motion.div
            className="text-2xl font-bold text-emerald-600 dark:text-emerald-400"
            key={loadedChunks.size}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {Math.round((loadedChunks.size / 16) * 200)}MB
          </motion.div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("asyncLoading.stats.loaded")}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {100 - Math.round((loadedChunks.size / 16) * 100)}%
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("asyncLoading.stats.saved")}</div>
        </div>
      </div>
    </div>
  );
}

export function CrossPlatformSection() {
  const { t } = useTranslation();

  return (
    <section className="relative py-32 overflow-hidden">
      {/* 动态背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* 网格背景 */}
      <div className="absolute inset-0 opacity-30 dark:opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(99, 102, 241, 0.15) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(99, 102, 241, 0.15) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* 动态光晕 */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 4 }}
      />

      {/* 流动粒子效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-emerald-400/40"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -200, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Number.POSITIVE_INFINITY,
              delay: Math.random() * 4,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题区域 - 增强版 */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {/* 发光徽章 */}
          <motion.div
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full relative mb-8 overflow-hidden"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            {/* 徽章发光效果 */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 dark:from-emerald-500/30 dark:to-cyan-500/30 blur-xl" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:to-cyan-500/20 border border-emerald-500/40 dark:border-emerald-500/30" />
            {/* 扫光效果 */}
            <motion.div
              className="absolute inset-y-0 w-1/3 rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.4), transparent)",
              }}
              animate={{
                left: ["-33%", "100%"],
              }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3, ease: "easeInOut" }}
            />
            <HiSparkles className="relative text-lg text-emerald-600 dark:text-emerald-400" />
            <span className="relative text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {t("asyncLoading.badge")}
            </span>
          </motion.div>

          {/* 主标题 - 带发光效果 */}
          <div className="relative">
            <motion.h2
              className="text-4xl sm:text-5xl lg:text-7xl font-black mb-8 relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              {/* 发光背景文字 */}
              <span
                className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent blur-2xl opacity-50"
                aria-hidden="true"
              >
                {t("asyncLoading.title")}
              </span>
              <span className="relative bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {t("asyncLoading.title")}
              </span>
            </motion.h2>

            {/* 闪烁装饰线 */}
            <motion.div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 rounded-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
              initial={{ width: 0, opacity: 0 }}
              whileInView={{ width: "60%", opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6, duration: 0.8 }}
            />
          </div>

          <motion.p
            className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            {t("asyncLoading.subtitle")}
          </motion.p>

          {/* 快速统计数据 */}
          <motion.div
            className="flex flex-wrap justify-center gap-8 mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.7 }}
          >
            {[
              { value: "<3s", labelKey: "startSpeedDesc", glowClass: "bg-emerald-500/20", textClass: "from-emerald-400 to-emerald-300" },
              { value: "5MB", labelKey: "initialLoadDesc", glowClass: "bg-cyan-500/20", textClass: "from-cyan-400 to-cyan-300" },
              { value: "100%", labelKey: "crossPlatform", glowClass: "bg-blue-500/20", textClass: "from-blue-400 to-blue-300" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="relative group"
                whileHover={{ scale: 1.05 }}
              >
                <div className={`absolute inset-0 rounded-2xl ${stat.glowClass} blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="relative px-6 py-4 rounded-2xl bg-white/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm shadow-sm dark:shadow-none">
                  <div className={`text-3xl font-black bg-gradient-to-r ${stat.textClass} bg-clip-text text-transparent`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{t(`asyncLoading.table.${stat.labelKey}`)}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* 对比区域 - 现代卡片设计 */}
        <div className="mb-24 relative">
          {/* 中央连接线动画 */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px">
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500 to-transparent"
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-stretch">
            {/* 左侧：传统客户端 */}
            <motion.div
              className="relative group"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              {/* 红色光晕 */}
              <div className="absolute -inset-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative h-full rounded-3xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900/90 dark:to-slate-800/90 border border-red-200 dark:border-red-500/20 overflow-hidden backdrop-blur-xl shadow-lg dark:shadow-none">
                {/* 顶部边框发光 */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-400/50 dark:via-red-500/50 to-transparent" />

                {/* 头部 */}
                <div className="px-8 py-6 border-b border-red-200/50 dark:border-red-500/10 bg-gradient-to-r from-red-50 dark:from-red-950/50 to-transparent">
                  <div className="flex items-center gap-4">
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/30"
                      whileHover={{ rotate: 180 }}
                      transition={{ duration: 0.5 }}
                    >
                      <FaCompactDisc className="text-2xl text-white" />
                    </motion.div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-800 dark:text-white">
                        {t("asyncLoading.platforms.legacy")}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">{t("asyncLoading.status.outdated")}</span>
                        <span className="text-sm text-slate-500">C++ · DirectX · 2001</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 演示区 */}
                <div className="p-8">
                  <LegacyClientDemo />
                </div>

                {/* 问题列表 */}
                <div className="px-8 pb-8">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <FaWindows />, labelKey: "windowsOnly", status: "limited" },
                      { icon: <FaApple />, labelKey: "noMac", status: "no" },
                      { icon: <FaLinux />, labelKey: "noLinux", status: "no" },
                      { icon: <FaMobileAlt />, labelKey: "noMobile", status: "no" },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/30"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 * i }}
                      >
                        <span className={item.status === "no" ? "text-red-500 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}>{item.icon}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{t(`asyncLoading.legacy.${item.labelKey}`)}</span>
                        {item.status === "no" && <FaTimes className="ml-auto text-red-400 text-xs" />}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 右侧：网页版 */}
            <motion.div
              className="relative group"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {/* 绿色光晕 */}
              <div className="absolute -inset-4 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="relative h-full rounded-3xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900/90 dark:to-slate-800/90 border border-emerald-200 dark:border-emerald-500/20 overflow-hidden backdrop-blur-xl shadow-lg dark:shadow-none">
                {/* 顶部边框发光 */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 dark:via-emerald-500/50 to-transparent" />

                {/* 角落装饰 */}
                <motion.div
                  className="absolute top-4 right-4 w-16 h-16"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/20" />
                </motion.div>

                {/* 头部 */}
                <div className="px-8 py-6 border-b border-emerald-200/50 dark:border-emerald-500/10 bg-gradient-to-r from-emerald-50 dark:from-emerald-950/50 to-transparent">
                  <div className="flex items-center gap-4">
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                      animate={{
                        boxShadow: ["0 10px 40px rgba(16, 185, 129, 0.3)", "0 10px 60px rgba(16, 185, 129, 0.5)", "0 10px 40px rgba(16, 185, 129, 0.3)"]
                      }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    >
                      <FaGlobe className="text-2xl text-white" />
                    </motion.div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-800 dark:text-white">
                        {t("asyncLoading.platforms.web")}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium">{t("asyncLoading.status.recommended")}</span>
                        <span className="text-sm text-slate-500">TypeScript · Canvas · 2024</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 演示区 */}
                <div className="p-8">
                  <WebVersionDemo />
                </div>

                {/* 支持列表 */}
                <div className="px-8 pb-8">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <FaWindows />, label: "Windows" },
                      { icon: <FaApple />, label: "macOS" },
                      { icon: <FaLinux />, label: "Linux" },
                      { icon: <FaAndroid />, label: "Android" },
                      { icon: <FaChrome />, label: "Chrome" },
                      { icon: <FaSafari />, label: "Safari" },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20"
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 * i }}
                        whileHover={{ scale: 1.02, borderColor: "rgba(16, 185, 129, 0.5)" }}
                      >
                        <span className="text-emerald-600 dark:text-emerald-400">{item.icon}</span>
                        <span className="text-xs text-slate-700 dark:text-slate-300">{item.label}</span>
                        <FaCheck className="ml-auto text-emerald-400 text-xs" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 中央 VS 标识 */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden lg:flex"
            initial={{ scale: 0, rotate: -180 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", delay: 0.5 }}
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500 to-emerald-500 blur-xl"
                animate={{ opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 border-4 border-slate-300 dark:border-slate-700 shadow-2xl flex items-center justify-center">
                <HiLightningBolt className="text-3xl text-amber-500 dark:text-amber-400" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* 核心指标对比 - 现代霓虹风格 */}
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <motion.h3
            className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            {t("asyncLoading.comparison.title")}
          </motion.h3>

          <div className="space-y-5">
            {/* 启动速度 */}
            <ComparisonRow
              icon={<FaBolt className="text-amber-400" />}
              iconBg="bg-amber-500/10 border border-amber-500/30"
              label={t("asyncLoading.table.startSpeed")}
              legacy="~30 min"
              legacyNote={t("asyncLoading.table.downloadFirst")}
              web="<3s"
              webNote={t("asyncLoading.table.instantStart")}
              highlight="600×"
              highlightGradient="from-amber-500 to-orange-400"
              delay={0}
            />

            {/* 初始加载 */}
            <ComparisonRow
              icon={<FaCube className="text-blue-400" />}
              iconBg="bg-blue-500/10 border border-blue-500/30"
              label={t("asyncLoading.table.initialLoad")}
              legacy="2GB"
              legacyNote={t("asyncLoading.table.fullDownload")}
              web="<5MB"
              webNote={t("asyncLoading.table.minimalLoad")}
              highlight="400×"
              highlightGradient="from-blue-500 to-cyan-400"
              delay={0.1}
            />

            {/* 资源加载 */}
            <ComparisonRow
              icon={<FaSyncAlt className="text-cyan-400" />}
              iconBg="bg-cyan-500/10 border border-cyan-500/30"
              label={t("asyncLoading.table.resourceLoad")}
              legacy={t("asyncLoading.table.preDownload")}
              legacyNote={t("asyncLoading.table.allAtOnce")}
              web={t("asyncLoading.table.onDemand")}
              webNote={t("asyncLoading.table.asNeeded")}
              highlight={t("asyncLoading.highlight.smart")}
              highlightGradient="from-cyan-500 to-teal-400"
              delay={0.2}
            />

            {/* 存储占用 */}
            <ComparisonRow
              icon={<FaHdd className="text-purple-400" />}
              iconBg="bg-purple-500/10 border border-purple-500/30"
              label={t("asyncLoading.table.storage")}
              legacy="2GB+"
              legacyNote={t("asyncLoading.table.permanentSpace")}
              web="0"
              webNote={t("asyncLoading.table.browserCache")}
              highlight={t("asyncLoading.highlight.zeroStorage")}
              highlightGradient="from-purple-500 to-pink-400"
              delay={0.3}
            />
          </div>

          {/* 浏览器支持展示 */}
          <motion.div
            className="mt-16 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-sm text-slate-600 dark:text-slate-500 mb-6">{t("asyncLoading.browserSupport")}</p>
            <div className="flex justify-center gap-4">
              {[
                { icon: <FaChrome />, name: "Chrome" },
                { icon: <FaSafari />, name: "Safari" },
                { icon: <FaFirefox />, name: "Firefox" },
                { icon: <FaEdge />, name: "Edge" },
              ].map((browser, i) => (
                <motion.div
                  key={i}
                  className="group relative"
                  whileHover={{ y: -5 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                >
                  <div className="absolute inset-0 rounded-xl bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative w-14 h-14 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-2xl text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:border-emerald-400 dark:group-hover:border-emerald-500/30 transition-colors shadow-sm dark:shadow-none">
                    {browser.icon}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
