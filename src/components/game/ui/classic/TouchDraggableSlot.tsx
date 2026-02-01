/**
 * TouchDraggableSlot - 支持触摸拖拽的通用槽位容器
 *
 * 包装任何需要拖拽功能的槽位组件，提供统一的触摸拖拽支持
 */

import type { CSSProperties, ReactNode } from "react";
import { useCallback } from "react";
import type { TouchDragData } from "@/contexts/TouchDragContext";
import { useTouchDragSource } from "@/hooks/useTouchDragSource";

export interface TouchDraggableSlotProps {
  /** 子元素 */
  children: ReactNode;
  /** 是否有内容可拖拽 */
  hasContent: boolean;
  /** 获取拖拽数据 */
  getDragData: () => TouchDragData | null;
  /** 点击回调 */
  onClick?: () => void;
  /** 样式 */
  style?: CSSProperties;
  /** 类名 */
  className?: string;
  /** HTML5 拖拽相关 props */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  /** 鼠标事件 */
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** 元素属性 */
  title?: string;
}

/**
 * 支持触摸拖拽的通用槽位容器
 *
 * @example
 * ```tsx
 * <TouchDraggableSlot
 *   hasContent={!!item}
 *   getDragData={() => ({ type: "goods", bagIndex: index, source: "goodsGui" })}
 *   onClick={() => handleClick()}
 *   draggable={!!item}
 *   onDragStart={handleDragStart}
 * >
 *   <ItemIcon />
 * </TouchDraggableSlot>
 * ```
 */
export function TouchDraggableSlot({
  children,
  hasContent,
  getDragData,
  onClick,
  style,
  className,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onContextMenu,
  title,
}: TouchDraggableSlotProps) {
  // 触摸拖拽事件处理
  const touchHandlers = useTouchDragSource({
    hasContent,
    getDragData,
    onClick,
  });

  return (
    <div
      style={{
        ...style,
        touchAction: "none", // 禁用浏览器默认触摸行为
      }}
      className={className}
      title={title}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      // 触摸事件
      onTouchStart={touchHandlers.onTouchStart}
      onTouchMove={touchHandlers.onTouchMove}
      onTouchEnd={touchHandlers.onTouchEnd}
      onTouchCancel={touchHandlers.onTouchCancel}
    >
      {children}
    </div>
  );
}

export default TouchDraggableSlot;
