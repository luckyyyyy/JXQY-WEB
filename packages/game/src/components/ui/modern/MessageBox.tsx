/**
 * Modern MessageBox - 消息提示框
 * 位置与经典UI一致
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { borderRadius, glassEffect, modernColors, spacing, transitions, typography } from "./theme";

interface MessageBoxProps {
  isVisible: boolean;
  message: string;
  screenWidth: number;
  screenHeight: number;
}

export const MessageBox: React.FC<MessageBoxProps> = ({
  isVisible,
  message,
  screenWidth,
  screenHeight,
}) => {
  const [opacity, setOpacity] = useState(0);

  // 淡入淡出效果 - 2秒显示，与经典UI一致
  useEffect(() => {
    if (isVisible) {
      setOpacity(1);
      const fadeOutTimer = setTimeout(() => {
        setOpacity(0);
      }, 1700);
      return () => {
        clearTimeout(fadeOutTimer);
      };
    } else {
      setOpacity(0);
    }
  }, [isVisible]);

  const panelStyle: React.CSSProperties = useMemo(
    () => ({
      position: "absolute",
      left: "50%",
      bottom: 180, // 往上移：screenHeight - 80 -> bottom: 180
      transform: "translateX(-50%)",
      maxWidth: Math.min(400, screenWidth - 40),
      padding: `${spacing.md}px ${spacing.xl}px`,
      ...glassEffect.glow,
      borderRadius: borderRadius.lg,
      pointerEvents: "none",
      opacity,
      transition: `opacity ${transitions.normal}`,
      display: "flex",
      alignItems: "center",
      gap: spacing.md,
      zIndex: 2000,
    }),
    [screenWidth, opacity]
  );

  if (!isVisible || !message) return null;

  return (
    <div style={panelStyle}>
      <span style={{ fontSize: 24 }}>ℹ️</span>
      <span
        style={{
          fontSize: typography.fontSize.md,
          color: modernColors.text.primary,
          textAlign: "center",
        }}
      >
        {message}
      </span>
    </div>
  );
};

/**
 * 消息队列组件 - 支持同时显示多条消息
 */
interface MessageQueueProps {
  messages: Array<{ id: string; text: string }>;
  screenWidth: number;
  onRemove?: (id: string) => void;
}

export const MessageQueue: React.FC<MessageQueueProps> = ({ messages, screenWidth, onRemove }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 100,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        pointerEvents: "none",
        maxWidth: Math.min(400, screenWidth - 40),
      }}
    >
      {messages.map((msg, idx) => (
        <MessageItem
          key={msg.id}
          message={msg.text}
          index={idx}
          onAnimationEnd={() => onRemove?.(msg.id)}
        />
      ))}
    </div>
  );
};

interface MessageItemProps {
  message: string;
  index: number;
  onAnimationEnd?: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, index, onAnimationEnd }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 2500);

    const removeTimer = setTimeout(() => {
      onAnimationEnd?.();
    }, 3000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [onAnimationEnd]);

  return (
    <div
      style={{
        padding: `${spacing.sm}px ${spacing.lg}px`,
        ...glassEffect.standard,
        borderRadius: borderRadius.md,
        opacity: isExiting ? 0 : 1,
        transform: `translateY(${isExiting ? -10 : 0}px)`,
        transition: "all 0.3s ease",
        animation: "slideIn 0.3s ease",
        pointerEvents: "auto",
      }}
    >
      <span
        style={{
          fontSize: typography.fontSize.sm,
          color: modernColors.text.primary,
        }}
      >
        {message}
      </span>
      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};
