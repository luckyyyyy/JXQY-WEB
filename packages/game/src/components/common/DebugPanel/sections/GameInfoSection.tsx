/**
 * 游戏信息区块 - 合并地图信息和游戏变量（可编辑）
 */

import type { GameVariables } from "@miu2d/engine/core/types";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { GlassModal } from "../../../GlassModal";
import { inputClass } from "../constants";
import { DataRow } from "../DataRow";
import { Section } from "../Section";
import type { LoadedResources } from "../types";

interface GameInfoSectionProps {
  loadedResources?: LoadedResources;
  trapState?: { snapshot: Record<number, string>; group: Record<number, string> };
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
    [commitEdit]
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

/** JSON 编辑弹窗 */
const JsonEditorModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  gameVariables: GameVariables;
  onSetGameVariable?: (name: string, value: number) => void;
}> = ({ visible, onClose, gameVariables, onSetGameVariable }) => {
  const initialJson = useMemo(
    () => JSON.stringify(gameVariables, null, 2),
    [gameVariables]
  );
  const [jsonText, setJsonText] = useState(initialJson);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 打开时重置内容
  useMemo(() => {
    if (visible) {
      setJsonText(JSON.stringify(gameVariables, null, 2));
      setError(null);
    }
  }, [visible, gameVariables]);

  const handleSave = useCallback(() => {
    if (!onSetGameVariable) return;
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setError("必须是 JSON 对象，例如: {\"key\": 123}");
        return;
      }
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v !== "number") {
          setError(`变量 "${k}" 的值必须是数字，收到: ${typeof v}`);
          return;
        }
      }
      // 批量设置
      for (const [k, v] of Object.entries(parsed)) {
        onSetGameVariable(k, v as number);
      }
      onClose();
    } catch (e) {
      setError(`JSON 解析错误: ${(e as Error).message}`);
    }
  }, [jsonText, onSetGameVariable, onClose]);

  return (
    <GlassModal
      visible={visible}
      onClose={onClose}
      title="编辑游戏变量"
      widthClass="w-[560px]"
      maxHeight="70vh"
    >
      <div className="p-4 flex flex-col gap-3">
        <textarea
          ref={textareaRef}
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          className="w-full h-64 bg-[#1e1e1e] text-[#d4d4d4] border border-[#3c3c3c] rounded-md p-3
            font-mono text-xs resize-y outline-none focus:border-[#007fd4]"
          placeholder={'{\n  "变量名": 值\n}'}
        />
        {error && <div className="text-[#f48771] text-xs">{error}</div>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10
              rounded border border-white/10 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs text-white bg-[#007fd4] hover:bg-[#1a8fe4]
              rounded transition-colors"
          >
            应用
          </button>
        </div>
      </div>
    </GlassModal>
  );
};

/** 陷阱条目列表：以 KV 形式展示 trapIndex → script
 *  - script === "" 时高亮为已屏蔽/已触发态
 *  - script 非空时正常展示脚本名 */
const TrapEntryList: React.FC<{
  title: string;
  hint: string;
  entries: [string, string][];
  emptyHint: string;
}> = ({ title, hint, entries, emptyHint }) => {
  return (
    <div className="mb-1">
      <div className="text-[10px] text-[#7a7a7a] flex items-baseline gap-1 mb-0.5">
        <span className="text-[#d4d4d4]">{title}</span>
        <span>·</span>
        <span>{hint}</span>
        <span className="ml-auto text-[#969696]">{entries.length}</span>
      </div>
      <div className="bg-[#1e1e1e] border border-[#333] font-mono text-[10px] px-1 py-0.5">
        {entries.length === 0 ? (
          <div className="text-[#7a7a7a]">{emptyHint}</div>
        ) : (
          entries.map(([idx, script]) => (
            <div key={idx} className="flex gap-2">
              <span className="text-[#9cdcfe] w-8 text-right">{idx}</span>
              <span className="text-[#7a7a7a]">→</span>
              {script === "" ? (
                <span className="text-[#fb923c]">""（屏蔽/已触发）</span>
              ) : (
                <span className="text-[#ce9178] break-all">{script}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const GameInfoSection: React.FC<GameInfoSectionProps> = ({
  loadedResources,
  trapState,
  gameVariables,
  onSetGameVariable,
}) => {
  const variableCount = Object.keys(gameVariables || {}).length;
  const [showJsonEditor, setShowJsonEditor] = useState(false);

  const snapshotEntries = useMemo(
    () =>
      trapState
        ? Object.entries(trapState.snapshot).sort(([a], [b]) => Number(a) - Number(b))
        : [],
    [trapState]
  );
  const groupEntries = useMemo(
    () =>
      trapState ? Object.entries(trapState.group).sort(([a], [b]) => Number(a) - Number(b)) : [],
    [trapState]
  );

  return (
    <>
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
          </div>
        )}

        {/* 陷阱状态：snapshot（当前地图运行时） / group（跨地图持久化） */}
        {trapState && (snapshotEntries.length > 0 || groupEntries.length > 0) && (
          <div className="mb-2">
            <div className="text-[10px] text-[#969696] mb-1">陷阱状态</div>
            <TrapEntryList
              title="snapshot"
              hint="当前地图运行时·SaveMapTrap 后写入 group"
              entries={snapshotEntries}
              emptyHint="（空）"
            />
            <TrapEntryList
              title="group"
              hint="跨地图持久化缓存·进入地图时合并到 snapshot"
              entries={groupEntries}
              emptyHint="（空）"
            />
          </div>
        )}

        {/* 游戏变量 */}
        <div className="text-[10px] text-[#969696] mb-1 flex items-center gap-1">
          <span>
            游戏变量 {variableCount > 0 && `(${variableCount})`}
          </span>
          {onSetGameVariable && (
            <>
              <span className="text-[#7a7a7a]">· 点击值可编辑</span>
              <button
                onClick={() => setShowJsonEditor(true)}
                className="ml-auto px-1.5 py-0.5 text-[9px] text-[#969696] hover:text-white
                  bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
              >
                JSON
              </button>
            </>
          )}
        </div>
        <div
          className="max-h-40 overflow-y-auto bg-[#1e1e1e] border border-[#333] font-mono text-[10px]"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}
        >
          {gameVariables && variableCount > 0 ? (
            Object.entries(gameVariables)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => <VariableRow key={k} name={k} value={v} onSet={onSetGameVariable} />)
          ) : (
            <div className="text-center text-[#7a7a7a] py-2">暂无变量</div>
          )}
        </div>
      </Section>

      {gameVariables && onSetGameVariable && (
        <JsonEditorModal
          visible={showJsonEditor}
          onClose={() => setShowJsonEditor(false)}
          gameVariables={gameVariables}
          onSetGameVariable={onSetGameVariable}
        />
      )}
    </>
  );
};
