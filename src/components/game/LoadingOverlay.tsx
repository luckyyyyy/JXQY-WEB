/**
 * LoadingOverlay - Loading screen component
 * Extracted from Game.tsx for better code organization
 */
import type React from "react";

interface LoadingOverlayProps {
  isLoading: boolean;
  progress: number;
  text?: string;
  /** 加载错误信息 */
  error?: string | null;
}

/**
 * Loading Overlay Component
 * Displays loading progress while game resources are being loaded
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  progress,
  text = "加载中...",
  error,
}) => {
  // 有错误时也需要显示
  if (!isLoading && !error) return null;

  // 错误界面
  if (error) {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.9)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          zIndex: 100,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
        <div style={{ fontSize: 24, marginBottom: 12, color: "#ff6b6b" }}>加载失败</div>
        <div style={{ fontSize: 16, marginBottom: 24, color: "#ccc" }}>{error}</div>
        <button
          onClick={() => {
            window.location.href = "/game";
          }}
          style={{
            padding: "10px 24px",
            fontSize: 16,
            background: "#4a90d9",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          开始新游戏
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        zIndex: 100,
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 20 }}>{text}</div>
      <div
        style={{
          width: 200,
          height: 8,
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: 4,
        }}
      >
        <div
          style={{
            width: `${Math.min(progress, 100)}%`,
            height: "100%",
            background: "#4a90d9",
            borderRadius: 4,
            transition: "width 0.2s ease",
          }}
        />
      </div>
      <div style={{ marginTop: 10, fontSize: 14, color: "#888" }}>
        {Math.round(Math.min(progress, 100))}%
      </div>
    </div>
  );
};
