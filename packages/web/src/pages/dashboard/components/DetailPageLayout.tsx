/**
 * 详情页通用布局组件
 *
 * 从 NPC / OBJ / Magic / Goods / Shop 页面中提取的共享布局，
 * 统一头部（返回链接 + 标题 + 操作按钮）、可选 Tab 栏、可滚动内容区。
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { DashboardIcons } from "../icons";

// ========== Tab 定义 ==========

export interface DetailTab {
  key: string;
  label: string;
  icon: string;
}

// ========== Props ==========

export interface DetailPageLayoutProps {
  /** 返回链接地址 */
  backPath: string;
  /** 页面标题 */
  title: string;
  /** 标题下方副标题 */
  subtitle?: ReactNode;

  /** Tab 列表（不传则不渲染 Tab 栏） */
  tabs?: DetailTab[];
  /** 当前选中 Tab */
  activeTab?: string;
  /** Tab 切换回调 */
  onTabChange?: (key: string) => void;

  /** 保存回调 */
  onSave?: () => void;
  /** 是否正在保存 */
  isSaving?: boolean;
  /** 删除回调（不传则不显示删除按钮） */
  onDelete?: () => void;
  /** 是否正在删除 */
  isDeleting?: boolean;

  /** 头部右侧额外操作区（在删除/保存按钮之前） */
  headerExtra?: ReactNode;

  /**
   * 内容区内层容器的最大宽度 class，例如 "max-w-3xl" / "max-w-4xl"。
   * 默认不限制宽度（使用 "min-w-0" 撑满）。
   */
  contentMaxWidth?: string;

  /**
   * 右侧面板（如 NPC 预览），渲染在内容区右侧（与 children 同级。
   */
  sidePanel?: ReactNode;

  children: ReactNode;
}

// ========== Component ==========

export function DetailPageLayout({
  backPath,
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  onSave,
  isSaving = false,
  onDelete,
  isDeleting = false,
  headerExtra,
  contentMaxWidth,
  sidePanel,
  children,
}: DetailPageLayoutProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ====== 头部 ====== */}
      <div className="flex-shrink-0 bg-[#1e1e1e] border-b border-widget-border">
        {/* 标题行 */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={backPath}
              className="p-2 rounded-lg hover:bg-[#3c3c3c] text-[#858585] hover:text-white transition-colors"
            >
              {DashboardIcons.back}
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">{title}</h1>
              {subtitle && <p className="text-xs text-[#858585]">{subtitle}</p>}
            </div>
          </div>

          <div className="flex gap-2">
            {headerExtra}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
              >
                删除
              </button>
            )}
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-sm bg-[#0e639c] hover:bg-[#1177bb] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
            )}
          </div>
        </div>

        {/* Tab 栏 */}
        {tabs && tabs.length > 0 && (
          <div className="flex px-6 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange?.(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative ${
                  activeTab === tab.key
                    ? "text-white"
                    : "text-[#858585] hover:text-white"
                }`}
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#0098ff] rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ====== 可滚动内容区 ====== */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-6 p-6 min-h-full">
          <div className={`flex-1 ${contentMaxWidth ?? "min-w-0"} space-y-5`}>
            {children}
          </div>
          {sidePanel}
        </div>
      </div>
    </div>
  );
}
