/**
 * Dashboard 类型定义
 */

export interface NavSection {
  id: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon?: string;
}

export interface SidebarState {
  expanded: Set<string>;
  activeItem: string | null;
}

/**
 * 功能模块定义
 */
export const DASHBOARD_MODULES = {
  gameSettings: {
    id: "game-settings",
    label: "游戏编辑",
    icon: "game",
    basePath: "game",
  },
  player: {
    id: "player",
    label: "玩家角色",
    icon: "character",
    basePath: "player",
  },
  npcs: {
    id: "npcs",
    label: "NPC编辑",
    icon: "npc",
    basePath: "npcs",
  },
  objs: {
    id: "objs",
    label: "物件管理",
    icon: "obj",
    basePath: "objs",
  },
  goods: {
    id: "goods",
    label: "物品编辑",
    icon: "goods",
    basePath: "goods",
  },
  shops: {
    id: "shops",
    label: "商店编辑",
    icon: "shop",
    basePath: "shops",
  },
  levels: {
    id: "levels",
    label: "等级与强度编辑",
    icon: "level",
    basePath: "levels",
  },
  magic: {
    id: "magic",
    label: "武功编辑",
    icon: "magic",
    basePath: "magic",
  },
  scenes: {
    id: "scenes",
    label: "场景编辑",
    icon: "map",
    basePath: "scenes",
  },
  resources: {
    id: "resources",
    label: "资源管理器",
    icon: "folder",
    basePath: "resources",
  },
  gameModules: {
    id: "game-modules",
    label: "游戏模块",
    icon: "gameModules",
    basePath: "game-modules",
  },
  statistics: {
    id: "statistics",
    label: "数据统计",
    icon: "chart",
    basePath: "statistics",
  },
} as const;

export type ModuleId = keyof typeof DASHBOARD_MODULES;
