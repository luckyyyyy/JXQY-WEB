/**
 * NPC AI 模拟 Hook
 *
 * 复用引擎 characterMovement.ts 中的随机行走 / 循环行走算法，
 * 在 Dashboard 场景编辑器中驱动 NPC 标记移动。
 *
 * 核心逻辑（来自 engine）：
 * - RandWalk: 每帧 1/400 概率从随机路径点中选一个瓦片，A* 寻路前往
 * - LoopWalk: 每帧 1/400 概率 A* 寻路前进到下一个 FixedPos 路径点
 * - Stand: 不移动
 *
 * 移动机制（1:1 复用引擎 moveAlongPath 逻辑）：
 * - findPath(A*) 生成多路点路径，逐瓦片在像素空间平滑插值
 * - 到达路点时检查下一瓦片障碍物，如被阻挡则重新寻路
 * - carry-over 距离保证高速移动时不卡顿
 */

import { useCallback, useEffect, useRef } from "react";
import type { SceneNpcEntry } from "@miu2d/types";
import type { MiuMapData } from "@miu2d/engine/map/types";
import type { Vector2 } from "@miu2d/engine/core/types";
import type { MapViewerHandle } from "@miu2d/viewer";
import { parseFixedPos } from "@miu2d/engine/npc";
import { generateRandTilePath } from "@miu2d/engine/character";
import { findPath, PathType } from "@miu2d/engine/utils/path-finder";
import { MapBase } from "@miu2d/engine/map";
import { getDirectionFromVector, tileToPixel } from "@miu2d/engine/utils";

// 复用引擎常量
const ACTION_STAND = 0;
const ACTION_RAND_WALK = 1;
const ACTION_LOOP_WALK = 2;

/** 随机行走触发概率（引擎值: 1/400） */
const RAND_WALK_PROBABILITY = 400;

/** 随机路径点数量（引擎默认 8） */
const RAND_PATH_COUNT = 8;

/** 随机路径偏移范围（引擎默认 10） */
const RAND_PATH_OFFSET = 10;

/**
 * 引擎基础速度（像素/秒），与 engine/core/types.ts 的 BASE_SPEED 一致。
 * 实际速度 = BASE_SPEED * walkSpeed
 */
const BASE_SPEED = 100;

interface NpcSimState {
	/** 当前瓦片坐标（到达路点时更新） */
	mapX: number;
	mapY: number;
	/** 当前像素坐标（平滑插值，每帧更新） */
	pixelX: number;
	pixelY: number;
	/** A* 路径（瓦片坐标），引擎 moveAlongPath 的 this.path */
	path: Vector2[];
	/** 最终目的地瓦片（用于被阻挡时重新寻路） */
	destination: Vector2 | null;
	/** 是否正在移动 */
	walking: boolean;
	/** 当前朝向（引擎 Direction 枚举 0-7，移动时更新） */
	direction: number;
	/** 随机路径点缓存（RandWalk 用） */
	randPath: Array<{ x: number; y: number }>;
	/** LoopWalk 当前路径索引 */
	loopIndex: number;
	/** LoopWalk 路径点 */
	loopPath: Array<{ x: number; y: number }> | null;
	/** 原始坐标（出生点） */
	homeX: number;
	homeY: number;
	/** action 类型 */
	action: number;
}

export interface NpcSimulationResult {
	/** 获取标记的当前模拟位置（返回 undefined 表示使用原始位置） */
	getMarkerPosition: (index: number) => {
		mapX: number; mapY: number;
		pixelX?: number; pixelY?: number;
		walking?: boolean; direction?: number;
	} | undefined;
}

/**
 * NPC AI 模拟 Hook
 *
 * @param npcEntries NPC 配置列表
 * @param npcCount NPC 数量（仅 NPC，不含 OBJ；用于区分 marker 索引）
 * @param mapData 地图数据（用于障碍检测）
 * @param mapViewerRef MapViewer ref（用于触发重绘）
 * @param enabled 是否启用模拟
 */
