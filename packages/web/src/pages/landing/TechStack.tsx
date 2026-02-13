/**
 * TechStack - 技术栈展示
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

// 技术 Logo 组件
function TechLogo({ name, icon, color }: { name: string; icon: string; color: string }) {
  return (
    <motion.div whileHover={{ scale: 1.1, y: -5 }} className="flex flex-col items-center gap-2">
      <div
        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-3xl sm:text-4xl shadow-lg hover:shadow-xl transition-shadow ${color}`}
      >
        {icon}
      </div>
      <span className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">{name}</span>
    </motion.div>
  );
}

const technologies = [
  { name: "TypeScript", icon: "🔷", color: "hover:border-blue-500" },
  { name: "React 19", icon: "⚛️", color: "hover:border-amber-500" },
  { name: "Vite", icon: "⚡", color: "hover:border-orange-500" },
  { name: "WebGL", icon: "🎨", color: "hover:border-orange-500" },
  { name: "Tailwind", icon: "🌊", color: "hover:border-teal-500" },
  { name: "Web Audio", icon: "🔊", color: "hover:border-pink-500" },
];

export function TechStack() {
  const { t } = useTranslation();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-100 via-zinc-50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white">
            {t("tech.title")}
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">{t("tech.subtitle")}</p>
        </motion.div>

        {/* 技术栈网格 */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-8 sm:gap-12"
        >
          {technologies.map((tech, index) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
            >
              <TechLogo {...tech} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
