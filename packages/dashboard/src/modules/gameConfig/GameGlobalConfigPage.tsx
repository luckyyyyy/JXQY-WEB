/**
 * 游戏全局配置页面
 * 根据路由参数 :configTab 渲染对应的配置面板
 * 侧边栏导航由 SidebarContent 提供
 */

import { api, useToast } from "@miu2d/shared";
import type {
  BossLevelBonus,
  DrugDropTier,
  GameConfigDataFull,
  MagicExpConfig,
  MoneyDropTier,
  PlayerCombat,
  PlayerRestore,
  PlayerSpeed,
  PlayerThewCost,
  PortraitEntry,
} from "@miu2d/types";
import { createDefaultMagicExpConfig, exportPortraitIni, mergeGameConfig } from "@miu2d/types";
import { NumberInput } from "@miu2d/ui";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ResourceFilePicker, ScriptEditor } from "../../components/common";
import { MiniAsfPreview } from "../../components/common/ResourceFilePicker/AsfPreviewTooltip";
import { buildResourcePath } from "../../components/common/ResourceFilePicker/types";
import { useDashboard } from "../../DashboardContext";

// ========== 配置分类 ==========

type ConfigCategory =
  | "basic"
  | "newgame"
  | "player-speed"
  | "player-thew"
  | "player-restore"
  | "player-combat"
  | "magic-exp"
  | "drop-probability"
  | "drop-equip"
  | "drop-money"
  | "drop-drug"
  | "drop-boss";

// ========== 通用组件 ==========

/** 信息图标（圆形 i） */
function InfoIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.2A5.8 5.8 0 1013.8 8 5.81 5.81 0 008 2.2zM8 11a.75.75 0 01-.75-.75v-3.5a.75.75 0 011.5 0v3.5A.75.75 0 018 11zm0-6.25a.75.75 0 110 1.5.75.75 0 010-1.5z" />
    </svg>
  );
}

/** 问号图标 */
function HelpIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.2A5.8 5.8 0 1013.8 8 5.81 5.81 0 008 2.2zM8 11.5a.75.75 0 110 1.5.75.75 0 010-1.5zm.5-2.25a.5.5 0 01-1 0v-.38a1.5 1.5 0 01.88-1.36A1.25 1.25 0 107.25 6.5a.5.5 0 01-1 0 2.25 2.25 0 112.13 2.24.5.5 0 00-.38.48v.03z" />
    </svg>
  );
}

/** 带悬浮提示的问号 */
function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex ml-1.5 cursor-help">
      <HelpIcon size={14} className="text-[#555] group-hover:text-[#0098ff] transition-colors" />
      <span className="absolute bottom-full left-0 mb-2 px-3 py-2 text-xs text-[#cccccc] bg-[#1e1e1e] border border-widget-border rounded-lg shadow-xl whitespace-normal w-64 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 leading-relaxed">
        {text}
      </span>
    </span>
  );
}

/** 信息提示框 - 用于 section 级别的说明 */
function InfoAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3 mb-5 rounded-lg bg-[#0098ff]/5 border border-[#0098ff]/15">
      <InfoIcon size={16} className="text-[#0098ff] flex-shrink-0 mt-0.5" />
      <p className="text-xs text-[#999] leading-relaxed">{children}</p>
    </div>
  );
}

/** 警告提示框 */
function WarnAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
      <svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="currentColor"
        className="text-yellow-500 flex-shrink-0 mt-0.5"
      >
        <path d="M8.56 1.69a.63.63 0 00-1.12 0L1.05 13.5a.63.63 0 00.56.88h12.78a.63.63 0 00.56-.88L8.56 1.69zM8 5.5a.5.5 0 01.5.5v3a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm0 5.25a.75.75 0 110 1.5.75.75 0 010-1.5z" />
      </svg>
      <p className="text-xs text-[#999] leading-relaxed">{children}</p>
    </div>
  );
}

function SectionTitle({ desc }: { desc?: string }) {
  if (!desc) return null;
  return (
    <div className="mb-6">
      <InfoAlert>{desc}</InfoAlert>
    </div>
  );
}

