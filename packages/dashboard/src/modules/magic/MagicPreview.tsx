/**
 * 武功预览组件
 *
 * 完整模拟武功释放过程：
 * 1. 飞行阶段 (flyingImage) - 从施法点飞出
 * 2. 爆炸阶段 (vanishImage) - 到达目标点后爆炸
 * 3. 超级模式 (superModeImage) - MoveKind=SuperMode 时全屏攻击
 *
 * 支持：
 * - 各种移动轨迹模拟（直线、圆形、扇形、螺旋等）
 * - 多发飞行物（LineMove、SectorMove 等）
 */

import type { Vector2 } from "@miu2d/engine/core/types";
import type { AsfData } from "@miu2d/engine/resource/format/asf";
import { getFrameCanvas } from "@miu2d/engine/resource/format/asf";
import {
  getDirection8,
  getDirection32List,
  getDirectionIndex,
  getDirectionOffset8,
  getVOffsets,
  normalizeVector,
} from "@miu2d/engine/utils";
import { decodeAsfWasm } from "@miu2d/engine/wasm/wasm-asf-decoder";
import { initWasm } from "@miu2d/engine/wasm/wasm-manager";
import type { Magic, MagicMoveKind } from "@miu2d/types";
import { MagicMoveKindLabels, MagicMoveKindValues } from "@miu2d/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildResourceUrl } from "../../utils";

// ========== 类型定义 ==========

interface MagicPreviewProps {
  gameSlug: string;
  magic: Magic | null;
  level?: number;
}

/** 单个飞行物的状态 */
interface FlyingSprite {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 移动方向向量（归一化），用于精确计算帧方向 */
  dirVector?: Vector2;
  direction: number; // 0-7 方向索引（用于选择精灵帧）
  frame: number; // 当前动画帧
  phase: "waiting" | "flying" | "vanish" | "done"; // 增加 waiting 和 done 状态
  /** SuperMode 专用：是否是施法阶段（使用 superModeImage） */
  isSuperModeCast?: boolean;
  delayMs: number; // 延迟时间（毫秒）
  elapsedMs: number; // 已经过时间（毫秒）
}

/** 预览模拟距离常量（像素） */
const PREVIEW_DISTANCE = 240;

// ========== 主组件 ==========

