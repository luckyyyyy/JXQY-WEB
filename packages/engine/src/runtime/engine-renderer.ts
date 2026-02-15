/**
 * Engine Renderer - 引擎级渲染管线
 *
 * 从 GameEngine 提取的交错渲染逻辑。
 * 负责在地图各行之间穿插绘制 NPC、物体、玩家、武功精灵，
 * 以及处理玩家遮挡半透明和 SuperMode 精灵。
 *
 * 同时包含 renderFrame()：完整的帧渲染管线（灰度、交错渲染、
 * 高亮边缘、颜色叠加、天气、屏幕特效）。
 */

import type { Character } from "../character/character";
import { CharacterState } from "../core/types";
import type { MagicSpriteManager } from "../magic";
import type { MagicRenderer } from "../magic/magic-renderer";
import type {
  MapRenderer,
  renderMapInterleaved as renderMapInterleavedFn,
} from "../map/map-renderer";
import type { NpcManager } from "../npc/npc-manager";
import type { ObjManager } from "../obj";
import type { ObjRenderer } from "../obj/obj-renderer";
import type { Player } from "../player/player";
import type { Renderer } from "../renderer/renderer";
import type { WeatherManager } from "../weather";
import type { GameManager } from "./game-manager";

/**
 * 交错渲染所需的上下文
 */
export interface EngineRenderContext {
  mapRenderer: MapRenderer;
  config: { width: number; height: number };
  player: Player;
  npcManager: NpcManager;
  objManager: ObjManager;
  objRenderer: ObjRenderer;
  magicSpriteManager: MagicSpriteManager;
  magicRenderer: MagicRenderer;
  /** map-renderer 的 renderMapInterleaved 函数 */
  renderMapInterleavedFn: typeof renderMapInterleavedFn;
}

/**
 * Draw character placeholder (fallback when sprites not loaded)
 * 使用 getContext2D 回退绘制文字和形状
 */
