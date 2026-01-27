/**
 * Dialog UI Component - based on JxqyHD Engine/Gui/DialogGui.cs
 * Displays NPC dialogue with portrait images from resources
 *
 * C# Reference: DialogGui.cs loads portraits from HeadFile.ini
 * Resources loaded from UI_Settings.ini
 */
import React, { useEffect, useState, useMemo } from "react";
import type { DialogGuiState } from "../../engine/gui/types";
import { useAsfImage } from "./hooks";
import { DIALOG_TEXT_STYLE } from "../../engine/gui/fonts";
import { useDialogGuiConfig } from "./useUISettings";

// 头像索引映射 - 对应 HeadFile.ini
// 索引 -> asf文件名
const PORTRAIT_MAP: Record<number, string> = {
  1: "fac001a.asf",
  2: "fac001b.asf",
  3: "fac001c.asf",
  4: "fac001d.asf",
  5: "fac001e.asf",
  6: "fac001f.asf",
  7: "fac001g.asf",
  8: "fac001h.asf",
  9: "fac002a.asf",
  10: "fac002b.asf",
  11: "fac002c.asf",
  12: "fac002d.asf",
  13: "fac002e.asf",
  14: "fac002f.asf",
  15: "fac002g.asf",
  16: "fac003a.asf",
  17: "fac003b.asf",
  18: "fac003c.asf",
  19: "fac003d.asf",
  20: "fac003e.asf",
  21: "fac003f.asf",
  22: "fac004a.asf",
  23: "fac004b.asf",
  24: "fac004c.asf",
  25: "fac004d.asf",
  26: "fac004e.asf",
  27: "fac004f.asf",
  28: "fac004g.asf",
  29: "fac005a.asf",
  30: "fac005b.asf",
  31: "fac005c.asf",
  32: "fac005d.asf",
  33: "fac006a.asf",
  34: "fac006b.asf",
  35: "fac006c.asf",
  36: "fac006d.asf",
  37: "fac006e.asf",
  38: "fac007a.asf",
  39: "fac007b.asf",
  40: "fac007c.asf",
  41: "fac007d.asf",
  42: "fac008a.asf",
  43: "fac008b.asf",
  44: "fac009.asf",
  45: "fac010.asf",
  46: "fac011.asf",
  47: "fac012.asf",
  48: "fac013.asf",
  49: "fac090.asf",
  50: "fac091.asf",
  51: "fac014a.asf",
  52: "fac014b.asf",
  53: "fac015.asf",
  54: "fac016.asf",
  55: "fac017.asf",
  56: "fac018.asf",
  57: "fac019.asf",
  58: "fac020.asf",
  59: "fac021.asf",
  60: "fac022.asf",
  61: "fac023.asf",
  62: "fac024.asf",
  63: "fac025.asf",
  64: "fac026.asf",
  65: "fac027.asf",
  66: "fac028.asf",
  69: "fac030.asf",
  70: "fac031.asf",
  71: "fac032.asf",
  72: "fac093.asf",
  73: "fac094.asf",
  74: "fac033.asf",
  75: "fac034.asf",
  76: "fac035.asf",
  78: "fac037.asf",
  79: "fac038.asf",
  80: "fac050.asf",
  81: "fac051.asf",
  82: "fac052.asf",
  83: "fac053.asf",
  84: "fac054.asf",
  85: "fac055.asf",
  86: "fac056.asf",
  87: "fac057.asf",
  88: "fac058.asf",
  90: "fac060.asf",
  91: "fac061.asf",
  92: "fac062.asf",
  93: "fac096.asf",
  94: "fac063.asf",
  96: "fac065.asf",
  98: "fac068.asf",
  107: "fac074.asf",
  109: "fac076.asf",
  111: "fac078.asf",
  112: "fac079.asf",
  114: "fac082.asf",
  116: "fac002h.asf",
  117: "fac001i.asf",
  118: "fac057b.asf",
  119: "fac004h.asf",
  120: "fac001j.asf",
  121: "fac002i.asf",
  122: "fac003g.asf",
  123: "fac004i.asf",
  124: "fac005e.asf",
  125: "fac057a.asf",
  // 特殊头像 - 主角不同表情等
  1001: "fac001c2.asf",  // 杨影枫特殊表情
};

