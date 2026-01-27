/**
 * 游戏数据常量 - 物品、武功等列表
 *
 * 统一存放调试面板和其他地方使用的游戏数据常量
 * Based on JxqyHD Helper/cheat.txt
 */

/**
 * 物品分类
 */
export const GOODS_CATEGORIES = [
  "全部",
  "药品",
  "武器",
  "头饰",
  "项链",
  "衣服",
  "披风",
  "护腕",
  "鞋子",
  "秘籍",
  "事件",
] as const;

export type GoodsCategory = (typeof GOODS_CATEGORIES)[number];

/**
 * 物品信息
 */
export interface GoodsInfo {
  name: string;
  file: string;
  category: Exclude<GoodsCategory, "全部">;
}

/**
 * 所有可添加的物品列表
 */
export const ALL_GOODS: GoodsInfo[] = [
  // 药品 (Drugs)
  { name: "金花", file: "Goods-m00-金花.ini", category: "药品" },
  { name: "银花", file: "Goods-m01-银花.ini", category: "药品" },
  { name: "玄参", file: "Goods-m02-玄参.ini", category: "药品" },
  { name: "黄钟李", file: "Goods-m03-黄钟李.ini", category: "药品" },
  { name: "续弦胶", file: "Goods-m04-续弦胶.ini", category: "药品" },
  { name: "葫芦枣", file: "Goods-m05-葫芦枣.ini", category: "药品" },
  { name: "紫梨", file: "Goods-m06-紫梨.ini", category: "药品" },
  { name: "生黄芩", file: "Goods-m07-生黄芩.ini", category: "药品" },
  { name: "积云草", file: "Goods-m08-积云草.ini", category: "药品" },
  { name: "冰蚕", file: "Goods-m09-冰蚕.ini", category: "药品" },
  { name: "珊瑚", file: "Goods-m10-珊瑚.ini", category: "药品" },
  { name: "荀草", file: "Goods-m11-荀草.ini", category: "药品" },
  { name: "梅梁", file: "Goods-m12-梅梁.ini", category: "药品" },
  { name: "迷谷", file: "Goods-m13-迷谷.ini", category: "药品" },
  { name: "连翘", file: "Goods-m14-连翘.ini", category: "药品" },
  { name: "屈失草", file: "Goods-m15-屈失草.ini", category: "药品" },
  { name: "龙须草", file: "Goods-m16-龙须草.ini", category: "药品" },
  { name: "五羊石", file: "Goods-m17-五羊石.ini", category: "药品" },
  { name: "月桂子", file: "Goods-m18-月桂子.ini", category: "药品" },
  { name: "丹木", file: "Goods-m19-丹木.ini", category: "药品" },

  // 武器 (Weapons)
  { name: "青铜剑", file: "goods-w00-青铜剑.ini", category: "武器" },
  { name: "柳叶剑", file: "goods-w01-柳叶剑.ini", category: "武器" },
  { name: "夜光剑", file: "goods-w02-夜光剑.ini", category: "武器" },
  { name: "双龙剑", file: "goods-w03-双龙剑.ini", category: "武器" },
  { name: "磐龙剑", file: "goods-w04-磐龙剑.ini", category: "武器" },
  { name: "御灵剑", file: "goods-w05-御灵剑.ini", category: "武器" },
  { name: "紫锋剑", file: "goods-w06-紫锋剑.ini", category: "武器" },
  { name: "青霜剑", file: "goods-w07-青霜剑.ini", category: "武器" },
  { name: "太阿剑", file: "goods-w08-太阿剑.ini", category: "武器" },
  { name: "龙泉剑", file: "goods-w09-龙泉剑.ini", category: "武器" },
  { name: "月华剑", file: "goods-w10-月华剑.ini", category: "武器" },
  { name: "悲魔之刃", file: "goods-w11-悲魔之刃.ini", category: "武器" },
  { name: "桃木剑", file: "goods-w12-桃木剑.ini", category: "武器" },
  { name: "飞鱼剑", file: "goods-w13-飞鱼剑.ini", category: "武器" },
  { name: "流云剑", file: "goods-w14-流云剑.ini", category: "武器" },
  { name: "莫邪剑", file: "goods-w15-莫邪剑.ini", category: "武器" },
  { name: "断玉剑", file: "goods-w16-断玉剑.ini", category: "武器" },
  { name: "分水剑", file: "goods-w17-分水剑.ini", category: "武器" },
  { name: "干将剑", file: "goods-w18-干将剑.ini", category: "武器" },
  { name: "土龙刀", file: "goods-w19-土龙刀.ini", category: "武器" },
  { name: "独孤剑", file: "goods-w20-独孤剑.ini", category: "武器" },

  // 头饰 (Head)
  { name: "幅巾", file: "Goods-h00-幅巾.ini", category: "头饰" },
  { name: "缳纱帽", file: "Goods-h02-缳纱帽.ini", category: "头饰" },
  { name: "天麻冠", file: "Goods-h04-天麻冠.ini", category: "头饰" },
  { name: "轩辕冠", file: "Goods-h06-轩辕冠.ini", category: "头饰" },
  { name: "金璎珞", file: "Goods-h08-金璎珞.ini", category: "头饰" },
  { name: "九龙冠", file: "Goods-h09-九龙冠.ini", category: "头饰" },
  { name: "相思环", file: "Goods-h11-相思环.ini", category: "头饰" },
  { name: "五雷珠", file: "Goods-h12-五雷珠.ini", category: "头饰" },
  { name: "七宝珠钗", file: "Goods-h14-七宝珠钗.ini", category: "头饰" },
  { name: "五色玉", file: "Goods-h16-五色玉.ini", category: "头饰" },
  { name: "夜明珠", file: "Goods-h18-夜明珠.ini", category: "头饰" },

  // 项链 (Neck)
  { name: "铁镂项圈", file: "goods-n00-铁镂项圈.ini", category: "项链" },
  { name: "辟邪串珠", file: "Goods-n02-辟邪串珠.ini", category: "项链" },
  { name: "蓝钻石挂链", file: "Goods-n04-蓝钻石挂链.ini", category: "项链" },
  { name: "象牙挂链", file: "Goods-n06-象牙挂链.ini", category: "项链" },
  { name: "沉香挂链", file: "Goods-n07-沉香挂链.ini", category: "项链" },
  { name: "翡玉念珠", file: "Goods-n08-翡玉念珠.ini", category: "项链" },
  { name: "碧玉挂链", file: "goods-n10-碧玉挂链.ini", category: "项链" },
  { name: "白玉项圈", file: "Goods-n11-白玉项圈.ini", category: "项链" },
  { name: "八卦镜", file: "Goods-n12-八卦镜.ini", category: "项链" },
  { name: "紫霞玉佩", file: "goods-n13-紫霞玉佩.ini", category: "项链" },

  // 衣服 (Body)
  { name: "白刃衫", file: "Goods-b00-白刃衫.ini", category: "衣服" },
  { name: "紫罗袍", file: "Goods-b02-紫罗袍.ini", category: "衣服" },
  { name: "灰羽袍", file: "Goods-b04-灰羽袍.ini", category: "衣服" },
  { name: "皂罗袍", file: "Goods-b06-皂罗袍.ini", category: "衣服" },
  { name: "霓裳羽衣", file: "Goods-b09-霓裳羽衣.ini", category: "衣服" },
  { name: "银叶甲", file: "Goods-b10-银叶甲.ini", category: "衣服" },
  { name: "天罡战甲", file: "Goods-b13-天罡战甲.ini", category: "衣服" },
  { name: "昆仑铠", file: "Goods-b15-昆仑铠.ini", category: "衣服" },
  { name: "飞雁羽衣", file: "Goods-b17-飞雁羽衣.ini", category: "衣服" },
  { name: "金缕玉衣", file: "Goods-b18-金缕玉衣.ini", category: "衣服" },

  // 披风 (Back)
  { name: "鹿皮披风", file: "Goods-p00-鹿皮披风.ini", category: "披风" },
  { name: "豹纹披风", file: "Goods-p02-豹纹披风.ini", category: "披风" },
  { name: "牧野披风", file: "Goods-p04-牧野披风.ini", category: "披风" },
  { name: "夜行披风", file: "Goods-p06-夜行披风.ini", category: "披风" },
  { name: "冰绫披风", file: "Goods-p08-冰绫披风.ini", category: "披风" },
  { name: "蝉翼披风", file: "Goods-p10-蝉翼披风.ini", category: "披风" },
  { name: "天蚕披风", file: "Goods-p12-天蚕披风.ini", category: "披风" },
  { name: "乘风披", file: "Goods-p14-乘风披.ini", category: "披风" },
  { name: "柳湖侠披", file: "Goods-p16-柳湖侠披.ini", category: "披风" },
  { name: "弧月披风", file: "Goods-p18-弧月披风.ini", category: "披风" },

  // 护腕 (Wrist)
  { name: "灿银镯", file: "Goods-r00-灿银镯.ini", category: "护腕" },
  { name: "天豹扣", file: "Goods-r02-天豹扣.ini", category: "护腕" },
  { name: "羊脂白玉环", file: "Goods-r04-羊脂白玉环.ini", category: "护腕" },
  { name: "双色金丝扣", file: "Goods-r06-双色金丝扣.ini", category: "护腕" },
  { name: "辟邪水晶手镯", file: "Goods-r08-辟邪水晶手镯.ini", category: "护腕" },

  // 鞋子 (Foot)
  { name: "布鞋", file: "Goods-f00-布鞋.ini", category: "鞋子" },
  { name: "高筒皮鞋", file: "Goods-f02-高筒皮鞋.ini", category: "鞋子" },
  { name: "远足鞋", file: "Goods-f04-远足鞋.ini", category: "鞋子" },
  { name: "防滑鞋", file: "Goods-f06-防滑鞋.ini", category: "鞋子" },
  { name: "速攻鞋", file: "Goods-f08-速攻鞋.ini", category: "鞋子" },
  { name: "凌云靴", file: "Goods-f10-凌云靴.ini", category: "鞋子" },
  { name: "逍遥靴", file: "Goods-f12-逍遥靴.ini", category: "鞋子" },
  { name: "潜踪靴", file: "Goods-f14-潜踪靴.ini", category: "鞋子" },
  { name: "绝尘靴", file: "Goods-f17-绝尘靴.ini", category: "鞋子" },
  { name: "追日之靴", file: "Goods-f18-追日之靴.ini", category: "鞋子" },

  // 秘籍 (Books)
  { name: "太极剑谱", file: "Book00-太极剑谱.ini", category: "秘籍" },
  { name: "风火雷", file: "Book01-风火雷.ini", category: "秘籍" },
  { name: "灭绝剑法", file: "Book02-灭绝剑法.ini", category: "秘籍" },
  { name: "醉花诀", file: "Book03-醉花诀.ini", category: "秘籍" },
  { name: "无忧剑法", file: "Book04-无忧剑法.ini", category: "秘籍" },
  { name: "逆转心经", file: "Book05-逆转心经.ini", category: "秘籍" },
  { name: "潮月剑法", file: "Book07-潮月剑法.ini", category: "秘籍" },
  { name: "云生结海", file: "Book08-云生结海.ini", category: "秘籍" },
  { name: "漫天花雨", file: "Book09-漫天花雨.ini", category: "秘籍" },
  { name: "孤烟逐云", file: "Book10-孤烟逐云.ini", category: "秘籍" },
  { name: "镇狱破天劲", file: "Book11-镇狱破天劲.ini", category: "秘籍" },
  { name: "金钟罩", file: "Book14-金钟罩.ini", category: "秘籍" },
  { name: "武道德经", file: "Book15-武道德经.ini", category: "秘籍" },

  // 事件物品 (Event items)
  { name: "木匣", file: "Goods-e00-木匣.ini", category: "事件" },
  { name: "银针", file: "Goods-e01-银针.ini", category: "事件" },
  { name: "雷震子", file: "Goods-e02-雷震子.ini", category: "事件" },
  { name: "丝绸手帕", file: "Goods-e03-丝绸手帕.ini", category: "事件" },
  { name: "一块绸布", file: "Goods-e04-一块绸布.ini", category: "事件" },
  { name: "包裹", file: "Goods-e05-包裹.ini", category: "事件" },
  { name: "钥匙", file: "Goods-e06-钥匙.ini", category: "事件" },
  { name: "半块玉佩", file: "Goods-e07-半块玉佩.ini", category: "事件" },
  { name: "另一半玉佩", file: "Goods-e08-另一半玉佩.ini", category: "事件" },
  { name: "发钗", file: "Goods-e09-发钗.ini", category: "事件" },
  { name: "武林帖", file: "Goods-e10-武林帖.ini", category: "事件" },
  { name: "信", file: "Goods-e11-信.ini", category: "事件" },
  { name: "银丝草", file: "Goods-e12-银丝草.ini", category: "事件" },
  { name: "金创药", file: "Goods-e13-金创药.ini", category: "事件" },
  { name: "鱼钩", file: "Goods-e14-鱼钩.ini", category: "事件" },
  { name: "草葱", file: "Goods-e15-草葱.ini", category: "事件" },
  { name: "罂粟", file: "Goods-e16-罂粟.ini", category: "事件" },
  { name: "野姜", file: "Goods-e17-野姜.ini", category: "事件" },
  { name: "金山毒霸", file: "Goods-e18-金山毒霸.ini", category: "事件" },
  { name: "玉镯", file: "Goods-e19-玉镯.ini", category: "事件" },
  { name: "书信", file: "Goods-e20-书信.ini", category: "事件" },
  { name: "玫瑰花", file: "Goods-e21-玫瑰花.ini", category: "事件" },
  { name: "羊皮", file: "Goods-e22-羊皮.ini", category: "事件" },
];

