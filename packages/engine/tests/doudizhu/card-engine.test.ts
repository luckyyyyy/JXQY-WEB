/**
 * 斗地主牌型引擎测试
 */

import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../../src/gui/doudizhu/card-engine";
import {
  analyzeCombo,
  canBeat,
  createDeck,
  deal,
  findValidPlays,
  isValidPlay,
  sortCards,
} from "../../src/gui/doudizhu/card-engine";

// ============= Helpers =============

function card(rank: Rank, suit: Suit | "joker" = "♠"): Card {
  return { rank, suit, id: `${suit}${rank}` };
}

function cards(...specs: Array<[Rank, Suit | "joker"]>): Card[] {
  return specs.map(([r, s]) => card(r, s));
}

// ============= Deck Tests =============

describe("createDeck", () => {
  it("should create 54 cards", () => {
    const deck = createDeck();
    expect(deck.length).toBe(54);
  });

  it("should have 4 suits × 13 ranks + 2 jokers", () => {
    const deck = createDeck();
    const jokers = deck.filter(c => c.suit === "joker");
    const normal = deck.filter(c => c.suit !== "joker");
    expect(jokers.length).toBe(2);
    expect(normal.length).toBe(52);
  });
});

describe("deal", () => {
  it("should deal 17 cards to each player and 3 landlord cards", () => {
    const deck = createDeck();
    const { hands, landlordCards } = deal(deck);
    expect(hands[0].length).toBe(17);
    expect(hands[1].length).toBe(17);
    expect(hands[2].length).toBe(17);
    expect(landlordCards.length).toBe(3);
  });

  it("should deal all 54 cards with no duplicates", () => {
    const deck = createDeck();
    const { hands, landlordCards } = deal(deck);
    const all = [...hands[0], ...hands[1], ...hands[2], ...landlordCards];
    const ids = new Set(all.map(c => c.id));
    expect(ids.size).toBe(54);
  });
});

// ============= Combo Detection Tests =============

