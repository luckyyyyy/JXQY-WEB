/**
 * TouchDragIndicator - 触摸拖拽指示器
 *
 * 当用户从武功面板长按技能开始拖拽时，显示一个跟随手指的浮动图标
 */

import { useEffect, useState, memo } from "react";
import { useTouchDrag } from "@/contexts";
import { AsfAnimatedSprite } from "../ui/classic/AsfAnimatedSprite";
import { useAsfImage } from "../ui/classic/hooks";

export const TouchDragIndicator = memo(function TouchDragIndicator() {
  const { dragData, isDragging, endDragAtPosition } = useTouchDrag();
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // 跟踪触摸位置
  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        setPosition({ x: touch.clientX, y: touch.clientY });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // 获取松手位置
      const touch = e.changedTouches[0];
      if (touch) {
        // 在松手位置检测 drop target
        endDragAtPosition(touch.clientX, touch.clientY);
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    document.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isDragging, endDragAtPosition]);

  // 加载物品图标
  const goodsIconPath = dragData?.type === "goods" ? dragData.iconPath : null;
  const goodsIcon = useAsfImage(goodsIconPath ?? null, 0);

  if (!isDragging || !dragData) return null;

  // 确定显示的图标和名称
  const iconPath = dragData.type === "magic"
    ? (dragData.magicInfo?.magic?.icon ?? dragData.magicInfo?.magic?.image)
    : dragData.iconPath;
  const name = dragData.displayName || (dragData.type === "magic" ? "技能" : "物品");

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: position.x - 30,
        top: position.y - 30,
        width: 60,
        height: 60,
        zIndex: 9999,
      }}
    >
      {/* 拖拽图标 */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          background: "rgba(0,0,0,0.7)",
          border: "2px solid rgba(255,200,100,0.8)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5), 0 0 20px rgba(255,200,100,0.3)",
        }}
      >
        {dragData.type === "magic" && iconPath ? (
          <AsfAnimatedSprite
            path={iconPath}
            autoPlay={true}
            loop={true}
            style={{
              maxWidth: 48,
              maxHeight: 48,
              pointerEvents: "none",
            }}
          />
        ) : dragData.type === "goods" && goodsIcon.dataUrl ? (
          <img
            src={goodsIcon.dataUrl}
            alt={name}
            style={{
              width: goodsIcon.width,
              height: goodsIcon.height,
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
          />
        ) : (
          <span className="text-white text-lg">📦</span>
        )}
      </div>

      {/* 名称 */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 text-white text-xs bg-black/80 px-2 py-0.5 rounded whitespace-nowrap"
        style={{ top: "100%", marginTop: 4 }}
      >
        {name}
      </div>

      {/* 提示文字 */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 text-white/60 text-[10px] whitespace-nowrap"
        style={{ bottom: -35 }}
      >
        拖到目标槽位上
      </div>
    </div>
  );
});

export default TouchDragIndicator;
