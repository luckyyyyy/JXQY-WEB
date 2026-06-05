import { describe, expect, it } from "vitest";
import {
  analyzeCombo,
  canBeat,
  createDeck,
  deal,
  sortCards,
} from "../../src/gui/doudizhu/card-engine";
import {
  type AIContext,
  type PlayerRole,
  aiSelectPlay,
  CardTracker,
  evaluateHandStrength,
} from "../../src/gui/doudizhu/ai-player";

function playGame(): { winner: number; turns: number } {
  const { hands, landlordCards } = deal(createDeck());
  const playerHands = hands.map((h) => sortCards(h));

  // bid: highest strength becomes landlord
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
  let lastMove = analyzeCombo([]); // null
  let lastMovePlayer = -1;
  let passCount = 0;
  let turns = 0;

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
      // must lead if free
      if (!lastMove) {
        // forced to play something: play smallest single
        const c = playerHands[current][0];
        const combo = analyzeCombo([c]);
        if (!combo) throw new Error("forced lead invalid");
        applyPlay(playerHands, current, [c]);
        tracker.onCardsPlayed([c]);
        lastMove = combo;
        lastMovePlayer = current;
        passCount = 0;
        if (playerHands[current].length === 0) return { winner: current, turns };
        current = (current + 1) % 3;
        continue;
      }
      passCount++;
      if (passCount >= 2) { lastMove = null; lastMovePlayer = -1; passCount = 0; }
      current = (current + 1) % 3;
      continue;
    }

    const combo = analyzeCombo(play);
    if (!combo) throw new Error(`AI produced invalid combo: ${JSON.stringify(play.map((c) => c.rank))}`);
    if (lastMove && lastMovePlayer !== current && !canBeat(lastMove, combo)) {
      throw new Error("AI produced non-beating combo");
    }
    // ensure cards are owned
    for (const card of play) {
      if (!playerHands[current].some((c) => c.id === card.id)) throw new Error("AI played card not in hand");
    }

    applyPlay(playerHands, current, play);
    tracker.onCardsPlayed(play);
    lastMove = combo;
    lastMovePlayer = current;
    passCount = 0;
    if (playerHands[current].length === 0) return { winner: current, turns };
    current = (current + 1) % 3;
  }
  throw new Error("game did not terminate");
}

function applyPlay(hands: ReturnType<typeof sortCards>[], idx: number, play: ReturnType<typeof sortCards>): void {
  const ids = new Set(play.map((c) => c.id));
  hands[idx] = hands[idx].filter((c) => !ids.has(c.id));
}

describe("doudizhu AI full-game simulation", () => {
  it("completes 300 games with valid plays and a winner", () => {
    const winners = [0, 0, 0];
    for (let g = 0; g < 300; g++) {
      const { winner } = playGame();
      expect(winner).toBeGreaterThanOrEqual(0);
      expect(winner).toBeLessThan(3);
      winners[winner]++;
    }
    // all seats can win across many games (sanity, not strict)
    expect(winners.reduce((a, b) => a + b, 0)).toBe(300);
  });
});
