/**
 * Debug Panel - 调试面板 UI 组件
 * Based on JxqyHD Helper/cheat.txt
 *
 * VSCode 风格简洁设计
 */
import React, { useState, useMemo } from "react";
import type { GameVariables } from "../../engine/core/types";
import type { MagicItemInfo } from "../../engine/magic";
import {
  ALL_GOODS,
  ALL_PLAYER_MAGICS,
  GOODS_CATEGORIES,
} from "../../constants/gameData";

interface DebugPanelProps {
  isGodMode: boolean;
  playerStats?: {
    level: number;
    life: number;
    lifeMax: number;
    thew: number;
    thewMax: number;
    mana: number;
    manaMax: number;
    exp: number;
    levelUpExp: number;
    money: number;
  };
  playerPosition?: { x: number; y: number };
  loadedResources?: {
    mapName: string;
    mapPath: string;
    npcCount: number;
    objCount: number;
    npcFile: string;
    objFile: string;
  };
  gameVariables?: GameVariables;
  xiuLianMagic?: MagicItemInfo | null;
  triggeredTrapIds?: number[];
  currentScriptInfo?: {
    filePath: string;
    currentLine: number;
    totalLines: number;
    allCodes: string[];
    isCompleted?: boolean;
  } | null;
  scriptHistory?: { filePath: string; totalLines: number; allCodes: string[]; timestamp: number }[];
  onClose?: () => void;
  onFullAll: () => void;
  onSetLevel: (level: number) => void;
  onAddMoney: (amount: number) => void;
  onToggleGodMode: () => void;
  onReduceLife: () => void;
  onKillAllEnemies: () => void;
  onExecuteScript?: (scriptPath: string) => Promise<string | null>;
  onAddItem?: (itemFile: string) => Promise<void>;
  onAddMagic?: (magicFile: string) => Promise<void>;
  onAddAllMagics?: () => Promise<void>;
  onXiuLianLevelUp?: () => void;
  onXiuLianLevelDown?: () => void;
}

