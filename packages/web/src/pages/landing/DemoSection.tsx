/**
 * DemoSection - 游戏嵌入演示区域
 *
 * 通过 iframe 嵌入 /game/demo?embed=1（无顶栏模式）
 */

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// 计算游戏尺寸的纯函数
function calculateGameSize() {
  // SSR 安全检查
  if (typeof window === "undefined") {
    return { width: 800, height: 600, isMobile: false };
  }
  const mobile = window.innerWidth < 768;
  if (mobile) {
    const width = Math.min(window.innerWidth - 32, 800);
    const height = Math.round(width * 0.75); // 4:3 比例
    return { width, height, isMobile: true };
  }
  return { width: 800, height: 600, isMobile: false };
}

export function DemoSection() {
  const { t } = useTranslation();
  const [isLoaded, setIsLoaded] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [gameSize, setGameSize] = useState(calculateGameSize);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobile = gameSize.isMobile;

  // 监听窗口尺寸变化
  useEffect(() => {
    const handleResize = () => {
      setGameSize(calculateGameSize());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 当进入视口时才加载游戏
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !showGame) {
            setShowGame(true);
          }
        });
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [showGame]);

  return (
    <section id="demo" ref={containerRef} className="relative py-12 sm:py-16 overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-100 via-zinc-50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white">
            {t("demo.title")}
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">{t("demo.subtitle")}</p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">{t("demo.copyright")}</p>
        </motion.div>

        {/* 游戏容器 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto"
          style={{ width: isMobile ? "100%" : 800, maxWidth: "100%" }}
        >
          {/* 装饰边框 */}
          <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-2xl opacity-70 blur-sm" />

          {/* 游戏框架 */}
          <div className="relative bg-zinc-900 rounded-xl overflow-hidden shadow-2xl">
            {/* 顶部装饰条 */}
            <div className="h-8 bg-zinc-800 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-4 text-xs text-zinc-500">Miu2D Engine - 月影传说</span>
            </div>

            {/* 游戏区域 - iframe 嵌入 /game/demo?embed=1 */}
            <div
              className="relative bg-black overflow-hidden"
              style={{
                width: gameSize.width,
                height: gameSize.height,
                maxWidth: "100%",
              }}
            >
              {showGame ? (
                <>
                  <iframe
                    src="/game/demo?embed=1"
                    title="Miu2D Demo"
                    className="w-full h-full border-0"
                    style={{ width: gameSize.width, height: gameSize.height }}
                    allow="autoplay"
                    onLoad={() => setIsLoaded(true)}
                  />
                  {/* 加载遮罩 */}
                  {!isLoaded && (
                    <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "linear",
                        }}
                        className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full"
                      />
                      <p className="mt-4 text-zinc-400">{t("demo.loading")}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500">
                  <div className="text-6xl mb-4">🎮</div>
                  <p>滚动以加载游戏</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* 操作提示 */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400"
        >
          {t("demo.hint")}
        </motion.p>
      </div>
    </section>
  );
}
