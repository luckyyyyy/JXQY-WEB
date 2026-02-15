/**
 * 物品高级字段定义 — 用于 FieldGroupList 数据驱动渲染
 *
 * 定义所有未在基础编辑器中暴露的 Good 字段（25 个），按功能分组。
 */
import type { FieldGroup } from "../../components/common/FieldGrid";

export const goodAdvancedGroups: FieldGroup[] = [
  {
    title: "扩展战斗属性",
    icon: "⚔️",
    fields: [
      {
        key: "attack2",
        label: "攻击力2",
        type: "number",
        tooltip: "第二攻击力值（多段攻击 / 属性攻击）",
      },
      { key: "attack3", label: "攻击力3", type: "number", tooltip: "第三攻击力值" },
      { key: "defend2", label: "防御力2", type: "number", tooltip: "第二防御力值" },
      { key: "defend3", label: "防御力3", type: "number", tooltip: "第三防御力值" },
    ],
  },
  {
    title: "特殊效果",
    icon: "✨",
    fields: [
      { key: "specialEffect", label: "特效编号", type: "number", tooltip: "特殊效果类型编号" },
      {
        key: "specialEffectValue",
        label: "特效数值",
        type: "number",
        tooltip: "特殊效果的强度/数值",
      },
    ],
  },
  {
    title: "价格",
    icon: "💰",
    fields: [
      {
        key: "sellPrice",
        label: "售出价格",
        type: "number",
        tooltip: "物品卖给商店的价格（0=不可出售）",
      },
    ],
  },
  {
    title: "武功关联",
    icon: "🔮",
    fields: [
      {
        key: "flyIni",
        label: "飞行武功INI",
        type: "text",
        tooltip: "使用物品时触发的飞行武功 INI 路径",
      },
      { key: "flyIni2", label: "飞行武功INI 2", type: "text", tooltip: "第二个飞行武功 INI 路径" },
      {
        key: "magicIniWhenUse",
        label: "使用时武功",
        type: "text",
        tooltip: "使用物品时触发的武功 INI",
      },
      { key: "replaceMagic", label: "替换武功", type: "text", tooltip: "装备后替换的武功 INI" },
      {
        key: "useReplaceMagic",
        label: "使用替换武功",
        type: "text",
        tooltip: "使用时替换的武功 INI",
      },
      {
        key: "magicToUseWhenBeAttacked",
        label: "被攻击武功",
        type: "text",
        tooltip: "装备后被攻击时触发的武功 INI",
      },
      {
        key: "magicDirectionWhenBeAttacked",
        label: "被攻击武功方向",
        type: "number",
        tooltip: "被攻击反击武功方向",
      },
    ],
  },
  {
    title: "武功增幅",
    icon: "📈",
    fields: [
      {
        key: "addMagicEffectPercent",
        label: "武功效果%",
        type: "number",
        tooltip: "武功效果百分比加成",
      },
      {
        key: "addMagicEffectAmount",
        label: "武功效果量",
        type: "number",
        tooltip: "武功效果固定数值加成",
      },
      {
        key: "addMagicEffectName",
        label: "增幅武功名",
        type: "text",
        tooltip: "仅对该武功生效的增幅效果名",
      },
      {
        key: "addMagicEffectType",
        label: "增幅武功类型",
        type: "text",
        tooltip: "增幅效果作用的武功类型",
      },
    ],
  },
  {
    title: "使用限制",
    icon: "🔒",
    fields: [
      {
        key: "noNeedToEquip",
        label: "无需装备",
        type: "number",
        tooltip: "设为 1 时放入背包即生效，无需装备",
      },
      {
        key: "minUserLevel",
        label: "最低等级",
        type: "number",
        tooltip: "使用此物品所需的最低角色等级",
      },
    ],
  },
  {
    title: "移动与冷却",
    icon: "🏃",
    fields: [
      {
        key: "changeMoveSpeedPercent",
        label: "移速变化%",
        type: "number",
        tooltip: "装备后移动速度百分比变化",
      },
      {
        key: "coldMilliSeconds",
        label: "冷却时间(ms)",
        type: "number",
        tooltip: "使用后的冷却时间（毫秒）",
      },
    ],
  },
  {
    title: "队友效果",
    icon: "👥",
    fields: [
      {
        key: "followPartnerHasDrugEffect",
        label: "伙伴共享药效",
        type: "number",
        tooltip: "设为 1 时跟随伙伴也获得消耗品效果",
      },
      {
        key: "fighterFriendHasDrugEffect",
        label: "战友共享药效",
        type: "number",
        tooltip: "设为 1 时战斗友方也获得消耗品效果",
      },
    ],
  },
];
