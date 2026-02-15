/**
 * useTouchDropTarget - 触摸拖拽目标 hook
 *
 * 将一个元素注册为触摸拖拽的放置目标
 * 当拖拽结束时，如果手指在此元素上，会触发 onDrop 回调
 */

import { useEffect, useRef } from "react";
import { type TouchDragData, useTouchDrag } from "../contexts";

export interface UseTouchDropTargetOptions {
  /** 唯一标识符 */
  id: string;
  /** 当有物品被放置时的回调 */
  onDrop: (data: TouchDragData) => void;
  /** 可选：判断是否接受此数据 */
  canDrop?: (data: TouchDragData) => boolean;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

/**
 * 触摸拖拽目标 hook
 *
 * @example
 * ```tsx
 * const dropRef = useTouchDropTarget({
 *   id: `bottom-slot-${index}`,
 *   onDrop: (data) => handleDrop(data),
 *   canDrop: (data) => data.type === "magic",
 *   enabled: isMobile,
 * });
 *
 * return <div ref={dropRef}>...</div>;
 * ```
 */
export function useTouchDropTarget({
  id,
  onDrop,
  canDrop,
  enabled = true,
}: UseTouchDropTargetOptions) {
  const { registerDropTarget, unregisterDropTarget } = useTouchDrag();
  const elementRef = useRef<HTMLDivElement>(null);

  // 使用 ref 保存最新的 callbacks，避免频繁重新注册
  const callbacksRef = useRef({ onDrop, canDrop });
  callbacksRef.current = { onDrop, canDrop };

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;

    // 注册 drop target
    registerDropTarget({
      id,
      element,
      onDrop: (data) => callbacksRef.current.onDrop(data),
      canDrop: callbacksRef.current.canDrop
        ? (data) => callbacksRef.current.canDrop!(data)
        : undefined,
    });

    return () => {
      unregisterDropTarget(id);
    };
  }, [id, enabled, registerDropTarget, unregisterDropTarget]);

  return elementRef;
}

export default useTouchDropTarget;
