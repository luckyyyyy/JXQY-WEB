/**
 * CTA - Call to Action 区域
 */

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

// GitHub 图标
function _GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
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
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

export function CTA() {
  const { t } = useTranslation();

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600" />

      {/* 装饰光斑 */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-yellow-400/20 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-white">{t("cta.title")}</h2>
          <p className="mt-4 text-xl text-orange-100">{t("cta.subtitle")}</p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.a
              href="/game/demo"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-orange-600 font-semibold shadow-lg shadow-black/20 hover:bg-zinc-100 transition-colors"
            >
              <span className="text-xl">🎮</span>
              {t("cta.startGame")}
            </motion.a>
            <motion.a
              href="https://github.com/nicepkg/Miu2D"
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white/10 text-white font-semibold border border-white/30 hover:bg-white/20 transition-colors backdrop-blur-sm"
            >
              <BookIcon className="w-5 h-5" />
              {t("cta.docs")}
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
