/**
 * 斗地主牌型引擎
 *
 * 54 张牌（含大小王）、牌型判定、出牌验证、牌力评估
 */

// ============= Types =============

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;
// 3-10 = 3-10, 11=J, 12=Q, 13=K, 14=A, 15=2, 16=小王, 17=大王

export interface Card {
  rank: Rank;
  suit: Suit | "joker";
  id: string; // unique identifier
}

export type ComboType =
  | "single"        // 单张
  | "pair"          // 对子
  | "triple"        // 三条
  | "triple_one"    // 三带一
  | "triple_pair"   // 三带二
  | "straight"      // 顺子（≥5张连续单牌）
  | "straight_pair" // 连对（≥3对连续对子）
  | "plane"         // 飞机（≥2个连续三条）
  | "plane_single"  // 飞机带单
  | "plane_pair"    // 飞机带对
  | "four_two"      // 四带二（两张单牌或两对）
  | "bomb"          // 炸弹（四张相同）
  | "rocket"        // 火箭（大小王）
  | null;

export interface Move {
  type: ComboType;
  cards: Card[];
  rank: number; // 主牌 rank（用于比较大小）
}

// ============= Constants =============

const RANK_ORDER: Rank[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

const RANK_NAME: Record<Rank, string> = {
  3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "小王", 17: "大王",
};

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];

// ============= Deck =============

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 3; rank <= 15; rank++) {
      deck.push({ rank: rank as Rank, suit, id: `${suit}${rank}` });
    }
  }
  // Jokers
  deck.push({ rank: 16, suit: "joker", id: "joker_s" }); // 小王
  deck.push({ rank: 17, suit: "joker", id: "joker_b" }); // 大王
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 发牌：每人17张，3张底牌 */
export function deal(deck: Card[]): { hands: Card[][]; landlordCards: Card[] } {
  const shuffled = shuffleDeck(deck);
  return {
    hands: [shuffled.slice(0, 17), shuffled.slice(17, 34), shuffled.slice(34, 51)],
    landlordCards: shuffled.slice(51, 54),
  };
}

// ============= Card Sorting =============

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.suit === "joker") return a.rank === 16 ? -1 : 1;
    if (b.suit === "joker") return b.rank === 16 ? 1 : -1;
    return SUITS.indexOf(a.suit as Suit) - SUITS.indexOf(b.suit as Suit);
  });
}

// ============= Card Counting =============

