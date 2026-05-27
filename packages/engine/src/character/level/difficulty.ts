/**
 * 难度配置 - 玩家与伙伴共用的全局等级配置
 *
 * 通过 GameManager 持有当前 difficulty，切换时重新加载等级表并
 * 重算 player + 所有伙伴的基础属性。
 */

export type Difficulty = "easy" | "hard";

export const DEFAULT_DIFFICULTY: Difficulty = "easy";

export const DIFFICULTY_LEVEL_FILES: Record<Difficulty, string> = {
  easy: "level-easy.ini",
  hard: "level-hard.ini",
};

const FILE_TO_DIFFICULTY: Record<string, Difficulty> = {
  "level-easy.ini": "easy",
  "level-hard.ini": "hard",
};

/** 由等级文件名解析难度（小写/带或不带 ini\ 前缀都接受） */
export function difficultyFromLevelFile(file: string): Difficulty | null {
  if (!file) return null;
  const key = file.toLowerCase().replace(/^ini[\\/]+level[\\/]+/, "");
  return FILE_TO_DIFFICULTY[key] ?? null;
}

export function levelFileForDifficulty(d: Difficulty): string {
  return DIFFICULTY_LEVEL_FILES[d];
}
