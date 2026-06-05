/**
 * 斗地主游戏管理器
 *
 * 状态机：发牌 → 叫地主 → 出牌 → 结算
 */

import type { Card, Move, ComboType } from "./card-engine";
import {
  analyzeCombo,
  canBeat,
  createDeck,
  deal,
  sortCards,
} from "./card-engine";
import {
  type AIContext,
  type PlayerRole,
  aiSelectPlay,
  CardTracker,
  evaluateHandStrength,
} from "./ai-player";

// ============= Types =============

export type GamePhase = "idle" | "ready" | "dealing" | "bidding" | "playing" | "finished";
export type PlayerType = "human" | "ai";

export interface PlayerState {
  hand: Card[];
  role: PlayerRole;
  isLandlord: boolean;
  cardCount: number; // for display (opponent hidden)
}

export interface GameState {
  phase: GamePhase;
  players: PlayerState[];
  landlordIndex: number;
  landlordCards: Card[];
  currentPlayer: number;
  lastMove: Move | null;
  lastMovePlayer: number;
  passCount: number;
  winner: number; // -1 if not finished
  message: string;
  playedCards: Card[][]; // 每个玩家最近打出的牌（用于显示）
  passFlags: boolean[]; // 每个玩家本轮是否「不出」
  bombCount: number; // 炸弹/火箭计数
  multiplier: number; // 当前倍率
  betAmount: number;
}

export interface DoudizhuCallbacks {
  onStateChange: () => void;
  onShowMessage: (msg: string) => void;
}

// ============= Manager =============

export class DoudizhuManager {
  private _isOpen = false;
  private _betAmount = 0;
  private _initialMoney = 0;
  private playerRef: { money: number } | null = null;
  private version = 0;
  private callbacks: DoudizhuCallbacks | null = null;

  // Game state
  private phase: GamePhase = "idle";
  private players: PlayerState[] = [];
  private landlordIndex = -1;
  private landlordCards: Card[] = [];
  private currentPlayer = 0;
  private lastMove: Move | null = null;
  private lastMovePlayer = -1;
  private passCount = 0;
  private winner = -1;
  private message = "";
  private playedCards: Card[][] = [[], [], []];
  private passFlags: boolean[] = [false, false, false];
  private bombCount = 0;
  private multiplier = 1;
  private playCounts: number[] = [0, 0, 0];
  private springLabel = "";
  private tracker = new CardTracker();

  // Bidding
  private biddingPlayer = 0;
  private biddingPassed = 0;
  private landlordCandidate = -1;

  setCallbacks(cb: DoudizhuCallbacks): void {
    this.callbacks = cb;
  }

  isOpen(): boolean { return this._isOpen; }
  getState(): GameState {
    return {
      phase: this.phase,
      players: this.players.map(p => ({
        ...p,
        hand: p.isLandlord || this.isHumanPlayer(this.players.indexOf(p)) ? p.hand : [],
      })),
      landlordIndex: this.landlordIndex,
      landlordCards: this.landlordCards,
      currentPlayer: this.currentPlayer,
      lastMove: this.lastMove,
      lastMovePlayer: this.lastMovePlayer,
      passCount: this.passCount,
      winner: this.winner,
      message: this.message,
      playedCards: this.playedCards,
      passFlags: this.passFlags,
      bombCount: this.bombCount,
      multiplier: this.multiplier,
      betAmount: this._betAmount,
    };
  }

  getFullState(): GameState {
    return {
      phase: this.phase,
      players: this.players,
      landlordIndex: this.landlordIndex,
      landlordCards: this.landlordCards,
      currentPlayer: this.currentPlayer,
      lastMove: this.lastMove,
      lastMovePlayer: this.lastMovePlayer,
      passCount: this.passCount,
      winner: this.winner,
      message: this.message,
      playedCards: this.playedCards,
      passFlags: this.passFlags,
      bombCount: this.bombCount,
      multiplier: this.multiplier,
      betAmount: this._betAmount,
    };
  }

  // ============= Game Lifecycle =============

