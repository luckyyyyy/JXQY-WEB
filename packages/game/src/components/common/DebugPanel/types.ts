/**
 * Debug Panel 类型定义
 */

import type { GameVariables } from "@miu2d/engine/core/types";
import type { MagicItemInfo } from "@miu2d/engine/magic";
import type { ResourceStats } from "@miu2d/engine/resource/resource-loader";
import type { PerformanceStatsData } from "@miu2d/engine/runtime/performance-stats";

export interface PlayerStats {
  level: number;
  life: number;
  lifeMax: number;
  thew: number;
  thewMax: number;
  mana: number;
  manaMax: number;
  exp: number;
  levelUpExp: number;
  money: number;
  state: number;
  isInFighting: boolean;
}

export interface LoadedResources {
  mapName: string;
  mapPath: string;
  npcCount: number;
  objCount: number;
  npcFile: string;
  objFile: string;
}

export interface ScriptInfo {
  filePath: string;
  currentLine: number;
  totalLines: number;
  allCodes: string[];
  isCompleted?: boolean;
  executedLines?: Set<number>;
}

export interface ScriptHistoryItem {
  filePath: string;
  totalLines: number;
  allCodes: string[];
  timestamp: number;
  executedLines?: Set<number>;
}

export interface DebugPanelProps {
  isGodMode: boolean;
  playerStats?: PlayerStats;
  playerPosition?: { x: number; y: number };
  loadedResources?: LoadedResources;
  resourceStats?: ResourceStats;
  performanceStats?: PerformanceStatsData;
  gameVariables?: GameVariables;
  xiuLianMagic?: MagicItemInfo | null;
  triggeredTrapIds?: number[];
  currentScriptInfo?: ScriptInfo | null;
  scriptHistory?: ScriptHistoryItem[];
  onClose?: () => void;
  onSetGameVariable?: (name: string, value: number) => void;
  onFullAll: () => void;
  onSetLevel: (level: number) => void;
  onAddMoney: (amount: number) => void;
  onToggleGodMode: () => void;
  onReduceLife: () => void;
  onKillAllEnemies: () => void;
  onExecuteScript?: (scriptPath: string) => Promise<string | null>;
  onAddItem?: (itemFile: string) => Promise<void>;
  onAddMagic?: (magicFile: string) => Promise<void>;
  onAddAllMagics?: () => Promise<void>;
  onXiuLianLevelUp?: () => void;
  onXiuLianLevelDown?: () => void;
  onReloadMagicConfig?: () => Promise<void>;
}
