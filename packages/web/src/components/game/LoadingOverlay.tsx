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

  const pct = Math.round(Math.min(progress, 100));

  // 错误界面
  if (error) {
    return (
      <div style={overlayStyle}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
        <div style={{ fontSize: 24, marginBottom: 12, color: "#ff6b6b" }}>加载失败</div>
        <div style={{ fontSize: 16, marginBottom: 24, color: "#aaa", maxWidth: 400, textAlign: "center" as const }}>{error}</div>
        <button
          type="button"
          onClick={() => { window.location.href = "/"; }}
          style={buttonStyle}
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div style={overlayStyle}>
      {/* 标题 */}
      <div style={{ fontSize: 14, letterSpacing: 2, color: "#666", marginBottom: 24, textTransform: "uppercase" as const }}>
        月影传说
      </div>

      {/* 进度条容器 */}
      <div style={barContainerStyle}>
        {/* 进度条背景动画 */}
        <div style={{
          ...barFillStyle,
          width: `${pct}%`,
        }} />
        {/* 进度条高光 */}
        {pct > 0 && pct < 100 && (
          <div style={{
            position: "absolute" as const,
            right: `${100 - pct}%`,
            top: 0,
            width: 20,
            height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
            borderRadius: 4,
          }} />
        )}
      </div>

      {/* 进度信息 */}
      <div style={{ display: "flex", justifyContent: "space-between", width: 320, marginTop: 8 }}>
        <div style={{ fontSize: 13, color: "#888" }}>{text}</div>
        <div style={{ fontSize: 13, color: "#666", fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
      </div>
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "#0a0a0a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  zIndex: 100,
};

const barContainerStyle: React.CSSProperties = {
  position: "relative",
  width: 320,
  height: 6,
  background: "rgba(255, 255, 255, 0.08)",
  borderRadius: 3,
  overflow: "hidden",
};

const barFillStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
  borderRadius: 3,
  transition: "width 0.3s ease-out",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 28px",
  fontSize: 14,
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  letterSpacing: 1,
};
