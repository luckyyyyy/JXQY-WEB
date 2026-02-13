/**
 * MessageGui Component - based on JxqyHD Engine/Gui/MessageGui.cs
 * Displays system messages like level up notifications
 *
 * shows messages with auto-hide after 2 seconds
 * Resources loaded from UI_Settings.ini [Message] and [Message_Text] sections
 */
import type React from "react";
import { useMemo } from "react";
import { useAsfImage } from "./hooks";
import { useMessageGuiConfig } from "./useUISettings";

interface MessageGuiProps {
  isVisible: boolean;
  message: string;
  screenWidth: number;
  screenHeight: number;
}

/**
 * MessageGui - 通用消息提示面板
 * 用于显示升级提示、系统消息等
 */
export const MessageGui: React.FC<MessageGuiProps> = ({
  isVisible,
  message,
  screenWidth,
  screenHeight,
}) => {
  // 从 UI_Settings.ini 加载配置
  const config = useMessageGuiConfig();

  // 加载面板背景图片
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/message/msgbox.asf");

  // 计算面板位置
  // Position = new Vector2((Globals.WindowWidth - Width) / 2 + leftAdjust,
  //                            Globals.WindowHeight - Height + topAdjust);
  const panelStyle = useMemo(() => {
    if (!config || !panelImage.width || !panelImage.height) return null;

    const panelWidth = panelImage.width;
    const panelHeight = panelImage.height;

    return {
      position: "absolute" as const,
      left: (screenWidth - panelWidth) / 2 + config.panel.leftAdjust,
      top: screenHeight - panelHeight + config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "none" as const,
      zIndex: 2000,
    };
  }, [screenWidth, screenHeight, panelImage.width, panelImage.height, config]);

  // 文本样式
  // TextGui 从 left 位置开始，文本从左往右排列
  const textStyle = useMemo((): React.CSSProperties | null => {
    if (!config) return null;

    return {
      position: "absolute",
      left: config.text.left,
      top: config.text.top,
      width: config.text.width,
      height: config.text.height,
      color: config.text.color,
      fontSize: 14, // 匹配 C# 的 FontSize12
      fontFamily: "'ZCOOL XiaoWei', serif",
      letterSpacing: config.text.charSpace,
      lineHeight: `${16 + config.text.lineSpace}px`,
      wordBreak: "break-all",
      whiteSpace: "normal",
      overflow: "hidden",
    };
  }, [config]);

  if (!isVisible || !config || !panelStyle || !textStyle) return null;

  return (
    <div style={panelStyle}>
      {/* 背景图片 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="message panel"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}

      {/* 消息文本 */}
      <div style={textStyle}>{message}</div>
    </div>
  );
};
