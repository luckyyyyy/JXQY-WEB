/**
 * 游戏信息区块 - 合并地图信息和游戏变量（可编辑）
 */

import type { GameVariables } from "@miu2d/engine/core/types";
import type { NpcDetailInfo, ObjDetailInfo } from "@miu2d/engine/debug/debug-manager";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DraggableWindow } from "../../../DraggableWindow";
import { GlassModal } from "../../../GlassModal";
import { ScriptCodeView } from "../ScriptCodeView";
import { inputClass } from "../constants";
import { DataRow } from "../DataRow";
import { Section } from "../Section";
import type { LoadedResources } from "../types";

interface GameInfoSectionProps {
  loadedResources?: LoadedResources;
  trapState?: { snapshot: Record<number, string>; group: Record<number, string> };
  gameVariables?: GameVariables;
  onSetGameVariable?: (name: string, value: number) => void;
  onGetNpcDetails?: () => NpcDetailInfo[];
  onGetObjDetails?: () => ObjDetailInfo[];
  onTalkToNpc?: (npcId: string) => Promise<void>;
  onKillNpc?: (npcId: string) => void;
  onOpenEntityDetail?: () => void;
}

const KIND_LABELS = ["普通", "战斗", "主角", "跟随", "走兽", "事件", "惧人兽", "飞行"];
const RELATION_LABELS = ["友方", "敌对", "中立", "无"];
const STATE_LABELS: Record<number, string> = {
  0: "站立", 1: "站立1", 2: "行走", 3: "跑步", 4: "跳跃",
  5: "攻击", 6: "攻击1", 7: "攻击2", 8: "施法", 9: "受伤",
  10: "打坐", 11: "死亡", 12: "特殊", 13: "打坐中",
  20: "战斗站立", 21: "战斗行走", 22: "战斗跑步", 23: "战斗跳跃",
  24: "特殊攻击", 255: "隐身",
};
const OBJ_KIND_LABELS = ["动态", "静态", "尸体", "循环音效", "随机音效", "门", "陷阱", "掉落"];

// NPC 表格列定义（grid-template-columns）
const NPC_COLS = "1fr 36px 32px 44px 32px 110px 36px 36px 80px 120px 56px 96px";
// 物体表格列定义
const OBJ_COLS = "140px 52px 72px 44px 1fr 56px";

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

