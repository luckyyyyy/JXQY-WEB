/**
 * GambleManager - 骰子赌博小游戏（6 骰子）
 * 含随机加倍/惩罚、随机事件、特殊牌型，100+ 搞笑台词
 */

export type BetChoice = "big" | "small" | "odd" | "even" | "fourKind" | "threePairs" | "sextuple";

export interface DiceResult {
  dice: number[];
  sum: number;
  win: boolean;
  betAmount: number;
  netGain: number;
  randomBonus: number;
  randomPenalty: number;
  bonusText: string | null;    // 随机加倍台词
  penaltyText: string | null;  // 随机惩罚台词
  specialEvent: string | null;
  comboBonus: string | null;
  comboBonusAmount: number;
}

// ============= 100+ 搞笑台词 =============

const WIN_TEXTS = [
  "财神爷路过，赏你一锭金！",
  "赌神转世，运气爆棚！",
  "老板娘看上你了，多给点！",
  "骰子被你的王霸之气震慑！",
  "天降横财，挡都挡不住！",
  "月老牵线，你和银子有缘！",
  "观音菩萨保佑，多赏几两！",
  "灶王爷上天言好事，给你加薪！",
  "龙王三太子偷偷帮你吹了口气！",
  "土地公公暗中给你开了后门！",
  "二郎神的哮天犬叼来了银子！",
  "太白金星喝醉了，随手赏你的！",
  "哪吒踩着风火轮给你送钱来了！",
  "孙悟空偷蟠桃顺便帮你赢了一把！",
  "猪八戒赌输了把银子押你头上了！",
  "阎王爷说你阳寿未尽，赏你点钱花！",
  "黑白无常打赌输了，银子归你！",
  "牛头马面偷偷给你塞了红包！",
  "判官笔一抖，多写了几个零！",
  "孟婆汤里加了财运符！",
  "轮回转世，上辈子你是赌圣！",
  "前世积德，这辈子骰子听你的话！",
  "你妈给你求的护身符显灵了！",
  "隔壁老王偷偷帮你拜了财神！",
  "算命先生说你今天走大运！",
  "黄大仙附体，手气逆天！",
  "狐狸精被你的帅气迷住了，送钱！",
  "蛇精给你吐了颗转运珠！",
  "树精老了眼花，把银子算多了！",
  "山神爷今天心情好多赏了点！",
  "河神问你掉的是金骰子还是银骰子？",
  "城隍爷给你批了个上上签！",
  "文昌帝君说你不光有才还有财！",
  "关二爷义薄云天，赏你酒钱！",
  "赵公明骑着黑虎给你送元宝！",
  "利市仙官给你开了财运光！",
  "招财童子抱着金蟾来找你了！",
  "五路财神齐聚，今天你是主角！",
  "福禄寿三星报喜，加钱加钱！",
  "喜鹊枝头叫，好事要来到！",
  "左眼跳财，今天准了！",
  "出门踩到狗屎运了！",
  "捡到一枚铜钱，以小博大！",
  "今天穿了红内裤，运气挡不住！",
  "早上吃了根油条，两个蛋！",
  "踩到四叶草了，幸运加倍！",
  "看到流星许了个愿，灵了！",
  "骰子看你帅，自己翻了个面！",
  "银子觉得你比老板可爱，投奔你了！",
  "赌场里的风水轮流转到你了！",
  "今天黄历写着：宜赌博，大吉！",
  "你身上散发的荷尔蒙影响了骰子！",
  "骰子六面都朝上，庄家懵了！",
  "老板打瞌睡，多找了你一倍！",
  "掌柜的算盘珠子崩了，算多了！",
  "账房先生老花眼，数字看错了！",
  "老板娘心情好多退了点！",
  "伙计手一抖，钱袋子翻了！",
  "小二上错了菜，赔你的！",
  "隔壁桌的酒洒你身上了，赔钱！",
  "房梁上的老鼠打翻了钱罐子！",
  "一只喜鹊叼来了银子！",
  "乌鸦嘴今天说了好话！",
  "黄鼠狼给鸡拜年，顺便送你钱！",
  "兔子蹬鹰，歪打正着！",
  "瞎猫碰上死耗子，赢了！",
  "天上掉馅饼，正好砸你头上！",
  "出门遇贵人，贵人请你赌一把！",
  "朋友借你的人品用了一下！",
  "你的RP今天爆发了！",
  "系统检测到你是天选之人！",
  "命运之轮转到了金色区域！",
  "宇宙的能量汇聚在你手上！",
  "量子力学说你必然会赢！",
  "薛定谔的骰子，开出来是赢！",
  "蝴蝶效应：一只蝴蝶帮你扇了一下！",
  "暗物质在帮你推骰子！",
  "你触发了隐藏成就：运气之王！",
  "游戏管理员偷偷给你开了挂！",
  "程序员在代码里埋了彩蛋给你！",
  "服务器抽风了，多吐了点钱！",
  "数据库溢出，银子溢到你兜里了！",
  "网线被老鼠咬了，数据多传了一倍！",
  "光纤里跑太快，银子多带了几两！",
  "CPU过热算错了，你赚了！",
  "内存泄漏，银子漏到你账上了！",
  "这把不算，老板请你再来一把！",
  "隔壁桌的大哥看不下去了，赏你的！",
  "围观群众众筹给你的小费！",
  "赌场做活动，你是幸运顾客！",
  "开业大酬宾，多送一倍！",
  "老板说今天薄利多销！",
  "掌柜的说你是回头客，打折！",
  "VIP会员专属加成！",
  "你集齐了七颗龙珠，召唤了神龙！",
  "神龙实现愿望：再来一倍！",
  "你打开了潘多拉的盒子，里面是银子！",
  "阿拉丁神灯：第三个愿望是加钱！",
  "魔法少女变身成功，附赠财运！",
  "你吃了恶魔果实，赌赌果实能力者！",
  "鸣人的影分身帮你摇了骰子！",
  "路飞的橡皮手多伸了一下！",
  "柯南推理出骰子会倒向你这边！",
  "小当家发光料理吃多了，手气发光！",
];

