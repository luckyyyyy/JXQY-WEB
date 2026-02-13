/**
 * MobileControls - 移动端控制层
 *
 * 整合虚拟摇杆和技能/物品按钮，覆盖在游戏画布上
 * 类似王者荣耀的操作界面布局
 *
 * 移动控制：使用方向移动API（setJoystickDirection），类似小键盘方向键
 *           避免频繁寻路导致卡顿，且不会打断施法
 * 技能释放：按住技能按钮显示瞄准器，滑动调整方向，松开时释放技能
 * 物品使用：触发对应的快捷键功能（Z/X/C）
 */

import { Direction } from "@miu2d/engine/core/types";
import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { MobileActionButtons } from "./MobileActionButtons";
import { MobileInteractionBar } from "./MobileInteractionBar";
import { TargetingIndicator } from "./TargetingIndicator";
import { VirtualJoystick } from "./VirtualJoystick";

export interface MobileControlsProps {
  /** 游戏引擎实例 */
  engine: GameEngine | null;
  /** 是否禁用 */
  disabled?: boolean;
  /** 打开系统菜单回调 */
  onOpenMenu?: () => void;
  /** 游戏画布尺寸（缩放前） */
  canvasSize?: { width: number; height: number };
  /** 缩放比例 */
  scale?: number;
}

/**
 * 方向到相对偏移量映射（用于计算目标点）
 * 基于等角坐标系：每个方向的世界坐标偏移
 */
const _DIRECTION_OFFSETS: Record<Direction, { x: number; y: number }> = {
  [Direction.North]: { x: 0, y: -64 },
  [Direction.NorthEast]: { x: 32, y: -48 },
  [Direction.East]: { x: 64, y: 0 },
  [Direction.SouthEast]: { x: 32, y: 48 },
  [Direction.South]: { x: 0, y: 64 },
  [Direction.SouthWest]: { x: -32, y: 48 },
  [Direction.West]: { x: -64, y: 0 },
  [Direction.NorthWest]: { x: -32, y: -48 },
};

/** 瞄准状态 */
interface TargetingState {
  active: boolean;
  slotIndex: number;
  direction: { x: number; y: number };
}

/**
 * 移动端控制层组件
 */