interface DialogUIProps {
  state: DialogGuiState;
  screenWidth?: number;
  screenHeight?: number;
  onClose: () => void;
  onSelectionMade?: (selection: number) => void;
}

// Color mapping for <color=X> tags
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
interface TextSegment {
  text: string;
  color: string;
}

function parseColoredText(text: string, defaultColor: string = "#000000"): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /<color=([^>]+)>/gi;
  let lastIndex = 0;
  let currentColor = defaultColor;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const segment = text.substring(lastIndex, match.index);
      if (segment) {
        segments.push({ text: segment, color: currentColor });
      }
    }
    currentColor = colorMap[match[1]] || match[1] || defaultColor;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex), color: currentColor });
  }

  return segments;
}

// Render text with color segments
const ColoredText: React.FC<{ text: string; defaultColor?: string }> = ({
  text,
  defaultColor = "#000000"
}) => {
  const segments = useMemo(() => parseColoredText(text, defaultColor), [text, defaultColor]);

  return (
    <>
      {segments.map((segment, index) => (
        <span key={index} style={{ color: segment.color }}>
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
  // 根据索引获取头像文件名
  const portraitFile = PORTRAIT_MAP[portraitIndex];
  const portraitPath = portraitFile ? `asf/portrait/${portraitFile}` : null;

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
  screenHeight = 600,
  onClose,
  onSelectionMade,
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [hoveredSelection, setHoveredSelection] = useState<number>(-1);
  const [keyboardSelection, setKeyboardSelection] = useState<number>(0); // C# 默认选中第一项

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
      setKeyboardSelection(0); // C# 默认选中第一项
      setHoveredSelection(-1);
    }
  }, [state.isInSelecting]);

  // Typewriter effect
  useEffect(() => {
    if (!state.isVisible) {
      setDisplayedText("");
      return;
    }

    const plainText = state.text.replace(/<color=[^>]+>/gi, "");
    const targetLength = Math.floor(state.textProgress);

    let plainIndex = 0;
    let originalIndex = 0;
    const tagRegex = /<color=[^>]+>/gi;
    let tagMatch: RegExpExecArray | null;
    const tagPositions: { start: number; end: number }[] = [];

    while ((tagMatch = tagRegex.exec(state.text)) !== null) {
      tagPositions.push({ start: tagMatch.index, end: tagMatch.index + tagMatch[0].length });
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
  // C#: Position = new Vector2((Globals.WindowWidth - BaseTexture.Width) / 2f + leftAdjust,
  //                            Globals.WindowHeight + topAdjust)
  const panelWidth = panelImage.width || 380;
  const panelHeight = panelImage.height || 108;
  const panelLeft = (screenWidth - panelWidth) / 2 + config.panel.leftAdjust;
  const panelBottom = -config.panel.topAdjust; // topAdjust 是负值，所以取反

  // 选项颜色 - C#: 蓝色普通，红色悬停/选中
  // config.selectA.color 已经是 CSS rgba 字符串
  const selectionNormalColor = config.selectA.color || "rgba(0,0,255,0.8)";
  const selectionActiveColor = "rgba(255, 0, 0, 0.8)";

  // 判断选项是否激活（hover 或 键盘选中）
  // C# 默认选中第一项
  const isOptionAActive = hoveredSelection === 0 || (hoveredSelection === -1 && keyboardSelection === 0);
  const isOptionBActive = hoveredSelection === 1 || (hoveredSelection === -1 && keyboardSelection === 1);

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
          {state.isComplete ? (
            <span style={{ animation: "blink 1s infinite" }}>▼</span>
          ) : (
            "..."
          )}
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