function Field({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center text-sm text-[#cccccc] font-medium">
        {label}
        {desc && <HelpTip text={desc} />}
      </label>
      {children}
    </div>
  );
}

/** 表单卡片容器 */
function FormCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#252526] border border-panel-border rounded-xl p-5 ${className}`}>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 bg-[#3c3c3c] border border-widget-border rounded-lg text-white focus:outline-none focus:border-focus-border transition-colors";

// ========== 掉落子组件 ==========

function MoneyTiersEditor({
  tiers,
  onChange,
}: {
  tiers: MoneyDropTier[];
  onChange: (t: MoneyDropTier[]) => void;
}) {
  const update = (i: number, field: keyof MoneyDropTier, value: number | null) => {
    const t = [...tiers];
    t[i] = { ...t[i], [field]: value ?? 0 };
    onChange(t);
  };
  return (
    <FormCard>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#858585] text-xs uppercase tracking-wider">
            <th className="pb-3 pr-4 font-medium">等级</th>
            <th className="pb-3 pr-4 font-medium">最小金额</th>
            <th className="pb-3 pr-4 font-medium">最大金额</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, i) => (
            <tr
              key={tier.tier}
              className="border-t border-panel-border group hover:bg-[#2a2a2a] transition-colors"
            >
              <td className="py-3 pr-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0098ff]/10 text-[#0098ff] text-sm font-medium">
                  {tier.tier}
                </span>
              </td>
              <td className="py-3 pr-4">
                <NumberInput
                  value={tier.minAmount}
                  onChange={(v) => update(i, "minAmount", v)}
                  min={0}
                  className="w-32"
                />
              </td>
              <td className="py-3 pr-4">
                <NumberInput
                  value={tier.maxAmount}
                  onChange={(v) => update(i, "maxAmount", v)}
                  min={0}
                  className="w-32"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </FormCard>
  );
}

function DrugTiersEditor({
  tiers,
  onChange,
}: {
  tiers: DrugDropTier[];
  onChange: (t: DrugDropTier[]) => void;
}) {
  const update = (i: number, field: keyof DrugDropTier, value: string | number | null) => {
    const t = [...tiers];
    t[i] = { ...t[i], [field]: value ?? 0 };
    onChange(t);
  };
  const smallInput =
    "w-32 px-2.5 py-1.5 bg-[#3c3c3c] border border-widget-border rounded-lg text-white text-sm focus:outline-none focus:border-focus-border transition-colors";
  return (
    <FormCard>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#858585] text-xs uppercase tracking-wider">
            <th className="pb-3 pr-4 font-medium">名称</th>
            <th className="pb-3 pr-4 font-medium">NPC 最高等级</th>
            <th className="pb-3 pr-4 font-medium">关联商店 Key</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier, i) => (
            <tr
              key={i}
              className="border-t border-panel-border group hover:bg-[#2a2a2a] transition-colors"
            >
              <td className="py-3 pr-4">
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => update(i, "name", e.target.value)}
                  className={smallInput}
                />
              </td>
              <td className="py-3 pr-4">
                <NumberInput
                  value={tier.maxLevel}
                  onChange={(v) => update(i, "maxLevel", v)}
                  min={0}
                  className="w-32"
                />
              </td>
              <td className="py-3 pr-4">
                <input
                  type="text"
                  value={tier.shopKey}
                  onChange={(e) => update(i, "shopKey", e.target.value)}
                  className={`${smallInput} w-44`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 pt-3 border-t border-panel-border">
        <button
          type="button"
          onClick={() => onChange([...tiers, { name: "", maxLevel: 999, shopKey: "" }])}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded-lg transition-colors text-[#cccccc]"
        >
          + 添加等级
        </button>
      </div>
    </FormCard>
  );
}

function BossLevelBonusEditor({
  bonuses,
  onChange,
}: {
  bonuses: BossLevelBonus[];
  onChange: (b: BossLevelBonus[]) => void;
}) {
  const update = (i: number, field: keyof BossLevelBonus, value: number | null) => {
    const b = [...bonuses];
    b[i] = { ...b[i], [field]: value ?? 0 };
    onChange(b);
  };
  const total = bonuses.reduce((s, b) => s + b.chance, 0);
  return (
    <FormCard>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[#858585] text-xs uppercase tracking-wider">
            <th className="pb-3 pr-4 font-medium">概率 (%)</th>
            <th className="pb-3 pr-4 font-medium">额外等级加成</th>
            <th className="pb-3 pr-4 font-medium" />
          </tr>
        </thead>
        <tbody>
          {bonuses.map((b, i) => (
            <tr
              key={i}
              className="border-t border-panel-border group hover:bg-[#2a2a2a] transition-colors"
            >
              <td className="py-3 pr-4">
                <NumberInput
                  value={b.chance}
                  onChange={(v) => update(i, "chance", v)}
                  min={0}
                  max={100}
                  className="w-28"
                />
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-[#858585]">+</span>
                  <NumberInput
                    value={b.bonus}
                    onChange={(v) => update(i, "bonus", v)}
                    min={0}
                    className="w-28"
                  />
                </div>
              </td>
              <td className="py-3 pr-4">
                {bonuses.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(bonuses.filter((_, j) => j !== i))}
                    className="text-[#555] hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                  >
                    <svg
                      width={14}
                      height={14}
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 pt-3 border-t border-panel-border flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange([...bonuses, { chance: 0, bonus: 0 }])}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4a4a4a] rounded-lg transition-colors text-[#cccccc]"
        >
          + 添加档位
        </button>
        {total !== 100 && <WarnAlert>概率总和为 {total}%，建议设为 100%</WarnAlert>}
      </div>
    </FormCard>
  );
}

// ========== 各分类面板 ==========

function BasicInfoPanel({
  config,
  updateConfig,
  gameId,
  gameSlug,
}: {
  config: GameConfigDataFull;
  updateConfig: <K extends keyof GameConfigDataFull>(k: K, v: GameConfigDataFull[K]) => void;
  gameId: string;
  gameSlug: string;
}) {
  const toast = useToast();
  const [logoPreview, setLogoPreview] = useState<string>(config.logoUrl || "");
  const [isUploading, setIsUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // 同步外部 config 变化
  useEffect(() => {
    setLogoPreview(config.logoUrl || "");
  }, [config.logoUrl]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gameSlug) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo 文件不能超过 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const res = await fetch(`/game/${gameSlug}/api/logo`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }

      const data = await res.json();
      const logoUrl = `${data.logoUrl}?_t=${Date.now()}`;
      setLogoPreview(logoUrl);
      updateConfig("logoUrl", data.logoUrl);
      toast.success("Logo 上传成功");
    } catch (err) {
      toast.error(`Logo 上传失败: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleLogoDelete = async () => {
    if (!gameSlug) return;
    setIsUploading(true);
    try {
      const res = await fetch(`/game/${gameSlug}/api/logo`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      setLogoPreview("");
      updateConfig("logoUrl", "");
      toast.success("Logo 已删除");
    } catch (err) {
      toast.error("Logo 删除失败");
    } finally {
      setIsUploading(false);
    }
  };

  // 从 players 表获取主角候选列表
  const { data: players } = api.player.list.useQuery({ gameId }, { enabled: !!gameId });

  // 从 scenes 表获取地图候选列表
  const { data: scenes } = api.scene.list.useQuery({ gameId }, { enabled: !!gameId });

  return (
    <div className="space-y-4">
      <SectionTitle />
      <FormCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-panel-border mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#cccccc]">开放游戏</span>
              <HelpTip text="开启后玩家可以访问游戏并加载数据。关闭后 /api/data 接口将不可用，游戏无法启动" />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.gameEnabled}
              onClick={() => updateConfig("gameEnabled", !config.gameEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.gameEnabled ? "bg-[#0e639c]" : "bg-[#3c3c3c]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  config.gameEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <Field label="游戏名称">
            <input
              type="text"
              value={config.gameName}
              onChange={(e) => updateConfig("gameName", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="游戏版本">
            <input
              type="text"
              value={config.gameVersion}
              onChange={(e) => updateConfig("gameVersion", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="游戏描述">
            <textarea
              rows={3}
              value={config.gameDescription}
              onChange={(e) => updateConfig("gameDescription", e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <Field
            label="游戏 Logo"
            desc="上传游戏 Logo，将作为网页图标和游戏左上角标识显示。支持 PNG、JPG、WebP 等格式，最大 5MB"
          >
            <div className="flex items-center gap-4">
              {/* 预览 */}
              <div className="w-16 h-16 rounded-lg border border-widget-border bg-[#1a1a1a] flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-[#444]">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                  </svg>
                )}
              </div>
              {/* 操作按钮 */}
              <div className="flex flex-col gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-3 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isUploading ? "上传中..." : logoPreview ? "更换 Logo" : "上传 Logo"}
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    disabled={isUploading}
                    className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#5a1d1d] text-[#858585] hover:text-[#f48771] rounded-lg transition-colors disabled:opacity-50"
                  >
                    删除 Logo
                  </button>
                )}
              </div>
            </div>
          </Field>
          <Field label="游戏主角" desc="新游戏开始时使用的主角角色配置">
            <select
              value={config.playerKey}
              onChange={(e) => updateConfig("playerKey", e.target.value)}
              className={inputCls}
            >
              <option value="">-- 请选择主角 --</option>
              {players?.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.name}（{p.key}）
                </option>
              ))}
            </select>
          </Field>
          <Field label="初始地图" desc="新游戏开始时加载的地图（场景）">
            <select
              value={config.initialMap}
              onChange={(e) => updateConfig("initialMap", e.target.value)}
              className={inputCls}
            >
              <option value="">-- 请选择地图 --</option>
              {scenes?.map((s) => (
                <option key={s.id} value={s.mapFileName}>
                  {s.name}（{s.mapFileName}）
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="初始 NPC 文件"
            desc="新游戏开始时加载的 NPC 文件名（如 map002.npc），留空则不加载"
          >
            <input
              type="text"
              value={config.initialNpc}
              onChange={(e) => updateConfig("initialNpc", e.target.value)}
              className={inputCls}
              placeholder="例如: map002.npc"
            />
          </Field>
          <Field
            label="初始物体文件"
            desc="新游戏开始时加载的 OBJ 文件名（如 map002_obj.obj），留空则不加载"
          >
            <input
              type="text"
              value={config.initialObj}
              onChange={(e) => updateConfig("initialObj", e.target.value)}
              className={inputCls}
              placeholder="例如: map002_obj.obj"
            />
          </Field>
          <Field label="初始背景音乐" desc="新游戏开始时播放的背景音乐文件名，留空则无背景音乐">
            <input
              type="text"
              value={config.initialBgm}
              onChange={(e) => updateConfig("initialBgm", e.target.value)}
              className={inputCls}
              placeholder="例如: music01.ogg"
            />
          </Field>
          <Field
            label="标题界面音乐"
            desc="Title 画面播放的背景音乐文件名（位于 content/music/ 目录下），留空则无音乐。进入游戏后自动停止"
          >
            <input
              type="text"
              value={config.titleMusic}
              onChange={(e) => updateConfig("titleMusic", e.target.value)}
              className={inputCls}
              placeholder="例如: title.ogg"
            />
          </Field>
          <Field
            label="对话头像 ASF"
            desc="对话系统使用的头像精灵文件路径（ASF 格式），用于在对话框中显示角色头像"
          >
            <input
              type="text"
              value={config.portraitAsf}
              onChange={(e) => updateConfig("portraitAsf", e.target.value)}
              className={inputCls}
              placeholder="例如: asf/portrait/portrait.asf"
            />
          </Field>
        </div>
      </FormCard>
    </div>
  );
}

function NewGameScriptPanel({
  config,
  updateConfig,
}: {
  config: GameConfigDataFull;
  updateConfig: <K extends keyof GameConfigDataFull>(k: K, v: GameConfigDataFull[K]) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <SectionTitle desc="新游戏开始时执行的脚本内容（JXQY 脚本语法）" />
      <div className="border border-widget-border rounded flex-1 min-h-0">
        <ScriptEditor
          value={config.newGameScript}
          onChange={(v) => updateConfig("newGameScript", v)}
          height="100%"
          className="h-full"
        />
      </div>
    </div>
  );
}

function PlayerSpeedPanel({
  speed,
  onChange,
}: {
  speed: PlayerSpeed;
  onChange: (s: PlayerSpeed) => void;
}) {
  const up = (field: keyof PlayerSpeed, v: number | null) =>
    onChange({ ...speed, [field]: v ?? 1 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="控制主角在地图上的移动速度。基础速度决定角色每帧前进的像素数，跑步倍数用于计算跑步时的加速效果。" />
      <FormCard>
        <div className="grid grid-cols-3 gap-5">
          <Field label="基础速度" desc="角色每游戏帧移动的像素数。值越大移动越快，建议范围 1~10">
            <NumberInput
              value={speed.baseSpeed}
              onChange={(v) => up("baseSpeed", v)}
              min={1}
              className="w-full"
            />
          </Field>
          <Field
            label="跑步倍数"
            desc="跑步速度 = 基础速度 × 此倍数。例如基础速度 4、倍数 2 则跑步速度为 8 像素/帧"
          >
            <NumberInput
              value={speed.runSpeedFold}
              onChange={(v) => up("runSpeedFold", v)}
              min={1}
              className="w-full"
            />
          </Field>
          <Field
            label="最低减速 %"
            desc="武功/BUFF 能施加的最大减速百分比。-90 表示速度最多降低到原来的 10%"
          >
            <NumberInput
              value={speed.minChangeMoveSpeedPercent}
              onChange={(v) => up("minChangeMoveSpeedPercent", v)}
              min={-100}
              max={0}
              className="w-full"
            />
          </Field>
        </div>
      </FormCard>
    </div>
  );
}

function PlayerThewPanel({
  thew,
  onChange,
}: {
  thew: PlayerThewCost;
  onChange: (t: PlayerThewCost) => void;
}) {
  const up = (field: keyof PlayerThewCost, v: number | boolean | null) =>
    onChange({ ...thew, [field]: v ?? 0 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="体力（Thew）是角色执行动作的资源。跑步、攻击、跳跃都会消耗体力，体力耗尽后角色无法继续执行对应动作，需要站立等待自然恢复。" />
      <FormCard>
        <div className="grid grid-cols-3 gap-5">
          <Field
            label="跑步消耗 / 帧"
            desc="角色每跑步一帧扣除的体力值。值越高跑步越费体力，设为 0 则跑步不耗体力"
          >
            <NumberInput
              value={thew.runCost}
              onChange={(v) => up("runCost", v)}
              min={0}
              className="w-full"
            />
          </Field>
          <Field label="攻击消耗" desc="每次普通攻击扣除的体力值。体力不足时无法发起攻击">
            <NumberInput
              value={thew.attackCost}
              onChange={(v) => up("attackCost", v)}
              min={0}
              className="w-full"
            />
          </Field>
          <Field label="跳跃消耗" desc="每次跳跃扣除的体力值。体力不足时无法跳跃">
            <NumberInput
              value={thew.jumpCost}
              onChange={(v) => up("jumpCost", v)}
              min={0}
              className="w-full"
            />
          </Field>
        </div>
        <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-panel-border">
          <input
            type="checkbox"
            id="useThewNormalRun"
            checked={thew.useThewWhenNormalRun}
            onChange={(e) => up("useThewWhenNormalRun", e.target.checked)}
            className="accent-[#0098ff] w-4 h-4"
          />
          <label htmlFor="useThewNormalRun" className="text-sm text-[#cccccc] cursor-pointer">
            非战斗跑步时也消耗体力
          </label>
          <HelpTip text="关闭后仅战斗状态下跑步消耗体力，平时在城镇、野外跑步不会扣除体力" />
        </div>
      </FormCard>
    </div>
  );
}

function PlayerRestorePanel({
  restore,
  onChange,
}: {
  restore: PlayerRestore;
  onChange: (r: PlayerRestore) => void;
}) {
  const up = (field: keyof PlayerRestore, v: number | null) =>
    onChange({ ...restore, [field]: v ?? 0 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="角色站立不动时会自动恢复生命、体力和内力。每经过一个『恢复间隔』，按最大值的百分比回复。打坐状态下内力恢复使用独立的间隔。" />
      <FormCard>
        <div className="grid grid-cols-3 gap-x-6 gap-y-5">
          <Field
            label="生命恢复比例"
            desc="每个恢复周期回复的生命值 = 生命上限 × 此百分比。例如 5% 且生命上限 1000，则每周期恢复 50 点"
          >
            <div className="flex items-center gap-2">
              <NumberInput
                value={Math.round(restore.lifeRestorePercent * 100)}
                onChange={(v) => up("lifeRestorePercent", (v ?? 0) / 100)}
                min={0}
                max={100}
                className="w-full"
              />
              <span className="text-sm text-[#858585] font-medium">%</span>
            </div>
          </Field>
          <Field label="体力恢复比例" desc="每个恢复周期回复的体力值 = 体力上限 × 此百分比">
            <div className="flex items-center gap-2">
              <NumberInput
                value={Math.round(restore.thewRestorePercent * 100)}
                onChange={(v) => up("thewRestorePercent", (v ?? 0) / 100)}
                min={0}
                max={100}
                className="w-full"
              />
              <span className="text-sm text-[#858585] font-medium">%</span>
            </div>
          </Field>
          <Field label="内力恢复比例" desc="每个恢复周期回复的内力值 = 内力上限 × 此百分比">
            <div className="flex items-center gap-2">
              <NumberInput
                value={Math.round(restore.manaRestorePercent * 100)}
                onChange={(v) => up("manaRestorePercent", (v ?? 0) / 100)}
                min={0}
                max={100}
                className="w-full"
              />
              <span className="text-sm text-[#858585] font-medium">%</span>
            </div>
          </Field>
          <Field
            label="恢复间隔"
            desc="两次自动恢复之间的时间间隔。1000ms = 1 秒，值越小恢复越频繁"
          >
            <div className="flex items-center gap-2">
              <NumberInput
                value={restore.restoreIntervalMs}
                onChange={(v) => up("restoreIntervalMs", v)}
                min={100}
                className="w-full"
              />
              <span className="text-sm text-[#858585] font-medium">ms</span>
            </div>
          </Field>
          <Field
            label="打坐内力转换间隔"
            desc="角色打坐时，将生命转化为内力的时间间隔。值越小内力恢复越快"
          >
            <div className="flex items-center gap-2">
              <NumberInput
                value={restore.sittingManaRestoreInterval}
                onChange={(v) => up("sittingManaRestoreInterval", v)}
                min={50}
                className="w-full"
              />
              <span className="text-sm text-[#858585] font-medium">ms</span>
            </div>
          </Field>
        </div>
      </FormCard>
    </div>
  );
}

function PlayerCombatPanel({
  combat,
  onChange,
}: {
  combat: PlayerCombat;
  onChange: (c: PlayerCombat) => void;
}) {
  const up = (field: keyof PlayerCombat, v: number | null) =>
    onChange({ ...combat, [field]: v ?? 1 });
  return (
    <div className="space-y-4">
      <SectionTitle desc="控制战斗状态的切换和 NPC 交互的范围。角色受到攻击或发起攻击后进入战斗姿态，经过脱战时间后自动切回普通姿态。" />
      <FormCard>
        <div className="grid grid-cols-3 gap-5">
          <Field
            label="脱战时间"
            desc="最后一次攻击/受击后，经过此时间角色自动退出战斗姿态，恢复正常站立动画"
          >
            <div className="flex items-center gap-2">
              <NumberInput
                value={combat.maxNonFightSeconds}
                onChange={(v) => up("maxNonFightSeconds", v)}
                min={1}
                className="w-full"
              />
              <span className="text-sm text-[#858585] font-medium">秒</span>
            </div>
          </Field>
          <Field
            label="对话交互半径"
            desc="角色与 NPC 距离在此范围内时可以触发对话。1 格 = 1 个地图瓦片的大小"
          >
            <div className="flex items-center gap-2">
              <NumberInput
                value={combat.dialogRadius}
                onChange={(v) => up("dialogRadius", v)}
                min={1}
                className="w-full"
              />
              <span className="text-sm text-[#858585] font-medium">格</span>
            </div>
          </Field>
        </div>
      </FormCard>
    </div>
  );
}

function DropProbabilityPanel({
  config,
  updateProbability,
}: {
  config: GameConfigDataFull;
  updateProbability: <K extends keyof GameConfigDataFull["drop"]["probability"]>(
    k: K,
    v: number | null
  ) => void;
}) {
  const prob = config.drop.probability;
  return (
    <div className="space-y-4">
      <SectionTitle desc="击杀普通敌人后，每种物品独立进行一次掉落判定。概率为 1/N：N=5 表示 20% 概率掉落，N=10 表示 10%。每种物品的判定互不影响，理论上可以同时掉落多种物品。" />
      <FormCard>
        <div className="grid grid-cols-4 gap-5">
          <Field
            label="武器"
            desc={`概率 = 1/${prob.weaponChance}，约 ${(100 / prob.weaponChance).toFixed(1)}%`}
          >
            <NumberInput
              value={prob.weaponChance}
              onChange={(v) => updateProbability("weaponChance", v)}
              min={1}
              className="w-full"
            />
          </Field>
          <Field
            label="防具"
            desc={`概率 = 1/${prob.armorChance}，约 ${(100 / prob.armorChance).toFixed(1)}%`}
          >
            <NumberInput
              value={prob.armorChance}
              onChange={(v) => updateProbability("armorChance", v)}
              min={1}
              className="w-full"
            />
          </Field>
          <Field
            label="金钱"
            desc={`概率 = 1/${prob.moneyChance}，约 ${(100 / prob.moneyChance).toFixed(1)}%`}
          >
            <NumberInput
              value={prob.moneyChance}
              onChange={(v) => updateProbability("moneyChance", v)}
              min={1}
              className="w-full"
            />
          </Field>
          <Field
            label="药品"
            desc={`概率 = 1/${prob.drugChance}，约 ${(100 / prob.drugChance).toFixed(1)}%`}
          >
            <NumberInput
              value={prob.drugChance}
              onChange={(v) => updateProbability("drugChance", v)}
              min={1}
              className="w-full"
            />
          </Field>
        </div>
      </FormCard>
    </div>
  );
}

function DropEquipPanel({
  config,
  updateEquipTier,
}: {
  config: GameConfigDataFull;
  updateEquipTier: <K extends keyof GameConfigDataFull["drop"]["equipTier"]>(
    k: K,
    v: number | null
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle
        desc={`将 NPC 等级映射为掉落物品的等级档位。公式：掉落等级 = floor(NPC等级 / 除数) + 1。例如除数为 5、NPC 等级为 12，则掉落等级 = floor(12/5)+1 = 3。武器、防具、金钱、药品共用此公式。`}
      />
      <FormCard>
        <div className="grid grid-cols-3 gap-5">
          <Field
            label="等级除数"
            desc={`NPC 等级除以此值后取整再 +1 得到掉落等级。值越大等级跨度越大，例如除数 ${config.drop.equipTier.divisor} 表示每 ${config.drop.equipTier.divisor} 级敌人共用一个掉落池`}
          >
            <NumberInput
              value={config.drop.equipTier.divisor}
              onChange={(v) => updateEquipTier("divisor", v)}
              min={1}
              className="w-full"
            />
          </Field>
          <Field
            label="最大等级"
            desc={`掉落等级的上限。无论 NPC 多高等级，掉落物品最高为 ${config.drop.equipTier.maxTier} 级`}
          >
            <NumberInput
              value={config.drop.equipTier.maxTier}
              onChange={(v) => updateEquipTier("maxTier", v)}
              min={1}
              className="w-full"
            />
          </Field>
        </div>
      </FormCard>
    </div>
  );
}

function DropMoneyPanel({
  config,
  updateDrop,
}: {
  config: GameConfigDataFull;
  updateDrop: <K extends keyof GameConfigDataFull["drop"]>(
    k: K,
    v: GameConfigDataFull["drop"][K]
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="当敌人掉落金钱时，根据掉落等级（由装备等级映射公式计算）在对应档位的范围内随机一个金额。第 1 档对应掉落等级 1，第 2 档对应等级 2，以此类推。" />
      <MoneyTiersEditor
        tiers={config.drop.moneyTiers}
        onChange={(t) => updateDrop("moneyTiers", t)}
      />
    </div>
  );
}

function DropDrugPanel({
  config,
  updateDrop,
}: {
  config: GameConfigDataFull;
  updateDrop: <K extends keyof GameConfigDataFull["drop"]>(
    k: K,
    v: GameConfigDataFull["drop"][K]
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="按 NPC 等级区间决定掉落哪个药品池。每一档定义一个 NPC 最低等级的阈值，NPC 等级 ≥ 阈值时使用该档位的药品列表。最后一条为兜底规则，匹配所有未被前面规则覆盖的等级。" />
      <DrugTiersEditor tiers={config.drop.drugTiers} onChange={(t) => updateDrop("drugTiers", t)} />
    </div>
  );
}

function DropBossPanel({
  config,
  updateDrop,
}: {
  config: GameConfigDataFull;
  updateDrop: <K extends keyof GameConfigDataFull["drop"]>(
    k: K,
    v: GameConfigDataFull["drop"][K]
  ) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle desc="Boss 级敌人（ExpBonus > 0 的 NPC）击杀后必定掉落武器或防具。掉落时会在各档位中按概率抽取一个额外等级加成，最终掉落等级 = 基础掉落等级 + 抽中的加成值。概率总和建议为 100%。" />
      <BossLevelBonusEditor
        bonuses={config.drop.bossLevelBonuses}
        onChange={(b) => updateDrop("bossLevelBonuses", b)}
      />
    </div>
  );
}

// ========== 对话头像面板 ==========

/**
 * 单条头像映射行（memo 减少重渲染）
 */
const PortraitEntryRow = memo(function PortraitEntryRow({
  entry,
  index,
  gameSlug,
  gameId,
  onUpdate,
  onRemove,
}: {
  entry: PortraitEntry;
  index: number;
  gameSlug: string;
  gameId: string;
  onUpdate: (index: number, field: "idx" | "file", value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#2a2d2e] rounded-lg group hover:bg-[#2f3233] transition-colors">
      {/* 预览 */}
      <div className="w-12 h-12 flex-shrink-0 rounded bg-[#1e1e1e] border border-panel-border flex items-center justify-center overflow-hidden">
        {entry.file ? (
          <MiniAsfPreview
            gameSlug={gameSlug}
            path={buildResourcePath("portrait_image", entry.file)}
            size={48}
          />
        ) : (
          <span className="text-[#555] text-lg">🖼</span>
        )}
      </div>

      {/* 索引 */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <span className="text-[10px] text-[#858585]">索引</span>
        <NumberInput
          min={0}
          value={entry.idx}
          onChange={(val) => onUpdate(index, "idx", val ?? 0)}
          className="w-16"
        />
      </div>

      {/* 文件选择器 */}
      <div className="flex-1 min-w-0">
        <ResourceFilePicker
          label="文件"
          value={entry.file || null}
          onChange={(val) => onUpdate(index, "file", val ?? "")}
          fieldName="portrait_image"
          gameId={gameId}
          gameSlug={gameSlug}
          extensions={[".asf"]}
          placeholder="选择头像文件..."
        />
      </div>

      {/* 删除 */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] text-[#808080] hover:text-red-400 transition-all flex-shrink-0"
        title="删除"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
});

export function PortraitMappingPanel({ gameId }: { gameId: string }) {
  const toast = useToast();
  const utils = api.useUtils();
  const [isDragging, setIsDragging] = useState(false);
  const { currentGame } = useDashboard();
  const gameSlug = currentGame?.slug ?? "";

  // 查询
  const { data: portraitData, isLoading } = api.talkPortrait.get.useQuery(
    { gameId },
    { enabled: !!gameId }
  );

  const [entries, setEntries] = useState<PortraitEntry[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (portraitData) {
      setEntries(portraitData as PortraitEntry[]);
      setIsDirty(false);
    }
  }, [portraitData]);

  // 保存
  const updateMutation = api.talkPortrait.update.useMutation({
    onSuccess: () => {
      toast.success("对话头像配置已保存");
      setIsDirty(false);
      utils.talkPortrait.get.invalidate({ gameId });
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  // 从 INI 导入
  const importMutation = api.talkPortrait.importFromIni.useMutation({
    onSuccess: (result) => {
      const res = result as { entries: PortraitEntry[] };
      setEntries(res.entries);
      setIsDirty(false);
      toast.success(`成功导入 ${res.entries.length} 个头像映射`);
      utils.talkPortrait.get.invalidate({ gameId });
    },
    onError: (err) => toast.error(`导入失败: ${err.message}`),
  });

  const handleSave = () => {
    updateMutation.mutate({ gameId, entries });
  };

  const handleAdd = () => {
    const maxIdx = entries.reduce((max, e) => Math.max(max, e.idx), -1);
    setEntries([...entries, { idx: maxIdx + 1, file: "" }]);
    setIsDirty(true);
  };

  const handleRemove = useCallback((index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const handleUpdate = useCallback(
    (index: number, field: "idx" | "file", value: string | number) => {
      setEntries((prev) => {
        const updated = [...prev];
        if (field === "idx") {
          updated[index] = { ...updated[index], idx: value as number };
        } else {
          updated[index] = { ...updated[index], file: value as string };
        }
        return updated;
      });
      setIsDirty(true);
    },
    []
  );

  const handleImportIni = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ini";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const content = await file.text();
      importMutation.mutate({ gameId, iniContent: content } as never);
    };
    input.click();
  };

  const handleExportIni = () => {
    const content = exportPortraitIni(entries);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "HeadFile.ini";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const iniFile = files.find((f) => f.name.toLowerCase().endsWith(".ini"));
    if (!iniFile) {
      toast.error("请拖入 .ini 文件");
      return;
    }
    const content = await iniFile.text();
    importMutation.mutate({ gameId, iniContent: content } as never);
  };

  if (isLoading) {
    return <div className="text-[#858585]">加载中...</div>;
  }

  return (
    <div
      className="space-y-4 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 z-10 bg-[#0098ff]/10 border-2 border-dashed border-[#0098ff] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="text-[#0098ff] text-sm font-medium bg-[#252526] px-4 py-2 rounded-lg shadow-lg">
            释放 .ini 文件以导入头像映射
          </div>
        </div>
      )}
      <SectionTitle desc="Talk 脚本命令使用的角色头像索引映射（对应 HeadFile.ini）" />

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleImportIni}
          disabled={importMutation.isPending}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#cccccc] transition-colors disabled:opacity-50"
        >
          {importMutation.isPending ? "导入中..." : "从 INI 导入"}
        </button>
        <button
          type="button"
          onClick={handleExportIni}
          disabled={entries.length === 0}
          className="px-3 py-1.5 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded text-[#cccccc] transition-colors disabled:opacity-50"
        >
          导出 INI
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="px-3 py-1.5 text-xs bg-[#0e639c] hover:bg-[#1177bb] rounded text-white transition-colors"
        >
          + 添加
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 rounded text-white transition-colors disabled:opacity-50"
          >
            {updateMutation.isPending ? "保存中..." : "保存更改"}
          </button>
        )}
      </div>

      {/* 映射表 */}
      {entries.length === 0 ? (
        <div className="text-sm text-[#858585] bg-[#1e1e1e] p-6 rounded-lg text-center">
          暂无头像映射。拖入 HeadFile.ini 文件、点击「从 INI 导入」、或手动添加映射。
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <PortraitEntryRow
              key={`${entry.idx}-${index}`}
              entry={entry}
              index={index}
              gameSlug={gameSlug}
              gameId={gameId}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>
          头像文件位于 <code className="text-[#ce9178]">asf/portrait/</code> 目录下。
        </p>
        <p className="mt-1">
          脚本中使用 <code className="text-[#ce9178]">Talk</code> 命令指定头像索引来显示角色头像。
        </p>
      </div>
    </div>
  );
}

// ========== 武功经验配置面板 ==========

const MagicExpPanel = memo(function MagicExpPanel({
  magicExp,
  onChange,
}: {
  magicExp: MagicExpConfig;
  onChange: (value: MagicExpConfig) => void;
}) {
  const updateFraction = (
    field: "xiuLianMagicExpFraction" | "useMagicExpFraction",
    value: number | null
  ) => {
    onChange({ ...magicExp, [field]: value ?? 0 });
  };

  const updateExpEntry = (index: number, exp: number | null) => {
    const newEntries = [...magicExp.expByLevel];
    newEntries[index] = { ...newEntries[index], exp: exp ?? 0 };
    onChange({ ...magicExp, expByLevel: newEntries });
  };

  const addEntry = () => {
    const maxLevel =
      magicExp.expByLevel.length > 0 ? Math.max(...magicExp.expByLevel.map((e) => e.level)) + 1 : 0;
    const lastExp =
      magicExp.expByLevel.length > 0 ? magicExp.expByLevel[magicExp.expByLevel.length - 1].exp : 3;
    onChange({
      ...magicExp,
      expByLevel: [...magicExp.expByLevel, { level: maxLevel, exp: lastExp }],
    });
  };

  const removeEntry = (index: number) => {
    const newEntries = magicExp.expByLevel.filter((_, i) => i !== index);
    onChange({ ...magicExp, expByLevel: newEntries });
  };

  const resetToDefault = () => {
    onChange(createDefaultMagicExpConfig());
  };

  return (
    <div className="space-y-6">
      {/* 经验倍率设置 */}
      <div className="bg-[#252526] rounded-lg p-4 border border-[#333]">
        <h3 className="text-sm font-medium text-white mb-4">经验倍率</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-[#999] mb-1 block">修炼武功经验倍率</label>
            <NumberInput
              value={magicExp.xiuLianMagicExpFraction}
              onChange={(v) => updateFraction("xiuLianMagicExpFraction", v)}
              min={0}
              max={1}
              step={0.01}
            />
            <p className="text-xs text-[#666] mt-1">
              击杀获得经验 × 此倍率 = 修炼武功获得经验（默认 0.2222）
            </p>
          </div>
          <div>
            <label className="text-xs text-[#999] mb-1 block">使用武功经验倍率</label>
            <NumberInput
              value={magicExp.useMagicExpFraction}
              onChange={(v) => updateFraction("useMagicExpFraction", v)}
              min={0}
              max={1}
              step={0.01}
            />
            <p className="text-xs text-[#666] mt-1">
              击杀获得经验 × 此倍率 = 使用中武功获得经验（默认 0.0333）
            </p>
          </div>
        </div>
      </div>

      {/* 等级经验表 */}
      <div className="bg-[#252526] rounded-lg p-4 border border-[#333]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">
            命中经验表
            <span className="text-xs text-[#666] font-normal ml-2">
              （共 {magicExp.expByLevel.length} 个等级）
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToDefault}
              className="px-2 py-1 text-xs text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded transition-all"
            >
              恢复默认
            </button>
            <button
              type="button"
              onClick={addEntry}
              className="px-2 py-1 text-xs bg-[#0e639c] hover:bg-[#1177bb] text-white rounded transition-all"
            >
              + 添加等级
            </button>
          </div>
        </div>

        <p className="text-xs text-[#666] mb-3">
          敌人等级 → 每次命中获得的武功经验值。等级越高，获得经验越多。
        </p>

        {/* 表头 */}
        <div className="grid grid-cols-[60px_1fr_32px] gap-2 mb-2 px-1">
          <span className="text-xs text-[#666]">等级</span>
          <span className="text-xs text-[#666]">命中经验</span>
          <span />
        </div>

        {/* 经验条目列表 */}
        <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
          {magicExp.expByLevel.map((entry, index) => (
            <div
              key={entry.level}
              className="grid grid-cols-[60px_1fr_32px] gap-2 items-center group"
            >
              <span className="text-xs text-[#ccc] px-1 tabular-nums">Lv.{entry.level}</span>
              <NumberInput value={entry.exp} onChange={(v) => updateExpEntry(index, v)} min={0} />
              <button
                type="button"
                onClick={() => removeEntry(index)}
                className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-[#3c3c3c]"
                title="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {magicExp.expByLevel.length === 0 && (
          <div className="text-sm text-[#858585] text-center py-4">
            暂无经验配置，点击「添加等级」或「恢复默认」
          </div>
        )}
      </div>

      <div className="text-xs text-[#666] bg-[#1e1e1e] p-3 rounded">
        <p>
          此配置原为 <code className="text-[#ce9178]">MagicExp.ini</code> 文件。
        </p>
        <p className="mt-1">命中经验：武功命中敌人时，根据敌人等级查表获得对应经验值。</p>
        <p className="mt-1">经验倍率：击杀获得的经验 × 倍率 → 分配给修炼/使用中武功。</p>
      </div>
    </div>
  );
});

// ========== 主页面 ==========

export function GameGlobalConfigPage() {
  const { currentGame } = useDashboard();
  const { configTab } = useParams();
  const toast = useToast();
  const gameId = currentGame?.id ?? "";
  const gameSlug = currentGame?.slug ?? "";

  const [config, setConfig] = useState<GameConfigDataFull>(mergeGameConfig());
  const [isDirty, setIsDirty] = useState(false);
  const activeCategory = (configTab || "basic") as ConfigCategory;
  const contentRef = useRef<HTMLDivElement>(null);

  // 获取配置
  const { data, isLoading } = api.gameConfig.get.useQuery({ gameId }, { enabled: !!gameId });

  useEffect(() => {
    if (data) {
      setConfig(mergeGameConfig(data.data));
      setIsDirty(false);
    }
  }, [data]);

  // 切换 tab 时滚动到顶部
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, []);

  const updateConfig = useCallback(
    <K extends keyof GameConfigDataFull>(field: K, value: GameConfigDataFull[K]) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
    },
    []
  );

  const updatePlayer = useCallback(
    <K extends keyof GameConfigDataFull["player"]>(
      field: K,
      value: GameConfigDataFull["player"][K]
    ) => {
      setConfig((prev) => ({ ...prev, player: { ...prev.player, [field]: value } }));
      setIsDirty(true);
    },
    []
  );

  const updateDrop = useCallback(
    <K extends keyof GameConfigDataFull["drop"]>(
      field: K,
      value: GameConfigDataFull["drop"][K]
    ) => {
      setConfig((prev) => ({ ...prev, drop: { ...prev.drop, [field]: value } }));
      setIsDirty(true);
    },
    []
  );

  const updateProbability = useCallback(
    <K extends keyof GameConfigDataFull["drop"]["probability"]>(field: K, value: number | null) => {
      setConfig((prev) => ({
        ...prev,
        drop: { ...prev.drop, probability: { ...prev.drop.probability, [field]: value ?? 1 } },
      }));
      setIsDirty(true);
    },
    []
  );

  const updateEquipTier = useCallback(
    <K extends keyof GameConfigDataFull["drop"]["equipTier"]>(field: K, value: number | null) => {
      setConfig((prev) => ({
        ...prev,
        drop: { ...prev.drop, equipTier: { ...prev.drop.equipTier, [field]: value ?? 1 } },
      }));
      setIsDirty(true);
    },
    []
  );

  const updateMagicExp = useCallback((magicExp: MagicExpConfig) => {
    setConfig((prev) => ({ ...prev, magicExp }));
    setIsDirty(true);
  }, []);

  // 保存
  const updateMutation = api.gameConfig.update.useMutation({
    onSuccess: () => {
      toast.success("配置保存成功");
      setIsDirty(false);
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  const handleSave = () => {
    if (!gameId) return;
    updateMutation.mutate({ gameId, data: config });
  };

  const handleResetToDefault = () => {
    setConfig(mergeGameConfig());
    setIsDirty(true);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-80">
          <div className="h-8 bg-[#333] rounded w-48" />
          <div className="h-40 bg-[#252526] rounded" />
        </div>
      </div>
    );
  }

  // 渲染当前分类面板
  function renderPanel() {
    switch (activeCategory) {
      case "basic":
        return (
          <BasicInfoPanel
            config={config}
            updateConfig={updateConfig}
            gameId={gameId}
            gameSlug={gameSlug}
          />
        );
      case "newgame":
        return <NewGameScriptPanel config={config} updateConfig={updateConfig} />;
      case "player-speed":
        return (
          <PlayerSpeedPanel
            speed={config.player.speed}
            onChange={(s) => updatePlayer("speed", s)}
          />
        );
      case "player-thew":
        return (
          <PlayerThewPanel
            thew={config.player.thewCost}
            onChange={(t) => updatePlayer("thewCost", t)}
          />
        );
      case "player-restore":
        return (
          <PlayerRestorePanel
            restore={config.player.restore}
            onChange={(r) => updatePlayer("restore", r)}
          />
        );
      case "player-combat":
        return (
          <PlayerCombatPanel
            combat={config.player.combat}
            onChange={(c) => updatePlayer("combat", c)}
          />
        );
      case "magic-exp":
        return <MagicExpPanel magicExp={config.magicExp} onChange={updateMagicExp} />;
      case "drop-probability":
        return <DropProbabilityPanel config={config} updateProbability={updateProbability} />;
      case "drop-equip":
        return <DropEquipPanel config={config} updateEquipTier={updateEquipTier} />;
      case "drop-money":
        return <DropMoneyPanel config={config} updateDrop={updateDrop} />;
      case "drop-drug":
        return <DropDrugPanel config={config} updateDrop={updateDrop} />;
      case "drop-boss":
        return <DropBossPanel config={config} updateDrop={updateDrop} />;
    }
  }

  const CATEGORY_TITLES: Record<ConfigCategory, string> = {
    basic: "基础信息",
    newgame: "新游戏脚本",
    "player-speed": "移动速度",
    "player-thew": "体力消耗",
    "player-restore": "自然恢复",
    "player-combat": "战斗参数",
    "magic-exp": "武功经验",
    "drop-probability": "掉落概率",
    "drop-equip": "装备等级映射",
    "drop-money": "金钱掉落",
    "drop-drug": "药品掉落",
    "drop-boss": "Boss 加成",
  };

  // 独立面板（自己管理保存逻辑的 tab）
  const isSelfManaged = false;

  return (
    <div className="h-full flex flex-col">
      {/* 固定顶部栏 */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b border-panel-border">
        <h2 className="text-base font-semibold text-white tracking-tight">
          {CATEGORY_TITLES[activeCategory]}
        </h2>
        {!isSelfManaged && isDirty && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-500">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            有未保存的更改
          </span>
        )}
        {!isSelfManaged && (
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="px-3 py-1.5 text-xs text-[#858585] hover:text-white hover:bg-[#3c3c3c] rounded-lg transition-all"
            >
              恢复默认
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              className="px-4 py-1.5 bg-[#0e639c] hover:bg-[#1177bb] rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div
        ref={contentRef}
        className={`flex-1 ${activeCategory === "newgame" ? "flex flex-col overflow-hidden" : ""} ${activeCategory !== "newgame" ? "p-6 overflow-y-auto" : ""}`}
      >
        <div className={activeCategory === "newgame" ? "flex flex-col flex-1 min-h-0" : ""}>
          {renderPanel()}
        </div>
      </div>
    </div>
  );
}
