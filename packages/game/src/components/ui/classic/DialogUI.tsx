/**
 * Dialog UI Component - based on JxqyHD Engine/Gui/DialogGui.cs
 * Displays NPC dialogue with portrait images from resources
 *
 * loads portraits from HeadFile.ini
 * Resources loaded from UI_Settings.ini
 */
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { getPortraitPathByIndex } from "../portraitUtils";

// 统一楷体字体样式
const KAITI_FONT = '"STKaiti", "楷体", "KaiTi", "SimKai", serif';
const DIALOG_TEXT_STYLE = {
  fontFamily: KAITI_FONT,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.6,
  letterSpacing: 0.5,
  color: "rgba(0, 0, 0, 0.9)",
};

import type { DialogGuiState } from "@miu2d/engine/gui/ui-types";
import { useAsfImage } from "./hooks";
import { useDialogGuiConfig } from "./useUISettings";

interface DialogUIProps {
  state: DialogGuiState;
  screenWidth?: number;
  screenHeight?: number;
  onClose: () => void;
  onSelectionMade?: (selection: number) => void;
}

// Color mapping for <color=X> tags
// "Default" is special - will be handled to restore default color
const colorMap: Record<string, string> = {
  red: "#ff4444",
  Red: "#ff4444",
  RED: "#ff4444",
  blue: "#4488ff",
  Blue: "#4488ff",
  BLUE: "#4488ff",
  green: "#44ff44",
  Green: "#44ff44",
  GREEN: "#44ff44",
  yellow: "#ffff44",
  Yellow: "#ffff44",
  YELLOW: "#ffff44",
  black: "#000000",
  Black: "#000000",
  BLACK: "#000000",
  white: "#ffffff",
  White: "#ffffff",
  WHITE: "#ffffff",
  purple: "#aa44ff",
  Purple: "#aa44ff",
  orange: "#ff8844",
  Orange: "#ff8844",
};

// Parse text with <color=X> tags into segments
// Supports <color=Red>red text<color=Default> format
interface TextSegment {
  text: string;
  color: string;
}

function parseColoredText(text: string, defaultColor: string = "#000000"): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /<color=([^>]+)>/gi;
  let lastIndex = 0;
  let currentColor = defaultColor;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      const segment = text.substring(lastIndex, match.index);
      if (segment) {
        segments.push({ text: segment, color: currentColor });
      }
    }
    // Handle <color=Default> to restore default color
    const colorName = match[1];
    if (colorName === "Default" || colorName === "default" || colorName === "DEFAULT") {
      currentColor = defaultColor;
    } else {
      currentColor = colorMap[colorName] || colorName || defaultColor;
    }
    lastIndex = match.index + match[0].length;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex), color: currentColor });
  }

  return segments;
}

// Render text with color segments
const ColoredText: React.FC<{ text: string; defaultColor?: string }> = ({
  text,
  defaultColor = "#000000",
}) => {
  const segments = useMemo(() => parseColoredText(text, defaultColor), [text, defaultColor]);

  return (
    <>
      {segments.map((segment, index) => (
        <span key={`${segment.color}-${index}`} style={{ color: segment.color }}>
          {segment.text}
        </span>
      ))}
    </>
  );
};

/**
 * Portrait Component - 显示对话头像
 */
interface PortraitProps {
  portraitIndex: number;
  left: number;
  top: number;
}

