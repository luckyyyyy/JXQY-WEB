/**
 * SystemGui Component - based on JxqyHD Engine/Gui/SystemGui.cs
 * Displays system menu with save/load, options, exit buttons
 *
 * C# Reference: SystemGui.cs shows system menu with 4 buttons
 * Resources loaded from UI_Settings.ini
 */
import type React from "react";
import { useMemo, useState } from "react";
import type { ButtonConfig } from "@/engine/gui/uiSettings";
import { useAsfImage } from "./hooks";
import { useSystemGuiConfig } from "./useUISettings";

interface SystemGuiProps {
  isVisible: boolean;
  screenWidth: number;
  screenHeight: number;
  onSaveLoad: () => void;
  onOption: () => void;
  onExit: () => void;
  onReturn: () => void;
}

/**
 * 系统按钮组件
 */
interface SystemButtonProps {
  config: ButtonConfig;
  onClick: () => void;
}

const SystemButton: React.FC<SystemButtonProps> = ({ config, onClick }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 加载普通状态帧
  const normalImage = useAsfImage(config.image, 0);
  // 加载按下状态帧
  const pressedImage = useAsfImage(config.image, 1);

  const currentImage = isPressed && pressedImage.dataUrl ? pressedImage : normalImage;

  return (
    <div
      style={{
        position: "absolute",
        left: config.left,
        top: config.top,
        width: config.width,
        height: config.height,
        cursor: "pointer",
        opacity: isHovered ? 1 : 0.9,
        filter: isHovered && !isPressed ? "brightness(1.1)" : "none",
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsPressed(false);
        setIsHovered(false);
      }}
      onClick={onClick}
    >
      {currentImage.dataUrl && (
        <img
          src={currentImage.dataUrl}
          alt=""
          style={{
            width: currentImage.width,
            height: currentImage.height,
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export const SystemGui: React.FC<SystemGuiProps> = ({
  isVisible,
  screenWidth,
  onSaveLoad,
  onOption,
  onExit,
  onReturn,
}) => {
  // 从 UI_Settings.ini 加载配置
  const config = useSystemGuiConfig();

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/common/panel.asf");

  // 计算面板位置 - C#: (Globals.WindowWidth - Width) / 2f + leftAdjust
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 185;
    const panelHeight = panelImage.height || 400;

    return {
      position: "absolute" as const,
      left: (screenWidth - panelWidth) / 2 + config.panel.leftAdjust,
      top: config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, panelImage.width, panelImage.height, config]);

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="系统菜单"
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

      {/* 存档/读档按钮 */}
      <SystemButton config={config.saveLoadBtn} onClick={onSaveLoad} />

      {/* 选项按钮 */}
      <SystemButton config={config.optionBtn} onClick={onOption} />

      {/* 退出按钮 */}
      <SystemButton config={config.exitBtn} onClick={onExit} />

      {/* 返回按钮 */}
      <SystemButton config={config.returnBtn} onClick={onReturn} />
    </div>
  );
};
