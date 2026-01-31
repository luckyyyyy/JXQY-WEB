/**
 * 游戏信息区块 - 合并地图信息和游戏变量
 */

import type React from "react";
import type { GameVariables } from "@/engine/core/types";
import { DataRow } from "../DataRow";
import { Section } from "../Section";
import type { LoadedResources } from "../types";

interface GameInfoSectionProps {
  loadedResources?: LoadedResources;
  triggeredTrapIds?: number[];
  gameVariables?: GameVariables;
}

export const GameInfoSection: React.FC<GameInfoSectionProps> = ({
  loadedResources,
  triggeredTrapIds,
  gameVariables,
}) => {
  const variableCount = Object.keys(gameVariables || {}).length;

  return (
    <Section title="游戏信息" defaultOpen={false} badge={variableCount > 0 ? variableCount : undefined}>
      {/* 地图信息 */}
      {loadedResources && (
        <div className="space-y-px mb-2">
          <DataRow label="地图" value={loadedResources.mapName || "N/A"} />
          <DataRow label="NPC数" value={loadedResources.npcCount} />
          <DataRow label="物体数" value={loadedResources.objCount} />
          {triggeredTrapIds && triggeredTrapIds.length > 0 && (
            <DataRow
              label="已触发陷阱"
              value={triggeredTrapIds.join(", ")}
              valueColor="text-orange-400"
            />
          )}
        </div>
      )}

      {/* 游戏变量 */}
      <div className="text-[10px] text-zinc-500 mb-1">
        游戏变量 {variableCount > 0 && `(${variableCount})`}
      </div>
      <div
        className="max-h-40 overflow-y-auto bg-zinc-900 border border-zinc-700 font-mono text-[10px]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#52525b transparent" }}
      >
        {gameVariables && variableCount > 0 ? (
          Object.entries(gameVariables)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between px-2 py-0.5 hover:bg-zinc-800 border-b border-zinc-800 last:border-b-0"
              >
                <span className="text-zinc-500 truncate mr-2">{k}</span>
                <span className="text-green-400">{v}</span>
              </div>
            ))
        ) : (
          <div className="text-center text-zinc-600 py-2">暂无变量</div>
        )}
      </div>
    </Section>
  );
};
