/**
 * FormSection - 表单区块容器
 *
 * 统一所有编辑页面中重复出现的 section > header + content 结构。
 *
 * @example
 * ```tsx
 * <FormSection icon="📝" title="基本信息">
 *   <FormTextField label="名称" field="name" ... />
 * </FormSection>
 *
 * <FormSection icon="⚔️" title="战斗属性" cols={3} extra={<ExportBtn />}>
 *   ...
 * </FormSection>
 * ```
 */
import type { ReactNode } from "react";
import { SECTION_CLS, SECTION_HEADER_CLS, SECTION_TITLE_CLS } from "../../styles/classNames";

export interface FormSectionProps {
  /** 标题前的 emoji / icon */
  icon?: string;
  /** 区块标题 */
  title: string;
  /** 标题栏右侧额外元素 */
  extra?: ReactNode;
  /** grid 列数（默认 2） */
  cols?: 1 | 2 | 3 | 4;
  /** 自定义内容 class（覆盖 grid 布局） */
  contentClassName?: string;
  children: ReactNode;
}

const colsMap: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function FormSection({
  icon,
  title,
  extra,
  cols = 2,
  contentClassName,
  children,
}: FormSectionProps) {
  return (
    <section className={SECTION_CLS}>
      <div className={SECTION_HEADER_CLS}>
        <h2 className={SECTION_TITLE_CLS}>
          {icon && <>{icon} </>}
          {title}
        </h2>
        {extra}
      </div>
      <div className={contentClassName ?? `p-4 grid ${colsMap[cols]} gap-4`}>{children}</div>
    </section>
  );
}
