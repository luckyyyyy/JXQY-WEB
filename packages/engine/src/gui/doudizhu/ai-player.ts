/**
 * 斗地主 AI
 *
 * 核心思想：手牌拆解 + 一步前瞻
 * - decomposeCount：把手牌拆成尽量少的「手数」（炸弹/火箭/飞机/顺子/连对/三带/对/单）。
 * - 领出：在所有可出牌中，选拆解后剩余手数最少的一手，倾向于不动炸弹和 2/王。
 * - 跟牌：选能压且最划算（手数不增）的一手；农民不压队友。
 */

import type { Card, Move } from "./card-engine";
import { analyzeCombo, countByRank, findValidPlays, sortCards } from "./card-engine";

// ============= Card Tracking =============

export class CardTracker {
  private played = new Map<number, number>(); // rank -> count played

  reset(): void {
    this.played.clear();
  }

  onCardsPlayed(cards: Card[]): void {
    for (const c of cards) {
      this.played.set(c.rank, (this.played.get(c.rank) ?? 0) + 1);
    }
  }

  /** 某个 rank 还剩多少张没出（不含自己手里的 myCount） */
  remaining(rank: number, myCount: number): number {
    const total = rank === 16 || rank === 17 ? 1 : 4;
    return total - (this.played.get(rank) ?? 0) - myCount;
  }

  /** 判断某张牌是否是场上最大的（外面没人能压） */
  isBiggest(rank: number, myCount: number): boolean {
    if (rank === 17) return true;
    for (let r = rank + 1; r <= 17; r++) {
      if (this.remaining(r, 0) > 0) return false;
    }
    return true;
  }
}

// ============= Types =============

export type PlayerRole = "landlord" | "farmer";
export type AIDifficulty = "easy" | "medium" | "hard";

export interface AIContext {
  hand: Card[];
  role: PlayerRole;
  lastMove: Move | null;
  lastMovePlayer: number; // 上一手牌的玩家 index
  landlordIndex: number;
  myIndex: number;
  tracker: CardTracker;
  playerCardCounts: number[]; // 每个玩家剩余手牌数
}

const BIG_RANKS = new Set<number>([15, 16, 17]); // 2、小王、大王

// ============= Hand Decomposition =============

/** 把手牌拆成尽量少的「手数」，作为出牌价值评估 */
export function decomposeCount(hand: Card[]): number {
  const c = new Map<number, number>();
  for (const card of hand) c.set(card.rank, (c.get(card.rank) ?? 0) + 1);
  let groups = 0;

  // 火箭
  if ((c.get(16) ?? 0) > 0 && (c.get(17) ?? 0) > 0) {
    c.set(16, 0);
    c.set(17, 0);
    groups++;
  }
  // 炸弹
  for (const [r, n] of c) if (n === 4) { c.set(r, 0); groups++; }

  // 顺子（count>=1, len>=5）
  for (;;) {
    const run = longestRun(c, 1, 5);
    if (!run) break;
    for (const r of run) c.set(r, (c.get(r) ?? 0) - 1);
    groups++;
  }
  // 连对（count>=2, len>=3）
  for (;;) {
    const run = longestRun(c, 2, 3);
    if (!run) break;
    for (const r of run) c.set(r, (c.get(r) ?? 0) - 2);
    groups++;
  }
  // 飞机（count>=3, len>=2）
  for (;;) {
    const run = longestRun(c, 3, 2);
    if (!run) break;
    for (const r of run) c.set(r, (c.get(r) ?? 0) - 3);
    groups++;
  }
  // 三条（记数，便于吸收 kicker）
  let triples = 0;
  for (const [r, n] of c) {
    if (n >= 3) { c.set(r, n - 3); triples++; }
  }

  // 剩余对子 / 单张
  let pairs = 0;
  let singles = 0;
  for (const [, n] of c) {
    if (n === 2) pairs++;
    else if (n === 1) singles++;
  }

  // 三带一/三带二：三条吸收单张或对子做 kicker，减少独立手数
  const singleKickers = Math.min(triples, singles);
  singles -= singleKickers;
  const pairKickers = Math.min(triples - singleKickers, pairs);
  pairs -= pairKickers;

  groups += triples + pairs + singles;

  return groups;
}

/** 在 3..14 的 rank 区间内，找出每个 rank 计数都 >= minCount 的最长连续段（长度 >= minLen） */
function longestRun(c: Map<number, number>, minCount: number, minLen: number): number[] | null {
  let best: number[] = [];
  let cur: number[] = [];
  for (let r = 3; r <= 14; r++) {
    if ((c.get(r) ?? 0) >= minCount) {
      cur.push(r);
      if (cur.length > best.length) best = [...cur];
    } else {
      cur = [];
    }
  }
  return best.length >= minLen ? best : null;
}

// ============= Public Entry =============

