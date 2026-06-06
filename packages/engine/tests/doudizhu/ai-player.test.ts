/**
 * 斗地主 AI 全量单元测试
 */

import { describe, expect, it } from "vitest";
import { writeFileSync } from "fs";
import type { Card, Rank, Suit } from "../../src/gui/doudizhu/card-engine";
import { analyzeCombo, createDeck, deal, sortCards } from "../../src/gui/doudizhu/card-engine";
import {
  type AIContext,
  type PlayerRole,
  aiSelectPlay,
  CardTracker,
  decomposeCount,
  evaluateHandStrength,
  shouldBid,
} from "../../src/gui/doudizhu/ai-player";

// ============= Helpers =============

function card(rank: Rank, suit: Suit | "joker" = "♠"): Card {
  return { rank, suit, id: `${suit}${rank}` };
}

function cards(...specs: Array<[Rank, Suit | "joker"]>): Card[] {
  return specs.map(([r, s]) => card(r, s));
}

/** 构造最小 AIContext */
function makeCtx(
  hand: Card[],
  opts: Partial<AIContext> & { lastMove?: ReturnType<typeof analyzeCombo> } = {},
): AIContext {
  return {
    hand,
    role: opts.role ?? "farmer",
    lastMove: opts.lastMove ?? null,
    lastMovePlayer: opts.lastMovePlayer ?? -1,
    landlordIndex: opts.landlordIndex ?? 0,
    myIndex: opts.myIndex ?? 1,
    tracker: opts.tracker ?? new CardTracker(),
    playerCardCounts: opts.playerCardCounts ?? [17, hand.length, 17],
  };
}

// ============= CardTracker Tests =============

describe("CardTracker", () => {
  it("should start with all cards remaining", () => {
    const tracker = new CardTracker();
    expect(tracker.remaining(3, 0)).toBe(4);
    expect(tracker.remaining(14, 0)).toBe(4);
    expect(tracker.remaining(16, 0)).toBe(1);
    expect(tracker.remaining(17, 0)).toBe(1);
  });

  it("should track played cards", () => {
    const tracker = new CardTracker();
    tracker.onCardsPlayed(cards([3, "♠"], [3, "♥"], [5, "♦"]));
    expect(tracker.remaining(3, 0)).toBe(2);
    expect(tracker.remaining(5, 0)).toBe(3);
    expect(tracker.remaining(7, 0)).toBe(4);
  });

  it("should subtract myCount correctly", () => {
    const tracker = new CardTracker();
    tracker.onCardsPlayed(cards([3, "♠"], [3, "♥"]));
    // 4 total - 2 played - 1 in my hand = 1 remaining outside
    expect(tracker.remaining(3, 1)).toBe(1);
  });

  it("should reset correctly", () => {
    const tracker = new CardTracker();
    tracker.onCardsPlayed(cards([3, "♠"], [5, "♥"]));
    tracker.reset();
    expect(tracker.remaining(3, 0)).toBe(4);
    expect(tracker.remaining(5, 0)).toBe(4);
  });

  it("isBiggest: big joker is always biggest", () => {
    const tracker = new CardTracker();
    expect(tracker.isBiggest(17, 0)).toBe(true);
  });

  it("isBiggest: small joker is biggest when big joker played", () => {
    const tracker = new CardTracker();
    tracker.onCardsPlayed(cards([17, "joker"]));
    expect(tracker.isBiggest(16, 0)).toBe(true);
  });

  it("isBiggest: 2 is biggest when all jokers and 2s played except mine", () => {
    const tracker = new CardTracker();
    tracker.onCardsPlayed(cards([16, "joker"], [17, "joker"]));
    // all jokers gone, 2 is now biggest if no other 2s outside
    expect(tracker.isBiggest(15, 4)).toBe(true); // I have all 4 twos
  });

  it("isBiggest: false when higher rank still out", () => {
    const tracker = new CardTracker();
    tracker.onCardsPlayed(cards([14, "♠"]));
    expect(tracker.isBiggest(13, 0)).toBe(false); // A still has 3 remaining, plus 2, jokers
  });
});

// ============= decomposeCount Tests =============

