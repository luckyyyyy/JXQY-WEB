/**
 * useAnimatedVisibility - 控制组件的显示/隐藏动画
 *
 * 打开：淡入 + 从上方下移进入
 * 关闭：淡出 + 向上移出
 *
 * 返回:
 * - shouldRender: 是否挂载 DOM（在退出动画完成前保持 true）
 * - isVisible: 是否应用可见样式（控制 CSS transition）
 * - transitionStyle: 可直接应用的 style 对象
 */

import { useEffect, useState } from "react";

const DURATION = 200;

export function useAnimatedVisibility(visible: boolean, duration = DURATION) {
  const [shouldRender, setShouldRender] = useState(visible);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // 等待 DOM 挂载后再触发过渡
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return () => cancelAnimationFrame(raf);
    }
    // 关闭：先触发退出动画，延迟后卸载
    setIsVisible(false);
    const timer = setTimeout(() => {
      setShouldRender(false);
    }, duration);
    return () => clearTimeout(timer);
  }, [visible, duration]);

  const transitionStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateY(0)" : "translateY(-8px)",
    transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
  };

  return { shouldRender, isVisible, transitionStyle };
}
