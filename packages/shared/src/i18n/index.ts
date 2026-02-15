/**
 * i18n 配置 - 使用 react-i18next
 */

import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";

export const supportedLanguages = ["zh", "en", "ja"] as const;
export type Locale = (typeof supportedLanguages)[number];

const resources = {
  zh: { translation: zh },
  en: { translation: en },
  ja: { translation: ja },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh",
    supportedLngs: supportedLanguages,

    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "Miu2D_locale",
    },

    interpolation: {
      escapeValue: false, // React 已经处理 XSS
    },
  });

export default i18n;
