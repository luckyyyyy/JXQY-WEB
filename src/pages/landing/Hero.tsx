/**
 * Hero - 首屏区域
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GridLine, GridNode, FloatingOrb, GridPattern } from "@/components";

export function Hero() {
  const { t } = useTranslation();

  const scrollToDemo = () => {
    const el = document.getElementById("demo");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-[100svh] md:min-h-0 md:h-[70vh] flex items-center justify-center overflow-hidden pt-20 md:pt-16">
      {/* 背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />

      {/* 动态装饰球 - 橙色系 */}
      <FloatingOrb
        className="w-[600px] h-[600px] bg-orange-500/30 dark:bg-orange-600/20 -top-40 -left-40"
        delay={0}
      />
      <FloatingOrb
        className="w-[500px] h-[500px] bg-amber-400/25 dark:bg-amber-500/15 top-20 -right-40"
        delay={2}
      />
      <FloatingOrb
        className="w-[400px] h-[400px] bg-yellow-400/20 dark:bg-yellow-500/10 bottom-20 left-1/4"
        delay={4}
      />

      {/* 网格背景 */}
      <GridPattern />

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

      {/* 主内容 */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* 标题 - 橙色渐变 */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-6xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight"
        >
          <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
            {t("hero.title")}
          </span>
        </motion.h1>

        {/* Slogan */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-6 text-xl sm:text-2xl text-zinc-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed"
        >
          {t("hero.slogan")}
        </motion.p>

        {/* CTA Buttons - 橙色 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.a
            href="/game"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-shadow"
          >
            {t("hero.cta.start")}
          </motion.a>
          <motion.button
            type="button"
            onClick={scrollToDemo}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="px-8 py-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {t("hero.cta.demo")}
          </motion.button>
        </motion.div>

        {/* 技术栈标签 */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            {
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              ),
              label: t("techStack.editor"),
            },
            {
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10a7 7 0 1 1-14 0" />
                  <path d="M12 14v8M8 18h8" />
                </svg>
              ),
              label: t("techStack.aiAgent"),
            },
            {
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              ),
              label: t("techStack.scriptEngine"),
            },
            {
              icon: (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              ),
              label: t("techStack.asyncLoading"),
            },
          ].map((tech, i) => (
            <motion.div
              key={tech.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.5 + i * 0.1 }}
              className="px-4 py-2 rounded-full bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50 flex items-center gap-2 text-zinc-600 dark:text-zinc-400"
            >
              {tech.icon}
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tech.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