  /** 打开斗地主面板，进入「准备」状态，等待玩家点击开始（不自动发牌） */
  startGame(betAmount: number, player: { money: number }): void {
    this._isOpen = true;
    this._betAmount = betAmount;
    this._initialMoney = player.money;
    this.playerRef = player;
    this.phase = "ready";
    this.winner = -1;
    this.bombCount = 0;
    this.multiplier = 1;
    this.players = [];
    this.landlordIndex = -1;
    this.landlordCards = [];
    this.lastMove = null;
    this.lastMovePlayer = -1;
    this.tracker.reset();
    this.playedCards = [[], [], []];
    this.passFlags = [false, false, false];
    this.playCounts = [0, 0, 0];
    this.message = "准备开始";
    this.emitUpdate();
  }

  /** 玩家点击「开始」后真正发牌 */
  beginGame(): void {
    if (!this._isOpen) return;
    this.phase = "dealing";
    this.winner = -1;
    this.bombCount = 0;
    this.multiplier = 1;
    this.tracker.reset();
    this.playedCards = [[], [], []];
    this.passFlags = [false, false, false];
    this.playCounts = [0, 0, 0];

    const deck = createDeck();
    const { hands, landlordCards } = deal(deck);

    this.players = [
      { hand: sortCards(hands[0]), role: "farmer", isLandlord: false, cardCount: 17 },
      { hand: sortCards(hands[1]), role: "farmer", isLandlord: false, cardCount: 17 },
      { hand: sortCards(hands[2]), role: "farmer", isLandlord: false, cardCount: 17 },
    ];
    this.landlordCards = landlordCards;
    this.message = "发牌中…";

    this.emitUpdate();

    // Start bidding after the deal animation
    setTimeout(() => this.startBidding(), 1500);
  }

  endGame(): void {
    this._isOpen = false;
    this.phase = "idle";
    this.emitUpdate();
  }

  restartGame(): void {
    if (!this._isOpen || !this.playerRef) return;
    this.beginGame();
  }

  // ============= Bidding =============

  private startBidding(): void {
    this.phase = "bidding";
    this.biddingPlayer = Math.floor(Math.random() * 3);
    this.biddingPassed = 0;
    this.landlordCandidate = -1;
    this.currentPlayer = this.biddingPlayer;
    this.message =
      this.biddingPlayer === 0 ? "请叫地主" : `${this.playerName(this.biddingPlayer)}正在叫地主…`;
    this.emitUpdate();

    // AI auto-bid
    if (this.biddingPlayer !== 0) {
      setTimeout(() => this.aiBid(), 1000);
    }
  }

  /** Player bids (true = bid, false = pass) */
  playerBid(bid: boolean): void {
    if (this.phase !== "bidding" || this.currentPlayer !== 0) return;

    if (bid) {
      this.landlordCandidate = 0;
      this.biddingPassed = 0;
      this.message = "你叫了地主！";
    } else {
      this.biddingPassed++;
      this.message = "你不叫";
    }

    this.emitUpdate();

    if (this.biddingPassed >= 3 && this.landlordCandidate === -1) {
      // Nobody bid, redeal
      this.message = "没人叫地主，重新发牌";
      this.emitUpdate();
      setTimeout(() => this.beginGame(), 2000);
      return;
    }

    if (this.landlordCandidate >= 0) {
      // Someone bid, they're the landlord
      setTimeout(() => this.setLandlord(this.landlordCandidate), 1000);
      return;
    }

    // Next player bids
    this.biddingPlayer = (this.biddingPlayer + 1) % 3;
    this.currentPlayer = this.biddingPlayer;
    this.emitUpdate();

    if (this.biddingPlayer !== 0) {
      setTimeout(() => this.aiBid(), 1000);
    }
  }

  private aiBid(): void {
    const hand = this.players[this.biddingPlayer].hand;
    const strength = evaluateHandStrength(hand);
    const shouldBid = strength >= 8; // AI threshold

    if (shouldBid) {
      this.landlordCandidate = this.biddingPlayer;
      this.biddingPassed = 0;
      this.message = `${this.playerName(this.biddingPlayer)}叫地主`;
    } else {
      this.biddingPassed++;
      this.message = `${this.playerName(this.biddingPlayer)}不叫`;
    }

    this.emitUpdate();

    if (this.biddingPassed >= 3 && this.landlordCandidate === -1) {
      this.message = "没人叫地主，重新发牌";
      this.emitUpdate();
      setTimeout(() => this.beginGame(), 2000);
      return;
    }

    if (this.landlordCandidate >= 0) {
      setTimeout(() => this.setLandlord(this.landlordCandidate), 1000);
      return;
    }

    this.biddingPlayer = (this.biddingPlayer + 1) % 3;
    this.currentPlayer = this.biddingPlayer;
    this.emitUpdate();

    if (this.biddingPlayer !== 0) {
      setTimeout(() => this.aiBid(), 1000);
    }
  }