export function MobileControls({
  engine,
  disabled = false,
  onOpenMenu,
  canvasSize,
  scale = 1,
}: MobileControlsProps) {
  // 控制层容器引用
  const containerRef = useRef<HTMLDivElement>(null);
  // 当前移动方向
  const currentDirectionRef = useRef<Direction | null>(null);
  // 当前瞄准方向（用 ref 避免闭包问题）
  const targetingDirectionRef = useRef<{ x: number; y: number }>({ x: 0, y: -1 });

  // 瞄准状态
  const [targeting, setTargeting] = useState<TargetingState>({
    active: false,
    slotIndex: -1,
    direction: { x: 0, y: -1 },
  });

  // 玩家屏幕位置（用于显示瞄准指示器）
  const [playerScreenPos, setPlayerScreenPos] = useState({ x: 0, y: 0 });

  /**
   * 获取玩家当前世界坐标
   */
  const getPlayerWorldPosition = useCallback(() => {
    if (!engine) return null;
    const player = engine.getGameManager().getPlayer();
    return { x: player.positionInWorld.x, y: player.positionInWorld.y };
  }, [engine]);

  /**
   * 获取玩家屏幕位置（相对于整个控制层）
   */
  const updatePlayerScreenPosition = useCallback(() => {
    if (!engine || !containerRef.current) return;
    const player = engine.getGameManager().getPlayer();

    // 获取摄像机和玩家位置
    const camera = engine.getCamera();

    const worldPos = player.positionInWorld;
    // worldToScreen 返回相对于画布左上角的坐标
    const canvasPos = camera.worldToScreen(worldPos.x, worldPos.y);

    // 获取控制层容器的尺寸
    const containerRect = containerRef.current.getBoundingClientRect();

    // 计算画布在容器中的位置（居中）
    const actualCanvasWidth = (canvasSize?.width ?? 800) * scale;
    const actualCanvasHeight = (canvasSize?.height ?? 600) * scale;
    const canvasOffsetX = (containerRect.width - actualCanvasWidth) / 2;
    const canvasOffsetY = (containerRect.height - actualCanvasHeight) / 2;

    // 计算玩家在控制层中的屏幕位置
    // 1. canvasPos 是相对于画布（未缩放）的位置
    // 2. 乘以 scale 得到缩放后的位置
    // 3. 加上画布在容器中的偏移
    setPlayerScreenPos({
      x: canvasOffsetX + canvasPos.x * scale,
      y: canvasOffsetY + canvasPos.y * scale,
    });
  }, [engine, canvasSize, scale]);

  /**
   * 处理摇杆方向变化
   * 直接设置引擎的 joystickDirection，由引擎在 handleInput 中处理
   * 这样可以：
   * 1. 避免频繁寻路导致卡顿（使用方向移动而非点击移动）
   * 2. 不会打断施法（引擎会检查 canPerformAction）
   */
  const handleDirectionChange = useCallback(
    (direction: Direction | null) => {
      if (!engine || disabled) return;

      currentDirectionRef.current = direction;
      // 直接设置引擎的摇杆方向
      engine.setJoystickDirection(direction);
    },
    [engine, disabled]
  );

  /**
   * 移动开始回调
   */
  const handleMoveStart = useCallback(() => {
    // 摇杆开始触摸时的回调（direction 在 handleDirectionChange 中处理）
  }, []);

  /**
   * 移动结束回调
   */
  const handleMoveEnd = useCallback(() => {
    if (!engine) return;
    currentDirectionRef.current = null;
    // 清除摇杆方向
    engine.setJoystickDirection(null);
    // 立即停止玩家移动（清除路径）
    engine.stopPlayerMovement();
  }, [engine]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 确保清除摇杆方向
      if (engine) {
        engine.setJoystickDirection(null);
      }
    };
  }, [engine]);

  // ===== 技能瞄准相关 =====

  /**
   * 开始瞄准
   */
  const handleTargetingStart = useCallback(
    (slotIndex: number) => {
      if (!engine || disabled) return;

      // 更新玩家屏幕位置
      updatePlayerScreenPosition();

      setTargeting({
        active: true,
        slotIndex,
        direction: { x: 0, y: -1 }, // 默认朝上
      });
    },
    [engine, disabled, updatePlayerScreenPosition]
  );

  /**
   * 更新瞄准方向
   * 注意：这里只更新显示状态，不调用 handleMouseMove
   * 因为移动操作也在用 handleMouseMove，会互相冲突
   * 实际的目标位置在释放技能时才设置
   */
  const handleTargetingUpdate = useCallback(
    (_slotIndex: number, direction: { x: number; y: number }) => {
      // 更新 ref（用于释放技能时获取最新方向）
      targetingDirectionRef.current = direction;
      // 更新 state（用于显示）
      setTargeting((prev) => ({
        ...prev,
        direction,
      }));
    },
    []
  );

  /**
   * 结束瞄准
   */
  const handleTargetingEnd = useCallback((_slotIndex: number) => {
    setTargeting({
      active: false,
      slotIndex: -1,
      direction: { x: 0, y: -1 },
    });
  }, []);

  /**
   * 释放技能（松开时触发）
   * 使用 ref 中保存的方向，避免闭包问题
   */
  const handleMagicRelease = useCallback(
    (slotIndex: number, _direction: { x: number; y: number }) => {
      if (!engine || disabled) return;

      // 使用 ref 中的方向（最新值）
      const direction = targetingDirectionRef.current;

      // 先更新鼠标位置到瞄准方向
      const playerPos = getPlayerWorldPosition();
      if (playerPos) {
        const worldOffsetX = direction.x * 200;
        const worldOffsetY = direction.y * 200;

        const targetWorldX = playerPos.x + worldOffsetX;
        const targetWorldY = playerPos.y + worldOffsetY;

        engine.handleMouseMove(0, 0, targetWorldX, targetWorldY);
      }

      // 模拟按键：KeyA, KeyS, KeyD, KeyF, KeyG
      const keyMap = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG"];
      const key = keyMap[slotIndex];
      if (key) {
        engine.handleKeyDown(key, false);
        // 短暂延迟后松开
        setTimeout(() => {
          engine.handleKeyUp(key);
        }, 100);
      }

      // 重置瞄准方向
      targetingDirectionRef.current = { x: 0, y: -1 };
    },
    [engine, disabled, getPlayerWorldPosition]
  );

  /**
   * 使用物品（Z/X/C -> 0/1/2）
   */
  const handleUseItem = useCallback(
    (slotIndex: number) => {
      if (!engine || disabled) return;
      // 模拟按键：KeyZ, KeyX, KeyC
      const keyMap = ["KeyZ", "KeyX", "KeyC"];
      const key = keyMap[slotIndex];
      if (key) {
        engine.handleKeyDown(key, false);
        setTimeout(() => {
          engine.handleKeyUp(key);
        }, 100);
      }
    },
    [engine, disabled]
  );

  /**
   * 处理跑步状态变化
   * 对应PC端的Shift键
   */
  const handleRunStateChange = useCallback(
    (isRunning: boolean) => {
      if (!engine || disabled) return;
      // 使用与PC端相同的API：updateModifierKeys
      engine.updateModifierKeys(isRunning, false, false);
    },
    [engine, disabled]
  );

  // 瞄准时持续更新玩家位置
  useEffect(() => {
    if (!targeting.active) return;

    const interval = setInterval(() => {
      updatePlayerScreenPosition();
    }, 16); // 约60fps

    return () => clearInterval(interval);
  }, [targeting.active, updatePlayerScreenPosition]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 100 }}
    >
      {/* 瞄准指示器 */}
      <TargetingIndicator
        position={playerScreenPos}
        direction={targeting.direction}
        slotIndex={targeting.slotIndex}
        visible={targeting.active}
      />

      {/* 交互条 - 靠近 NPC 或物品时显示 */}
      <MobileInteractionBar engine={engine} disabled={disabled} />

      {/* 左侧摇杆区域 */}
      <div
        className="absolute pointer-events-auto"
        style={{
          left: 20,
          bottom: 30,
        }}
      >
        <VirtualJoystick
          size={140}
          knobSize={55}
          onDirectionChange={handleDirectionChange}
          onMoveStart={handleMoveStart}
          onMoveEnd={handleMoveEnd}
          disabled={disabled}
        />
      </div>

      {/* 右侧技能/物品按钮区域 */}
      <div
        className="absolute pointer-events-auto"
        style={{
          right: 25,
          bottom: 40,
        }}
      >
        <MobileActionButtons
          onMagicRelease={handleMagicRelease}
          onTargetingStart={handleTargetingStart}
          onTargetingUpdate={handleTargetingUpdate}
          onTargetingEnd={handleTargetingEnd}
          onUseItem={handleUseItem}
          onOpenMenu={onOpenMenu}
          onRunStateChange={handleRunStateChange}
          bottomMagics={engine?.getBottomMagics()}
          bottomGoods={engine?.getBottomGoods()}
          disabled={disabled}
        />
      </div>

      {/* 底部提示 */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 pointer-events-none"
        style={{ bottom: 8 }}
      >
        <div className="text-white/20 text-[10px] text-center">摇杆移动 · 按住技能滑动瞄准</div>
      </div>
    </div>
  );
}

export default MobileControls;
