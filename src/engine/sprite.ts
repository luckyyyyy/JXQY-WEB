/**
 * Sprite Renderer - manages character sprite loading and rendering
 * Based on JxqyHD Engine/Sprite.cs
 */

import { loadAsf, getFrameCanvas, getFrameIndex, type AsfData } from "./asf";
import { CharacterState, type Direction } from "./core/types";

export interface SpriteSet {
  stand: AsfData | null;
  stand1: AsfData | null; // Alternative standing animation
  walk: AsfData | null;
  run: AsfData | null;
  attack: AsfData | null;
  attack1: AsfData | null;
  attack2: AsfData | null;
  magic: AsfData | null;
  hurt: AsfData | null;
  death: AsfData | null;
  sit: AsfData | null;
  special: AsfData | null;
}

export interface CharacterSprite {
  spriteSet: SpriteSet;
  currentAsf: AsfData | null;
  currentFrame: number;
  animationTime: number;
  isLoaded: boolean;
  basePath: string;
  baseFileName: string;
}

// Cache for sprite sets
const spriteCache = new Map<string, SpriteSet>();

/**
 * Create empty sprite set
 */
export function createEmptySpriteSet(): SpriteSet {
  return {
    stand: null,
    stand1: null,
    walk: null,
    run: null,
    attack: null,
    attack1: null,
    attack2: null,
    magic: null,
    hurt: null,
    death: null,
    sit: null,
    special: null,
  };
}

/**
 * Create character sprite instance
 */
export function createCharacterSprite(basePath: string, baseFileName: string): CharacterSprite {
  return {
    spriteSet: createEmptySpriteSet(),
    currentAsf: null,
    currentFrame: 0,
    animationTime: 0,
    isLoaded: false,
    basePath,
    baseFileName,
  };
}

/**
 * Map state type codes to file suffixes (from C# NpcIni system)
 * State types:
 * 0 = Stand (_st)
 * 1 = Stand1 (_sst2 or _st2)
 * 2 = Walk (_wlk)
 * 3 = Run (_run)
 * etc.
 */
const STATE_SUFFIXES: Record<number, string[]> = {
  [CharacterState.Stand]: ["_st", "_pst"],
  [CharacterState.Stand1]: ["_sst2", "_st2", "_st"],
  [CharacterState.Walk]: ["_wlk", "_wlk2"],
  [CharacterState.Run]: ["_run", "_run2", "_wlk"],
  [CharacterState.FightStand]: ["_st", "_pst"],
  [CharacterState.FightWalk]: ["_wlk", "_wlk2"],
  [CharacterState.FightRun]: ["_run", "_run2", "_wlk"],
  [CharacterState.Attack]: ["_at", "_bat"],
  [CharacterState.Attack1]: ["_at", "_bat"],
  [CharacterState.Attack2]: ["_bat", "_at"],
  [CharacterState.Magic]: ["_bat", "_at"],
  [CharacterState.Hurt]: ["_pst", "_st"],
  [CharacterState.Death]: ["_die", "_body"],
  [CharacterState.Sit]: ["_sit", "_sst2", "_st"],
  [CharacterState.Special]: ["_pst", "_st"],
};

/**
 * Try to load ASF with fallback suffixes
 */
async function loadAsfWithFallback(
  basePath: string,
  baseFileName: string,
  suffixes: string[]
): Promise<AsfData | null> {
  for (const suffix of suffixes) {
    const url = `${basePath}/${baseFileName}${suffix}.asf`;
    const asf = await loadAsf(url);
    if (asf) {
      return asf;
    }
  }
  return null;
}

/**
 * Load sprite set for a character
 */
