/**
 * 404 Not Found Page
 * 遵循官网设计风格的 404 错误页面
 */

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/contexts";
import { GridBackground } from "@/components";

function NotFoundContent() {
  const { t } = useTranslation();

  return (
    <GridBackground className="min-h-screen flex flex-col items-center justify-center">
      {/* 主要内容 */}
      <div className="text-center px-4">
        {/* 404 数字 */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-[10rem] sm:text-[14rem] font-extrabold leading-none tracking-tight"
        >
          <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
            404
          </span>
        </motion.h1>

        {/* 标题 */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-white mt-2"
        >
          {t("notFound.title")}
        </motion.h2>

        {/* 描述 */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-zinc-600 dark:text-zinc-400 mt-4 max-w-md mx-auto"
        >
          {t("notFound.desc")}
        </motion.p>

        {/* 返回首页链接 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 font-medium transition-colors"
          >
            <span className="text-2xl">⚡</span>
            <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent font-bold text-lg">
              Vibe2D Engine
            </span>
          </Link>
        </motion.div>
      </div>
    </GridBackground>
  );
}

export default function NotFoundPage() {
  return (
    <ThemeProvider>
      <NotFoundContent />
    </ThemeProvider>
  );
}
