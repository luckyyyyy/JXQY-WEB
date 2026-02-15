/**
 * NPC / OBJ 字段编辑器组件
 *
 * 包含字段行、数字输入、脚本选择器等通用子组件，
 * 以及 NpcEntryEditor 和 ObjEntryEditor 展开编辑器。
 */
import type { SceneData, SceneNpcEntry, SceneObjEntry } from "@miu2d/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NpcResourcePicker } from "../../components/common/pickers/NpcResourcePicker";
import { ObjResourcePicker } from "../../components/common/pickers/ObjResourcePicker";
import { FileSelectDialog } from "../../components/common/ResourceFilePicker/FileSelectDialog";
import { ResourceFilePicker } from "../../components/common/ResourceFilePicker/ResourceFilePicker";
import { ScriptPreviewTooltip } from "../../components/common/ResourceFilePicker/ScriptPreviewTooltip";
import {
  ACTION_LABELS,
  DIRECTION_LABELS,
  NPC_KIND_LABELS,
  OBJ_KIND_LABELS,
  RELATION_LABELS,
} from "./scene-constants";

// ============= 通用字段组件 =============

/** 分组标题 */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] text-[#666] uppercase tracking-wider pt-1 pb-0.5 border-b border-panel-border mb-1">
      {children}
    </div>
  );
}

/** 字段行容器 — 与 ResourceFilePicker 外观一致 */
export const fieldBoxCls =
  "bg-[#2d2d2d] border border-widget-border rounded h-9 flex items-center px-2 gap-2 transition-colors focus-within:border-[#0098ff]";
export const labelTagCls =
  "text-[10px] font-medium text-[#8a8a8a] bg-[#3c3c3c] px-1.5 py-0.5 rounded shrink-0";
export const inputCls = "flex-1 bg-transparent text-[#cccccc] text-xs outline-none min-w-0";
const numInputCls = "bg-transparent text-[#cccccc] text-xs outline-none w-14 flex-none text-center";
export const selectCls =
  "flex-1 bg-transparent text-[#cccccc] text-xs outline-none cursor-pointer min-w-0 [&>option]:bg-[#2d2d2d] [&>option]:text-[#cccccc]";

/** 数字输入组件 — 文本模式，失焦时校验为数字 */
export function NumInput({
  value,
  onChange,
  title,
  className,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  title?: string;
  className?: string;
}) {
  const safeValue = value ?? 0;
  const [text, setText] = useState(String(safeValue));
  const prevValue = useRef(safeValue);
  useEffect(() => {
    if (safeValue !== prevValue.current) {
      setText(String(safeValue));
      prevValue.current = safeValue;
    }
  }, [safeValue]);
  const handleBlur = useCallback(() => {
    const n = Number(text);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      const rounded = Math.round(n);
      onChange(rounded);
      setText(String(rounded));
      prevValue.current = rounded;
    } else {
      setText(String(safeValue));
    }
  }, [text, safeValue, onChange]);
  return (
    <input
      className={className ?? numInputCls}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      title={title}
    />
  );
}

export function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={fieldBoxCls}>
      <span className={labelTagCls}>{label}</span>
      {children}
    </div>
  );
}