export function countByRank(cards: Card[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  return counts;
}

// ============= Combo Detection =============

/** 分析一组牌的牌型 */
export function analyzeCombo(cards: Card[]): Move | null {
  if (cards.length === 0) return null;

  const sorted = sortCards(cards);
  const counts = countByRank(sorted);
  const n = sorted.length;

  // 火箭：大小王
  if (n === 2 && sorted[0].rank === 16 && sorted[1].rank === 17) {
    return { type: "rocket", cards: sorted, rank: 17 };
  }

  // 单张
  if (n === 1) {
    return { type: "single", cards: sorted, rank: sorted[0].rank };
  }

  // 对子
  if (n === 2 && sorted[0].rank === sorted[1].rank) {
    return { type: "pair", cards: sorted, rank: sorted[0].rank };
  }

  // 三条
  if (n === 3 && counts.size === 1 && counts.get(sorted[0].rank) === 3) {
    return { type: "triple", cards: sorted, rank: sorted[0].rank };
  }

  // 炸弹
  if (n === 4 && counts.size === 1 && counts.get(sorted[0].rank) === 4) {
    return { type: "bomb", cards: sorted, rank: sorted[0].rank };
  }

  // 三带一
  if (n === 4) {
    const tripleRank = findNOfAKind(counts, 3);
    if (tripleRank !== null) {
      return { type: "triple_one", cards: sorted, rank: tripleRank };
    }
  }

  // 三带二（对子）
  if (n === 5) {
    const tripleRank = findNOfAKind(counts, 3);
    const pairRank = findNOfAKind(counts, 2);
    if (tripleRank !== null && pairRank !== null) {
      return { type: "triple_pair", cards: sorted, rank: tripleRank };
    }
  }

  // 顺子（≥5张连续单牌，不含2和王）
  if (n >= 5 && counts.size === n) {
    const ranks = sorted.map(c => c.rank).sort((a, b) => a - b);
    if (ranks.every(r => r <= 14) && isConsecutive(ranks)) {
      return { type: "straight", cards: sorted, rank: ranks[ranks.length - 1] };
    }
  }

  // 连对（≥3对连续对子，不含2和王）
  if (n >= 6 && n % 2 === 0) {
    const pairRanks = [...counts.entries()].filter(([, v]) => v === 2).map(([k]) => k).sort((a, b) => a - b);
    if (pairRanks.length === n / 2 && pairRanks.every(r => r <= 14) && isConsecutive(pairRanks)) {
      return { type: "straight_pair", cards: sorted, rank: pairRanks[pairRanks.length - 1] };
    }
  }

  // 飞机（≥2个连续三条）
  const triples = [...counts.entries()].filter(([, v]) => v >= 3).map(([k]) => k).sort((a, b) => a - b);
  if (triples.length >= 2) {
    // 找最长连续三条序列
    const seqs = findConsecutiveSequences(triples.filter(r => r <= 14));
    for (const seq of seqs) {
      if (seq.length < 2) continue;
      const planeSize = seq.length;
      const kickers = n - planeSize * 3;

      // 纯飞机
      if (kickers === 0) {
        return { type: "plane", cards: sorted, rank: seq[seq.length - 1] };
      }
      // 飞机带单（每组带一张）
      if (kickers === planeSize) {
        return { type: "plane_single", cards: sorted, rank: seq[seq.length - 1] };
      }
      // 飞机带对（每组带一对）
      if (kickers === planeSize * 2) {
        return { type: "plane_pair", cards: sorted, rank: seq[seq.length - 1] };
      }
    }
  }

  // 四带二
  if (n === 6 || n === 8) {
    const fourRank = findNOfAKind(counts, 4);
    if (fourRank !== null) {
      const remaining = n - 4;
      if (remaining === 2) {
        // 四带二单 or 四带一对
        return { type: "four_two", cards: sorted, rank: fourRank };
      }
    }
  }

  return null;
}

function findNOfAKind(counts: Map<Rank, number>, n: number): Rank | null {
  for (const [rank, count] of counts) {
    if (count === n) return rank;
  }
  return null;
}

function isConsecutive(ranks: number[]): boolean {
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  return true;
}

function findConsecutiveSequences(ranks: Rank[]): Rank[][] {
  if (ranks.length === 0) return [];
  const sorted = [...ranks].sort((a, b) => a - b);
  const seqs: Rank[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      seqs[seqs.length - 1].push(sorted[i]);
    } else {
      seqs.push([sorted[i]]);
    }
  }
  return seqs;
}

// ============= Move Validation =============

/** 判断 move2 是否能压过 move1 */
export function canBeat(move1: Move, move2: Move): boolean {
  // 火箭压一切
  if (move2.type === "rocket") return true;
  if (move1.type === "rocket") return false;

  // 炸弹压非炸弹
  if (move2.type === "bomb" && move1.type !== "bomb") return true;
  if (move1.type === "bomb" && move2.type !== "bomb") return false;

  // 同类型比较
  if (move1.type === move2.type && move1.cards.length === move2.cards.length) {
    return move2.rank > move1.rank;
  }

  // 炸弹比炸弹
  if (move1.type === "bomb" && move2.type === "bomb") {
    return move2.rank > move1.rank;
  }

  return false;
}

/** 验证出牌是否合法（对比上一手牌） */
export function isValidPlay(cards: Card[], lastMove: Move | null): Move | null {
  const combo = analyzeCombo(cards);
  if (!combo) return null;

  if (!lastMove) return combo; // 自由出牌

  if (canBeat(lastMove, combo)) return combo;
  return null;
}

// ============= Find Valid Plays =============

// ============= Find Valid Plays =============

