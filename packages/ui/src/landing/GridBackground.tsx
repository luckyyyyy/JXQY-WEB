/**
 * GridBackground - 现代网格动画背景组件
 *
 * 包含：
 * - 渐变背景
 * - 浮动光球
 * - 网格线
 * - 发光流线动画
 * - 网格节点闪烁
 */

import { motion } from "framer-motion";
import React from "react";

// 网格尺寸常量
const GRID_SIZE = 60;

// 沿网格线移动的发光流线
export function GridLine({
  delay = 0,
  duration = 4,
  row,
  isHorizontal = true,
}: {
  delay?: number;
  duration?: number;
  row: number;
  isHorizontal?: boolean;
}) {
  const position = row * GRID_SIZE;

  // 随机初始位置：基于当前窗口大小计算
  const [hasCompletedFirst, setHasCompletedFirst] = React.useState(false);

  const { initialPosition, firstDuration, screenSize } = React.useMemo(() => {
    if (typeof window === "undefined") {
      return { initialPosition: -120, firstDuration: duration, screenSize: 1920 };
    }
    const size = isHorizontal ? window.innerWidth : window.innerHeight;
    const totalDistance = size + 240; // -120 到 屏幕边缘+120
    const initPos = Math.random() * totalDistance - 120;
    // 第一次动画只需要走剩余距离，所以时间按比例缩短
    const remainingRatio = (size + 120 - initPos) / totalDistance;
    return {
      initialPosition: initPos,
      firstDuration: duration * remainingRatio,
      screenSize: size,
    };
  }, [isHorizontal, duration]);

  const handleAnimationComplete = React.useCallback(() => {
    if (!hasCompletedFirst) {
      setHasCompletedFirst(true);
    }
  }, [hasCompletedFirst]);

  if (isHorizontal) {
    return (
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: position,
          left: 0,
          width: 120,
          height: 2,
          background:
            "linear-gradient(90deg, transparent, rgba(251,146,60,0.8), rgba(251,191,36,0.6), transparent)",
          boxShadow: "0 0 20px rgba(251,146,60,0.5), 0 0 40px rgba(251,146,60,0.3)",
        }}
        initial={{ x: initialPosition }}
        animate={{
          x: hasCompletedFirst ? ["-120px", `${screenSize + 120}px`] : `${screenSize + 120}px`,
        }}
        transition={{
          duration: hasCompletedFirst ? duration : firstDuration,
          delay: hasCompletedFirst ? 0 : delay,
          repeat: hasCompletedFirst ? Number.POSITIVE_INFINITY : 0,
          ease: "linear",
        }}
        onAnimationComplete={handleAnimationComplete}
      />
    );
  }

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: position,
        top: 0,
        width: 2,
        height: 120,
        background:
          "linear-gradient(180deg, transparent, rgba(251,146,60,0.8), rgba(251,191,36,0.6), transparent)",
        boxShadow: "0 0 20px rgba(251,146,60,0.5), 0 0 40px rgba(251,146,60,0.3)",
      }}
      initial={{ y: initialPosition }}
      animate={{
        y: hasCompletedFirst ? ["-120px", `${screenSize + 120}px`] : `${screenSize + 120}px`,
      }}
      transition={{
        duration: hasCompletedFirst ? duration : firstDuration,
        delay: hasCompletedFirst ? 0 : delay,
        repeat: hasCompletedFirst ? Number.POSITIVE_INFINITY : 0,
        ease: "linear",
      }}
      onAnimationComplete={handleAnimationComplete}
    />
  );
}

// 网格交叉点闪烁
export function GridNode({ row, col, delay = 0 }: { row: number; col: number; delay?: number }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{
        left: col * GRID_SIZE - 4,
        top: row * GRID_SIZE - 4,
        background: "radial-gradient(circle, rgba(251,146,60,0.8) 0%, transparent 70%)",
        boxShadow: "0 0 10px rgba(251,146,60,0.6)",
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0.5, 1.5, 0.5],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    />
  );
}

// 渐变动画背景球
export function FloatingOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-30 ${className}`}
      animate={{
        y: [0, -30, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 8,
        delay,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    />
  );
}

// 静态网格背景
export function GridPattern({ className = "" }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 opacity-[0.03] dark:opacity-[0.08] ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
      }}
    />
  );
}

export interface GridBackgroundProps {
  /** 子内容 */
  children?: React.ReactNode;
  /** 额外的 className */
  className?: string;
  /** 是否显示网格节点闪烁（默认 true） */
  showNodes?: boolean;
}

export function GridBackground({
  children,
  className = "",
  showNodes = true,
}: GridBackgroundProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 背景渐变 */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />

      {/* 动态装饰球 - 橙色系 */}
      <FloatingOrb
        className="w-[600px] h-[600px] bg-orange-500/30 dark:bg-orange-600/20 -top-40 -left-40"
        delay={0}
      />
      <FloatingOrb
        className="w-[500px] h-[500px] bg-amber-400/25 dark:bg-amber-500/15 top-20 -right-40"
        delay={2}
      />
      <FloatingOrb
        className="w-[400px] h-[400px] bg-yellow-400/20 dark:bg-yellow-500/10 bottom-20 left-1/4"
        delay={4}
      />

      {/* 网格背景 */}
      <GridPattern />

      {/* 沿网格线移动的发光流线 - 水平 */}
      <GridLine row={2} duration={5} delay={0} isHorizontal />
      <GridLine row={4} duration={6} delay={1.5} isHorizontal />
      <GridLine row={6} duration={4.5} delay={3} isHorizontal />
      <GridLine row={8} duration={5.5} delay={0.8} isHorizontal />
      <GridLine row={10} duration={6.5} delay={2.2} isHorizontal />

      {/* 沿网格线移动的发光流线 - 垂直 */}
      <GridLine row={4} duration={5} delay={0.5} isHorizontal={false} />
      <GridLine row={8} duration={6} delay={2} isHorizontal={false} />
      <GridLine row={12} duration={4.5} delay={1} isHorizontal={false} />
      <GridLine row={16} duration={5.5} delay={3.5} isHorizontal={false} />
      <GridLine row={20} duration={6} delay={1.8} isHorizontal={false} />

      {/* 网格交叉点闪烁 */}
      {showNodes && (
        <>
          <GridNode row={3} col={5} delay={0} />
          <GridNode row={5} col={12} delay={1} />
          <GridNode row={7} col={8} delay={2} />
          <GridNode row={4} col={18} delay={0.5} />
          <GridNode row={9} col={3} delay={1.5} />
          <GridNode row={6} col={22} delay={2.5} />
        </>
      )}

      {/* 子内容 */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
