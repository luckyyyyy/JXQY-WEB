/**
 * Debug Panel - 调试面板 UI 组件
 * Based on JxqyHD Helper/cheat.txt
 *
 * VSCode 风格简洁设计
 */

import React from "react";
import {
  CharacterSection,
  ItemMagicSection,
  MapSection,
  QuickActionsSection,
  ResourceSection,
  ScriptExecuteSection,
  ScriptHistorySection,
  ScriptSection,
  VariablesSection,
  XiuLianSection,
} from "./sections";
import type { DebugPanelProps } from "./types";

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isGodMode,
  playerStats,
  playerPosition,
  loadedResources,
  resourceStats,
  gameVariables,
  xiuLianMagic,
  triggeredTrapIds,
  currentScriptInfo,
  scriptHistory,
  onClose,
  onFullAll,
  onSetLevel,
  onAddMoney,
  onToggleGodMode,
  onKillAllEnemies,
  onExecuteScript,
  onAddItem,
  onAddMagic,
  onAddAllMagics,
  onXiuLianLevelUp,
  onXiuLianLevelDown,
}) => {
  // 检查脚本是否正在执行
  const isScriptRunning = !!(currentScriptInfo && !currentScriptInfo.isCompleted);

  return (
    <div className="w-full h-full flex flex-col bg-[#0d0d1a] text-gray-300 text-xs font-sans">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/50">
        <h2 className="text-sm font-medium text-gray-200">调试面板</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 rounded"
          >
            ✕
          </button>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b transparent" }}
      >
        {/* 角色状态 */}
        {playerStats && (
          <CharacterSection playerStats={playerStats} playerPosition={playerPosition} />
        )}

        {/* 地图信息 */}
        {loadedResources && (
          <MapSection loadedResources={loadedResources} triggeredTrapIds={triggeredTrapIds} />
        )}

        {/* 资源加载统计 */}
        {resourceStats && <ResourceSection resourceStats={resourceStats} />}

        {/* 快捷操作 */}
        <QuickActionsSection
          isGodMode={isGodMode}
          onFullAll={onFullAll}
          onToggleGodMode={onToggleGodMode}
          onKillAllEnemies={onKillAllEnemies}
          onSetLevel={onSetLevel}
          onAddMoney={onAddMoney}
        />

        {/* 物品/武功 */}
        <ItemMagicSection
          onAddItem={onAddItem}
          onAddMagic={onAddMagic}
          onAddAllMagics={onAddAllMagics}
        />

        {/* 修炼武功 */}
        {xiuLianMagic?.magic && (
          <XiuLianSection
            xiuLianMagic={xiuLianMagic}
            onXiuLianLevelUp={onXiuLianLevelUp}
            onXiuLianLevelDown={onXiuLianLevelDown}
          />
        )}

        {/* 当前脚本 */}
        <ScriptSection
          currentScriptInfo={currentScriptInfo ?? null}
          isScriptRunning={isScriptRunning}
          onExecuteScript={onExecuteScript}
        />

        {/* 脚本执行历史 */}
        {scriptHistory && scriptHistory.length > 0 && (
          <ScriptHistorySection
            scriptHistory={scriptHistory}
            isScriptRunning={isScriptRunning}
            onExecuteScript={onExecuteScript}
          />
        )}

        {/* 执行脚本 */}
        {onExecuteScript && (
          <ScriptExecuteSection
            isScriptRunning={isScriptRunning}
            onExecuteScript={onExecuteScript}
          />
        )}

        {/* 游戏变量 */}
        <VariablesSection gameVariables={gameVariables} />
      </div>
    </div>
  );
};
