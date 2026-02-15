/**
 * Header - 官网顶部导航
 */

import { useAuth, useTheme } from "@miu2d/shared";
import { type Locale, supportedLanguages } from "@miu2d/shared/i18n";
import { Avatar, GitHubIcon, GlobeIcon, MoonIcon, SunIcon } from "@miu2d/ui";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const locale = i18n.language as Locale;
  const setLocale = (lang: Locale) => i18n.changeLanguage(lang);
  const locales = [...supportedLanguages];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 border-b border-zinc-200/50 dark:border-zinc-800/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent"
            whileHover={{ scale: 1.02 }}
          >
            <span className="text-2xl">⚡</span>
            Miu2D
          </motion.button>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              type="button"
              onClick={() => scrollTo("features")}
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {t("nav.features")}
            </button>
            <button
              type="button"
              onClick={() => scrollTo("demo")}
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {t("nav.demo")}
            </button>
            <a
              href="https://github.com/luckyyyyy/miu2d"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <GitHubIcon className="w-5 h-5" />
              {t("nav.github")}
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <div className="relative group">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
              >
                <GlobeIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400 uppercase">{locale}</span>
              </motion.button>
              <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all min-w-[120px]">
                {locales.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocale(l)}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                      locale === l
                        ? "text-orange-600 dark:text-orange-400 font-medium"
                        : "text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {t(`lang.${l}` as "lang.zh" | "lang.en" | "lang.ja")}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Toggle */}
            <motion.button
              type="button"
              onClick={toggleTheme}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {theme === "dark" ? (
                <SunIcon className="w-5 h-5 text-zinc-400" />
              ) : (
                <MoonIcon className="w-5 h-5 text-zinc-600" />
              )}
            </motion.button>

            {/* Auth */}
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm"
              >
                <Avatar name={user?.name || "?"} avatarUrl={user?.settings?.avatarUrl} size={22} />
                <span className="hidden sm:inline">{user?.name}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 ml-1">
                <Link
                  to="/login"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm"
                >
                  {t("nav.register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
