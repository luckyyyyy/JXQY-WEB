/**
 * VirtualJoystick - 虚拟摇杆组件
 *
 * 类似王者荣耀的虚拟摇杆，用于控制角色移动方向
 * 支持8个方向的移动
 */

import { Direction } from "@miu2d/engine/core/types";
import { useCallback, useEffect, useRef, useState } from "react";

export interface VirtualJoystickProps {
  /** 摇杆大小 */
  size?: number;
  /** 摇杆内圈大小 */
  knobSize?: number;
  /** 方向变化回调 */
  onDirectionChange: (direction: Direction | null) => void;
  /** 是否按住（用于区分走和跑） */
  onMoveStart?: () => void;
  /** 松开回调 */
  onMoveEnd?: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 根据角度计算8方向
 */
function angleToDirection(angle: number): Direction {
  // 归一化角度到 0-360
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // 8方向划分（每个方向占45度）
  // 上方为 0 度（北）
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    return Direction.North;
  }
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    return Direction.NorthEast;
  }
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    return Direction.East;
  }
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    return Direction.SouthEast;
  }
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    return Direction.South;
  }
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    return Direction.SouthWest;
  }
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    return Direction.West;
  }
  if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) {
    return Direction.NorthWest;
  }
  return Direction.North;
}

/**
 * 虚拟摇杆组件
 */
export function VirtualJoystick({
  size = 120,
  knobSize = 50,
  onDirectionChange,
  onMoveStart,
  onMoveEnd,
  disabled = false,
}: VirtualJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);
  const lastDirectionRef = useRef<Direction | null>(null);

  // 计算摇杆位置和方向
  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current || disabled) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;

      // 计算距离
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = size / 2 - knobSize / 2;

      // 限制在最大范围内
      if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
      }

      setKnobPosition({ x: dx, y: dy });

      // 只有移动足够距离才计算方向（死区）
      const deadZone = 10;
      if (distance > deadZone) {
        // 计算角度（以向上为0度，顺时针）
        // atan2 返回值：向右为0，逆时针为正
        // 转换：90 - atan2(dy, dx) * 180 / PI
        const angle = (90 - Math.atan2(-dy, dx) * (180 / Math.PI) + 360) % 360;
        const direction = angleToDirection(angle);

        if (direction !== lastDirectionRef.current) {
          lastDirectionRef.current = direction;
          onDirectionChange(direction);
        }
      } else {
        if (lastDirectionRef.current !== null) {
          lastDirectionRef.current = null;
          onDirectionChange(null);
        }
      }
    },
    [size, knobSize, onDirectionChange, disabled]
  );

  // 触摸开始处理函数（用于 useEffect）
  const handleTouchStartRef = useRef<(e: TouchEvent) => void>(() => {});
  handleTouchStartRef.current = (e: TouchEvent) => {
    if (disabled || touchIdRef.current !== null) return;

    // 使用 changedTouches 获取新增的触摸点
    const touch = e.changedTouches[0];
    if (!touch) return;

    e.preventDefault();
    e.stopPropagation();
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    onMoveStart?.();
    handleMove(touch.clientX, touch.clientY);
  };

  // 全局触摸移动处理（使用 touch.identifier 区分不同触摸点）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      handleTouchStartRef.current(e);
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      // 找到属于这个摇杆的触摸点
      const touch = Array.from(e.touches).find((t) => t.identifier === touchIdRef.current);
      if (touch) {
        // 阻止默认行为，但只针对这个触摸点关联的事件
        e.preventDefault();
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;

      // 找到结束的触摸点
      const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
      if (touch) {
        touchIdRef.current = null;
        setIsActive(false);
        setKnobPosition({ x: 0, y: 0 });
        lastDirectionRef.current = null;
        onDirectionChange(null);
        onMoveEnd?.();
      }
    };

    // 使用 passive: false 允许 preventDefault
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleGlobalTouchMove, { passive: false });
    window.addEventListener("touchend", handleGlobalTouchEnd);
    window.addEventListener("touchcancel", handleGlobalTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
      window.removeEventListener("touchcancel", handleGlobalTouchEnd);
    };
  }, [handleMove, onDirectionChange, onMoveEnd]);

  return (
    <div
      ref={containerRef}
      className="relative select-none touch-none"
      style={{
        width: size,
        height: size,
      }}
    >
      {/* 外圈 */}
      <div
        className="absolute inset-0 rounded-full border-2 border-white/30 bg-black/30"
        style={{
          boxShadow: isActive
            ? "0 0 20px rgba(255,255,255,0.3), inset 0 0 30px rgba(255,255,255,0.1)"
            : "inset 0 0 20px rgba(0,0,0,0.3)",
        }}
      />

      {/* 方向指示器 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* 十字线 */}
        <div className="absolute w-full h-[1px] bg-white/10" />
        <div className="absolute w-[1px] h-full bg-white/10" />
        {/* 对角线 */}
        <div
          className="absolute w-full h-[1px] bg-white/5"
          style={{ transform: "rotate(45deg)" }}
        />
        <div
          className="absolute w-full h-[1px] bg-white/5"
          style={{ transform: "rotate(-45deg)" }}
        />
      </div>

      {/* 摇杆内圈 */}
      <div
        className="absolute rounded-full bg-gradient-to-b from-white/40 to-white/20 border border-white/50 transition-transform"
        style={{
          width: knobSize,
          height: knobSize,
          left: "50%",
          top: "50%",
          transform: `translate(calc(-50% + ${knobPosition.x}px), calc(-50% + ${knobPosition.y}px))`,
          boxShadow: isActive
            ? "0 0 15px rgba(255,255,255,0.5), 0 4px 8px rgba(0,0,0,0.3)"
            : "0 2px 4px rgba(0,0,0,0.3)",
          transition: isActive ? "none" : "transform 0.1s ease-out",
        }}
      />
    </div>
  );
}

export default VirtualJoystick;