/** AI 选择出牌（null 表示不出 / 过牌） */
export function aiSelectPlay(ctx: AIContext): Card[] | null {
  const sorted = sortCards(ctx.hand);

  // 能一手出完直接获胜
  const winMove = findWinningMove(sorted, ctx.lastMove);
  if (winMove) return winMove;

  if (!ctx.lastMove) return leadPlay(ctx, sorted);
  return followPlay(ctx, sorted);
}

/** 寻找能一次性出完所有手牌的合法牌 */
function findWinningMove(hand: Card[], lastMove: Move | null): Card[] | null {
  const combo = analyzeCombo(hand);
  if (!combo) return null;
  if (!lastMove) return hand;
  return findValidPlays(hand, lastMove).find((p) => p.length === hand.length) ?? null;
}

// ============= Lead =============

function leadPlay(ctx: AIContext, sorted: Card[]): Card[] | null {
  const candidates = findValidPlays(sorted, null).filter((p) => {
    const t = analyzeCombo(p)?.type;
    return t !== "bomb" && t !== "rocket"; // 领出不主动拆炸弹/火箭
  });
  if (candidates.length === 0) return sorted.length > 0 ? [sorted[0]] : null;

  let best: Card[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const move of candidates) {
    const rest = removeCards(sorted, move);
    const rounds = decomposeCount(rest);
    const combo = analyzeCombo(move);
    const maxRank = Math.max(...move.map((c) => c.rank));
    const usesBig = move.some((c) => BIG_RANKS.has(c.rank)) ? 1 : 0;
    const lengthBonus = combo?.type === "single" || combo?.type === "pair" ? 0 : -0.3 * move.length;
    const score = rounds * 10 + usesBig * 5 + lengthBonus + maxRank * 0.02;
    if (score < bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

// ============= Follow =============

function followPlay(ctx: AIContext, sorted: Card[]): Card[] | null {
  const { role, lastMove, lastMovePlayer, landlordIndex, myIndex, playerCardCounts } = ctx;
  if (!lastMove) return null;

  const teammateLed =
    role === "farmer" && lastMovePlayer !== landlordIndex && lastMovePlayer !== myIndex;

  // 队友出的牌：原则上不压（能一手打完已在上层处理）
  if (teammateLed) return null;

  const allValid = findValidPlays(sorted, lastMove);
  if (allValid.length === 0) return null;

  const nonBombs = allValid.filter((p) => {
    const t = analyzeCombo(p)?.type;
    return t !== "bomb" && t !== "rocket";
  });

  const landlordCount = playerCardCounts[landlordIndex] ?? 99;
  const opponentLow = role === "farmer" ? landlordCount <= 2 : opponentsLow(ctx);
  const currentRounds = decomposeCount(sorted);

  let best: Card[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestRounds = Number.POSITIVE_INFINITY;

  for (const move of nonBombs) {
    const rest = removeCards(sorted, move);
    const rounds = decomposeCount(rest);
    const maxRank = Math.max(...move.map((c) => c.rank));
    const usesBig = move.some((c) => BIG_RANKS.has(c.rank)) ? 1 : 0;
    const score = rounds * 10 + usesBig * 4 + maxRank * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = move;
      bestRounds = rounds;
    }
  }

  if (best) {
    const progress = bestRounds < currentRounds; // 跟这手后手数减少 = 划算
    const isBigCardPlay = best.some((c) => BIG_RANKS.has(c.rank));
    if (opponentLow) return best; // 对手即将获胜，必拦
    if (progress) return best;
    if (!isBigCardPlay && bestRounds === currentRounds) return best;
    return null; // 否则保存大牌，放过
  }

  // 只剩炸弹/火箭：对手快赢时才炸
  if (opponentLow) {
    const bombs = allValid
      .filter((p) => {
        const t = analyzeCombo(p)?.type;
        return t === "bomb" || t === "rocket";
      })
      .sort((a, b) => a.length - b.length);
    return bombs[0] ?? null;
  }
  return null;
}

/** 地主视角：任一农民即将获胜 */
function opponentsLow(ctx: AIContext): boolean {
  for (let i = 0; i < ctx.playerCardCounts.length; i++) {
    if (i === ctx.myIndex) continue;
    if (i === ctx.landlordIndex) continue;
    if (ctx.playerCardCounts[i] <= 2) return true;
  }
  return false;
}

// ============= Helpers =============

function removeCards(hand: Card[], toRemove: Card[]): Card[] {
  const ids = new Set(toRemove.map((c) => c.id));
  return hand.filter((c) => !ids.has(c.id));
}

/** 评估手牌强度（叫地主用），范围约 0~20+ */
export function evaluateHandStrength(cards: Card[]): number {
  const counts = countByRank(cards);
  let score = 0;

  if (counts.has(17)) score += 6;
  if (counts.has(16)) score += 4;
  if (counts.has(16) && counts.has(17)) score += 2; // 火箭
  for (const [, n] of counts) if (n === 4) score += 6; // 炸弹
  score += (counts.get(15) ?? 0) * 2; // 2
  score += (counts.get(14) ?? 0) * 1; // A

  const rounds = decomposeCount(cards);
  score += Math.max(0, 10 - rounds);

  return score;
}
