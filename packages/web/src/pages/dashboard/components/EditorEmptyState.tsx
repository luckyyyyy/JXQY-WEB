/**
 * 编辑器空状态/欢迎页组件
 *
 * 用于各编辑模块（武功、物体、商店、等级、NPC、物品等）的列表首页，
 * 当用户尚未选择任何项目时显示。
 */
import type { ReactNode } from "react";

export interface EditorEmptyStateProps {
  /** 大 emoji 图标 */
  icon: string;
  /** 标题 */
  title: string;
  /** 描述文本，支持 ReactNode 以方便换行 */
  description: ReactNode;
}

export function EditorEmptyState({ icon, title, description }: EditorEmptyStateProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">{icon}</div>
        <h2 className="text-xl font-medium text-white mb-3">{title}</h2>
        <p className="text-[#858585] text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