/** 脚本选择器 — 弹出两个 tab：当前地图脚本 / 公共脚本资源 */
export function ScriptFieldPicker({
  value,
  onChange,
  sceneData,
  gameId,
  gameSlug,
  label = "脚本",
}: {
  value: string;
  onChange: (v: string) => void;
  sceneData: SceneData;
  gameId: string;
  gameSlug: string;
  label?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"map" | "public">("map");
  const [mapSearch, setMapSearch] = useState("");
  const [hoverScript, setHoverScript] = useState<{
    name: string;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedMapScript, setSelectedMapScript] = useState<string | null>(null);

  const scriptNames = useMemo(
    () => Object.keys(sceneData.scripts ?? {}).sort(),
    [sceneData.scripts]
  );

  const filteredMapScripts = useMemo(() => {
    if (!mapSearch) return scriptNames;
    const lower = mapSearch.toLowerCase();
    return scriptNames.filter((s) => s.toLowerCase().includes(lower));
  }, [scriptNames, mapSearch]);

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name);
      setDialogOpen(false);
    },
    [onChange]
  );

  const openDialog = useCallback(() => {
    setActiveTab("map");
    setMapSearch("");
    setHoverScript(null);
    setSelectedMapScript(value || null);
    setDialogOpen(true);
  }, [value]);

  const tabBar = useMemo(
    () => (
      <div className="flex border-b border-widget-border shrink-0">
        <button
          type="button"
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "map"
              ? "text-[#cccccc] border-[#0098ff] bg-[#2d2d2d]"
              : "text-[#858585] hover:text-[#cccccc] border-transparent"
          }`}
          onClick={() => setActiveTab("map")}
        >
          当前地图
        </button>
        <button
          type="button"
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === "public"
              ? "text-[#cccccc] border-[#0098ff] bg-[#2d2d2d]"
              : "text-[#858585] hover:text-[#cccccc] border-transparent"
          }`}
          onClick={() => setActiveTab("public")}
        >
          公共脚本
        </button>
      </div>
    ),
    [activeTab]
  );

  const mapContent = useMemo(
    () => (
      <>
        {/* 搜索栏 */}
        <div className="px-4 py-2 border-b border-[#454545]">
          <input
            type="text"
            placeholder="搜索脚本..."
            value={mapSearch}
            onChange={(e) => setMapSearch(e.target.value)}
            className="w-full px-3 py-2 bg-[#3c3c3c] border border-[#454545] rounded text-white text-sm focus:outline-none focus:border-[#0e639c]"
            autoFocus
          />
        </div>
        {/* 文件列表 */}
        <div className="flex-1 min-h-[250px] overflow-auto p-2">
          {filteredMapScripts.length === 0 ? (
            <div className="text-center py-8 text-[#808080]">
              {mapSearch ? "没有匹配的脚本" : "当前地图无脚本条目"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredMapScripts.map((name) => (
                <div
                  key={name}
                  className={`flex items-center px-2 py-1 rounded cursor-pointer select-none ${
                    name === selectedMapScript
                      ? "bg-[#0e639c] text-white"
                      : "hover:bg-[#2a2d2e] text-[#cccccc]"
                  }`}
                  style={{ paddingLeft: 8 }}
                  onClick={() => setSelectedMapScript(name)}
                  onDoubleClick={() => handleSelect(name)}
                  onMouseEnter={(e) =>
                    setHoverScript({ name, position: { x: e.clientX, y: e.clientY } })
                  }
                  onMouseLeave={() => setHoverScript(null)}
                >
                  <span className="mr-2">📄</span>
                  <span className="flex-1 truncate text-sm">{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 底部栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#454545] bg-[#252526]">
          <div className="text-sm text-[#808080]">
            {selectedMapScript ? (
              <span className="truncate max-w-80 inline-block" title={selectedMapScript}>
                {selectedMapScript}
              </span>
            ) : (
              "未选择文件"
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 text-sm rounded hover:bg-[#3c3c3c] text-[#cccccc]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedMapScript) handleSelect(selectedMapScript);
              }}
              disabled={!selectedMapScript}
              className="px-4 py-2 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              选择
            </button>
          </div>
        </div>
        {/* 悬停预览 */}
        {hoverScript && sceneData.scripts?.[hoverScript.name] && (
          <div
            className="fixed z-[9999]"
            style={{ left: hoverScript.position.x + 16, top: hoverScript.position.y }}
          >
            <ScriptPreviewTooltip
              key={hoverScript.name}
              gameSlug=""
              path={hoverScript.name}
              initialContent={sceneData.scripts[hoverScript.name]}
            />
          </div>
        )}
      </>
    ),
    [filteredMapScripts, selectedMapScript, handleSelect, mapSearch, hoverScript, sceneData.scripts]
  );

  return (
    <>
      <div className={`${fieldBoxCls} cursor-pointer hover:border-[#0098ff]`} onClick={openDialog}>
        <span className={labelTagCls}>{label}</span>
        <span className="flex-1 text-xs text-[#cccccc] truncate min-w-0">
          {value || <span className="text-[#666]">未选择</span>}
        </span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="text-[#666] hover:text-[#ccc] shrink-0 text-sm leading-none"
            title="清除"
          >
            ×
          </button>
        )}
      </div>

      <FileSelectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleSelect}
        gameId={gameId}
        gameSlug={gameSlug}
        fieldName="scriptFile"
        currentValue={value}
        extensions={[".txt"]}
        title="选择脚本"
        headerExtra={tabBar}
        customContent={activeTab === "map" ? mapContent : undefined}
      />
    </>
  );
}

// ============= NPC 条目编辑器 =============

export function NpcEntryEditor({
  entry,
  onChange,
  gameId,
  gameSlug,
  sceneData,
}: {
  entry: SceneNpcEntry;
  onChange: (field: string, value: string | number) => void;
  gameId: string;
  gameSlug: string;
  sceneData: SceneData;
}) {
  return (
    <div className="space-y-1.5">
      {/* 基本信息 */}
      <SectionLabel>基本信息</SectionLabel>
      <FieldRow label="名称">
        <input
          className={inputCls}
          value={entry.name}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </FieldRow>
      <FieldRow label="类型">
        <select
          className={selectCls}
          value={entry.kind}
          onChange={(e) => onChange("kind", Number(e.target.value))}
        >
          {Object.entries(NPC_KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </FieldRow>
      <NpcResourcePicker
        label="外观"
        value={entry.npcIni}
        onChange={(v) => onChange("npcIni", v ?? "")}
        gameId={gameId}
        gameSlug={gameSlug}
        inlineLabel
      />

      {/* 位置 */}
      <SectionLabel>位置与方向</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>X</span>
        <NumInput value={entry.mapX} onChange={(v) => onChange("mapX", v)} />
        <span className={labelTagCls}>Y</span>
        <NumInput value={entry.mapY} onChange={(v) => onChange("mapY", v)} />
        <span className={labelTagCls}>朝向</span>
        <select
          className={`${selectCls} w-20 flex-none flex-0`}
          value={entry.dir}
          onChange={(e) => onChange("dir", Number(e.target.value))}
        >
          {Object.entries(DIRECTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {/* 行为 */}
      <SectionLabel>行为</SectionLabel>
      <FieldRow label="动作">
        <select
          className={selectCls}
          value={entry.action}
          onChange={(e) => onChange("action", Number(e.target.value))}
        >
          {Object.entries(ACTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </FieldRow>
      <ScriptFieldPicker
        value={entry.scriptFile}
        onChange={(v) => onChange("scriptFile", v)}
        sceneData={sceneData}
        gameId={gameId}
        gameSlug={gameSlug}
      />
      <ScriptFieldPicker
        value={entry.deathScript}
        onChange={(v) => onChange("deathScript", v)}
        sceneData={sceneData}
        gameId={gameId}
        gameSlug={gameSlug}
        label="死亡脚本"
      />
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>对话</span>
        <NumInput
          value={entry.dialogRadius}
          onChange={(v) => onChange("dialogRadius", v)}
          title="对话半径"
        />
        <span className={labelTagCls}>视野</span>
        <NumInput
          value={entry.visionRadius}
          onChange={(v) => onChange("visionRadius", v)}
          title="视野半径"
        />
      </div>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>移速</span>
        <NumInput
          value={entry.walkSpeed}
          onChange={(v) => onChange("walkSpeed", v)}
          title="移动速度"
        />
        <span className={labelTagCls}>亮度</span>
        <NumInput value={entry.lum} onChange={(v) => onChange("lum", v)} title="亮度" />
      </div>

      {/* 阵营 */}
      <SectionLabel>阵营</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>关系</span>
        <select
          className={selectCls}
          value={entry.relation}
          onChange={(e) => onChange("relation", Number(e.target.value))}
        >
          {Object.entries(RELATION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className={labelTagCls}>组</span>
        <NumInput value={entry.group} onChange={(v) => onChange("group", v)} />
      </div>

      {/* 战斗属性 */}
      <SectionLabel>战斗属性</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>攻击</span>
        <NumInput value={entry.attack} onChange={(v) => onChange("attack", v)} />
        <span className={labelTagCls}>防御</span>
        <NumInput value={entry.defend} onChange={(v) => onChange("defend", v)} />
        <span className={labelTagCls}>闪避</span>
        <NumInput value={entry.evade} onChange={(v) => onChange("evade", v)} />
      </div>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>攻等</span>
        <NumInput
          value={entry.attackLevel}
          onChange={(v) => onChange("attackLevel", v)}
          title="攻击等级"
        />
        <span className={labelTagCls}>攻距</span>
        <NumInput
          value={entry.attackRadius}
          onChange={(v) => onChange("attackRadius", v)}
          title="攻击半径"
        />
      </div>
      <FieldRow label="尸体">
        <input
          className={inputCls}
          value={entry.bodyIni}
          onChange={(e) => onChange("bodyIni", e.target.value)}
        />
      </FieldRow>
      <FieldRow label="武功">
        <input
          className={inputCls}
          value={entry.flyIni}
          onChange={(e) => onChange("flyIni", e.target.value)}
        />
      </FieldRow>
      <FieldRow label="武功2">
        <input
          className={inputCls}
          value={entry.flyIni2}
          onChange={(e) => onChange("flyIni2", e.target.value)}
        />
      </FieldRow>
      <div className={fieldBoxCls}>
        <span className={labelTagCls} title="攻击间隔（帧）">
          攻击间隔
        </span>
        <NumInput value={entry.idle} onChange={(v) => onChange("idle", v)} />
      </div>

      {/* 等级经验 */}
      <SectionLabel>等级经验</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>等级</span>
        <NumInput value={entry.level} onChange={(v) => onChange("level", v)} />
        <span className={labelTagCls}>经验</span>
        <NumInput value={entry.exp} onChange={(v) => onChange("exp", v)} />
      </div>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>升级</span>
        <NumInput
          value={entry.levelUpExp}
          onChange={(v) => onChange("levelUpExp", v)}
          title="升级所需经验"
        />
        <span className={labelTagCls} title=">0为Boss，名字显示黄色">
          经验加成
        </span>
        <NumInput
          value={entry.expBonus}
          onChange={(v) => onChange("expBonus", v)}
          title="ExpBonus: >0为Boss，名字显示黄色"
        />
      </div>

      {/* 生命/体力/魔法 */}
      <SectionLabel>生命/体力/魔法</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>生命</span>
        <NumInput value={entry.life} onChange={(v) => onChange("life", v)} />
        <span className={labelTagCls}>上限</span>
        <NumInput value={entry.lifeMax} onChange={(v) => onChange("lifeMax", v)} />
      </div>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>体力</span>
        <NumInput value={entry.thew} onChange={(v) => onChange("thew", v)} />
        <span className={labelTagCls}>上限</span>
        <NumInput value={entry.thewMax} onChange={(v) => onChange("thewMax", v)} />
      </div>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>魔法</span>
        <NumInput value={entry.mana} onChange={(v) => onChange("mana", v)} />
        <span className={labelTagCls}>上限</span>
        <NumInput value={entry.manaMax} onChange={(v) => onChange("manaMax", v)} />
      </div>

      {/* 巡逻路径 */}
      {entry.fixedPos ? (
        <>
          <SectionLabel>巡逻路径</SectionLabel>
          <FieldRow label="FixedPos">
            <input
              className={inputCls}
              value={entry.fixedPos}
              onChange={(e) => onChange("fixedPos", e.target.value)}
            />
          </FieldRow>
        </>
      ) : null}
    </div>
  );
}

// ============= OBJ 条目编辑器 =============

export function ObjEntryEditor({
  entry,
  onChange,
  gameId,
  gameSlug,
  sceneData,
}: {
  entry: SceneObjEntry;
  onChange: (field: string, value: string | number) => void;
  gameId: string;
  gameSlug: string;
  sceneData: SceneData;
}) {
  return (
    <div className="space-y-1.5">
      {/* 基本信息 */}
      <SectionLabel>基本信息</SectionLabel>
      <FieldRow label="名称">
        <input
          className={inputCls}
          value={entry.objName}
          onChange={(e) => onChange("objName", e.target.value)}
        />
      </FieldRow>
      <FieldRow label="类型">
        <select
          className={selectCls}
          value={entry.kind}
          onChange={(e) => onChange("kind", Number(e.target.value))}
        >
          {Object.entries(OBJ_KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </FieldRow>
      <ObjResourcePicker
        label="资源"
        value={entry.objFile}
        onChange={(v) => onChange("objFile", v ?? "")}
        gameId={gameId}
        gameSlug={gameSlug}
        inlineLabel
      />

      {/* 位置 */}
      <SectionLabel>位置与方向</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>X</span>
        <NumInput value={entry.mapX} onChange={(v) => onChange("mapX", v)} />
        <span className={labelTagCls}>Y</span>
        <NumInput value={entry.mapY} onChange={(v) => onChange("mapY", v)} />
        <span className={labelTagCls}>朝向</span>
        <select
          className={`${selectCls} w-20 flex-none flex-0`}
          value={entry.dir}
          onChange={(e) => onChange("dir", Number(e.target.value))}
        >
          {Object.entries(DIRECTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>偏移X</span>
        <NumInput value={entry.offX} onChange={(v) => onChange("offX", v)} />
        <span className={labelTagCls}>偏移Y</span>
        <NumInput value={entry.offY} onChange={(v) => onChange("offY", v)} />
      </div>

      {/* 资源 */}
      <SectionLabel>资源</SectionLabel>
      <ResourceFilePicker
        label="音效"
        value={entry.wavFile}
        onChange={(v) => onChange("wavFile", v ?? "")}
        fieldName="wavFile"
        gameId={gameId}
        gameSlug={gameSlug}
        extensions={[".wav", ".ogg", ".mp3"]}
        inlineLabel
      />
      <ScriptFieldPicker
        value={entry.scriptFile}
        onChange={(v) => onChange("scriptFile", v)}
        sceneData={sceneData}
        gameId={gameId}
        gameSlug={gameSlug}
      />

      {/* 属性 */}
      <SectionLabel>属性</SectionLabel>
      <div className={fieldBoxCls}>
        <span className={labelTagCls}>亮度</span>
        <NumInput value={entry.lum} onChange={(v) => onChange("lum", v)} />
        <span className={labelTagCls}>伤害</span>
        <NumInput value={entry.damage} onChange={(v) => onChange("damage", v)} />
        <span className={labelTagCls}>帧</span>
        <NumInput value={entry.frame} onChange={(v) => onChange("frame", v)} />
      </div>
    </div>
  );
}
