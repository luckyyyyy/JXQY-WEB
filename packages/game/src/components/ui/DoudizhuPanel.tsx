/**
 * DoudizhuPanel — 斗地主小游戏 UI
 *
 * 牌面参照实体扑克（左上角点数+花色，右下角大花色），全新布局、发牌动画与特效。
 */

import { analyzeCombo, findValidPlays } from "@miu2d/engine/gui/doudizhu/card-engine";
import type { Card, ComboType, Move } from "@miu2d/engine/gui/doudizhu/card-engine";
import type { GameState } from "@miu2d/engine/gui/doudizhu/doudizhu-manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  LuArrowDownWideNarrow,
  LuArrowUpNarrowWide,
  LuClock,
  LuCoins,
  LuCrown,
  LuLightbulb,
  LuUser,
  LuX,
} from "react-icons/lu";

export type { Card, Move, ComboType, GameState };

export interface DoudizhuPanelProps {
  isVisible: boolean;
  money: number;
  betAmount: number;
  state: GameState;
  onBid: (bid: boolean) => void;
  onPlay: (cards: Card[]) => boolean;
  onPass: () => boolean;
  onClose: () => void;
  onRestart?: () => void;
  /** 玩家点击「开始」后发牌 */
  onStart?: () => void;
  /** 进入斗地主时压低/暂停游戏背景音乐 */
  onSuppressMusic?: () => void;
  /** 退出斗地主时恢复游戏背景音乐 */
  onRestoreMusic?: () => void;
}

// ============= Audio =============

const AUDIO_BASE = "/doudizhu";
function audioUrl(name: string): string {
  return `${AUDIO_BASE}/${encodeURIComponent(name)}.mp3`;
}
const BGM_INTRO = "开场";
const BGM_NORMAL = "正常1";
const BGM_TENSE = "正常2";
const SFX_BOMB = "使用炸弹后";
const SFX_WIN = "赢了";
const SFX_LOSE = "输了";

// ============= UI tokens（统一现代化风格） =============

const BTN_PRIMARY =
  "rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-900 font-semibold transition-colors disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed";
const BTN_GHOST =
  "rounded-xl bg-white/10 hover:bg-white/20 text-white/90 font-medium ring-1 ring-white/15 transition-colors disabled:bg-white/5 disabled:text-white/25 disabled:ring-0 disabled:cursor-not-allowed";
const BTN_DANGER =
  "rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-semibold transition-colors";
const BTN_ACCENT =
  "rounded-xl bg-sky-500/90 hover:bg-sky-400 text-white font-medium transition-colors";
const PILL_MULT =
  "rounded-full bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30 font-semibold";

// ============= Card constants =============

const RANK_TEXT: Record<number, string> = {
  3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A", 15: "2",
};

const RED = "#e23b3b";
const BLACK = "#1f2933";

function isRed(card: Card): boolean {
  if (card.suit === "joker") return card.rank === 17;
  return card.suit === "♥" || card.suit === "♦";
}
function cardColor(card: Card): string {
  return isRed(card) ? RED : BLACK;
}

const COMBO_NAME: Record<string, string> = {
  single: "单张", pair: "对子", triple: "三条", triple_one: "三带一", triple_pair: "三带二",
  straight: "顺子", straight_pair: "连对", plane: "飞机", plane_single: "飞机带单",
  plane_pair: "飞机带对", four_two: "四带二", bomb: "炸弹", rocket: "火箭",
};
function comboName(type: ComboType): string {
  return type ? COMBO_NAME[type] ?? "" : "";
}

const BEAT_TEXTS = [
  "压制！", "压死你！", "看招！", "拿下！", "碾压！", "谁与争锋！", "大力出奇迹！", "稳！",
  "吃我一招！", "降维打击！", "不讲武德！", "秒了！", "绝杀！", "你也配？", "回去吧！",
  "一锤定音！", "无人能挡！", "横扫千军！", "天下无敌！", "小场面！", "拿来吧你！",
  "高端局！", "这就破防了？", "豪取一城！", "压你没商量！", "技高一筹！",
];

const FX_PALETTE = ["#ffd24a", "#ff8a3d", "#ff5252", "#ffe08a", "#ff6b9d", "#5cffb0", "#5cc8ff"];

// ============= SVG cards =============

function FaceCard({ card, w, h }: { card: Card; w: number; h: number }) {
  const color = cardColor(card);
  const r = w * 0.11;

  if (card.suit === "joker") {
    const letters = ["J", "O", "K", "E", "R"];
    const label = card.rank === 17 ? "大王" : "小王";
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
        <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx={r} ry={r} fill="#fff" stroke="#d4d9e0" strokeWidth="1" />
        {letters.map((ch, i) => (
          <text key={ch} x={w * 0.34} y={h * (0.2 + i * 0.135)} fontSize={h * 0.11} fontWeight={900}
            fill={color} fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="middle">{ch}</text>
        ))}
        <text x={w * 0.68} y={h * 0.86} fontSize={h * 0.13} fontWeight={700}
          fill={color} fontFamily="'PingFang SC','Microsoft YaHei',sans-serif" textAnchor="middle" dominantBaseline="middle">{label}</text>
      </svg>
    );
  }

  const suit = card.suit as string;
  const rank = RANK_TEXT[card.rank] ?? "";
  const isTen = card.rank === 10;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx={r} ry={r} fill="#fff" stroke="#d4d9e0" strokeWidth="1" />
      <text x={w * 0.27} y={h * 0.27} fontSize={h * (isTen ? 0.26 : 0.32)} fontWeight={800}
        fill={color} fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="middle"
        style={{ letterSpacing: isTen ? "-1px" : "0" }}>{rank}</text>
      <text x={w * 0.27} y={h * 0.5} fontSize={h * 0.2} fontWeight={700}
        fill={color} fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="middle">{suit}</text>
      <text x={w * 0.66} y={h * 0.78} fontSize={h * 0.42}
        fill={color} fontFamily="Arial, sans-serif" textAnchor="middle" dominantBaseline="middle">{suit}</text>
    </svg>
  );
}

