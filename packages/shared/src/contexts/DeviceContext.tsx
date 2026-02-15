/**
 * DeviceContext - 设备类型上下文
 *
 * 提供设备类型信息给所有子组件，用于区分 PC 和移动端事件处理
 */

import { createContext, type ReactNode, useContext } from "react";
import { useMobile } from "../hooks/useMobile";

interface DeviceContextValue {
  /** 是否为移动设备 */
  isMobile: boolean;
  /** 是否支持触摸 */
  isTouchDevice: boolean;
  /** 是否横屏 */
  isLandscape: boolean;
  /** 屏幕宽度 */
  screenWidth: number;
  /** 屏幕高度 */
  screenHeight: number;
}

const DeviceContext = createContext<DeviceContextValue | null>(null);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const mobileState = useMobile();

  return <DeviceContext.Provider value={mobileState}>{children}</DeviceContext.Provider>;
}

/**
 * 获取设备信息
 */
export function useDevice(): DeviceContextValue {
  const context = useContext(DeviceContext);
  if (!context) {
    // 默认值：假设是桌面设备
    return {
      isMobile: false,
      isTouchDevice: false,
      isLandscape: true,
      screenWidth: 1920,
      screenHeight: 1080,
    };
  }
  return context;
}

export default DeviceContext;
