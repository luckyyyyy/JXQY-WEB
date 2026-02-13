import type { TranslationSchema } from "@miu2d/i18n";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const i18nModule = require("@miu2d/i18n") as typeof import("@miu2d/i18n");

export type Language = "zh" | "en";

const resources = {
	zh: i18nModule.zh,
	en: i18nModule.en
} as const;

type TranslationRoot = TranslationSchema["translation"];

export const normalizeLanguage = (value?: string): Language => {
	if (!value) return "zh";
	const lower = value.toLowerCase();
	if (lower.startsWith("en")) return "en";
	if (lower.startsWith("zh")) return "zh";
	return "zh";
};

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