function CardBack({ w, h }: { w: number; h: number }) {
  const r = w * 0.11;
  const id = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f6bd6" />
          <stop offset="1" stopColor="#1b3f86" />
        </linearGradient>
        <pattern id={`p${id}`} width={w * 0.22} height={w * 0.22} patternUnits="userSpaceOnUse">
          <path d={`M ${w * 0.11} 0 L ${w * 0.22} ${w * 0.11} L ${w * 0.11} ${w * 0.22} L 0 ${w * 0.11} Z`}
            fill="none" stroke="#5b8ae0" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx={r} ry={r} fill={`url(#g${id})`} stroke="#142d61" strokeWidth="1" />
      <rect x={w * 0.12} y={h * 0.08} width={w * 0.76} height={h * 0.84} rx={r * 0.6} fill={`url(#p${id})`} opacity="0.5" />
      <circle cx={w / 2} cy={h / 2} r={w * 0.2} fill="#dfa94a" opacity="0.92" />
      <circle cx={w / 2} cy={h / 2} r={w * 0.13} fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.7" />
    </svg>
  );
}

// ============= Pile (played cards) =============

function CardPile({ cards, size = 0.7 }: { cards: Card[]; size?: number }) {
  const w = 44 * size + 22;
  const h = w * 1.42;
  const overlap = w * 0.55;
  return (
    <div className="flex" style={{ height: h }}>
      {cards.map((c, i) => (
        <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -overlap, filter: "drop-shadow(0 2px 4px rgba(0,0,0,.35))" }}>
          <FaceCard card={c} w={w} h={h} />
        </div>
      ))}
    </div>
  );
}

// ============= Avatar seat =============

