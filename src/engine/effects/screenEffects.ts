/**
 * Screen Effects - based on JxqyHD Engine/Script/ScriptExecuter.cs
 * Handles fade in/out, color tinting, and other screen effects
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface ScreenEffectsState {
  // Fade effects
  isInFadeOut: boolean;
  isInFadeIn: boolean;
  fadeTransparency: number; // 0 = fully transparent, 1 = fully opaque (black)

  // Color tinting
  mapDrawColor: Color;
  spriteDrawColor: Color;

  // Screen flash
  isFlashing: boolean;
  flashColor: Color;
  flashDuration: number;
  flashElapsed: number;
}

const DEFAULT_COLOR: Color = { r: 255, g: 255, b: 255, a: 255 };
const FADE_SPEED = 0.03; // Same as C# implementation

export class ScreenEffects {
  private state: ScreenEffectsState;

  constructor() {
    this.state = {
      isInFadeOut: false,
      isInFadeIn: false,
      fadeTransparency: 0,
      mapDrawColor: { ...DEFAULT_COLOR },
      spriteDrawColor: { ...DEFAULT_COLOR },
      isFlashing: false,
      flashColor: { r: 255, g: 255, b: 255, a: 255 },
      flashDuration: 0,
      flashElapsed: 0,
    };
  }

  /**
   * Start fade out effect (screen goes to black)
   * Based on ScriptExecuter.FadeOut() in C#
   */
  fadeOut(): void {
    this.state.isInFadeOut = true;
    this.state.isInFadeIn = false;
    this.state.fadeTransparency = 0;
  }

  /**
   * Check if fade out is complete
   * Based on ScriptExecuter.IsFadeOutEnd() in C#
   */
  isFadeOutEnd(): boolean {
    return this.state.fadeTransparency >= 1;
  }

  /**
   * Start fade in effect (screen goes from black to normal)
   * Based on ScriptExecuter.FadeIn() in C#
   */
  fadeIn(): void {
    this.state.isInFadeOut = false;
    this.state.isInFadeIn = true;
    this.state.fadeTransparency = 1;
  }

  /**
   * Check if fade in is complete
   * Based on ScriptExecuter.IsFadeInEnd() in C#
   */
  isFadeInEnd(): boolean {
    return !this.state.isInFadeIn;
  }

  /**
   * Set map draw color (tinting)
   * Based on ScriptExecuter.ChangeMapColor() in C#
   */
  setMapColor(r: number, g: number, b: number): void {
    this.state.mapDrawColor = { r, g, b, a: 255 };
  }

  /**
   * Set sprite/ASF draw color (tinting)
   * Based on ScriptExecuter.ChangeAsfColor() in C#
   */
  setSpriteColor(r: number, g: number, b: number): void {
    this.state.spriteDrawColor = { r, g, b, a: 255 };
  }

  /**
   * Flash the screen with a color
   */
  flash(color: Color, duration: number): void {
    this.state.isFlashing = true;
    this.state.flashColor = color;
    this.state.flashDuration = duration;
    this.state.flashElapsed = 0;
  }

  /**
   * Reset all colors to default
   */
  resetColors(): void {
    this.state.mapDrawColor = { ...DEFAULT_COLOR };
    this.state.spriteDrawColor = { ...DEFAULT_COLOR };
  }

  /**
   * Initialize/reset screen effects
   * Based on ScriptExecuter.Init() in C#
   */
  init(): void {
    this.state.isInFadeIn = false;
    this.state.isInFadeOut = false;
    this.state.fadeTransparency = 0;
    this.resetColors();
    this.state.isFlashing = false;
  }

  /**
   * Update screen effects
   * Based on ScriptExecuter.Update() fade logic in C#
   */
  update(deltaTime: number): void {
    // Fade out: transparency increases to 1
    if (this.state.isInFadeOut && this.state.fadeTransparency < 1) {
      this.state.fadeTransparency += FADE_SPEED;
      if (this.state.fadeTransparency > 1) {
        this.state.fadeTransparency = 1;
      }
    }
    // Fade in: transparency decreases to 0
    else if (this.state.isInFadeIn && this.state.fadeTransparency > 0) {
      this.state.fadeTransparency -= FADE_SPEED;
      if (this.state.fadeTransparency <= 0) {
        this.state.fadeTransparency = 0;
        this.state.isInFadeIn = false;
      }
    }

    // Flash effect
    if (this.state.isFlashing) {
      this.state.flashElapsed += deltaTime;
      if (this.state.flashElapsed >= this.state.flashDuration) {
        this.state.isFlashing = false;
      }
    }
  }

  /**
   * Draw fade overlay on canvas
   * Based on ScriptExecuter.DrawFade() in C#
   */
  drawFade(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.state.fadeTransparency > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${this.state.fadeTransparency})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  /**
   * Draw flash overlay on canvas
   */
  drawFlash(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.state.isFlashing) {
      const progress = this.state.flashElapsed / this.state.flashDuration;
      const alpha = Math.max(0, 1 - progress) * (this.state.flashColor.a ?? 255) / 255;

      ctx.save();
      ctx.fillStyle = `rgba(${this.state.flashColor.r}, ${this.state.flashColor.g}, ${this.state.flashColor.b}, ${alpha})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  /**
   * Get the map tint color for rendering
   * Returns CSS color string for use with globalCompositeOperation
   */
  getMapTintColor(): Color {
    return this.state.mapDrawColor;
  }

  /**
   * Get the sprite tint color for rendering
   */
  getSpriteTintColor(): Color {
    return this.state.spriteDrawColor;
  }

  /**
   * Check if map should be tinted
   */
  isMapTinted(): boolean {
    const c = this.state.mapDrawColor;
    return c.r !== 255 || c.g !== 255 || c.b !== 255;
  }

  /**
   * Check if sprites should be tinted
   */
  isSpriteTinted(): boolean {
    const c = this.state.spriteDrawColor;
    return c.r !== 255 || c.g !== 255 || c.b !== 255;
  }

  /**
   * Get current fade transparency (0-1)
   */
  getFadeTransparency(): number {
    return this.state.fadeTransparency;
  }

  /**
   * Check if currently fading
   */
  isFading(): boolean {
    return this.state.isInFadeIn || this.state.isInFadeOut;
  }

  /**
   * Get full state for debugging
   */
  getState(): ScreenEffectsState {
    return { ...this.state };
  }
}

// Singleton instance
let screenEffectsInstance: ScreenEffects | null = null;

export function getScreenEffects(): ScreenEffects {
  if (!screenEffectsInstance) {
    screenEffectsInstance = new ScreenEffects();
  }
  return screenEffectsInstance;
}

export function resetScreenEffects(): void {
  if (screenEffectsInstance) {
    screenEffectsInstance.init();
  }
  screenEffectsInstance = null;
}