export function useNpcSimulation(
	npcEntries: SceneNpcEntry[],
	mapData: MiuMapData | null | undefined,
	mapViewerRef: React.RefObject<MapViewerHandle | null>,
	enabled = true,
): NpcSimulationResult {
	const statesRef = useRef<NpcSimState[]>([]);
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	// npcEntries 变化时重建模拟状态
	const prevEntriesRef = useRef<SceneNpcEntry[]>([]);
	if (npcEntries !== prevEntriesRef.current) {
		prevEntriesRef.current = npcEntries;
		statesRef.current = npcEntries.map((entry): NpcSimState => {
			const pixel = tileToPixel(entry.mapX, entry.mapY);
			return {
				mapX: entry.mapX,
				mapY: entry.mapY,
				pixelX: pixel.x,
				pixelY: pixel.y,
				path: [],
				destination: null,
				walking: false,
				direction: entry.dir ?? 0,
				randPath: [],
				loopIndex: 0,
				loopPath: entry.fixedPos ? parseFixedPos(entry.fixedPos) : null,
				homeX: entry.mapX,
				homeY: entry.mapY,
				action: entry.action,
			};
		});
	}

	// 模拟 tick（1:1 复用引擎 moveAlongPath + walkTo 寻路逻辑）
	useEffect(() => {
		if (!enabled) return;

		const md = mapData ?? null;

		// 障碍检测回调（引擎 walkTo 中的三级检测）
		// hasObstacle: 地图+NPC+OBJ 综合可通行性（dashboard 中只检查地图障碍）
		// isMapObstacle: OBSTACLE + TRANS 标志
		// isHardObstacle: 仅 OBSTACLE 标志
		const hasObstacle = md
			? (tile: Vector2): boolean => MapBase.isObstacleAt(md, tile.x, tile.y)
			: (_tile: Vector2): boolean => false;
		const isMapObstacle = hasObstacle;
		const isHardObstacle = md
			? (tile: Vector2): boolean => MapBase.isHardObstacleAt(md, tile.x, tile.y)
			: (_tile: Vector2): boolean => false;

		/** 为 NPC 寻路到目标瓦片（引擎 _findPathAndMove） */
		const findPathTo = (state: NpcSimState, target: Vector2): void => {
			const start: Vector2 = { x: state.mapX, y: state.mapY };
			// 引擎中 NPC 大多使用 PerfectMaxNpcTry (A* maxTry=100)
			const pathResult = findPath(
				start,
				target,
				PathType.PerfectMaxNpcTry,
				hasObstacle,
				isMapObstacle,
				isHardObstacle,
				8,
			);
			if (pathResult.length > 1) {
				// slice(1): 去掉起点（引擎: path = newPath.slice(1)）
				state.path = pathResult.slice(1);
				state.destination = { ...target };
				state.walking = true;
			}
			// 寻路失败则保持站立
		};

		let lastTime = 0;
		let animId = 0;

		const tick = (timestamp: number) => {
			if (!enabledRef.current) {
				animId = requestAnimationFrame(tick);
				return;
			}

			if (lastTime === 0) lastTime = timestamp;
			const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // 秒，cap 100ms
			lastTime = timestamp;

			const states = statesRef.current;
			let dirty = false;

			for (const state of states) {
				if (state.action === ACTION_STAND) continue;

				if (state.walking) {
					// === 引擎 moveAlongPath 逻辑 ===
					if (state.path.length === 0) {
						state.walking = false;
						dirty = true;
						continue;
					}

					const tileTo = state.path[0];
					const tileFrom: Vector2 = { x: state.mapX, y: state.mapY };

					// 到达新路点前检查障碍（引擎: tileFrom != tileTo 时检查）
					if ((tileFrom.x !== tileTo.x || tileFrom.y !== tileTo.y) && hasObstacle(tileTo)) {
						// 被阻挡：尝试重新寻路到最终目的地
						if (state.destination) {
							const currentPixel = tileToPixel(tileFrom.x, tileFrom.y);
							state.pixelX = currentPixel.x;
							state.pixelY = currentPixel.y;
							const newPath = findPath(
								tileFrom,
								state.destination,
								PathType.PerfectMaxNpcTry,
								hasObstacle,
								isMapObstacle,
								isHardObstacle,
								8,
							);
							if (newPath.length > 1) {
								state.path = newPath.slice(1);
							} else {
								state.path = [];
								state.walking = false;
								state.destination = null;
							}
						} else {
							state.path = [];
							state.walking = false;
						}
						dirty = true;
						continue;
					}

					// 本帧移动预算 = BASE_SPEED * walkSpeed(1) * dt
					let moveRemaining = BASE_SPEED * dt;

					// 循环消耗移动预算，允许一帧内跨越多个路点（引擎 carry-over）
					while (moveRemaining > 0 && state.path.length > 0) {
						const target = state.path[0];
						const targetPixel = tileToPixel(target.x, target.y);

						const dx = targetPixel.x - state.pixelX;
						const dy = targetPixel.y - state.pixelY;
						const dist = Math.sqrt(dx * dx + dy * dy);

						// 更新朝向
						if (dx !== 0 || dy !== 0) {
							state.direction = getDirectionFromVector({ x: dx, y: dy });
						}

						if (dist < 1) {
							// 已在路点上：snap 并推进到下一段
							state.pixelX = targetPixel.x;
							state.pixelY = targetPixel.y;
							state.mapX = target.x;
							state.mapY = target.y;
							state.path.shift();

							if (state.path.length === 0) {
								// 到达最终目的地
								state.walking = false;
								state.destination = null;
								break;
							}

							// 检查下一瓦片障碍（引擎: 防止高速穿墙）
							const nextTile = state.path[0];
							if (hasObstacle(nextTile)) {
								state.path = [];
								state.walking = false;
								state.destination = null;
								break;
							}
							continue;
						}

						if (moveRemaining >= dist) {
							// 一步到达当前路点
							state.pixelX = targetPixel.x;
							state.pixelY = targetPixel.y;
							state.mapX = target.x;
							state.mapY = target.y;
							moveRemaining -= dist;
							state.path.shift();

							if (state.path.length === 0) {
								state.walking = false;
								state.destination = null;
								break;
							}

							// 检查下一瓦片障碍
							const nextTile = state.path[0];
							if (hasObstacle(nextTile)) {
								state.path = [];
								state.walking = false;
								state.destination = null;
								break;
							}
						} else {
							// 按比例移动（引擎: ratio = moveRemaining / dist）
							const ratio = moveRemaining / dist;
							state.pixelX += dx * ratio;
							state.pixelY += dy * ratio;
							moveRemaining = 0;
						}
					}
					dirty = true;
				} else {
					// 站立中：概率触发行走（引擎: 1/RAND_WALK_PROBABILITY per frame）
					if (Math.floor(Math.random() * RAND_WALK_PROBABILITY) !== 0) continue;

					let target: { x: number; y: number } | null = null;

					if (state.action === ACTION_RAND_WALK) {
						// 懒生成随机路径
						if (state.randPath.length < 2) {
							state.randPath = generateRandTilePath(
								state.homeX,
								state.homeY,
								RAND_PATH_COUNT,
								RAND_PATH_OFFSET,
								md ? (x, y) => !MapBase.isObstacleAt(md, x, y) : undefined,
							);
						}
						if (state.randPath.length >= 2) {
							const idx = Math.floor(Math.random() * state.randPath.length);
							target = state.randPath[idx];
						}
					} else if (state.action === ACTION_LOOP_WALK && state.loopPath && state.loopPath.length >= 2) {
						state.loopIndex = (state.loopIndex + 1) % state.loopPath.length;
						target = state.loopPath[state.loopIndex];
					}

					if (target) {
						findPathTo(state, { x: target.x, y: target.y });
						dirty = true;
					}
				}
			}

			if (dirty) {
				mapViewerRef.current?.requestRender();
			}

			animId = requestAnimationFrame(tick);
		};

		animId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animId);
	}, [enabled, mapData, mapViewerRef]);

	const getMarkerPosition = useCallback((index: number): {
		mapX: number; mapY: number;
		pixelX?: number; pixelY?: number;
		walking?: boolean; direction?: number;
	} | undefined => {
		const state = statesRef.current[index];
		if (!state || state.action === ACTION_STAND) return undefined;
		return {
			mapX: state.mapX,
			mapY: state.mapY,
			pixelX: state.pixelX,
			pixelY: state.pixelY,
			walking: state.walking,
			direction: state.direction,
		};
	}, []);

	return { getMarkerPosition };
}