export async function loadSpriteSet(
  basePath: string,
  baseFileName: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<SpriteSet> {
  const cacheKey = `${basePath}/${baseFileName}`;
  const cached = spriteCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const spriteSet = createEmptySpriteSet();

  // States to load with their fallback suffixes
  const statesToLoad: { key: keyof SpriteSet; suffixes: string[] }[] = [
    { key: "stand", suffixes: ["_st", "_pst"] },
    { key: "stand1", suffixes: ["_sst2", "_st2", "_st"] },
    { key: "walk", suffixes: ["_wlk", "_wlk2"] },
    { key: "run", suffixes: ["_run", "_run2", "_wlk"] },
    { key: "attack", suffixes: ["_at", "_bat"] },
    { key: "attack1", suffixes: ["_at", "_bat"] },
    { key: "attack2", suffixes: ["_bat", "_at"] },
    { key: "magic", suffixes: ["_bat", "_at"] },
    { key: "hurt", suffixes: ["_pst", "_st"] },
    { key: "death", suffixes: ["_die", "_body"] },
    { key: "sit", suffixes: ["_sit", "_sst2", "_st"] },
    { key: "special", suffixes: ["_pst", "_st"] },
  ];

  let loaded = 0;
  const total = statesToLoad.length;

  for (const { key, suffixes } of statesToLoad) {
    spriteSet[key] = await loadAsfWithFallback(basePath, baseFileName, suffixes);
    loaded++;
    onProgress?.(loaded, total);
  }

  spriteCache.set(cacheKey, spriteSet);
  return spriteSet;
}

/**
 * Get ASF for a character state
 */
export function getAsfForState(spriteSet: SpriteSet, state: CharacterState): AsfData | null {
  switch (state) {
    case CharacterState.Stand:
    case CharacterState.FightStand:
      return spriteSet.stand;
    case CharacterState.Stand1:
      return spriteSet.stand1 || spriteSet.stand;
    case CharacterState.Walk:
    case CharacterState.FightWalk:
      return spriteSet.walk || spriteSet.stand;
    case CharacterState.Run:
    case CharacterState.FightRun:
      return spriteSet.run || spriteSet.walk || spriteSet.stand;
    case CharacterState.Attack:
      return spriteSet.attack || spriteSet.stand;
    case CharacterState.Attack1:
      return spriteSet.attack1 || spriteSet.attack || spriteSet.stand;
    case CharacterState.Attack2:
      return spriteSet.attack2 || spriteSet.attack || spriteSet.stand;
    case CharacterState.Magic:
      return spriteSet.magic || spriteSet.attack || spriteSet.stand;
    case CharacterState.Hurt:
      return spriteSet.hurt || spriteSet.stand;
    case CharacterState.Death:
      return spriteSet.death || spriteSet.hurt || spriteSet.stand;
    case CharacterState.Sit:
      return spriteSet.sit || spriteSet.stand1 || spriteSet.stand;
    case CharacterState.Special:
      return spriteSet.special || spriteSet.stand;
    default:
      return spriteSet.stand;
  }
}

/**
 * Update sprite animation
 */
export function updateSpriteAnimation(
  sprite: CharacterSprite,
  state: CharacterState,
  deltaTime: number
): void {
  const asf = getAsfForState(sprite.spriteSet, state);
  if (!asf) return;

  sprite.currentAsf = asf;
  sprite.animationTime += deltaTime * 1000;

  const frameInterval = asf.interval || 100;
  while (sprite.animationTime >= frameInterval) {
    sprite.animationTime -= frameInterval;
    sprite.currentFrame++;

    if (sprite.currentFrame >= asf.framesPerDirection) {
      // Check if animation should loop
      const shouldLoop = state !== CharacterState.Death;
      if (shouldLoop) {
        sprite.currentFrame = 0;
      } else {
        sprite.currentFrame = asf.framesPerDirection - 1;
      }
    }
  }
}

/**
 * Reset sprite animation
 */
export function resetSpriteAnimation(sprite: CharacterSprite): void {
  sprite.currentFrame = 0;
  sprite.animationTime = 0;
}

/**
 * Draw character sprite
 */
export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  sprite: CharacterSprite,
  x: number,
  y: number,
  direction: Direction,
  state: CharacterState
): void {
  const asf = getAsfForState(sprite.spriteSet, state);
  if (!asf || asf.frames.length === 0) {
    // Draw placeholder if no sprite loaded
    drawPlaceholder(ctx, x, y, "#4a90d9");
    return;
  }

  // Calculate frame index
  // Directions in JxqyHD: 0=North, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW
  // ASF typically has 8 directions
  const dir = Math.min(direction, asf.directions - 1);
  const frameIdx = getFrameIndex(asf, dir, sprite.currentFrame);

  if (frameIdx >= 0 && frameIdx < asf.frames.length) {
    const frame = asf.frames[frameIdx];
    const canvas = getFrameCanvas(frame);

    // Position: x,y is the foot position (world position)
    // C# draws at: PositionInWorld.X - Texture.Left, PositionInWorld.Y - Texture.Bottom
    // Left and Bottom are offsets stored in the ASF header that properly align the sprite
    const drawX = x - asf.left;
    const drawY = y - asf.bottom;

    ctx.drawImage(canvas, drawX, drawY);
  } else {
    drawPlaceholder(ctx, x, y, "#4a90d9");
  }
}

/**
 * Draw placeholder when sprite is not loaded
 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  ctx.save();

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 20, 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Clear sprite cache
 */
export function clearSpriteCache(): void {
  spriteCache.clear();
}