const LOSE_TEXTS = [
  "恶鬼降临，骰子叛变了！",
  "老板娘发威，加倍罚款！",
  "厉鬼索命，银两飞了！",
  "黑白无常来收账了！",
  "阎王爷说你该交保护费了！",
  "判官笔一划，银子没了！",
  "孟婆汤喝多了，算错了注！",
  "牛头马面把你的银子牵走了！",
  "夜叉鬼从地底钻出来抢钱了！",
  "饿鬼道的鬼魂闻到银子味了！",
  "僵尸王在骰子上做了手脚！",
  "吸血鬼伯爵吸走了你的财运！",
  "狼人月圆之夜变身，顺走了银子！",
  "木乃伊复活了，裹走了你的钱！",
  "弗兰肯斯坦的怪物不高兴了！",
  "贞子从骰子里爬出来了！",
  "伽椰子在你背后！回头看看？",
  "楚人美唱着粤剧来收账了！",
  "笔仙在骰子上画了个叉！",
  "碟仙说你今天不宜赌博！",
  "水鬼在骰子里灌了水！",
  "吊死鬼把你的银子吊走了！",
  "饿死鬼把你的钱袋吃空了！",
  "穷神附体，越赌越穷！",
  "扫把星今天盯上你了！",
  "太岁头上动土，出事了！",
  "冲撞了煞星，破财消灾！",
  "犯太岁了，诸事不顺！",
  "本命年没穿红内裤！",
  "左眼跳灾，今天应验了！",
  "出门踩到香蕉皮了！",
  "乌鸦在你头上拉了屎！",
  "踩到猫尾巴了，猫诅咒你！",
  "打翻了醋坛子，酸死了！",
  "今天不宜出行，更不宜赌博！",
  "黄历写着：忌赌博，破财！",
  "你的星座今天水逆！",
  "塔罗牌抽到了倒吊人！",
  "算命先生说你今天破财！",
  "风水先生说这个位置漏财！",
  "骰子觉得你太嚣张了！",
  "银子觉得老板更帅，回去了！",
  "赌场的风水对你不利！",
  "今天穿了绿帽子，运气差！",
  "出门摔了一跤，运气也摔没了！",
  "打了个喷嚏，运气跟着飞了！",
  "放了个屁，把银子崩飞了！",
  "流年不利，命犯小人！",
  "今天是十三号星期五！",
  "你触发了隐藏成就：倒霉蛋！",
  "命运之轮转到了黑色区域！",
  "暗能量在吞噬你的银子！",
  "量子隧穿效应，银子穿墙跑了！",
  "薛定谔的骰子，开出来是输！",
  "熵增定律：你的运气在减少！",
  "你掉进了概率的陷阱！",
  "墨菲定律：会输的一定会输！",
  "蝴蝶效应：一只蝴蝶帮倒忙！",
  "混沌理论说你今天该输！",
  "程序员写的bug被你触发了！",
  "服务器抽风了，少吐了钱！",
  "数据库主键冲突，银子回滚了！",
  "网速太慢，银子在半路丢了！",
  "光纤被挖断了，数据丢失！",
  "CPU过热算错了，你亏了！",
  "内存溢出，银子溢没了！",
  "老板看你顺眼多收了点！",
  "掌柜的算盘打得噼里啪啦！",
  "账房先生今天精神不错算得清！",
  "伙计手稳，一分没多给！",
  "小二说概不赊账！",
  "隔壁桌的大哥笑出了声！",
  "围观群众纷纷摇头！",
  "赌场的风水大师在做法！",
  "你踩到了赌场的风水阵！",
  "骰子里灌了铅，不过不是你的铅！",
  "庄家出千了，可惜你没证据！",
  "荷官手速太快你没看清！",
  "赌场的猫头鹰盯着你看！",
  "乌鸦嘴说你今天必输！",
  "今天出门方向不对！",
  "星座运势显示不宜赌博！",
  "水星逆行影响了你的判断！",
  "你被幸运女神抛弃了！",
  "衰神今天特别关照你！",
  "你的RP余额不足！",
  "系统检测到你是非酋本酋！",
  "游戏管理员看你不顺眼！",
  "程序员在代码里埋了地雷给你！",
  "这把不算，老板让你再来一把！",
  "隔壁桌大妈的杀气影响了骰子！",
  "你身后站着一个红衣女鬼！",
  "镜子里的你在朝你笑！",
  "午夜十二点的钟声响了！",
  "骰子说它今天不想帮你！",
];

