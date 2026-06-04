/**
 * GamblePanel - 骰子赌博小游戏 UI（6 骰子）
 *
 * 7 种玩法，倍数下注，玩法说明，浮夸胜负动画。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineQuestionMarkCircle, HiOutlineXMark } from "react-icons/hi2";

// ============= Types =============

export type BetChoice = "big" | "small" | "odd" | "even" | "fourKind" | "threePairs" | "sextuple";

export interface DiceResult {
  dice: number[];
  sum: number;
  win: boolean;
  betAmount: number;
  netGain: number;
  randomBonus: number;
  randomPenalty: number;
  bonusText: string | null;
  penaltyText: string | null;
  specialEvent: string | null;
  comboBonus: string | null;
  comboBonusAmount: number;
}

export interface GamblePanelProps {
  isVisible: boolean;
  money: number;
  betAmount: number;
  onPlaceBet: (choice: BetChoice, multiplier: number) => DiceResult;
  onClose: () => void;
}

// ============= Config =============

const BET_OPTIONS: {
  key: BetChoice; label: string; desc: string; odds: string; oddsNum: number;
  color: string; hover: string; border: string;
}[] = [
  { key: "small",      label: "小",   desc: "6-20",    odds: "2倍",   oddsNum: 2,   color: "bg-blue-600/80",    hover: "hover:bg-blue-500/80",    border: "border-blue-400/30" },
  { key: "big",        label: "大",   desc: "21-36",   odds: "2倍",   oddsNum: 2,   color: "bg-red-600/80",     hover: "hover:bg-red-500/80",     border: "border-red-400/30" },
  { key: "odd",        label: "单",   desc: "奇数",    odds: "2倍",   oddsNum: 2,   color: "bg-emerald-600/80", hover: "hover:bg-emerald-500/80", border: "border-emerald-400/30" },
  { key: "even",       label: "双",   desc: "偶数",    odds: "2倍",   oddsNum: 2,   color: "bg-purple-600/80",  hover: "hover:bg-purple-500/80",  border: "border-purple-400/30" },
  { key: "fourKind",   label: "四条", desc: "4+个相同", odds: "10倍",  oddsNum: 10,  color: "bg-amber-600/80",   hover: "hover:bg-amber-500/80",   border: "border-amber-400/30" },
  { key: "threePairs", label: "三对", desc: "3组对子",  odds: "25倍",  oddsNum: 25,  color: "bg-cyan-600/80",    hover: "hover:bg-cyan-500/80",    border: "border-cyan-400/30" },
  { key: "sextuple",   label: "通杀", desc: "6个全同",  odds: "100倍", oddsNum: 100, color: "bg-yellow-500/80",  hover: "hover:bg-yellow-400/80",  border: "border-yellow-300/40" },
];

const MULTIPLIERS = [1, 2, 3, 5, 10, 20, 50, 100, 1000];

// ============= Tier System =============

type WinTier = "small" | "medium" | "big" | "huge" | "mega" | "legendary";

function getWinTier(netGain: number): WinTier {
  const g = Math.abs(netGain);
  if (g >= 200000) return "legendary";
  if (g >= 20000)  return "mega";
  if (g >= 2000)   return "huge";
  if (g >= 400)    return "big";
  if (g >= 100)    return "medium";
  return "small";
}

const TIER_META: Record<WinTier, { label: string; subtitle: string; flash: string }> = {
  small:     { label: "赢了！",     subtitle: "",              flash: "flash-gold" },
  medium:    { label: "赢了！",     subtitle: "",              flash: "flash-gold" },
  big:       { label: "大赢！",     subtitle: "",              flash: "flash-gold-bright" },
  huge:      { label: "超级大赢！", subtitle: "",              flash: "flash-gold-bright" },
  mega:      { label: "巨额奖金！", subtitle: "运气爆棚！",     flash: "flash-white" },
  legendary: { label: "传 奇 ！",   subtitle: "天选之人！",     flash: "flash-white" },
};

// ============= Particles =============

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

const CONFETTI_COLORS = ["#ffd700", "#ff6b35", "#ff1744", "#00e676", "#2979ff", "#d500f9", "#ff9100", "#00e5ff", "#fff"];

/** Confetti burst */
function Confetti({ count, spread, colors, radius = 0 }: { count: number; spread: number; colors: string[]; radius?: number }) {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, color: colors[i % colors.length],
    x: rand(-spread, spread), y: rand(-350, -60), rotate: rand(-900, 900),
    scale: rand(0.5, 1.5), delay: rand(0, 0.4), duration: rand(1, 2.5),
    wobble: rand(-1.5, 1.5), shape: Math.random() > 0.4 ? "rect" : "circle" as const,
    r: radius ? rand(0, Math.PI * 2) : 0,
  })), [count, spread, colors, radius]);

  return (
    <div className="fx-layer">
      {particles.map((p) => {
        const cx = radius ? Math.cos(p.r) * radius + p.x : p.x;
        const cy = radius ? Math.sin(p.r) * radius + p.y : p.y;
        return (
          <div key={p.id} className="confetti" style={{
            left: "50%", top: "50%", backgroundColor: p.color,
            width: `${8 * p.scale}px`, height: p.shape === "rect" ? `${18 * p.scale}px` : `${8 * p.scale}px`,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            ["--cx" as string]: `${cx}px`, ["--cy" as string]: `${cy}px`,
            ["--rot" as string]: `${p.rotate}deg`, ["--w" as string]: `${p.wobble}`,
            animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
          }} />
        );
      })}
    </div>
  );
}

