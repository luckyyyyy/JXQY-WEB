/**
 * Jxqy Script Language Definition for Monaco Editor
 * 定义《月影传说》脚本语法高亮和自动补全
 */
import type { editor, IRange, languages, Position } from "monaco-editor";

// biome-ignore lint/suspicious/noExplicitAny: Monaco editor type is dynamically loaded
type MonacoType = any;

/**
 * 语言ID
 */
export const JXQY_SCRIPT_LANGUAGE_ID = "jxqy-script";

/**
 * 所有脚本命令定义
 * 包含命令名称、参数签名和说明
 */
export const SCRIPT_COMMANDS: Array<{
  name: string;
  signature: string;
  description: string;
  category: string;
  blocking?: boolean;
}> = [
  // ===== NPC 命令 =====
  {
    name: "AddNpc",
    signature: "(npcFile, x, y, direction)",
    description: "在指定位置添加 NPC",
    category: "NPC",
  },
  { name: "LoadNpc", signature: "(npcFile)", description: "加载 NPC 配置文件", category: "NPC" },
  {
    name: "LoadOneNpc",
    signature: "(npcFile, x, y)",
    description: "加载单个 NPC 到位置",
    category: "NPC",
  },
  { name: "DeleteNpc", signature: "(name)", description: "删除指定 NPC", category: "NPC" },
  { name: "DelNpc", signature: "(name)", description: "删除指定 NPC (别名)", category: "NPC" },
  { name: "MergeNpc", signature: "(npcFile)", description: "合并加载 NPC 文件", category: "NPC" },
  {
    name: "SetNpcPos",
    signature: "(name, x, y)",
    description: "设置 NPC 位置（瞬移）",
    category: "NPC",
  },
  {
    name: "SetNpcDir",
    signature: "(name, direction)",
    description: "设置 NPC 朝向 (0-7)",
    category: "NPC",
  },
  {
    name: "SetNpcState",
    signature: "(name, state)",
    description: "设置 NPC 状态",
    category: "NPC",
  },
  {
    name: "SetNpcLevel",
    signature: "(name, level)",
    description: "设置 NPC 等级",
    category: "NPC",
  },
  {
    name: "NpcGoto",
    signature: "(name, x, y)",
    description: "NPC 走到指定位置",
    category: "NPC",
    blocking: true,
  },
  {
    name: "NpcGotoEx",
    signature: "(name, x, y)",
    description: "NPC 走到位置（非阻塞）",
    category: "NPC",
  },
  {
    name: "NpcGotoDir",
    signature: "(name, direction, steps)",
    description: "NPC 向方向走若干步",
    category: "NPC",
    blocking: true,
  },
  {
    name: "SetNpcActionFile",
    signature: "(name, state, asfFile)",
    description: "设置 NPC 动画文件",
    category: "NPC",
  },
  {
    name: "NpcSpecialAction",
    signature: "(name, asfFile)",
    description: "播放 NPC 特殊动画",
    category: "NPC",
  },
  {
    name: "NpcSpecialActionEx",
    signature: "(name, asfFile)",
    description: "播放特殊动画（阻塞）",
    category: "NPC",
    blocking: true,
  },
  {
    name: "ShowNpc",
    signature: "(name, show)",
    description: "显示/隐藏 NPC (1/0)",
    category: "NPC",
  },
  {
    name: "SetNpcScript",
    signature: "(name, scriptFile)",
    description: "设置 NPC 交互脚本",
    category: "NPC",
  },
  {
    name: "SetNpcDeathScript",
    signature: "(name, scriptFile)",
    description: "设置 NPC 死亡脚本",
    category: "NPC",
  },
  { name: "SaveNpc", signature: "(fileName?)", description: "保存 NPC 状态", category: "NPC" },
  { name: "DisableNpcAI", signature: "()", description: "禁用全局 NPC AI", category: "NPC" },
  { name: "EnableNpcAI", signature: "()", description: "启用全局 NPC AI", category: "NPC" },
  {
    name: "SetNpcRelation",
    signature: "(name, relation)",
    description: "设置 NPC 关系 (0友/1敌/2中立/3无)",
    category: "NPC",
  },
  {
    name: "Watch",
    signature: "(char1, char2, type)",
    description: "让角色面向另一角色",
    category: "NPC",
  },
  {
    name: "SetNpcKind",
    signature: "(name, kind)",
    description: "设置 NPC 类型 (0-7)",
    category: "NPC",
  },
  {
    name: "SetNpcMagicFile",
    signature: "(name, magicFile)",
    description: "设置 NPC 武功文件",
    category: "NPC",
  },
  {
    name: "SetNpcRes",
    signature: "(name, resFile)",
    description: "设置 NPC 资源文件",
    category: "NPC",
  },
  {
    name: "SetNpcAction",
    signature: "(name, action, x?, y?)",
    description: "设置 NPC 动作",
    category: "NPC",
  },
  {
    name: "SetNpcActionType",
    signature: "(name, actionType)",
    description: "设置 NPC 动作类型",
    category: "NPC",
  },
  {
    name: "SetAllNpcScript",
    signature: "(name, scriptFile)",
    description: "设置所有同名 NPC 脚本",
    category: "NPC",
  },
  {
    name: "SetAllNpcDeathScript",
    signature: "(name, scriptFile)",
    description: "设置所有同名 NPC 死亡脚本",
    category: "NPC",
  },
  { name: "NpcAttack", signature: "(name, x, y)", description: "让 NPC 攻击位置", category: "NPC" },
  {
    name: "FollowNpc",
    signature: "(follower, target)",
    description: "让角色跟随另一角色",
    category: "NPC",
  },
  {
    name: "SetNpcMagicToUseWhenBeAttacked",
    signature: "(name, magic, dir)",
    description: "设置 NPC 反击武功",
    category: "NPC",
  },
  {
    name: "AddNpcProperty",
    signature: "(name, property, value)",
    description: "增加 NPC 属性值",
    category: "NPC",
  },
  {
    name: "ChangeFlyIni",
    signature: "(name, magicFile)",
    description: "改变 NPC 飞行武功",
    category: "NPC",
  },
  {
    name: "ChangeFlyIni2",
    signature: "(name, magicFile)",
    description: "改变 NPC 副飞行武功",
    category: "NPC",
  },
  {
    name: "AddFlyInis",
    signature: "(name, magicFile, distance)",
    description: "添加距离触发飞行武功",
    category: "NPC",
  },
  {
    name: "SetNpcDestination",
    signature: "(name, x, y)",
    description: "设置 NPC 目的地",
    category: "NPC",
  },
  {
    name: "GetNpcCount",
    signature: "(kind1, kind2)",
    description: "获取指定类型 NPC 数量→$NpcCount",
    category: "NPC",
  },
  {
    name: "SetKeepAttack",
    signature: "(name, x, y)",
    description: "设置 NPC 持续攻击位置",
    category: "NPC",
  },

  // ===== 玩家命令 =====
  { name: "SetPlayerPos", signature: "(x, y)", description: "设置玩家位置", category: "Player" },
  {
    name: "SetPlayerDir",
    signature: "(direction)",
    description: "设置玩家朝向 (0-7)",
    category: "Player",
  },
  { name: "SetPlayerState", signature: "(state)", description: "设置玩家状态", category: "Player" },
  {
    name: "PlayerGoto",
    signature: "(x, y)",
    description: "玩家走到位置",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerRunTo",
    signature: "(x, y)",
    description: "玩家跑到位置",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerGotoDir",
    signature: "(direction, steps)",
    description: "玩家向方向走若干步",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerGotoEx",
    signature: "(x, y)",
    description: "玩家走到位置（非阻塞）",
    category: "Player",
  },
  {
    name: "PlayerJumpTo",
    signature: "(x, y)",
    description: "玩家跳到位置",
    category: "Player",
    blocking: true,
  },
  {
    name: "PlayerRunToEx",
    signature: "(x, y)",
    description: "玩家跑到位置（非阻塞）",
    category: "Player",
  },
  { name: "SetPlayerScn", signature: "()", description: "将摄像机居中到玩家", category: "Player" },
  {
    name: "AddGoods",
    signature: "(goodsName, count)",
    description: "添加物品",
    category: "Player",
  },
  {
    name: "AddRandGoods",
    signature: "(buyFileName)",
    description: "从商店文件随机添加物品",
    category: "Player",
  },
  {
    name: "DelGoods",
    signature: "(goodsName?, count?)",
    description: "删除物品",
    category: "Player",
  },
  {
    name: "EquipGoods",
    signature: "(equipType, goodsId)",
    description: "装备物品",
    category: "Player",
  },
  { name: "AddMoney", signature: "(amount)", description: "添加金钱", category: "Player" },
  {
    name: "AddRandMoney",
    signature: "(min, max)",
    description: "添加随机金钱",
    category: "Player",
  },
  { name: "AddExp", signature: "(amount)", description: "添加经验", category: "Player" },
  { name: "FullLife", signature: "()", description: "完全恢复生命", category: "Player" },
  { name: "FullMana", signature: "()", description: "完全恢复内力", category: "Player" },
  { name: "FullThew", signature: "()", description: "完全恢复体力", category: "Player" },
  { name: "AddLife", signature: "(amount)", description: "增减生命（可负）", category: "Player" },
  { name: "AddMana", signature: "(amount)", description: "增减内力（可负）", category: "Player" },
  { name: "AddThew", signature: "(amount)", description: "增减体力（可负）", category: "Player" },
  { name: "AddMagic", signature: "(magicFile)", description: "添加武功", category: "Player" },
  {
    name: "SetMagicLevel",
    signature: "(magicFile, level)",
    description: "设置武功等级",
    category: "Player",
  },
  { name: "DelMagic", signature: "(magicFile)", description: "删除武功", category: "Player" },
  {
    name: "GetMoneyNum",
    signature: "($var?)",
    description: "获取金钱→$MoneyNum",
    category: "Player",
  },
  { name: "SetMoneyNum", signature: "(amount)", description: "设置金钱数量", category: "Player" },
  { name: "GetPlayerExp", signature: "($var)", description: "获取经验值", category: "Player" },
  { name: "GetExp", signature: "($var)", description: "获取经验值（别名）", category: "Player" },
  {
    name: "GetPlayerState",
    signature: "(stateName, $var)",
    description: "获取玩家属性值",
    category: "Player",
  },
  {
    name: "GetPlayerMagicLevel",
    signature: "(magicFile, $var)",
    description: "获取武功等级",
    category: "Player",
  },
  {
    name: "LimitMana",
    signature: "(enabled)",
    description: "限制内力使用 (1/0)",
    category: "Player",
  },
  {
    name: "AddMoveSpeedPercent",
    signature: "(percent)",
    description: "增加移动速度百分比",
    category: "Player",
  },
  { name: "AddAttack", signature: "(value, type?)", description: "增加攻击力", category: "Player" },
  { name: "AddDefend", signature: "(value, type?)", description: "增加防御力", category: "Player" },
  { name: "AddEvade", signature: "(value)", description: "增加闪避", category: "Player" },
  { name: "AddLifeMax", signature: "(value)", description: "增加生命上限", category: "Player" },
  { name: "AddManaMax", signature: "(value)", description: "增加内力上限", category: "Player" },
  { name: "AddThewMax", signature: "(value)", description: "增加体力上限", category: "Player" },
  {
    name: "UseMagic",
    signature: "(magicFile, x?, y?)",
    description: "使用武功",
    category: "Player",
  },
  {
    name: "IsEquipWeapon",
    signature: "($var)",
    description: "检查是否装备武器→1/0",
    category: "Player",
  },
  {
    name: "SetPlayerMagicToUseWhenBeAttacked",
    signature: "(magic, dir)",
    description: "设置玩家反击武功",
    category: "Player",
  },
  { name: "SetWalkIsRun", signature: "(value)", description: "设置行走即奔跑", category: "Player" },
  { name: "PlayerChange", signature: "(index)", description: "切换玩家角色", category: "Player" },

  // ===== 对话命令 =====
  {
    name: "Say",
    signature: "(text, portraitIndex)",
    description: "显示对话框",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "Talk",
    signature: "(startId, endId)",
    description: "显示连续对话（从TalkIndex）",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "Choose",
    signature: "(msg, optA, optB, $var)",
    description: "显示二选一",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "Select",
    signature: "(msgId, optAId, optBId, $var)",
    description: "选择（使用TalkIndex文本）",
    category: "Dialog",
    blocking: true,
  },
  { name: "Message", signature: "(text)", description: "显示系统消息", category: "Dialog" },
  {
    name: "DisplayMessage",
    signature: "(text)",
    description: "显示系统消息（别名）",
    category: "Dialog",
  },
  {
    name: "ShowMessage",
    signature: "(textId)",
    description: "显示TalkIndex消息",
    category: "Dialog",
  },
  {
    name: "ChooseEx",
    signature: "(msg, opt1, opt2, ..., $var)",
    description: "多选项选择（支持条件）",
    category: "Dialog",
    blocking: true,
  },
  {
    name: "ChooseMultiple",
    signature: "(...)",
    description: "多选项选择",
    category: "Dialog",
    blocking: true,
  },

  // ===== 游戏状态命令 =====
  { name: "LoadMap", signature: "(mapFile)", description: "加载地图", category: "GameState" },
  { name: "LoadGame", signature: "(index)", description: "加载存档", category: "GameState" },
  { name: "FreeMap", signature: "()", description: "释放地图资源", category: "GameState" },
  {
    name: "If",
    signature: "($var op value) @label",
    description: "条件跳转",
    category: "GameState",
  },
  { name: "Goto", signature: "@label", description: "无条件跳转", category: "GameState" },
  { name: "Return", signature: "", description: "返回/结束脚本", category: "GameState" },
  {
    name: "Sleep",
    signature: "(milliseconds)",
    description: "暂停执行",
    category: "GameState",
    blocking: true,
  },
  { name: "RunScript", signature: "(scriptFile)", description: "运行脚本", category: "GameState" },
  { name: "Assign", signature: "($var, value)", description: "设置变量", category: "GameState" },
  { name: "Add", signature: "($var, value)", description: "变量加法", category: "GameState" },
  { name: "Sub", signature: "($var, value)", description: "变量减法", category: "GameState" },
  {
    name: "GetRandNum",
    signature: "($var, min, max)",
    description: "生成随机数",
    category: "GameState",
  },
  { name: "DisableInput", signature: "()", description: "禁用玩家输入", category: "GameState" },
  { name: "EnableInput", signature: "()", description: "启用玩家输入", category: "GameState" },
  { name: "DisableFight", signature: "()", description: "禁用战斗", category: "GameState" },
  { name: "EnableFight", signature: "()", description: "启用战斗", category: "GameState" },
  { name: "DisableJump", signature: "()", description: "禁用跳跃", category: "GameState" },
  { name: "EnableJump", signature: "()", description: "启用跳跃", category: "GameState" },
  { name: "DisableRun", signature: "()", description: "禁用奔跑", category: "GameState" },
  { name: "EnableRun", signature: "()", description: "启用奔跑", category: "GameState" },
  {
    name: "SetLevelFile",
    signature: "(file)",
    description: "设置等级配置文件",
    category: "GameState",
  },
  { name: "ReturnToTitle", signature: "()", description: "返回标题画面", category: "GameState" },
  { name: "SetMapTime", signature: "(time)", description: "设置地图时间", category: "GameState" },
  {
    name: "RunParallelScript",
    signature: "(scriptFile, delay?)",
    description: "并行运行脚本",
    category: "GameState",
  },

  // ===== 音频命令 =====
  { name: "PlayMusic", signature: "(musicFile)", description: "播放背景音乐", category: "Audio" },
  { name: "StopMusic", signature: "()", description: "停止背景音乐", category: "Audio" },
  { name: "PlaySound", signature: "(soundFile)", description: "播放音效", category: "Audio" },
  {
    name: "PlayMovie",
    signature: "(movieFile)",
    description: "播放视频",
    category: "Audio",
    blocking: true,
  },
  { name: "StopSound", signature: "()", description: "停止所有音效", category: "Audio" },

  // ===== 屏幕效果命令 =====
  { name: "FadeIn", signature: "()", description: "淡入效果", category: "Screen", blocking: true },
  { name: "FadeOut", signature: "()", description: "淡出效果", category: "Screen", blocking: true },
  {
    name: "MoveScreen",
    signature: "(direction, distance, speed)",
    description: "移动摄像机",
    category: "Screen",
    blocking: true,
  },
  {
    name: "MoveScreenEx",
    signature: "(x, y, speed)",
    description: "移动摄像机到位置",
    category: "Screen",
    blocking: true,
  },
  {
    name: "ChangeMapColor",
    signature: "(r, g, b)",
    description: "改变地图颜色",
    category: "Screen",
  },
  {
    name: "ChangeAsfColor",
    signature: "(r, g, b)",
    description: "改变精灵颜色",
    category: "Screen",
  },
  { name: "SetMapPos", signature: "(x, y)", description: "设置摄像机位置", category: "Screen" },

  // ===== 天气命令 =====
  { name: "BeginRain", signature: "(rainIniFile)", description: "开始下雨", category: "Weather" },
  { name: "EndRain", signature: "()", description: "停止下雨", category: "Weather" },
  {
    name: "ShowSnow",
    signature: "(show)",
    description: "显示/隐藏下雪 (1/0)",
    category: "Weather",
  },

  // ===== 物体命令 =====
  { name: "LoadObj", signature: "(objFile)", description: "加载物体配置文件", category: "Object" },
  {
    name: "AddObj",
    signature: "(objFile, x, y, direction)",
    description: "添加物体",
    category: "Object",
  },
  { name: "DelObj", signature: "(objName)", description: "删除物体", category: "Object" },
  { name: "DelCurObj", signature: "()", description: "删除当前触发脚本的物体", category: "Object" },
  { name: "OpenBox", signature: "(objName?)", description: "打开箱子动画", category: "Object" },
  {
    name: "OpenObj",
    signature: "(objName?)",
    description: "打开物体动画（别名）",
    category: "Object",
  },
  { name: "CloseBox", signature: "(objName?)", description: "关闭箱子动画", category: "Object" },
  {
    name: "SetObjScript",
    signature: "(objName, scriptFile)",
    description: "设置物体脚本",
    category: "Object",
  },
  { name: "SaveObj", signature: "(fileName?)", description: "保存物体状态", category: "Object" },
  {
    name: "SetObjOfs",
    signature: "(objName, x, y)",
    description: "设置物体偏移",
    category: "Object",
  },

  // ===== 陷阱命令 =====
  {
    name: "SetTrap",
    signature: "(mapName, trapIndex, trapFile)",
    description: "设置地图陷阱（指定地图）",
    category: "Trap",
  },
  {
    name: "SetMapTrap",
    signature: "(trapIndex, trapFile)",
    description: "设置当前地图陷阱",
    category: "Trap",
  },
  { name: "SaveMapTrap", signature: "()", description: "保存地图陷阱状态", category: "Trap" },

  // ===== 记事本命令 =====
  { name: "Memo", signature: "(text)", description: "添加记事（直接文本）", category: "Memo" },
  {
    name: "AddToMemo",
    signature: "(memoId)",
    description: "添加记事（从TalkIndex）",
    category: "Memo",
  },
  { name: "DelMemo", signature: "(textOrId)", description: "删除记事", category: "Memo" },

  // ===== 计时器命令 =====
  { name: "OpenTimeLimit", signature: "(seconds)", description: "开始倒计时", category: "Timer" },
  { name: "CloseTimeLimit", signature: "()", description: "关闭倒计时", category: "Timer" },
  { name: "HideTimerWnd", signature: "()", description: "隐藏计时器窗口", category: "Timer" },
  {
    name: "SetTimeScript",
    signature: "(seconds, scriptFile)",
    description: "设置计时器触发脚本",
    category: "Timer",
  },

  // ===== 商店/物品扩展命令 =====
  {
    name: "BuyGoods",
    signature: "(buyFile, canSell?)",
    description: "打开购买界面",
    category: "Shop",
    blocking: true,
  },
  {
    name: "SellGoods",
    signature: "(buyFile)",
    description: "打开出售界面",
    category: "Shop",
    blocking: true,
  },
  {
    name: "BuyGoodsOnly",
    signature: "(buyFile)",
    description: "打开纯购买界面",
    category: "Shop",
    blocking: true,
  },
  {
    name: "GetGoodsNum",
    signature: "(goodsFile)",
    description: "获取物品数量→$GoodsNum",
    category: "Shop",
  },
  {
    name: "GetGoodsNumByName",
    signature: "(goodsName)",
    description: "按名称获取物品数量",
    category: "Shop",
  },
  { name: "ClearGoods", signature: "()", description: "清空所有物品", category: "Shop" },
  { name: "ClearMagic", signature: "()", description: "清空所有武功", category: "Shop" },
  {
    name: "DelGoodByName",
    signature: "(name, count?)",
    description: "按名称删除物品",
    category: "Shop",
  },
  {
    name: "CheckFreeGoodsSpace",
    signature: "($var)",
    description: "检查物品栏空间→1/0",
    category: "Shop",
  },
  {
    name: "CheckFreeMagicSpace",
    signature: "($var)",
    description: "检查武功栏空间→1/0",
    category: "Shop",
  },
  {
    name: "SetDropIni",
    signature: "(name, dropFile)",
    description: "设置掉落配置",
    category: "Shop",
  },
  { name: "EnableDrop", signature: "()", description: "启用掉落", category: "Shop" },
  {
    name: "EnabelDrop",
    signature: "()",
    description: "启用掉落（原版拼写错误别名）",
    category: "Shop",
  },
  { name: "DisableDrop", signature: "()", description: "禁用掉落", category: "Shop" },

  // ===== 水效果命令 =====
  { name: "OpenWaterEffect", signature: "()", description: "开启水波效果", category: "Effect" },
  { name: "CloseWaterEffect", signature: "()", description: "关闭水波效果", category: "Effect" },

  // ===== 存档命令 =====
  { name: "ClearAllSave", signature: "()", description: "删除所有存档", category: "Save" },
  { name: "EnableSave", signature: "()", description: "启用存档", category: "Save" },
  { name: "DisableSave", signature: "()", description: "禁用存档", category: "Save" },

  // ===== 变量扩展命令 =====
  {
    name: "ClearAllVar",
    signature: "(keep1, keep2, ...)",
    description: "清空变量（保留指定）",
    category: "Variable",
  },
  { name: "GetPartnerIdx", signature: "($var)", description: "获取同伴索引", category: "Variable" },

  // ===== 状态效果命令 =====
  {
    name: "PetrifyMillisecond",
    signature: "(ms)",
    description: "石化效果",
    category: "StatusEffect",
  },
  {
    name: "PoisonMillisecond",
    signature: "(ms)",
    description: "中毒效果",
    category: "StatusEffect",
  },
  {
    name: "FrozenMillisecond",
    signature: "(ms)",
    description: "冰冻效果",
    category: "StatusEffect",
  },

  // ===== 其他命令 =====
  { name: "ClearBody", signature: "()", description: "清除尸体", category: "Misc" },
  {
    name: "SetShowMapPos",
    signature: "(show)",
    description: "显示/隐藏地图坐标",
    category: "Misc",
  },
  {
    name: "ShowSystemMsg",
    signature: "(msg, stayTime?)",
    description: "显示系统消息",
    category: "Misc",
  },
  {
    name: "RandRun",
    signature: "($prob, script1, script2)",
    description: "随机运行脚本",
    category: "Misc",
  },
];

