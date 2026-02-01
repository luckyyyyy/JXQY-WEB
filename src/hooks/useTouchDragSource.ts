/**
 * useTouchDragSource - 通用触摸拖拽源 hook
 *
 * 为任何可拖拽元素提供触摸拖拽支持
 * 长按 200ms 开始拖拽，支持震动反馈
 *
 * 注意：仅在移动端启用（通过 enabled 参数控制）
 */

import { useCallback, useRef } from "react";
import type { TouchDragData } from "@/contexts/TouchDragContext";
import { useTouchDrag } from "@/contexts";

export interface UseTouchDragSourceOptions {
  /** 是否有内容可拖拽 */
  hasContent: boolean;
  /** 获取拖拽数据的回调 */
  getDragData: () => TouchDragData | null;
  /** 点击回调（短按） */
  onClick?: () => void;
  /** 长按开始拖拽的延迟（毫秒） */
  longPressDelay?: number;
  /** 移动取消阈值（像素） */
  moveThreshold?: number;
  /** 是否启用触摸拖拽（默认 true，PC 端应设为 false） */
  enabled?: boolean;
}

export interface TouchDragSourceHandlers {
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onTouchCancel?: (e: React.TouchEvent) => void;
}

// 空处理器，用于禁用状态
const EMPTY_HANDLERS: TouchDragSourceHandlers = {};

/**
 * 通用触摸拖拽源 hook
 *
 * @example
 * ```tsx
 * const handlers = useTouchDragSource({
 *   hasContent: !!item,
 *   getDragData: () => ({ type: "goods", bagIndex: index, source: "goodsGui" }),
 *   onClick: () => handleClick(),
 *   enabled: isMobile, // 仅移动端启用
 * });
 *
 * return <div {...handlers}>...</div>;
 * ```
 */
export function useTouchDragSource({
  hasContent,
  getDragData,
  onClick,
  longPressDelay = 200,
  moveThreshold = 10,
  enabled = true,
}: UseTouchDragSourceOptions): TouchDragSourceHandlers {
  const { startDrag } = useTouchDrag();

  // 触摸状态
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // 清理定时器
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // 触摸开始
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!hasContent) return;

      // 获取按下这个元素的触摸点（可能不是第一个触摸点）
      const touch = e.changedTouches[0];
      if (!touch) return;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      isDraggingRef.current = false;

      // 长按开始拖拽
      longPressTimerRef.current = window.setTimeout(() => {
        if (touchStartRef.current) {
          const dragData = getDragData();
          if (dragData) {
            isDraggingRef.current = true;
            startDrag(dragData);
            // 震动反馈
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }
          }
        }
      }, longPressDelay);
    },
    [hasContent, getDragData, startDrag, longPressDelay]
  );

  // 触摸移动
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      // 使用 changedTouches 获取移动的触摸点
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 移动超过阈值，取消长按
      if (distance > moveThreshold) {
        clearLongPressTimer();
      }
    },
    [moveThreshold, clearLongPressTimer]
  );

  // 触摸结束
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      clearLongPressTimer();

      // 如果不是拖拽状态，检查是否为短按（点击）
      if (!isDraggingRef.current && touchStartRef.current) {
        const duration = Date.now() - touchStartRef.current.time;
        if (duration < longPressDelay) {
          e.preventDefault();
          onClick?.();
        }
      }

      touchStartRef.current = null;
      isDraggingRef.current = false;
    },
    [clearLongPressTimer, onClick, longPressDelay]
  );

  // 触摸取消
  const onTouchCancel = useCallback(() => {
    clearLongPressTimer();
    touchStartRef.current = null;
    isDraggingRef.current = false;
  }, [clearLongPressTimer]);

  // 如果禁用，返回空处理器
  if (!enabled) {
    return EMPTY_HANDLERS;
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  };
}

export default useTouchDragSource;
