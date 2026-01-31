/**
 * MemoGui Component - based on JxqyHD Engine/Gui/MemoGui.cs
 * Displays game memo/quest log
 *
 * C# Reference: MemoGui.cs shows text with scroll bar
 * Resources loaded from UI_Settings.ini
 */
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useAsfImage } from "./hooks";
import { ScrollBar } from "./ScrollBar";
import { useMemoGuiConfig } from "./useUISettings";

interface MemoGuiProps {
  isVisible: boolean;
  memos: string[]; // 任务记录列表
  screenWidth: number;
  onClose: () => void;
}

export const MemoGui: React.FC<MemoGuiProps> = ({ isVisible, memos, screenWidth }) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  // 从 UI_Settings.ini 加载配置
  const config = useMemoGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel4.asf");

  // 计算面板位置 - C#: Globals.WindowWidth / 2f + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 185;
    const panelHeight = panelImage.height || 225;

    return {
      position: "absolute" as const,
      left: screenWidth / 2 + config.panel.leftAdjust,
      top: config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  // 每页显示10条
  const linesPerPage = 10;
  const maxScrollOffset = Math.max(0, memos.length - linesPerPage);

  // 当前显示的任务
  const visibleMemos = useMemo(() => {
    return memos.slice(scrollOffset, scrollOffset + linesPerPage);
  }, [memos, scrollOffset]);

  // 滚动处理
  const handleScroll = useCallback(
    (delta: number) => {
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollOffset, prev + delta)));
    },
    [maxScrollOffset]
  );

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => handleScroll(e.deltaY > 0 ? 1 : -1)}
    >
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="任务面板"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: panelImage.width,
            height: panelImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 任务文本 */}
      <div
        style={{
          position: "absolute",
          left: config.text.left,
          top: config.text.top,
          width: config.text.width,
          height: config.text.height,
          overflow: "hidden",
        }}
      >
        {visibleMemos.map((memo, idx) => (
          <div
            key={`memo-${scrollOffset + idx}`}
            style={{
              fontSize: 12,
              fontFamily: "SimSun, serif",
              color: "#000",
              lineHeight: `${16 + config.text.lineSpace}px`,
              letterSpacing: config.text.charSpace,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {memo}
          </div>
        ))}
        {memos.length === 0 && (
          <div
            style={{
              fontSize: 12,
              fontFamily: "SimSun, serif",
              color: "#666",
              textAlign: "center",
              marginTop: 60,
            }}
          >
            暂无任务记录
          </div>
        )}
      </div>

      {/* 滚动条 - 使用 ASF 贴图 */}
      <ScrollBar
        value={scrollOffset}
        minValue={0}
        maxValue={maxScrollOffset}
        left={config.slider.left}
        top={config.slider.top}
        width={config.slider.width}
        height={config.slider.height}
        buttonImage={config.slider.imageBtn}
        onChange={setScrollOffset}
        visible={maxScrollOffset > 0}
      />
    </div>
  );
};