/**
 * 命令名称列表（用于语法高亮）
 */
export const COMMAND_NAMES = SCRIPT_COMMANDS.map((cmd) => cmd.name);

/**
 * 控制流关键字（蓝色高亮）
 * If/Goto/Return 等属于控制流，其余命令作为函数（黄色高亮）
 */
const CONTROL_FLOW_KEYWORDS = new Set(["If", "Goto", "Return", "Assign", "Add", "Sub"]);

/** 控制流关键字名称列表 */
export const KEYWORD_NAMES = COMMAND_NAMES.filter((n) => CONTROL_FLOW_KEYWORDS.has(n));

/** 函数命令名称列表（非控制流） */
export const FUNCTION_NAMES = COMMAND_NAMES.filter((n) => !CONTROL_FLOW_KEYWORDS.has(n));

/**
 * 内置变量
 */
export const BUILTIN_VARIABLES = ["$Event", "$MoneyNum", "$GoodsNum", "$NpcCount", "$PartnerIdx"];

/**
 * 枚举值 - 角色类型
 */
export const ENUM_NPC_KIND = [
  { value: 0, label: "Normal", description: "普通 NPC，站在原地" },
  { value: 1, label: "Fighter", description: "战斗型，启用 AI" },
  { value: 2, label: "Player", description: "玩家控制角色" },
  { value: 3, label: "Follower", description: "跟随者/同伴" },
  { value: 4, label: "GroundAnimal", description: "地面动物" },
  { value: 5, label: "Eventer", description: "事件触发器" },
  { value: 6, label: "AfraidPlayerAnimal", description: "怕玩家的动物" },
  { value: 7, label: "Flyer", description: "飞行敌人" },
];