function Seat({
  name, isLandlord, active, count, side, played, passed, thinking,
}: {
  name: string; isLandlord: boolean; active: boolean; count: number;
  side: "left" | "right"; played: Card[]; passed: boolean; thinking: boolean;
}) {
  return (
    <div className={`flex flex-col ${side === "left" ? "items-start" : "items-end"} gap-1`}>
      <div className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
        <div className={`relative w-14 h-14 rounded-full grid place-items-center
          ${isLandlord ? "bg-amber-500/90" : "bg-sky-500/85"}
          ${active ? "ring-[3px] ring-amber-300" : "ring-1 ring-white/15"}`}>
          <LuUser className="w-7 h-7 text-white" />
          {isLandlord && (
            <div className="absolute -top-1.5 -right-1 w-6 h-6 rounded-full bg-rose-500 grid place-items-center ring-2 ring-black/20">
              <LuCrown className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </div>
        <div className={`flex flex-col ${side === "right" ? "items-end" : "items-start"}`}>
          <span className="text-[13px] font-medium text-white/90 leading-tight">{name}</span>
          <span className={`mt-0.5 text-[11px] px-2 py-0.5 rounded-full ${isLandlord ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/25" : "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20"}`}>
            {isLandlord ? "地主" : "农民"}
          </span>
        </div>
      </div>

      {/* remaining card-back stack */}
      <div className={`flex items-center gap-1 ${side === "right" ? "flex-row-reverse" : ""}`}>
        <div className="relative" style={{ width: 30, height: 38 }}>
          <CardBack w={26} h={36} />
          <div className="absolute -bottom-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-black/70 text-white text-[12px] font-semibold grid place-items-center ring-1 ring-white/20">
            {count}
          </div>
        </div>
        {active && thinking && (
          <span className="flex items-center gap-1 text-amber-200/80 text-[11px] animate-pulse">
            <LuClock className="w-3 h-3" /> 思考中
          </span>
        )}
      </div>

      {/* played / pass bubble */}
      <div className="min-h-[64px] mt-1">
        {passed ? (
          <span className="inline-block px-3 py-1 rounded-lg bg-black/50 text-white/80 text-sm font-medium ring-1 ring-white/10 ddz-pop">不出</span>
        ) : played.length > 0 ? (
          <div key={played.map((c) => c.id).join(",")} className="ddz-slam"><CardPile cards={played} size={0.62} /></div>
        ) : null}
      </div>
    </div>
  );
}

// ============= Effects overlay =============

function EffectBanner({ kind, label, color: colorOverride, intensity = 1, variant = 0 }: { kind: "bomb" | "rocket" | "combo" | "beat"; label: string; color?: string; intensity?: number; variant?: number }) {
  const baseColor = kind === "rocket" ? "#ff3b3b" : kind === "bomb" ? "#ffb22e" : kind === "beat" ? "#ffd24a" : "#4fd6ff";
  const color = colorOverride ?? baseColor;
  const anim = kind === "beat" ? (variant === 1 ? "ddz-beat-b" : "ddz-beat") : "ddz-banner";
  const sizeCls = kind === "rocket" ? "text-6xl" : intensity >= 2 ? "text-6xl" : intensity >= 1 ? "text-5xl" : "text-4xl";
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center pointer-events-none">
      <div className={`${anim} flex items-center gap-3 px-7 py-2.5 rounded-2xl`}
        style={{ background: "rgba(10,14,12,.78)", border: `1px solid ${color}80`, boxShadow: `0 8px 40px ${color}80` }}>
        <span className={`${sizeCls} font-bold tracking-wide`} style={{ color, textShadow: `0 0 18px ${color}` }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function Burst({ color, count = 14 }: { color: string; count?: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 70 + Math.random() * 100;
        return { id: i, dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, size: 5 + Math.random() * 6, delay: Math.random() * 0.06 };
      }),
    [count],
  );
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none z-[62]">
      <div className="relative">
        {parts.map((p) => (
          <span
            key={p.id}
            className="absolute ddz-spark rounded-full"
            style={
              {
                left: 0, top: 0, width: p.size, height: p.size, background: color,
                boxShadow: `0 0 8px ${color}`,
                "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, animationDelay: `${p.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

function Shockwave({ color, size = 120 }: { color: string; size?: number }) {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none z-[61]">
      <div className="ddz-wave rounded-full" style={{ width: size, height: size, border: `4px solid ${color}`, boxShadow: `0 0 24px ${color}` }} />
    </div>
  );
}

function LightRays() {
  return (
    <div className="absolute inset-0 grid place-items-center pointer-events-none overflow-hidden">
      <div className="ddz-rays" style={{
        width: 1300, height: 1300, opacity: 0.5,
        background: "repeating-conic-gradient(rgba(255,221,130,.07) 0deg 5deg, transparent 5deg 22deg)",
      }} />
    </div>
  );
}

function CoinRain({ count = 30 }: { count?: number }) {
  const coins = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i, left: Math.random() * 100, delay: Math.random() * 1.4, dur: 1.6 + Math.random() * 1.8, size: 14 + Math.random() * 12,
      })),
    [count],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {coins.map((c) => (
        <div
          key={c.id}
          className="absolute ddz-coin grid place-items-center rounded-full font-black"
          style={{
            left: `${c.left}%`, top: -30, width: c.size, height: c.size,
            background: "radial-gradient(circle at 35% 30%, #fff3c4, #e0a92e 70%)",
            boxShadow: "0 0 8px rgba(255,200,60,.6)", color: "#7a5410", fontSize: c.size * 0.5,
            animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`,
          }}
        >
          ¥
        </div>
      ))}
    </div>
  );
}

function Confetti() {
  const items = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 1.5,
      dur: 1.8 + Math.random() * 1.8, size: 5 + Math.random() * 7,
      color: ["#ffd700", "#ff6b35", "#ff1744", "#00e676", "#2979ff", "#d500f9"][i % 6],
      rot: Math.random() * 360,
    })),
    [],
  );
  return (
    <div className="absolute inset-0 z-[70] pointer-events-none overflow-hidden">
      {items.map((p) => (
        <span key={p.id} className="absolute ddz-confetti" style={{
          left: `${p.left}%`, top: -16, width: p.size, height: p.size * 1.6,
          background: p.color, borderRadius: 2, transform: `rotate(${p.rot}deg)`,
          animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
        }} />
      ))}
    </div>
  );
}

// ============= Deal animation =============

const SEATS = [
  { x: 470, y: 540 }, // you
  { x: 830, y: 150 }, // 下家 right
  { x: 110, y: 150 }, // 上家 left
] as const;
const DEAL_CENTER = { x: 470, y: 300 };

function DealOverlay() {
  const cards = useMemo(() => Array.from({ length: 51 }, (_, i) => {
    const seat = SEATS[i % 3];
    return { id: i, tx: seat.x - DEAL_CENTER.x, ty: seat.y - DEAL_CENTER.y, delay: i * 22 };
  }), []);
  return (
    <div className="absolute inset-0 z-[55] pointer-events-none">
      {cards.map((c) => (
        <div key={c.id} className="absolute ddz-deal" style={{
          left: DEAL_CENTER.x - 13, top: DEAL_CENTER.y - 18,
          "--tx": `${c.tx}px`, "--ty": `${c.ty}px`,
          animationDelay: `${c.delay}ms`,
        } as CSSProperties}>
          <CardBack w={26} h={36} />
        </div>
      ))}
      <div className="absolute left-1/2 -translate-x-1/2 z-[56]" style={{ top: 270 }}>
        <span className="text-yellow-200 text-lg font-bold tracking-widest ddz-pop">发牌中…</span>
      </div>
    </div>
  );
}

// ============= Styles =============

const CSS = `
.ddz-pop { animation: ddzPop .22s cubic-bezier(.2,1.3,.5,1); }
@keyframes ddzPop { from { transform: scale(.7); opacity: 0 } to { transform: scale(1); opacity: 1 } }
.ddz-banner { animation: ddzBanner 1.1s ease-out forwards; }
@keyframes ddzBanner { 0% { transform: scale(.4); opacity: 0 } 25% { transform: scale(1.15); opacity: 1 } 70% { transform: scale(1); opacity: 1 } 100% { transform: scale(1.05); opacity: 0 } }
.ddz-shake { animation: ddzShake .5s ease-in-out; }
@keyframes ddzShake { 0%,100% { transform: translate(0) } 20%,60% { transform: translate(-5px,3px) } 40%,80% { transform: translate(5px,-3px) } }
.ddz-deal { animation: ddzDeal .42s ease-out forwards; opacity: 0; }
@keyframes ddzDeal { 0% { transform: translate(0,0) scale(.6); opacity: 0 } 15% { opacity: 1 } 100% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 1 } }
.ddz-confetti { animation-name: ddzFall; animation-timing-function: ease-in; animation-fill-mode: forwards; }
@keyframes ddzFall { to { transform: translateY(640px) rotate(540deg); opacity: .15 } }
.ddz-hand-card { transition: transform .12s ease; }
.ddz-win { animation: ddzPop .5s cubic-bezier(.2,1.3,.5,1); }
.ddz-result { animation: ddzResult .4s cubic-bezier(.2,1.1,.4,1); }
@keyframes ddzResult { from { transform: translateY(28px) scale(.92); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
.ddz-slam { animation: ddzSlam .34s cubic-bezier(.2,1.4,.4,1); }
@keyframes ddzSlam { 0% { transform: scale(1.6) translateY(-26px) rotate(-4deg); opacity: 0 } 55% { transform: scale(.92) translateY(4px); opacity: 1 } 100% { transform: scale(1) translateY(0); opacity: 1 } }
.ddz-shake-soft { animation: ddzShakeSoft .36s ease-in-out; }
@keyframes ddzShakeSoft { 0%,100% { transform: translate(0) } 20% { transform: translate(-7px,4px) } 40% { transform: translate(7px,-4px) } 60% { transform: translate(-5px,3px) } 80% { transform: translate(4px,-2px) } }
.ddz-shake-hard { animation: ddzShakeHard .58s cubic-bezier(.36,.07,.19,.97); }
@keyframes ddzShakeHard { 0%,100% { transform: translate(0) rotate(0) } 8% { transform: translate(-20px,11px) rotate(-2.2deg) } 20% { transform: translate(22px,-13px) rotate(2.2deg) } 32% { transform: translate(-18px,9px) rotate(-1.6deg) } 46% { transform: translate(17px,-8px) rotate(1.4deg) } 60% { transform: translate(-12px,6px) rotate(-1deg) } 74% { transform: translate(9px,-4px) rotate(.6deg) } 88% { transform: translate(-5px,2px) } }
.ddz-wave { animation: ddzWave .7s ease-out forwards; }
@keyframes ddzWave { 0% { transform: scale(.2); opacity: .9 } 100% { transform: scale(2.6); opacity: 0 } }
.ddz-spark { animation: ddzSpark .7s ease-out forwards; }
@keyframes ddzSpark { 0% { transform: translate(0,0) scale(1); opacity: 1 } 100% { transform: translate(var(--dx), var(--dy)) scale(.3); opacity: 0 } }
.ddz-mult { animation: ddzMult 1s cubic-bezier(.2,1.3,.4,1) forwards; }
@keyframes ddzMult { 0% { transform: scale(.2) rotate(-12deg); opacity: 0 } 30% { transform: scale(1.35) rotate(4deg); opacity: 1 } 55% { transform: scale(1) rotate(0) } 80% { opacity: 1 } 100% { transform: scale(1.1); opacity: 0 } }
.ddz-beat { animation: ddzBeat 1s cubic-bezier(.2,1.3,.4,1) forwards; }
@keyframes ddzBeat { 0% { transform: scale(2) translateY(-30px); opacity: 0 } 22% { transform: scale(.9) translateY(6px); opacity: 1 } 40% { transform: scale(1.06) translateY(0) } 60% { transform: scale(1) } 82% { opacity: 1 } 100% { transform: scale(1.04); opacity: 0 } }
.ddz-pill-pulse { animation: ddzPillPulse .6s ease-out; }
@keyframes ddzPillPulse { 0% { transform: scale(1) } 35% { transform: scale(1.5); filter: brightness(1.6) } 100% { transform: scale(1) } }
.ddz-beat-b { animation: ddzBeatB .9s cubic-bezier(.2,1.3,.4,1) forwards; }
@keyframes ddzBeatB { 0% { transform: scale(.3) rotate(-18deg); opacity: 0 } 30% { transform: scale(1.25) rotate(6deg); opacity: 1 } 55% { transform: scale(1) rotate(0) } 82% { opacity: 1 } 100% { transform: scale(1.1) rotate(0); opacity: 0 } }
.ddz-rays { animation: ddzRays 16s linear infinite; }
@keyframes ddzRays { to { transform: rotate(360deg) } }
.ddz-wintitle { animation: ddzWinTitle 1.6s ease-in-out infinite; }
@keyframes ddzWinTitle { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 24px rgba(255,200,60,.6)) } 50% { transform: scale(1.06); filter: drop-shadow(0 0 42px rgba(255,220,90,.95)) } }
.ddz-losetitle { animation: ddzLoseTitle .6s ease-in-out; }
@keyframes ddzLoseTitle { 0%,100% { transform: translate(0) } 20%,60% { transform: translate(-7px,0) } 40%,80% { transform: translate(7px,0) } }
.ddz-coin { animation-name: ddzCoin; animation-timing-function: linear; animation-fill-mode: forwards; animation-iteration-count: infinite; }
@keyframes ddzCoin { 0% { transform: translateY(-40px) rotate(0); opacity: 0 } 12% { opacity: 1 } 100% { transform: translateY(660px) rotate(720deg); opacity: .15 } }
`;

// ============= Main =============

export function DoudizhuPanel({
  isVisible, money, betAmount, state, onBid, onPlay, onPass, onClose, onRestart,
  onStart, onSuppressMusic, onRestoreMusic,
}: DoudizhuPanelProps) {
  const { phase, players, currentPlayer, lastMove, lastMovePlayer, winner, message, playedCards, passFlags, multiplier, landlordCards, landlordIndex } = state;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [effect, setEffect] = useState<{ kind: "bomb" | "rocket" | "combo" | "beat"; label: string; color?: string; intensity?: number; variant?: number } | null>(null);
  const [dealtCount, setDealtCount] = useState(17);
  const [hasBid, setHasBid] = useState(false);
  // 手牌展示顺序：true=左大右小（降序），false=左小右大（升序）
  const [sortDesc, setSortDesc] = useState(true);
  const hintRef = useRef<{ plays: Card[][]; idx: number }>({ plays: [], idx: 0 });
  const lastEffectKey = useRef<string>("");
  const [multPunch, setMultPunch] = useState<number | null>(null);
  const prevMoveRef = useRef<{ player: number } | null>(null);
  const prevMultRef = useRef(multiplier);

  // audio
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const bgmTrackRef = useRef<string>("");
  const playTrackRef = useRef<string>(BGM_NORMAL);
  // 最新回调 / 结算信息存入 ref，避免内联函数引用变化导致音乐每帧重启
  const musicCbRef = useRef({ suppress: onSuppressMusic, restore: onRestoreMusic });
  musicCbRef.current = { suppress: onSuppressMusic, restore: onRestoreMusic };
  const finishRef = useRef({ winner, players });
  finishRef.current = { winner, players };

  const myHand = players[0]?.hand ?? [];
  const isMyTurn = currentPlayer === 0 && phase === "playing";
  const effectiveBet = betAmount || state.betAmount || 0;

  // 紧张时刻：出牌阶段有人手牌 < 3 张 → 切到「正常2」
  const tense = phase === "playing" && players.some((p) => p.cardCount > 0 && p.cardCount < 3);
  const playTrack = phase === "playing" ? (tense ? BGM_TENSE : BGM_NORMAL) : "";
  playTrackRef.current = playTrack || BGM_NORMAL;

  const playBgm = useCallback((name: string) => {
    if (bgmTrackRef.current === name) return;
    bgmTrackRef.current = name;
    let el = bgmRef.current;
    if (!el) { el = new Audio(); bgmRef.current = el; }
    el.onended = null;
    el.loop = true;
    el.volume = 0.55;
    el.src = audioUrl(name);
    el.currentTime = 0;
    el.play().catch(() => {});
  }, []);

  const stopBgm = useCallback(() => {
    bgmTrackRef.current = "";
    const el = bgmRef.current;
    if (el) { el.onended = null; el.loop = true; el.pause(); el.src = ""; }
  }, []);

  const playSfx = useCallback((name: string, volume = 0.7) => {
    let el = sfxRef.current;
    if (!el) { el = new Audio(); sfxRef.current = el; }
    el.src = audioUrl(name);
    el.volume = volume;
    el.currentTime = 0;
    el.play().catch(() => {});
  }, []);

  // 炸弹/王炸：用 BGM 通道临时覆盖背景音乐，结束后自动恢复（而非叠加）
  const playBombBgm = useCallback(() => {
    let el = bgmRef.current;
    if (!el) { el = new Audio(); bgmRef.current = el; }
    el.pause();
    el.loop = false;
    el.volume = 0.7;
    el.src = audioUrl(SFX_BOMB);
    el.currentTime = 0;
    bgmTrackRef.current = "__bomb__";
    el.onended = () => {
      const cur = bgmRef.current;
      if (!cur) return;
      cur.onended = null;
      cur.loop = true;
      cur.volume = 0.55;
      bgmTrackRef.current = "";
      playBgm(playTrackRef.current);
    };
    el.play().catch(() => {});
  }, [playBgm]);

  const handleBid = useCallback((bid: boolean) => {
    setHasBid(true);
    onBid(bid);
  }, [onBid]);

  // 拖动多选：按下决定方向（选/取消），划过的牌沿用同一动作
  const draggingRef = useRef(false);
  const dragValueRef = useRef(false);

  const setCardSelected = useCallback((id: string, value: boolean) => {
    setSelected((prev) => {
      if (value === prev.has(id)) return prev;
      const next = new Set(prev);
      if (value) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const onCardDown = useCallback((e: ReactPointerEvent, id: string) => {
    if (!isMyTurn) return;
    // 释放隐式指针捕获，使拖动经过其它牌时能触发 pointerenter
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    draggingRef.current = true;
    dragValueRef.current = !selected.has(id);
    setCardSelected(id, dragValueRef.current);
    hintRef.current.idx = 0;
  }, [isMyTurn, selected, setCardSelected]);

  const onCardEnter = useCallback((id: string) => {
    if (!draggingRef.current || !isMyTurn) return;
    setCardSelected(id, dragValueRef.current);
  }, [isMyTurn, setCardSelected]);

  useEffect(() => {
    const up = () => { draggingRef.current = false; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const selectedCards = useMemo(() => myHand.filter((c) => selected.has(c.id)), [myHand, selected]);
  const selectedCombo = useMemo(() => (selectedCards.length ? analyzeCombo(selectedCards) : null), [selectedCards]);
  const canPlaySelected = useMemo(() => {
    if (!selectedCombo) return false;
    if (lastMove && lastMovePlayer !== 0) {
      return findValidPlays(myHand, lastMove).some(
        (p) => p.length === selectedCards.length && p.every((c) => selected.has(c.id)),
      ) || isExactBeat(lastMove, selectedCombo);
    }
    return true;
  }, [selectedCombo, lastMove, lastMovePlayer, myHand, selectedCards, selected]);

  const hasPlayable = useMemo(() => {
    if (!isMyTurn) return false;
    return findValidPlays(myHand, lastMovePlayer === 0 ? null : lastMove).some((p) => p.length > 0);
  }, [isMyTurn, myHand, lastMove, lastMovePlayer]);

  const handlePlay = useCallback(() => {
    if (!isMyTurn || selectedCards.length === 0) return;
    if (onPlay(selectedCards)) setSelected(new Set());
  }, [isMyTurn, selectedCards, onPlay]);

  const handlePass = useCallback(() => {
    if (!isMyTurn) return;
    onPass();
    setSelected(new Set());
  }, [isMyTurn, onPass]);

  const handleStart = useCallback(() => {
    // 用户手势内启动音频，规避浏览器自动播放限制
    const el = bgmRef.current;
    if (el) el.play().catch(() => {});
    else playBgm(BGM_INTRO);
    onStart?.();
  }, [onStart, playBgm]);

  const handleHint = useCallback(() => {
    if (!isMyTurn) return;
    const plays = findValidPlays(myHand, lastMovePlayer === 0 ? null : lastMove)
      .filter((p) => p.length > 0)
      .sort((a, b) => a.length - b.length || Math.max(...a.map((c) => c.rank)) - Math.max(...b.map((c) => c.rank)));
    if (plays.length === 0) { setSelected(new Set()); return; }
    const h = hintRef.current;
    if (h.plays.length !== plays.length) { h.plays = plays; h.idx = 0; }
    const pick = plays[h.idx % plays.length];
    h.idx++;
    setSelected(new Set(pick.map((c) => c.id)));
  }, [isMyTurn, myHand, lastMove, lastMovePlayer]);

  // effect triggers
  useEffect(() => {
    if (!lastMove) { prevMoveRef.current = null; return; }
    const key = `${lastMovePlayer}-${lastMove.type}-${lastMove.cards.map((c) => c.id).join(",")}`;
    if (key === lastEffectKey.current) return;
    const prevMove = prevMoveRef.current;
    lastEffectKey.current = key;
    prevMoveRef.current = { player: lastMovePlayer };

    type Fx = { kind: "bomb" | "rocket" | "combo" | "beat"; label: string; color?: string; intensity?: number; variant?: number };
    let fx: Fx | null = null;
    const randColor = () => FX_PALETTE[Math.floor(Math.random() * FX_PALETTE.length)];
    if (lastMove.type === "rocket") { fx = { kind: "rocket", label: "王炸！×20" }; playBombBgm(); }
    else if (lastMove.type === "bomb") { fx = { kind: "bomb", label: "炸弹！×4" }; playBombBgm(); }
    else if (prevMove && prevMove.player !== lastMovePlayer) {
      const byMe = lastMovePlayer === 0;
      const seatName = lastMovePlayer === 1 ? "下家" : lastMovePlayer === 2 ? "上家" : "我方";
      const r = Math.random();
      const intensity = byMe ? (r < 0.2 ? 2 : r < 0.6 ? 1 : 0) : 0;
      fx = {
        kind: "beat",
        label: byMe ? BEAT_TEXTS[Math.floor(Math.random() * BEAT_TEXTS.length)] : `${seatName}压制！`,
        color: byMe ? randColor() : "#9fb4c8",
        intensity,
        variant: Math.floor(Math.random() * 2),
      };
    } else if (lastMove.type?.startsWith("plane") || lastMove.type?.startsWith("straight")) {
      fx = { kind: "combo", label: comboName(lastMove.type), color: randColor(), intensity: Math.random() < 0.4 ? 1 : 0 };
    }
    if (!fx) return;
    setEffect(fx);
    const t = setTimeout(() => setEffect(null), 1100);
    return () => clearTimeout(t);
  }, [lastMove, lastMovePlayer, playBombBgm]);

  // 倍数翻涨冲击
  useEffect(() => {
    if (multiplier > prevMultRef.current && multiplier > 1) {
      setMultPunch(multiplier);
      prevMultRef.current = multiplier;
      const t = setTimeout(() => setMultPunch(null), 1000);
      return () => clearTimeout(t);
    }
    prevMultRef.current = multiplier;
  }, [multiplier]);

  useEffect(() => {
    if (phase === "dealing" || phase === "bidding") setSelected(new Set());
    if (phase !== "bidding") setHasBid(false);
  }, [phase]);

  // 发牌进度：dealing 阶段把手牌从 0 逐张铺到 17，与飞牌动画同步
  useEffect(() => {
    if (phase === "dealing") {
      setDealtCount(0);
      let n = 0;
      const timer = setInterval(() => {
        n += 1;
        setDealtCount(n);
        if (n >= 17) clearInterval(timer);
      }, 75);
      return () => clearInterval(timer);
    }
    setDealtCount(17);
  }, [phase]);

  // 进入/退出：压低游戏 BGM，退出恢复，并清理斗地主音频（仅挂载/卸载各执行一次）
  useEffect(() => {
    musicCbRef.current.suppress?.();
    return () => {
      stopBgm();
      const sfx = sfxRef.current;
      if (sfx) { sfx.pause(); sfx.src = ""; }
      musicCbRef.current.restore?.();
    };
  }, [stopBgm]);

  // 背景音乐：仅在阶段或「正常1/正常2」切换时更换，不随每次出牌重启
  useEffect(() => {
    if (phase === "dealing" || phase === "ready" || phase === "bidding") {
      playBgm(BGM_INTRO);
    } else if (phase === "playing") {
      playBgm(playTrack || BGM_NORMAL);
    } else if (phase === "finished") {
      stopBgm();
      const { winner: w, players: ps } = finishRef.current;
      const playerWon = w === 0 || (w >= 0 && ps[w]?.role === ps[0]?.role);
      playSfx(playerWon ? SFX_WIN : SFX_LOSE, 0.85);
    }
  }, [phase, playTrack, playBgm, stopBgm, playSfx]);

  if (!isVisible) return null;

  const seatRight = players[1];
  const seatLeft = players[2];
  const me = players[0];
  const shakeClass =
    effect?.kind === "bomb" || effect?.kind === "rocket"
      ? "ddz-shake-hard"
      : effect?.kind === "beat"
        ? ((effect.intensity ?? 1) >= 1 ? "ddz-shake-hard" : "ddz-shake-soft")
        : effect?.kind === "combo"
          ? "ddz-shake-soft"
          : "";
  const dealing = phase === "dealing";
  const orderedHand = sortDesc ? [...myHand].reverse() : myHand;
  const handToShow = dealing ? orderedHand.slice(0, dealtCount) : orderedHand;

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="fixed inset-0 z-[99999] grid place-items-center bg-black/60 backdrop-blur-sm">
        <div className={`relative w-[960px] max-w-[97vw] aspect-[960/600] max-h-[94vh] rounded-3xl overflow-hidden shadow-2xl select-none ring-1 ring-white/10 ${shakeClass}`}
          style={{ background: "radial-gradient(120% 90% at 50% 0%, #2a7d52 0%, #14613d 45%, #0c3f29 100%)", border: "1px solid rgba(255,255,255,.08)" }}>

          {/* felt vignette */}
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,.55)" }} />

          {/* header */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-2.5 z-30">
            <div className="flex items-center gap-2.5">
              <span className="text-base font-semibold text-white tracking-wide">斗地主</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/70">底注 {effectiveBet.toLocaleString()}</span>
              {multiplier > 1 && (
                <span key={multiplier} className={`text-xs px-2.5 py-0.5 ${multPunch ? "ddz-pill-pulse" : "ddz-pop"} ${PILL_MULT}`}>×{multiplier} 倍</span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={onClose}
                className="p-1.5 rounded-lg text-white/60 hover:text-red-300 hover:bg-black/30 transition-colors" aria-label="关闭">
                <LuX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* opponents */}
          <div className="absolute left-5 top-14 z-20">
            {seatLeft && (
              <Seat name="上家" isLandlord={seatLeft.isLandlord} active={currentPlayer === 2 && phase === "playing"}
                count={dealing ? dealtCount : seatLeft.cardCount} side="left" played={playedCards[2] ?? []} passed={!!passFlags?.[2]}
                thinking={currentPlayer === 2 && phase === "playing"} />
            )}
          </div>
          <div className="absolute right-5 top-14 z-20">
            {seatRight && (
              <Seat name="下家" isLandlord={seatRight.isLandlord} active={currentPlayer === 1 && phase === "playing"}
                count={dealing ? dealtCount : seatRight.cardCount} side="right" played={playedCards[1] ?? []} passed={!!passFlags?.[1]}
                thinking={currentPlayer === 1 && phase === "playing"} />
            )}
          </div>

          {/* 底牌 — 确认地主后显示在上方 */}
          {(phase === "playing" || phase === "finished") && landlordIndex >= 0 && landlordCards.length === 3 && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 ddz-pop">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/25">底牌</span>
              <div className="flex gap-1">
                {landlordCards.map((c) => (
                  <div key={c.id} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,.4))" }}>
                    <FaceCard card={c} w={34} h={48} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* my played pile / pass — 紧贴手牌上方 */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[176px] z-20 grid place-items-center min-h-[70px]">
            {phase === "playing" && passFlags?.[0] ? (
              <span className="px-3 py-1 rounded-lg bg-black/50 text-white/80 text-sm font-medium ring-1 ring-white/10 ddz-pop">不出</span>
            ) : (playedCards[0]?.length ?? 0) > 0 ? (
              <div key={playedCards[0].map((c) => c.id).join(",")} className="ddz-slam"><CardPile cards={playedCards[0]} size={0.82} /></div>
            ) : null}
          </div>

          {/* dealing animation */}
          {phase === "dealing" && <DealOverlay />}

          {/* effects */}
          {effect && <EffectBanner kind={effect.kind} label={effect.label} color={effect.color} intensity={effect.intensity} variant={effect.variant} />}
          {(effect?.kind === "rocket" || effect?.kind === "bomb" || effect?.kind === "beat") && (() => {
            const c = effect.color ?? (effect.kind === "rocket" ? "#ff5252" : effect.kind === "bomb" ? "#ffb22e" : "#ffd24a");
            const inten = effect.kind === "rocket" ? 3 : effect.kind === "bomb" ? 2 : (effect.intensity ?? 1);
            const cnt = inten >= 3 ? 26 : inten >= 2 ? 18 : inten >= 1 ? 13 : 9;
            return (
              <>
                <Shockwave color={c} size={inten >= 2 ? 160 : 120} />
                <Burst color={c} count={cnt} />
              </>
            );
          })()}
          {multPunch && (
            <div className="absolute inset-0 z-[78] grid place-items-center pointer-events-none">
              <div className="ddz-mult flex flex-col items-center">
                <span className="text-7xl font-black" style={{ color: "#ffd24a", textShadow: "0 0 32px rgba(255,200,60,.85), 0 4px 14px rgba(0,0,0,.6)" }}>×{multPunch}</span>
                <span className="mt-1 text-xl font-bold tracking-[0.3em] text-amber-200">倍 数 翻 涨</span>
              </div>
            </div>
          )}

          {/* ready / start screen — 直接居中，无外框 */}
          {phase === "ready" && (
            <div className="absolute inset-0 z-[75] grid place-items-center pointer-events-none">
              <div className="ddz-result flex flex-col items-center gap-5 pointer-events-auto">
                <span className="text-4xl font-bold tracking-[0.28em] text-white" style={{ textShadow: "0 2px 18px rgba(0,0,0,.5)" }}>斗 地 主</span>
                <div className="flex flex-wrap justify-center gap-2 text-xs font-medium">
                  <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80">底注 {effectiveBet.toLocaleString()}</span>
                  <span className="px-2.5 py-1 rounded-full bg-rose-400/15 text-rose-200 ring-1 ring-rose-300/20">王炸 ×20</span>
                  <span className="px-2.5 py-1 rounded-full bg-orange-400/15 text-orange-200 ring-1 ring-orange-300/20">炸弹 ×4</span>
                  <span className="px-2.5 py-1 rounded-full bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/20">超级牌型 ×2</span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20">春天 ×4</span>
                </div>
                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={handleStart} className={`px-12 py-2.5 text-base ${BTN_PRIMARY}`}>开始游戏</button>
                  <button type="button" onClick={onClose} className={`px-7 py-2.5 text-base ${BTN_GHOST}`}>退出</button>
                </div>
              </div>
            </div>
          )}

          {/* win overlay — 直接居中，无外框 */}
          {phase === "finished" && (() => {
            const won = winner === 0 || (winner >= 0 && players[winner]?.role === players[0]?.role);
            return (
              <div className="absolute inset-0 z-[80] grid place-items-center pointer-events-none overflow-hidden">
                {won && (
                  <>
                    <LightRays />
                    <Shockwave color="#ffe08a" size={180} />
                    <Burst color="#ffe08a" count={30} />
                    <CoinRain />
                    <Confetti />
                  </>
                )}
                <div className="ddz-result flex flex-col items-center gap-4 pointer-events-auto z-[2]">
                  <span className={`text-7xl font-black tracking-[0.16em] ${won ? "ddz-wintitle" : "ddz-losetitle"}`}
                    style={{
                      color: won ? "#ffd24a" : "#fb7185",
                      textShadow: won
                        ? "0 0 40px rgba(255,200,60,.7), 0 4px 16px rgba(0,0,0,.55)"
                        : "0 4px 30px rgba(251,113,133,.4)",
                    }}>
                    {won ? "胜 利" : "惜 败"}
                  </span>
                  {multiplier > 1 && (
                    <span className={`px-4 py-1 text-base ddz-pop ${PILL_MULT}`}>×{multiplier} 倍</span>
                  )}
                  <span className="text-white/80 text-sm text-center max-w-[420px]">{message}</span>
                  <div className="flex gap-3 mt-2">
                    {onRestart && (
                      <button type="button" onClick={onRestart} className={`px-9 py-2.5 text-base ${BTN_PRIMARY}`}>
                        再来一局
                      </button>
                    )}
                    <button type="button" onClick={onClose} className={`px-8 py-2.5 text-base ${BTN_GHOST}`}>
                      退出
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* action bar */}
          <div className="absolute bottom-[118px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
            {phase === "bidding" && currentPlayer === 0 && !hasBid && (
              <>
                <button type="button" onClick={() => handleBid(true)} className={`px-8 py-2 text-base ${BTN_DANGER}`}>
                  叫地主
                </button>
                <button type="button" onClick={() => handleBid(false)} className={`px-8 py-2 text-base ${BTN_GHOST}`}>
                  不叫
                </button>
              </>
            )}
            {isMyTurn && (
              <>
                <button type="button" onClick={handleHint} disabled={!hasPlayable}
                  className={`px-4 py-2 text-sm flex items-center gap-1.5 ${BTN_ACCENT} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <LuLightbulb className="w-4 h-4" /> {hasPlayable ? "提示" : "无牌可出"}
                </button>
                <button type="button" onClick={handlePlay} disabled={selectedCards.length === 0 || !canPlaySelected}
                  className={`px-7 py-2 text-base ${BTN_PRIMARY}`}>
                  出牌{selectedCombo && canPlaySelected ? `（${comboName(selectedCombo.type)}）` : ""}
                </button>
                <button type="button" onClick={handlePass} disabled={!lastMove || lastMovePlayer === 0}
                  className={`px-6 py-2 text-base ${BTN_GHOST}`}>
                  不出
                </button>
              </>
            )}
          </div>

          {/* my role tag — 左下角，避开出牌按钮 */}
          <div className="absolute left-5 bottom-[124px] z-30">
            <span className={`text-xs px-3 py-0.5 rounded-full font-medium ring-1
              ${me?.isLandlord ? "bg-amber-400/15 text-amber-200 ring-amber-300/25" : "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20"}`}>
              {me?.isLandlord ? "地主" : "农民"} · {myHand.length} 张
            </span>
          </div>

          {/* player money — 玩家侧 */}
          <div className="absolute left-5 bottom-[92px] z-30">
            <span className="flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-black/40 text-amber-200 font-semibold ring-1 ring-amber-300/20">
              <LuCoins className="w-4 h-4" /> {money.toLocaleString()}
            </span>
          </div>

          {/* hand sort toggle */}
          <div className="absolute right-5 bottom-[92px] z-30">
            <button type="button" onClick={() => setSortDesc((v) => !v)}
              className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/80 ring-1 ring-white/15 transition-colors">
              {sortDesc ? <LuArrowDownWideNarrow className="w-3.5 h-3.5" /> : <LuArrowUpNarrowWide className="w-3.5 h-3.5" />}
              {sortDesc ? "大→小" : "小→大"}
            </button>
          </div>

          {/* my hand */}
          <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center">
            <div className="flex items-end px-4" style={{ height: 96, touchAction: "none" }}>
              {handToShow.map((c, i) => {
                const sel = selected.has(c.id);
                return (
                  <button type="button" key={c.id}
                    onPointerDown={(e) => onCardDown(e, c.id)}
                    onPointerEnter={() => onCardEnter(c.id)}
                    className="ddz-hand-card ddz-pop relative" disabled={!isMyTurn}
                    style={{
                      marginLeft: i === 0 ? 0 : -26,
                      transform: sel ? "translateY(-18px)" : "translateY(0)",
                      zIndex: i, cursor: isMyTurn ? "pointer" : "default",
                      filter: sel ? "drop-shadow(0 6px 10px rgba(245,180,40,.55))" : "drop-shadow(0 2px 4px rgba(0,0,0,.35))",
                    }}>
                    <FaceCard card={c} w={58} h={82} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** 选牌是否能压上家（用于按钮可用态的快速判断） */
function isExactBeat(last: Move, combo: Move): boolean {
  if (combo.type === "rocket") return true;
  if (combo.type === "bomb" && last.type !== "bomb" && last.type !== "rocket") return true;
  if (last.type === combo.type && last.cards.length === combo.cards.length) return combo.rank > last.rank;
  if (last.type === "bomb" && combo.type === "bomb") return combo.rank > last.rank;
  return false;
}