// ============= Random Event Texts =============

const EVENT_TEXTS = {
  godOfWealth: "🧧 财神降临！白送一注！",
  dealerShake: "😰 庄家手抖了！赔率翻倍！",
  turnLuck: "🍀 时来运转！化险为夷！",
  disaster: "💀 天降横祸！煮熟的鸭子飞了！",
  charityChild: "👼 散财童子来啦！退还一半！",
};

// ============= Utils =============

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

// ============= Manager =============

export class GambleManager {
  private _isOpen = false;
  private _betAmount = 0;
  private _initialMoney = 0;
  private playerRef: { money: number } | null = null;
  private gambleVersion = 0;
  private onShowMessage: ((msg: string) => void) | null = null;
  private onUpdateView: (() => void) | null = null;

  setCallbacks(callbacks: { onShowMessage?: (msg: string) => void; onUpdateView?: () => void }) {
    if (callbacks.onShowMessage) this.onShowMessage = callbacks.onShowMessage;
    if (callbacks.onUpdateView) this.onUpdateView = callbacks.onUpdateView;
  }

  isOpen(): boolean { return this._isOpen; }
  get betAmount(): number { return this._betAmount; }
  get initialMoney(): number { return this._initialMoney; }
  getState() { return { isOpen: this._isOpen, betAmount: this._betAmount }; }
  getVersion(): number { return this.gambleVersion; }

  startGamble(betAmount: number, player: { money: number }) {
    this._isOpen = true;
    this._betAmount = betAmount;
    this._initialMoney = player.money;
    this.playerRef = player;
    this.emitUpdate();
  }