/**
 * 枚举值 - 关系类型
 */
export const ENUM_RELATION = [
  { value: 0, label: "Friend", description: "友方" },
  { value: 1, label: "Enemy", description: "敌方" },
  { value: 2, label: "Neutral", description: "中立" },
  { value: 3, label: "None", description: "无关系（攻击所有）" },
];

/**
 * 枚举值 - 方向
 */
export const ENUM_DIRECTION = [
  { value: 0, label: "北" },
  { value: 1, label: "东北" },
  { value: 2, label: "东" },
  { value: 3, label: "东南" },
  { value: 4, label: "南" },
  { value: 5, label: "西南" },
  { value: 6, label: "西" },
  { value: 7, label: "西北" },
];

/**
 * 类别颜色映射
 */
export const CATEGORY_COLORS: Record<string, string> = {
  NPC: "#4EC9B0",
  Player: "#DCDCAA",
  Dialog: "#CE9178",
  GameState: "#569CD6",
  Audio: "#C586C0",
  Screen: "#9CDCFE",
  Weather: "#4FC1FF",
  Object: "#B5CEA8",
  Trap: "#D7BA7D",
  Memo: "#F48771",
  Timer: "#D16969",
  Shop: "#B8D7A3",
  Effect: "#C8C8C8",
  Save: "#808080",
  Variable: "#C586C0",
  StatusEffect: "#FF8C00",
  Misc: "#808080",
};

