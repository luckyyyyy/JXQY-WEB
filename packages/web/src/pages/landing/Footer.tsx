/**
 * Footer - 页脚
 */

import { DiscordIcon, GitHubIcon, TwitterIcon } from "@miu2d/ui";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const links = {
    project: [
      { label: t("nav.features"), href: "#features" },
      { label: t("nav.demo"), href: "/game/demo" },
      { label: "Roadmap", href: "#" },
    ],
    resources: [
      { label: t("nav.docs"), href: "#" },
      { label: "API Reference", href: "#" },
      { label: "Examples", href: "#" },
    ],
    community: [
      { label: "GitHub", href: "https://github.com/luckyyyyy/miu2d", external: true },
      { label: "Discord", href: "#" },
      { label: "Twitter", href: "#" },
    ],
  };

  return (
    <footer className="relative py-16 overflow-hidden border-t border-zinc-200 dark:border-zinc-800">
      {/* 背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          {/* 品牌区 */}
          <div className="md:col-span-1">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent"
            >
              <span className="text-2xl">⚡</span>
              Miu2D Engine
            </motion.div>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{t("footer.desc")}</p>

            {/* 社交链接 */}
            <div className="mt-6 flex items-center gap-4">
              <motion.a
                href="https://github.com/luckyyyyy/miu2d"
                target="_blank"
                rel="noreferrer"
                whileHover={{ scale: 1.1 }}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <GitHubIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </motion.a>
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <TwitterIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <DiscordIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </motion.button>
            </div>
          </div>

          {/* 链接列 */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
              {t("footer.links")}
            </h4>
            <ul className="mt-4 space-y-3">
              {links.project.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
              {t("footer.resources")}
            </h4>
            <ul className="mt-4 space-y-3">
              {links.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
              {t("footer.community")}
            </h4>
            <ul className="mt-4 space-y-3">
              {links.community.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noreferrer" : undefined}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 版权 */}
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            © {currentYear} Miu2D Engine. {t("footer.license")}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Made with ❤️ and AI ✨</p>
        </div>
      </div>
    </footer>
  );
}
