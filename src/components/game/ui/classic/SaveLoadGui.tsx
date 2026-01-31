/**
 * SaveLoadGui Component - based on JxqyHD Engine/Gui/SaveLoadGui.cs
 * Displays save/load interface with slot list, snapshot preview, and action buttons
 *
 * C# Reference: SaveLoadGui.cs shows save/load menu with 7 slots
 * Resources loaded from UI_Settings.ini [SaveLoad] section
 */
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { logger } from "@/engine/core/logger";
import { StorageManager, type SaveSlotInfo } from "@/engine/game/storage";
import type { ButtonConfig, SaveLoadGuiConfig } from "@/engine/gui/uiSettings";
import { useAsfImage } from "./hooks";
import { useSaveLoadGuiConfig } from "./useUISettings";

interface SaveLoadGuiProps {
  isVisible: boolean;
  screenWidth: number;
  screenHeight: number;
  /** 是否允许存档 (战斗中或禁存时为 false) */
  canSave: boolean;
  /** 存档回调 */
  onSave: (index: number) => Promise<boolean>;
  /** 读档回调 */
  onLoad: (index: number) => Promise<boolean>;
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 按钮组件 - 带 ASF 帧动画
 */
interface ActionButtonProps {
  config: ButtonConfig;
  onClick: () => void;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ config, onClick, disabled = false }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 加载普通状态帧 (帧0)
  const normalImage = useAsfImage(config.image, 0);
  // 加载按下状态帧 (帧1)
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
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : isHovered ? 1 : 0.9,
        filter: isHovered && !isPressed && !disabled ? "brightness(1.1)" : "none",
      }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsPressed(false);
        setIsHovered(false);
      }}
      onClick={() => !disabled && onClick()}
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

/**
 * 存档槽位列表项
 */
interface SlotItemProps {
  index: number;
  label: string;
  isSelected: boolean;
  slot: SaveSlotInfo;
  config: SaveLoadGuiConfig["textList"];
  onClick: () => void;
}

const SlotItem: React.FC<SlotItemProps> = ({
  index,
  label,
  isSelected,
  slot: _slot,
  config,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // C# 版本只显示 "进度一" 到 "进度七"，不显示等级
  const displayText = label;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: index * config.itemHeight,
        width: config.width,
        height: config.itemHeight,
        cursor: "pointer",
        color: isSelected ? config.selectedColor : config.color,
        fontSize: 14,
        letterSpacing: config.charSpace,
        lineHeight: `${config.itemHeight}px`,
        fontWeight: isSelected ? "bold" : "normal",
        textShadow: isSelected ? "0 0 4px rgba(102,73,212,0.5)" : "none",
        backgroundColor: isHovered ? "rgba(255,255,255,0.1)" : "transparent",
        transition: "color 0.15s, background-color 0.15s",
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {displayText}
    </div>
  );
};

/**
 * SaveLoadGui 主组件
 */
