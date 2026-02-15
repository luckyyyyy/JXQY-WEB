/**
 * Animations - 通用动画组件封装
 *
 * 基于 framer-motion 的常用动画模式
 */

import { type HTMLMotionProps, motion, type Variants } from "framer-motion";
import type React from "react";

// ============= FadeIn - 淡入动画 =============

export interface FadeInProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = "up",
  distance = 20,
  ...props
}: FadeInProps) {
  const getInitialPosition = () => {
    switch (direction) {
      case "up":
        return { y: distance };
      case "down":
        return { y: -distance };
      case "left":
        return { x: distance };
      case "right":
        return { x: -distance };
      default:
        return {};
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...getInitialPosition() }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============= FadeInView - 进入视口时淡入 =============

export interface FadeInViewProps extends FadeInProps {
  once?: boolean;
  amount?: number | "some" | "all";
}

export function FadeInView({
  children,
  delay = 0,
  duration = 0.5,
  direction = "up",
  distance = 20,
  once = true,
  amount = 0.3,
  ...props
}: FadeInViewProps) {
  const getInitialPosition = () => {
    switch (direction) {
      case "up":
        return { y: distance };
      case "down":
        return { y: -distance };
      case "left":
        return { x: distance };
      case "right":
        return { x: -distance };
      default:
        return {};
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...getInitialPosition() }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============= ScaleIn - 缩放淡入 =============

export interface ScaleInProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  initialScale?: number;
}

export function ScaleIn({
  children,
  delay = 0,
  duration = 0.4,
  initialScale = 0.9,
  ...props
}: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: initialScale }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============= Stagger - 交错动画容器 =============

export interface StaggerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  staggerDelay?: number;
  delayStart?: number;
}

const staggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export function Stagger({ children, staggerDelay = 0.1, delayStart = 0, ...props }: StaggerProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delayStart,
          },
        },
      }}
      initial="hidden"
      animate="visible"
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============= StaggerItem - 交错动画子元素 =============

export interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
}

export function StaggerItem({ children, direction = "up", ...props }: StaggerItemProps) {
  const getTransform = () => {
    switch (direction) {
      case "up":
        return { y: 20 };
      case "down":
        return { y: -20 };
      case "left":
        return { x: 20 };
      case "right":
        return { x: -20 };
    }
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, ...getTransform() },
        visible: { opacity: 1, x: 0, y: 0 },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============= Hover 效果封装 =============

export interface HoverScaleProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  scale?: number;
}

export function HoverScale({ children, scale = 1.05, ...props }: HoverScaleProps) {
  return (
    <motion.div whileHover={{ scale }} whileTap={{ scale: 0.98 }} {...props}>
      {children}
    </motion.div>
  );
}

// ============= Pulse - 脉冲动画 =============

export interface PulseProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  duration?: number;
}

export function Pulse({ children, duration = 2, ...props }: PulseProps) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============= Slide - 滑入动画 =============

export interface SlideProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  direction: "left" | "right" | "up" | "down";
  show: boolean;
  distance?: number | string;
  duration?: number;
}

export function Slide({
  children,
  direction,
  show,
  distance = "100%",
  duration = 0.3,
  ...props
}: SlideProps) {
  const getPosition = () => {
    switch (direction) {
      case "left":
        return { x: `-${distance}` };
      case "right":
        return { x: distance };
      case "up":
        return { y: `-${distance}` };
      case "down":
        return { y: distance };
    }
  };

  return (
    <motion.div
      initial={getPosition()}
      animate={show ? { x: 0, y: 0 } : getPosition()}
      transition={{ duration, ease: "easeInOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
