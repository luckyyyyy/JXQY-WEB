/**
 * TouchDragContext - 触摸拖拽上下文
 *
 * 用于在移动端支持跨组件的触摸拖拽
 * HTML5 drag-and-drop 在触摸设备上不可靠，所以需要自己实现
 */

import type { MagicItemInfo } from "@miu2d/engine/magic";
import type { Good } from "@miu2d/engine/player/goods";
import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

/** 拖拽数据类型 */
export interface TouchDragData {
  type: "magic" | "goods" | "equip";
  /** 技能在 store 中的索引 (1-36) */
  storeIndex?: number;
  /** 物品在背包中的索引 */
  bagIndex?: number;
  /** 底栏槽位索引 */
  bottomSlot?: number;
  /** 装备槽位名称 */
  equipSlot?: string;
  /** 拖拽来源 */
  source: "magicGui" | "bottomGui" | "goodsGui" | "equipGui" | "npcEquipGui" | "xiuLianGui";
  /** 技能详细信息（用于显示） */
  magicInfo?: MagicItemInfo | null;
  /** 物品详细信息（用于显示） */
  goodsInfo?: Good | null;
  /** 显示名称 */
  displayName?: string;
  /** 图标路径 */
  iconPath?: string;
}

/** Drop target 信息 */
export interface DropTarget {
  id: string;
  element: HTMLElement;
  onDrop: (data: TouchDragData) => void;
  /** 可选：判断是否接受此数据类型 */
  canDrop?: (data: TouchDragData) => boolean;
}

interface TouchDragContextValue {
  /** 当前拖拽数据 */
  dragData: TouchDragData | null;
  /** 开始拖拽 */
  startDrag: (data: TouchDragData) => void;
  /** 结束拖拽，返回是否成功 drop */
  endDrag: () => void;
  /** 在指定位置结束拖拽，检测 drop target */
  endDragAtPosition: (x: number, y: number) => boolean;
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 注册 drop target */
  registerDropTarget: (target: DropTarget) => void;
  /** 注销 drop target */
  unregisterDropTarget: (id: string) => void;
}

const TouchDragContext = createContext<TouchDragContextValue | null>(null);

export function TouchDragProvider({ children }: { children: ReactNode }) {
  const [dragData, setDragData] = useState<TouchDragData | null>(null);
  const dropTargetsRef = useRef<Map<string, DropTarget>>(new Map());

  const startDrag = useCallback((data: TouchDragData) => {
    console.log(
      "[TouchDrag] startDrag:",
      data.type,
      data.source,
      "bagIndex:",
      data.bagIndex,
      "storeIndex:",
      data.storeIndex,
      "equipSlot:",
      data.equipSlot
    );
    setDragData(data);
  }, []);

  const endDrag = useCallback(() => {
    setDragData(null);
  }, []);

  const endDragAtPosition = useCallback(
    (x: number, y: number): boolean => {
      const currentData = dragData;
      if (!currentData) {
        console.log("[TouchDrag] endDragAtPosition: no dragData");
        return false;
      }

      console.log(
        "[TouchDrag] endDragAtPosition at",
        x,
        y,
        "type:",
        currentData.type,
        "targets:",
        dropTargetsRef.current.size
      );

      // 查找包含此坐标的 drop target
      for (const target of dropTargetsRef.current.values()) {
        const rect = target.element.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          console.log("[TouchDrag] found target:", target.id);
          // 检查是否可以接受
          if (target.canDrop && !target.canDrop(currentData)) {
            console.log("[TouchDrag] target", target.id, "rejected drop (canDrop returned false)");
            continue;
          }
          // 执行 drop
          console.log("[TouchDrag] executing drop on", target.id);
          target.onDrop(currentData);
          setDragData(null);
          return true;
        }
      }

      // 没有找到有效的 drop target
      console.log("[TouchDrag] no valid drop target found");
      setDragData(null);
      return false;
    },
    [dragData]
  );

  const registerDropTarget = useCallback((target: DropTarget) => {
    dropTargetsRef.current.set(target.id, target);
  }, []);

  const unregisterDropTarget = useCallback((id: string) => {
    dropTargetsRef.current.delete(id);
  }, []);

  const isDragging = dragData !== null;

  return (
    <TouchDragContext.Provider
      value={{
        dragData,
        startDrag,
        endDrag,
        endDragAtPosition,
        isDragging,
        registerDropTarget,
        unregisterDropTarget,
      }}
    >
      {children}
    </TouchDragContext.Provider>
  );
}

export function useTouchDrag() {
  const context = useContext(TouchDragContext);
  if (!context) {
    // 如果没有 Provider，返回一个空的实现（兼容性）
    return {
      dragData: null,
      startDrag: () => {},
      endDrag: () => {},
      endDragAtPosition: () => false,
      isDragging: false,
      registerDropTarget: () => {},
      unregisterDropTarget: () => {},
    };
  }
  return context;
}

export default TouchDragContext;
