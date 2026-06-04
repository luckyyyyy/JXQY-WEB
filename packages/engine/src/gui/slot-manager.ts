/**
 * SlotManager - 老虎机小游戏（3×3 转轴）
 *
 * 8 种符号、5 条赔付线、百搭替代、免费旋转、大奖系统
 */

// ============= Types =============

export type SlotSymbol = "coin" | "envelope" | "koi" | "dragon" | "lucky7" | "bar" | "wild" | "scatter";

export interface WinLine {
  lineIndex: number;           // 0-4
  symbol: SlotSymbol;
  count: number;               // 2 or 3
  payout: number;
  positions: [number, number][]; // [row, col] pairs
}

export interface SlotSpinResult {
  reels: SlotSymbol[][];       // 3x3 grid: reels[row][col]
  winLines: WinLine[];
  totalWin: number;
  betAmount: number;
  freeSpinTriggered: boolean;
  jackpot: boolean;
  isFreeSpin: boolean;
}

// ============= Config =============

/** 符号权重（越高越常见） */
const SYMBOL_WEIGHTS: { symbol: SlotSymbol; weight: number }[] = [
  { symbol: "coin",     weight: 25 },
  { symbol: "envelope", weight: 25 },
  { symbol: "koi",      weight: 15 },
  { symbol: "bar",      weight: 15 },
  { symbol: "dragon",   weight: 8 },
  { symbol: "lucky7",   weight: 5 },
  { symbol: "wild",     weight: 5 },
  { symbol: "scatter",  weight: 3 },
];

const TOTAL_WEIGHT = SYMBOL_WEIGHTS.reduce((s, w) => s + w.weight, 0);

/** 赔付表（3 连配对的倍率） */
const PAYOUT_3: Record<SlotSymbol, number> = {
  lucky7:   50,
  dragon:   25,
  koi:      15,
  bar:      10,
  envelope: 5,
  coin:     3,
  wild:     0,    // 百搭不独立赔付
  scatter:  0,    // 散落走特殊逻辑
};

/** 2 连配对倍率（仅高价值符号） */
const PAYOUT_2: Partial<Record<SlotSymbol, number>> = {
  lucky7: 5,
  dragon: 3,
};

/** 赔付线定义：每条线是 3 个 [row, col] 位置 */
const PAYLINES: [number, number][][] = [
  [[0, 0], [0, 1], [0, 2]],  // 0: 上排
  [[1, 0], [1, 1], [1, 2]],  // 1: 中排
  [[2, 0], [2, 1], [2, 2]],  // 2: 下排
  [[0, 0], [1, 1], [2, 2]],  // 3: 对角线 ↘
  [[2, 0], [1, 1], [0, 2]],  // 4: 对角线 ↗
];

/** 免费旋转触发所需散落数 */
const SCATTER_TRIGGER_COUNT = 3;
/** 免费旋转次数 */
const FREE_SPIN_COUNT = 10;
/** 免费旋转倍率 */
const FREE_SPIN_MULTIPLIER = 2;
/** 大奖：中心线 3 个幸运7 */
const JACKPOT_MULTIPLIER = 100;

// ============= 随机加倍/惩罚台词 =============

const WIN_TEXTS = [
  "财神爷赏脸，多给一倍！",
  "手气爆棚，庄家哭了！",
  "天降横财，挡都挡不住！",
  "左眼跳财，今天准了！",
  "踩到四叶草了，幸运加倍！",
  "骰子看你帅，自己翻了个面！",
  "系统检测到你是天选之人！",
  "命运之轮转到了金色区域！",
  "量子力学说你必然会赢！",
  "程序员在代码里埋了彩蛋给你！",
];

