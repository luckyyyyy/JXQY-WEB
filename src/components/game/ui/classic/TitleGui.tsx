/**
 * TitleGui Component - based on JxqyHD Engine/Gui/TitleGui.cs
 * Main menu screen with ASF button images from resources
 *
 * C# Reference: TitleGui.cs loads title.jpg and button ASF files
 * Resources: asf/ui/title/*.asf, asf/ui/title/title.jpg
 */

import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { buildPath } from "@/config";
import { logger } from "@/engine/core/logger";
import { GAME_FONTS } from "@/engine/gui/fonts";
import { useAsfImage } from "./hooks";

// UI配置 - 对应 UI_Settings.ini 中的 [Title] 部分
const UI_CONFIG = {
  background: "asf/ui/title/title.jpg",
  buttons: [
    {
      id: "begin",
      image: "asf/ui/title/InitBtn.asf",
      left: 327,
      top: 112,
      width: 81,
      height: 66,
      label: "开始游戏",
    },
    {
      id: "load",
      image: "asf/ui/title/LoadBtn.asf",
      left: 327,
      top: 177,
      width: 81,
      height: 66,
      label: "读取存档",
    },
    {
      id: "team",
      image: "asf/ui/title/TeamBtn.asf",
      left: 327,
      top: 240,
      width: 81,
      height: 66,
      label: "制作组",
    },
    {
      id: "exit",
      image: "asf/ui/title/ExitBtn.asf",
      left: 327,
      top: 303,
      width: 81,
      height: 66,
      label: "退出游戏",
    },
  ],
};

interface TitleGuiProps {
  screenWidth?: number;
  screenHeight?: number;
  onNewGame: () => void;
  onLoadGame: () => void;
  onTeam?: () => void;
  onExit?: () => void;
  onMapViewer?: () => void; // Web额外功能
}

/**
 * 标题按钮组件 - 使用 ASF 图片
 */
interface TitleButtonProps {
  imagePath: string;
  left: number;
  top: number;
  width: number;
  height: number;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}

const TitleButton: React.FC<TitleButtonProps> = ({
  imagePath,
  left,
  top,
  width,
  height,
  label,
  disabled = false,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // 加载普通状态帧（帧0）和悬停/按下状态帧（帧1）
  const normalImage = useAsfImage(imagePath, 0);
  const hoverImage = useAsfImage(imagePath, 1);

  const handleMouseDown = useCallback(() => {
    if (!disabled) setIsPressed(true);
  }, [disabled]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!disabled) setIsHovered(true);
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setIsPressed(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) onClick();
  }, [disabled, onClick]);

  // 决定显示哪个帧
  const currentImage = (isHovered || isPressed) && hoverImage.dataUrl ? hoverImage : normalImage;

  return (
    <div
      style={{
        position: "absolute",
        left: left,
        top: top,
        width: currentImage.width || width,
        height: currentImage.height || height,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
      title={label}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {currentImage.dataUrl ? (
        <img
          src={currentImage.dataUrl}
          alt={label}
          style={{
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
          draggable={false}
        />
      ) : (
        // 加载中不显示任何内容，等待 asf 加载完成
        <div
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      )}
    </div>
  );
};

export const TitleGui: React.FC<TitleGuiProps> = ({
  screenWidth: _screenWidth = 800,
  screenHeight: _screenHeight = 600,
  onNewGame,
  onLoadGame,
  onTeam,
  onExit,
  onMapViewer,
}) => {
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [backgroundError, setBackgroundError] = useState(false);

  // 背景图路径
  const backgroundUrl = buildPath(UI_CONFIG.background);

  // 原版背景是 640x480，需要居中
  const ORIGINAL_WIDTH = 640;
  const ORIGINAL_HEIGHT = 480;

  // 使用 CSS 居中，不依赖 screenWidth/screenHeight
  const containerStyle = useMemo(() => {
    return {
      position: "absolute" as const,
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: ORIGINAL_WIDTH,
      height: ORIGINAL_HEIGHT,
      overflow: "hidden" as const,
    };
  }, []);

  // 按钮处理器映射
  const handlers: Record<string, () => void> = useMemo(
    () => ({
      begin: onNewGame,
      load: onLoadGame,
      team: onTeam || (() => logger.log("Team credits")),
      exit: onExit || (() => logger.log("Exit game")),
    }),
    [onNewGame, onLoadGame, onTeam, onExit]
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* 背景容器 */}
      <div style={containerStyle}>
        {/* 背景图片 */}
        {!backgroundError ? (
          <img
            src={backgroundUrl}
            alt="剑侠情缘外传：月影传说"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: ORIGINAL_WIDTH,
              height: ORIGINAL_HEIGHT,
              imageRendering: "auto",
              opacity: backgroundLoaded ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
            onLoad={() => setBackgroundLoaded(true)}
            onError={() => setBackgroundError(true)}
            draggable={false}
          />
        ) : (
          // 背景加载失败时的备用样式
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, #1a0a00 0%, #0a0505 50%, #000 100%)",
            }}
          >
            {/* 标题文字 */}
            <div
              style={{
                position: "absolute",
                top: 60,
                left: 0,
                right: 0,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: GAME_FONTS.title,
                  fontSize: 48,
                  fontWeight: "bold",
                  color: "#ffd700",
                  textShadow: "0 0 20px rgba(255, 215, 0, 0.8), 0 4px 30px rgba(255, 100, 0, 0.5)",
                  letterSpacing: 8,
                }}
              >
                剑侠情缘
              </div>
              <div
                style={{
                  fontFamily: GAME_FONTS.title,
                  fontSize: 24,
                  color: "#c0a060",
                  marginTop: 8,
                  letterSpacing: 4,
                }}
              >
                月影传说
              </div>
            </div>
          </div>
        )}

        {/* 按钮 */}
        {UI_CONFIG.buttons.map((btn) => (
          <TitleButton
            key={btn.id}
            imagePath={btn.image}
            left={btn.left}
            top={btn.top}
            width={btn.width}
            height={btn.height}
            label={btn.label}
            onClick={handlers[btn.id]}
          />
        ))}

        {/* Web版额外功能 - 地图查看器入口 */}
        {onMapViewer && (
          <div
            style={{
              position: "absolute",
              left: 327,
              top: 380,
              cursor: "pointer",
            }}
            onClick={onMapViewer}
          >
            <span
              style={{
                fontFamily: GAME_FONTS.title,
                fontSize: 14,
                color: "#888",
                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              [地图查看器]
            </span>
          </div>
        )}

        {/* 版本信息 */}
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: GAME_FONTS.system,
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          Web Remake · Power by Vibe2D Engine
        </div>
      </div>
    </div>
  );
};