  private setLandlord(index: number): void {
    this.landlordIndex = index;

    // Give landlord the 3 cards
    this.players[index].hand = sortCards([...this.players[index].hand, ...this.landlordCards]);
    this.players[index].isLandlord = true;
    this.players[index].role = "landlord";
    this.players[index].cardCount = 20;

    // Set farmers
    for (let i = 0; i < 3; i++) {
      if (i !== index) {
        this.players[i].role = "farmer";
      }
    }

    this.message = `${this.playerName(index)}成为地主！`;
    this.phase = "playing";
    this.currentPlayer = index;
    this.lastMove = null;
    this.lastMovePlayer = -1;
    this.passCount = 0;
    this.emitUpdate();

    // If landlord is AI, play first
    if (index !== 0) {
      setTimeout(() => this.aiPlay(), 1500);
    }
  }

  // ============= Playing =============

  /** Human player plays cards */
  playerPlay(cards: Card[]): boolean {
    if (this.phase !== "playing" || this.currentPlayer !== 0) return false;

    const combo = analyzeCombo(cards);

    // Pass
    if (cards.length === 0) {
      return this.doPass(0);
    }

    if (!combo) {
      this.message = "无效牌型！";
      this.emitUpdate();
      return false;
    }

    // Need to beat last move
    if (this.lastMove && this.lastMovePlayer !== 0) {
      if (!canBeat(this.lastMove, combo)) {
        this.message = "管不上！";
        this.emitUpdate();
        return false;
      }
    }

    this.doPlay(0, cards, combo);
    return true;
  }

  /** Human player passes */
  playerPass(): boolean {
    if (this.phase !== "playing" || this.currentPlayer !== 0) return false;
    if (!this.lastMove || this.lastMovePlayer === 0) {
      this.message = "你必须出牌！";
      this.emitUpdate();
      return false;
    }
    return this.doPass(0);
  }

  private doPlay(playerIndex: number, cards: Card[], combo: Move): void {
    // Remove cards from hand
    const hand = this.players[playerIndex].hand;
    const newHand = hand.filter(c => !cards.some(played => played.id === c.id));
    this.players[playerIndex].hand = newHand;
    this.players[playerIndex].cardCount = newHand.length;

    // Track played cards
    this.tracker.onCardsPlayed(cards);
    this.playedCards[playerIndex] = cards;
    this.passFlags = [false, false, false];
    this.playCounts[playerIndex]++;

    // Update game state
    this.lastMove = combo;
    this.lastMovePlayer = playerIndex;
    this.passCount = 0;

    // 倍率：王炸 ×20、炸弹 ×4、超级牌型 ×2
    if (combo.type === "rocket") {
      this.bombCount++;
      this.multiplier *= 20;
      this.message = `${this.playerName(playerIndex)}放出王炸！倍率 ×20`;
    } else if (combo.type === "bomb") {
      this.bombCount++;
      this.multiplier *= 4;
      this.message = `${this.playerName(playerIndex)}放出炸弹！倍率 ×4`;
    } else if (this.isSuperCombo(combo)) {
      this.multiplier *= 2;
      this.message = `${this.playerName(playerIndex)}打出${this.getComboName(combo.type)}！倍率 ×2`;
    } else {
      this.message = `${this.playerName(playerIndex)}出了${this.getComboName(combo.type)}`;
    }

    // Check win
    if (newHand.length === 0) {
      this.winner = playerIndex;
      this.phase = "finished";
      this.handleWin(playerIndex);
      return;
    }

    this.emitUpdate();
    this.nextTurn();
  }

  private doPass(playerIndex: number): boolean {
    this.passCount++;
    this.playedCards[playerIndex] = [];
    this.passFlags[playerIndex] = true;
    this.message = `${this.playerName(playerIndex)}不出`;

    // If 2 passes, next player leads (table clears)
    if (this.passCount >= 2) {
      this.lastMove = null;
      this.lastMovePlayer = -1;
      this.passCount = 0;
      this.passFlags = [false, false, false];
      this.playedCards = [[], [], []];
    }

    this.emitUpdate();
    this.nextTurn();
    return true;
  }

