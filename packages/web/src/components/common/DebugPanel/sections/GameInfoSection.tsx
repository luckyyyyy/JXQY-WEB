/**
 * 游戏信息区块 - 合并地图信息和游戏变量（可编辑）
 */

import type { GameVariables } from "@miu2d/engine/core/types";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { DataRow } from "../DataRow";
import { Section } from "../Section";
import { inputClass } from "../constants";
import type { LoadedResources } from "../types";

interface GameInfoSectionProps {
  loadedResources?: LoadedResources;
  triggeredTrapIds?: number[];
  gameVariables?: GameVariables;
  onSetGameVariable?: (name: string, value: number) => void;
}

/** 单个可编辑变量行 */
const VariableRow: React.FC<{
  name: string;
  value: number;
  onSet?: (name: string, value: number) => void;
}> = ({ name, value, onSet }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    if (!onSet) return;
    setEditValue(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [value, onSet]);

  const commitEdit = useCallback(() => {
    const parsed = Number(editValue);
    if (!Number.isNaN(parsed) && onSet) {
      onSet(name, parsed);
    }
    setEditing(false);
  }, [editValue, name, onSet]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        setEditing(false);
      }
      e.stopPropagation();
    },
    [commitEdit],
  );

  return (
    <div className="flex justify-between items-center px-2 py-0.5 hover:bg-[#2a2d2e] border-b border-[#2d2d2d] last:border-b-0 group">
      <span className="text-[#969696] truncate mr-2">{name}</span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className={`${inputClass} w-20 text-right py-0`}
          autoFocus
        />
      ) : (
        <span
          className={`text-[#4ade80] ${onSet ? "cursor-pointer hover:text-[#86efac] hover:underline" : ""}`}
          onClick={startEdit}
          onKeyDown={() => {}}
        >
          {value}
        </span>
      )}
    </div>
  );
};

export const GameInfoSection: React.FC<GameInfoSectionProps> = ({
  loadedResources,
  triggeredTrapIds,
  gameVariables,
  onSetGameVariable,
}) => {
  const variableCount = Object.keys(gameVariables || {}).length;

  return (
    <Section
      title="游戏信息"
      defaultOpen={false}
      badge={variableCount > 0 ? variableCount : undefined}
    >
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
              valueColor="text-[#fb923c]"
            />
          )}
        </div>
      )}

      {/* 游戏变量 */}
      <div className="text-[10px] text-[#969696] mb-1">
        游戏变量 {variableCount > 0 && `(${variableCount})`}
        {onSetGameVariable && (
          <span className="ml-1 text-[#7a7a7a]">· 点击值可编辑</span>
        )}
      </div>
      <div
        className="max-h-40 overflow-y-auto bg-[#1e1e1e] border border-[#333] font-mono text-[10px]"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}
      >
        {gameVariables && variableCount > 0 ? (
          Object.entries(gameVariables)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => (
              <VariableRow key={k} name={k} value={v} onSet={onSetGameVariable} />
            ))
        ) : (
          <div className="text-center text-[#7a7a7a] py-2">暂无变量</div>
        )}
      </div>
    </Section>
  );
};
