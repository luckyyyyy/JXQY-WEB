/**
 * TargetingIndicator - 技能瞄准指示器
 *
 * 当按住技能按钮时，在玩家脚下显示瞄准器
 * 支持滑动改变瞄准方向
 */

import { memo } from "react";

export interface TargetingIndicatorProps {
  /** 指示器位置（屏幕坐标） */
  position: { x: number; y: number };
  /** 瞄准方向（相对于玩家的偏移） */
  direction: { x: number; y: number };
  /** 技能槽位索引 */
  slotIndex: number;
  /** 是否显示 */
  visible: boolean;
}

/**
 * 瞄准指示器组件
 */
export const TargetingIndicator = memo(function TargetingIndicator({
  position,
  direction,
  visible,
}: TargetingIndicatorProps) {
  if (!visible) return null;

  // 计算瞄准线的终点（相对于起点的偏移）
  const lineLength = 80;
  const dirMagnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
  const normalizedDir = dirMagnitude > 0
    ? { x: direction.x / dirMagnitude, y: direction.y / dirMagnitude }
    : { x: 0, y: -1 }; // 默认朝上

  const endX = normalizedDir.x * lineLength;
  const endY = normalizedDir.y * lineLength;

  // 计算箭头角度
  const angle = Math.atan2(direction.y, direction.x) * (180 / Math.PI) + 90;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -50%)",
        zIndex: 200,
      }}
    >
      {/* 中心圆环（玩家脚下） */}
      <div
        className="absolute rounded-full"
        style={{
          width: 40,
          height: 40,
          left: -20,
          top: -20,
          border: "2px solid rgba(255, 200, 100, 0.8)",
          background: "rgba(255, 200, 100, 0.2)",
          boxShadow: "0 0 10px rgba(255, 200, 100, 0.5)",
        }}
      />

      {/* 内圈 */}
      <div
        className="absolute rounded-full"
        style={{
          width: 16,
          height: 16,
          left: -8,
          top: -8,
          border: "1px solid rgba(255, 200, 100, 0.9)",
          background: "rgba(255, 200, 100, 0.4)",
        }}
      />

      {/* 瞄准线 */}
      <svg
        className="absolute"
        style={{
          left: -lineLength,
          top: -lineLength,
          width: lineLength * 2,
          height: lineLength * 2,
          overflow: "visible",
        }}
      >
        {/* 虚线 */}
        <line
          x1={lineLength}
          y1={lineLength}
          x2={lineLength + endX}
          y2={lineLength + endY}
          stroke="rgba(255, 200, 100, 0.8)"
          strokeWidth="2"
          strokeDasharray="6,4"
        />
        {/* 终点光点 */}
        <circle
          cx={lineLength + endX}
          cy={lineLength + endY}
          r="6"
          fill="rgba(255, 200, 100, 0.9)"
          style={{
            filter: "drop-shadow(0 0 4px rgba(255, 200, 100, 0.8))",
          }}
        />
      </svg>

      {/* 方向箭头 */}
      <div
        className="absolute"
        style={{
          left: endX - 8,
          top: endY - 8,
          width: 16,
          height: 16,
          transform: `rotate(${angle}deg)`,
        }}
      >
        <svg viewBox="0 0 16 16" className="w-full h-full">
          <path
            d="M8 0 L14 12 L8 8 L2 12 Z"
            fill="rgba(255, 200, 100, 0.9)"
          />
        </svg>
      </div>
    </div>
  );
});

export default TargetingIndicator;