/** Gold coins rain */
function GoldRain({ count = 40 }: { count?: number }) {
  const coins = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, left: `${rand(3, 97)}%`, delay: rand(0, 2.5), duration: rand(1.5, 3.5), size: rand(8, 22),
  })), [count]);

  return (
    <div className="fx-layer-fixed">
      {coins.map((c) => (
        <div key={c.id} className="coin" style={{
          left: c.left, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`,
          width: `${c.size}px`, height: `${c.size}px`,
        }} />
      ))}
    </div>
  );
}

/** Star burst (radial sparkles) */
function StarBurst({ count = 20 }: { count?: number }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, angle: (i / count) * 360, distance: rand(100, 300), delay: rand(0, 0.4),
    size: rand(5, 14), color: ["#ffd700", "#fff", "#ffe082", "#ff6b35"][i % 4],
  })), [count]);

  return (
    <div className="fx-layer">
      {stars.map((s) => (
        <div key={s.id} className="star" style={{
          left: "50%", top: "50%", width: `${s.size}px`, height: `${s.size}px`,
          backgroundColor: s.color, borderRadius: "50%",
          ["--sx" as string]: `${Math.cos(s.angle * Math.PI / 180) * s.distance}px`,
          ["--sy" as string]: `${Math.sin(s.angle * Math.PI / 180) * s.distance}px`,
          animationDelay: `${s.delay}s`,
          boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
        }} />
      ))}
    </div>
  );
}

/** Ring expand effect */
function RingBurst({ color = "#ffd700", delay = 0 }: { color?: string; delay?: number }) {
  return (
    <div className="fx-layer" style={{ animationDelay: `${delay}s` }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="ring" style={{
          borderColor: color, animationDelay: `${delay + i * 0.15}s`,
          boxShadow: `0 0 20px ${color}40`,
        }} />
      ))}
    </div>
  );
}

// ============= Win Particles (absolute over panel) =============

const TIER_RANGES: Record<WinTier, { confetti: [number,number]; stars: [number,number]; rings: [number,number]; coins: [number,number] }> = {
  small:     { confetti: [20, 40],  stars: [6, 12],   rings: [1, 1], coins: [0, 0] },
  medium:    { confetti: [40, 70],  stars: [12, 22],  rings: [1, 2], coins: [0, 0] },
  big:       { confetti: [70, 110], stars: [20, 35],  rings: [2, 3], coins: [10, 25] },
  huge:      { confetti: [100, 160],stars: [30, 50],  rings: [2, 4], coins: [20, 45] },
  mega:      { confetti: [150, 220],stars: [45, 70],  rings: [3, 5], coins: [40, 70] },
  legendary: { confetti: [200, 300],stars: [70, 100], rings: [4, 6], coins: [60, 100] },
};

const RING_COLORS = ["#ffd700", "#ff6b35", "#ff1744", "#d500f9", "#00e676", "#00e5ff", "#ff9100", "#2979ff"];

function randInt(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }

function WinParticles({ tier }: { tier: WinTier }) {
  const [alive, setAlive] = useState(true);
  const meta = TIER_META[tier];
  const r = TIER_RANGES[tier];

  // Randomize config on each mount
  const config = useMemo(() => {
    const ringCount = randInt(r.rings[0], r.rings[1]);
    // Pick random ring colors (shuffled)
    const shuffled = [...RING_COLORS].sort(() => Math.random() - 0.5);
    const ringColors = shuffled.slice(0, ringCount);
    return {
      confettiCount: randInt(r.confetti[0], r.confetti[1]),
      starCount: randInt(r.stars[0], r.stars[1]),
      coinCount: randInt(r.coins[0], r.coins[1]),
      ringColors,
      // Randomly pick a confetti color subset (4-8 colors)
      confettiColors: [...CONFETTI_COLORS].sort(() => Math.random() - 0.5).slice(0, randInt(4, 8)),
    };
  }, [r.confetti[0], r.confetti[1], r.stars[0], r.stars[1], r.coins[0], r.coins[1], r.rings[0], r.rings[1]]);

  useEffect(() => {
    const dur = {small:4000,medium:5000,big:7000,huge:8000,mega:10000,legendary:12000}[tier];
    const t = setTimeout(() => setAlive(false), dur);
    return () => clearTimeout(t);
  }, [tier]);

  if (!alive) return null;

  return (
    <div className={`win-particles absolute inset-0 pointer-events-none z-[100] overflow-visible ${meta.flash}`}>
      <Confetti count={config.confettiCount} spread={200 + config.confettiCount * 2} colors={config.confettiColors} />
      <StarBurst count={config.starCount} />
      {config.ringColors.map((color, i) => (
        <RingBurst key={`${color}-${i}`} color={color} delay={i * 0.15} />
      ))}
      {config.coinCount > 0 && <GoldRain count={config.coinCount} />}
    </div>
  );
}

// ============= Win Text (below dice) =============

function WinText({ tier, netGain, randomBonus, bonusText, comboBonus, comboBonusAmount }: {
  tier: WinTier; netGain: number; randomBonus: number; bonusText: string | null; comboBonus: string | null; comboBonusAmount: number;
}) {
  const meta = TIER_META[tier];

  return (
    <div className={`win-text-wrap tier-${tier}`}>
      {meta.label && <div className="win-label">{meta.label}</div>}
      {meta.subtitle && <div className="win-subtitle">{meta.subtitle}</div>}
      <div className="win-amount">+{netGain} 两</div>
      {randomBonus > 1 && bonusText && <div className="win-bonus">🎲 {bonusText}（×{randomBonus}）</div>}
      {comboBonus && <div className="win-combo">{comboBonus} +{comboBonusAmount} 两</div>}
    </div>
  );
}

// ============= Lose Particles (absolute over panel) =============

function LoseParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[100] overflow-visible">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="lose-shard" style={{
          left: "50%", top: "40%",
          ["--sx" as string]: `${Math.cos(i / 8 * Math.PI * 2) * 120}px`,
          ["--sy" as string]: `${Math.sin(i / 8 * Math.PI * 2) * 120}px`,
          animationDelay: `${i * 0.03}s`,
        }} />
      ))}
    </div>
  );
}

// ============= Lose Text (below dice) =============

function LoseText({ netGain, betAmount, specialEvent, randomPenalty, penaltyText }: {
  netGain: number; betAmount: number; specialEvent: string | null; randomPenalty: number; penaltyText: string | null;
}) {
  const isBigLoss = betAmount >= 500;
  return (
    <div className="lose-text-wrap">
      <div className={`lose-amount ${isBigLoss ? "lose-big" : ""}`}>{netGain} 两</div>
      {randomPenalty > 1 && penaltyText && <div className="lose-penalty">💀 {penaltyText}（×{randomPenalty}）</div>}
      {specialEvent && <div className="lose-event">{specialEvent}</div>}
      {isBigLoss && !specialEvent && !(randomPenalty > 1) && <div className="lose-hint">血本无归...</div>}
    </div>
  );
}

// ============= Dice =============

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[1,1]], 2: [[0,2],[2,0]], 3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]], 5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,1],[0,2],[2,0],[2,1],[2,2]],
};

function DiceFace({ value, size = 44 }: { value: number; size?: number }) {
  const dots = DICE_DOTS[value] ?? DICE_DOTS[1];
  const c = size / 3, r = c * 0.28;
  return (
    <svg width={size} height={size}>
      <rect width={size} height={size} rx="5" fill="#f5f0e8" stroke="#c4b89a" strokeWidth="1.5" />
      {dots.map(([row, col], i) => <circle key={i} cx={col*c+c/2} cy={row*c+c/2} r={r} fill="#2d2d2d" />)}
    </svg>
  );
}

function RollingDice() {
  const [face, setFace] = useState(1);
  useEffect(() => { const id = setInterval(() => setFace(Math.floor(Math.random()*6)+1), 80); return () => clearInterval(id); }, []);
  return <div className="dice-roll"><DiceFace value={face} size={40} /></div>;
}

// ============= Rules =============

function RulesPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 rounded-2xl" onClick={onClose}>
      <div className="w-[520px] bg-stone-900/95 backdrop-blur-xl border border-amber-700/40 rounded-xl p-5 text-sm leading-relaxed max-h-[80%] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-amber-100">📜 玩法说明</h3>
          <button onClick={onClose} className="text-amber-400/60 hover:text-amber-200"><HiOutlineXMark size={20} /></button>
        </div>
        <div className="space-y-3 text-amber-300/90">
          <p>6 个骰子，总和 <b className="text-amber-100">6 ~ 36</b>。</p>
          <div className="border-t border-amber-800/30 pt-2">
            <p className="font-semibold text-amber-200 mb-1">基本玩法</p>
            <p><b className="text-blue-400">小</b>（6-20）/ <b className="text-red-400">大</b>（21-36）· <b className="text-emerald-400">单</b> / <b className="text-purple-400">双</b>（奇偶）</p>
            <p className="text-amber-500/50 text-xs">出现四条以上算庄家赢（~9%）</p>
          </div>
          <div className="border-t border-amber-800/30 pt-2">
            <p className="font-semibold text-amber-200 mb-1">特殊玩法</p>
            <p><b className="text-amber-400">四条</b> 10倍 · 4+个相同（~9%）</p>
            <p><b className="text-cyan-400">三对</b> 25倍 · 恰好3组对子（~3.9%）</p>
            <p><b className="text-yellow-400">通杀</b> 100倍 · 6个全同（~0.013%）</p>
          </div>
          <div className="border-t border-amber-800/30 pt-2">
            <p className="font-semibold text-amber-200 mb-1">倍数下注</p>
            <p>1x ~ 1000x，下注 = 基础注 × 倍数。倍数越高，赢了越刺激！</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= Main =============

function GamblePanelInner({
  isVisible, money, betAmount: baseBet, onPlaceBet, onClose,
}: GamblePanelProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceResult | null>(null);
  const [resultKey, setResultKey] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [showRules, setShowRules] = useState(false);
  const [lastOdds, setLastOdds] = useState(0);
  const [lastMult, setLastMult] = useState(1);
  const [shake, setShake] = useState("");
  const totalBet = baseBet * multiplier;
  const canAfford = money >= totalBet;

  useEffect(() => {
    if (isVisible && money < baseBet && !isRolling) { const t = setTimeout(onClose, 2000); return () => clearTimeout(t); }
  }, [isVisible, money, baseBet, isRolling, onClose]);

  const handleBet = useCallback((choice: BetChoice) => {
    if (isRolling || money < totalBet) return;
    const odds = BET_OPTIONS.find((o) => o.key === choice)?.oddsNum ?? 2;
    setIsRolling(true); setLastResult(null); setShake(""); setLastOdds(odds); setLastMult(multiplier);
    setTimeout(() => {
      const result = onPlaceBet(choice, multiplier);
      setIsRolling(false); setLastResult(result); setResultKey((k) => k + 1);
      if (result.win) {
        const tier = getWinTier(result.netGain);
        if (tier === "legendary") { setShake("shake-hard"); setTimeout(() => setShake(""), 1200); }
        else if (tier === "mega") { setShake("shake-hard"); setTimeout(() => setShake(""), 1000); }
        else if (tier === "huge") { setShake("shake-hard"); setTimeout(() => setShake(""), 800); }
        else if (tier === "big") { setShake("shake-medium"); setTimeout(() => setShake(""), 600); }
        else { setShake("shake-light"); setTimeout(() => setShake(""), 400); }
      } else {
        setShake("shake-loss"); setTimeout(() => setShake(""), 400);
      }
    }, 1200);
  }, [isRolling, money, totalBet, multiplier, onPlaceBet]);

  if (!isVisible) return null;

  const winTier = lastResult?.win ? getWinTier(lastResult.netGain) : null;

  return (
    <div className={`fixed inset-0 flex items-center justify-center ${shake}`} style={{ zIndex: 99999 }}
      onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>

      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-[680px] flex flex-col rounded-2xl overflow-visible
        bg-gradient-to-b from-amber-950/95 to-stone-950/95 backdrop-blur-xl
        border border-amber-700/40 shadow-2xl shadow-amber-900/40"
        onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-amber-700/30 bg-amber-900/20 rounded-t-2xl">
          <h2 className="text-lg font-bold text-amber-200 tracking-wide">🎲 骰子赌坊</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRules(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-400/60 hover:text-amber-200 hover:bg-amber-800/30 transition-colors" title="玩法说明"><HiOutlineQuestionMarkCircle style={{ strokeWidth: 2.2 }} /></button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-amber-400/60 hover:text-amber-200 hover:bg-amber-800/30 transition-colors"><HiOutlineXMark style={{ strokeWidth: 2.2 }} /></button>
          </div>
        </div>

        {/* Money + Multiplier */}
        <div className="px-6 py-3 flex items-center justify-between bg-stone-900/30">
          <div className="text-amber-300 text-sm">银两：<span className="text-xl font-bold text-amber-100">{money}</span></div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400/70 text-sm">倍数：</span>
            <div className="flex gap-1 flex-wrap justify-end">
              {MULTIPLIERS.map((m) => (
                <button key={m} onClick={() => setMultiplier(m)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all
                    ${multiplier === m ? "bg-amber-600 text-white shadow-md" : "bg-stone-800/60 text-amber-400/70 hover:bg-stone-700/60 hover:text-amber-300"}`}>
                  {m}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-1 text-center text-amber-500/50 text-xs">
          本注：<span className="text-amber-300 font-semibold">{totalBet}</span> 两
          {multiplier > 1 && <span className="ml-1">（{baseBet} × {multiplier}）</span>}
        </div>

        {/* Dice */}
        <div className="px-6 py-4 flex items-center justify-center gap-2 min-h-[80px] relative z-[1]">
          {isRolling ? (
            Array.from({ length: 6 }, (_, i) => <RollingDice key={i} />)
          ) : lastResult ? (
            <div className="flex items-center gap-1.5" key={resultKey}>
              {lastResult.dice.map((d, i) => (
                <div key={i} className="dice-pop" style={{ animationDelay: `${i * 70}ms` }}><DiceFace value={d} size={44} /></div>
              ))}
              <div className="ml-2 text-amber-300 text-lg font-bold">= {lastResult.sum}</div>
            </div>
          ) : (
            <div className="text-amber-500/30 text-base">选择玩法开始下注</div>
          )}
        </div>

        {/* Result Text - fixed height below dice, mouse transparent */}
        <div className="px-6 pb-2 h-[100px] relative z-[2] pointer-events-none">
          {lastResult && !isRolling && lastResult.win && winTier && (
            <WinText key={`wt-${resultKey}`} tier={winTier} netGain={lastResult.netGain}
              randomBonus={lastResult.randomBonus} bonusText={lastResult.bonusText} comboBonus={lastResult.comboBonus} comboBonusAmount={lastResult.comboBonusAmount} />
          )}
          {lastResult && !isRolling && !lastResult.win && (
            <LoseText key={`lt-${resultKey}`} netGain={lastResult.netGain} betAmount={lastResult.betAmount} specialEvent={lastResult.specialEvent} randomPenalty={lastResult.randomPenalty} penaltyText={lastResult.penaltyText} />
          )}
        </div>

        {/* Particle Effects - absolute over entire panel, highest z-index */}
        {lastResult && !isRolling && lastResult.win && winTier && (
          <WinParticles key={`wp-${resultKey}`} tier={winTier} />
        )}
        {lastResult && !isRolling && !lastResult.win && lastResult.betAmount >= 500 && (
          <LoseParticles key={`lp-${resultKey}`} />
        )}

        {/* Buttons */}
        <div className="px-5 pb-3 pt-1 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {BET_OPTIONS.slice(0, 4).map((opt) => (
              <button key={opt.key} onClick={() => handleBet(opt.key)} disabled={isRolling || !canAfford}
                className={`py-2.5 rounded-xl font-bold transition-all text-white shadow-lg active:scale-95 disabled:bg-stone-700/50 disabled:text-stone-500 disabled:shadow-none ${opt.color} ${opt.hover} border ${opt.border}`}>
                <div className="text-lg">{opt.label}</div><div className="text-xs opacity-50">{opt.desc}</div>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BET_OPTIONS.slice(4).map((opt) => (
              <button key={opt.key} onClick={() => handleBet(opt.key)} disabled={isRolling || !canAfford}
                className={`py-2.5 rounded-xl font-bold transition-all text-white shadow-lg active:scale-95 disabled:bg-stone-700/50 disabled:text-stone-500 disabled:shadow-none ${opt.color} ${opt.hover} border ${opt.border}`}>
                <div className="text-base">{opt.label}</div><div className="text-xs opacity-60">{opt.desc} · {opt.odds}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-2 text-center text-amber-500/30 text-xs border-t border-amber-800/20 rounded-b-2xl">
          {money < baseBet ? "银两不足，即将关闭..." : "点击 ? 查看详细规则 · ESC 关闭"}
        </div>

        {showRules && <RulesPanel onClose={() => setShowRules(false)} />}
      </div>

      <style>{`
        /* ===== Dice ===== */
        .dice-roll { display: inline-block; animation: dice-shake 0.12s infinite alternate; }
        @keyframes dice-shake { 0% { transform: rotate(-12deg) scale(1.05); } 100% { transform: rotate(12deg) scale(1.05); } }
        .dice-pop { animation: dice-in 0.3s ease-out both; }
        @keyframes dice-in { 0% { transform: scale(0) rotate(180deg); opacity: 0; } 60% { transform: scale(1.15) rotate(-6deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }

        /* ===== Shake ===== */
        .shake-hard { animation: shake-h 0.8s ease-out; }
        @keyframes shake-h { 0%,100%{transform:translate(0)} 5%{transform:translate(-12px,-8px)} 10%{transform:translate(12px,6px)} 15%{transform:translate(-10px,8px)} 20%{transform:translate(10px,-6px)} 30%{transform:translate(-8px,6px)} 40%{transform:translate(8px,-4px)} 50%{transform:translate(-6px,4px)} 60%{transform:translate(6px,-3px)} 70%{transform:translate(-4px,3px)} 80%{transform:translate(3px,-2px)} 90%{transform:translate(-2px,1px)} }
        .shake-medium { animation: shake-m 0.5s ease-out; }
        @keyframes shake-m { 0%,100%{transform:translate(0)} 15%{transform:translate(-6px,-4px)} 30%{transform:translate(6px,3px)} 45%{transform:translate(-5px,3px)} 60%{transform:translate(4px,-2px)} 75%{transform:translate(-3px,2px)} 90%{transform:translate(2px,-1px)} }
        .shake-light { animation: shake-lt 0.35s ease-out; }
        @keyframes shake-lt { 0%,100%{transform:translate(0)} 25%{transform:translate(-3px,-2px)} 50%{transform:translate(3px,2px)} 75%{transform:translate(-2px,1px)} }
        .shake-loss { animation: shake-ls 0.4s ease-out; }
        @keyframes shake-ls { 0%,100%{transform:translate(0)} 25%{transform:translate(-4px,0)} 50%{transform:translate(4px,0)} 75%{transform:translate(-2px,0)} }

        /* ===== Screen Flash ===== */
        .flash-gold { animation: flash-g 0.5s ease-out; }
        @keyframes flash-g { 0%{box-shadow:inset 0 0 150px rgba(255,215,0,0.6),inset 0 0 300px rgba(255,165,0,0.2)} 50%{box-shadow:inset 0 0 80px rgba(255,215,0,0.3)} 100%{box-shadow:inset 0 0 0 transparent} }
        .flash-gold-bright { animation: flash-gb 0.6s ease-out; }
        @keyframes flash-gb { 0%{box-shadow:inset 0 0 200px rgba(255,215,0,0.8),inset 0 0 400px rgba(255,100,0,0.3)} 30%{box-shadow:inset 0 0 150px rgba(255,215,0,0.5)} 60%{box-shadow:inset 0 0 60px rgba(255,215,0,0.2)} 100%{box-shadow:inset 0 0 0 transparent} }
        .flash-white { animation: flash-w 0.8s ease-out; }
        @keyframes flash-w { 0%{box-shadow:inset 0 0 300px rgba(255,255,255,0.8),inset 0 0 500px rgba(255,215,0,0.4)} 20%{box-shadow:inset 0 0 200px rgba(255,215,0,0.6)} 50%{box-shadow:inset 0 0 100px rgba(255,165,0,0.3)} 100%{box-shadow:inset 0 0 0 transparent} }

        /* ===== FX Layers ===== */
        .fx-layer { position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:50; }
        .fx-layer-fixed { position:fixed; inset:0; overflow:hidden; pointer-events:none; z-index:49; }
        .win-particles { pointer-events:none !important; }

        /* Confetti */
        .confetti { position:absolute; opacity:0; animation: confetti-fly var(--dur,1.5s) ease-out forwards; }
        @keyframes confetti-fly {
          0% { transform:translate(0,0) rotate(0) scale(1); opacity:1; }
          25% { transform:translate(calc(var(--cx)*0.4), calc(var(--cy)*0.4)) rotate(calc(var(--rot)*0.3)) scale(1.1); opacity:1; }
          100% { transform:translate(calc(var(--cx) + var(--w)*40px), calc(var(--cy) + 250px)) rotate(var(--rot)) scale(0.2); opacity:0; }
        }

        /* Stars */
        .star { position:absolute; opacity:0; animation: star-fly 0.8s ease-out forwards; }
        @keyframes star-fly {
          0% { transform:translate(0,0) scale(0); opacity:1; }
          30% { transform:translate(calc(var(--sx)*0.5), calc(var(--sy)*0.5)) scale(1.5); opacity:1; }
          100% { transform:translate(var(--sx), var(--sy)) scale(0); opacity:0; }
        }

        /* Rings */
        .ring { position:absolute; left:50%; top:50%; width:20px; height:20px; border-radius:50%; border:4px solid; transform:translate(-50%,-50%); opacity:0; animation: ring-expand 1.2s ease-out forwards; }
        @keyframes ring-expand { 0%{width:20px;height:20px;opacity:1;transform:translate(-50%,-50%)} 100%{width:700px;height:700px;opacity:0;transform:translate(-50%,-50%)} }

        /* Coins */
        .coin { position:absolute; top:-20px; background:radial-gradient(circle at 35% 35%,#ffd700,#b8860b); border-radius:50%; border:1px solid #daa520; box-shadow:0 0 8px rgba(255,215,0,0.6); animation:coin-drop linear forwards; }
        @keyframes coin-drop { 0%{transform:translateY(0) rotateX(0);opacity:1} 80%{opacity:1} 100%{transform:translateY(110vh) rotateX(1800deg);opacity:0} }

        /* ===== Win Text ===== */
        .win-text-wrap { text-align:center; animation:win-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:80px; }
        .win-label { font-weight:900; letter-spacing:0.15em; text-shadow:0 2px 10px rgba(0,0,0,0.6); }
        .win-subtitle { font-weight:600; margin-top:2px; text-shadow:0 1px 6px rgba(0,0,0,0.5); }
        .win-amount { font-weight:900; margin-top:4px; text-shadow:0 2px 10px rgba(0,0,0,0.5); }

        @keyframes win-pop { 0%{transform:scale(0) rotate(-10deg);opacity:0} 60%{transform:scale(1.15) rotate(3deg)} 100%{transform:scale(1) rotate(0);opacity:1} }

        .tier-small .win-label { display:none; }
        .tier-small .win-amount { font-size:26px; color:#34d399; animation:pulse 1s ease-in-out infinite alternate; }

        .tier-medium .win-label { font-size:22px; color:#fbbf24; animation:glow 0.8s ease-in-out infinite alternate; }
        .tier-medium .win-amount { font-size:28px; color:#34d399; animation:pulse 0.8s ease-in-out infinite alternate; }

        .tier-big .win-label { font-size:28px; color:#f59e0b; animation:glow 0.5s ease-in-out infinite alternate; }
        .tier-big .win-amount { font-size:36px; color:#6ee7b7; animation:pulse 0.6s ease-in-out infinite alternate; text-shadow:0 0 20px rgba(110,231,183,0.5); }

        .tier-huge .win-label { font-size:34px; color:#fbbf24; animation:glow 0.35s ease-in-out infinite alternate, bounce 0.8s ease-in-out infinite; }
        .tier-huge .win-amount { font-size:44px; color:#6ee7b7; animation:pulse 0.4s ease-in-out infinite alternate; text-shadow:0 0 30px rgba(110,231,183,0.6); }
        .tier-huge .win-subtitle { font-size:16px; color:#fcd34d; }

        .tier-mega .win-label { font-size:42px; color:#ffd700; animation:glow 0.25s ease-in-out infinite alternate, bounce 0.5s ease-in-out infinite; }
        .tier-mega .win-amount { font-size:54px; background:linear-gradient(90deg,#ffd700,#ff6b35,#ffd700); background-size:200%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:shimmer 1s linear infinite; filter:drop-shadow(0 0 15px rgba(255,215,0,0.6)); }
        .tier-mega .win-subtitle { font-size:18px; color:#fcd34d; animation:glow 0.4s ease-in-out infinite alternate; }

        .tier-legendary .win-label { font-size:52px; color:#ffd700; animation:glow 0.15s ease-in-out infinite alternate, bounce 0.35s ease-in-out infinite; text-shadow:0 0 50px rgba(255,215,0,1), 0 0 100px rgba(255,165,0,0.6); }
        .tier-legendary .win-amount { font-size:64px; background:linear-gradient(90deg,#ffd700,#ff1744,#ff6b35,#ffd700,#00e676,#ffd700); background-size:400%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; animation:shimmer 0.6s linear infinite; filter:drop-shadow(0 0 20px rgba(255,215,0,0.8)); }
        .tier-legendary .win-subtitle { font-size:20px; color:#ffd700; animation:glow 0.2s ease-in-out infinite alternate; }

        @keyframes glow { 0%{text-shadow:0 0 10px rgba(255,215,0,0.5),0 2px 10px rgba(0,0,0,0.5)} 100%{text-shadow:0 0 30px rgba(255,215,0,1),0 0 60px rgba(255,165,0,0.5),0 2px 10px rgba(0,0,0,0.5)} }
        @keyframes pulse { 0%{transform:scale(1)} 100%{transform:scale(1.08)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes shimmer { 0%{background-position:400% center} 100%{background-position:-400% center} }

        /* Win bonus/combo lines */
        .win-bonus { font-size:15px; font-weight:700; color:#fbbf24; margin-top:6px; animation:bonus-pop 0.4s ease-out both 0.3s; text-shadow:0 0 10px rgba(255,215,0,0.5); }
        .win-combo { font-size:14px; font-weight:700; color:#34d399; margin-top:4px; animation:bonus-pop 0.4s ease-out both 0.5s; text-shadow:0 0 10px rgba(52,211,153,0.5); }
        @keyframes bonus-pop { 0%{transform:scale(0) translateY(10px);opacity:0} 60%{transform:scale(1.2) translateY(-2px)} 100%{transform:scale(1) translateY(0);opacity:1} }

        /* ===== Lose ===== */
        .lose-text-wrap { text-align:center; animation:lose-in 0.35s ease-out both; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60px; }
        .lose-amount { font-size:24px; font-weight:900; color:#ef4444; text-shadow:0 2px 10px rgba(0,0,0,0.5); }
        .lose-hint { font-size:13px; color:#f87171; margin-top:4px; }
        .lose-event { font-size:15px; font-weight:700; color:#fbbf24; margin-top:6px; animation:bonus-pop 0.4s ease-out both 0.2s; text-shadow:0 0 10px rgba(255,215,0,0.5); }
        .lose-penalty { font-size:14px; font-weight:700; color:#ef4444; margin-top:4px; animation:bonus-pop 0.4s ease-out both 0.2s; text-shadow:0 0 8px rgba(239,68,68,0.5); }
        .lose-big .lose-amount { font-size:30px; animation:shake-l 0.5s ease-out; }
        .lose-shard { position:absolute; width:3px; height:20px; background:#ef4444; border-radius:1px; opacity:0; animation:shard-fly 0.6s ease-out forwards; pointer-events:none; }
        @keyframes lose-in { 0%{transform:scale(1.3);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes shard-fly { 0%{transform:translate(0,0) rotate(0);opacity:1} 100%{transform:translate(var(--sx),var(--sy)) rotate(180deg);opacity:0} }
      `}</style>
    </div>
  );
}

export function GamblePanel(props: GamblePanelProps) {
  return createPortal(<GamblePanelInner {...props} />, document.body);
}
