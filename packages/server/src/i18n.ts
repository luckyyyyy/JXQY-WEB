import { en, type TranslationSchema, zh } from "@miu2d/shared/locales";
import type { Language } from "@miu2d/types";
import { normalizeLanguage } from "@miu2d/types";

// Re-export for convenience within server package
export { normalizeLanguage };
export type { Language };

const resources = {
  zh,
  en,
} as const;

type TranslationRoot = TranslationSchema["translation"];

const getByPath = (root: TranslationRoot, path: string): unknown => {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    if (!(key in acc)) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, root);
};

export const t = (language: Language, key: string): string => {
  const root = resources[language]?.translation ?? resources.zh.translation;
  const value = getByPath(root, key);
  return typeof value === "string" ? value : key;
};

export const getMessage = (language: Language, key: string, fallback?: string): string => {
  const value = t(language, key);
  if (value === key && fallback) return fallback;
  return value;
};