export function MagicPreview({ gameSlug, magic, level = 1 }: MagicPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // WASM 状态
  const [wasmReady, setWasmReady] = useState(false);

  // ASF 数据缓存
  const [flyingAsf, setFlyingAsf] = useState<AsfData | null>(null);
  const [vanishAsf, setVanishAsf] = useState<AsfData | null>(null);
  const [superModeAsf, setSuperModeAsf] = useState<AsfData | null>(null);

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 模拟控制
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentDirection, setCurrentDirection] = useState(2); // 默认向右

  // 飞行物状态
  const spritesRef = useRef<FlyingSprite[]>([]);
  const lastTimeRef = useRef(0);
  const spriteIdRef = useRef(0);

  // ========== 初始化 WASM ==========
  useEffect(() => {
    initWasm()
      .then(() => setWasmReady(true))
      .catch((err) => {
        console.error("Failed to init WASM:", err);
      });
  }, []);

  // ========== 构建资源路径 ==========
  const buildResourcePath = useCallback((fileName: string | null | undefined): string | null => {
    if (!fileName) return null;
    // 去掉开头的斜杠（如果有）
    const normalized = fileName.startsWith("/") ? fileName.slice(1) : fileName;
    // 如果已经是完整路径，直接返回
    if (normalized.startsWith("asf/") || normalized.startsWith("content/")) {
      return normalized.toLowerCase();
    }
    // 否则添加默认路径
    return `asf/effect/${normalized}`.toLowerCase();
  }, []);

  // ========== 加载 ASF 文件 ==========
  const loadAsf = useCallback(
    async (imagePath: string): Promise<AsfData | null> => {
      if (!wasmReady || !gameSlug) return null;

      try {
        const url = buildResourceUrl(gameSlug, imagePath);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        return decodeAsfWasm(buffer);
      } catch (err) {
        console.error(`Failed to load ASF: ${imagePath}`, err);
        return null;
      }
    },
    [wasmReady, gameSlug]
  );

  // ========== 加载所有资源 ==========
  useEffect(() => {
    if (!wasmReady || !magic) return;

    const loadAll = async () => {
      setIsLoading(true);
      setLoadError(null);
      setFlyingAsf(null);
      setVanishAsf(null);
      setSuperModeAsf(null);

      const flyingPath = buildResourcePath(magic.flyingImage);
      const vanishPath = buildResourcePath(magic.vanishImage);
      const superModePath = buildResourcePath(magic.superModeImage);

      const [flying, vanish, superMode] = await Promise.all([
        flyingPath ? loadAsf(flyingPath) : null,
        vanishPath ? loadAsf(vanishPath) : null,
        superModePath ? loadAsf(superModePath) : null,
      ]);

      setFlyingAsf(flying);
      setVanishAsf(vanish);
      setSuperModeAsf(superMode);

      if (!flying && !vanish && !superMode) {
        setLoadError("未能加载任何图像资源");
      }

      setIsLoading(false);
    };

    loadAll();
  }, [wasmReady, magic, buildResourcePath, loadAsf]);

  // ========== 获取移动类型的初始飞行物（完全复用 spriteFactory.ts 逻辑）==========
  const createSprites = useCallback(
    (centerX: number, centerY: number, targetDirection8: number): FlyingSprite[] => {
      if (!magic) return [];

      const sprites: FlyingSprite[] = [];

      // 获取当前等级配置（可能覆盖主配置的 moveKind 和 speed）
      const currentLevelConfig = magic.levels?.[level - 1];
      const effectiveMoveKind = currentLevelConfig?.moveKind ?? magic.moveKind;
      const moveKindNum = MagicMoveKindValues[effectiveMoveKind] ?? 0;
      const speed = currentLevelConfig?.speed ?? magic.speed ?? 8;
      const baseSpeed = speed * 0.5; // 调整速度系数适配预览
      const effectLevel = level; // 等级影响数量
      const directions32 = getDirection32List();

      // 目标方向向量（8方向索引 -> 向量）
      const targetDir = getDirection8(targetDirection8);
      // 32方向索引
      const dir32Index = targetDirection8 * 4;

      /**
       * 根据方向向量创建飞行精灵
       *
       * 注意：预览组件使用纯 2D 俯视视角，不应用等轴测的 speedRatio 补偿。
       * 引擎中的 getSpeedRatio 是为等轴测视角设计的（上下方向速度减半），
       * 但在纯 2D 预览中会导致圆形看起来像椭圆形，所以这里不使用。
       */
      const createSpriteFromDir = (
        dir: Vector2,
        originX = centerX,
        originY = centerY,
        delayMs = 0
      ): FlyingSprite => {
        const dirIndex = getDirectionIndex(dir, 8);
        // 归一化方向向量
        const normalized = normalizeVector(dir);
        // 速度 = 方向向量 * 基础速度（纯 2D，不应用 speedRatio）
        return {
          id: ++spriteIdRef.current,
          x: originX,
          y: originY,
          vx: dir.x * baseSpeed,
          vy: dir.y * baseSpeed,
          dirVector: normalized,
          direction: dirIndex,
          frame: 0,
          phase: delayMs > 0 ? "waiting" : "flying",
          delayMs,
          elapsedMs: 0,
        };
      };

      switch (moveKindNum) {
        case 0: // NoMove - 原地爆炸
          sprites.push({
            id: ++spriteIdRef.current,
            x: centerX,
            y: centerY,
            vx: 0,
            vy: 0,
            direction: targetDirection8,
            frame: 0,
            phase: "vanish", // 直接进入爆炸阶段
            delayMs: 0,
            elapsedMs: 0,
          });
          break;

        case 1: {
          // FixedPosition - 固定位置
          const targetX = centerX + targetDir.x * PREVIEW_DISTANCE * 0.6;
          const targetY = centerY + targetDir.y * PREVIEW_DISTANCE * 0.6;
          sprites.push({
            id: ++spriteIdRef.current,
            x: targetX,
            y: targetY,
            vx: 0,
            vy: 0,
            direction: targetDirection8,
            frame: 0,
            phase: "flying",
            delayMs: 0,
            elapsedMs: 0,
          });
          break;
        }

        case 2: // SingleMove - 单发直线
          sprites.push(createSpriteFromDir(targetDir));
          break;

        case 3: {
          // LineMove - 多发直线（按等级递增）
          const count = Math.min(effectLevel, 10);
          const magicDelayMs = 60;
          for (let i = 0; i < count; i++) {
            sprites.push(createSpriteFromDir(targetDir, centerX, centerY, magicDelayMs * i));
          }
          break;
        }

        case 4: // CircleMove - 圆形扩散（32方向）
          for (const dir of directions32) {
            sprites.push(createSpriteFromDir(dir));
          }
          break;

        case 5: {
          // HeartMove - 心形移动（时序展开）
          const delayTime = 30;
          // First half - expanding (i: 0-15)
          for (let i = 0; i < 16; i++) {
            const delay = i * delayTime;
            sprites.push(createSpriteFromDir(directions32[i], centerX, centerY, delay));
            sprites.push(createSpriteFromDir(directions32[31 - i], centerX, centerY, delay));
          }
          // Middle
          sprites.push(createSpriteFromDir(directions32[16], centerX, centerY, 16 * delayTime));
          sprites.push(createSpriteFromDir(directions32[16], centerX, centerY, 17 * delayTime));
          // Second half - contracting (j: 15->1)
          for (let j = 15; j > 0; j--) {
            const delay = (18 + 15 - j) * delayTime;
            sprites.push(createSpriteFromDir(directions32[j], centerX, centerY, delay));
            sprites.push(createSpriteFromDir(directions32[(32 - j) % 32], centerX, centerY, delay));
          }
          // Final
          sprites.push(
            createSpriteFromDir(directions32[0], centerX, centerY, (18 + 15) * delayTime)
          );
          break;
        }

        case 6: {
          // SpiralMove - 螺旋移动（时序展开）
          const magicDelayMs = 30;
          for (let i = 0; i < 32; i++) {
            const dirIdx = (dir32Index + i) % 32;
            sprites.push(
              createSpriteFromDir(directions32[dirIdx], centerX, centerY, i * magicDelayMs)
            );
          }
          break;
        }

        case 7: {
          // SectorMove - 扇形移动（复用引擎 addSectorMoveMagicSprite）
          let count = 1;
          if (effectLevel > 0) {
            count += Math.floor((effectLevel - 1) / 3);
          }
          // 中心方向
          sprites.push(createSpriteFromDir(directions32[dir32Index]));
          // 两侧
          for (let i = 1; i <= count; i++) {
            const leftIdx = (dir32Index + i * 2) % 32;
            const rightIdx = (dir32Index + 32 - i * 2) % 32;
            sprites.push(createSpriteFromDir(directions32[leftIdx]));
            sprites.push(createSpriteFromDir(directions32[rightIdx]));
          }
          break;
        }

        case 8: {
          // RandomSector - 随机扇形
          let count = 1;
          if (effectLevel > 0) {
            count += Math.floor((effectLevel - 1) / 3);
          }
          for (let i = 0; i <= count * 2; i++) {
            const offset = Math.floor(Math.random() * 5) - 2;
            const dirIdx = (dir32Index + offset + 32) % 32;
            sprites.push(createSpriteFromDir(directions32[dirIdx]));
          }
          break;
        }

        case 9: {
          // FixedWall - 固定墙（在目标位置形成一排）
          const targetX = centerX + targetDir.x * PREVIEW_DISTANCE * 0.6;
          const targetY = centerY + targetDir.y * PREVIEW_DISTANCE * 0.6;
          // 使用引擎的偏移计算（针对墙类武功的正确偏移）
          const wallOffset = getDirectionOffset8(targetDir);
          let count = 3;
          if (effectLevel > 1) {
            count += (effectLevel - 1) * 2;
          }
          const halfCount = Math.floor((count - 1) / 2);
          // 中心
          sprites.push({
            id: ++spriteIdRef.current,
            x: targetX,
            y: targetY,
            vx: 0,
            vy: 0,
            direction: targetDirection8,
            frame: 0,
            phase: "flying",
            delayMs: 0,
            elapsedMs: 0,
          });
          // 两侧
          for (let i = 1; i <= halfCount; i++) {
            sprites.push({
              id: ++spriteIdRef.current,
              x: targetX + wallOffset.x * i,
              y: targetY + wallOffset.y * i,
              vx: 0,
              vy: 0,
              direction: targetDirection8,
              frame: 0,
              phase: "flying",
              delayMs: 0,
              elapsedMs: 0,
            });
            sprites.push({
              id: ++spriteIdRef.current,
              x: targetX - wallOffset.x * i,
              y: targetY - wallOffset.y * i,
              vx: 0,
              vy: 0,
              direction: targetDirection8,
              frame: 0,
              phase: "flying",
              delayMs: 0,
              elapsedMs: 0,
            });
          }
          break;
        }

        case 10: {
          // WallMove - 移动墙（墙向前移动）
          // 使用引擎的偏移计算（针对墙类武功的正确偏移）
          const wallOffset = getDirectionOffset8(targetDir);
          let count = 3;
          if (effectLevel > 1) {
            count += (effectLevel - 1) * 2;
          }
          const halfCount = Math.floor((count - 1) / 2);
          // 中心
          sprites.push(createSpriteFromDir(targetDir));
          // 两侧
          for (let i = 1; i <= halfCount; i++) {
            sprites.push(
              createSpriteFromDir(targetDir, centerX + wallOffset.x * i, centerY + wallOffset.y * i)
            );
            sprites.push(
              createSpriteFromDir(targetDir, centerX - wallOffset.x * i, centerY - wallOffset.y * i)
            );
          }
          break;
        }

        case 11: {
          // RegionBased - 根据 Region 值决定区域类型
          const region = magic.region ?? 1;
          const magicDelayMs = 60;
          let rowCount = 3;
          if (effectLevel > 3) {
            rowCount += Math.floor((effectLevel - 1) / 3) * 2;
          }
          const columnCount = 5;

          switch (region) {
            case 1: {
              // 方形区域 (Square)
              const offsetRow = { x: 32, y: 16 };
              const offsetColumn = { x: 32, y: -16 };
              const halfCount = Math.floor(rowCount / 2);
              const startX = centerX - halfCount * offsetRow.x;
              const startY = centerY - halfCount * offsetRow.y;

              for (let row = 0; row < rowCount; row++) {
                for (let col = 0; col < rowCount; col++) {
                  const x = startX + row * offsetRow.x + col * offsetColumn.x;
                  const y = startY + row * offsetRow.y + col * offsetColumn.y;
                  sprites.push({
                    id: ++spriteIdRef.current,
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    direction: targetDirection8,
                    frame: 0,
                    phase: "flying",
                    delayMs: 0,
                    elapsedMs: 0,
                  });
                }
              }
              break;
            }
            case 2: {
              // 十字区域 (Cross)
              const crossOffsets = [
                { x: 32, y: 16 },
                { x: 32, y: -16 },
                { x: -32, y: 16 },
                { x: -32, y: -16 },
              ];
              for (let i = 0; i < rowCount; i++) {
                const delay = i * magicDelayMs;
                for (const offset of crossOffsets) {
                  sprites.push({
                    id: ++spriteIdRef.current,
                    x: centerX + (i + 1) * offset.x,
                    y: centerY + (i + 1) * offset.y,
                    vx: 0,
                    vy: 0,
                    direction: targetDirection8,
                    frame: 0,
                    phase: "waiting",
                    delayMs: delay,
                    elapsedMs: 0,
                  });
                }
              }
              break;
            }
            case 3: {
              // 矩形区域 (Rectangle) - 推山填海使用
              // 根据方向创建多排向前推进的火墙
              let offsetRow: Vector2;
              let offsetColumn: Vector2;

              switch (targetDirection8) {
                case 0: // South
                  offsetRow = { x: 0, y: 32 };
                  offsetColumn = { x: 32, y: 0 };
                  break;
                case 1: // SouthWest
                  offsetRow = { x: -32, y: 16 };
                  offsetColumn = { x: 32, y: 16 };
                  break;
                case 2: // West
                  offsetRow = { x: -32, y: 0 };
                  offsetColumn = { x: 0, y: 32 };
                  break;
                case 3: // NorthWest
                  offsetRow = { x: -32, y: -16 };
                  offsetColumn = { x: 32, y: -16 };
                  break;
                case 4: // North
                  offsetRow = { x: 0, y: -32 };
                  offsetColumn = { x: 32, y: 0 };
                  break;
                case 5: // NorthEast
                  offsetRow = { x: 32, y: -16 };
                  offsetColumn = { x: 32, y: 16 };
                  break;
                case 6: // East
                  offsetRow = { x: 32, y: 0 };
                  offsetColumn = { x: 0, y: 32 };
                  break;
                default: // SouthEast (7)
                  offsetRow = { x: 32, y: 16 };
                  offsetColumn = { x: 32, y: -16 };
                  break;
              }

              const halfColumn = Math.floor(columnCount / 2);
              for (let row = 0; row < rowCount; row++) {
                const delay = row * magicDelayMs;
                const rowBaseX = centerX + (row + 1) * offsetRow.x;
                const rowBaseY = centerY + (row + 1) * offsetRow.y;

                for (let col = -halfColumn; col <= halfColumn; col++) {
                  sprites.push({
                    id: ++spriteIdRef.current,
                    x: rowBaseX + col * offsetColumn.x,
                    y: rowBaseY + col * offsetColumn.y,
                    vx: 0,
                    vy: 0,
                    direction: targetDirection8,
                    frame: 0,
                    phase: "waiting",
                    delayMs: delay,
                    elapsedMs: 0,
                  });
                }
              }
              break;
            }
            case 4: {
              // 等腰三角形 (Isosceles Triangle)
              for (let row = 0; row < rowCount; row++) {
                const delay = row * magicDelayMs;
                const colCount = row + 1;
                for (let col = 0; col < colCount; col++) {
                  const x = centerX + targetDir.x * (row + 1) * 32 + (col - row / 2) * 32;
                  const y = centerY + targetDir.y * (row + 1) * 16 + (col - row / 2) * 16;
                  sprites.push({
                    id: ++spriteIdRef.current,
                    x,
                    y,
                    vx: 0,
                    vy: 0,
                    direction: targetDirection8,
                    frame: 0,
                    phase: "waiting",
                    delayMs: delay,
                    elapsedMs: 0,
                  });
                }
              }
              break;
            }
            case 5: {
              // V型区域
              const vOffsets = getVOffsets(targetDirection8);
              for (let i = 0; i < rowCount; i++) {
                const delay = i * magicDelayMs;
                // 中心
                sprites.push({
                  id: ++spriteIdRef.current,
                  x: centerX + targetDir.x * (i + 1) * 32,
                  y: centerY + targetDir.y * (i + 1) * 16,
                  vx: 0,
                  vy: 0,
                  direction: targetDirection8,
                  frame: 0,
                  phase: "waiting",
                  delayMs: delay,
                  elapsedMs: 0,
                });
                // 两侧
                sprites.push({
                  id: ++spriteIdRef.current,
                  x: centerX + vOffsets[0].x * (i + 1),
                  y: centerY + vOffsets[0].y * (i + 1),
                  vx: 0,
                  vy: 0,
                  direction: targetDirection8,
                  frame: 0,
                  phase: "waiting",
                  delayMs: delay,
                  elapsedMs: 0,
                });
                sprites.push({
                  id: ++spriteIdRef.current,
                  x: centerX + vOffsets[1].x * (i + 1),
                  y: centerY + vOffsets[1].y * (i + 1),
                  vx: 0,
                  vy: 0,
                  direction: targetDirection8,
                  frame: 0,
                  phase: "waiting",
                  delayMs: delay,
                  elapsedMs: 0,
                });
              }
              break;
            }
            default: // Region=6 或其他：简单显示
              sprites.push({
                id: ++spriteIdRef.current,
                x: centerX,
                y: centerY,
                vx: 0,
                vy: 0,
                direction: targetDirection8,
                frame: 0,
                phase: "flying",
                delayMs: 0,
                elapsedMs: 0,
              });
          }
          break;
        }

        case 13: // FollowCharacter - 跟随角色（在角色身上播放持续效果）
        case 16: // FollowEnemy - 跟随敌人（在敌人身上播放）
        case 21: // PlayerControl - 玩家控制
          // 这些都是在角色/敌人位置原地播放的效果
          sprites.push({
            id: ++spriteIdRef.current,
            x: centerX,
            y: centerY,
            vx: 0,
            vy: 0,
            direction: targetDirection8,
            frame: 0,
            phase: "flying", // 原地循环播放
            delayMs: 0,
            elapsedMs: 0,
          });
          break;

        case 15: {
          // SuperMode - 超级模式（全屏攻击）
          // SuperMode 行为（Reference: C# MagicSprite.cs）：
          // 1. 先在施法者位置播放 SuperModeImage（一轮动画）
          // 2. 动画播完后调用 Destroy()，在所有敌人位置同时播放 VanishImage

          // 施法者动画（使用 superModeImage）
          sprites.push({
            id: ++spriteIdRef.current,
            x: centerX,
            y: centerY,
            vx: 0,
            vy: 0,
            direction: targetDirection8,
            frame: 0,
            phase: "flying",
            delayMs: 0,
            elapsedMs: 0,
            isSuperModeCast: true, // 标记为 SuperMode 施法阶段
          });

          // 目标位置的爆炸效果（使用 vanishImage）
          // 延迟时间 = 0，但 phase = "waiting"，等待施法精灵播放完成后统一触发
          const numTargets = 5 + Math.floor(Math.random() * 3);
          for (let i = 0; i < numTargets; i++) {
            const randX = centerX + (Math.random() - 0.5) * PREVIEW_DISTANCE * 1.5;
            const randY = centerY + (Math.random() - 0.5) * PREVIEW_DISTANCE;
            sprites.push({
              id: ++spriteIdRef.current,
              x: randX,
              y: randY,
              vx: 0,
              vy: 0,
              direction: targetDirection8,
              frame: 0,
              phase: "waiting",
              delayMs: -1, // 特殊标记：等待施法精灵完成后触发
              elapsedMs: 0,
              isSuperModeCast: false, // 目标位置使用 vanishImage
            });
          }
          break;
        }

        case 17: {
          // Throw - 投掷（抛物线轨迹）
          const targetX = centerX + targetDir.x * PREVIEW_DISTANCE * 0.7;
          const targetY = centerY + targetDir.y * PREVIEW_DISTANCE * 0.7;
          sprites.push({
            id: ++spriteIdRef.current,
            x: centerX,
            y: centerY,
            vx: targetDir.x * baseSpeed,
            vy: targetDir.y * baseSpeed,
            direction: targetDirection8,
            frame: 0,
            phase: "flying",
            delayMs: 0,
            elapsedMs: 0,
          });
          break;
        }

        case 19: {
          // Kind19 - 特殊类型（多目标攻击）
          const numTargets = 3 + Math.floor(effectLevel / 2);
          for (let i = 0; i < numTargets; i++) {
            const angle = (i / numTargets) * Math.PI * 2;
            const randDist = PREVIEW_DISTANCE * 0.3 + Math.random() * PREVIEW_DISTANCE * 0.4;
            sprites.push({
              id: ++spriteIdRef.current,
              x: centerX + Math.cos(angle) * randDist,
              y: centerY + Math.sin(angle) * randDist,
              vx: 0,
              vy: 0,
              direction: targetDirection8,
              frame: 0,
              phase: "waiting",
              delayMs: i * 80,
              elapsedMs: 0,
            });
          }
          break;
        }

        case 20: // Transport - 传送（原地特效）
        case 22: // Summon - 召唤（原地召唤特效）
        case 23: // TimeStop - 时间停止（全屏特效）
          // 这些都是原地播放的特效
          sprites.push({
            id: ++spriteIdRef.current,
            x: centerX,
            y: centerY,
            vx: 0,
            vy: 0,
            direction: targetDirection8,
            frame: 0,
            phase: "flying",
            delayMs: 0,
            elapsedMs: 0,
          });
          break;

        case 24: {
          // VMove - V字移动（使用引擎 getVOffsets）
          // 获取当前方向对应的 V 字偏移
          const vOffsets = getVOffsets(targetDirection8);
          // 中心武功
          sprites.push(createSpriteFromDir(targetDir));
          // 两侧武功 - 按等级增加
          for (let i = 1; i <= effectLevel; i++) {
            const pos1 = { x: centerX + vOffsets[0].x * i, y: centerY + vOffsets[0].y * i };
            const pos2 = { x: centerX + vOffsets[1].x * i, y: centerY + vOffsets[1].y * i };
            sprites.push({
              id: ++spriteIdRef.current,
              x: pos1.x,
              y: pos1.y,
              vx: targetDir.x * baseSpeed,
              vy: targetDir.y * baseSpeed,
              direction: targetDirection8,
              frame: 0,
              phase: "flying",
              delayMs: 0,
              elapsedMs: 0,
            });
            sprites.push({
              id: ++spriteIdRef.current,
              x: pos2.x,
              y: pos2.y,
              vx: targetDir.x * baseSpeed,
              vy: targetDir.y * baseSpeed,
              direction: targetDirection8,
              frame: 0,
              phase: "flying",
              delayMs: 0,
              elapsedMs: 0,
            });
          }
          break;
        }

        default:
          // 默认单发
          sprites.push(createSpriteFromDir(targetDir));
      }

      return sprites;
    },
    [magic, level]
  );

  // ========== 重置模拟 ==========
  const resetSimulation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    spritesRef.current = createSprites(centerX, centerY, currentDirection);
    lastTimeRef.current = 0;
  }, [createSprites, currentDirection]);

  // ========== 动画循环 ==========
  useEffect(() => {
    if (!isPlaying || isLoading) return;
    if (!flyingAsf && !vanishAsf && !superModeAsf) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 初始化飞行物
    if (spritesRef.current.length === 0) {
      resetSimulation();
    }

    // 获取当前等级配置（可能覆盖 moveKind）
    const currentLevelConfig = magic?.levels?.[level - 1];
    const effectiveMoveKind = currentLevelConfig?.moveKind ?? magic?.moveKind;
    const moveKindNum = effectiveMoveKind ? (MagicMoveKindValues[effectiveMoveKind] ?? 0) : 0;
    const isSuperMode = moveKindNum === 15;

    // 获取 waitFrame 和 lifeFrame 参数
    const waitFrameMs = (magic?.waitFrame ?? 0) * 16; // 转换为毫秒（约16ms/帧）
    const lifeFrame = currentLevelConfig?.lifeFrame ?? magic?.lifeFrame ?? 4;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      // 获取正确的 ASF 数据
      const flyAsf = isSuperMode ? superModeAsf : flyingAsf;
      const flyInterval = flyAsf?.interval || 100;
      const vanishInterval = vanishAsf?.interval || 100;

      // 更新飞行物
      let allDone = true;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // SuperMode: 检查施法精灵是否已完成
      let superModeCastDone = false;
      if (isSuperMode) {
        const castSprite = spritesRef.current.find((s) => s.isSuperModeCast);
        superModeCastDone = castSprite?.phase === "done";
      }

      for (const sprite of spritesRef.current) {
        sprite.elapsedMs += delta;

        // 等待阶段 - 检查是否到达启动时间
        if (sprite.phase === "waiting") {
          allDone = false;

          // SuperMode 目标精灵：等待施法精灵完成后触发（delayMs = -1 表示特殊等待）
          if (isSuperMode && !sprite.isSuperModeCast && sprite.delayMs < 0) {
            if (superModeCastDone) {
              // 施法精灵完成，立即进入 vanish 阶段
              sprite.phase = "vanish";
              sprite.elapsedMs = 0;
              sprite.frame = 0;
            }
            continue;
          }

          // 普通等待逻辑
          if (sprite.elapsedMs >= sprite.delayMs) {
            // SuperMode 目标精灵直接进入 vanish 阶段（播放爆炸效果）
            if (isSuperMode && !sprite.isSuperModeCast) {
              sprite.phase = "vanish";
            } else {
              sprite.phase = "flying";
            }
            sprite.elapsedMs = 0;
            sprite.frame = 0;
          }
          continue;
        }

        // 飞行阶段
        if (sprite.phase === "flying") {
          allDone = false;

          // 更新位置
          const dt = delta / 16.67; // 标准化到 60fps
          if (sprite.vx !== 0 || sprite.vy !== 0) {
            sprite.x += sprite.vx * dt;
            sprite.y += sprite.vy * dt;
          }

          // 更新帧
          // SuperMode 施法阶段使用 superModeAsf 的 interval
          const effectiveInterval =
            isSuperMode && sprite.isSuperModeCast && superModeAsf
              ? superModeAsf.interval || 100
              : flyInterval;
          sprite.frame += delta / effectiveInterval;

          // 检查是否达到预览距离（模拟碰撞）
          const distFromCenter = Math.sqrt((sprite.x - centerX) ** 2 + (sprite.y - centerY) ** 2);

          // SuperMode 施法精灵使用 superModeAsf 的帧数
          const effectiveFramesPerDir =
            isSuperMode && sprite.isSuperModeCast && superModeAsf
              ? (superModeAsf.framesPerDirection ?? 8)
              : (flyAsf?.framesPerDirection ?? 8);

          // 使用 lifeFrame 计算最大播放帧数
          // lifeFrame=0 表示无限飞行直到碰撞；否则播放 lifeFrame 帧
          const maxFrames = lifeFrame === 0 ? effectiveFramesPerDir * 10 : lifeFrame;

          const shouldExplode =
            distFromCenter >= PREVIEW_DISTANCE || // 达到预览距离（模拟撞墙）
            moveKindNum === 0 || // NoMove 直接爆炸
            (moveKindNum === 1 && sprite.frame >= effectiveFramesPerDir) || // 固定位置播完
            (isSuperMode && sprite.frame >= effectiveFramesPerDir) || // 超级模式播完
            sprite.frame >= maxFrames; // 达到 lifeFrame 限制

          if (shouldExplode) {
            // SuperMode 施法精灵播完后直接结束（不播放爆炸）
            if (isSuperMode && sprite.isSuperModeCast) {
              sprite.phase = "done";
            } else if (vanishAsf) {
              sprite.phase = "vanish";
              sprite.frame = 0;
              sprite.vx = 0;
              sprite.vy = 0;
            } else {
              sprite.phase = "done";
            }
          }
        } else if (sprite.phase === "vanish") {
          // 播放爆炸动画
          sprite.frame += delta / vanishInterval;

          const vanishFrames = vanishAsf?.framesPerDirection ?? 8;
          if (sprite.frame >= vanishFrames) {
            sprite.phase = "done";
          } else {
            allDone = false;
          }
        }
        // phase === "done" 不做任何事，等待全部完成
      }

      // 绘制
      drawFrame(ctx, canvas.width, canvas.height, isSuperMode);

      // 如果所有飞行物都完成，立即重置开始下一轮
      if (allDone) {
        resetSimulation();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    const drawFrame = (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      isSuperMode: boolean
    ) => {
      // 清空画布
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, width, height);

      // 绘制网格背景
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 绘制中心点（施法者位置）
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.fillStyle = "#4ade80";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fill();

      // 绘制飞行物
      ctx.imageSmoothingEnabled = false;

      // 获取亮度和透明混合参数
      const alphaBlend = !!magic?.alphaBlend;
      const flyingLum = magic?.flyingLum ?? 0;
      const vanishLum = magic?.vanishLum ?? 0;

      for (const sprite of spritesRef.current) {
        // 跳过等待中和已完成的精灵
        if (sprite.phase === "waiting" || sprite.phase === "done") continue;

        // 选择正确的 ASF
        // SuperMode 特殊处理：施法阶段用 superModeAsf，爆炸阶段用 vanishAsf
        let asf: typeof flyingAsf;
        let currentLum = 0;
        if (isSuperMode) {
          if (sprite.isSuperModeCast) {
            // SuperMode 施法阶段：使用 superModeImage
            asf = superModeAsf;
            currentLum = flyingLum;
          } else {
            // SuperMode 爆炸阶段：直接使用 vanishImage
            asf = vanishAsf;
            currentLum = vanishLum;
          }
        } else {
          // 普通武功
          asf = sprite.phase === "flying" ? flyingAsf : vanishAsf;
          currentLum = sprite.phase === "flying" ? flyingLum : vanishLum;
        }
        if (!asf || asf.frames.length === 0) continue;

        const framesPerDir = asf.framesPerDirection || 1;
        const asfDirections = asf.directions || 1;

        // 根据 ASF 的实际方向数量重新计算方向索引
        // Reference: magicRenderer.ts - getDirectionIndex(sprite.direction, asfDirections)
        let effectiveDirection: number;
        if (sprite.dirVector && (sprite.dirVector.x !== 0 || sprite.dirVector.y !== 0)) {
          // 有方向向量，使用它计算 ASF 的方向索引
          effectiveDirection = getDirectionIndex(sprite.dirVector, asfDirections);
        } else {
          // 没有方向向量，将 8 方向索引转换为 ASF 方向
          // 先转为 8 方向向量，再计算 ASF 方向
          const dir8Vector = getDirection8(sprite.direction);
          effectiveDirection = getDirectionIndex(dir8Vector, asfDirections);
        }

        const directionOffset = effectiveDirection * framesPerDir;
        let frameIdx = directionOffset + (Math.floor(sprite.frame) % framesPerDir);
        frameIdx = Math.min(Math.max(0, frameIdx), asf.frames.length - 1);

        const frame = asf.frames[frameIdx];
        if (!frame) continue;

        try {
          const frameCanvas = getFrameCanvas(frame);

          // 居中绘制
          const drawX = sprite.x - asf.width / 2;
          const drawY = sprite.y - asf.height / 2;

          ctx.save();

          // 应用透明混合 - 使用 "lighter" 混合模式实现加法混合
          if (alphaBlend) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.8;
          }

          // 应用亮度效果 - 通过调整透明度模拟（亮度越高越亮）
          // 引擎中 Lum 范围是 0-31，这里转换为可见效果
          if (currentLum > 0) {
            // 先绘制原图
            ctx.drawImage(frameCanvas, drawX, drawY, asf.width, asf.height);
            // 叠加亮度效果（使用 screen 混合模式）
            ctx.globalCompositeOperation = "screen";
            ctx.globalAlpha = currentLum / 31;
            ctx.drawImage(frameCanvas, drawX, drawY, asf.width, asf.height);
          } else {
            ctx.drawImage(frameCanvas, drawX, drawY, asf.width, asf.height);
          }

          ctx.restore();
        } catch {
          // 忽略绘制错误
        }
      }

      // 绘制方向指示（使用8方向系统）
      const dir = getDirection8(currentDirection);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + dir.x * 30, centerY + dir.y * 30);
      ctx.stroke();
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    isPlaying,
    isLoading,
    flyingAsf,
    vanishAsf,
    superModeAsf,
    magic,
    resetSimulation,
    currentDirection,
    level,
  ]);

  // 重置时重新创建飞行物（magic 变化时也需要重置）
  useEffect(() => {
    if (!isLoading && (flyingAsf || vanishAsf || superModeAsf)) {
      resetSimulation();
    }
  }, [isLoading, flyingAsf, vanishAsf, superModeAsf, resetSimulation]);

  // ========== 获取当前等级的速度 ==========
  const getSpeed = () => {
    if (!magic) return 8;
    const levelData = magic.levels?.[level - 1];
    return levelData?.speed ?? magic.speed ?? 8;
  };

  // ========== 获取当前等级的效果值 ==========
  const getLevelEffect = () => {
    if (!magic) return 0;
    const levelData = magic.levels?.[level - 1];
    return levelData?.effect ?? 0;
  };

  // ========== 获取当前等级的内力消耗 ==========
  const getLevelManaCost = () => {
    if (!magic) return 0;
    const levelData = magic.levels?.[level - 1];
    return levelData?.manaCost ?? 0;
  };

  // ========== 渲染 ==========

  if (!magic) {
    return (
      <div className="flex items-center justify-center h-48 bg-[#1e1e1e] rounded">
        <span className="text-[#858585] text-sm">选择武功查看预览</span>
      </div>
    );
  }

  const hasAnyResource = magic.flyingImage || magic.vanishImage || magic.superModeImage;

  if (!hasAnyResource) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center h-32 bg-[#1e1e1e] rounded border border-dashed border-widget-border">
          <div className="text-center">
            <span className="text-3xl">🎯</span>
            <p className="text-[#858585] text-xs mt-2">未设置任何图像资源</p>
          </div>
        </div>
        <TrajectoryInfo moveKind={magic.moveKind} speed={getSpeed()} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 预览区域 */}
      <div className="relative bg-[#1e1e1e] rounded overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-[#858585] text-sm">加载资源中...</span>
            </div>
          </div>
        ) : loadError ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center text-red-400">
              <span className="text-2xl">❌</span>
              <p className="text-xs mt-2">{loadError}</p>
            </div>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              className="w-full"
              style={{ imageRendering: "pixelated" }}
            />

            {/* 控制按钮 */}
            <div className="absolute bottom-2 right-2 flex gap-1">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-1.5 bg-black/60 rounded text-white text-xs hover:bg-black/80"
                title={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button
                type="button"
                onClick={resetSimulation}
                className="p-1.5 bg-black/60 rounded text-white text-xs hover:bg-black/80"
                title="重置"
              >
                🔄
              </button>
            </div>

            {/* 信息面板 */}
            <div className="absolute top-2 left-2 text-xs text-white/80 bg-black/60 px-2 py-1 rounded max-w-48">
              <div className="font-medium">{MagicMoveKindLabels[magic.moveKind]}</div>
              <div className="text-white/50">
                Lv.{level} | 速度:{getSpeed()} | 生命帧:{magic.lifeFrame ?? 4}
              </div>
              {magic.waitFrame ? (
                <div className="text-white/50">等待帧:{magic.waitFrame}</div>
              ) : null}
              {(magic.alphaBlend || (magic.flyingLum ?? 0) > 0 || (magic.vanishLum ?? 0) > 0) && (
                <div className="text-blue-300 text-[10px]">
                  {magic.alphaBlend ? "透明混合 " : ""}
                  {(magic.flyingLum ?? 0) > 0 ? `飞行亮度:${magic.flyingLum} ` : ""}
                  {(magic.vanishLum ?? 0) > 0 ? `消失亮度:${magic.vanishLum}` : ""}
                </div>
              )}
              {getLevelEffect() > 0 && (
                <div className="text-amber-400">效果: {getLevelEffect()}</div>
              )}
            </div>

            {/* 方向控制 */}
            <div className="absolute top-2 right-2">
              <DirectionSelector
                directions={8}
                current={currentDirection}
                onChange={(dir) => {
                  setCurrentDirection(dir);
                  resetSimulation();
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* 等级效果信息 */}
      {magic.levels && magic.levels.length > 0 && (
        <div className="flex items-center gap-4 text-xs bg-[#252525] rounded px-3 py-2">
          <div>
            <span className="text-[#858585]">等级 </span>
            <span className="text-amber-400 font-medium">{level}</span>
          </div>
          {getLevelEffect() > 0 && (
            <div>
              <span className="text-[#858585]">效果 </span>
              <span className="text-green-400">{getLevelEffect()}</span>
            </div>
          )}
          {getLevelManaCost() > 0 && (
            <div>
              <span className="text-[#858585]">内力 </span>
              <span className="text-blue-400">-{getLevelManaCost()}</span>
            </div>
          )}
        </div>
      )}

      {/* 资源信息 */}
      <div className="text-xs text-[#858585] space-y-1 border-t border-widget-border pt-2">
        {magic.flyingImage && (
          <div className="flex justify-between">
            <span>飞行:</span>
            <span className="font-mono truncate max-w-40" title={magic.flyingImage}>
              {magic.flyingImage.split("/").pop()}
            </span>
          </div>
        )}
        {magic.vanishImage && (
          <div className="flex justify-between">
            <span>爆炸:</span>
            <span className="font-mono truncate max-w-40" title={magic.vanishImage}>
              {magic.vanishImage.split("/").pop()}
            </span>
          </div>
        )}
        {magic.superModeImage && (
          <div className="flex justify-between">
            <span>超级模式:</span>
            <span className="font-mono truncate max-w-40" title={magic.superModeImage}>
              {magic.superModeImage.split("/").pop()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ========== 方向选择器组件 ==========

function DirectionSelector({
  directions,
  current,
  onChange,
}: {
  directions: number;
  current: number;
  onChange: (dir: number) => void;
}) {
  // 方向索引从 South (0) 开始顺时针：0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE
  const dirLabels = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];

  return (
    <div className="grid grid-cols-3 gap-px bg-black/60 rounded p-1">
      {/* 布局: NW(3), N(4), NE(5) / W(2), 空, E(6) / SW(1), S(0), SE(7) */}
      {[3, 4, 5, 2, -1, 6, 1, 0, 7].map((dir, i) =>
        dir === -1 ? (
          <div key={`empty-${i}`} className="w-5 h-5" />
        ) : dir < directions ? (
          <button
            key={`dir-${dir}`}
            type="button"
            onClick={() => onChange(dir)}
            className={`w-5 h-5 text-xs flex items-center justify-center rounded ${
              current === dir ? "bg-amber-500 text-white" : "text-white/70 hover:bg-white/20"
            }`}
            title={`方向 ${dir}`}
          >
            {dirLabels[dir]}
          </button>
        ) : (
          <div key={`hidden-${i}`} className="w-5 h-5" />
        )
      )}
    </div>
  );
}

// ========== 轨迹信息组件 ==========

function TrajectoryInfo({ moveKind, speed }: { moveKind: MagicMoveKind; speed?: number }) {
  const moveKindNum = MagicMoveKindValues[moveKind] ?? 0;

  // 获取轨迹描述
  const getDescription = (): string => {
    switch (moveKindNum) {
      case 0:
        return "原地释放，无飞行阶段";
      case 1:
        return "固定位置产生效果";
      case 2:
        return "单发直线飞行";
      case 3:
        return "多发直线散射";
      case 4:
        return "圆形向四周扩散";
      case 5:
        return "沿心形轨迹移动";
      case 6:
        return "螺旋形向外扩散";
      case 7:
        return "扇形范围攻击";
      case 8:
        return "随机扇形散射";
      case 13:
        return "跟随施法者移动";
      case 15:
        return "全屏攻击所有目标";
      case 16:
        return "追踪最近敌人";
      case 20:
        return "传送到目标位置";
      case 22:
        return "在目标位置召唤 NPC";
      case 24:
        return "V 字形双向飞行";
      default:
        return "未知移动类型";
    }
  };

  return (
    <div className="bg-[#252525] rounded p-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-400 text-lg">📍</span>
        <span className="text-[#cccccc] font-medium">{MagicMoveKindLabels[moveKind]}</span>
      </div>
      <p className="text-[#858585] text-xs">{getDescription()}</p>
      {speed !== undefined && <p className="text-[#858585] text-xs mt-1">飞行速度: {speed}</p>}
    </div>
  );
}