  rollDice(choice: BetChoice, multiplier: number = 1): DiceResult | null {
    if (!this._isOpen || !this.playerRef) return null;

    const bet = this._betAmount * Math.max(1, Math.min(1000, multiplier));
    if (this.playerRef.money < bet) {
      this.onShowMessage?.("银两不足！");
      return null;
    }

    this.playerRef.money -= bet;

    const dice = Array.from({ length: 6 }, () => rand(1, 6));
    const sum = dice.reduce((a, b) => a + b, 0);

    const counts = new Map<number, number>();
    for (const d of dice) counts.set(d, (counts.get(d) ?? 0) + 1);
    const maxCount = Math.max(...counts.values());
    const pairCount = [...counts.values()].filter((c) => c === 2).length;
    const isThreePairs = pairCount === 3 && maxCount === 2;
    const isFourKind = maxCount >= 4;
    const isSextuple = maxCount >= 6;

    // 输赢判定
    let playerWins = false;
    let odds = 2;
    switch (choice) {
      case "big":        playerWins = !isFourKind && sum >= 21; odds = 2; break;
      case "small":      playerWins = !isFourKind && sum <= 20; odds = 2; break;
      case "odd":        playerWins = !isFourKind && sum % 2 === 1; odds = 2; break;
      case "even":       playerWins = !isFourKind && sum % 2 === 0; odds = 2; break;
      case "fourKind":   playerWins = isFourKind; odds = 10; break;
      case "threePairs": playerWins = isThreePairs; odds = 25; break;
      case "sextuple":   playerWins = isSextuple; odds = 100; break;
    }

    // 随机事件（~6%）
    let specialEvent: string | null = null;
    const eventRoll = Math.random();
    if (eventRoll < 0.02) {
      specialEvent = EVENT_TEXTS.godOfWealth;
      this.playerRef.money += bet;
    } else if (eventRoll < 0.035) {
      specialEvent = EVENT_TEXTS.dealerShake;
      odds *= 2;
    } else if (eventRoll < 0.045) {
      if (!playerWins) { specialEvent = EVENT_TEXTS.turnLuck; playerWins = true; }
    } else if (eventRoll < 0.055) {
      if (playerWins) { specialEvent = EVENT_TEXTS.disaster; playerWins = false; }
    } else if (eventRoll < 0.065) {
      specialEvent = EVENT_TEXTS.charityChild;
      this.playerRef.money += Math.floor(bet / 2);
    }

    // 计算收益
    let netGain: number;
    let randomBonus = 1;
    let randomPenalty = 1;
    let bonusText: string | null = null;
    let penaltyText: string | null = null;

    if (playerWins) {
      const bonusRoll = Math.random();
      if (bonusRoll < 0.08) { randomBonus = 5; }
      else if (bonusRoll < 0.15) { randomBonus = 3; }
      else if (bonusRoll < 0.25) { randomBonus = 2; }
      else if (bonusRoll < 0.4) { randomBonus = 1.5; }

      if (randomBonus > 1) bonusText = pick(WIN_TEXTS);
      const totalWin = Math.floor(bet * odds * randomBonus);
      this.playerRef.money += totalWin;
      netGain = totalWin - bet;
    } else {
      const penaltyRoll = Math.random();
      if (penaltyRoll < 0.05) { randomPenalty = 3; }
      else if (penaltyRoll < 0.1) { randomPenalty = 2; }
      else if (penaltyRoll < 0.2) { randomPenalty = 1.5; }

      if (randomPenalty > 1) penaltyText = pick(LOSE_TEXTS);
      const extraLoss = Math.floor(bet * (randomPenalty - 1));
      if (extraLoss > 0 && this.playerRef.money >= extraLoss) {
        this.playerRef.money -= extraLoss;
      } else if (extraLoss > 0) {
        // 钱不够就扣光
        this.playerRef.money = Math.max(0, this.playerRef.money);
      }
      netGain = -(bet + extraLoss);
    }

    // 特殊牌型奖励
    let comboBonus: string | null = null;
    let comboBonusAmount = 0;
    if (playerWins) {
      const sorted = [...dice].sort().join(",");
      const isStraight = sorted === "1,2,3,4,5,6";
      const allOdd = dice.every((d) => d % 2 === 1);
      const allEven = dice.every((d) => d % 2 === 0);
      const allHigh = dice.every((d) => d >= 4);
      const allLow = dice.every((d) => d <= 3);

      if (isStraight) {
        comboBonus = "📏 顺子！额外奖励！";
        comboBonusAmount = bet * 2;
      } else if (allOdd) {
        comboBonus = "🌑 全奇！额外奖励！";
        comboBonusAmount = bet;
      } else if (allEven) {
        comboBonus = "☀ 全偶！额外奖励！";
        comboBonusAmount = bet;
      } else if (allHigh && maxCount < 4) {
        comboBonus = "⬆ 全大！额外奖励！";
        comboBonusAmount = Math.floor(bet * 0.5);
      } else if (allLow && maxCount < 4) {
        comboBonus = "⬇ 全小！额外奖励！";
        comboBonusAmount = Math.floor(bet * 0.5);
      }

      if (comboBonusAmount > 0) {
        this.playerRef.money += comboBonusAmount;
        netGain += comboBonusAmount;
      }
    }

    this.emitUpdate();
    return { dice, sum, win: playerWins, betAmount: bet, netGain, randomBonus, randomPenalty, bonusText, penaltyText, specialEvent, comboBonus, comboBonusAmount };
  }

  endGamble() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.playerRef = null;
    this.emitUpdate();
  }

  hasEnoughMoney(): boolean {
    if (!this.playerRef) return false;
    return this.playerRef.money >= this._betAmount;
  }

  private emitUpdate() {
    this.gambleVersion++;
    this.onUpdateView?.();
  }
}