/** 从手牌中找出所有能压过 lastMove 的牌型组合 */
export function findValidPlays(hand: Card[], lastMove: Move | null): Card[][] {
  if (!lastMove) return findAllCombos(hand);

  const results: Card[][] = [];
  const sorted = sortCards(hand);
  const counts = countByRank(sorted);
  const take = (rank: number, n: number): Card[] => sorted.filter((c) => c.rank === rank).slice(0, n);

  switch (lastMove.type) {
    case "single":
      for (const c of sorted) if (c.rank > lastMove.rank) results.push([c]);
      break;
    case "pair":
      for (const [rank, count] of counts) if (count >= 2 && rank > lastMove.rank) results.push(take(rank, 2));
      break;
    case "triple":
      for (const [rank, count] of counts) if (count >= 3 && rank > lastMove.rank) results.push(take(rank, 3));
      break;
    case "triple_one":
      for (const [rank, count] of counts) {
        if (count >= 3 && rank > lastMove.rank) {
          const kicker = sorted.find((c) => c.rank !== rank);
          if (kicker) results.push([...take(rank, 3), kicker]);
        }
      }
      break;
    case "triple_pair":
      for (const [rank, count] of counts) {
        if (count >= 3 && rank > lastMove.rank) {
          const pair = [...counts.entries()].find(([r, c]) => r !== rank && c >= 2);
          if (pair) results.push([...take(rank, 3), ...take(pair[0], 2)]);
        }
      }
      break;
    case "straight": {
      const len = lastMove.cards.length;
      for (let start = 3; start + len - 1 <= 14; start++) {
        const end = start + len - 1;
        if (end <= lastMove.rank) continue;
        const seq: Card[] = [];
        let ok = true;
        for (let r = start; r <= end; r++) {
          const c = sorted.find((x) => x.rank === r);
          if (!c) { ok = false; break; }
          seq.push(c);
        }
        if (ok) results.push(seq);
      }
      break;
    }
    case "straight_pair": {
      const pairCount = lastMove.cards.length / 2;
      for (let start = 3; start + pairCount - 1 <= 14; start++) {
        const end = start + pairCount - 1;
        if (end <= lastMove.rank) continue;
        const seq: Card[] = [];
        let ok = true;
        for (let r = start; r <= end; r++) {
          if ((counts.get(r as Rank) ?? 0) < 2) { ok = false; break; }
          seq.push(...take(r, 2));
        }
        if (ok) results.push(seq);
      }
      break;
    }
    case "plane":
    case "plane_single":
    case "plane_pair": {
      const groups =
        lastMove.type === "plane"
          ? lastMove.cards.length / 3
          : lastMove.type === "plane_single"
            ? lastMove.cards.length / 4
            : lastMove.cards.length / 5;
      const runs = consecutiveTripleRuns(counts, groups);
      for (const run of runs) {
        if (run[run.length - 1] <= lastMove.rank) continue;
        const body = run.flatMap((r) => take(r, 3));
        if (lastMove.type === "plane") {
          results.push(body);
          continue;
        }
        const kickerSize = lastMove.type === "plane_single" ? 1 : 2;
        const kickers = pickKickers(sorted, run, groups, kickerSize);
        if (kickers) results.push([...body, ...kickers]);
      }
      break;
    }
    case "four_two": {
      const kickerSize = lastMove.cards.length === 6 ? 1 : 2; // 6=四带两单, 8=四带两对
      for (const [rank, count] of counts) {
        if (count === 4 && rank > lastMove.rank) {
          const kickers = pickKickers(sorted, [rank], 2, kickerSize);
          if (kickers) results.push([...take(rank, 4), ...kickers]);
        }
      }
      break;
    }
    default:
      break;
  }

  // 炸弹可压任何非炸弹；更大的炸弹可压炸弹
  if (lastMove.type !== "bomb" && lastMove.type !== "rocket") {
    for (const [rank, count] of counts) if (count === 4) results.push(take(rank, 4));
  } else if (lastMove.type === "bomb") {
    for (const [rank, count] of counts) if (count === 4 && rank > lastMove.rank) results.push(take(rank, 4));
  }

  // 火箭压一切
  const hasSmall = sorted.find((c) => c.rank === 16);
  const hasBig = sorted.find((c) => c.rank === 17);
  if (hasSmall && hasBig) results.push([hasSmall, hasBig]);

  return results;
}

/** 找出长度为 len 的连续三条 rank 序列（不含 2 和王） */
function consecutiveTripleRuns(counts: Map<Rank, number>, len: number): Rank[][] {
  const tripleRanks = [...counts.entries()]
    .filter(([r, c]) => c >= 3 && r <= 14)
    .map(([r]) => r)
    .sort((a, b) => a - b);
  const runs: Rank[][] = [];
  for (let i = 0; i + len <= tripleRanks.length; i++) {
    const slice = tripleRanks.slice(i, i + len);
    if (isConsecutive(slice)) runs.push(slice);
  }
  return runs;
}

