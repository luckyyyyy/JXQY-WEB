/**
 * 斗地主 AI
 *
 * 核心思想：手牌拆解 + 一步前瞻 + 控制权评估
 * - decomposeCount：三种拆解策略取最小值，避免贪心陷阱
 * - 领出：选拆解后手数最少 + 保持控制权 + 消耗小牌
 * - 跟牌：根据游戏阶段（激进/保守）和角色决定是否跟
 * - 农民配合：主动配合队友，不只"不压"
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

// ============= Hand Decomposition (改进版) =============

/** 把手牌拆成尽量少的「手数」，多种策略取最优 */
export function decomposeCount(hand: Card[]): number {
  if (hand.length === 0) return 0;
  const counts = countByRank(hand);

  return Math.min(
    decomposeWithOrder(counts, "straights_first"),
    decomposeWithOrder(counts, "planes_first"),
    decomposeWithOrder(counts, "pair_straights_first"),
  );
}

type ExtractOrder = "straights_first" | "planes_first" | "pair_straights_first";

/** 按指定优先级提取所有牌型，返回总手数 */
function decomposeWithOrder(counts: Map<number, number>, order: ExtractOrder): number {
  const c = new Map(counts);
  let groups = 0;

  // 1. 火箭
  if ((c.get(16) ?? 0) > 0 && (c.get(17) ?? 0) > 0) {
    c.delete(16); c.delete(17); groups++;
  }
  // 2. 炸弹
  for (const [r, n] of c) { if (n === 4) { c.delete(r); groups++; } }

  // 3. 按策略提取顺子/连对/飞机
  if (order === "straights_first") {
    groups += extractStraights(c) + extractPairStraights(c) + extractPlanes(c);
  } else if (order === "planes_first") {
    groups += extractPlanes(c) + extractStraights(c) + extractPairStraights(c);
  } else {
    groups += extractPairStraights(c) + extractStraights(c) + extractPlanes(c);
  }

  // 4. 剩余：三带（吸收 kicker）+ 对子 + 单张
  return groups + countRemainingGroups(c);
}

/** 提取所有顺子（≥5张连续单牌），返回提取的手数 */
function extractStraights(c: Map<number, number>): number {
  let groups = 0;
  for (;;) {
    const run = longestRun(c, 1, 5);
    if (!run) break;
    groups++;
    for (const r of run) {
      const n = (c.get(r) ?? 0) - 1;
      if (n <= 0) c.delete(r); else c.set(r, n);
    }
  }
  return groups;
}

/** 提取所有连对（≥3对连续对子），返回提取的手数 */
function extractPairStraights(c: Map<number, number>): number {
  let groups = 0;
  for (;;) {
    const run = longestRun(c, 2, 3);
    if (!run) break;
    groups++;
    for (const r of run) {
      const n = (c.get(r) ?? 0) - 2;
      if (n <= 0) c.delete(r); else c.set(r, n);
    }
  }
  return groups;
}

/** 提取飞机（≥2个连续三条），吸收 kicker，返回提取的手数 */
function extractPlanes(c: Map<number, number>): number {
  let groups = 0;
  for (;;) {
    const run = longestRun(c, 3, 2);
    if (!run) break;
    groups++;
    const runSet = new Set(run);
    // 提取飞机三条
    for (const r of run) {
      const n = (c.get(r) ?? 0) - 3;
      if (n <= 0) c.delete(r); else c.set(r, n);
    }
    // 吸收 kicker：每组带 1 单或 1 对
    let need = run.length;
    const absorbs: [number, number][] = [];
    for (const [r, n] of c) {
      if (need <= 0) break;
      if (runSet.has(r)) continue;
      if (n === 1 || n === 2) { absorbs.push([r, 1]); need--; }
    }
    for (const [r, amt] of absorbs) {
      const n = (c.get(r) ?? 0) - amt;
      if (n <= 0) c.delete(r); else c.set(r, n);
    }
  }
  return groups;
}

