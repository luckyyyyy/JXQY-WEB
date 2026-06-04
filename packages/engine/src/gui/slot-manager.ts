/**
 * SlotManager - 老虎机小游戏（5×5 转轴）
 *
 * 8 种符号、8 条赔付线、3/4/5 连阶梯赔率、百搭替代、免费旋转、大奖系统
 */

// ============= Types =============

export type SlotSymbol = "coin" | "envelope" | "koi" | "dragon" | "lucky7" | "bar" | "wild" | "scatter";

export interface WinLine {
  lineIndex: number;
  symbol: SlotSymbol;
  count: number;               // 3, 4, or 5
  payout: number;
  positions: [number, number][];
}

export interface SlotSpinResult {
  reels: SlotSymbol[][];       // 5x5 grid: reels[row][col]
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

/**
 * 阶梯赔付表: PAYOUT[symbol][count] = 倍率
 * count = 连线中匹配符号数（3/4/5）
 */
const PAYOUT: Record<SlotSymbol, Record<number, number>> = {
  lucky7:   { 3: 10, 4: 25, 5: 80 },
  dragon:   { 3: 8,  4: 18, 5: 50 },
  koi:      { 3: 5,  4: 12, 5: 30 },
  bar:      { 3: 4,  4: 10, 5: 25 },
  envelope: { 3: 2,  4: 5,  5: 12 },
  coin:     { 3: 1,  4: 3,  5: 8 },
  wild:     { 3: 0, 4: 0, 5: 0 },
  scatter:  { 3: 0, 4: 0, 5: 0 },
};

/**
 * 8 条赔付线（5×5 网格）
 * 每条线是 5 个 [row, col] 位置
 */
const PAYLINES: [number, number][][] = [
  // 横线
  [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],  // 0: 第2行
  [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],  // 1: 第3行（中心）
  [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]],  // 2: 第4行
  // 竖线
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],  // 3: 中列
  // 对角线
  [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]],  // 4: ↘
  [[4, 0], [3, 1], [2, 2], [1, 3], [0, 4]],  // 5: ↗
  // 折线
  [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],  // 6: V 形
  [[4, 0], [3, 1], [2, 2], [3, 3], [4, 4]],  // 7: 倒 V
];

const PAYLINE_NAMES = ["第2行", "中心行", "第4行", "中列", "↘对角", "↗对角", "V形", "倒V"];

/** 散落触发免费旋转所需数量 */
const SCATTER_TRIGGER_COUNT = 3;
/** 免费旋转次数 */
const FREE_SPIN_COUNT = 10;
/** 免费旋转倍率 */
const FREE_SPIN_MULTIPLIER = 2;
/** 大奖：中心线 5 个幸运7 */
const JACKPOT_MULTIPLIER = 200;

// ============= 随机加倍/惩罚台词 =============

const WIN_TEXTS = [
  "财神爷赏脸，多给一倍！",
  "手气爆棚，庄家哭了！",
  "天降横财，挡都挡不住！",
  "左眼跳财，今天准了！",
  "踩到四叶草了，幸运加倍！",
  "系统检测到你是天选之人！",
  "命运之轮转到了金色区域！",
  "量子力学说你必然会赢！",
  "程序员在代码里埋了彩蛋给你！",
  "财神转世，运气爆棚！",
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
    const bet = this._betAmount * mult;

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

    // 生成 5×5 转轴
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
        totalWin *= 2;
        bonusText = pick(WIN_TEXTS);
      } else if (bonusRoll < 0.15) {
        totalWin = Math.floor(totalWin * 1.5);
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
    for (let row = 0; row < 5; row++) {
      const rowSymbols: SlotSymbol[] = [];
      for (let col = 0; col < 5; col++) {
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

      // 从左到右扫描：百搭在前算通配，遇到第一个真符号后锁定，之后必须匹配
      let matchCount = 0;
      let effectiveSymbol: SlotSymbol | null = null;
      for (const sym of symbols) {
        if (sym === "wild") {
          matchCount++;
        } else if (sym === "scatter") {
          break;
        } else if (effectiveSymbol === null) {
          // 遇到第一个真符号，锁定
          effectiveSymbol = sym;
          matchCount++;
        } else if (sym === effectiveSymbol) {
          matchCount++;
        } else {
          break;
        }
      }

      if (!effectiveSymbol || matchCount < 3) continue;

      const payoutRate = PAYOUT[effectiveSymbol]?.[matchCount] ?? 0;
      if (payoutRate <= 0) continue;

      // 大奖：中心线 5 个幸运7
      if (lineIdx === 1 && effectiveSymbol === "lucky7" && matchCount === 5) {
        const winAmount = bet * JACKPOT_MULTIPLIER;
        winLines.push({ lineIndex: lineIdx, symbol: effectiveSymbol, count: 5, payout: winAmount, positions });
        totalWin += winAmount;
        jackpot = true;
        continue;
      }

      const winAmount = bet * payoutRate;
      winLines.push({
        lineIndex: lineIdx,
        symbol: effectiveSymbol,
        count: matchCount,
        payout: winAmount,
        positions: positions.slice(0, matchCount),
      });
      totalWin += winAmount;
    }

    return { winLines, totalWin, jackpot };
  }

  private emitUpdate() {
    this.slotVersion++;
    this.onUpdateView?.();
  }
}