/** 选取 kicker：groups 组、每组 size 张，排除 excluded 中的 rank，取最小者 */
function pickKickers(sorted: Card[], excluded: Rank[], groups: number, size: number): Card[] | null {
  const counts = countByRank(sorted);
  const ex = new Set<number>(excluded);
  const candidates: Rank[] = [];
  for (const [rank, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (ex.has(rank)) continue;
    if (count >= size && count < 4) candidates.push(rank); // 避免拆炸弹当 kicker
    if (candidates.length >= groups) break;
  }
  if (candidates.length < groups) return null;
  return candidates.slice(0, groups).flatMap((r) => sorted.filter((c) => c.rank === r).slice(0, size));
}

/** 找出手牌中所有可能的牌型组合（用于自由出牌） */
function findAllCombos(hand: Card[]): Card[][] {
  const sorted = sortCards(hand);
  const counts = countByRank(sorted);
  const results: Card[][] = [];
  const take = (rank: number, n: number): Card[] => sorted.filter((c) => c.rank === rank).slice(0, n);

  // 单张
  for (const c of sorted) results.push([c]);

  // 对子
  for (const [rank, count] of counts) if (count >= 2) results.push(take(rank, 2));

  // 三条 / 三带一 / 三带二
  for (const [rank, count] of counts) {
    if (count < 3) continue;
    results.push(take(rank, 3));
    const single = sorted.find((c) => c.rank !== rank);
    if (single) results.push([...take(rank, 3), single]);
    const pair = [...counts.entries()].find(([r, c]) => r !== rank && c >= 2);
    if (pair) results.push([...take(rank, 3), ...take(pair[0], 2)]);
  }

  // 炸弹
  for (const [rank, count] of counts) if (count === 4) results.push(take(rank, 4));

  // 火箭
  const hasSmall = sorted.find((c) => c.rank === 16);
  const hasBig = sorted.find((c) => c.rank === 17);
  if (hasSmall && hasBig) results.push([hasSmall, hasBig]);

  // 顺子
  const singleRanks = [...counts.entries()].map(([k]) => k).filter((r) => r <= 14).sort((a, b) => a - b);
  for (let len = 5; len <= singleRanks.length; len++) {
    for (let i = 0; i + len <= singleRanks.length; i++) {
      const seq = singleRanks.slice(i, i + len);
      if (isConsecutive(seq)) results.push(seq.map((r) => sorted.find((c) => c.rank === r) as Card));
    }
  }

  // 连对
  const pairRanks = [...counts.entries()].filter(([, v]) => v >= 2).map(([k]) => k).filter((r) => r <= 14).sort((a, b) => a - b);
  for (let len = 3; len <= pairRanks.length; len++) {
    for (let i = 0; i + len <= pairRanks.length; i++) {
      const seq = pairRanks.slice(i, i + len);
      if (isConsecutive(seq)) results.push(seq.flatMap((r) => take(r, 2)));
    }
  }

  // 飞机（纯飞机，连续三条）
  const tripleRanks = [...counts.entries()].filter(([, v]) => v >= 3).map(([k]) => k).filter((r) => r <= 14).sort((a, b) => a - b);
  for (let len = 2; len <= tripleRanks.length; len++) {
    for (let i = 0; i + len <= tripleRanks.length; i++) {
      const seq = tripleRanks.slice(i, i + len);
      if (isConsecutive(seq)) results.push(seq.flatMap((r) => take(r, 3)));
    }
  }

  return results;
}

// ============= Utilities =============

export function getRankName(rank: Rank): string {
  return RANK_NAME[rank] ?? String(rank);
}

export function getCardDisplay(card: Card): string {
  if (card.suit === "joker") {
    return card.rank === 17 ? "大王" : "小王";
  }
  return `${card.suit}${RANK_NAME[card.rank]}`;
}

export function getCardColor(card: Card): string {
  if (card.suit === "joker") return card.rank === 17 ? "#ff1744" : "#000";
  if (card.suit === "♥" || card.suit === "♦") return "#ff1744";
  return "#000";
}