/** 计算剩余牌的手数：三带吸收 kicker + 对子 + 单张 */
function countRemainingGroups(c: Map<number, number>): number {
  let triples = 0, pairs = 0, singles = 0;
  for (const [, n] of c) {
    if (n >= 3) {
      triples++;
      const rem = n - 3;
      if (rem === 2) pairs++;
      else if (rem === 1) singles++;
    } else if (n === 2) pairs++;
    else if (n === 1) singles++;
  }
  // 三带吸收 kicker
  const singleKickers = Math.min(triples, singles);
  singles -= singleKickers;
  const pairKickers = Math.min(triples - singleKickers, pairs);
  pairs -= pairKickers;
  return triples + pairs + singles;
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

// ============= Hand Analysis Helpers =============

/** 统计手牌中的控制牌数量（炸弹/火箭/大牌） */
function controlCards(hand: Card[]): number {
  const counts = countByRank(hand);
  let ctrl = 0;
  for (const [r, n] of counts) { if (n === 4) ctrl++; } // 炸弹
  if ((counts.get(16) ?? 0) > 0 && (counts.get(17) ?? 0) > 0) ctrl++; // 火箭
  ctrl += (counts.get(15) ?? 0); // 2
  return ctrl;
}

/** 统计手牌中的孤张数（只有1张的 rank） */
function singletonCount(hand: Card[]): number {
  const counts = countByRank(hand);
  let s = 0;
  for (const [, n] of counts) { if (n === 1) s++; }
  return s;
}

// ============= Public Entry =============

/** AI 选择出牌（null 表示不出 / 过牌） */
export function aiSelectPlay(ctx: AIContext): Card[] | null {
  const sorted = sortCards(ctx.hand);

  // 队友出的牌：原则上不压（即使能赢也不抢队友的出牌权）
  if (ctx.lastMove && ctx.lastMovePlayer !== ctx.myIndex) {
    const isTeammate = ctx.role === "farmer" && ctx.lastMovePlayer !== ctx.landlordIndex;
    if (isTeammate) return null;
  }

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

  const ctrlBefore = controlCards(sorted);
  const singleBefore = singletonCount(sorted);

  let best: Card[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const move of candidates) {
    const rest = removeCards(sorted, move);
    const rounds = decomposeCount(rest);
    const combo = analyzeCombo(move);
    const maxRank = Math.max(...move.map((c) => c.rank));
    const usesBig = move.some((c) => BIG_RANKS.has(c.rank)) ? 1 : 0;

    // 长牌型（顺子/连对/飞机）奖励：出得多，手数减得快
    const isLongCombo = combo && combo.type && !["single", "pair", "triple", "triple_one", "triple_pair"].includes(combo.type);
    const lengthBonus = isLongCombo ? -0.5 * move.length : 0;

    // 控制力变化：出完后剩的控制牌越多越好
    const ctrlAfter = controlCards(rest);
    const controlPenalty = Math.max(0, ctrlBefore - ctrlAfter - 1) * 2; // 失去控制牌惩罚

    // 孤张变化：剩的孤张越多越差
    const singleAfter = singletonCount(rest);
    const singlePenalty = Math.max(0, singleAfter - singleBefore) * 1.5;

    const score = rounds * 10 + usesBig * 6 + lengthBonus + controlPenalty + singlePenalty + maxRank * 0.02;

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

  const allValid = findValidPlays(sorted, lastMove);
  if (allValid.length === 0) return null;

  const nonBombs = allValid.filter((p) => {
    const t = analyzeCombo(p)?.type;
    return t !== "bomb" && t !== "rocket";
  });

  const myRounds = decomposeCount(sorted);
  const threatLevel = calcThreatLevel(lastMove, ctx);

  // === 评分：遍历所有候选，选决策分最高的 ===
  let best: Card[] | null = null;
  let bestDecisionScore = -Infinity;

  for (const move of nonBombs) {
    const rest = removeCards(sorted, move);
    const newRounds = decomposeCount(rest);
    const combo = analyzeCombo(move);

    // 收益：手数减少 × 动态系数（威胁越高，省一轮越值钱）
    const roundsSaved = myRounds - newRounds;
    // 长牌型（≥4张的顺子/连对/飞机）额外奖励 — 一次清很多牌
    const isLongCombo = combo?.type && move.length >= 4
      && ["straight", "straight_pair", "plane", "plane_single", "plane_pair"].includes(combo.type);
    const efficiencyBonus = isLongCombo ? move.length * 2 : 0;
    const roundValue = Math.max(threatLevel, 3);
    const playScore = roundsSaved * roundValue + efficiencyBonus;

    // 成本：出的牌有多珍贵
    const wasteCost = calcWasteCost(move, sorted);

    // 决策分 = 威胁 + 收益 - 成本
    const decisionScore = threatLevel + playScore - wasteCost;

    if (decisionScore > bestDecisionScore) {
      bestDecisionScore = decisionScore;
      best = move;
    }
  }

  // === 决策阈值 ===
  let threshold = 0;
  if (isOpponentCritical(ctx)) threshold = -20;
  else if (isOpponentLow(ctx)) threshold = -5;

  if (best && bestDecisionScore > threshold) return best;

  // === 炸弹/火箭 ===
  return decideBomb(allValid, ctx);
}

/** 计算威胁等级：对手出的这手牌有多危险 */
function calcThreatLevel(lastMove: Move, ctx: AIContext): number {
  const { playerCardCounts, landlordIndex, myIndex, role } = ctx;

  // 基础威胁：被压的牌的 rank（3→3, A→14, 2→15）
  // 低牌（3~7）本身不是威胁，高牌才是
  let threat = lastMove.rank <= 7 ? lastMove.rank - 5 : lastMove.rank;

  // 对手即将赢 → 威胁拉满
  for (let i = 0; i < playerCardCounts.length; i++) {
    if (i === myIndex) continue;
    const isOpponent = role === "landlord" ? i !== landlordIndex : i === landlordIndex;
    if (isOpponent) {
      const oppCards = playerCardCounts[i];
      if (oppCards <= 1) threat += 30;
      else if (oppCards <= 2) threat += 20;
      else if (oppCards <= 5) threat += 10;
    }
  }

  // 长牌型比单张更危险 — 对手清牌效率高
  if (lastMove.cards.length >= 5) threat += 5;
  if (lastMove.cards.length >= 8) threat += 5;

  return threat;
}

/** 计算出牌的"浪费成本" — 出的牌有多珍贵 */
function calcWasteCost(move: Card[], hand: Card[]): number {
  let cost = 0;
  const handCounts = countByRank(hand);
  const moveCounts = countByRank(move);

  for (const [rank, used] of moveCounts) {
    const have = handCounts.get(rank) ?? 0;

    // 大牌（2/王）成本很高 — 不到关键时刻不要用
    if (rank >= 15) cost += used * 12;
    // A/K 成本中等
    else if (rank >= 13) cost += used * 3;
    // 拆炸弹成本极高
    if (have === 4 && used > 0 && used < 4) cost += 15;
    // 拆三条成本中等
    if (have === 3 && used > 0 && used < 3) cost += 5;
    // 拆对子成本低
    if (have === 2 && used === 1) cost += 2;
  }

  return cost;
}

/** 炸弹/火箭决策 */
function decideBomb(allValid: Card[][], ctx: AIContext): Card[] | null {
  const opponentCritical = isOpponentCritical(ctx);
  const opponentLow = isOpponentLow(ctx);
  const myRounds = decomposeCount(ctx.hand);

  const bombs = allValid
    .filter((p) => {
      const t = analyzeCombo(p)?.type;
      return t === "bomb" || t === "rocket";
    })
    .sort((a, b) => a.length - b.length);

  if (bombs.length === 0) return null;
  if (opponentCritical) return bombs[0];
  if (opponentLow && myRounds <= 3) return bombs[0];
  if (myRounds <= 2) return bombs[0];

  return null;
}

/** 对手是否手牌较少（激进期阈值） */
function isOpponentLow(ctx: AIContext): boolean {
  for (let i = 0; i < ctx.playerCardCounts.length; i++) {
    if (i === ctx.myIndex) continue;
    const isOpponent = ctx.role === "landlord"
      ? i !== ctx.landlordIndex
      : i === ctx.landlordIndex;
    if (isOpponent && ctx.playerCardCounts[i] <= 5) return true;
  }
  return false;
}

/** 对手是否即将获胜（≤2 张） */
function isOpponentCritical(ctx: AIContext): boolean {
  for (let i = 0; i < ctx.playerCardCounts.length; i++) {
    if (i === ctx.myIndex) continue;
    const isOpponent = ctx.role === "landlord"
      ? i !== ctx.landlordIndex
      : i === ctx.landlordIndex;
    if (isOpponent && ctx.playerCardCounts[i] <= 2) return true;
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

  // 大牌价值
  const hasRocket = (counts.get(16) ?? 0) > 0 && (counts.get(17) ?? 0) > 0;
  if (hasRocket) score += 10;  // 火箭：极强
  else {
    if (counts.has(17)) score += 5;  // 大王
    if (counts.has(16)) score += 3;  // 小王
  }

  // 炸弹（不与大牌重复计分）
  for (const [r, n] of counts) {
    if (n === 4) score += 6;
  }

  // 2 和 A：有对子/三条保护时价值更高
  const twos = counts.get(15) ?? 0;
  const aces = counts.get(14) ?? 0;
  score += twos * 2;
  score += aces * 1;
  // 对 2 额外奖励（不容易被拆）
  if (twos >= 2) score += 1;
  // 对 A 额外奖励
  if (aces >= 2) score += 1;

  // 手牌结构质量：拆解手数越少越好
  const rounds = decomposeCount(cards);
  score += Math.max(0, 10 - rounds);

  // 孤张惩罚：太多单张（不容易出完）
  let singleRanks = 0;
  for (const [, n] of counts) { if (n === 1) singleRanks++; }
  if (singleRanks >= 5) score -= 2;

  return score;
}

/** AI 叫地主决策 */
export function shouldBid(
  hand: Card[],
  bidOrder: number,        // 0=第一个叫, 1=第二个, 2=第三个
  someoneBid: boolean,     // 前面是否有人叫过
): boolean {
  const strength = evaluateHandStrength(hand);

  // 阈值根据叫牌位置动态调整
  // 典型分数：弱手 3~6 / 中等 7~10 / 强手 11~15 / 极强 16+
  let threshold: number;
  if (bidOrder === 0) {
    threshold = 8;      // 第一个叫：中等偏上即可
  } else if (bidOrder === 1) {
    threshold = someoneBid ? 11 : 8;  // 有人叫过 → 对手可能强 → 需要更好
  } else {
    threshold = someoneBid ? 12 : 9;  // 第三个叫：更谨慎
  }

  return strength >= threshold;
}