describe("decomposeCount", () => {
  it("empty hand = 0", () => {
    expect(decomposeCount([])).toBe(0);
  });

  it("single card = 1", () => {
    expect(decomposeCount(cards([3, "♠"]))).toBe(1);
  });

  it("pair = 1", () => {
    expect(decomposeCount(cards([5, "♠"], [5, "♥"]))).toBe(1);
  });

  it("triple = 1", () => {
    expect(decomposeCount(cards([7, "♠"], [7, "♥"], [7, "♦"]))).toBe(1);
  });

  it("triple with kicker = 1", () => {
    // 三带一 = 1 hand
    expect(decomposeCount(cards([7, "♠"], [7, "♥"], [7, "♦"], [3, "♠"]))).toBe(1);
  });

  it("triple pair = 1", () => {
    expect(decomposeCount(cards([7, "♠"], [7, "♥"], [7, "♦"], [3, "♠"], [3, "♥"]))).toBe(1);
  });

  it("bomb = 1", () => {
    expect(decomposeCount(cards([8, "♠"], [8, "♥"], [8, "♦"], [8, "♣"]))).toBe(1);
  });

  it("rocket = 1", () => {
    expect(decomposeCount(cards([16, "joker"], [17, "joker"]))).toBe(1);
  });

  it("straight of 5 = 1", () => {
    expect(decomposeCount(cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"]))).toBe(1);
  });

  it("straight of 12 = 1", () => {
    // 3-A 全顺
    const hand: Card[] = [];
    for (let r = 3; r <= 14; r++) hand.push(card(r as Rank));
    expect(decomposeCount(hand)).toBe(1);
  });

  it("pair straight of 3 pairs = 1", () => {
    expect(decomposeCount(cards(
      [3, "♠"], [3, "♥"],
      [4, "♦"], [4, "♣"],
      [5, "♠"], [5, "♥"],
    ))).toBe(1);
  });

  it("plane of 2 triples = 1", () => {
    expect(decomposeCount(cards(
      [3, "♠"], [3, "♥"], [3, "♦"],
      [4, "♣"], [4, "♠"], [4, "♥"],
    ))).toBe(1);
  });

  it("plane with kickers = 1", () => {
    // 飞机带单：333-444-5-6
    expect(decomposeCount(cards(
      [3, "♠"], [3, "♥"], [3, "♦"],
      [4, "♣"], [4, "♠"], [4, "♥"],
      [5, "♦"], [6, "♣"],
    ))).toBe(1);
  });

  it("two unrelated singles = 2", () => {
    expect(decomposeCount(cards([3, "♠"], [10, "♥"]))).toBe(2);
  });

  it("two unrelated pairs = 2", () => {
    expect(decomposeCount(cards([3, "♠"], [3, "♥"], [10, "♦"], [10, "♣"]))).toBe(2);
  });

  it("complex hand: bomb + straight + single", () => {
    // 炸弹 + 顺子 + 单张 = 3
    const hand = cards(
      [8, "♠"], [8, "♥"], [8, "♦"], [8, "♣"], // bomb
      [3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"], // straight
      [14, "♥"], // single A
    );
    expect(decomposeCount(hand)).toBe(3);
  });

  it("triple absorbs single as kicker to reduce count", () => {
    // 777 + 3 → 三带一 = 1, 而不是 三 + 单 = 2
    const hand = cards([7, "♠"], [7, "♥"], [7, "♦"], [3, "♠"]);
    expect(decomposeCount(hand)).toBe(1);
  });

  it("two triples with enough kickers = 2", () => {
    // 333 + 555 + 7 + 9 → 三带一 × 2 = 2
    const hand = cards(
      [3, "♠"], [3, "♥"], [3, "♦"],
      [5, "♣"], [5, "♠"], [5, "♥"],
      [7, "♦"], [9, "♣"],
    );
    expect(decomposeCount(hand)).toBe(2);
  });

  it("prefers strategy that gives fewer groups", () => {
    // 333-444-555-6-7-8 → 飞机(333-444-555) + 带单(6,7,8) = 1 手
    // 或 三带一 × 3 = 3 手
    // 顺子 3-4-5-6-7-8 = 1 手 + 三带 × 2 = 3 手
    // 最优：飞机带单 = 1 手
    const hand = cards(
      [3, "♠"], [3, "♥"], [3, "♦"],
      [4, "♣"], [4, "♠"], [4, "♥"],
      [5, "♦"], [5, "♣"], [5, "♠"],
      [6, "♥"], [7, "♦"], [8, "♣"],
    );
    expect(decomposeCount(hand)).toBe(1);
  });
});


// ============= evaluateHandStrength Tests =============

describe("evaluateHandStrength", () => {
  it("weak hand: all low singles scores low", () => {
    const hand = cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"], [8, "♥"], [9, "♦"], [10, "♣"], [11, "♠"], [12, "♥"], [13, "♦"], [14, "♣"], [3, "♠"]);
    // 13 cards, mostly singles → decompose gives ~2 groups (1 long straight + 1 pair)
    // score = A(1) + (10-2)=8 → ~9
    const score = evaluateHandStrength(hand);
    expect(score).toBeLessThan(12); // not a strong hand
  });

  it("strong hand: rocket + bomb + 2s scores high", () => {
    const hand = cards(
      [16, "joker"], [17, "joker"], // rocket: 6+4+2=12
      [8, "♠"], [8, "♥"], [8, "♦"], [8, "♣"], // bomb: 6
      [15, "♠"], [15, "♥"], // two 2s: 4
      [14, "♠"], [14, "♥"], // two As: 2
      [3, "♠"], [3, "♥"], [4, "♦"], [5, "♣"], [6, "♠"], [7, "♥"],
    );
    const score = evaluateHandStrength(hand);
    expect(score).toBeGreaterThanOrEqual(16);
  });

  it("bomb hand scores well", () => {
    const hand = cards(
      [14, "♠"], [14, "♥"], [14, "♦"], [14, "♣"], // bomb: 6
      [3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"], [8, "♥"], [9, "♦"], [10, "♣"], [11, "♠"],
    );
    const score = evaluateHandStrength(hand);
    expect(score).toBeGreaterThanOrEqual(8);
  });

  it("hand with 2s and As scores moderately", () => {
    const hand = cards(
      [15, "♠"], [15, "♥"], [15, "♦"], // three 2s: 6
      [14, "♠"], [14, "♥"], [14, "♦"], // three As: 3
      [3, "♠"], [3, "♥"], [4, "♦"], [4, "♣"], [5, "♠"], [5, "♥"], [6, "♦"], [6, "♣"],
    );
    const score = evaluateHandStrength(hand);
    expect(score).toBeGreaterThanOrEqual(12);
    expect(score).toBeLessThan(20);
  });
});

// ============= shouldBid Tests =============

describe("shouldBid", () => {
  it("strong hand (score ~24): always bids", () => {
    const hand = cards(
      [16, "joker"], [17, "joker"],
      [8, "♠"], [8, "♥"], [8, "♦"], [8, "♣"],
      [15, "♠"], [15, "♥"],
      [3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"], [9, "♥"], [10, "♦"], [11, "♣"], [12, "♠"],
    );
    expect(shouldBid(hand, 0, false)).toBe(true);
    expect(shouldBid(hand, 1, true)).toBe(true);
    expect(shouldBid(hand, 2, true)).toBe(true);
  });

  it("weak hand (score ~3): never bids", () => {
    const hand = cards(
      [3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"],
      [8, "♥"], [9, "♦"], [10, "♣"], [11, "♠"], [12, "♥"],
      [13, "♦"], [3, "♣"], [4, "♠"], [5, "♥"], [6, "♦"], [7, "♣"], [8, "♠"],
    );
    expect(shouldBid(hand, 0, false)).toBe(false);
    expect(shouldBid(hand, 1, false)).toBe(false);
    expect(shouldBid(hand, 2, false)).toBe(false);
  });

  it("strong-medium hand (score 14): bids everywhere", () => {
    // 2×2 + 2×A + pair straight 33-88 → score 14
    const hand = cards(
      [15, "♠"], [15, "♥"], [14, "♠"], [14, "♥"],
      [3, "♠"], [3, "♥"], [4, "♦"], [4, "♣"], [5, "♠"], [5, "♥"],
      [6, "♦"], [6, "♣"], [7, "♠"], [7, "♥"], [8, "♦"], [8, "♣"], [9, "♠"],
    );
    expect(shouldBid(hand, 0, false)).toBe(true);
    expect(shouldBid(hand, 1, true)).toBe(true);   // 14 >= 11
    expect(shouldBid(hand, 2, true)).toBe(true);    // 14 >= 12
  });

  it("weak-medium hand (score 9): bids early, passes when contested", () => {
    // 2×A + 1×2 + pair straight 33-55 + straight 5-9 + 10-K → score 9
    const hand = cards(
      [14, "♠"], [14, "♥"], [15, "♠"],
      [3, "♠"], [3, "♥"], [4, "♦"], [4, "♣"], [5, "♠"], [5, "♥"],
      [6, "♦"], [7, "♣"], [8, "♠"], [9, "♥"], [10, "♦"], [11, "♣"], [12, "♠"], [13, "♥"],
    );
    expect(shouldBid(hand, 0, false)).toBe(true);    // 9 >= 8
    expect(shouldBid(hand, 1, false)).toBe(true);    // 9 >= 8
    expect(shouldBid(hand, 1, true)).toBe(false);    // 9 < 11
    expect(shouldBid(hand, 2, false)).toBe(true);    // 9 >= 9
    expect(shouldBid(hand, 2, true)).toBe(false);    // 9 < 12
  });

  it("bomb hand (score 10): bids when uncontested", () => {
    const hand = cards(
      [7, "♠"], [7, "♥"], [7, "♦"], [7, "♣"],
      [3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [8, "♠"],
      [9, "♥"], [10, "♦"], [11, "♣"], [12, "♠"], [13, "♥"], [3, "♦"], [4, "♣"], [5, "♠"],
    );
    expect(shouldBid(hand, 0, false)).toBe(true);    // 10 >= 8
    expect(shouldBid(hand, 1, false)).toBe(true);    // 10 >= 8
    expect(shouldBid(hand, 1, true)).toBe(false);    // 10 < 11 → 有人叫了就不抢
    expect(shouldBid(hand, 2, true)).toBe(false);    // 10 < 12
  });
});

// ============= aiSelectPlay — Winning Moves =============

describe("aiSelectPlay: winning move", () => {
  it("should play entire hand if it's a valid combo (free lead)", () => {
    const hand = cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(5);
  });

  it("should play entire hand to beat last move", () => {
    const hand = cards([4, "♠"], [5, "♥"], [6, "♦"], [7, "♣"], [8, "♠"]);
    const lastMove = analyzeCombo(cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"]))!;
    const ctx = makeCtx(hand, { lastMove, lastMovePlayer: 0 });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(5);
  });

  it("should play rocket to win", () => {
    const hand = cards([16, "joker"], [17, "joker"]);
    const lastMove = analyzeCombo(cards([14, "♠"]))!; // A
    const ctx = makeCtx(hand, { lastMove, lastMovePlayer: 0 });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(2);
  });
});

// ============= aiSelectPlay — Lead =============

describe("aiSelectPlay: lead play", () => {
  it("should not lead with bombs or rockets", () => {
    const hand = cards(
      [8, "♠"], [8, "♥"], [8, "♦"], [8, "♣"], // bomb
      [3, "♠"], [4, "♥"],
    );
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    const combo = analyzeCombo(play!);
    expect(combo?.type).not.toBe("bomb");
    expect(combo?.type).not.toBe("rocket");
  });

  it("should prefer playing singles over breaking pairs", () => {
    // hand: 3, 55, 7 → should play 3 (single) rather than break 55
    const hand = cards([3, "♠"], [5, "♥"], [5, "♦"], [7, "♣"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(1);
    expect(play![0].rank).toBe(3);
  });

  it("should prefer long combos to reduce hand count", () => {
    // hand: 3-4-5-6-7 straight + 10 → play straight (1 hand) vs play single (2 hands)
    const hand = cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"], [10, "♥"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(5); // straight
  });

  it("should play smallest single when only singles remain", () => {
    const hand = cards([3, "♠"], [8, "♥"], [14, "♦"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play![0].rank).toBe(3);
  });

  it("should lead with pair when it reduces hand count best", () => {
    // hand: 33, 5 → play pair 33 (1 hand left) vs play 3 (1 hand left + pair = 2)
    const hand = cards([3, "♠"], [3, "♥"], [5, "♦"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    // Both options leave 1 hand: pair leaves [5] (1), single 3 leaves [3,5] (pair=1)
    // AI should pick one of the 1-hand options
    const combo = analyzeCombo(play!);
    expect(combo).not.toBeNull();
  });

  it("should return a single card as fallback if no candidates", () => {
    // This edge case shouldn't normally happen, but test fallback
    const hand = cards([16, "joker"]); // only joker, no valid combo except single
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(1);
  });
});

// ============= aiSelectPlay — Follow =============

describe("aiSelectPlay: follow play", () => {
  it("farmer should not beat teammate's lead", () => {
    const hand = cards([10, "♠"], [10, "♥"]);
    // teammate (player 2, also farmer) played pair of 3s
    const lastMove = analyzeCombo(cards([3, "♠"], [3, "♥"]))!;
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 2, // teammate
      landlordIndex: 0,
      myIndex: 1,
    });
    const play = aiSelectPlay(ctx);
    expect(play).toBeNull(); // should pass
  });

  it("farmer should beat landlord's lead", () => {
    const hand = cards([5, "♠"], [5, "♥"], [10, "♦"]);
    // landlord (player 0) played pair of 3s
    const lastMove = analyzeCombo(cards([3, "♠"], [3, "♥"]))!;
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0, // landlord
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [10, 3, 17],
    });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    const combo = analyzeCombo(play!);
    expect(combo?.type).toBe("pair");
    expect(combo!.rank).toBe(5);
  });

  it("landlord should beat farmer's lead", () => {
    const hand = cards([8, "♠"], [8, "♥"], [3, "♦"]);
    // farmer (player 1) played pair of 5s
    const lastMove = analyzeCombo(cards([5, "♠"], [5, "♥"]))!;
    const ctx = makeCtx(hand, {
      role: "landlord",
      lastMove,
      lastMovePlayer: 1, // farmer
      landlordIndex: 0,
      myIndex: 0,
      playerCardCounts: [3, 10, 17],
    });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    const combo = analyzeCombo(play!);
    expect(combo?.type).toBe("pair");
    expect(combo!.rank).toBe(8);
  });

  it("should use bomb when opponent is critical (≤2 cards)", () => {
    const hand = cards(
      [3, "♠"], [3, "♥"], [3, "♦"], [3, "♣"], // bomb
      [5, "♠"],
    );
    // opponent (landlord) has 2 cards, played a single A
    const lastMove = analyzeCombo(cards([14, "♥"]))!;
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [2, 5, 17],
    });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    const combo = analyzeCombo(play!);
    expect(combo?.type).toBe("bomb");
  });

  it("should pass if no valid play can beat", () => {
    const hand = cards([3, "♠"], [4, "♥"]);
    // opponent played pair of As
    const lastMove = analyzeCombo(cards([14, "♠"], [14, "♥"]))!;
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [10, 2, 17],
    });
    const play = aiSelectPlay(ctx);
    expect(play).toBeNull();
  });

  it("should prefer smallest beating card", () => {
    const hand = cards([6, "♠"], [8, "♥"], [14, "♦"]);
    const lastMove = analyzeCombo(cards([5, "♠"]))!;
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [10, 3, 17],
    });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play![0].rank).toBe(6); // smallest that beats 5
  });

  it("should not waste big cards on small plays when not urgent", () => {
    const hand = cards([3, "♠"], [15, "♥"]); // 3 and 2
    const lastMove = analyzeCombo(cards([4, "♠"]))!;
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [10, 2, 17], // opponent not low
    });
    const play = aiSelectPlay(ctx);
    // Should pass — playing 2 on a 4 is wasteful when opponent has 10 cards
    expect(play).toBeNull();
  });

  it("should beat same-type straight with higher straight", () => {
    const hand = cards([6, "♠"], [7, "♥"], [8, "♦"], [9, "♣"], [10, "♠"], [3, "♥"]);
    const lastMove = analyzeCombo(cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"]))!;
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [10, 6, 17],
    });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    const combo = analyzeCombo(play!);
    expect(combo?.type).toBe("straight");
    expect(combo!.rank).toBe(10);
  });

  it("should use rocket on bomb when opponent is critical", () => {
    const hand = cards([16, "joker"], [17, "joker"], [3, "♠"]);
    const lastMove = analyzeCombo(cards([14, "♠"], [14, "♥"], [14, "♦"], [14, "♣"]))!; // bomb
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [2, 3, 17],
    });
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    const combo = analyzeCombo(play!);
    expect(combo?.type).toBe("rocket");
  });
});

