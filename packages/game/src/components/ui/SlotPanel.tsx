/**
 * SlotPanel - 老虎机小游戏 UI（5×5 转轴）
 *
 * 8 种符号、8 条赔付线、3/4/5 连阶梯赔率、百搭替代、免费旋转、大奖系统
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineQuestionMarkCircle, HiOutlineXMark } from "react-icons/hi2";

// ============= Types =============

export type SlotSymbol = "coin" | "envelope" | "koi" | "dragon" | "lucky7" | "bar" | "wild" | "scatter";

export interface WinLine {
  lineIndex: number;
  symbol: SlotSymbol;
  count: number;
  payout: number;
  positions: [number, number][];
}

export interface SlotSpinResult {
  reels: SlotSymbol[][];
  winLines: WinLine[];
  totalWin: number;
  betAmount: number;
  freeSpinTriggered: boolean;
  jackpot: boolean;
  isFreeSpin: boolean;
}

export interface SlotPanelProps {
  isVisible: boolean;
  money: number;
  betAmount: number;
  onSpin: (multiplier: number) => SlotSpinResult;
  onClose: () => void;
}

// ============= Config =============

const SYMBOL_CONFIG: Record<SlotSymbol, { emoji: string; label: string; color: string; bgColor: string; borderColor: string }> = {
  coin:     { emoji: "🪙", label: "铜钱", color: "text-yellow-400",   bgColor: "bg-yellow-900/30",  borderColor: "border-yellow-600/30" },
  envelope: { emoji: "🧧", label: "红包", color: "text-red-400",     bgColor: "bg-red-900/30",     borderColor: "border-red-600/30" },
  koi:      { emoji: "🐟", label: "锦鲤", color: "text-orange-400",  bgColor: "bg-orange-900/30",  borderColor: "border-orange-600/30" },
  dragon:   { emoji: "🐉", label: "金龙", color: "text-amber-300",   bgColor: "bg-amber-900/40",   borderColor: "border-amber-500/40" },
  lucky7:   { emoji: "7️⃣",  label: "幸运7", color: "text-yellow-200",  bgColor: "bg-yellow-900/50",  borderColor: "border-yellow-400/50" },
  bar:      { emoji: "🎰", label: "BAR",  color: "text-purple-400",  bgColor: "bg-purple-900/30",  borderColor: "border-purple-600/30" },
  wild:     { emoji: "⭐", label: "百搭", color: "text-cyan-300",    bgColor: "bg-cyan-900/40",    borderColor: "border-cyan-400/40" },
  scatter:  { emoji: "💎", label: "散宝", color: "text-emerald-300", bgColor: "bg-emerald-900/40", borderColor: "border-emerald-400/40" },
};

const ALL_SYMBOLS: SlotSymbol[] = ["coin", "envelope", "koi", "dragon", "lucky7", "bar", "wild", "scatter"];

const PAYOUT_TABLE: { symbol: SlotSymbol; label: string; three: string; four: string; five: string }[] = [
  { symbol: "lucky7",   label: "幸运7", three: "10x", four: "25x",  five: "80x" },
  { symbol: "dragon",   label: "金龙",  three: "8x",  four: "18x",  five: "50x" },
  { symbol: "koi",      label: "锦鲤",  three: "5x",  four: "12x",  five: "30x" },
  { symbol: "bar",      label: "BAR",   three: "4x",  four: "10x",  five: "25x" },
  { symbol: "envelope", label: "红包",  three: "2x",  four: "5x",   five: "12x" },
  { symbol: "coin",     label: "铜钱",  three: "1x",  four: "3x",   five: "8x" },
  { symbol: "wild",     label: "百搭",  three: "替代", four: "替代",  five: "替代" },
  { symbol: "scatter",  label: "散宝",  three: "免费", four: "免费",  five: "免费" },
];

const MULTIPLIERS = [1, 2, 3, 5, 10, 20, 50, 100, 1000];
const PAYLINE_COLORS = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#f9ca24", "#a55eea", "#ff9f43", "#00d2d3", "#fc5c65"];
const PAYLINE_NAMES = ["第2行", "中心行", "第4行", "中列", "↘对角", "↗对角", "V形", "倒V"];

// ============= Particles =============

function rand(a: number, b: number) { return a + Math.random() * (b - a); }

const CONFETTI_COLORS = ["#ffd700", "#ff6b35", "#ff1744", "#00e676", "#2979ff", "#d500f9", "#ff9100", "#00e5ff", "#fff"];

function Confetti({ count, spread, colors }: { count: number; spread: number; colors: string[] }) {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, color: colors[i % colors.length],
    x: rand(-spread, spread), y: rand(-300, -40), rotate: rand(-900, 900),
    scale: rand(0.5, 1.5), delay: rand(0, 0.4), duration: rand(1, 2.5),
    shape: Math.random() > 0.4 ? "rect" : "circle" as const,
  })), [count, spread, colors]);

  return (
    <div className="fx-layer">
      {particles.map((p) => (
        <div key={p.id} className="confetti" style={{
          left: "50%", top: "50%", backgroundColor: p.color,
          width: `${8 * p.scale}px`, height: p.shape === "rect" ? `${18 * p.scale}px` : `${8 * p.scale}px`,
          borderRadius: p.shape === "circle" ? "50%" : "2px",
          ["--cx" as string]: `${p.x}px`, ["--cy" as string]: `${p.y}px`,
          ["--rot" as string]: `${p.rotate}deg`,
          animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
        }} />
      ))}
    </div>
  );
}

function GoldRain({ count = 25 }: { count?: number }) {
  const coins = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, left: `${rand(3, 97)}%`, delay: rand(0, 2), duration: rand(1.5, 3), size: rand(8, 18),
  })), [count]);

  return (
    <div className="fx-layer-fixed">
      {coins.map((c) => (
        <div key={c.id} className="coin-drop" style={{
          left: c.left, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`,
          width: `${c.size}px`, height: `${c.size}px`,
        }} />
      ))}
    </div>
  );
}

function StarBurst({ count = 12 }: { count?: number }) {
  const stars = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, angle: (i / count) * 360, distance: rand(80, 200), delay: rand(0, 0.3),
    size: rand(4, 10), color: ["#ffd700", "#fff", "#ffe082", "#ff6b35"][i % 4],
  })), [count]);

  return (
    <div className="fx-layer">
      {stars.map((s) => (
        <div key={s.id} className="star-fly" style={{
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

function RingBurst({ color = "#ffd700", delay = 0 }: { color?: string; delay?: number }) {
  return (
    <div className="fx-layer" style={{ animationDelay: `${delay}s` }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="ring-expand" style={{
          borderColor: color, animationDelay: `${delay + i * 0.15}s`,
          boxShadow: `0 0 20px ${color}40`,
        }} />
      ))}
    </div>
  );
}

// ============= Win Particles =============

type WinTier = "small" | "medium" | "big" | "huge" | "mega" | "legendary";

function getWinTier(totalWin: number): WinTier {
  if (totalWin >= 200000) return "legendary";
  if (totalWin >= 20000)  return "mega";
  if (totalWin >= 2000)   return "huge";
  if (totalWin >= 400)    return "big";
  if (totalWin >= 100)    return "medium";
  return "small";
}

const TIER_META: Record<WinTier, { label: string; flash: string }> = {
  small:     { label: "赢了！",     flash: "tier-flash-gold" },
  medium:    { label: "赢了！",     flash: "tier-flash-gold" },
  big:       { label: "大赢！",     flash: "tier-flash-bright" },
  huge:      { label: "超级大赢！", flash: "tier-flash-bright" },
  mega:      { label: "巨额奖金！", flash: "tier-flash-white" },
  legendary: { label: "传 奇 ！",   flash: "tier-flash-white" },
};

const TIER_RANGES: Record<WinTier, { confetti: [number,number]; stars: [number,number]; rings: [number,number]; coins: [number,number] }> = {
  small:     { confetti: [15, 30],  stars: [5, 10],   rings: [1, 1], coins: [0, 0] },
  medium:    { confetti: [30, 50],  stars: [10, 18],  rings: [1, 2], coins: [0, 0] },
  big:       { confetti: [50, 80],  stars: [15, 25],  rings: [2, 3], coins: [8, 15] },
  huge:      { confetti: [80, 120], stars: [25, 40],  rings: [2, 4], coins: [15, 30] },
  mega:      { confetti: [120, 180],stars: [40, 60],  rings: [3, 5], coins: [30, 50] },
  legendary: { confetti: [180, 250],stars: [60, 90],  rings: [4, 6], coins: [50, 80] },
};

function WinParticles({ tier }: { tier: WinTier }) {
  const [alive, setAlive] = useState(true);
  const meta = TIER_META[tier];
  const r = TIER_RANGES[tier];

  const config = useMemo(() => {
    const ringCount = Math.floor(rand(r.rings[0], r.rings[1]));
    const shuffled = [...CONFETTI_COLORS].sort(() => Math.random() - 0.5);
    return {
      confettiCount: Math.floor(rand(r.confetti[0], r.confetti[1])),
      starCount: Math.floor(rand(r.stars[0], r.stars[1])),
      coinCount: Math.floor(rand(r.coins[0], r.coins[1])),
      ringColors: shuffled.slice(0, ringCount),
      confettiColors: [...CONFETTI_COLORS].sort(() => Math.random() - 0.5).slice(0, Math.floor(rand(4, 8))),
    };
  }, []);

  useEffect(() => {
    const dur = { small: 4000, medium: 5000, big: 7000, huge: 8000, mega: 10000, legendary: 12000 }[tier];
    const t = setTimeout(() => setAlive(false), dur);
    return () => clearTimeout(t);
  }, [tier]);

  if (!alive) return null;

  return (
    <div className={`win-particles absolute inset-0 pointer-events-none z-[100] overflow-visible ${meta.flash}`}>
      <Confetti count={config.confettiCount} spread={180 + config.confettiCount} colors={config.confettiColors} />
      <StarBurst count={config.starCount} />
      {config.ringColors.map((color, i) => (
        <RingBurst key={`${color}-${i}`} color={color} delay={i * 0.15} />
      ))}
      {config.coinCount > 0 && <GoldRain count={config.coinCount} />}
    </div>
  );
}

// ============= CSS =============

const SLOT_CSS = `
  .fx-layer { position: absolute; left: 50%; top: 50%; pointer-events: none; z-index: 100; }
  .fx-layer-fixed { position: absolute; inset: 0; pointer-events: none; z-index: 100; overflow: hidden; }
  .confetti { position: absolute; animation: confetti-fly 2s ease-out forwards; }
  @keyframes confetti-fly {
    0% { transform: translate(0,0) rotate(0deg); opacity: 1; }
    100% { transform: translate(var(--cx), var(--cy)) rotate(var(--rot)); opacity: 0; }
  }
  .coin-drop {
    position: absolute; top: -20px; border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #ffd700, #b8860b);
    box-shadow: inset 0 -2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(255,215,0,0.5);
    animation: coin-fall 2s ease-in forwards;
  }
  @keyframes coin-fall {
    0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg); opacity: 0.3; }
  }
  .star-fly { position: absolute; animation: star-out 1.5s ease-out forwards; }
  @keyframes star-out {
    0% { transform: translate(0,0) scale(1); opacity: 1; }
    100% { transform: translate(var(--sx), var(--sy)) scale(0); opacity: 0; }
  }
  .ring-expand {
    position: absolute; left: 50%; top: 50%;
    width: 10px; height: 10px; border-radius: 50%;
    border: 3px solid #ffd700; transform: translate(-50%,-50%);
    animation: ring-grow 1.2s ease-out forwards;
  }
  @keyframes ring-grow {
    0% { width: 10px; height: 10px; opacity: 1; }
    100% { width: 250px; height: 250px; opacity: 0; }
  }
  .reel-cell-spinning { animation: cell-flicker 0.08s linear infinite; }
  @keyframes cell-flicker {
    0% { opacity: 0.7; transform: scale(0.95); }
    50% { opacity: 1; transform: scale(1.02); }
    100% { opacity: 0.7; transform: scale(0.95); }
  }
  .reel-cell-snap { animation: cell-snap 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  @keyframes cell-snap {
    0% { transform: scale(0.8) translateY(-6px); opacity: 0.5; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  .reel-cell-win { animation: cell-win-pulse 0.5s ease-in-out 3; }
  @keyframes cell-win-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(255,215,0,0); }
    50% { transform: scale(1.1); box-shadow: 0 0 16px rgba(255,215,0,0.6); }
  }
  .payline-glow { animation: pl-glow 0.8s ease-in-out infinite; }
  @keyframes pl-glow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
  .panel-shake { animation: p-shake 0.5s ease-in-out; }
  @keyframes p-shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  .tier-flash-gold::before { content:''; position:absolute; inset:0; background:rgba(255,215,0,0.35); animation: tfg 0.8s ease-out forwards; pointer-events:none; z-index:50; border-radius:16px; }
  @keyframes tfg { 0%{opacity:0} 15%{opacity:1} 100%{opacity:0} }
  .tier-flash-bright::before { content:''; position:absolute; inset:0; background:rgba(255,215,0,0.55); animation: tfb 1s ease-out forwards; pointer-events:none; z-index:50; border-radius:16px; }
  @keyframes tfb { 0%{opacity:0} 10%{opacity:1} 100%{opacity:0} }
  .tier-flash-white::before { content:''; position:absolute; inset:0; background:rgba(255,255,255,0.6); animation: tfw 1.2s ease-out forwards; pointer-events:none; z-index:50; border-radius:16px; }
  @keyframes tfw { 0%{opacity:0} 8%{opacity:1} 100%{opacity:0} }
  .fs-badge { animation: fsb 1s ease-in-out infinite; }
  @keyframes fsb { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
  .win-pop { animation: wp 0.4s ease-out forwards; }
  @keyframes wp { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.1);opacity:1} 100%{transform:scale(1);opacity:1} }
  .jackpot-flash { animation: jf 2s ease-out forwards; }
  @keyframes jf { 0%{opacity:0} 20%{opacity:0.7} 40%{opacity:0} 60%{opacity:0.5} 80%{opacity:0} 100%{opacity:0} }
  .jackpot-txt { animation: jt 0.8s ease-out forwards; }
  @keyframes jt { 0%{transform:scale(0.3) rotate(-10deg);opacity:0} 50%{transform:scale(1.2) rotate(5deg);opacity:1} 100%{transform:scale(1) rotate(0deg);opacity:1} }
`;

// ============= Reel Cell =============

function ReelCell({ symbol, spinning, isWin }: {
  symbol: SlotSymbol; spinning: boolean; isWin: boolean;
}) {
  const [displaySym, setDisplaySym] = useState(symbol);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (spinning) {
      intervalRef.current = setInterval(() => {
        setDisplaySym(ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]);
      }, 80);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplaySym(symbol);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spinning, symbol]);

  const cfg = SYMBOL_CONFIG[displaySym];

  return (
    <div className={`
      relative w-[72px] h-[64px] rounded-lg border-2 flex flex-col items-center justify-center
      ${cfg.bgColor} ${cfg.borderColor}
      ${spinning ? 'reel-cell-spinning' : ''}
      ${isWin && !spinning ? 'reel-cell-win' : ''}
    `}>
      <span className="text-2xl leading-none select-none">{cfg.emoji}</span>
      <span className={`text-[9px] mt-0.5 font-medium ${cfg.color} select-none`}>{cfg.label}</span>
      {isWin && !spinning && (
        <div className="absolute inset-0 rounded-lg border-2 border-yellow-400/60 payline-glow" />
      )}
    </div>
  );
}

// ============= Main =============

export function SlotPanel({ isVisible, money, betAmount, onSpin, onClose }: SlotPanelProps) {
  const [showRules, setShowRules] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SlotSpinResult | null>(null);
  const [reelDisplay, setReelDisplay] = useState<SlotSymbol[][]>(() =>
    Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]))
  );
  const [winLines, setWinLines] = useState<WinLine[]>([]);
  const [freeSpins, setFreeSpins] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const [winTier, setWinTier] = useState<WinTier | null>(null);
  const [showJackpot, setShowJackpot] = useState(false);
  const [shakePanel, setShakePanel] = useState(false);
  const [stoppedCols, setStoppedCols] = useState(5);
  const [multiplier, setMultiplier] = useState(1);

  const totalBet = betAmount * multiplier;
  const canSpin = !spinning && (freeSpins > 0 || money >= totalBet);

  const doSpin = useCallback(() => {
    if (spinning) return;
    if (freeSpins <= 0 && money < totalBet) return;

    setSpinning(true);
    setWinLines([]);
    setShowParticles(false);
    setWinTier(null);
    setShowJackpot(false);
    setStoppedCols(0);
    setResult(null);

    const spinResult = onSpin(multiplier);
    if (!spinResult) {
      setSpinning(false);
      setStoppedCols(5);
      return;
    }

    const finalReels = spinResult.reels;
    const colDelays = [600, 900, 1200, 1500, 1800];

    for (let col = 0; col < 5; col++) {
      setTimeout(() => {
        setReelDisplay(prev => {
          const next = prev.map(row => [...row]);
          for (let row = 0; row < 5; row++) {
            next[row][col] = finalReels[row][col];
          }
          return next;
        });
        setStoppedCols(col + 1);
      }, colDelays[col]);
    }

    setTimeout(() => {
      setSpinning(false);
      setResult(spinResult);
      setWinLines(spinResult.winLines);

      if (spinResult.totalWin > 0) {
        const tier = getWinTier(spinResult.totalWin);
        setWinTier(tier);
        setShowParticles(true);
        setShakePanel(true);
        setTimeout(() => setShakePanel(false), 500);
      }

      if (spinResult.jackpot) {
        setShowJackpot(true);
        setTimeout(() => setShowJackpot(false), 3000);
      }

      if (spinResult.freeSpinTriggered) {
        setFreeSpins(10);
      }
    }, 2000);
  }, [spinning, money, totalBet, multiplier, onSpin, freeSpins]);

  // Auto-spin for free spins
  useEffect(() => {
    if (!spinning && freeSpins > 0 && !showJackpot && result) {
      const timer = setTimeout(() => {
        setFreeSpins(prev => Math.max(0, prev - 1));
        doSpin();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [spinning, freeSpins, showJackpot, result, doSpin]);

  // Winning positions set
  const winPositions = useMemo(() => {
    const set = new Set<string>();
    for (const wl of winLines) {
      for (const [r, c] of wl.positions) {
        set.add(`${r}-${c}`);
      }
    }
    return set;
  }, [winLines]);

  if (!isVisible) return null;

  // Cell size: 72px wide, 8px gap × 4 = 32 → total width = 72×5 + 32 = 392
  const CELL_W = 72, GAP = 8, COLS = 5, ROWS = 5;
  const GRID_W = CELL_W * COLS + GAP * (COLS - 1);
  const CELL_H = 64;
  const GRID_H = CELL_H * ROWS + GAP * (ROWS - 1);

  return createPortal(
    <>
      <style>{SLOT_CSS}</style>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={`relative w-[720px] max-w-[95vw] rounded-2xl border border-amber-700/40 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 shadow-2xl shadow-amber-900/30 ${shakePanel ? 'panel-shake' : ''}`}>

          {showParticles && winTier && <WinParticles tier={winTier} />}

          {showJackpot && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center pointer-events-none">
              <div className="jackpot-flash absolute inset-0 bg-yellow-500/30 rounded-2xl" />
              <div className="jackpot-txt text-center">
                <div className="text-5xl font-black text-yellow-300" style={{ textShadow: "0 0 30px rgba(255,215,0,0.8)" }}>
                  🎰 大奖 🎰
                </div>
                <div className="text-2xl font-bold text-yellow-200 mt-1">+{result?.totalWin} 两</div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-amber-800/30">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎰</span>
              <h2 className="text-lg font-bold text-amber-200 tracking-wider">老虎机</h2>
              {freeSpins > 0 && (
                <span className="fs-badge ml-2 px-2.5 py-0.5 rounded-full bg-emerald-600/80 text-white text-xs font-bold">
                  🎁 免费 ×{freeSpins}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowRules(v => !v)}
                className="p-1.5 rounded-lg text-amber-400/60 hover:text-amber-300 hover:bg-amber-900/30 transition-colors">
                <HiOutlineQuestionMarkCircle className="w-5 h-5" />
              </button>
              <button onClick={onClose}
                className="p-1.5 rounded-lg text-amber-400/60 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Money + Multiplier */}
          <div className="px-5 py-2 flex items-center justify-between bg-stone-900/50">
            <div className="text-amber-300 text-sm">银两：<span className="text-lg font-bold text-amber-100">{money.toLocaleString()}</span></div>
            <div className="flex items-center gap-2">
              <span className="text-amber-400/70 text-xs">倍数：</span>
              <div className="flex gap-1 flex-wrap justify-end">
                {MULTIPLIERS.map((m) => (
                  <button key={m} onClick={() => setMultiplier(m)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all
                      ${multiplier === m ? "bg-amber-600 text-white shadow-md" : "bg-stone-800/60 text-amber-400/70 hover:bg-stone-700/60 hover:text-amber-300"}`}>
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-5 py-0.5 text-center text-amber-500/50 text-xs bg-stone-900/30">
            本注：<span className="text-amber-300 font-semibold">{totalBet}</span> 两
            {multiplier > 1 && <span className="ml-1">（{betAmount} × {multiplier}）</span>}
          </div>

          {/* 5×5 Reel Grid */}
          <div className="px-5 py-3">
            <div className="relative mx-auto" style={{ width: GRID_W + 56 }}>
              {/* Payline indicators left */}
              <div className="absolute -left-7 flex flex-col justify-between" style={{ height: GRID_H }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: PAYLINE_COLORS[i] }}>{i + 1}</div>
                ))}
              </div>
              {/* Payline indicators right */}
              <div className="absolute -right-7 flex flex-col justify-between" style={{ height: GRID_H }}>
                {[5, 6, 7].map(i => (
                  <div key={i} className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: PAYLINE_COLORS[i] }}>{i + 1}</div>
                ))}
              </div>

              {/* 5×5 grid */}
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 25 }, (_, idx) => {
                  const row = Math.floor(idx / 5);
                  const col = idx % 5;
                  const isColSpinning = spinning && stoppedCols <= col;
                  return (
                    <ReelCell
                      key={`${row}-${col}`}
                      symbol={reelDisplay[row][col]}
                      spinning={isColSpinning}
                      isWin={winPositions.has(`${row}-${col}`)}
                    />
                  );
                })}
              </div>

              {/* Payline overlay SVG */}
              {winLines.length > 0 && !spinning && (
                <svg className="absolute inset-0 pointer-events-none z-10"
                  width={GRID_W} height={GRID_H}
                  style={{ left: 28, top: 0 }}>
                  {winLines.map(wl => {
                    const color = PAYLINE_COLORS[wl.lineIndex] || "#ffd700";
                    const cellStep = CELL_W + GAP;
                    const rowStep = CELL_H + GAP;
                    const pts = wl.positions.map(([r, c]) => ({
                      x: c * cellStep + CELL_W / 2,
                      y: r * rowStep + CELL_H / 2,
                    }));
                    return (
                      <polyline key={wl.lineIndex}
                        points={pts.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        opacity="0.7"
                        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          {/* Result area */}
          <div className="h-[52px] px-5 flex items-center justify-center overflow-hidden">
            {result && !spinning && result.totalWin > 0 && winTier && (
              <div className="text-center win-pop">
                <span className="text-yellow-300 font-bold mr-2">{TIER_META[winTier].label}</span>
                <span className="text-xl font-black text-yellow-200" style={{ textShadow: "0 0 15px rgba(255,215,0,0.5)" }}>
                  +{result.totalWin} 两
                </span>
                {result.freeSpinTriggered && <span className="text-emerald-300 ml-2 text-sm">💎 免费旋转！</span>}
                {winLines.length > 0 && (
                  <div className="text-[11px] text-amber-400/50 mt-0.5">
                    {winLines.map(wl => `${PAYLINE_NAMES[wl.lineIndex]} ${SYMBOL_CONFIG[wl.symbol].label}×${wl.count}`).join(' | ')}
                  </div>
                )}
              </div>
            )}
            {result && !spinning && result.totalWin === 0 && (
              <div className="text-stone-500 text-sm">未中奖 · 再试试手气</div>
            )}
            {spinning && (
              <div className="text-amber-400/50 text-sm animate-pulse">转动中...</div>
            )}
          </div>

          {/* Spin button */}
          <div className="px-5 pb-3">
            <button
              onClick={doSpin}
              disabled={!canSpin}
              className={`
                w-full py-3 rounded-xl text-lg font-bold transition-all duration-200
                ${canSpin
                  ? 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:via-yellow-400 hover:to-amber-500 text-stone-900 shadow-lg shadow-amber-900/40 active:scale-[0.98]'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                }
              `}
            >
              {spinning ? '🎰 转动中...' :
               freeSpins > 0 ? `🎁 免费旋转 (${freeSpins}次)` :
               `🎰 旋转 (${totalBet} 两)`}
            </button>
          </div>

          {/* Payout hint */}
          <div className="px-5 pb-3">
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-amber-400/40">
              {PAYOUT_TABLE.map(p => (
                <span key={p.symbol}>
                  {SYMBOL_CONFIG[p.symbol].emoji}{p.three}/{p.four}/{p.five}
                </span>
              ))}
            </div>
          </div>

          {/* Rules overlay */}
          {showRules && (
            <div className="absolute inset-0 z-[300] bg-stone-950/95 rounded-2xl overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-amber-200">🎰 老虎机规则</h3>
                <button onClick={() => setShowRules(false)}
                  className="p-1 rounded-lg text-amber-400/60 hover:text-amber-300 hover:bg-amber-900/30">
                  <HiOutlineXMark className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2.5 text-sm text-amber-300/80">
                <p><b className="text-amber-200">基本玩法：</b>5×5 转轴，8 条赔付线。从左到右连续匹配 3/4/5 个相同符号即中奖。</p>
                <div>
                  <b className="text-amber-200">赔付表（3/4/5连）：</b>
                  <div className="mt-1 space-y-0.5">
                    {PAYOUT_TABLE.map(p => (
                      <div key={p.symbol} className="flex items-center gap-2">
                        <span>{SYMBOL_CONFIG[p.symbol].emoji}</span>
                        <span className="text-amber-200 w-10">{p.label}</span>
                        <span className="text-amber-400/60">{p.three} / {p.four} / {p.five}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p><b className="text-amber-200">⭐ 百搭：</b>替代任意符号（散落宝除外）。</p>
                <p><b className="text-amber-200">💎 免费旋转：</b>3个散落宝触发10次免费旋转，奖金×2。</p>
                <p><b className="text-amber-200">🎰 大奖：</b>中心行5个幸运7 = 200倍！</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
