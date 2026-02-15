/**
 * NPC 高级字段定义 — 用于 FieldGroupList 数据驱动渲染
 *
 * 定义所有未在基础编辑器中暴露的 NPC 字段（56 个），按功能分组。
 */
import type { FieldGroup } from "../../components/common/FieldGrid";

export const npcAdvancedGroups: FieldGroup[] = [
  {
    title: "攻击变体",
    icon: "⚔️",
    fields: [
      { key: "attack2", label: "攻击力2", type: "number", tooltip: "第二攻击力值" },
      { key: "attack3", label: "攻击力3", type: "number", tooltip: "第三攻击力值" },
      { key: "defend2", label: "防御力2", type: "number", tooltip: "第二防御力值" },
      { key: "defend3", label: "防御力3", type: "number", tooltip: "第三防御力值" },
      {
        key: "attackLevel",
        label: "攻击等级",
        type: "number",
        tooltip: "武功等级（决定使用哪级武功）",
      },
      { key: "expBonus", label: "经验奖励", type: "number", tooltip: "击杀额外经验奖励" },
    ],
  },
  {
    title: "等级成长",
    icon: "📈",
    fields: [
      { key: "levelUpExp", label: "升级经验", type: "number", tooltip: "NPC 升级所需经验" },
      { key: "canLevelUp", label: "可升级", type: "checkbox", tooltip: "NPC 是否可以升级" },
    ],
  },
  {
    title: "行为参数",
    icon: "🎮",
    fields: [
      {
        key: "addMoveSpeedPercent",
        label: "移速加成%",
        type: "number",
        tooltip: "移动速度百分比加成",
      },
      { key: "visionRadius", label: "视野半径", type: "number", tooltip: "NPC 视野检测半径（格）" },
      { key: "dialogRadius", label: "对话半径", type: "number", tooltip: "触发对话的距离（格）" },
      { key: "action", label: "初始动作", type: "number", tooltip: "NPC 初始动作编号" },
      { key: "fixedPos", label: "固定位置", type: "text", tooltip: "NPC 巡逻/固定位置坐标序列" },
    ],
  },
  {
    title: "AI 配置",
    icon: "🤖",
    fields: [
      { key: "aiType", label: "AI 类型", type: "number", tooltip: "AI 行为类型编号" },
      {
        key: "noAutoAttackPlayer",
        label: "不主动攻击",
        type: "checkbox",
        tooltip: "NPC 不主动攻击玩家",
      },
      { key: "invincible", label: "无敌", type: "checkbox", tooltip: "NPC 无法被击杀" },
      {
        key: "stopFindingTarget",
        label: "停止寻敌",
        type: "checkbox",
        tooltip: "NPC 不主动寻找攻击目标",
      },
      {
        key: "keepRadiusWhenLifeLow",
        label: "低血保持距离",
        type: "number",
        tooltip: "生命低时保持的安全距离",
      },
      {
        key: "lifeLowPercent",
        label: "低血百分比",
        type: "number",
        tooltip: "触发低血行为的生命百分比",
      },
      {
        key: "keepRadiusWhenFriendDeath",
        label: "友方死保持距离",
        type: "number",
        tooltip: "友方死亡后保持的安全距离",
      },
      { key: "keepAttackX", label: "固定攻击X", type: "number", tooltip: "保持攻击的目标 X 坐标" },
      { key: "keepAttackY", label: "固定攻击Y", type: "number", tooltip: "保持攻击的目标 Y 坐标" },
    ],
  },
  {
    title: "关联脚本",
    icon: "📜",
    fields: [
      { key: "flyIni2", label: "飞行INI 2", type: "text", tooltip: "第二个飞行武功 INI 路径" },
      {
        key: "flyInis",
        label: "飞行INI列表",
        type: "text",
        tooltip: "多个飞行武功 INI（逗号分隔）",
      },
      { key: "scriptFileRight", label: "右键脚本", type: "text", tooltip: "右键交互触发的脚本" },
      { key: "timerScriptFile", label: "定时脚本", type: "text", tooltip: "定时执行的脚本路径" },
      {
        key: "timerScriptInterval",
        label: "定时间隔(ms)",
        type: "number",
        tooltip: "定时脚本执行间隔",
      },
      {
        key: "canInteractDirectly",
        label: "可远程交互",
        type: "checkbox",
        tooltip: "不需要靠近即可交互",
      },
    ],
  },
  {
    title: "掉落与商店",
    icon: "🎁",
    fields: [
      { key: "dropIni", label: "掉落配置", type: "text", tooltip: "死亡掉落的 INI 配置路径" },
      { key: "noDropWhenDie", label: "死亡不掉落", type: "checkbox", tooltip: "死亡时不掉落物品" },
      { key: "buyIniFile", label: "商店INI", type: "text", tooltip: "NPC 商店的 INI 文件路径" },
      {
        key: "buyIniString",
        label: "商店内容",
        type: "text",
        tooltip: "内嵌的商店 INI 内容字符串",
      },
    ],
  },
  {
    title: "事件武功",
    icon: "⚡",
    fields: [
      {
        key: "magicToUseWhenLifeLow",
        label: "低血武功",
        type: "text",
        tooltip: "生命低时使用的武功 INI",
      },
      {
        key: "magicToUseWhenBeAttacked",
        label: "被攻击武功",
        type: "text",
        tooltip: "被攻击时使用的武功 INI",
      },
      {
        key: "magicDirectionWhenBeAttacked",
        label: "被攻击方向",
        type: "number",
        tooltip: "被攻击反击武功方向",
      },
      {
        key: "magicToUseWhenDeath",
        label: "死亡武功",
        type: "text",
        tooltip: "死亡时触发的武功 INI",
      },
      {
        key: "magicDirectionWhenDeath",
        label: "死亡武功方向",
        type: "number",
        tooltip: "死亡武功方向",
      },
    ],
  },
  {
    title: "可见性控制",
    icon: "👁️",
    fields: [
      {
        key: "visibleVariableName",
        label: "可见变量名",
        type: "text",
        tooltip: "控制可见性的脚本变量名",
      },
      {
        key: "visibleVariableValue",
        label: "可见变量值",
        type: "number",
        tooltip: "变量等于此值时 NPC 可见",
      },
    ],
  },
  {
    title: "复活与接触伤害",
    icon: "💫",
    fields: [
      {
        key: "reviveMilliseconds",
        label: "复活时间(ms)",
        type: "number",
        tooltip: "NPC 死亡后复活的时间",
      },
      {
        key: "hurtPlayerInterval",
        label: "接触伤害间隔(ms)",
        type: "number",
        tooltip: "对玩家造成接触伤害的间隔",
      },
      { key: "hurtPlayerLife", label: "接触伤害值", type: "number", tooltip: "接触伤害值" },
      {
        key: "hurtPlayerRadius",
        label: "接触伤害半径",
        type: "number",
        tooltip: "接触伤害的检测半径",
      },
    ],
  },
  {
    title: "等级配置",
    icon: "📋",
    fields: [
      {
        key: "levelIniFile",
        label: "等级配置INI",
        type: "text",
        tooltip: "NPC 等级配置 INI 文件路径",
      },
    ],
  },
  {
    title: "装备",
    icon: "🎽",
    fields: [
      { key: "canEquip", label: "可装备", type: "checkbox", tooltip: "NPC 是否可装备物品" },
      { key: "headEquip", label: "头部", type: "text", tooltip: "头部装备物品名" },
      { key: "neckEquip", label: "项链", type: "text", tooltip: "项链装备物品名" },
      { key: "bodyEquip", label: "身体", type: "text", tooltip: "身体装备物品名" },
      { key: "backEquip", label: "背部", type: "text", tooltip: "背部装备物品名" },
      { key: "handEquip", label: "手部", type: "text", tooltip: "手部装备物品名" },
      { key: "wristEquip", label: "手腕", type: "text", tooltip: "手腕装备物品名" },
      { key: "footEquip", label: "脚部", type: "text", tooltip: "脚部装备物品名" },
      { key: "backgroundTextureEquip", label: "背景纹理", type: "text", tooltip: "背景纹理装备" },
    ],
  },
  {
    title: "状态",
    icon: "🧪",
    fields: [
      {
        key: "poisonByCharacterName",
        label: "中毒来源",
        type: "text",
        tooltip: "使此 NPC 中毒的角色名",
      },
    ],
  },
  {
    title: "分组",
    icon: "👥",
    fields: [
      {
        key: "group",
        label: "NPC 分组ID",
        type: "number",
        tooltip: "NPC 所属分组编号（同组 NPC 联动）",
      },
    ],
  },
];