const LOSE_TEXTS = [
  "恶鬼降临，转轴叛变了！",
  "穷神附体，越转越穷！",
  "扫把星今天盯上你了！",
  "今天不宜出行，更不宜赌博！",
  "你的星座今天水逆！",
  "银子觉得老板更帅，回去了！",
  "系统检测到你是非酋本酋！",
  "程序员在代码里埋了地雷给你！",
  "墨菲定律：会输的一定会输！",
  "骰子说它今天不想帮你！",
];

// ============= Utils =============

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

// ============= Manager =============

export class SlotManager {
  private _isOpen = false;
  private _betAmount = 0;
  private _initialMoney = 0;
  private _freeSpinsRemaining = 0;
  private _freeSpinMultiplier = 1;
  private playerRef: { money: number } | null = null;
  private slotVersion = 0;
  private onShowMessage: ((msg: string) => void) | null = null;
  private onUpdateView: (() => void) | null = null;

  setCallbacks(callbacks: { onShowMessage?: (msg: string) => void; onUpdateView?: () => void }) {
    if (callbacks.onShowMessage) this.onShowMessage = callbacks.onShowMessage;
    if (callbacks.onUpdateView) this.onUpdateView = callbacks.onUpdateView;
  }

  isOpen(): boolean { return this._isOpen; }
  get betAmount(): number { return this._betAmount; }
  get initialMoney(): number { return this._initialMoney; }
  get freeSpinsRemaining(): number { return this._freeSpinsRemaining; }
  getState() { return { isOpen: this._isOpen, betAmount: this._betAmount }; }
  getVersion(): number { return this.slotVersion; }

  startSlot(betAmount: number, player: { money: number }) {
    this._isOpen = true;
    this._betAmount = betAmount;
    this._initialMoney = player.money;
    this._freeSpinsRemaining = 0;
    this._freeSpinMultiplier = 1;
    this.playerRef = player;
    this.emitUpdate();
  }

  spin(multiplier: number = 1): SlotSpinResult | null {
    if (!this._isOpen || !this.playerRef) return null;

    const isFreeSpin = this._freeSpinsRemaining > 0;
    const mult = Math.max(1, Math.min(1000, Math.floor(multiplier)));
    const bet = isFreeSpin
      ? this._betAmount * mult
      : this._betAmount * mult;

    // 非免费旋转时扣钱
    if (!isFreeSpin) {
      if (this.playerRef.money < bet) {
        this.onShowMessage?.("银两不足！");
        return null;
      }
      this.playerRef.money -= bet;
    }

    // 扣减免费旋转次数
    if (isFreeSpin) {
      this._freeSpinsRemaining--;
    }

    // 生成转轴
    const reels = this.generateReels();

    // 评估赔付线
    const { winLines, totalWin: baseWin, jackpot } = this.evaluateWins(reels, bet);

    // 检查散落触发免费旋转
    let freeSpinTriggered = false;
    if (!isFreeSpin) {
      const scatterCount = reels.flat().filter(s => s === "scatter").length;
      if (scatterCount >= SCATTER_TRIGGER_COUNT) {
        freeSpinTriggered = true;
        this._freeSpinsRemaining += FREE_SPIN_COUNT;
        this._freeSpinMultiplier = FREE_SPIN_MULTIPLIER;
        this.onShowMessage?.(`💎 散落宝 ×${scatterCount}！触发 ${FREE_SPIN_COUNT} 次免费旋转！`);
      }
    }

    // 应用免费旋转倍率
    let totalWin = isFreeSpin ? Math.floor(baseWin * this._freeSpinMultiplier) : baseWin;

    // 随机加倍/惩罚（仅非大奖时）
    let bonusText: string | null = null;
    let penaltyText: string | null = null;

    if (totalWin > 0 && !jackpot) {
      const bonusRoll = Math.random();
      if (bonusRoll < 0.08) {
        totalWin *= 3;
        bonusText = pick(WIN_TEXTS);
      } else if (bonusRoll < 0.15) {
        totalWin *= 2;
        bonusText = pick(WIN_TEXTS);
      }
    } else if (totalWin === 0 && !isFreeSpin) {
      const penaltyRoll = Math.random();
      if (penaltyRoll < 0.05) {
        const extraLoss = Math.floor(bet * 0.5);
        if (this.playerRef.money >= extraLoss) {
          this.playerRef.money -= extraLoss;
        }
        penaltyText = pick(LOSE_TEXTS);
      }
    }

    // 发放奖金
    if (totalWin > 0) {
      this.playerRef.money += totalWin;
    }

    const netGain = totalWin - bet;

    this.emitUpdate();
    return {
      reels,
      winLines,
      totalWin,
      betAmount: bet,
      freeSpinTriggered,
      jackpot,
      isFreeSpin,
    };
  }