const Portrait: React.FC<PortraitProps> = ({ portraitIndex, left, top }) => {
  // 根据索引从 API 数据获取头像文件路径
  const portraitPath = getPortraitPathByIndex(portraitIndex);

  const portraitImage = useAsfImage(portraitPath, 0);

  if (!portraitPath || !portraitImage.dataUrl) {
    return null;
  }

  return (
    <img
      src={portraitImage.dataUrl}
      alt="对话头像"
      style={{
        position: "absolute",
        left: left,
        top: top,
        width: portraitImage.width,
        height: portraitImage.height,
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
};

export const DialogUI: React.FC<DialogUIProps> = ({
  state,
  screenWidth = 800,
  screenHeight: _screenHeight = 600,
  onClose,
  onSelectionMade,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [hoveredSelection, setHoveredSelection] = useState<number>(-1);
  const [keyboardSelection, setKeyboardSelection] = useState<number>(0); // 默认选中第一项

  // 从 UI_Settings.ini 加载配置
  const config = useDialogGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/dialog/panel.asf");

  // 处理全屏遮罩点击 - 对话模式下点击任意位置都可以下一步
  // 但是选择模式下不能点击遮罩跳过，必须选择
  const handleOverlayClick = (e: React.MouseEvent) => {
    // 如果在选择模式，不处理遮罩点击
    if (state.isInSelecting) {
      e.stopPropagation();
      return;
    }
    // 非选择模式，点击遮罩等同于点击对话框，推进对话
    onClose();
  };

  // 键盘事件处理
  useEffect(() => {
    if (!state.isVisible || !state.isInSelecting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        setKeyboardSelection(0);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        setKeyboardSelection(1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onSelectionMade) {
          onSelectionMade(keyboardSelection);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.isVisible, state.isInSelecting, keyboardSelection, onSelectionMade]);

  // 重置选择状态 - 每次进入选择模式时
  useEffect(() => {
    if (state.isInSelecting) {
      setKeyboardSelection(0); // 默认选中第一项
      setHoveredSelection(-1);
    }
  }, [state.isInSelecting]);

  // Typewriter effect
  useEffect(() => {
    if (!state.isVisible) {
      setDisplayedText("");
      return;
    }

    const _plainText = state.text.replace(/<color=[^>]+>/gi, "");
    const targetLength = Math.floor(state.textProgress);

    let plainIndex = 0;
    let originalIndex = 0;
    const tagRegex = /<color=[^>]+>/gi;
    let tagMatch: RegExpExecArray | null = tagRegex.exec(state.text);
    const tagPositions: { start: number; end: number }[] = [];

    while (tagMatch !== null) {
      tagPositions.push({ start: tagMatch.index, end: tagMatch.index + tagMatch[0].length });
      tagMatch = tagRegex.exec(state.text);
    }

    let tagIdx = 0;
    while (plainIndex < targetLength && originalIndex < state.text.length) {
      while (tagIdx < tagPositions.length && originalIndex === tagPositions[tagIdx].start) {
        originalIndex = tagPositions[tagIdx].end;
        tagIdx++;
      }
      if (originalIndex < state.text.length) {
        plainIndex++;
        originalIndex++;
      }
    }

    while (tagIdx < tagPositions.length && originalIndex === tagPositions[tagIdx].start) {
      originalIndex = tagPositions[tagIdx].end;
      tagIdx++;
    }

    setDisplayedText(state.text.substring(0, originalIndex));
  }, [state.text, state.textProgress, state.isVisible]);

  // 处理选择点击
  const handleSelectionClick = (selection: number) => {
    if (state.isInSelecting && onSelectionMade) {
      onSelectionMade(selection);
    }
  };

  if (!state.isVisible || !config) return null;

  // 计算面板位置
  // Position = new Vector2((Globals.WindowWidth - BaseTexture.Width) / 2f + leftAdjust,
  //                            Globals.WindowHeight + topAdjust)
  // Position 是面板左上角坐标，topAdjust 为负值（如 -208）
  // 换算成 CSS bottom 定位：
  //   面板顶部 Y = screenHeight + topAdjust = 600 + (-208) = 392
  //   面板底部 Y = 392 + panelHeight = 392 + 123 = 515
  //   距屏幕底部 = screenHeight - 515 = 85
  //   即 bottom = -topAdjust - panelHeight
  const panelWidth = panelImage.width || 438;
  const panelHeight = panelImage.height || 123;
  const panelLeft = (screenWidth - panelWidth) / 2 + config.panel.leftAdjust;
  const panelBottom = -config.panel.topAdjust - panelHeight;

  // 选项颜色 - 蓝色普通，红色悬停/选中
  // config.selectA.color 已经是 CSS rgba 字符串
  const selectionNormalColor = config.selectA.color || "rgba(0,0,255,0.8)";
  const selectionActiveColor = "rgba(255, 0, 0, 0.8)";

  // 判断选项是否激活（hover 或 键盘选中）
  // 默认选中第一项
  const isOptionAActive =
    hoveredSelection === 0 || (hoveredSelection === -1 && keyboardSelection === 0);
  const isOptionBActive =
    hoveredSelection === 1 || (hoveredSelection === -1 && keyboardSelection === 1);

  return (
    <>
      {/* 全屏透明遮罩 - 对话模式下点击任意位置可以下一步 */}
      {/* 选择模式下遮罩仍存在但不响应点击（必须点击选项） */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          // 透明遮罩 - 不阻挡视线
          background: "transparent",
          // 选择模式下不显示指针（需要点击选项）
          cursor: state.isInSelecting ? "default" : "pointer",
          pointerEvents: "auto",
        }}
        onClick={handleOverlayClick}
      />
      {/* 对话框面板 */}
      <div
        style={{
          position: "absolute",
          left: panelLeft,
          bottom: panelBottom,
          zIndex: 101,
          width: panelWidth,
          height: panelHeight,
          pointerEvents: "auto",
          cursor: state.isInSelecting ? "default" : "pointer",
        }}
        onClick={state.isInSelecting ? undefined : onClose}
      >
        {/* 头像 - 在面板上方 */}
        {state.portraitIndex > 0 && (
          <Portrait
            portraitIndex={state.portraitIndex}
            left={config.portrait.left}
            top={config.portrait.top}
          />
        )}

        {/* 面板背景 */}
        {panelImage.dataUrl && (
          <img
            src={panelImage.dataUrl}
            alt="对话框"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: panelWidth,
              height: panelHeight,
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
          />
        )}

        {/* 对话文本 */}
        <div
          style={{
            position: "absolute",
            left: config.text.left,
            top: config.text.top,
            width: config.text.width,
            height: config.text.height,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <p
            style={{
              margin: 0,
              ...DIALOG_TEXT_STYLE,
              letterSpacing: config.text.charSpace,
            }}
          >
            <ColoredText text={displayedText} defaultColor="#000000" />
            {!state.isComplete && !state.isInSelecting && (
              <span
                style={{
                  animation: "blink 0.5s infinite",
                  color: "#000",
                }}
              >
                |
              </span>
            )}
          </p>
        </div>

        {/* 选择模式 - 选项 A */}
        {state.isInSelecting && state.selectA && (
          <div
            style={{
              position: "absolute",
              left: config.selectA.left,
              top: config.selectA.top,
              width: config.selectA.width,
              height: config.selectA.height,
              cursor: "pointer",
              color: isOptionAActive ? selectionActiveColor : selectionNormalColor,
              fontSize: 14,
              fontFamily: '"STKaiti", "楷体", "KaiTi", "SimKai", serif',
              lineHeight: `${config.selectA.height}px`,
              transition: "color 0.15s ease",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectionClick(0);
            }}
            onMouseEnter={() => setHoveredSelection(0)}
            onMouseLeave={() => setHoveredSelection(-1)}
          >
            {state.selectA}
          </div>
        )}

        {/* 选择模式 - 选项 B */}
        {state.isInSelecting && state.selectB && (
          <div
            style={{
              position: "absolute",
              left: config.selectB.left,
              top: config.selectB.top,
              width: config.selectB.width,
              height: config.selectB.height,
              cursor: "pointer",
              color: isOptionBActive ? selectionActiveColor : selectionNormalColor,
              fontSize: 14,
              fontFamily: '"STKaiti", "楷体", "KaiTi", "SimKai", serif',
              lineHeight: `${config.selectB.height}px`,
              transition: "color 0.15s ease",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectionClick(1);
            }}
            onMouseEnter={() => setHoveredSelection(1)}
            onMouseLeave={() => setHoveredSelection(-1)}
          >
            {state.selectB}
          </div>
        )}

        {/* 点击提示 - 仅在非选择模式显示 */}
        {!state.isInSelecting && (
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,
              fontSize: 11,
              color: "rgba(0, 0, 0, 0.5)",
              pointerEvents: "none",
            }}
          >
            {state.isComplete ? <span style={{ animation: "blink 1s infinite" }}>▼</span> : "..."}
          </div>
        )}

        <style>
          {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
        </style>
      </div>
    </>
  );
};
