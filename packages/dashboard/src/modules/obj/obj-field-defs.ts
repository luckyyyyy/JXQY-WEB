/**
 * Obj 高级字段定义 — 用于 FieldGroupList 数据驱动渲染
 *
 * 定义所有未在基础编辑器中暴露的 Obj 字段（4 个）。
 */
import type { FieldGroup } from "../../components/common/FieldGrid";

export const objAdvancedGroups: FieldGroup[] = [
  {
    title: "扩展参数",
    icon: "🔧",
    fields: [
      {
        key: "switchSound",
        label: "切换音效",
        type: "text",
        tooltip: "物体状态切换时播放的音效路径",
      },
      {
        key: "triggerRadius",
        label: "触发半径",
        type: "number",
        tooltip: "触发交互/事件的检测半径（像素）",
      },
      { key: "interval", label: "间隔时间(ms)", type: "number", tooltip: "物体动画/行为循环间隔" },
      { key: "level", label: "等级", type: "number", tooltip: "物体等级（用于交互条件判断）" },
    ],
  },
];