describe("analyzeCombo", () => {
  it("should detect single", () => {
    const combo = analyzeCombo(cards([3, "♠"]));
    expect(combo?.type).toBe("single");
    expect(combo?.rank).toBe(3);
  });

  it("should detect pair", () => {
    const combo = analyzeCombo(cards([5, "♠"], [5, "♥"]));
    expect(combo?.type).toBe("pair");
    expect(combo?.rank).toBe(5);
  });

  it("should detect triple", () => {
    const combo = analyzeCombo(cards([7, "♠"], [7, "♥"], [7, "♦"]));
    expect(combo?.type).toBe("triple");
    expect(combo?.rank).toBe(7);
  });

  it("should detect triple_one", () => {
    const combo = analyzeCombo(cards([7, "♠"], [7, "♥"], [7, "♦"], [3, "♠"]));
    expect(combo?.type).toBe("triple_one");
    expect(combo?.rank).toBe(7);
  });

  it("should detect triple_pair", () => {
    const combo = analyzeCombo(cards([7, "♠"], [7, "♥"], [7, "♦"], [3, "♠"], [3, "♥"]));
    expect(combo?.type).toBe("triple_pair");
    expect(combo?.rank).toBe(7);
  });

  it("should detect straight (5 cards)", () => {
    const combo = analyzeCombo(cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"]));
    expect(combo?.type).toBe("straight");
    expect(combo?.rank).toBe(7);
  });

  it("should detect straight (6 cards)", () => {
    const combo = analyzeCombo(cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"], [8, "♥"]));
    expect(combo?.type).toBe("straight");
    expect(combo?.rank).toBe(8);
  });

  it("should not allow straight with 2", () => {
    const combo = analyzeCombo(cards([10, "♠"], [11, "♥"], [12, "♦"], [13, "♣"], [14, "♠"], [15, "♥"]));
    expect(combo).toBeNull();
  });

  it("should detect straight_pair", () => {
    const combo = analyzeCombo(cards(
      [3, "♠"], [3, "♥"],
      [4, "♦"], [4, "♣"],
      [5, "♠"], [5, "♥"],
    ));
    expect(combo?.type).toBe("straight_pair");
    expect(combo?.rank).toBe(5);
  });

  it("should detect bomb", () => {
    const combo = analyzeCombo(cards([8, "♠"], [8, "♥"], [8, "♦"], [8, "♣"]));
    expect(combo?.type).toBe("bomb");
    expect(combo?.rank).toBe(8);
  });

  it("should detect rocket", () => {
    const combo = analyzeCombo(cards([16, "joker"], [17, "joker"]));
    expect(combo?.type).toBe("rocket");
    expect(combo?.rank).toBe(17);
  });

  it("should reject invalid combo", () => {
    expect(analyzeCombo(cards([3, "♠"], [5, "♥"]))).toBeNull();
    expect(analyzeCombo(cards([3, "♠"], [3, "♥"], [5, "♦"]))).toBeNull();
  });
});

// ============= Can Beat Tests =============

describe("canBeat", () => {
  it("higher single beats lower single", () => {
    const m1 = analyzeCombo(cards([3, "♠"]))!;
    const m2 = analyzeCombo(cards([5, "♥"]))!;
    expect(canBeat(m1, m2)).toBe(true);
    expect(canBeat(m2, m1)).toBe(false);
  });

  it("same rank single cannot beat", () => {
    const m1 = analyzeCombo(cards([5, "♠"]))!;
    const m2 = analyzeCombo(cards([5, "♥"]))!;
    expect(canBeat(m1, m2)).toBe(false);
  });

  it("bomb beats non-bomb", () => {
    const single = analyzeCombo(cards([14, "♠"]))!;
    const bomb = analyzeCombo(cards([3, "♠"], [3, "♥"], [3, "♦"], [3, "♣"]))!;
    expect(canBeat(single, bomb)).toBe(true);
  });

  it("rocket beats everything", () => {
    const bomb = analyzeCombo(cards([14, "♠"], [14, "♥"], [14, "♦"], [14, "♣"]))!;
    const rocket = analyzeCombo(cards([16, "joker"], [17, "joker"]))!;
    expect(canBeat(bomb, rocket)).toBe(true);
  });

  it("higher bomb beats lower bomb", () => {
    const b1 = analyzeCombo(cards([5, "♠"], [5, "♥"], [5, "♦"], [5, "♣"]))!;
    const b2 = analyzeCombo(cards([8, "♠"], [8, "♥"], [8, "♦"], [8, "♣"]))!;
    expect(canBeat(b1, b2)).toBe(true);
  });

  it("pair beats pair of same rank is false", () => {
    const p1 = analyzeCombo(cards([7, "♠"], [7, "♥"]))!;
    const p2 = analyzeCombo(cards([7, "♦"], [7, "♣"]))!;
    expect(canBeat(p1, p2)).toBe(false);
  });

  it("straight of same length: higher beats lower", () => {
    const s1 = analyzeCombo(cards([3, "♠"], [4, "♥"], [5, "♦"], [6, "♣"], [7, "♠"]))!;
    const s2 = analyzeCombo(cards([4, "♠"], [5, "♥"], [6, "♦"], [7, "♣"], [8, "♠"]))!;
    expect(canBeat(s1, s2)).toBe(true);
  });

  it("different types cannot beat (except bomb/rocket)", () => {
    const pair = analyzeCombo(cards([10, "♠"], [10, "♥"]))!;
    const triple = analyzeCombo(cards([3, "♠"], [3, "♥"], [3, "♦"]))!;
    expect(canBeat(pair, triple)).toBe(false);
  });
});

// ============= findValidPlays Tests =============

describe("findValidPlays", () => {
  it("should find all singles that beat last single", () => {
    const hand = cards([3, "♠"], [5, "♥"], [8, "♦"], [14, "♣"]);
    const lastMove = analyzeCombo(cards([6, "♠"]))!;
    const plays = findValidPlays(hand, lastMove);
    expect(plays.length).toBe(2); // 8 and A can beat 6
  });

  it("should find all combos when free play", () => {
    const hand = cards([3, "♠"], [3, "♥"], [5, "♦"], [5, "♣"], [8, "♠"]);
    const plays = findValidPlays(hand, null);
    expect(plays.length).toBeGreaterThan(0);
    // Should include: 5 singles, 2 pairs, etc
    const hasSingle = plays.some(p => p.length === 1);
    const hasPair = plays.some(p => p.length === 2);
    expect(hasSingle).toBe(true);
    expect(hasPair).toBe(true);
  });

  it("should always include bombs as option", () => {
    const hand = cards([3, "♠"], [3, "♥"], [3, "♦"], [3, "♣"], [5, "♠"]);
    const lastMove = analyzeCombo(cards([14, "♠"]))!; // Ace
    const plays = findValidPlays(hand, lastMove);
    const hasBomb = plays.some(p => p.length === 4 && p.every(c => c.rank === 3));
    expect(hasBomb).toBe(true);
  });

  it("should find rocket as option", () => {
    const hand = cards([16, "joker"], [17, "joker"], [3, "♠"]);
    const lastMove = analyzeCombo(cards([14, "♠"], [14, "♥"], [14, "♦"], [14, "♣"]))!; // bomb
    const plays = findValidPlays(hand, lastMove);
    const hasRocket = plays.some(p => p.length === 2 && p.some(c => c.rank === 16) && p.some(c => c.rank === 17));
    expect(hasRocket).toBe(true);
  });
});

// ============= Sort Tests =============

describe("sortCards", () => {
  it("should sort by rank ascending", () => {
    const unsorted = cards([10, "♠"], [3, "♥"], [14, "♦"], [7, "♣"]);
    const sorted = sortCards(unsorted);
    expect(sorted.map(c => c.rank)).toEqual([3, 7, 10, 14]);
  });

  it("should put jokers at the end", () => {
    const unsorted = cards([16, "joker"], [5, "♠"], [17, "joker"], [3, "♥"]);
    const sorted = sortCards(unsorted);
    expect(sorted[sorted.length - 1].rank).toBe(17);
    expect(sorted[sorted.length - 2].rank).toBe(16);
  });
});