// 折叠区块组件
const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}> = ({ title, children, defaultOpen = true, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-700 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50"
      >
        <span className={`text-[10px] ${isOpen ? "rotate-90" : ""}`}>▶</span>
        <span className="flex-1 text-left">{title}</span>
        {badge !== undefined && (
          <span className="text-[10px] text-zinc-500">{badge}</span>
        )}
      </button>
      {isOpen && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
};

// 数据行组件
const DataRow: React.FC<{
  label: string;
  value: string | number;
  valueColor?: string;
}> = ({ label, value, valueColor = "text-zinc-300" }) => (
  <div className="flex justify-between text-[11px] py-px">
    <span className="text-zinc-500">{label}</span>
    <span className={`font-mono ${valueColor}`}>{value}</span>
  </div>
);

// 脚本语法高亮
const highlightCode = (code: string): React.ReactNode => {
  // 标签行 @Label:
  if (code.trim().startsWith("@")) {
    return <span className="text-purple-400">{code}</span>;
  }

  const tokens: React.ReactNode[] = [];
  let remaining = code;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // 关键字 If, Goto, Return, Else 等（完整单词）
    const keywordMatch = remaining.match(/^(If|Goto|Return|Else|ElseIf)\b/);
    if (keywordMatch) {
      tokens.push(<span key={keyIndex++} className="text-pink-400 font-medium">{keywordMatch[0]}</span>);
      remaining = remaining.slice(keywordMatch[0].length);
      continue;
    }

    // 函数名（后面跟括号）
    const funcMatch = remaining.match(/^([A-Za-z_][A-Za-z0-9_]*)(\s*\()/);
    if (funcMatch) {
      tokens.push(<span key={keyIndex++} className="text-yellow-400">{funcMatch[1]}</span>);
      tokens.push(<span key={keyIndex++} className="text-zinc-400">{funcMatch[2]}</span>);
      remaining = remaining.slice(funcMatch[0].length);
      continue;
    }

    // 字符串 "..."
    const strMatch = remaining.match(/^"([^"]*(?:\\.[^"]*)*)"/);
    if (strMatch) {
      tokens.push(<span key={keyIndex++} className="text-green-400">{strMatch[0]}</span>);
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // 变量 $xxx
    const varMatch = remaining.match(/^\$[A-Za-z_][A-Za-z0-9_]*/);
    if (varMatch) {
      tokens.push(<span key={keyIndex++} className="text-cyan-400">{varMatch[0]}</span>);
      remaining = remaining.slice(varMatch[0].length);
      continue;
    }

    // 数字
    const numMatch = remaining.match(/^-?\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push(<span key={keyIndex++} className="text-orange-400">{numMatch[0]}</span>);
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // 注释 // 或 ;
    const commentMatch = remaining.match(/^(\/\/.*|;.*)/);
    if (commentMatch) {
      tokens.push(<span key={keyIndex++} className="text-zinc-500 italic">{commentMatch[0]}</span>);
      remaining = remaining.slice(commentMatch[0].length);
      continue;
    }

    // 运算符
    const opMatch = remaining.match(/^(==|!=|>=|<=|&&|\|\||[+\-*/<>=!])/);
    if (opMatch) {
      tokens.push(<span key={keyIndex++} className="text-pink-300">{opMatch[0]}</span>);
      remaining = remaining.slice(opMatch[0].length);
      continue;
    }

    // 普通字符
    tokens.push(<span key={keyIndex++} className="text-zinc-300">{remaining[0]}</span>);
    remaining = remaining.slice(1);
  }

  return <>{tokens}</>;
};

// 脚本代码视图组件 - 用于当前脚本和tooltip
const ScriptCodeView: React.FC<{
  codes: string[];
  currentLine?: number;
  isCompleted?: boolean;
  onExecuteLine?: (code: string) => void;
  className?: string;
}> = ({ codes, currentLine, isCompleted = false, onExecuteLine, className = "" }) => {
  return (
    <div className={`bg-zinc-900 border border-zinc-700 font-mono text-[10px] ${className}`}>
      {codes.map((code, idx) => {
        const isCurrentLine = !isCompleted && currentLine !== undefined && idx === currentLine;
        const isExecuted = isCompleted || (currentLine !== undefined && idx < currentLine);
        const canExecute = onExecuteLine && code.trim();
        return (
          <div
            key={idx}
            className={`flex px-1 py-0.5 group ${
              isCurrentLine
                ? "bg-yellow-900/50 hover:bg-yellow-900/70"
                : isExecuted
                  ? "bg-green-900/20 hover:bg-green-900/40"
                  : "hover:bg-zinc-800"
            }`}
            title={code}
          >
            <span
              className={`w-4 text-center select-none mr-1 flex-shrink-0 ${
                isCurrentLine
                  ? "text-yellow-400"
                  : canExecute
                    ? "text-green-500 group-hover:text-cyan-400 cursor-pointer"
                    : isExecuted
                      ? "text-green-500"
                      : "text-zinc-600 group-hover:text-cyan-400 cursor-pointer"
              }`}
              onClick={() => canExecute && onExecuteLine(code)}
              title={canExecute ? `点击执行: ${code}` : isCurrentLine ? "当前行" : ""}
            >
              {isCurrentLine ? "▶" : <span className="group-hover:hidden">{isExecuted ? "✓" : ""}</span>}
              {!isCurrentLine && <span className="hidden group-hover:inline">▶</span>}
            </span>
            <span className="w-5 text-right text-zinc-600 mr-2 select-none flex-shrink-0">
              {idx + 1}
            </span>
            <span className="flex-1 break-all">{highlightCode(code)}</span>
          </div>
        );
      })}
    </div>
  );
};

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isGodMode,
  playerStats,
  playerPosition,
  loadedResources,
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
  const [scriptContent, setScriptContent] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState("1000");
  const [targetLevel, setTargetLevel] = useState("80");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedItem, setSelectedItem] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [selectedMagic, setSelectedMagic] = useState("");
  const [isAddingMagic, setIsAddingMagic] = useState(false);
  const [hoveredScriptIndex, setHoveredScriptIndex] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipY, setTooltipY] = useState(0);
  const hoverTimeoutRef = React.useRef<number | null>(null);
  const fadeTimeoutRef = React.useRef<number | null>(null);

  // 延迟关闭 hover，让鼠标有时间移动到 tooltip
  const handleScriptMouseEnter = (idx: number, e: React.MouseEvent) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setHoveredScriptIndex(idx);
    setTooltipVisible(true);
    setTooltipY(e.clientY);
  };

  const handleScriptMouseLeave = () => {
    hoverTimeoutRef.current = window.setTimeout(() => {
      // 先淡出
      setTooltipVisible(false);
      // 延迟后移除
      fadeTimeoutRef.current = window.setTimeout(() => {
        setHoveredScriptIndex(null);
      }, 150);
    }, 200);
  };

  const filteredItems = useMemo(() => {
    if (selectedCategory === "全部") return ALL_GOODS;
    return ALL_GOODS.filter((item) => item.category === selectedCategory);
  }, [selectedCategory]);

  // 复制脚本内容到剪贴板
  const copyScriptContent = (filePath: string, codes: string[]) => {
    const content = `// ${filePath}\n${codes.join("\n")}`;
    navigator.clipboard.writeText(content).then(() => {
      // 可以添加一个简单的提示，这里用 console
      console.log("[DebugPanel] Script copied to clipboard");
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  };

  // 检查脚本是否正在执行
  const isScriptRunning = currentScriptInfo && !currentScriptInfo.isCompleted;

  // 执行单行代码（带执行中检查）
  const handleExecuteLine = (code: string) => {
    if (isScriptRunning) {
      alert("脚本正在执行中，请等待执行完成后再操作");
      return;
    }
    onExecuteScript?.(code);
  };

  const handleExecuteScript = async () => {
    if (!onExecuteScript || !scriptContent.trim()) return;
    if (isScriptRunning) {
      alert("脚本正在执行中，请等待执行完成后再操作");
      return;
    }
    setIsExecuting(true);
    try {
      const error = await onExecuteScript(scriptContent.trim());
      if (error) alert(`脚本错误:\n${error}`);
    } catch (e) {
      alert(`脚本错误:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleAddItem = async () => {
    if (!onAddItem || !selectedItem) return;
    setIsAddingItem(true);
    try {
      await onAddItem(selectedItem);
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleAddMagic = async () => {
    if (!onAddMagic || !selectedMagic) return;
    setIsAddingMagic(true);
    try {
      await onAddMagic(selectedMagic);
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingMagic(false);
    }
  };

  const handleAddAllMagics = async () => {
    if (!onAddAllMagics) return;
    setIsAddingMagic(true);
    try {
      await onAddAllMagics();
    } catch (e) {
      alert(`添加失败:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsAddingMagic(false);
    }
  };

  const inputClass =
    "px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-600 text-zinc-200 focus:outline-none focus:border-blue-500";
  const selectClass =
    "px-2 py-1 text-[11px] bg-zinc-800 border border-zinc-600 text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer";
  const btnClass =
    "px-2 py-1 text-[11px] bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed";
  const btnPrimary =
    "px-2 py-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

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
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#52525b transparent' }}
      >
        {/* 角色状态 */}
        {playerStats && (
          <Section title="角色状态" defaultOpen={false}>
            <div className="space-y-px">
              <DataRow
                label="等级"
                value={playerStats.level}
                valueColor="text-yellow-400"
              />
              <DataRow
                label="生命"
                value={`${playerStats.life}/${playerStats.lifeMax}`}
                valueColor="text-red-400"
              />
              <DataRow
                label="内力"
                value={`${playerStats.mana}/${playerStats.manaMax}`}
                valueColor="text-blue-400"
              />
              <DataRow
                label="体力"
                value={`${playerStats.thew}/${playerStats.thewMax}`}
                valueColor="text-green-400"
              />
              <DataRow
                label="经验"
                value={`${playerStats.exp}/${playerStats.levelUpExp || "MAX"}`}
              />
              <DataRow
                label="金钱"
                value={playerStats.money.toLocaleString()}
                valueColor="text-amber-400"
              />
              {playerPosition && (
                <DataRow
                  label="位置"
                  value={`${playerPosition.x}, ${playerPosition.y}`}
                />
              )}
            </div>
          </Section>
        )}

        {/* 地图信息 */}
        {loadedResources && (
          <Section title="地图信息">
            <div className="space-y-px">
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
          </Section>
        )}

        {/* 快捷操作 */}
        <Section title="快捷操作" defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onFullAll}
                className={`${btnClass} flex-1`}
              >
                全满
              </button>
              <button
                type="button"
                onClick={onToggleGodMode}
                className={`flex-1 px-2 py-1 text-[11px] border ${
                  isGodMode
                    ? "bg-orange-600 hover:bg-orange-500 text-white border-orange-500"
                    : "bg-zinc-700 hover:bg-zinc-600 text-zinc-200 border-zinc-600"
                }`}
              >
                {isGodMode ? "无敌中" : "无敌"}
              </button>
              <button
                type="button"
                onClick={onKillAllEnemies}
                className={`${btnClass} flex-1 text-red-400`}
              >
                秒杀
              </button>
            </div>

            <div className="flex gap-1">
              <input
                type="number"
                value={targetLevel}
                onChange={(e) => setTargetLevel(e.target.value)}
                className={`${inputClass} flex-1 min-w-0 text-center`}
                placeholder="等级"
              />
              <button
                type="button"
                onClick={() => {
                  const l = Number.parseInt(targetLevel);
                  if (!Number.isNaN(l) && l >= 1) onSetLevel(l);
                }}
                className={`${btnClass} w-20 flex-shrink-0`}
              >
                设置等级
              </button>
            </div>

            <div className="flex gap-1">
              <input
                type="number"
                value={moneyAmount}
                onChange={(e) => setMoneyAmount(e.target.value)}
                className={`${inputClass} flex-1 min-w-0 text-center`}
                placeholder="金额"
              />
              <button
                type="button"
                onClick={() => {
                  const a = Number.parseInt(moneyAmount);
                  if (!Number.isNaN(a)) onAddMoney(a);
                }}
                className={`${btnClass} w-20 flex-shrink-0 text-amber-400`}
              >
                添加金钱
              </button>
            </div>
          </div>
        </Section>

        {/* 物品/武功 */}
        {(onAddItem || onAddMagic) && (
          <Section title="物品 / 武功" defaultOpen={false}>
            {onAddItem && (
              <div className="flex gap-1 mb-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedItem("");
                  }}
                  className={`${selectClass} w-16`}
                >
                  {GOODS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className={`${selectClass} flex-1`}
                >
                  <option value="">选择物品...</option>
                  {filteredItems.map((i) => (
                    <option key={i.file} value={i.file}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={isAddingItem || !selectedItem}
                  className={`${btnPrimary} px-3`}
                >
                  +
                </button>
              </div>
            )}
            {onAddMagic && (
              <div className="flex gap-1">
                <select
                  value={selectedMagic}
                  onChange={(e) => setSelectedMagic(e.target.value)}
                  className={`${selectClass} flex-1`}
                >
                  <option value="">选择武功...</option>
                  {ALL_PLAYER_MAGICS.map((m) => (
                    <option key={m.file} value={m.file}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddMagic}
                  disabled={isAddingMagic || !selectedMagic}
                  className={`${btnPrimary} px-3`}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={handleAddAllMagics}
                  disabled={isAddingMagic}
                  className={`${btnClass} px-2`}
                >
                  全部
                </button>
              </div>
            )}
          </Section>
        )}

        {/* 修炼武功 */}
        {xiuLianMagic?.magic && (
          <Section title="修炼武功">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-amber-400">
                  {xiuLianMagic.magic.name}
                </div>
                <div className="text-[10px] text-zinc-500">
                  等级 {xiuLianMagic.level} / {xiuLianMagic.magic.maxLevel || 10}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={onXiuLianLevelDown}
                  disabled={xiuLianMagic.level <= 1}
                  className={`${btnClass} w-6 h-6 p-0`}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={onXiuLianLevelUp}
                  disabled={
                    xiuLianMagic.level >= (xiuLianMagic.magic.maxLevel || 10)
                  }
                  className={`${btnClass} w-6 h-6 p-0`}
                >
                  +
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* 当前脚本 */}
        <Section title="当前脚本">
          {currentScriptInfo ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-cyan-400 font-mono break-all flex-1" title={currentScriptInfo.filePath}>
                  {currentScriptInfo.filePath}
                </div>
                <button
                  type="button"
                  onClick={() => copyScriptContent(currentScriptInfo.filePath, currentScriptInfo.allCodes)}
                  className="text-zinc-500 hover:text-zinc-300 flex-shrink-0 p-0.5"
                  title="复制脚本内容"
                >
                  📋
                </button>
                {currentScriptInfo.isCompleted && (
                  <span className="text-[10px] text-green-400 flex-shrink-0">✓ 已完成</span>
                )}
              </div>
              <DataRow
                label="状态"
                value={currentScriptInfo.isCompleted
                  ? `已完成 (共 ${currentScriptInfo.totalLines} 行)`
                  : `执行中 ${currentScriptInfo.currentLine + 1} / ${currentScriptInfo.totalLines}`
                }
                valueColor={currentScriptInfo.isCompleted ? "text-green-400" : "text-yellow-400"}
              />
              <ScriptCodeView
                codes={currentScriptInfo.allCodes}
                currentLine={currentScriptInfo.currentLine}
                isCompleted={currentScriptInfo.isCompleted}
                onExecuteLine={handleExecuteLine}
                className="mt-1"
              />
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500">无脚本执行中</div>
          )}
        </Section>

        {/* 脚本执行历史 */}
        {scriptHistory && scriptHistory.length > 0 && (
          <Section title="脚本历史" badge={scriptHistory.length}>
            <div
              className="space-y-0.5 max-h-48 overflow-y-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#52525b transparent' }}
            >
              {scriptHistory.map((item, idx) => (
                <div
                  key={`${item.filePath}-${item.timestamp}`}
                  className="flex items-center text-[10px] font-mono py-0.5 text-zinc-400 hover:bg-zinc-800/50 cursor-default"
                  onMouseEnter={(e) => handleScriptMouseEnter(idx, e)}
                  onMouseLeave={handleScriptMouseLeave}
                >
                  <span className="w-4 text-center text-zinc-600 mr-1">{idx + 1}</span>
                  <span className="flex-1 break-all text-cyan-400/70">{item.filePath}</span>
                  <span className="text-zinc-600 ml-1">({item.totalLines}行)</span>
                </div>
              ))}
            </div>
            {/* 悬浮提示框 - 显示在鼠标右侧，Y轴跟随鼠标，自动避开底部遮挡 */}
            {hoveredScriptIndex !== null && scriptHistory[hoveredScriptIndex] && (() => {
              const tooltipHeight = Math.min(scriptHistory[hoveredScriptIndex].allCodes.length * 20 + 50, window.innerHeight * 0.6);
              const spaceBelow = window.innerHeight - tooltipY;
              // 如果下方空间不够，向上偏移
              const top = spaceBelow < tooltipHeight + 20
                ? Math.max(10, tooltipY - tooltipHeight + 40)
                : Math.max(10, tooltipY - 20);
              return (
              <div
                className="fixed z-[9999] bg-zinc-900/80 backdrop-blur-md border border-zinc-600 shadow-2xl max-w-lg max-h-[60vh] overflow-auto rounded-lg transition-opacity duration-150"
                style={{
                  left: 'calc(48px + var(--panel-width, 280px) + 8px)',
                  top,
                  opacity: tooltipVisible ? 1 : 0,
                  transition: 'opacity 150ms ease-out',
                }}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                  }
                  if (fadeTimeoutRef.current) {
                    clearTimeout(fadeTimeoutRef.current);
                    fadeTimeoutRef.current = null;
                  }
                  setTooltipVisible(true);
                }}
                onMouseLeave={handleScriptMouseLeave}
              >
                <div className="flex items-center px-3 py-2 border-b border-zinc-700 sticky top-0 bg-zinc-900/80 backdrop-blur-md">
                  <span className="text-[11px] text-cyan-400 select-text flex-1 font-medium">{scriptHistory[hoveredScriptIndex].filePath}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const item = scriptHistory[hoveredScriptIndex];
                      copyScriptContent(item.filePath, item.allCodes);
                    }}
                    className="text-zinc-500 hover:text-zinc-300 p-1 ml-2 hover:bg-zinc-700 rounded"
                    title="复制脚本内容"
                  >
                    📋
                  </button>
                </div>
                <ScriptCodeView
                  codes={scriptHistory[hoveredScriptIndex].allCodes}
                  onExecuteLine={handleExecuteLine}
                  className="border-0"
                />
              </div>
              );
            })()}
          </Section>
        )}

        {/* 执行脚本 */}
        {onExecuteScript && (
          <Section title="执行脚本">
            <div className="space-y-1">
              <textarea
                value={scriptContent}
                onChange={(e) => setScriptContent(e.target.value)}
                placeholder={'Talk(0,"测试")\nSetMoney(10000)'}
                className={`${inputClass} w-full font-mono resize-none h-20`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) handleExecuteScript();
                }}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={handleExecuteScript}
                  disabled={isExecuting || !scriptContent.trim()}
                  className={`${btnPrimary} flex-1`}
                >
                  {isExecuting ? "执行中..." : "执行 (Ctrl+Enter)"}
                </button>
                <button
                  type="button"
                  onClick={() => setScriptContent("")}
                  className={`${btnClass} px-3`}
                >
                  清空
                </button>
              </div>
            </div>
          </Section>
        )}

        {/* 游戏变量 */}
        <Section
          title="游戏变量"
          badge={Object.keys(gameVariables || {}).length}
        >
          <div
            className="max-h-40 overflow-y-auto bg-zinc-900 border border-zinc-700 font-mono text-[10px]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#52525b transparent' }}
          >
            {gameVariables && Object.keys(gameVariables).length > 0 ? (
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
      </div>
    </div>
  );
};
