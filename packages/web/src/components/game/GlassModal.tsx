/**
 * GlassModal - 毛玻璃半透明弹窗
 *
 * 统一的弹窗容器：
 * - 背景模糊 + 半透明
 * - 与 WebSaveLoadPanel 样式一致
 * - 点击背景可关闭
 */

import { useEffect } from "react";
import { useAnimatedVisibility } from "@/hooks";

export interface GlassModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** 自定义宽度 class，默认 w-[520px] */
  widthClass?: string;
  /** 自定义最大高度，默认 80vh */
  maxHeight?: string;
  children: React.ReactNode;
}

export function GlassModal({
  visible,
  onClose,
  title,
  widthClass = "w-[520px]",
  maxHeight = "80vh",
  children,
}: GlassModalProps) {
  const { shouldRender, transitionStyle } = useAnimatedVisibility(visible);

  // ESC 关闭
  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ opacity: transitionStyle.opacity, transition: transitionStyle.transition }}
      />

      <div
        className={`relative ${widthClass} flex flex-col rounded-2xl overflow-hidden
          bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl`}
        style={{ maxHeight, ...transitionStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white/90">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