/**
 * 注册 Jxqy Script 语言到 Monaco Editor
 */
export function registerJxqyScriptLanguage(monaco: MonacoType): void {
  // 检查是否已注册
  const languagesList = monaco.languages.getLanguages();
  if (languagesList.some((lang: { id: string }) => lang.id === JXQY_SCRIPT_LANGUAGE_ID)) {
    return;
  }

  // 注册语言
  monaco.languages.register({
    id: JXQY_SCRIPT_LANGUAGE_ID,
    extensions: [".txt"],
    aliases: ["Jxqy Script", "jxqy"],
  });

  // 设置语言配置（括号匹配、注释等）
  monaco.languages.setLanguageConfiguration(JXQY_SCRIPT_LANGUAGE_ID, {
    comments: {
      lineComment: "//",
    },
    brackets: [["(", ")"]],
    autoClosingPairs: [
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });

  // 设置语法高亮 (Monarch tokenizer)
  monaco.languages.setMonarchTokensProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    // 控制流关键字（蓝色）
    keywords: KEYWORD_NAMES,
    // 函数命令（黄色）
    functions: FUNCTION_NAMES,

    tokenizer: {
      root: [
        // 注释
        [/\/\/.*$/, "comment"],

        // 标签定义 @LabelName:
        [/@[a-zA-Z_][a-zA-Z0-9_]*:/, "type.identifier"],

        // 标签引用 @LabelName
        [/@[a-zA-Z_][a-zA-Z0-9_]*/, "type"],

        // 变量 $VarName
        [/\$[a-zA-Z_][a-zA-Z0-9_]*/, "variable"],

        // 关键字 & 函数命令
        [
          /[a-zA-Z_][a-zA-Z0-9_]*/,
          {
            cases: {
              "@keywords": "keyword",
              "@functions": "function",
              "@default": "identifier",
            },
          },
        ],

        // 字符串
        [/"[^"]*"/, "string"],

        // 数字
        [/-?\d+/, "number"],

        // 运算符
        [/[<>=!]+/, "operator"],
        [/[<>]=?|[!=]=|<>/, "operator"],

        // 分隔符
        [/[(),;]/, "delimiter"],

        // 空白
        [/\s+/, "white"],
      ],
    },
  });

  // 注册自动补全提供者
  monaco.languages.registerCompletionItemProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    triggerCharacters: ["@", "$", "("],

    provideCompletionItems: (model: editor.ITextModel, position: Position) => {
      const word = model.getWordUntilPosition(position);
      const range: IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      const suggestions: languages.CompletionItem[] = [];

      // 检测是否在输入标签引用
      if (textBeforeCursor.endsWith("@") || textBeforeCursor.match(/@\w*$/)) {
        // 搜索文档中所有标签定义
        const content = model.getValue();
        const labelMatches = content.matchAll(/@([a-zA-Z_][a-zA-Z0-9_]*):/g);
        const labels = new Set<string>();
        for (const match of labelMatches) {
          labels.add(match[1]);
        }
        for (const label of labels) {
          suggestions.push({
            label: `@${label}`,
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: label,
            range,
            detail: "标签跳转",
          });
        }
        return { suggestions };
      }

      // 检测是否在输入变量
      if (textBeforeCursor.endsWith("$") || textBeforeCursor.match(/\$\w*$/)) {
        // 内置变量
        for (const v of BUILTIN_VARIABLES) {
          suggestions.push({
            label: v,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: v.slice(1), // 去掉 $
            range,
            detail: "内置变量",
          });
        }
        // 搜索文档中已使用的变量
        const content = model.getValue();
        const varMatches = content.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g);
        const vars = new Set<string>();
        for (const match of varMatches) {
          vars.add(match[1]);
        }
        for (const v of vars) {
          if (!BUILTIN_VARIABLES.includes(`$${v}`)) {
            suggestions.push({
              label: `$${v}`,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: v,
              range,
              detail: "自定义变量",
            });
          }
        }
        return { suggestions };
      }

      // 默认：命令补全
      for (const cmd of SCRIPT_COMMANDS) {
        const blockingNote = cmd.blocking ? " ⏳阻塞" : "";
        suggestions.push({
          label: cmd.name,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: `${cmd.name}${cmd.signature};`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          detail: `[${cmd.category}]${blockingNote}`,
          documentation: {
            value: `**${cmd.name}**${cmd.signature}\n\n${cmd.description}${blockingNote ? "\n\n⏳ 此命令会阻塞脚本执行" : ""}`,
          },
        });
      }

      return { suggestions };
    },
  });

  // 注册悬停提示提供者
  monaco.languages.registerHoverProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    provideHover: (model: editor.ITextModel, position: Position) => {
      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const cmd = SCRIPT_COMMANDS.find((c) => c.name.toLowerCase() === word.word.toLowerCase());
      if (!cmd) return null;

      const blockingNote = cmd.blocking ? "\n\n⏳ **此命令会阻塞脚本执行**" : "";
      return {
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        ),
        contents: [
          { value: `**${cmd.name}**\`${cmd.signature}\`` },
          { value: `**分类**: ${cmd.category}` },
          { value: cmd.description + blockingNote },
        ],
      };
    },
  });

  // 注册函数签名帮助
  monaco.languages.registerSignatureHelpProvider(JXQY_SCRIPT_LANGUAGE_ID, {
    signatureHelpTriggerCharacters: ["(", ","],
    provideSignatureHelp: (model: editor.ITextModel, position: Position) => {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // 查找最近的命令名
      const match = textBeforeCursor.match(/(\w+)\s*\([^)]*$/);
      if (!match) return null;

      const cmdName = match[1];
      const cmd = SCRIPT_COMMANDS.find((c) => c.name.toLowerCase() === cmdName.toLowerCase());
      if (!cmd) return null;

      // 计算当前参数索引
      const paramsText = textBeforeCursor.substring(textBeforeCursor.lastIndexOf("(") + 1);
      const commaCount = (paramsText.match(/,/g) || []).length;

      return {
        value: {
          signatures: [
            {
              label: `${cmd.name}${cmd.signature}`,
              documentation: cmd.description,
              parameters: cmd.signature
                .replace(/[()]/g, "")
                .split(",")
                .map((p) => ({
                  label: p.trim(),
                  documentation: "",
                })),
            },
          ],
          activeSignature: 0,
          activeParameter: commaCount,
        },
        dispose: () => {},
      };
    },
  });
}

/**
 * 定义自定义主题（可选）
 */
export function defineJxqyScriptTheme(monaco: MonacoType): void {
  monaco.editor.defineTheme("jxqy-script-theme", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
      { token: "keyword", foreground: "C586C0" },
      { token: "function", foreground: "DCDCAA" },
      { token: "type.identifier", foreground: "4EC9B0" },
      { token: "type", foreground: "4EC9B0" },
      { token: "variable", foreground: "9CDCFE" },
      { token: "string", foreground: "CE9178" },
      { token: "number", foreground: "B5CEA8" },
      { token: "operator", foreground: "D4D4D4" },
      { token: "delimiter", foreground: "D4D4D4" },
    ],
    colors: {},
  });
}
