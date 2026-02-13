/**
 * ScrollBar Component - based on JxqyHD Engine/Gui/ScrollBar.cs
 * Vertical scroll bar with ASF texture button and drag support
 *
 * handles mouse drag and click to change value
 * Resources: asf/ui/option/slidebtn.asf (default slider button)
 */

import { loadAsf } from "@miu2d/engine/resource/format/asf";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AsfAnimatedSprite } from "./AsfAnimatedSprite";

// 缓存 ASF 尺寸信息
const asfSizeCache = new Map<string, { width: number; height: number }>();

interface ScrollBarProps {
  /** 当前滚动值 */
  value: number;
  /** 最小值 (默认 0) */
  minValue?: number;
  /** 最大值 */
  maxValue: number;
  /** 滚动条左边位置 */
  left: number;
  /** 滚动条顶部位置 */
  top: number;
  /** 滚动条宽度 */
  width: number;
  /** 滚动条高度（轨道长度） */
  height: number;
  /** 滑块按钮的 ASF 图片路径 */
  buttonImage?: string;
  /** 值改变时的回调 */
  onChange: (value: number) => void;
  /** 是否可见 */
  visible?: boolean;
}

/**
 * 垂直滚动条组件
 *
 * 支持：
 * 1. 拖动滑块改变值
 * 2. 点击轨道快速跳转
 * 3. 使用 ASF 动画图片作为滑块贴图
 */
export const ScrollBar: React.FC<ScrollBarProps> = ({
  value,
  minValue = 0,
  maxValue,
  left,
  top,
  width,
  height,
  buttonImage = "asf/ui/option/slidebtn.asf",
  onChange,
  visible = true,
}) => {
  // 滑块按钮尺寸
  const [buttonSize, setButtonSize] = useState({ width: 20, height: 20 });

  // 加载按钮尺寸
  useEffect(() => {
    if (!buttonImage) return;

    // 规范化路径
    let normalizedPath = buttonImage.replace(/\\/g, "/");
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.substring(1);
    }

    // 检查缓存（使用相对路径作为 key）
    const cached = asfSizeCache.get(normalizedPath);
    if (cached) {
      setButtonSize(cached);
      return;
    }

    // 加载 ASF 获取尺寸（loadAsf 内部会添加资源根目录）
    loadAsf(normalizedPath).then((data) => {
      if (data) {
        const size = { width: data.width, height: data.height };
        asfSizeCache.set(normalizedPath, size);
        setButtonSize(size);
      }
    });
  }, [buttonImage]);

  // 拖动状态
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartValue = useRef(0);

  // 计算滑块位置
  const sliderHeight = buttonSize.height || 20;
  const trackLength = height - sliderHeight;
  const range = maxValue - minValue;
  const sliderY = range > 0 ? ((value - minValue) / range) * trackLength : 0;

  // 每个步长对应的像素距离
  const stepLength = range > 0 ? trackLength / range : 1;

  // 处理滑块拖动开始
  const handleSliderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartValue.current = value;
    },
    [value]
  );

  // 处理轨道点击（跳转到点击位置）
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const sliderCenter = sliderY + sliderHeight / 2;

      // 点击在滑块上方还是下方
      if (clickY < sliderCenter) {
        onChange(Math.max(minValue, value - 1));
      } else {
        onChange(Math.min(maxValue, value + 1));
      }
    },
    [isDragging, sliderY, sliderHeight, value, minValue, maxValue, onChange]
  );

  // 全局鼠标移动和释放事件（用于拖动）
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const offsetY = e.clientY - dragStartY.current;
      const valueOffset = offsetY / stepLength;
      const newValue = Math.round(dragStartValue.current + valueOffset);
      const clampedValue = Math.max(minValue, Math.min(maxValue, newValue));

      if (clampedValue !== value) {
        onChange(clampedValue);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, stepLength, minValue, maxValue, value, onChange]);

  if (!visible || maxValue <= minValue) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        zIndex: 10, // 确保滚动条在其他元素之上
        // 轨道背景透明，因为面板图片已经包含了轨道的视觉效果
        background: "transparent",
      }}
      onClick={handleTrackClick}
    >
      {/* 滑块按钮 */}
      <div
        style={{
          position: "absolute",
          left: (width - (buttonSize.width || width)) / 2,
          top: sliderY,
          width: buttonSize.width || width,
          height: sliderHeight,
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onMouseDown={handleSliderMouseDown}
      >
        <AsfAnimatedSprite
          path={buttonImage}
          autoPlay={true}
          loop={true}
          style={{
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export default ScrollBar;