  endSlot() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._freeSpinsRemaining = 0;
    this._freeSpinMultiplier = 1;
    this.playerRef = null;
    this.emitUpdate();
  }

  hasEnoughMoney(): boolean {
    if (!this.playerRef) return false;
    if (this._freeSpinsRemaining > 0) return true;
    return this.playerRef.money >= this._betAmount;
  }

  // ============= 内部方法 =============

  private generateReels(): SlotSymbol[][] {
    const reels: SlotSymbol[][] = [];
    for (let row = 0; row < 3; row++) {
      const rowSymbols: SlotSymbol[] = [];
      for (let col = 0; col < 3; col++) {
        rowSymbols.push(this.pickSymbol());
      }
      reels.push(rowSymbols);
    }
    return reels;
  }

  private pickSymbol(): SlotSymbol {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const { symbol, weight } of SYMBOL_WEIGHTS) {
      r -= weight;
      if (r <= 0) return symbol;
    }
    return "coin";
  }

  private evaluateWins(reels: SlotSymbol[][], bet: number): { winLines: WinLine[]; totalWin: number; jackpot: boolean } {
    const winLines: WinLine[] = [];
    let totalWin = 0;
    let jackpot = false;

    for (let lineIdx = 0; lineIdx < PAYLINES.length; lineIdx++) {
      const positions = PAYLINES[lineIdx];
      const symbols = positions.map(([r, c]) => reels[r][c]);

      // 将百搭替换为有效符号
      const nonWild = symbols.filter(s => s !== "wild" && s !== "scatter");
      const effectiveSymbol = nonWild.length > 0 ? nonWild[0] : null;

      if (!effectiveSymbol) continue;

      // 检查是否全部匹配（百搭算匹配）
      const allMatch = symbols.every(s => s === effectiveSymbol || s === "wild");

      if (allMatch && symbols.length === 3) {
        let payout = PAYOUT_3[effectiveSymbol] ?? 0;

        // 大奖判定：中心线 3 个幸运7
        if (lineIdx === 1 && effectiveSymbol === "lucky7") {
          payout = JACKPOT_MULTIPLIER;
          jackpot = true;
        }

        if (payout > 0) {
          const winAmount = bet * payout;
          winLines.push({
            lineIndex: lineIdx,
            symbol: effectiveSymbol,
            count: 3,
            payout: winAmount,
            positions,
          });
          totalWin += winAmount;
        }
      } else {
        // 检查 2 连配对（前两个符号匹配）
        const first = symbols[0] === "wild" ? (symbols[1] !== "wild" && symbols[1] !== "scatter" ? symbols[1] : null) : symbols[0];
        if (first && PAYOUT_2[first]) {
          const secondMatch = symbols[1] === first || symbols[1] === "wild";
          if (secondMatch) {
            const payout = PAYOUT_2[first]!;
            const winAmount = bet * payout;
            winLines.push({
              lineIndex: lineIdx,
              symbol: first,
              count: 2,
              payout: winAmount,
              positions: [positions[0], positions[1]],
            });
            totalWin += winAmount;
          }
        }
      }
    }

    return { winLines, totalWin, jackpot };
  }

  private emitUpdate() {
    this.slotVersion++;
    this.onUpdateView?.();
  }
}