  private nextTurn(): void {
    this.currentPlayer = (this.currentPlayer + 1) % 3;

    // If back to last move player, they lead
    if (this.currentPlayer === this.lastMovePlayer) {
      this.lastMove = null;
      this.passCount = 0;
    }

    this.emitUpdate();

    // AI turn
    if (this.currentPlayer !== 0) {
      setTimeout(() => this.aiPlay(), 1200);
    }
  }

  private aiPlay(): void {
    if (this.phase !== "playing") return;

    const ctx: AIContext = {
      hand: this.players[this.currentPlayer].hand,
      role: this.players[this.currentPlayer].role,
      lastMove: this.lastMove,
      lastMovePlayer: this.lastMovePlayer,
      landlordIndex: this.landlordIndex,
      myIndex: this.currentPlayer,
      tracker: this.tracker,
      playerCardCounts: this.players.map(p => p.cardCount),
    };

    const cards = aiSelectPlay(ctx);

    if (cards && cards.length > 0) {
      const combo = analyzeCombo(cards);
      if (combo) {
        this.doPlay(this.currentPlayer, cards, combo);
        return;
      }
    }

    // Pass
    this.doPass(this.currentPlayer);
  }

  // ============= Win Handling =============

  private handleWin(winnerIndex: number): void {
    const winnerRole = this.players[winnerIndex].role;
    const playerIsLandlord = this.players[0].role === "landlord";

    // 春天 / 反春天：×4
    const farmers = [0, 1, 2].filter((i) => i !== this.landlordIndex);
    if (winnerRole === "landlord" && farmers.every((i) => this.playCounts[i] === 0)) {
      this.multiplier *= 4; // 春天
      this.springLabel = "春天";
    } else if (winnerRole === "farmer" && this.playCounts[this.landlordIndex] <= 1) {
      this.multiplier *= 4; // 反春天
      this.springLabel = "反春天";
    } else {
      this.springLabel = "";
    }

    const prize = this._betAmount * this.multiplier;
    const playerWon = winnerRole === this.players[0].role;
    const spring = this.springLabel ? `${this.springLabel}！` : "";

    if (playerWon) {
      this.playerRef!.money += prize;
      this.message = `${spring}${playerIsLandlord ? "地主" : "农民"}胜利！×${this.multiplier} 共 +${prize.toLocaleString()} 两`;
    } else {
      this.playerRef!.money -= prize;
      this.message = `${spring}${winnerRole === "landlord" ? "地主" : "农民"}胜利 ×${this.multiplier}，-${prize.toLocaleString()} 两`;
    }

    this.emitUpdate();
  }

  /** 超级牌型（额外加倍）：7+ 顺子、4+ 连对、3+ 飞机 */
  private isSuperCombo(combo: Move): boolean {
    if (combo.type === "straight") return combo.cards.length >= 7;
    if (combo.type === "straight_pair") return combo.cards.length >= 8;
    if (combo.type === "plane" || combo.type === "plane_single" || combo.type === "plane_pair") {
      const groups = combo.type === "plane" ? combo.cards.length / 3
        : combo.type === "plane_single" ? combo.cards.length / 4
        : combo.cards.length / 5;
      return groups >= 3;
    }
    return false;
  }

  // ============= Helpers =============

  private isHumanPlayer(index: number): boolean {
    return index === 0; // Player 0 is always human
  }

  private playerName(index: number): string {
    return index === 0 ? "你" : index === 1 ? "下家" : "上家";
  }

  private getComboName(type: ComboType): string {
    const names: Record<string, string> = {
      single: "单张", pair: "对子", triple: "三条",
      triple_one: "三带一", triple_pair: "三带二",
      straight: "顺子", straight_pair: "连对",
      plane: "飞机", plane_single: "飞机带单", plane_pair: "飞机带对",
      four_two: "四带二", bomb: "炸弹", rocket: "火箭",
    };
    return names[type ?? ""] ?? "牌";
  }

  private emitUpdate(): void {
    this.version++;
    this.callbacks?.onStateChange();
  }
}
