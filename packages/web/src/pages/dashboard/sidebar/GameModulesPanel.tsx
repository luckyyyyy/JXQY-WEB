/**
 * 游戏模块面板 - 左侧分组导航（与游戏编辑共用 SectionedModuleNav）+ 右侧子模块列表面板
 */
import { useLocation } from "react-router-dom";
import { SectionedModuleNav, type ModuleNavSection } from "./ModuleNav";
import { NpcListPanel } from "./NpcListPanel";
import { MagicListPanel } from "./MagicListPanel";
import { GoodsListPanel } from "./GoodsListPanel";
import { ObjListPanel } from "./ObjListPanel";
import { ShopListPanel } from "./ShopListPanel";
import { LevelListPanel } from "./LevelListPanel";

/** 游戏模块分组导航（与游戏编辑共用 SectionedModuleNav 组件） */
const gameModuleSections: ModuleNavSection[] = [
  {
    label: "战斗实体",
    accent: "blue",
    items: [
      { id: "npcs", label: "NPC", path: "npcs" },
      { id: "magic", label: "武功", path: "magic" },
    ],
  },
  {
    label: "物品系统",
    accent: "emerald",
    items: [
      { id: "goods", label: "物品", path: "goods" },
      { id: "objs", label: "物件", path: "objs" },
      { id: "shops", label: "商店", path: "shops" },
    ],
  },
  {
    label: "成长系统",
    accent: "rose",
    items: [
      { id: "levels", label: "等级", path: "levels" },
    ],
  },
  {
    label: "对话系统",
    accent: "violet",
    items: [
      { id: "talks", label: "对话", path: "talks/list" },
      { id: "talk-portrait", label: "头像", path: "talks/portrait" },
    ],
  },
];

/** 游戏模块面板 - 左侧分组导航 + 右侧子模块列表面板 */
export function GameModulesPanel({ basePath }: { basePath: string }) {
  const location = useLocation();

  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentModule = pathParts[2]; // dashboard/gameId/module

  // 渲染当前子模块的面板内容
  const renderSubPanel = () => {
    switch (currentModule) {
      case "npcs":
        return <NpcListPanel basePath={`${basePath}/npcs`} />;
      case "magic":
        return <MagicListPanel basePath={`${basePath}/magic`} />;
      case "goods":
        return <GoodsListPanel basePath={`${basePath}/goods`} />;
      case "objs":
        return <ObjListPanel basePath={`${basePath}/objs`} />;
      case "shops":
        return <ShopListPanel basePath={`${basePath}/shops`} />;
      case "levels":
        return <LevelListPanel basePath={`${basePath}/levels`} />;
      case "talks":
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-row">
      {/* 左侧：分组导航 */}
      <div className="w-44 shrink-0 flex flex-col bg-[#252526] border-r border-panel-border">
        <div className="flex h-9 items-center px-4 text-xs font-medium uppercase tracking-wide text-[#bbbbbb] border-b border-panel-border">
          游戏模块
        </div>
        <div className="flex-1 overflow-y-auto">
          <SectionedModuleNav sections={gameModuleSections} basePath={basePath} />
        </div>
      </div>

      {/* 右侧：子模块列表面板 */}
      <div className="flex-1 min-w-0">
        {renderSubPanel()}
      </div>
    </div>
  );
}
