/**
 * GameCursor Component - based on JxqyHD Engine/Gui/MouseGui.cs
 * Custom game cursor using ASF sprite from resources
 *
 * loads mouse.asf from UI_Settings.ini [Mouse] section
 * Resource: asf/ui/common/mouse.asf
 *
 * 实现方式：
 * - 在游戏容器内创建一个 overlay div（pointer-events: none）
 * - 使用 CSS cursor 属性 + blob URL 设置自定义鼠标图像
 * - 动态修改 cursor 属性切换帧
 * - 完全脱离 React 渲染机制
 *
 * 使用方法：
 * const containerRef = useRef<HTMLDivElement>(null);
 * <div ref={containerRef}>游戏内容</div>
 * <GameCursor enabled={!isMobile} containerRef={containerRef} />
 */
import type React from "react";
import { useEffect } from "react";
import { disableGameCursor, enableGameCursor, initGameCursor } from "./gameCursorManager";

interface GameCursorProps {
  /** 是否启用自定义鼠标指针 */
  enabled?: boolean;
  /** 游戏容器的 ref，overlay 将创建在此容器内 */
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * 自定义游戏鼠标指针组件
 *
 * 使用方法：
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * <div ref={containerRef} className="game-container">
 *   <Game ... />
 * </div>
 * <GameCursor enabled={!isMobile} containerRef={containerRef} />
 * ```
 *
 * 特点：
 * - overlay div 创建在游戏容器内部，不会遮挡外部元素
 * - 使用 pointer-events: none，不阻挡点击
 * - 使用 blob URL（非 base64）
 * - 完全独立于 React 渲染周期
 */
export const GameCursor: React.FC<GameCursorProps> = ({ enabled = true, containerRef }) => {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    initGameCursor().then(() => {
      if (cancelled) return;
      if (containerRef.current) {
        enableGameCursor(containerRef.current);
      }
    });

    return () => {
      cancelled = true;
      disableGameCursor();
    };
  }, [enabled, containerRef]);

  // 这个组件不渲染任何 DOM，overlay div 由 manager 创建
  return null;
};

/**
 * @deprecated 请直接使用 <GameCursor /> 组件
 * 保留此组件仅为向后兼容
 */
export const GameCursorContainer: React.FC<{
  children: React.ReactNode;
  enabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}> = ({ children, style, className }) => {
  // 不再做任何光标处理，只是普通的 div
  return (
    <div className={className || ""} style={style}>
      {children}
    </div>
  );
};

export default GameCursor;