export const SaveLoadGui: React.FC<SaveLoadGuiProps> = ({
  isVisible,
  screenWidth,
  screenHeight,
  canSave,
  onSave,
  onLoad,
  onClose,
}) => {
  // 从 UI_Settings.ini 加载配置
  const config = useSaveLoadGuiConfig();

  // 存档槽位列表
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  // 当前选中的槽位索引 (0-6 对应 进度一~进度七)
  const [selectedIndex, setSelectedIndex] = useState(0);
  // 操作中的槽位
  const [operatingSlot, setOperatingSlot] = useState<number | null>(null);
  // 提示消息
  const [message, setMessage] = useState("");

  // 加载面板背景
  const panelImage = useAsfImage(config?.panel.image || "asf/ui/saveload/panel.asf");

  // 加载存档列表
  const loadSlots = useCallback(() => {
    try {
      const slotInfos = StorageManager.getSaveSlots();
      setSlots(slotInfos);
    } catch (error) {
      logger.error("[SaveLoadGui] Failed to load save slots:", error);
    }
  }, []);

  // 显示时加载存档列表
  useEffect(() => {
    if (isVisible) {
      loadSlots();
      setMessage("");
    }
  }, [isVisible, loadSlots]);

  // 获取当前选中的槽位信息
  const selectedSlot = useMemo(() => {
    return slots.find((s) => s.index === selectedIndex + 1);
  }, [slots, selectedIndex]);

  // 存档操作
  const handleSave = useCallback(async () => {
    if (!canSave) {
      setMessage("当前无法存档");
      return;
    }

    const slotIndex = selectedIndex + 1;
    setOperatingSlot(slotIndex);
    setMessage("");

    try {
      const success = await onSave(slotIndex);
      if (success) {
        setMessage("存档成功");
        loadSlots();
      } else {
        setMessage("存档失败");
      }
    } catch (error) {
      logger.error("[SaveLoadGui] Save error:", error);
      setMessage("存档失败");
    } finally {
      setOperatingSlot(null);
    }
  }, [canSave, selectedIndex, onSave, loadSlots]);

  // 读档操作
  const handleLoad = useCallback(async () => {
    const slotIndex = selectedIndex + 1;
    const slot = slots.find((s) => s.index === slotIndex);

    if (!slot?.exists) {
      setMessage("该存档位为空");
      return;
    }

    setOperatingSlot(slotIndex);
    setMessage("");

    try {
      const success = await onLoad(slotIndex);
      if (success) {
        // 读档成功后关闭界面
        onClose();
      } else {
        setMessage("读档失败");
      }
    } catch (error) {
      logger.error("[SaveLoadGui] Load error:", error);
      setMessage("读档失败");
    } finally {
      setOperatingSlot(null);
    }
  }, [selectedIndex, slots, onLoad, onClose]);

  // 选择槽位
  const handleSelectSlot = useCallback((index: number) => {
    setSelectedIndex(index);
    setMessage("");
  }, []);

  // 计算面板位置 - 居中显示
  const panelStyle = useMemo(() => {
    if (!config) return null;
    const panelWidth = panelImage.width || 550;
    const panelHeight = panelImage.height || 480;

    return {
      position: "absolute" as const,
      left: (screenWidth - panelWidth) / 2 + config.panel.leftAdjust,
      top: (screenHeight - panelHeight) / 2 + config.panel.topAdjust,
      width: panelWidth,
      height: panelHeight,
      pointerEvents: "auto" as const,
    };
  }, [screenWidth, screenHeight, panelImage.width, panelImage.height, config]);

  if (!isVisible || !config || !panelStyle) return null;

  return (
    <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
      {/* 背景面板 */}
      {panelImage.dataUrl && (
        <img
          src={panelImage.dataUrl}
          alt="存档/读档"
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

      {/* 存档槽位列表 */}
      <div
        style={{
          position: "absolute",
          left: config.textList.left,
          top: config.textList.top,
          width: config.textList.width,
          height: config.textList.height,
          overflow: "hidden",
        }}
      >
        {config.textList.text.map((label, index) => (
          <SlotItem
            key={`save-slot-${index}`}
            index={index}
            label={label}
            isSelected={selectedIndex === index}
            slot={slots.find((s) => s.index === index + 1) || { index: index + 1, exists: false }}
            config={config.textList}
            onClick={() => handleSelectSlot(index)}
          />
        ))}
      </div>

      {/* 存档截图预览 */}
      <div
        style={{
          position: "absolute",
          left: config.snapshot.left,
          top: config.snapshot.top,
          width: config.snapshot.width,
          height: config.snapshot.height,
          backgroundColor: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {selectedSlot?.screenshot ? (
          <img
            src={selectedSlot.screenshot}
            alt="存档截图"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <span style={{ color: "rgba(150,150,150,0.6)", fontSize: 14 }}>
            {selectedSlot?.exists ? "无预览" : "空存档位"}
          </span>
        )}
      </div>

      {/* 存档时间 */}
      <div
        style={{
          position: "absolute",
          left: config.saveTimeText.left,
          top: config.saveTimeText.top,
          width: config.saveTimeText.width,
          height: config.saveTimeText.height,
          color: config.saveTimeText.color,
          fontSize: 12,
          letterSpacing: config.saveTimeText.charSpace,
        }}
      >
        {selectedSlot?.time || ""}
      </div>

      {/* 读取按钮 */}
      <ActionButton
        config={config.loadBtn}
        onClick={handleLoad}
        disabled={operatingSlot !== null || !selectedSlot?.exists}
      />

      {/* 保存按钮 */}
      <ActionButton
        config={config.saveBtn}
        onClick={handleSave}
        disabled={operatingSlot !== null || !canSave}
      />

      {/* 退出按钮 */}
      <ActionButton config={config.exitBtn} onClick={onClose} disabled={operatingSlot !== null} />

      {/* 提示消息 */}
      {message && (
        <div
          style={{
            position: "absolute",
            left: config.messageLine.left,
            top: config.messageLine.top,
            width: config.messageLine.width,
            height: config.messageLine.height,
            color: config.messageLine.color,
            fontSize: 14,
            textAlign:
              config.messageLine.align === 0
                ? "left"
                : config.messageLine.align === 2
                  ? "right"
                  : "center",
            lineHeight: `${config.messageLine.height}px`,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
};