/**
 * 武功信息
 */
export interface MagicInfo {
  name: string;
  file: string;
}

/**
 * 所有可添加的玩家武功列表（不包括子攻击武功）
 */
export const ALL_PLAYER_MAGICS: MagicInfo[] = [
  { name: "长剑", file: "player-magic-长剑.ini" },
  { name: "风火雷", file: "player-magic-风火雷.ini" },
  { name: "银钩铁划", file: "player-magic-银钩铁划.ini" },
  { name: "沧海月明", file: "player-magic-沧海月明.ini" },
  { name: "烈火情天", file: "player-magic-烈火情天.ini" },
  { name: "蚀骨血刃", file: "player-magic-蚀骨血仞.ini" },
  { name: "镇狱破天劲", file: "player-magic-镇狱破天劲.ini" },
  { name: "孤烟逐云", file: "player-magic-孤烟逐云.ini" },
  { name: "潮起月盈", file: "player-magic-潮起月盈.ini" },
  { name: "漫天花雨", file: "player-magic-漫天花雨.ini" },
  { name: "云生结海", file: "player-magic-云生结海.ini" },
  { name: "推山填海", file: "player-magic-推山填海.ini" },
  { name: "绝情断意剑", file: "player-magic-绝情断意剑.ini" },
  { name: "逆转心经", file: "player-magic-逆转心经.ini" },
  { name: "错骨分身", file: "player-magic-醉蝶狂舞.ini" },
  { name: "金钟魔罩", file: "player-magic-金钟罩.ini" },
  { name: "武道轮回法", file: "player-magic-武道德经.ini" },
  { name: "清心咒", file: "player-magic-清心咒.ini" },
  { name: "魂牵梦绕", file: "player-magic-魂牵梦绕.ini" },
];