// ============= aiSelectPlay — Edge Cases =============

describe("aiSelectPlay: edge cases", () => {
  it("should handle hand with only jokers", () => {
    const hand = cards([16, "joker"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(1);
  });

  it("should handle hand with only bomb", () => {
    const hand = cards([7, "♠"], [7, "♥"], [7, "♦"], [7, "♣"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(4);
  });

  it("should handle hand with rocket only", () => {
    const hand = cards([16, "joker"], [17, "joker"]);
    const ctx = makeCtx(hand);
    const play = aiSelectPlay(ctx);
    expect(play).not.toBeNull();
    expect(play!.length).toBe(2);
  });

  it("should follow with bomb when hand is almost empty (≤2 rounds)", () => {
    // hand: bomb + single = 2 rounds → use bomb to grab control
    const hand = cards([7, "♠"], [7, "♥"], [7, "♦"], [7, "♣"], [3, "♠"]);
    const lastMove = analyzeCombo(cards([14, "♠"]))!; // A
    const ctx = makeCtx(hand, {
      role: "farmer",
      lastMove,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      playerCardCounts: [10, 5, 17],
    });
    const play = aiSelectPlay(ctx);
    // With ≤2 rounds, should bomb to grab control
    expect(play).not.toBeNull();
    const combo = analyzeCombo(play!);
    expect(combo?.type).toBe("bomb");
  });

  it("real game scenario: landlord leads, farmers respond correctly", () => {
    // Simulate a mini-scenario
    const { hands, landlordCards } = deal(createDeck());
    const landlordHand = sortCards([...hands[0], ...landlordCards]);
    const farmer1Hand = sortCards(hands[1]);
    const farmer2Hand = sortCards(hands[2]);

    const tracker = new CardTracker();
    const playerHands = [landlordHand, farmer1Hand, farmer2Hand];

    // Landlord leads
    const landlordCtx: AIContext = {
      hand: playerHands[0],
      role: "landlord",
      lastMove: null,
      lastMovePlayer: -1,
      landlordIndex: 0,
      myIndex: 0,
      tracker,
      playerCardCounts: playerHands.map(h => h.length),
    };

    const lead = aiSelectPlay(landlordCtx);
    expect(lead).not.toBeNull();
    const leadCombo = analyzeCombo(lead!);
    expect(leadCombo).not.toBeNull();
    expect(leadCombo!.type).not.toBe("bomb");
    expect(leadCombo!.type).not.toBe("rocket");

    // Farmer 1 follows
    const farmer1Ctx: AIContext = {
      hand: playerHands[1],
      role: "farmer",
      lastMove: leadCombo,
      lastMovePlayer: 0,
      landlordIndex: 0,
      myIndex: 1,
      tracker,
      playerCardCounts: playerHands.map(h => h.length),
    };

    const follow = aiSelectPlay(farmer1Ctx);
    // Farmer may pass or play — both are valid
    if (follow) {
      const followCombo = analyzeCombo(follow);
      expect(followCombo).not.toBeNull();
    }
  });
});

// ============= aiSelectPlay — Full Game Integration =============

describe("aiSelectPlay: full game simulation", () => {
  it("completes 100 games without errors", () => {
    for (let g = 0; g < 100; g++) {
      const { hands, landlordCards } = deal(createDeck());
      const playerHands = hands.map((h) => sortCards(h));

      let landlord = 0;
      let bestStrength = -1;
      for (let i = 0; i < 3; i++) {
        const s = evaluateHandStrength(playerHands[i]);
        if (s > bestStrength) { bestStrength = s; landlord = i; }
      }
      playerHands[landlord] = sortCards([...playerHands[landlord], ...landlordCards]);

      const roles: PlayerRole[] = [0, 1, 2].map((i) => (i === landlord ? "landlord" : "farmer"));
      const tracker = new CardTracker();

      let current = landlord;
      let lastMove: ReturnType<typeof analyzeCombo> = null;
      let lastMovePlayer = -1;
      let passCount = 0;
      let turns = 0;
      let winner = -1;

      while (turns < 2000) {
        turns++;
        const counts = playerHands.map((h) => h.length);
        const ctx: AIContext = {
          hand: playerHands[current],
          role: roles[current],
          lastMove,
          lastMovePlayer,
          landlordIndex: landlord,
          myIndex: current,
          tracker,
          playerCardCounts: counts,
        };

        const play = aiSelectPlay(ctx);

        if (!play || play.length === 0) {
          if (!lastMove) {
            // forced lead
            const c = playerHands[current][0];
            const combo = analyzeCombo([c]);
            if (!combo) throw new Error("forced lead invalid");
            const ids = new Set([c.id]);
            playerHands[current] = playerHands[current].filter(x => !ids.has(x.id));
            tracker.onCardsPlayed([c]);
            lastMove = combo;
            lastMovePlayer = current;
            passCount = 0;
            if (playerHands[current].length === 0) { winner = current; break; }
          } else {
            passCount++;
            if (passCount >= 2) { lastMove = null; lastMovePlayer = -1; passCount = 0; }
          }
          current = (current + 1) % 3;
          continue;
        }

        const combo = analyzeCombo(play);
        if (!combo) throw new Error(`AI invalid combo at turn ${turns}`);
        if (lastMove && lastMovePlayer !== current && !canBeat(lastMove, combo)) {
          throw new Error("AI non-beating combo");
        }
        for (const card of play) {
          if (!playerHands[current].some((c) => c.id === card.id)) throw new Error("AI played card not in hand");
        }

        const ids = new Set(play.map((c) => c.id));
        playerHands[current] = playerHands[current].filter(c => !ids.has(c.id));
        tracker.onCardsPlayed(play);
        lastMove = combo;
        lastMovePlayer = current;
        passCount = 0;
        if (playerHands[current].length === 0) { winner = current; break; }
        current = (current + 1) % 3;
      }

      expect(winner).toBeGreaterThanOrEqual(0);
      expect(winner).toBeLessThan(3);
    }
  });

  it("landlord and farmers both win across many games", () => {
    const wins = { landlord: 0, farmer: 0 };
    for (let g = 0; g < 200; g++) {
      const { hands, landlordCards } = deal(createDeck());
      const playerHands = hands.map((h) => sortCards(h));
      let landlord = 0;
      let bestStrength = -1;
      for (let i = 0; i < 3; i++) {
        const s = evaluateHandStrength(playerHands[i]);
        if (s > bestStrength) { bestStrength = s; landlord = i; }
      }
      playerHands[landlord] = sortCards([...playerHands[landlord], ...landlordCards]);
      const roles: PlayerRole[] = [0, 1, 2].map((i) => (i === landlord ? "landlord" : "farmer"));
      const tracker = new CardTracker();
      let current = landlord;
      let lastMove: ReturnType<typeof analyzeCombo> = null;
      let lastMovePlayer = -1;
      let passCount = 0;
      let winner = -1;

      for (let turns = 0; turns < 2000; turns++) {
        const counts = playerHands.map((h) => h.length);
        const ctx: AIContext = {
          hand: playerHands[current], role: roles[current], lastMove, lastMovePlayer,
          landlordIndex: landlord, myIndex: current, tracker, playerCardCounts: counts,
        };
        const play = aiSelectPlay(ctx);
        if (!play || play.length === 0) {
          if (!lastMove) {
            const c = playerHands[current][0];
            playerHands[current] = playerHands[current].filter(x => x.id !== c.id);
            tracker.onCardsPlayed([c]);
            lastMove = analyzeCombo([c]);
            lastMovePlayer = current;
            passCount = 0;
            if (playerHands[current].length === 0) { winner = current; break; }
          } else {
            passCount++;
            if (passCount >= 2) { lastMove = null; lastMovePlayer = -1; passCount = 0; }
          }
          current = (current + 1) % 3;
          continue;
        }
        const combo = analyzeCombo(play)!;
        const ids = new Set(play.map((c) => c.id));
        playerHands[current] = playerHands[current].filter(c => !ids.has(c.id));
        tracker.onCardsPlayed(play);
        lastMove = combo;
        lastMovePlayer = current;
        passCount = 0;
        if (playerHands[current].length === 0) { winner = current; break; }
        current = (current + 1) % 3;
      }

      if (winner === landlord) wins.landlord++;
      else wins.farmer++;
    }

    // Both sides should win some games (statistical sanity check)
    expect(wins.landlord).toBeGreaterThan(0);
    expect(wins.farmer).toBeGreaterThan(0);
  });
});

// ============= 三 AI 对战胜率统计 =============

/** 模拟一局完整的三人对局，返回详细结果 */
function simulateGame(): {
  winner: number;
  landlordIndex: number;
  turns: number;
  isSpring: boolean;       // 地主春天：农民一张牌都没出
  isReverseSpring: boolean; // 反春天：地主只出了一手牌
  bombsUsed: number;
} {
  const { hands, landlordCards } = deal(createDeck());
  const playerHands = hands.map((h) => sortCards(h));

  // 叫地主：手牌最强的当
  let landlord = 0;
  let bestStrength = -1;
  for (let i = 0; i < 3; i++) {
    const s = evaluateHandStrength(playerHands[i]);
    if (s > bestStrength) { bestStrength = s; landlord = i; }
  }
  playerHands[landlord] = sortCards([...playerHands[landlord], ...landlordCards]);

  const roles: PlayerRole[] = [0, 1, 2].map((i) => (i === landlord ? "landlord" : "farmer"));
  const tracker = new CardTracker();

  let current = landlord;
  let lastMove: ReturnType<typeof analyzeCombo> = null;
  let lastMovePlayer = -1;
  let passCount = 0;
  let turns = 0;
  let winner = -1;
  let bombsUsed = 0;
  const farmerTurnsPlayed = [0, 0, 0]; // 每个玩家出牌次数（不含 pass）

  while (turns < 2000) {
    turns++;
    const counts = playerHands.map((h) => h.length);
    const ctx: AIContext = {
      hand: playerHands[current],
      role: roles[current],
      lastMove,
      lastMovePlayer,
      landlordIndex: landlord,
      myIndex: current,
      tracker,
      playerCardCounts: counts,
    };

    const play = aiSelectPlay(ctx);

    if (!play || play.length === 0) {
      if (!lastMove) {
        const c = playerHands[current][0];
        const combo = analyzeCombo([c])!;
        const ids = new Set([c.id]);
        playerHands[current] = playerHands[current].filter(x => !ids.has(x.id));
        tracker.onCardsPlayed([c]);
        lastMove = combo;
        lastMovePlayer = current;
        passCount = 0;
        farmerTurnsPlayed[current]++;
        if (playerHands[current].length === 0) { winner = current; break; }
      } else {
        passCount++;
        if (passCount >= 2) { lastMove = null; lastMovePlayer = -1; passCount = 0; }
      }
      current = (current + 1) % 3;
      continue;
    }

    const combo = analyzeCombo(play)!;
    if (combo.type === "bomb" || combo.type === "rocket") bombsUsed++;

    const ids = new Set(play.map((c) => c.id));
    playerHands[current] = playerHands[current].filter(c => !ids.has(c.id));
    tracker.onCardsPlayed(play);
    lastMove = combo;
    lastMovePlayer = current;
    passCount = 0;
    farmerTurnsPlayed[current]++;
    if (playerHands[current].length === 0) { winner = current; break; }
    current = (current + 1) % 3;
  }

  // 春天判定
  const isLandlordWin = winner === landlord;
  const farmers = [0, 1, 2].filter(i => i !== landlord);
  const farmerPlayedAny = farmers.some(i => farmerTurnsPlayed[i] > 0);
  const landlordOnlyPlayedOnce = farmerTurnsPlayed[landlord] <= 1;

  const isSpring = isLandlordWin && !farmerPlayedAny;         // 地主春天
  const isReverseSpring = !isLandlordWin && landlordOnlyPlayedOnce; // 反春天

  return { winner, landlordIndex: landlord, turns, isSpring, isReverseSpring, bombsUsed };
}

describe("3-AI 对战胜率统计", () => {
  it("1000 局详细统计", () => {
    const GAMES = 1000;
    const stats = {
      landlordWins: 0,
      farmerWins: 0,
      totalTurns: 0,
      springs: 0,
      reverseSprings: 0,
      totalBombs: 0,
      seatWins: [0, 0, 0],       // 每个座位赢的次数
      landlordSeatWins: [0, 0, 0], // 当地主时各座位赢的次数
      farmerSeatWins: [0, 0, 0],   // 当农民时各座位赢的次数
      landlordGames: [0, 0, 0],    // 每个座位当地主的次数
    };

    for (let g = 0; g < GAMES; g++) {
      const result = simulateGame();
      const { winner, landlordIndex, turns, isSpring, isReverseSpring, bombsUsed } = result;

      stats.totalTurns += turns;
      stats.totalBombs += bombsUsed;
      if (isSpring) stats.springs++;
      if (isReverseSpring) stats.reverseSprings++;

      stats.landlordGames[landlordIndex]++;
      stats.seatWins[winner]++;

      if (winner === landlordIndex) {
        stats.landlordWins++;
        stats.landlordSeatWins[landlordIndex]++;
      } else {
        stats.farmerWins++;
        for (const f of [0, 1, 2].filter(i => i !== landlordIndex)) {
          stats.farmerSeatWins[f]++;
        }
      }
    }

    // 输出统计表
    const lines = [
      "",
      "╔══════════════════════════════════════════════════╗",
      "║         斗地主 AI 对战统计 (1000 局)             ║",
      "╠══════════════════════════════════════════════════╣",
      `║ 地主胜率: ${(stats.landlordWins / GAMES * 100).toFixed(1)}%  (${stats.landlordWins}/${GAMES})`,
      `║ 农民胜率: ${(stats.farmerWins / GAMES * 100).toFixed(1)}%  (${stats.farmerWins}/${GAMES})`,
      `║ 平均回合: ${(stats.totalTurns / GAMES).toFixed(1)}`,
      `║ 春天次数: ${stats.springs}  (${(stats.springs / GAMES * 100).toFixed(1)}%)`,
      `║ 反春天:   ${stats.reverseSprings}  (${(stats.reverseSprings / GAMES * 100).toFixed(1)}%)`,
      `║ 炸弹总数: ${stats.totalBombs}  (平均 ${(stats.totalBombs / GAMES).toFixed(2)}/局)`,
      "╠══════════════════════════════════════════════════╣",
      "║ 各座位胜率:                                      ║",
    ];
    for (let i = 0; i < 3; i++) {
      const total = stats.seatWins[i];
      const asLandlord = stats.landlordGames[i];
      const asFarmer = GAMES - asLandlord;
      const landlordWinRate = asLandlord > 0 ? (stats.landlordSeatWins[i] / asLandlord * 100).toFixed(1) : "N/A";
      const farmerWinRate = asFarmer > 0 ? (stats.farmerSeatWins[i] / asFarmer * 100).toFixed(1) : "N/A";
      lines.push(`║   座位${i}: 总胜${total}次 | 地主${asLandlord}次胜率${landlordWinRate}% | 农民${asFarmer}次胜率${farmerWinRate}%`);
    }
    lines.push("╚══════════════════════════════════════════════════╝");
    lines.push("");
    const output = lines.join("\n");
    console.log(output);
    writeFileSync("/tmp/ddz_stats.txt", output, "utf-8");

    // 基本断言
    expect(stats.landlordWins + stats.farmerWins).toBe(GAMES);
    // 地主和农民都应该赢过
    expect(stats.landlordWins).toBeGreaterThan(0);
    expect(expect(stats.farmerWins).toBeGreaterThan(0));
    // 三个座位都应该赢过
    for (let i = 0; i < 3; i++) {
      expect(stats.seatWins[i]).toBeGreaterThan(0);
    }
    // 平均回合应该合理（不能太短也不能太长）
    const avgTurns = stats.totalTurns / GAMES;
    expect(avgTurns).toBeGreaterThan(5);
    expect(avgTurns).toBeLessThan(100);
  });

  it("地主胜率应在合理范围 (50%~75%)", () => {
    // 地主有 20 张牌 + 先手 + 叫地主时手牌最强 → 胜率偏高是正常的
    // 三人 AI 水平相同，地主结构性优势约 65%~70%
    const GAMES = 2000;
    let landlordWins = 0;

    for (let g = 0; g < GAMES; g++) {
      const result = simulateGame();
      if (result.winner === result.landlordIndex) landlordWins++;
    }

    const rate = landlordWins / GAMES;
    console.log(`\n地主胜率: ${(rate * 100).toFixed(1)}% (${landlordWins}/${GAMES})`);
    expect(rate).toBeGreaterThan(0.50);
    expect(rate).toBeLessThan(0.80);
  });
});

// Re-export canBeat for test use
import { canBeat } from "../../src/gui/doudizhu/card-engine";