/** 辅助：带颜色的百分比条 */
const StatBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex-1 h-2.5 bg-white/10 rounded-sm overflow-hidden ml-2">
      <div className={`h-full rounded-sm ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const ROW_H = 34;
const DETAIL_H = 160;
const OVERSCAN = 8;

/** 筛选 chip */
const Chip: React.FC<{ active: boolean; onClick: () => void; color?: string; children: React.ReactNode }> = ({
  active, onClick, color = "#4ade80", children,
}) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-all"
    style={{
      backgroundColor: active ? `${color}25` : "rgba(255,255,255,0.05)",
      color: active ? color : "rgba(255,255,255,0.4)",
      outline: active ? `1px solid ${color}60` : "1px solid rgba(255,255,255,0.1)",
      outlineOffset: -1,
    }}
  >
    <span
      className="w-3 h-3 rounded-sm border flex items-center justify-center shrink-0"
      style={{
        borderColor: active ? color : "rgba(255,255,255,0.25)",
        backgroundColor: active ? color : "transparent",
      }}
    >
      {active && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
    {children}
  </button>
);

/** 脚本悬浮提示 */
export const ScriptTooltip: React.FC<{
  scriptName: string;
  lines: string[] | undefined;
  rect: DOMRect;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = ({ scriptName, lines, rect, onMouseEnter, onMouseLeave }) => {
  // 定位：在目标元素下方
  const top = rect.bottom + 4;
  const left = Math.min(rect.left, window.innerWidth - 420);
  const flipUp = top + 300 > window.innerHeight;

  return createPortal(
    <div
      className="fixed z-[9999]"
      style={{
        top: flipUp ? undefined : top,
        bottom: flipUp ? window.innerHeight - rect.top + 4 : undefined,
        left,
        width: 400,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="bg-[#1e1e1e] border border-[#444] rounded-md shadow-2xl overflow-hidden"
        style={{ maxHeight: 320 }}
      >
        <div className="px-3 py-1.5 bg-[#252526] border-b border-[#444] text-[11px] text-[#ce9178] font-mono truncate">
          {scriptName}
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 280, scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}>
          {lines === undefined ? (
            <div className="text-[#7a7a7a] text-[10px] px-3 py-2">加载中...</div>
          ) : lines.length === 0 ? (
            <div className="text-[#7a7a7a] text-[10px] px-3 py-2">无法加载脚本</div>
          ) : (
            <ScriptCodeView codes={lines} transparent />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/** NPC 表头 */
const NpcTableHeader: React.FC<{ scrollbarWidth?: number }> = ({ scrollbarWidth = 0 }) => (
  <div className="grid items-center gap-x-2 px-4 py-1 text-[10px] text-white/60 border-b border-white/10 bg-white/5 select-none"
    style={{ gridTemplateColumns: NPC_COLS, paddingRight: 16 + scrollbarWidth }}
  >
    <span>名字</span>
    <span>类型</span>
    <span>阵营</span>
    <span>状态</span>
    <span className="text-right">Lv</span>
    <span>生命</span>
    <span className="text-right">攻</span>
    <span className="text-right">防</span>
    <span className="truncate">武功</span>
    <span className="truncate">脚本</span>
    <span className="text-right">位置</span>
    <span>操作</span>
  </div>
);

/** 物体表头 */
const ObjTableHeader: React.FC<{ scrollbarWidth?: number }> = ({ scrollbarWidth = 0 }) => (
  <div className="grid items-center gap-x-2 px-4 py-1 text-[10px] text-white/60 border-b border-white/10 bg-white/5 select-none"
    style={{ gridTemplateColumns: OBJ_COLS, paddingRight: 16 + scrollbarWidth }}
  >
    <span>名字</span>
    <span>类型</span>
    <span>位置</span>
    <span className="text-right">伤害</span>
    <span className="truncate">脚本</span>
    <span>操作</span>
  </div>
);

/** NPC 表格行 */
const NpcRow: React.FC<{
  npc: NpcDetailInfo;
  isExpanded: boolean;
  onClick: () => void;
  onTalkToNpc?: (npcId: string) => Promise<void>;
  onKillNpc?: (npcId: string) => void;
  onRefresh?: () => void;
  scriptRunning?: boolean;
}> = ({ npc, isExpanded, onClick, onTalkToNpc, onKillNpc, onRefresh, scriptRunning }) => {
  const lifePct = npc.lifeMax > 0 ? Math.min(100, (npc.life / npc.lifeMax) * 100) : 0;
  const magicName = npc.flyIni || npc.flyIni2 || npc.flyInis || "";
  const hasDialog = !!npc.scriptFile;
  const isDead = npc.isDeath || npc.isDeathInvoked;

  const handleTalk = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasDialog && onTalkToNpc) {
      await onTalkToNpc(npc.id);
      onRefresh?.();
    }
  }, [hasDialog, onTalkToNpc, npc.id, onRefresh]);

  const handleKill = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDead && onKillNpc) {
      onKillNpc(npc.id);
      onRefresh?.();
    }
  }, [isDead, onKillNpc, npc.id, onRefresh]);

  return (
    <div>
      <div
        className="grid items-center gap-x-2 px-4 cursor-pointer bg-white/5 hover:bg-white/10 border-b border-white/10"
        style={{ gridTemplateColumns: NPC_COLS, height: ROW_H }}
        onClick={onClick}
      >
        <span className={`truncate font-mono text-[10px] ${npc.isDeath ? "text-[#f48771] line-through" : "text-[#9cdcfe]"}`} title={npc.name}>
          {npc.name || "(无名)"}
        </span>
        <span className="text-[10px] text-white/50 truncate">{KIND_LABELS[npc.kind] ?? `?${npc.kind}`}</span>
        <span className={`text-[10px] ${npc.relation === 1 ? "text-[#f48771]" : npc.relation === 0 ? "text-[#4ade80]" : "text-white/50"}`}>
          {RELATION_LABELS[npc.relation]?.slice(0, 2) ?? "?"}
        </span>
        <span className="text-[10px] text-white/50 truncate">{STATE_LABELS[npc.state] ?? `S${npc.state}`}</span>
        <span className="text-[10px] text-[#dcdcaa] text-right">{npc.level}</span>
        {/* 生命 + 血条 */}
        <span className="flex flex-col justify-center gap-0.5 overflow-hidden">
          <span className="text-[10px] font-mono leading-none">
            <span className={npc.life < npc.lifeMax ? "text-[#f48771]" : "text-[#4ade80]"}>{npc.life}</span>
            <span className="text-white/30">/</span>
            <span className="text-white/50">{npc.lifeMax}</span>
          </span>
          <span className="w-full h-1 bg-white/10 rounded-sm overflow-hidden">
            <span className="block h-full rounded-sm bg-[#4ade80]" style={{ width: `${lifePct}%` }} />
          </span>
        </span>
        <span className="text-[10px] text-[#f48771] text-right">{npc.attack}</span>
        <span className="text-[10px] text-[#4fc1ff] text-right">{npc.defend}</span>
        <span className="text-[10px] text-[#e0a0f0] truncate font-mono" title={magicName}>{magicName || "-"}</span>
        {/* 对话脚本 */}
        <span
          className="text-[10px] text-[#ce9178] truncate font-mono cursor-help"
          data-script={npc.scriptFile || undefined}
        >
          {npc.scriptFile || <span className="text-white/20">-</span>}
        </span>
        {/* 位置 */}
        <span className="text-[10px] text-white/50 text-right font-mono">
          {npc.isDeath && <span className="text-[#f48771] mr-0.5">💀</span>}
          ({npc.mapX},{npc.mapY})
        </span>
        {/* 操作 */}
        <span className="flex items-center gap-1">
          <button
            onClick={handleTalk}
            disabled={!hasDialog || scriptRunning}
            className={`px-1.5 py-0.5 text-[9px] rounded border transition-colors ${
              !hasDialog || scriptRunning
                ? "border-white/10 text-white/20 cursor-not-allowed"
                : "border-[#4fc1ff]/40 text-[#4fc1ff] hover:bg-[#4fc1ff]/20 cursor-pointer"
            }`}
          >
            {scriptRunning ? "执行中…" : "对话"}
          </button>
          <button
            onClick={handleKill}
            disabled={isDead || scriptRunning}
            className={`px-1.5 py-0.5 text-[9px] rounded border transition-colors ${
              isDead || scriptRunning
                ? "border-white/10 text-white/20 cursor-not-allowed"
                : "border-[#f48771]/40 text-[#f48771] hover:bg-[#f48771]/20 cursor-pointer"
            }`}
          >
            {scriptRunning ? "执行中…" : "杀死"}
          </button>
        </span>
      </div>
      {isExpanded && (
        <div className="bg-white/10 border-b border-white/10 px-4 py-1.5 text-[10px]"
          style={{ height: DETAIL_H, overflow: "auto" }}
        >
          <div className="grid grid-cols-3 gap-2 mb-1">
            <div className="flex items-center">
              <span className="text-white/50 w-7">生命</span>
              <span className="text-[#4ade80] font-mono w-16 text-right">{npc.life}/{npc.lifeMax}</span>
              <StatBar value={npc.life} max={npc.lifeMax} color="bg-[#4ade80]" />
            </div>
            <div className="flex items-center">
              <span className="text-white/50 w-7">内力</span>
              <span className="text-[#4fc1ff] font-mono w-16 text-right">{npc.mana}/{npc.manaMax}</span>
              <StatBar value={npc.mana} max={npc.manaMax} color="bg-[#4fc1ff]" />
            </div>
            <div className="flex items-center">
              <span className="text-white/50 w-7">体力</span>
              <span className="text-[#dcdcaa] font-mono w-16 text-right">{npc.thew}/{npc.thewMax}</span>
              <StatBar value={npc.thew} max={npc.thewMax} color="bg-[#dcdcaa]" />
            </div>
          </div>
          <div className="grid grid-cols-6 gap-x-2 gap-y-0.5">
            <span><span className="text-white/50">经验 </span><span className="text-white/80">{npc.exp}/{npc.levelUpExp}</span></span>
            <span><span className="text-white/50">闪避 </span><span className="text-white/80">{npc.evade}</span></span>
            <span><span className="text-white/50">速度 </span><span className="text-white/80">{npc.walkSpeed}</span></span>
            <span><span className="text-white/50">AI </span><span className="text-white/80">{npc.aiType}</span></span>
            <span><span className="text-white/50">视野 </span><span className="text-white/80">{npc.visionRadius}</span></span>
            <span><span className="text-white/50">攻距 </span><span className="text-white/80">{npc.attackRadius}</span></span>
            <span><span className="text-white/50">话距 </span><span className="text-white/80">{npc.dialogRadius}</span></span>
            <span><span className="text-white/50">阵营 </span><span className="text-white/80">{npc.group}</span></span>
            {npc.invincible > 0 && <span className="text-[#4fc1ff]">无敌({npc.invincible})</span>}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className={npc.isHide ? "text-[#f48771]" : "text-[#4ade80]"}>{npc.isHide ? "隐藏" : "显示"}</span>
            <span className={npc.isVisible ? "text-[#4ade80]" : "text-[#f48771]"}>{npc.isVisible ? "可见" : "隐身"}</span>
            <span className={npc.isDeath ? "text-[#f48771]" : "text-[#4ade80]"}>{npc.isDeath ? "已死亡" : "存活"}</span>
            {npc.isInFighting && <span className="text-[#f48771]">战斗中</span>}
            {npc.isSitted && <span className="text-[#dcdcaa]">打坐</span>}
            {npc.isPoisoned && <span className="text-[#c586c0]">中毒</span>}
            {npc.isFrozen && <span className="text-[#4fc1ff]">冰冻</span>}
            {npc.isPetrified && <span className="text-white/40">石化</span>}
            {npc.isImmobilized && <span className="text-[#dcdcaa]">定身</span>}
          </div>
          <div className="mt-1 space-y-px">
            {npc.npcIni && <div><span className="text-white/50">配置 </span><span className="text-[#ce9178] font-mono">{npc.npcIni}</span></div>}
            {npc.scriptFile && <div><span className="text-white/50">脚本 </span><span className="text-[#ce9178] font-mono">{npc.scriptFile}</span></div>}
            {npc.scriptFileRight && <div><span className="text-white/50">右键 </span><span className="text-[#ce9178] font-mono">{npc.scriptFileRight}</span></div>}
            {npc.deathScript && <div><span className="text-white/50">死亡 </span><span className="text-[#ce9178] font-mono">{npc.deathScript}</span></div>}
            {npc.dropIni && <div><span className="text-white/50">掉落 </span><span className="text-[#ce9178] font-mono">{npc.dropIni}</span></div>}
            {npc.followNpcName && <div><span className="text-white/50">跟随 </span><span className="text-[#dcdcaa] font-mono">{npc.followNpcName}</span></div>}
            {npc.flyIni && <div><span className="text-white/50">武功1 </span><span className="text-[#e0a0f0] font-mono">{npc.flyIni}</span></div>}
            {npc.flyIni2 && <div><span className="text-white/50">武功2 </span><span className="text-[#e0a0f0] font-mono">{npc.flyIni2}</span></div>}
            {npc.flyInis && <div><span className="text-white/50">多武功 </span><span className="text-[#e0a0f0] font-mono">{npc.flyInis}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
};

/** 物体表格行 */
const ObjRow: React.FC<{
  obj: ObjDetailInfo;
  isExpanded: boolean;
  onClick: () => void;
  onInteractWithObj?: (objId: string) => Promise<void>;
  onRefresh?: () => void;
  scriptRunning?: boolean;
}> = ({ obj, isExpanded, onClick, onInteractWithObj, onRefresh, scriptRunning }) => {
  const canInteract = !!obj.scriptFile && !obj.isRemoved && !scriptRunning;
  const handleInteract = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canInteract || !onInteractWithObj) return;
    await onInteractWithObj(obj.id);
    onRefresh?.();
  };
  return (
  <div>
    <div
      className="grid items-center gap-x-2 px-4 cursor-pointer bg-white/5 hover:bg-white/10 border-b border-white/10"
      style={{ gridTemplateColumns: OBJ_COLS, height: ROW_H }}
      onClick={onClick}
    >
      <span className={`truncate font-mono text-[10px] ${obj.isRemoved ? "text-[#f48771] line-through" : "text-[#9cdcfe]"}`} title={obj.objName}>
        {obj.objName || "(无名)"}
      </span>
      <span className="text-[10px] text-[#dcdcaa] truncate">{OBJ_KIND_LABELS[obj.kind] ?? `?${obj.kind}`}</span>
      <span className="text-[10px] text-white/50 font-mono">({obj.mapX},{obj.mapY})</span>
      <span className="text-[10px] text-right">
        {obj.damage > 0 ? <span className="text-[#f48771]">{obj.damage}</span> : <span className="text-white/20">-</span>}
      </span>
      <span className="text-[10px] text-white/50 truncate font-mono">
        <span
          className={obj.scriptFile ? "text-[#ce9178] cursor-help" : ""}
          data-script={obj.scriptFile || undefined}
        >
          {obj.scriptFile || obj.fileName || ""}
        </span>
        {obj.isTrap && <span className="text-[#fb923c] ml-1">陷阱</span>}
        {obj.isDrop && <span className="text-[#4ade80] ml-1">掉落</span>}
        {obj.isBody && <span className="text-white/30 ml-1">尸体</span>}
        {!obj.isShow && <span className="text-white/30 ml-1">隐</span>}
        {obj.isRemoved && <span className="text-[#f48771] ml-1">已删</span>}
      </span>
      <span className="flex items-center">
        <button
          onClick={handleInteract}
          disabled={!canInteract}
          className={`px-1.5 py-0.5 text-[9px] rounded border transition-colors ${
            canInteract
              ? "border-[#4ade80]/40 text-[#4ade80] hover:bg-[#4ade80]/20 cursor-pointer"
              : "border-white/10 text-white/20 cursor-not-allowed"
          }`}
        >
          {scriptRunning ? "执行中…" : "交互"}
        </button>
      </span>
    </div>
    {isExpanded && (
      <div className="bg-white/10 border-b border-white/10 px-4 py-1.5 text-[10px]"
        style={{ height: DETAIL_H, overflow: "auto" }}
      >
        <div className="grid grid-cols-4 gap-x-2 gap-y-0.5">
          <span><span className="text-white/50">类型 </span><span className="text-[#dcdcaa]">{OBJ_KIND_LABELS[obj.kind]}</span></span>
          <span><span className="text-white/50">伤害 </span><span className="text-[#f48771]">{obj.damage}</span></span>
          <span><span className="text-white/50">帧 </span><span className="text-white/80">{obj.frame}</span></span>
          <span><span className="text-white/50">高度 </span><span className="text-white/80">{obj.height}</span></span>
          <span><span className="text-white/50">亮度 </span><span className="text-white/80">{obj.lum}</span></span>
          <span><span className="text-white/50">偏移 </span><span className="text-white/80">{obj.offX},{obj.offY}</span></span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span className={obj.isShow ? "text-[#4ade80]" : "text-[#f48771]"}>{obj.isShow ? "可见" : "隐藏"}</span>
          <span className={obj.isRemoved ? "text-[#f48771]" : "text-[#4ade80]"}>{obj.isRemoved ? "已删除" : "正常"}</span>
          {obj.isObstacle && <span className="text-[#4fc1ff]">障碍</span>}
          {obj.isTrap && <span className="text-[#fb923c]">陷阱</span>}
          {obj.isBody && <span className="text-white/30">尸体</span>}
          {obj.isDrop && <span className="text-[#4ade80]">掉落</span>}
          {obj.isInteractive && <span className="text-[#dcdcaa]">可交互</span>}
        </div>
        {obj.timerScriptFile && (
          <div className="mt-0.5"><span className="text-white/50">定时器 </span><span className="text-[#ce9178] font-mono">{obj.timerScriptFile}</span><span className="text-white/40"> ({obj.timerScriptInterval}ms)</span></div>
        )}
        {obj.wavFile && <div><span className="text-white/50">音效 </span><span className="text-[#ce9178] font-mono">{obj.wavFile}</span></div>}
        <div className="mt-1 space-y-px">
          <div><span className="text-white/50">ID </span><span className="text-white/80 font-mono">{obj.id}</span></div>
          {obj.fileName && <div><span className="text-white/50">配置 </span><span className="text-[#ce9178] font-mono">{obj.fileName}</span></div>}
          {obj.scriptFile && <div><span className="text-white/50">左键 </span><span className="text-[#ce9178] font-mono">{obj.scriptFile}</span></div>}
          {obj.scriptFileRight && <div><span className="text-white/50">右键 </span><span className="text-[#ce9178] font-mono">{obj.scriptFileRight}</span></div>}
        </div>
      </div>
    )}
  </div>
  );
};

/** 场景条目类型 */
interface SceneEntry {
  name: string;
  kind: number;
  data: Record<string, unknown>;
}

/** NPC / 物体详情弹窗 */
export const EntityDetailModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onGetNpcDetails?: () => NpcDetailInfo[];
  onGetObjDetails?: () => ObjDetailInfo[];
  onTalkToNpc?: (npcId: string) => Promise<void>;
  onKillNpc?: (npcId: string) => void;
  onInteractWithObj?: (objId: string) => Promise<void>;
  onGetSceneNpcEntries?: () => Promise<SceneEntry[]>;
  onGetSceneObjEntries?: () => Promise<SceneEntry[]>;
  onAddNpcFromEntry?: (data: Record<string, unknown>) => Promise<void>;
  onAddObjFromEntry?: (data: Record<string, unknown>) => Promise<void>;
  onGetBaseTrapEntries?: () => Record<number, string>;
  onDebugTriggerTrap?: (trapIndex: number) => boolean;
  onLoadTrapScript?: (scriptName: string) => Promise<string[]>;
  onIsScriptRunning?: () => boolean;
}> = ({ visible, onClose, onGetNpcDetails, onGetObjDetails, onTalkToNpc, onKillNpc, onInteractWithObj, onGetSceneNpcEntries, onGetSceneObjEntries, onAddNpcFromEntry, onAddObjFromEntry, onGetBaseTrapEntries, onDebugTriggerTrap, onLoadTrapScript, onIsScriptRunning }) => {
  // 刷新数据
  const refresh = useCallback(() => {
    if (onGetNpcDetails) setNpcs(onGetNpcDetails());
    if (onGetObjDetails) setObjs(onGetObjDetails());
    if (onGetBaseTrapEntries) setBaseTraps(onGetBaseTrapEntries());
  }, [onGetNpcDetails, onGetObjDetails, onGetBaseTrapEntries]);
  const [tab, setTab] = useState<"npc" | "obj" | "trap">("npc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [npcRelationFilter, setNpcRelationFilter] = useState<Set<number>>(new Set([0, 1, 2]));
  const [npcAliveFilter, setNpcAliveFilter] = useState<"all" | "alive" | "dead">("all");
  const [objKindFilter, setObjKindFilter] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6, 7]));
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // 添加面板状态
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [sceneEntries, setSceneEntries] = useState<SceneEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [batchIndex, setBatchIndex] = useState<number | null>(null);
  const [batchCount, setBatchCount] = useState("1");
  const addPanelRef = useRef<HTMLDivElement>(null);
  const addSearchRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  // 数据
  const [npcs, setNpcs] = useState<NpcDetailInfo[]>([]);
  const [objs, setObjs] = useState<ObjDetailInfo[]>([]);
  const [baseTraps, setBaseTraps] = useState<Record<number, string>>({});
  const [trapScripts, setTrapScripts] = useState<Record<string, string[]>>({});
  const [scriptRunning, setScriptRunning] = useState(false);

  // 轮询刷新 — 仅在数据真正变化时才 setState，避免虚拟滚动行重渲染
  const prevNpcsRef = useRef<NpcDetailInfo[]>([]);
  const prevObjsRef = useRef<ObjDetailInfo[]>([]);
  const prevTrapsRef = useRef<string>("");
  const arraysEqual = (a: { id: string }[], b: { id: string }[]) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
      // 浅比较每个对象的引用（DebugManager 返回的是新对象但内容相同，用 JSON 比较关键字段）
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
    }
    return true;
  };
  useEffect(() => {
    if (!visible) return;
    const refresh = () => {
      if (onGetNpcDetails) {
        const next = onGetNpcDetails();
        if (!arraysEqual(next, prevNpcsRef.current)) {
          prevNpcsRef.current = next;
          setNpcs(next);
        }
      }
      if (onGetObjDetails) {
        const next = onGetObjDetails();
        if (!arraysEqual(next, prevObjsRef.current)) {
          prevObjsRef.current = next;
          setObjs(next);
        }
      }
      if (onGetBaseTrapEntries) {
        const next = onGetBaseTrapEntries();
        const key = Object.keys(next).sort().join(",");
        if (key !== prevTrapsRef.current) {
          prevTrapsRef.current = key;
          setBaseTraps(next);
        }
      }
      if (onIsScriptRunning) setScriptRunning(onIsScriptRunning());
    };
    refresh();
    const timer = setInterval(refresh, 500);
    return () => clearInterval(timer);
  }, [visible, onGetNpcDetails, onGetObjDetails, onGetBaseTrapEntries, onIsScriptRunning]);

  // 测量滚动条宽度（表头对齐用）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, visible]);

  // 加载陷阱脚本内容
  useEffect(() => {
    if (tab !== "trap" || !onLoadTrapScript) return;
    const scriptNames = [...new Set(Object.values(baseTraps))];
    const missing = scriptNames.filter((s) => s && !trapScripts[s]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const results: Record<string, string[]> = {};
      for (const name of missing) {
        const lines = await onLoadTrapScript(name);
        if (cancelled) return;
        results[name] = lines;
      }
      if (!cancelled) setTrapScripts((prev) => ({ ...prev, ...results }));
    })();
    return () => { cancelled = true; };
  }, [tab, baseTraps, onLoadTrapScript, trapScripts]);

  // 切 tab 时重置展开和滚动
  const switchTab = useCallback((t: "npc" | "obj" | "trap") => {
    setTab(t);
    setExpanded(null);
    setSearch("");
    setScrollTop(0);
    setShowAddPanel(false);
    scrollRef.current?.scrollTo(0, 0);
  }, []);

  // 加载场景条目
  const loadSceneEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const loader = tab === "npc" ? onGetSceneNpcEntries : onGetSceneObjEntries;
      if (loader) {
        const entries = await loader();
        setSceneEntries(entries);
      }
    } finally {
      setEntriesLoading(false);
    }
  }, [tab, onGetSceneNpcEntries, onGetSceneObjEntries]);

  // 打开/关闭添加面板
  const toggleAddPanel = useCallback(() => {
    if (showAddPanel) {
      setShowAddPanel(false);
    } else {
      setShowAddPanel(true);
      setAddSearch("");
      loadSceneEntries();
      setTimeout(() => addSearchRef.current?.focus(), 50);
    }
  }, [showAddPanel, loadSceneEntries]);

  // 条目搜索过滤
  const filteredSceneEntries = useMemo(() => {
    if (!addSearch) return sceneEntries;
    const q = addSearch.toLowerCase();
    return sceneEntries.filter((e) => e.name.toLowerCase().includes(q));
  }, [sceneEntries, addSearch]);

  // 添加条目
  const handleAddEntry = useCallback(async (data: Record<string, unknown>, e?: React.MouseEvent) => {
    const adder = tab === "npc" ? onAddNpcFromEntry : onAddObjFromEntry;
    if (!adder) return;

    if (e?.ctrlKey || e?.metaKey) {
      // 进入批量模式：找到对应 index，聚焦输入框
      const idx = filteredSceneEntries.findIndex((en) => en.data === data);
      setBatchIndex(idx);
      setBatchCount("1");
      setTimeout(() => batchInputRef.current?.focus(), 50);
      return;
    }

    await adder(data);
    refresh();
  }, [tab, onAddNpcFromEntry, onAddObjFromEntry, refresh, filteredSceneEntries]);

  // 确认批量添加
  const handleBatchConfirm = useCallback(async () => {
    if (batchIndex === null) return;
    const adder = tab === "npc" ? onAddNpcFromEntry : onAddObjFromEntry;
    if (!adder) return;
    const entry = filteredSceneEntries[batchIndex];
    if (!entry) return;

    const count = Math.max(1, Math.min(5000, parseInt(batchCount, 10) || 1));
    for (let i = 0; i < count; i++) {
      await adder(entry.data);
      // 每 100 个让出主线程，避免 UI 卡顿
      if (i % 100 === 99) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    refresh();
    setBatchIndex(null);
  }, [batchIndex, batchCount, tab, onAddNpcFromEntry, onAddObjFromEntry, refresh, filteredSceneEntries]);

  // 点击外部关闭添加面板
  useEffect(() => {
    if (!showAddPanel) return;
    const handler = (e: MouseEvent) => {
      if (addPanelRef.current && !addPanelRef.current.contains(e.target as Node)) {
        setShowAddPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddPanel]);

  // NPC 过滤
  const filteredNpcs = useMemo(() => {
    let list = npcs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.name.toLowerCase().includes(q));
    }
    list = list.filter((n) => npcRelationFilter.has(n.relation));
    if (npcAliveFilter === "alive") list = list.filter((n) => !n.isDeath);
    else if (npcAliveFilter === "dead") list = list.filter((n) => n.isDeath);
    return list;
  }, [npcs, search, npcRelationFilter, npcAliveFilter]);

  // 物体过滤
  const filteredObjs = useMemo(() => {
    let list = objs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.objName.toLowerCase().includes(q));
    }
    list = list.filter((o) => objKindFilter.has(o.kind));
    return list;
  }, [objs, search, objKindFilter]);

  // 陷阱数据（排序后的 entries）
  const trapEntries = useMemo(() =>
    Object.entries(baseTraps)
      .map(([k, v]) => [Number(k), v] as [number, string])
      .sort(([a], [b]) => a - b),
    [baseTraps]
  );

  const items = tab === "npc" ? filteredNpcs : tab === "obj" ? filteredObjs : [];
  const totalItems = items.length;

  // 计算展开行对高度的影响
  const expandedIndex = expanded ? items.findIndex((it) => it.id === expanded) : -1;

  // 虚拟滚动：计算每行的累计偏移
  const { visibleItems, totalHeight } = useMemo(() => {
    const containerH = 500;
    const offsets: number[] = [];
    let h = 0;
    for (let i = 0; i < totalItems; i++) {
      offsets.push(h);
      h += ROW_H + (i === expandedIndex ? DETAIL_H : 0);
    }
    const totalH = h;

    let start = 0;
    for (let i = 0; i < totalItems; i++) {
      if (offsets[i] + ROW_H + (i === expandedIndex ? DETAIL_H : 0) > scrollTop) {
        start = Math.max(0, i - OVERSCAN);
        break;
      }
    }
    let end = totalItems;
    for (let i = start; i < totalItems; i++) {
      if (offsets[i] > scrollTop + containerH + OVERSCAN * ROW_H) {
        end = i;
        break;
      }
    }

    const visible: Array<{ index: number; top: number }> = [];
    for (let i = start; i < end; i++) {
      visible.push({ index: i, top: offsets[i] });
    }

    return { visibleItems: visible, totalHeight: totalH };
  }, [totalItems, expandedIndex, scrollTop]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const toggleRelation = useCallback((r: number) => {
    setNpcRelationFilter((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  }, []);

  const toggleObjKind = useCallback((k: number) => {
    setObjKindFilter((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  return (
    <DraggableWindow
      visible={visible}
      onClose={onClose}
      title="实体详情"
      storageKey="entity_detail"
      defaultWidth={860}
      defaultHeight={560}
      closeOnEsc={false}
    >
      {/* Tabs */}
      <div className="flex border-b border-white/10 px-4 bg-white/5">
        <button
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            tab === "npc"
              ? "text-[#4ade80] border-b-2 border-[#4ade80]"
              : "text-white/50 hover:text-white"
          }`}
          onClick={() => switchTab("npc")}
        >
          NPC ({npcs.length})
        </button>
        <button
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            tab === "obj"
              ? "text-[#4ade80] border-b-2 border-[#4ade80]"
              : "text-white/50 hover:text-white"
          }`}
          onClick={() => switchTab("obj")}
        >
          物体 ({objs.length})
        </button>
        <button
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            tab === "trap"
              ? "text-[#fb923c] border-b-2 border-[#fb923c]"
              : "text-white/50 hover:text-white"
          }`}
          onClick={() => switchTab("trap")}
        >
          陷阱 ({trapEntries.length})
        </button>
      </div>

      {/* 搜索 + 筛选（陷阱 tab 不需要） */}
      {tab !== "trap" && (
        <div className="px-4 py-2 border-b border-white/10 space-y-1.5 bg-white/5">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setExpanded(null); }}
            placeholder={tab === "npc" ? "搜索 NPC 名字..." : "搜索物体名字..."}
            className="w-full px-2 py-1 text-[11px] bg-white/10 text-white/90 border border-white/20
              rounded outline-none focus:border-[#007fd4] placeholder:text-white/30"
          />
          <div className="flex flex-wrap gap-1 items-center">
            {tab === "npc" ? (
              <>
                <Chip active={npcRelationFilter.has(0)} onClick={() => toggleRelation(0)} color="#4ade80">友方</Chip>
                <Chip active={npcRelationFilter.has(1)} onClick={() => toggleRelation(1)} color="#f48771">敌对</Chip>
                <Chip active={npcRelationFilter.has(2)} onClick={() => toggleRelation(2)} color="#969696">中立</Chip>
                <span className="text-white/20 mx-1">|</span>
                <Chip active={npcAliveFilter === "all"} onClick={() => setNpcAliveFilter("all")} color="#d4d4d4">全部</Chip>
                <Chip active={npcAliveFilter === "alive"} onClick={() => setNpcAliveFilter("alive")} color="#4ade80">存活</Chip>
                <Chip active={npcAliveFilter === "dead"} onClick={() => setNpcAliveFilter("dead")} color="#f48771">死亡</Chip>
              </>
            ) : (
              <>
                <Chip active={objKindFilter.has(0)} onClick={() => toggleObjKind(0)}>动态</Chip>
                <Chip active={objKindFilter.has(1)} onClick={() => toggleObjKind(1)}>静态</Chip>
                <Chip active={objKindFilter.has(2)} onClick={() => toggleObjKind(2)} color="#808080">尸体</Chip>
                <Chip active={objKindFilter.has(3)} onClick={() => toggleObjKind(3)} color="#c586c0">循环音效</Chip>
                <Chip active={objKindFilter.has(4)} onClick={() => toggleObjKind(4)} color="#c586c0">随机音效</Chip>
                <Chip active={objKindFilter.has(5)} onClick={() => toggleObjKind(5)} color="#dcdcaa">门</Chip>
                <Chip active={objKindFilter.has(6)} onClick={() => toggleObjKind(6)} color="#fb923c">陷阱</Chip>
                <Chip active={objKindFilter.has(7)} onClick={() => toggleObjKind(7)} color="#4ade80">掉落</Chip>
              </>
            )}
            <span className="text-white/30 ml-auto text-[10px]">
              {items.length === totalItems ? `共 ${totalItems}` : `${items.length}/${totalItems}`}
            </span>
            <div className="relative ml-1" ref={addPanelRef}>
              <button
                onClick={toggleAddPanel}
                className="px-1.5 py-0.5 text-[10px] rounded border border-[#4ade80]/40 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors"
              >
                ＋添加
              </button>
              {showAddPanel && (
                <div className="absolute right-0 top-full mt-1 z-50 w-72 max-h-[320px] bg-[#252526] border border-[#444] rounded-md shadow-2xl overflow-hidden flex flex-col">
                  <div className="px-2 py-1.5 border-b border-[#444] bg-[#1e1e1e]">
                    <input
                      ref={addSearchRef}
                      type="text"
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      placeholder="搜索..."
                      className="w-full px-2 py-0.5 text-[10px] bg-white/10 text-white/90 border border-white/20
                        rounded outline-none focus:border-[#007fd4] placeholder:text-white/30"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}>
                    {entriesLoading ? (
                      <div className="px-3 py-4 text-center text-white/30 text-[10px]">加载中...</div>
                    ) : filteredSceneEntries.length === 0 ? (
                      <div className="px-3 py-4 text-center text-white/30 text-[10px]">{sceneEntries.length === 0 ? "无可用条目" : "无匹配结果"}</div>
                    ) : (
                      filteredSceneEntries.map((entry, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 border-b border-white/5 text-[10px]"
                        >
                          <span className="text-[#9cdcfe] truncate flex-1" title={entry.name}>
                            {entry.name || "(无名)"}
                          </span>
                          <span className="text-[#dcdcaa] shrink-0">
                            {tab === "npc"
                              ? (KIND_LABELS[entry.kind] ?? `?${entry.kind}`)
                              : (OBJ_KIND_LABELS[entry.kind] ?? `?${entry.kind}`)}
                          </span>
                          {batchIndex === i ? (
                            <span className="flex items-center gap-1 shrink-0">
                              <input
                                ref={batchInputRef}
                                type="number"
                                min={1}
                                max={5000}
                                value={batchCount}
                                onChange={(e) => setBatchCount(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleBatchConfirm(); if (e.key === "Escape") setBatchIndex(null); }}
                                className="w-12 px-1 py-0.5 text-[10px] bg-white/10 text-white border border-white/20 rounded outline-none focus:border-[#007fd4] text-center"
                              />
                              <button
                                onClick={handleBatchConfirm}
                                className="px-1 py-0.5 text-[9px] rounded border border-[#4ade80]/40 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setBatchIndex(null)}
                                className="px-1 py-0.5 text-[9px] rounded border border-white/20 text-white/50 hover:bg-white/10 transition-colors"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleAddEntry(entry.data, e)}
                              className="px-1.5 py-0.5 text-[9px] rounded border border-[#4ade80]/40 text-[#4ade80] hover:bg-[#4ade80]/20 shrink-0 transition-colors"
                              title="Ctrl+点击可输入数量"
                            >
                              添加
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 表头 */}
      {tab === "npc" ? <NpcTableHeader scrollbarWidth={scrollbarWidth} /> : tab === "obj" ? <ObjTableHeader scrollbarWidth={scrollbarWidth} /> : null}

      {/* 表格体：陷阱 tab 用卡片网格，NPC/Obj 用虚拟滚动 */}
      {tab === "trap" ? (
        <div
          className="overflow-y-auto p-3"
          style={{ flex: 1, minHeight: 0, scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}
        >
          <div className="text-[10px] text-[#858585] mb-2 leading-relaxed">
            此功能用于快速过图调试脚本，错误触发可能导致剧情混乱或其他异常问题，非 debug 请勿使用。
            如需快速过剧情，可打开小地图按 Ctrl 瞬移。
          </div>
          {trapEntries.length === 0 ? (
            <div className="text-center text-white/30 py-8 text-xs">无陷阱数据</div>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {trapEntries.map(([idx, script]) => {
                const lines = trapScripts[script];
                return (
                  <div key={idx} className="bg-[#1e1e1e] border border-[#333] rounded-md overflow-hidden flex flex-col">
                    {/* 卡片头部 */}
                    <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#333]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#9cdcfe] font-mono text-[11px] font-medium shrink-0">#{idx}</span>
                        <span className="text-[#7a7a7a] shrink-0">→</span>
                        <span className="text-[#ce9178] font-mono text-[11px] truncate">{script}</span>
                      </div>
                      {onDebugTriggerTrap && (
                        <button
                          disabled={scriptRunning}
                          onClick={() => { onDebugTriggerTrap(idx); }}
                          className={`px-2.5 py-1 text-[11px] border rounded shrink-0 ml-2 transition-colors ${
                            scriptRunning
                              ? "text-[#7a7a7a] border-[#444] cursor-not-allowed"
                              : "text-[#fb923c] border-[#fb923c]/40 hover:bg-[#fb923c]/20"
                          }`}
                        >
                          {scriptRunning ? "执行中…" : "触发"}
                        </button>
                      )}
                    </div>
                    {/* 脚本内容 */}
                    <div className="flex-1 max-h-52 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}>
                      {lines === undefined ? (
                        <div className="text-[#7a7a7a] text-[10px] px-3 py-2">加载中...</div>
                      ) : lines.length === 0 ? (
                        <div className="text-[#7a7a7a] text-[10px] px-3 py-2">无法加载脚本内容</div>
                      ) : (
                        <ScriptCodeView codes={lines} transparent />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ flex: 1, minHeight: 0, scrollbarWidth: "thin", scrollbarColor: "#424242 transparent" }}
          onScroll={handleScroll}
        >
          {items.length === 0 ? (
            <div className="text-center text-white/30 py-8 text-xs">
              {tab === "npc" ? "无 NPC" : "无物体"}
            </div>
        ) : (
          <div style={{ height: totalHeight, position: "relative" }}>
            {visibleItems.map(({ index, top }) => {
              const item = items[index];
              const isExpanded = expanded === item.id;
              return (
                <div key={item.id} style={{ position: "absolute", top, left: 0, right: 0 }}>
                  {tab === "npc" ? (
                    <NpcRow
                      npc={item as NpcDetailInfo}
                      isExpanded={isExpanded}
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      onTalkToNpc={onTalkToNpc}
                      onKillNpc={onKillNpc}
                      onRefresh={refresh}
                      scriptRunning={scriptRunning}
                    />
                  ) : (
                    <ObjRow
                      obj={item as ObjDetailInfo}
                      isExpanded={isExpanded}
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      onInteractWithObj={onInteractWithObj}
                      onRefresh={refresh}
                      scriptRunning={scriptRunning}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      )}
    </DraggableWindow>
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
  onGetNpcDetails,
  onGetObjDetails,
  onTalkToNpc,
  onKillNpc,
  onOpenEntityDetail,
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
            {(onGetNpcDetails || onGetObjDetails) ? (
              <>
                <div
                  className="flex justify-between text-[11px] py-px cursor-pointer hover:bg-[#2a2d2e] px-1 -mx-1 rounded"
                  onClick={() => onOpenEntityDetail?.()}
                  onKeyDown={() => {}}
                >
                  <span className="text-[#969696]">NPC数</span>
                  <span className="font-mono text-[#4ade80] underline decoration-dotted underline-offset-2">{loadedResources.npcCount}</span>
                </div>
                <div
                  className="flex justify-between text-[11px] py-px cursor-pointer hover:bg-[#2a2d2e] px-1 -mx-1 rounded"
                  onClick={() => onOpenEntityDetail?.()}
                  onKeyDown={() => {}}
                >
                  <span className="text-[#969696]">物体数</span>
                  <span className="font-mono text-[#4ade80] underline decoration-dotted underline-offset-2">{loadedResources.objCount}</span>
                </div>
              </>
            ) : (
              <>
                <DataRow label="NPC数" value={loadedResources.npcCount} />
                <DataRow label="物体数" value={loadedResources.objCount} />
              </>
            )}
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