export function drawCharacterPlaceholder(
  renderer: Renderer,
  character: Character,
  camera: { x: number; y: number },
  width: number,
  height: number
): void {
  const ctx = renderer.getContext2D();
  if (!ctx) return;

  const screenX = character.pixelPosition.x - camera.x;
  const screenY = character.pixelPosition.y - camera.y;

  // Skip if off-screen
  if (screenX < -50 || screenX > width + 50 || screenY < -50 || screenY > height + 50) {
    return;
  }

  // Draw character circle
  ctx.save();
  ctx.translate(screenX, screenY);

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const isPlayer = character.name === "杨影枫";
  const color = isPlayer ? "#4a90d9" : "#d9a04a";
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -20, 15, 0, Math.PI * 2);
  ctx.fill();

  // Direction indicator
  const dirAngles = [
    -Math.PI / 2, // North
    -Math.PI / 4, // NorthEast
    0, // East
    Math.PI / 4, // SouthEast
    Math.PI / 2, // South
    (3 * Math.PI) / 4, // SouthWest
    Math.PI, // West
    (-3 * Math.PI) / 4, // NorthWest
  ];
  const angle = dirAngles[character.direction] || 0;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(Math.cos(angle) * 12, -20 + Math.sin(angle) * 12);
  ctx.stroke();

  // Name tag
  ctx.fillStyle = "#fff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(character.config.name, 0, -40);

  // Walking animation indicator
  if (character.state === CharacterState.Walk) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(0, -20, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 交错渲染地图、NPC、玩家、物体、武功精灵
 *
 * 按行交错：layer1 → (layer2 + 角色/物体/武功按行) → layer3
 * 高亮边缘不在此绘制，由调用方在 grayscale restore 之后单独处理。
 */
export function renderEngineInterleaved(r: Renderer, ctx: EngineRenderContext): void {
  const {
    mapRenderer: mapR,
    config,
    player,
    npcManager,
    objManager,
    objRenderer,
    magicSpriteManager: magicMgr,
    magicRenderer,
  } = ctx;
  const { width, height } = config;

  if (mapR.isLoading || !mapR.mapData) return;

  const playerRow = player.tilePosition.y;

  // 交错渲染（不在这里绘制高亮边缘）
  ctx.renderMapInterleavedFn(r, mapR, (row: number) => {
    // 渲染该行的 NPC（使用预计算的按行分组）
    const npcsAtRow = npcManager.getNpcsAtRow(row);
    for (const npc of npcsAtRow) {
      if (npc.isSpritesLoaded()) {
        npc.draw(r, mapR.camera.x, mapR.camera.y);
      } else {
        drawCharacterPlaceholder(r, npc, mapR.camera, width, height);
      }
    }

    // 渲染该行的物体（使用预计算的按行分组）
    const objsAtRow = objManager.getObjsAtRow(row);
    for (const obj of objsAtRow) {
      objRenderer.drawObj(r, obj, mapR.camera.x, mapR.camera.y);
    }

    // 渲染玩家
    if (row === playerRow) {
      if (player.isSpritesLoaded()) {
        player.draw(r, mapR.camera.x, mapR.camera.y);
      } else {
        drawCharacterPlaceholder(r, player, mapR.camera, width, height);
      }
    }

    // 渲染武功精灵（使用 MagicSpriteManager 预计算的按行分组）
    if (magicMgr) {
      const magicsAtRow = magicMgr.getMagicSpritesAtRow(row);
      for (const sprite of magicsAtRow) {
        magicRenderer.render(r, sprite, mapR.camera.x, mapR.camera.y);
      }

      // 渲染特效精灵
      const effectsAtRow = magicMgr.getEffectSpritesAtRow(row);
      for (const sprite of effectsAtRow) {
        magicRenderer.render(r, sprite, mapR.camera.x, mapR.camera.y);
      }
    }
  });

  // === 玩家遮挡半透明效果 ===
  // 当玩家被遮挡物覆盖时绘制半透明效果
  // 在所有地图层和角色绘制完成后，如果玩家被遮挡，再单独绘制一层半透明玩家
  // 注意：需要检查 isDraw，否则 ShowNpc("杨影枫", 0) 隐藏玩家时半透明层仍会显示
  if (player.isSpritesLoaded() && player.isOccluded && player.isDraw) {
    r.save();
    r.setAlpha(0.5);
    player.drawWithColor(r, mapR.camera.x, mapR.camera.y, "white", 0, 0);
    r.restore();
  }

  // === SuperMode 精灵渲染（在所有内容之上） ===
  // if (Globals.IsInSuperMagicMode) { Globals.SuperModeMagicSprite.Draw(_spriteBatch); }
  // SuperMode 精灵不在普通列表中，需要单独渲染
  if (magicMgr.isInSuperMagicMode) {
    const superModeSprite = magicMgr.superModeMagicSprite;
    if (superModeSprite && !superModeSprite.isDestroyed) {
      magicRenderer.render(r, superModeSprite, mapR.camera.x, mapR.camera.y);
    }
  }

  // 注意：高亮边缘不在这里绘制，移到 renderFrame() 中 grayscale restore 之后
  // 否则在 ChangeMapColor(0,0,0) 灰度模式下边缘会被灰度化而不可见
}

// ============= 完整帧渲染管线 =============

/** renderFrame 所需的上下文 */
export interface FrameRenderContext {
  config: { width: number; height: number };
  gameManager: GameManager;
  mapRenderer: MapRenderer;
  objRenderer: ObjRenderer;
  magicRenderer: MagicRenderer;
  weatherManager: WeatherManager;
  renderMapInterleavedFn: typeof renderMapInterleavedFn;
}

/**
 * 渲染一帧完整画面：灰度 → 交错渲染 → 高亮边缘 → 颜色叠加 → 天气 → 屏幕特效
 */
export function renderFrame(renderer: Renderer, ctx: FrameRenderContext): void {
  const {
    config,
    gameManager,
    mapRenderer: mapR,
    objRenderer: objR,
    magicRenderer,
    weatherManager,
  } = ctx;
  const { width, height } = config;

  renderer.beginFrame();

  // 应用地图颜色效果（ChangeMapColor → 灰度）
  const screenEffects = gameManager.screenEffects;
  const mapGrayscale = screenEffects.isMapGrayscale();
  if (mapGrayscale) {
    renderer.save();
    renderer.setFilter("grayscale");
  }

  // 交错渲染地图、NPC、玩家、物体、武功精灵
  renderEngineInterleaved(renderer, {
    mapRenderer: mapR,
    config,
    player: gameManager.player,
    npcManager: gameManager.npcManager,
    objManager: gameManager.objManager,
    objRenderer: objR,
    magicSpriteManager: gameManager.magicSpriteManager,
    magicRenderer,
    renderMapInterleavedFn: ctx.renderMapInterleavedFn,
  });

  if (mapGrayscale) {
    renderer.restore();
  }

  // === 高亮边缘（在 grayscale restore 之后，不受灰度影响） ===
  {
    const interactionManager = gameManager.interactionManager;
    const hoverTarget = interactionManager.getHoverTarget();
    const edgeColor = interactionManager.getEdgeColor();
    if (hoverTarget.type === "npc") {
      const npc = hoverTarget.npc;
      if (npc.isSpritesLoaded() && npc.isVisible) {
        npc.drawHighlight(renderer, mapR.camera.x, mapR.camera.y, edgeColor);
      }
    } else if (hoverTarget.type === "obj") {
      const obj = hoverTarget.obj;
      objR.drawObjHighlight(renderer, obj, mapR.camera.x, mapR.camera.y, edgeColor);
    }
  }

  // 应用地图颜色叠加（非黑色的 ChangeMapColor 效果）
  if (screenEffects.isMapTinted()) {
    const tint = screenEffects.getMapTintColor();
    renderer.save();
    renderer.setBlendMode("multiply");
    renderer.fillRect({
      x: 0,
      y: 0,
      width,
      height,
      color: `rgb(${tint.r}, ${tint.g}, ${tint.b})`,
    });
    renderer.restore();
  }

  // 渲染天气效果（雨、雪）
  weatherManager.draw(renderer, mapR.camera.x, mapR.camera.y);

  // 渲染屏幕特效（淡入淡出、闪烁）
  gameManager.drawScreenEffects(renderer, width, height);

  renderer.endFrame();
}
