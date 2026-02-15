/**
 * useMobile - 移动端检测 Hook
 *
 * 检测用户是否在移动设备上访问
 * 支持触摸屏检测和屏幕宽度检测
 */

import { useCallback, useEffect, useState } from "react";

export interface MobileState {
  /** 是否为移动设备 */
  isMobile: boolean;
  /** 是否为横屏模式 */
  isLandscape: boolean;
  /** 是否支持触摸 */
  isTouchDevice: boolean;
  /** 屏幕宽度 */
  screenWidth: number;
  /** 屏幕高度 */
  screenHeight: number;
}

/**
 * 检测是否为移动设备
 */
function detectMobile(): boolean {
  if (typeof window === "undefined") return false;

  // 检测 User Agent
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    "android",
    "webos",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "windows phone",
    "mobile",
  ];

  const isMobileUA = mobileKeywords.some((keyword) => userAgent.includes(keyword));

  // 检测触摸支持
  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE specific
    navigator.msMaxTouchPoints > 0;

  // 检测屏幕宽度（小于 1024 像素认为是移动设备）
  const isSmallScreen = window.innerWidth < 1024;

  // 同时满足触摸设备和小屏幕，或者 User Agent 检测为移动设备
  return isMobileUA || (isTouchDevice && isSmallScreen);
}

/**
 * 检测是否为横屏
 */
function detectLandscape(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth > window.innerHeight;
}

/**
 * 检测是否支持触摸
 */
function detectTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE specific
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * 移动设备检测 Hook
 */
export function useMobile(): MobileState {
  const [state, setState] = useState<MobileState>(() => ({
    isMobile: detectMobile(),
    isLandscape: detectLandscape(),
    isTouchDevice: detectTouchDevice(),
    screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
    screenHeight: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  const updateState = useCallback(() => {
    setState({
      isMobile: detectMobile(),
      isLandscape: detectLandscape(),
      isTouchDevice: detectTouchDevice(),
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    });
  }, []);

  useEffect(() => {
    // 监听窗口大小变化
    window.addEventListener("resize", updateState);
    // 监听屏幕方向变化
    window.addEventListener("orientationchange", updateState);

    // 初始检测
    updateState();

    return () => {
      window.removeEventListener("resize", updateState);
      window.removeEventListener("orientationchange", updateState);
    };
  }, [updateState]);

  return state;
}

export default useMobile;
