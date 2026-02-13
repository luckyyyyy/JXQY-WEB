/**
 * MemoGui Component - based on JxqyHD Engine/Gui/MemoGui.cs
 * Displays game memo/quest log
 *
 * shows text with scroll bar
 * Resources loaded from UI_Settings.ini
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // 从 UI_Settings.ini 加载配置
  const config = useMemoGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel4.asf");

  // 测量内容实际高度
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, []);

  // 计算面板位置 - Globals.WindowWidth / 2f + leftAdjust
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

  // 像素级滚动：可滚动的最大像素偏移
  const viewHeight = config?.text.height ?? 180;
  const maxScrollPx = Math.max(0, contentHeight - viewHeight);
  // ScrollBar 用 0~100 的整数值
  const scrollSteps = 100;
  const maxScrollValue = maxScrollPx > 0 ? scrollSteps : 0;

  // 滚动处理（鼠标滚轮，每次滚动 20px 对应的步数）
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (maxScrollPx <= 0) return;
      const pxPerStep = maxScrollPx / scrollSteps;
      const delta = e.deltaY > 0 ? Math.ceil(20 / pxPerStep) : -Math.ceil(20 / pxPerStep);
      setScrollOffset((prev) => Math.max(0, Math.min(maxScrollValue, prev + delta)));
    },
    [maxScrollPx, maxScrollValue]
  );

  // 将 scrollOffset（0~scrollSteps）映射到实际像素偏移
  const scrollPx = maxScrollPx > 0 ? (scrollOffset / scrollSteps) * maxScrollPx : 0;

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div
      style={panelStyle}
      onClick={(e) => e.stopPropagation()}
      onWheel={handleWheel}
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
        <div
          ref={contentRef}
          style={{
            transform: `translateY(-${Math.round(scrollPx)}px)`,
          }}
        >
          {memos.map((memo, idx) => (
            <div
              key={`memo-${idx}`}
              style={{
                fontSize: 12,
                fontFamily: "SimSun, serif",
                color: "#000",
                lineHeight: `${16 + config.text.lineSpace}px`,
                letterSpacing: config.text.charSpace,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {memo}
            </div>
          ))}
        </div>
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
        maxValue={maxScrollValue}
        left={config.slider.left}
        top={config.slider.top}
        width={config.slider.width}
        height={config.slider.height}
        buttonImage={config.slider.imageBtn}
        onChange={setScrollOffset}
        visible={maxScrollPx > 0}
      />
    </div>
  );
};
