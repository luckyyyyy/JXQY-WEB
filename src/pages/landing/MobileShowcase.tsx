/**
 * MobileShowcase - 移动端支持重点展示
 *
 * 在"强大的引擎能力"上方重点介绍原生移动端支持
 */

import React from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { FaMobileAlt, FaGamepad, FaHandPointer, FaExpand } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi";

export function MobileShowcase() {
  const { t } = useTranslation();

  const features = [
    {
      icon: <FaGamepad className="text-xl" />,
      titleKey: "mobile.features.joystick.title",
      descKey: "mobile.features.joystick.desc",
    },
    {
      icon: <FaHandPointer className="text-xl" />,
      titleKey: "mobile.features.touch.title",
      descKey: "mobile.features.touch.desc",
    },
    {
      icon: <FaExpand className="text-xl" />,
      titleKey: "mobile.features.responsive.title",
      descKey: "mobile.features.responsive.desc",
    },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* 装饰性光晕 */}
      <motion.div
        className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 3 }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题区域 */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* 徽章 */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <HiSparkles className="text-emerald-500" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {t("mobile.badge")}
            </span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent mb-4">
            {t("mobile.title")}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t("mobile.subtitle")}
          </p>
        </motion.div>

        {/* 主要内容区域 - 左侧截图，右侧特性 */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* 左侧 - 横屏截图展示 */}
          <motion.div
            className="relative order-2 lg:order-1"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="relative mx-auto max-w-[520px]">
              {/* 横屏手机外框 */}
              <div className="relative rounded-[2rem] bg-gradient-to-b from-slate-800 to-slate-900 p-2 shadow-2xl shadow-slate-900/50">
                {/* 屏幕 - 使用实际图片比例 2532:1170 ≈ 2.16:1 */}
                <div className="relative rounded-[1.5rem] overflow-hidden bg-black" style={{ aspectRatio: '2532 / 1170' }}>
                  {/* 真实游戏截图 */}
                  <img
                    src="/screenshot/mobile.png"
                    alt="Mobile Game Screenshot"
                    className="w-full h-full object-cover"
                  />

                  {/* 游戏中标识 */}
                  <motion.div
                    className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  >
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-white font-medium">{t("mobile.playing")}</span>
                  </motion.div>
                </div>
              </div>

              {/* 装饰性元素 */}
              <motion.div
                className="absolute -top-4 -right-4 w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 opacity-20 blur-xl"
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
              />
              <motion.div
                className="absolute -bottom-4 -left-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 opacity-20 blur-xl"
                animate={{ scale: [1.2, 1, 1.2], rotate: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, delay: 2 }}
              />
            </div>
          </motion.div>

          {/* 右侧 - 特性列表 */}
          <motion.div
            className="order-1 lg:order-2 space-y-6"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {/* 特性卡片 */}
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="group relative p-6 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-emerald-500/50 transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                {/* 悬浮光效 */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative flex items-start gap-4">
                  {/* 图标 */}
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
                    {feature.icon}
                  </div>

                  {/* 内容 */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-1">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                      {t(feature.descKey)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* 底部提示 */}
            <motion.div
              className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              <FaMobileAlt className="text-emerald-600 dark:text-emerald-400 text-lg shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {t("mobile.hint")}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
