/**
 * Screen Effects - based on JxqyHD Engine/Script/ScriptExecuter.cs
 * Handles fade in/out, color tinting, and other screen effects
 */

import type { IRenderer } from "./i-renderer";

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

  // Water ripple effect
  isWaterEffectEnabled: boolean;
  waterEffectTime: number;
}

const DEFAULT_COLOR: Color = { r: 255, g: 255, b: 255, a: 255 };
// uses 0.03 per frame at 60fps = 0.03 * 60 = 1.8 per second
// Complete fade takes ~33 frames = ~550ms
const FADE_SPEED_PER_SECOND = 1.8; // 1.0 / 0.55 seconds

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
      isWaterEffectEnabled: false,
      waterEffectTime: 0,
    };
  }

  /**
   * Start fade out effect (screen goes to black)
   * Based on ScriptExecuter.FadeOut()
   */
  fadeOut(): void {
    this.state.isInFadeOut = true;
    this.state.isInFadeIn = false;
    this.state.fadeTransparency = 0;
  }

  /**
   * Check if fade out is complete
   * Based on ScriptExecuter.IsFadeOutEnd()
   */
  isFadeOutEnd(): boolean {
    return this.state.fadeTransparency >= 1;
  }

  /**
   * Start fade in effect (screen goes from black to normal)
   * Based on ScriptExecuter.FadeIn()
   */
  fadeIn(): void {
    this.state.isInFadeOut = false;
    this.state.isInFadeIn = true;
    this.state.fadeTransparency = 1;
  }

  /**
   * Check if fade in is complete
   * Based on ScriptExecuter.IsFadeInEnd()
   */
  isFadeInEnd(): boolean {
    return !this.state.isInFadeIn;
  }

  /**
   * Set fade transparency directly (for game initialization)
   * 0 = fully transparent (normal), 1 = fully opaque (black)
   */
  setFadeTransparency(value: number): void {
    this.state.fadeTransparency = Math.max(0, Math.min(1, value));
  }

  /**
   * Set map draw color (tinting)
   * Based on ScriptExecuter.ChangeMapColor()
   */
  setMapColor(r: number, g: number, b: number): void {
    this.state.mapDrawColor = { r, g, b, a: 255 };
  }

  /**
   * Set sprite/ASF draw color (tinting)
   * Based on ScriptExecuter.ChangeAsfColor()
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
   * Based on ScriptExecuter.Init()
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
   * Based on ScriptExecuter.Update() fade logic
   * uses 0.03 per frame at 60fps, so fade completes in ~550ms
   * @param deltaTime - time elapsed in seconds
   */
  update(deltaTime: number): void {
    // deltaTime is in seconds
    const fadeStep = FADE_SPEED_PER_SECOND * deltaTime;

    // Fade out: transparency increases to 1
    if (this.state.isInFadeOut && this.state.fadeTransparency < 1) {
      this.state.fadeTransparency += fadeStep;
      if (this.state.fadeTransparency > 1) {
        this.state.fadeTransparency = 1;
      }
    }
    // Fade in: transparency decreases to 0
    else if (this.state.isInFadeIn && this.state.fadeTransparency > 0) {
      this.state.fadeTransparency -= fadeStep;
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

    // Water effect time (for animation)
    if (this.state.isWaterEffectEnabled) {
      this.state.waterEffectTime += deltaTime;
    }
  }

  /**
   * Draw fade overlay on canvas
   * Based on ScriptExecuter.DrawFade()
   */
  drawFade(renderer: IRenderer, width: number, height: number): void {
    if (this.state.fadeTransparency > 0) {
      renderer.fillRect({
        x: 0,
        y: 0,
        width,
        height,
        color: `rgba(0, 0, 0, ${this.state.fadeTransparency})`,
      });
    }
  }

  /**
   * Draw flash overlay on canvas
   */
  drawFlash(renderer: IRenderer, width: number, height: number): void {
    if (this.state.isFlashing) {
      const progress = this.state.flashElapsed / this.state.flashDuration;
      const alpha = (Math.max(0, 1 - progress) * (this.state.flashColor.a ?? 255)) / 255;

      renderer.fillRect({
        x: 0,
        y: 0,
        width,
        height,
        color: `rgba(${this.state.flashColor.r}, ${this.state.flashColor.g}, ${this.state.flashColor.b}, ${alpha})`,
      });
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
   * Check if map color is black (0,0,0) → should use grayscale shader
   * In C#: when DrawColor == Color.Black, switches to GrayScaleEffect shader
   */
  isMapGrayscale(): boolean {
    const c = this.state.mapDrawColor;
    return c.r === 0 && c.g === 0 && c.b === 0;
  }

  /**
   * Check if sprite color is black (0,0,0) → should use grayscale shader
   */
  isSpriteGrayscale(): boolean {
    const c = this.state.spriteDrawColor;
    return c.r === 0 && c.g === 0 && c.b === 0;
  }

  /**
   * Check if map should be tinted (non-white, non-black)
   * Black (0,0,0) is handled separately as grayscale
   */
  isMapTinted(): boolean {
    const c = this.state.mapDrawColor;
    if (c.r === 0 && c.g === 0 && c.b === 0) return false; // grayscale, not tint
    return c.r !== 255 || c.g !== 255 || c.b !== 255;
  }

  /**
   * Check if sprites should be tinted (non-white, non-black)
   * Black (0,0,0) is handled separately as grayscale
   */
  isSpriteTinted(): boolean {
    const c = this.state.spriteDrawColor;
    if (c.r === 0 && c.g === 0 && c.b === 0) return false; // grayscale, not tint
    return c.r !== 255 || c.g !== 255 || c.b !== 255;
  }

  /**
   * Get current fade transparency (0-1)
   */
  getFadeTransparency(): number {
    return this.state.fadeTransparency;
  }

  /**
   * 检查屏幕是否接近全黑（用于判断是否可以安全地跳转摄像机）
   * 使用 0.95 阈值是因为 FadeIn 开始后透明度会立即下降，
   * 我们需要在前几帧内仍然返回 true
   */
  isScreenBlack(): boolean {
    return this.state.fadeTransparency > 0.95;
  }

  /**
   * Check if currently fading
   */
  isFading(): boolean {
    return this.state.isInFadeIn || this.state.isInFadeOut;
  }

  // ============= Water Effect =============

  /**
   * Enable water ripple effect
   * Globals.IsWaterEffectEnabled = true
   */
  openWaterEffect(): void {
    this.state.isWaterEffectEnabled = true;
    this.state.waterEffectTime = 0;
  }

  /**
   * Disable water ripple effect
   * Globals.IsWaterEffectEnabled = false
   */
  closeWaterEffect(): void {
    this.state.isWaterEffectEnabled = false;
  }

  /**
   * Check if water effect is enabled
   */
  isWaterEffectEnabled(): boolean {
    return this.state.isWaterEffectEnabled;
  }

  /**
   * Get water effect time for animation
   */
  getWaterEffectTime(): number {
    return this.state.waterEffectTime;
  }

  /**
   * Get full state for debugging
   */
  getState(): ScreenEffectsState {
    return { ...this.state };
  }
}
