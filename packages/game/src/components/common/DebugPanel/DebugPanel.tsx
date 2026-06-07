/**
 * Debug Panel - 调试面板 UI 组件
 * Based on JxqyHD Helper/cheat.txt
 *
 * VSCode 风格简洁设计
 */

import type React from "react";
import {
  CharacterSection,
  GameDebugSection,
  GameInfoSection,
  PartnerSection,
  PerformanceSection,
  ResourceSection,
  ScriptExecuteSection,
  ScriptInfoSection,
  XiuLianSection,
} from "./sections";
import type { DebugPanelProps } from "./types";

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isGodMode,
  playerStats,
  playerPosition,
  loadedResources,
  resourceStats,
  performanceStats,
  memoryStats,
  gameVariables,
  xiuLianMagic,
  partnersData,
  trapState,
  currentScriptInfo,
  scriptHistory,
  onClose,
  onSetGameVariable,
  onFullAll,
  onSetLevel,
  currentDifficulty,
  onSetDifficulty,
  onAddMoney,
  onToggleGodMode,
  onKillAllEnemies,
  onExecuteScript,
  onExecuteLuaScript,
  onAddItem,
  onAddMagic,
  onAddAllMagics,
  onXiuLianLevelUp,
  onXiuLianLevelDown,
  onPartnerLevelUp,
  onPartnerLevelDown,
  onReduceLife,
  onReloadMagicConfig,
  onReloadUILayout,
  onRevealFullMap,
  onGetNpcDetails,
  onGetObjDetails,
  onTalkToNpc,
  onKillNpc,
  onOpenEntityDetail,
}) => {
  // 检查脚本是否正在执行
  const isScriptRunning = !!(currentScriptInfo && !currentScriptInfo.isCompleted);

  return (
    <div className="w-full h-full flex flex-col text-[#d4d4d4] text-xs font-sans bg-[#1e1e1e]">
      <div
        className="flex-1 overflow-y-auto px-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#444 transparent" }}
      >
        {/* 性能统计 */}
        {performanceStats && (
          <PerformanceSection performanceStats={performanceStats} memoryStats={memoryStats} />
        )}

        {/* 角色状态 */}
        {playerStats && (
          <CharacterSection playerStats={playerStats} playerPosition={playerPosition} />
        )}

        {/* 游戏信息（地图信息 + 游戏变量） */}
        <GameInfoSection
          loadedResources={loadedResources}
          trapState={trapState}
          gameVariables={gameVariables}
          onSetGameVariable={onSetGameVariable}
          onGetNpcDetails={onGetNpcDetails}
          onGetObjDetails={onGetObjDetails}
          onTalkToNpc={onTalkToNpc}
          onKillNpc={onKillNpc}
          onOpenEntityDetail={onOpenEntityDetail}
        />

        {/* 资源加载统计 */}
        {resourceStats && <ResourceSection resourceStats={resourceStats} />}

        {/* 游戏调试（快捷操作 + 物品/武功） */}
        <GameDebugSection
          isGodMode={isGodMode}
          onFullAll={onFullAll}
          onToggleGodMode={onToggleGodMode}
          onKillAllEnemies={onKillAllEnemies}
          onSetLevel={onSetLevel}
          currentDifficulty={currentDifficulty}
          onSetDifficulty={onSetDifficulty}
          onAddMoney={onAddMoney}
          onReduceLife={onReduceLife}
          onAddItem={onAddItem}
          onAddMagic={onAddMagic}
          onAddAllMagics={onAddAllMagics}
          onReloadMagicConfig={onReloadMagicConfig}
          onReloadUILayout={onReloadUILayout}
          onRevealFullMap={onRevealFullMap}
        />

        {/* 修炼武功 */}
        {xiuLianMagic?.magic && (
          <XiuLianSection
            xiuLianMagic={xiuLianMagic}
            onXiuLianLevelUp={onXiuLianLevelUp}
            onXiuLianLevelDown={onXiuLianLevelDown}
          />
        )}

        {/* 配角 */}
        {partnersData && partnersData.length > 0 && (
          <PartnerSection
            partners={partnersData}
            onPartnerLevelUp={onPartnerLevelUp}
            onPartnerLevelDown={onPartnerLevelDown}
          />
        )}

        {/* 脚本（当前脚本 + 脚本历史） */}
        <ScriptInfoSection
          currentScriptInfo={currentScriptInfo ?? null}
          scriptHistory={scriptHistory}
          isScriptRunning={isScriptRunning}
          onExecuteScript={onExecuteScript}
        />

        {/* 执行脚本 */}
        {onExecuteScript && (
          <ScriptExecuteSection
            isScriptRunning={isScriptRunning}
            onExecuteScript={onExecuteScript}
            onExecuteLuaScript={onExecuteLuaScript}
          />
        )}
      </div>
    </div>
  );
};
