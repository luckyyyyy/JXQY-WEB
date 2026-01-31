/**
 * Audio Manager - based on JxqyHD Engine/BackgroundMusic.cs and SoundManager.cs
 * Handles background music, sound effects, and 3D spatial audio
 *
 * 3D Audio Implementation:
 * - Uses Web Audio API PannerNode for spatial positioning
 * - Matches C# SoundManager.Apply3D behavior
 * - SoundMaxDistance: 1000 pixels (beyond this, sound is silent)
 * - Sound3DMaxDistance: 8 units (Web Audio coordinate scale)
 */

import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { resourceLoader } from "../resource/resourceLoader";
import { DefaultPaths } from "@/config/resourcePaths";

export interface AudioManagerConfig {
  musicBasePath?: string;
  soundBasePath?: string;
  masterVolume?: number;
  musicVolume?: number;
  soundVolume?: number;
  ambientVolume?: number;
}

/**
 * 3D Sound instance for spatial audio
 * C# Reference: SoundEffectInstance with Apply3D
 */
export interface Sound3DInstance {
  source: AudioBufferSourceNode;
  panner: PannerNode;
  gainNode: GainNode;
  isLooping: boolean;
}

// Constants matching C# Globals
const SOUND_MAX_DISTANCE = 1000; // Pixels - max distance for sound to be heard
const SOUND_3D_MAX_DISTANCE = 8; // Web Audio units - scale factor for panner

export class AudioManager {
  private musicBasePath: string;
  private soundBasePath: string;

  // Master volume controls
  private masterVolume: number = 1.0;
  private musicVolume: number = 0.7;
  private soundVolume: number = 1.0;
  private ambientVolume: number = 1.0;

  // Current music
  private currentMusicFile: string = "";
  private musicElement: HTMLAudioElement | null = null;
  private isMusicPaused: boolean = false;
  private isMusicDisabled: boolean = false; // 用户主动禁用音乐
  private isAmbientDisabled: boolean = false; // 用户主动禁用环境音
  private musicRequestId: number = 0; // Used to handle race conditions in async music loading
  private musicBlocked: boolean = false; // 音乐被浏览器自动播放策略阻止

  // Autoplay state
  private autoplayEnabled: boolean = false;
  private autoplayRequested: boolean = false;

  // Active sounds for stopAllSounds
  private activeSounds: Set<HTMLAudioElement> = new Set();

  // Looping sound effect (e.g., walk/run sounds)
  // C# Reference: Character._sound (SoundEffectInstance with IsLooped = true)
  private loopingSoundElement: HTMLAudioElement | null = null;
  private loopingSoundFile: string = "";

  // Web Audio API context for precise fade out
  private audioContext: AudioContext | null = null;

  constructor(config: AudioManagerConfig = {}) {
    this.musicBasePath = config.musicBasePath || DefaultPaths.musicBasePath;
    this.soundBasePath = config.soundBasePath || DefaultPaths.soundBasePath;
    this.masterVolume = config.masterVolume ?? 1.0;
    this.musicVolume = config.musicVolume ?? 0.7;
    this.soundVolume = config.soundVolume ?? 1.0;
    this.ambientVolume = config.ambientVolume ?? 1.0;

    // Request autoplay permission on first user interaction
    this.setupAutoplayRequest();
  }

  /**
   * Setup autoplay permission request
   *
   * 简化方案：不做额外测试，直接在播放音乐时判断
   * - 播放成功 → autoplayEnabled = true
   * - 播放失败且 NotAllowedError → 等待用户交互
   */
  private setupAutoplayRequest(): void {
    // 只注册用户交互监听器，用于解锁被阻止的自动播放
    const enableAutoplay = () => {
      if (!this.autoplayRequested) {
        this.autoplayRequested = true;
        this.autoplayEnabled = true;
        logger.log("[AudioManager] Autoplay unlocked via user interaction");

        // 如果有等待播放的音乐，现在播放
        if (this.currentMusicFile && !this.isMusicDisabled && !this.musicElement) {
          this.playMusic(this.currentMusicFile);
        }
      }
    };

    const events = ["click", "touchstart", "keydown"];
    events.forEach((event) => {
      document.addEventListener(event, enableAutoplay, { once: true, passive: true });
    });
  }

  /**
   * Play background music
   * Based on BackgroundMusic.Play() in C#
   */
  playMusic(fileName: string): void {
    if (!fileName) {
      this.stopMusic();
      return;
    }

    // 如果音乐被禁用，只记录但不播放
    if (this.isMusicDisabled) {
      // 只更新当前音乐文件名，以便启用时可以播放
      // Normalize to lowercase for consistent file loading
      const baseName = fileName.replace(/\.(mp3|wma|ogg|wav)$/i, "").toLowerCase();
      this.currentMusicFile = baseName;
      logger.log(`[AudioManager] Music disabled, storing music file: ${baseName}`);
      return;
    }

    // Normalize filename - remove extension and convert to lowercase
    const baseName = fileName.replace(/\.(mp3|wma|ogg|wav)$/i, "").toLowerCase();

    // If same music is already playing, don't restart
    if (
      this.currentMusicFile.toLowerCase() === baseName.toLowerCase() &&
      this.musicElement &&
      !this.isMusicPaused
    ) {
      return;
    }

    // Stop current music completely
    this.stopMusic();

    this.currentMusicFile = baseName;

    // Generate a unique request ID to handle race conditions
    const requestId = ++this.musicRequestId;

    // Try OGG first, then MP3
    this.tryLoadMusic(baseName, [".ogg", ".mp3"], 0, requestId);

    this.isMusicPaused = false;
  }

  /**
   * Try to load music with different formats
   */
  private tryLoadMusic(
    baseName: string,
    formats: string[],
    index: number,
    requestId: number
  ): void {
    if (index >= formats.length) {
      logger.warn(`[AudioManager] Failed to load music: ${baseName} (tried all formats)`);
      return;
    }

    const ext = formats[index];
    const musicPath = `${this.musicBasePath}/${baseName}${ext}`;

    const audio = new Audio();
    audio.loop = true;
    audio.volume = this.masterVolume * this.musicVolume;
    audio.preload = "auto";

    audio.onerror = () => {
      // Try next format
      this.tryLoadMusic(baseName, formats, index + 1, requestId);
    };

    audio.oncanplaythrough = () => {
      // Check if this request is still valid before playing
      if (requestId !== this.musicRequestId) {
        // This request was superseded, clean up this audio element
        audio.pause();
        audio.src = "";
        return;
      }

      // Stop any existing music element (in case of race condition)
      if (this.musicElement && this.musicElement !== audio) {
        this.musicElement.pause();
        this.musicElement.currentTime = 0;
        this.musicElement.src = "";
      }

      this.musicElement = audio;
      audio
        .play()
        .then(() => {
          // 播放成功，说明允许自动播放
          this.musicBlocked = false;
          if (!this.autoplayEnabled) {
            this.autoplayEnabled = true;
            this.autoplayRequested = true;
            logger.debug("[AudioManager] Autoplay allowed (music playing)");
          }
        })
        .catch((e) => {
          if (e.name === "NotAllowedError") {
            this.musicBlocked = true;
            logger.log(
              "[AudioManager] Music blocked by autoplay policy, waiting for user interaction"
            );
          } else {
            logger.warn("[AudioManager] Failed to play music:", e.message);
          }
        });
    };

    audio.src = musicPath;
    audio.load();
  }

  /**
   * Stop background music
   * Based on BackgroundMusic.Stop() in C#
   */
  stopMusic(): void {
    // Invalidate any pending music load requests
    this.musicRequestId++;

    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
      // Clear the src to fully release the audio resource
      this.musicElement.src = "";
      this.musicElement = null;
    }
    this.currentMusicFile = "";
    this.isMusicPaused = false;
  }

  /**
   * Pause background music
   * Based on BackgroundMusic.Pause() in C#
   */
  pauseMusic(): void {
    if (this.musicElement && !this.isMusicPaused) {
      this.musicElement.pause();
      this.isMusicPaused = true;
    }
  }

  /**
   * Resume background music
   * Based on BackgroundMusic.Resume() in C#
   */
  resumeMusic(): void {
    if (this.isMusicDisabled) {
      // 如果音乐被禁用，启用它
      this.isMusicDisabled = false;
      // 尝试播放当前存储的音乐文件
      if (this.currentMusicFile) {
        this.playMusic(this.currentMusicFile);
      }
      return;
    }

    if (this.musicElement && this.isMusicPaused) {
      this.musicElement.play().catch(() => {});
      this.isMusicPaused = false;
    }
  }

  /**
   * Enable or disable music
   * When disabled, music will stop and won't play until enabled again
   */
  setMusicEnabled(enabled: boolean): void {
    this.isMusicDisabled = !enabled;

    if (!enabled) {
      // 停止当前播放（但保留 currentMusicFile 以便恢复）
      if (this.musicElement) {
        this.musicElement.pause();
        this.musicElement.currentTime = 0;
        this.musicElement.src = "";
        this.musicElement = null;
      }
    } else {
      // 恢复播放存储的音乐
      if (this.currentMusicFile) {
        this.playMusic(this.currentMusicFile);
      }
    }
  }

  /**
   * Check if music is enabled
   */
  isMusicEnabled(): boolean {
    return !this.isMusicDisabled;
  }

  /**
   * Check if autoplay is allowed by the browser
   * Returns true if:
   * - Autoplay is enabled, OR
   * - Music is disabled (no need to show the prompt)
   */
  isAutoplayAllowed(): boolean {
    return this.autoplayEnabled || this.isMusicDisabled;
  }

  /**
   * Request autoplay permission by attempting to play current music
   * Should be called from a user interaction (click handler)
   * Returns true if permission was granted
   */
  async requestAutoplayPermission(): Promise<boolean> {
    if (this.autoplayEnabled) {
      return true;
    }

    try {
      // 如果有当前音乐，直接尝试播放
      if (this.currentMusicFile && !this.isMusicDisabled) {
        // 重新播放当前音乐（强制）
        const currentMusic = this.currentMusicFile;
        this.currentMusicFile = ""; // 清空以绕过"已在播放"检查
        this.playMusic(currentMusic);
      }

      // 标记为已启用
      this.autoplayEnabled = true;
      this.autoplayRequested = true;

      logger.log("[AudioManager] Autoplay unlocked via user interaction");
      return true;
    } catch (error) {
      logger.warn("[AudioManager] Failed to unlock autoplay:", error);
      return false;
    }
  }

  /**
   * Set music volume
   * 当音量 > 0 时，如果音乐被阻止会尝试恢复播放
   */
  setMusicVolume(volume: number): void {
    const prevVolume = this.musicVolume;
    this.musicVolume = Math.max(0, Math.min(1, volume));

    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;

      // 如果音乐之前被阻止，用户调整音量时尝试恢复播放
      if (this.musicBlocked && this.musicVolume > 0) {
        this.musicElement
          .play()
          .then(() => {
            this.musicBlocked = false;
            this.autoplayEnabled = true;
            logger.log("[AudioManager] Music resumed after user interaction");
          })
          .catch(() => {});
      }
    } else if (prevVolume === 0 && this.musicVolume > 0 && this.currentMusicFile) {
      // 音量从 0 变为 > 0，尝试播放待播放的音乐
      this.playMusic(this.currentMusicFile);
    }
  }

  /**
   * Get music volume
   */
  getMusicVolume(): number {
    return this.musicVolume;
  }

  /**
   * Get current music file name
   */
  getCurrentMusicFile(): string {
    return this.currentMusicFile;
  }

  /**
   * Play a sound effect
   * Based on SoundManager functionality
   */
  playSound(fileName: string): void {
    if (!fileName) {
      return;
    }

    // Normalize filename - remove extension and convert to lowercase
    const baseName = fileName.replace(/\.(wav|mp3|ogg|xnb)$/i, "").toLowerCase();

    // 直接播放，所有音效都是 .ogg 格式
    this.playSoundInstanceByName(baseName, ".ogg");
  }

  /**
   * Get or create AudioContext for Web Audio API
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    return this.audioContext;
  }

  /**
   * Play a sound instance using Web Audio API with buffer for precise control
   * This prevents audio pop/click at the end of OGG files
   */
  private playSoundInstanceByName(baseName: string, ext: string): void {
    const volume = this.masterVolume * this.soundVolume;

    // 直接构造路径，避免从 audio.src 反向解析
    const soundPath = `${this.soundBasePath}/${baseName}${ext}`;

    // Load and play audio buffer (resourceLoader handles caching)
    this.loadAndPlayAudioBuffer(soundPath, volume);
  }

  /**
   * Load audio file into buffer and play it
   * Uses resourceLoader.loadAudio which handles caching
   */
  private async loadAndPlayAudioBuffer(src: string, volume: number): Promise<void> {
    try {
      const audioContext = this.getAudioContext();

      // Resume context if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // 使用 resourceLoader.loadAudio 直接获取 AudioBuffer（已缓存）
      // resourceLoader 内部已有失败缓存，不会重复请求不存在的文件
      const audioBuffer = await resourceLoader.loadAudio(src);
      if (!audioBuffer) {
        // 加载失败直接返回，resourceLoader 会缓存失败结果避免重复请求
        return;
      }

      // Play the buffer
      this.playAudioBuffer(audioBuffer, volume);
    } catch (error) {
      // 其他错误（如 AudioContext 问题）
      logger.warn(
        `[AudioManager] Web Audio error: ${error instanceof Error ? error.message : error}`
      );
      this.playAudioFallback(src, volume);
    }
  }

  /**
   * Play an AudioBuffer with fade in/out to avoid OGG pop at start/end
   */
  private playAudioBuffer(buffer: AudioBuffer, volume: number): void {
    try {
      const audioContext = this.getAudioContext();

      // Resume context if suspended
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      const gainNode = audioContext.createGain();

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Fade in/out durations to avoid pop/click
      const fadeInDuration = 0.015; // 15ms fade in at start
      const fadeOutDuration = 0.02; // 20ms fade out at end
      const trimStart = 0.01; // Skip first 10ms (may have noise)
      const trimEnd = 0.03; // Skip last 30ms (may have noise)

      const effectiveDuration = Math.max(0.1, buffer.duration - trimStart - trimEnd);
      const currentTime = audioContext.currentTime;

      // Fade in: start at 0, ramp to volume
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, currentTime + fadeInDuration);

      // Fade out: ramp to 0 before end
      const fadeOutStart = currentTime + effectiveDuration - fadeOutDuration;
      gainNode.gain.setValueAtTime(volume, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, fadeOutStart + fadeOutDuration);

      // Start playback from trimStart offset, stop at effective end
      source.start(0, trimStart);
      source.stop(currentTime + effectiveDuration);
    } catch (error) {
      logger.warn(`[AudioManager] playAudioBuffer error: ${error}`);
    }
  }

  /**
   * Fallback audio playback using HTML Audio element
   */
  private playAudioFallback(src: string, volume: number): void {
    const audio = new Audio(src);
    audio.volume = volume;
    this.activeSounds.add(audio);

    audio.onended = () => {
      this.activeSounds.delete(audio);
    };

    audio.play().catch(() => {
      this.activeSounds.delete(audio);
    });
  }

  /**
   * Stop all sound effects
   */
  stopAllSounds(): void {
    for (const sound of this.activeSounds) {
      sound.pause();
      sound.currentTime = 0;
    }
    this.activeSounds.clear();
    // Also stop looping sound
    this.stopLoopingSound();
  }

  /**
   * Play a looping sound effect (e.g., walk/run sounds)
   * C# Reference: Character._sound with IsLooped = true
   * Only one looping sound can play at a time (per character)
   */
  playLoopingSound(fileName: string): void {
    if (!fileName) {
      this.stopLoopingSound();
      return;
    }

    // Normalize filename
    const baseName = fileName.replace(/\.(wav|mp3|ogg|xnb)$/i, "").toLowerCase();

    // If same sound is already playing, don't restart
    // Check loopingSourceNode (Web Audio API) instead of loopingSoundElement
    if (this.loopingSoundFile === baseName && this.loopingSourceNode) {
      return;
    }

    // Stop current looping sound
    this.stopLoopingSound();

    this.loopingSoundFile = baseName;

    // Try to load and play the looping sound
    this.tryLoadLoopingSound(baseName, [".ogg", ".mp3", ".wav"], 0);
  }

  /**
   * Try to load looping sound with different formats
   * Uses Web Audio API for seamless looping with fade to avoid OGG tail pop
   */
  private tryLoadLoopingSound(baseName: string, formats: string[], index: number): void {
    if (index >= formats.length) {
      this.loopingSoundFile = "";
      return;
    }

    const ext = formats[index];
    const soundPath = `${this.soundBasePath}/${baseName}${ext}`;

    // Use Web Audio API for better loop control
    this.loadLoopingSoundWithWebAudio(baseName, soundPath, formats, index);
  }

  /**
   * Load and play looping sound using Web Audio API
   * This handles the OGG tail pop issue by trimming the end
   */
  private async loadLoopingSoundWithWebAudio(
    baseName: string,
    soundPath: string,
    formats: string[],
    formatIndex: number
  ): Promise<void> {
    try {
      const audioContext = this.getAudioContext();

      // Resume context if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Use resourceLoader.loadAudio for proper caching and stats tracking
      const audioBuffer = await resourceLoader.loadAudio(soundPath);
      if (!audioBuffer) {
        throw new Error(`Failed to load audio: ${soundPath}`);
      }

      // Check if we still want this sound
      if (this.loopingSoundFile !== baseName) {
        return;
      }

      // Stop any existing looping sound
      this.stopLoopingSoundInternal();

      // Trim start and end to avoid OGG conversion artifacts (pop/click)
      const trimStart = 0.01; // Skip first 10ms
      const trimEnd = 0.05; // Skip last 50ms
      const effectiveDuration = Math.max(0.1, audioBuffer.duration - trimStart - trimEnd);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.loopStart = trimStart; // Start loop after initial noise
      source.loopEnd = trimStart + effectiveDuration; // End loop before tail noise

      const gainNode = audioContext.createGain();
      // Boost looping sound (footsteps) volume significantly - player's own sounds should be prominent
      const volume = this.masterVolume * this.soundVolume * 2.5;

      // Fade in at start to avoid pop (100ms)
      const currentTime = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.1);

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Start from trimStart offset
      source.start(0, trimStart);

      // Store references for later cleanup
      this.loopingSourceNode = source;
      this.loopingGainNode = gainNode;

      logger.log(
        `[AudioManager] Playing looping sound: ${baseName} (duration: ${audioBuffer.duration.toFixed(2)}s, loop: ${trimStart.toFixed(2)}s - ${(trimStart + effectiveDuration).toFixed(2)}s)`
      );
    } catch (_error) {
      // Try next format
      this.tryLoadLoopingSound(baseName, formats, formatIndex + 1);
    }
  }

  // Web Audio API nodes for looping sound
  private loopingSourceNode: AudioBufferSourceNode | null = null;
  private loopingGainNode: GainNode | null = null;

  /**
   * Internal method to stop looping sound (Web Audio API version) with fade out
   */
  private stopLoopingSoundInternal(): void {
    if (this.loopingSourceNode && this.loopingGainNode) {
      const sourceNode = this.loopingSourceNode;
      const gainNode = this.loopingGainNode;

      // Clear references immediately
      this.loopingSourceNode = null;
      this.loopingGainNode = null;

      try {
        // Fade out to avoid pop (100ms)
        const audioContext = this.audioContext;
        if (audioContext) {
          const currentTime = audioContext.currentTime;
          const currentGain = gainNode.gain.value;
          gainNode.gain.setValueAtTime(currentGain, currentTime);
          gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.1);

          // Stop after fade out completes
          setTimeout(() => {
            try {
              sourceNode.stop();
              sourceNode.disconnect();
              gainNode.disconnect();
            } catch {
              // Ignore errors if already stopped
            }
          }, 120);
        } else {
          sourceNode.stop();
          sourceNode.disconnect();
          gainNode.disconnect();
        }
      } catch {
        // Ignore errors if already stopped
      }
    } else {
      // Handle case where only one exists
      if (this.loopingSourceNode) {
        try {
          this.loopingSourceNode.stop();
          this.loopingSourceNode.disconnect();
        } catch {
          // Ignore
        }
        this.loopingSourceNode = null;
      }
      if (this.loopingGainNode) {
        try {
          this.loopingGainNode.disconnect();
        } catch {
          // Ignore
        }
        this.loopingGainNode = null;
      }
    }
    // Also stop HTML Audio element if exists (fallback)
    if (this.loopingSoundElement) {
      this.loopingSoundElement.pause();
      this.loopingSoundElement.currentTime = 0;
      this.loopingSoundElement = null;
    }
  }

  /**
   * Stop the current looping sound
   * C# Reference: Character._sound.Stop(true)
   */
  stopLoopingSound(): void {
    this.stopLoopingSoundInternal();
    this.loopingSoundFile = "";
  }

  /**
   * Check if a looping sound is currently playing
   */
  isLoopingSoundPlaying(): boolean {
    // Check Web Audio API source node (primary) or HTML Audio element (fallback)
    return (
      this.loopingSourceNode !== null ||
      (this.loopingSoundElement !== null && !this.loopingSoundElement.paused)
    );
  }

  /**
   * Set sound effect volume
   * Only affects regular sound effects and looping sounds (footsteps)
   * 3D ambient sounds use ambientVolume instead
   */
  setSoundVolume(volume: number): void {
    this.soundVolume = Math.max(0, Math.min(1, volume));

    // Update looping sound volume (walk/run sounds)
    if (this.loopingGainNode) {
      this.loopingGainNode.gain.value = this.masterVolume * this.soundVolume * 2.5;
    }
  }

  /**
   * Get sound effect volume
   */
  getSoundVolume(): number {
    return this.soundVolume;
  }

  /**
   * Set ambient sound volume (3D environmental sounds)
   * Updates currently playing 3D ambient sounds
   */
  setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));

    // Update all 3D ambient sound volumes
    if (!this.isAmbientDisabled) {
      for (const instance of this.sound3DInstances.values()) {
        instance.gainNode.gain.value = this.masterVolume * this.ambientVolume;
      }
    }
  }

  /**
   * Get ambient sound volume
   */
  getAmbientVolume(): number {
    return this.ambientVolume;
  }

  /**
   * Set ambient sound enabled state
   */
  setAmbientEnabled(enabled: boolean): void {
    this.isAmbientDisabled = !enabled;

    if (!enabled) {
      // Stop all 3D ambient sounds
      this.stopAll3DSounds();
    }
    // If enabled, sounds will start playing on next update cycle
  }

  /**
   * Check if ambient sounds are enabled
   */
  isAmbientEnabled(): boolean {
    return !this.isAmbientDisabled;
  }

  /**
   * Set master volume
   * Updates music, looping sounds, and 3D sounds
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));

    // Update music volume
    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;
    }

    // Update looping sound volume (walk/run sounds) with boost
    if (this.loopingGainNode) {
      this.loopingGainNode.gain.value = this.masterVolume * this.soundVolume * 2.5;
    }

    // Update all 3D ambient sound volumes
    if (!this.isAmbientDisabled) {
      for (const instance of this.sound3DInstances.values()) {
        instance.gainNode.gain.value = this.masterVolume * this.ambientVolume;
      }
    }
  }

  /**
   * Get master volume
   */
  getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopMusic();
    this.stopAllSounds();
    this.stopAll3DSounds();
    this.sound3DInstances.clear();
    this.sound3DLoading.clear();
    this.sound3DStopping.clear();
  }

  // ============= 3D Spatial Audio =============
  // C# Reference: SoundManager.cs - Play3DSoundOnece, Apply3D

  // Active 3D sound instances (for looping sounds like LoopingSound objects)
  private sound3DInstances: Map<string, Sound3DInstance> = new Map();

  // IDs of sounds currently being loaded (to prevent duplicate loading)
  private sound3DLoading: Set<string> = new Set();

  // IDs of sounds currently being stopped/fading out (to prevent restart during fade)
  private sound3DStopping: Set<string> = new Set();

  // IDs of random sounds currently playing (to prevent overlapping, matching C# SoundEffectInstance behavior)
  private sound3DRandomPlaying: Set<string> = new Set();

  // Listener position (player position in world)
  private listenerPosition: Vector2 = { x: 0, y: 0 };

  /**
   * Set the listener position (usually the player's position)
   * C# Reference: Globals.ListenerPosition = ThePlayer.PositionInWorld
   */
  setListenerPosition(position: Vector2): void {
    this.listenerPosition = { x: position.x, y: position.y };
  }

  /**
   * Get the listener position
   */
  getListenerPosition(): Vector2 {
    return this.listenerPosition;
  }

  /**
   * Play a 3D positioned sound once
   * C# Reference: SoundManager.Play3DSoundOnece(SoundEffect, Vector2 direction)
   *
   * @param fileName Sound file name
   * @param emitterPosition Position of the sound emitter in world coordinates
   */
  async play3DSoundOnce(fileName: string, emitterPosition: Vector2): Promise<void> {
    if (!fileName) return;

    // Skip if ambient sounds are disabled
    if (this.isAmbientDisabled) return;

    const baseName = fileName.replace(/\.(wav|mp3|ogg|xnb)$/i, "").toLowerCase();
    const direction = {
      x: emitterPosition.x - this.listenerPosition.x,
      y: emitterPosition.y - this.listenerPosition.y,
    };

    // Check distance - if too far, don't play
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (distance > SOUND_MAX_DISTANCE) {
      return; // Too far to hear
    }

    try {
      const audioContext = this.getAudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Get or load the audio buffer
      const buffer = await this.loadAudioBuffer(baseName);
      if (!buffer) return;

      // Create source and connect to panner
      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      const panner = this.createPannerNode(audioContext, direction);
      const gainNode = audioContext.createGain();
      const targetVolume = this.masterVolume * this.ambientVolume;

      // Fade in to avoid pop/click (150ms)
      const currentTime = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + 0.15);

      // Fade out at the end to avoid pop (150ms before end)
      const fadeOutStart = Math.max(0.15, buffer.duration - 0.15);
      gainNode.gain.setValueAtTime(targetVolume, currentTime + fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + buffer.duration);

      source.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.start(0);
    } catch (error) {
      logger.warn(`[AudioManager] Failed to play 3D sound: ${fileName}`, error);
    }
  }

  /**
   * Play a looping 3D sound (for LoopingSound objects)
   * C# Reference: Obj with Kind=LoopingSound plays sound continuously with Apply3D
   *
   * @param id Unique identifier for this sound instance
   * @param fileName Sound file name
   * @param emitterPosition Position of the sound emitter
   */
  async play3DSoundLoop(id: string, fileName: string, emitterPosition: Vector2): Promise<void> {
    if (!fileName) return;

    // Skip if ambient sounds are disabled
    if (this.isAmbientDisabled) return;

    // If same sound is already playing for this id, just update position
    const existing = this.sound3DInstances.get(id);
    if (existing) {
      this.update3DSoundPosition(id, emitterPosition);
      return;
    }

    // If this sound is currently being loaded, skip
    if (this.sound3DLoading.has(id)) {
      return;
    }

    // If this sound is currently being stopped (fading out), skip
    if (this.sound3DStopping.has(id)) {
      return;
    }

    // Calculate distance to check if within hearing range
    const direction = {
      x: emitterPosition.x - this.listenerPosition.x,
      y: emitterPosition.y - this.listenerPosition.y,
    };
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);

    // Don't start sound if too far away
    if (distance > SOUND_MAX_DISTANCE) {
      return;
    }

    // Mark as loading to prevent duplicate loads
    this.sound3DLoading.add(id);

    const baseName = fileName.replace(/\.(wav|mp3|ogg|xnb)$/i, "").toLowerCase();

    try {
      const audioContext = this.getAudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Get or load the audio buffer
      const buffer = await this.loadAudioBuffer(baseName);
      if (!buffer) {
        this.sound3DLoading.delete(id);
        return;
      }

      // Re-check if another instance was created while loading
      if (this.sound3DInstances.has(id)) {
        this.sound3DLoading.delete(id);
        return;
      }

      // Re-calculate direction (listener may have moved during load)
      const currentDirection = {
        x: emitterPosition.x - this.listenerPosition.x,
        y: emitterPosition.y - this.listenerPosition.y,
      };

      // Create source with looping
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Trim loop to avoid OGG artifacts
      const trimStart = 0.01;
      const trimEnd = 0.05;
      const effectiveDuration = Math.max(0.1, buffer.duration - trimStart - trimEnd);
      source.loopStart = trimStart;
      source.loopEnd = trimStart + effectiveDuration;

      const panner = this.createPannerNode(audioContext, currentDirection);
      const gainNode = audioContext.createGain();
      const targetVolume = this.masterVolume * this.ambientVolume;

      // Fade in to avoid pop/click (300ms for smooth transition)
      const currentTime = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + 0.3);

      source.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(audioContext.destination);

      source.start(0, trimStart);

      // Store the instance
      this.sound3DInstances.set(id, {
        source,
        panner,
        gainNode,
        isLooping: true,
      });

      // Remove from loading set now that it's playing
      this.sound3DLoading.delete(id);

      logger.debug(`[AudioManager] Started 3D looping sound: ${baseName} (id: ${id})`);
    } catch (error) {
      // Clean up loading set on error
      this.sound3DLoading.delete(id);
      logger.warn(`[AudioManager] Failed to play 3D looping sound: ${fileName}`, error);
    }
  }

  /**
   * Update the position of a 3D sound
   * C# Reference: SoundManager.Apply3D called in Obj.UpdateSound()
   *
   * @param id Sound instance identifier
   * @param emitterPosition New emitter position
   */
  update3DSoundPosition(id: string, emitterPosition: Vector2): void {
    const instance = this.sound3DInstances.get(id);
    if (!instance) return;

    const direction = {
      x: emitterPosition.x - this.listenerPosition.x,
      y: emitterPosition.y - this.listenerPosition.y,
    };

    this.apply3DPosition(instance.panner, direction);
  }

  /**
   * Stop a 3D sound by id with fade out to prevent pop
   */
  stop3DSound(id: string): void {
    // Also remove from loading set if it was being loaded
    this.sound3DLoading.delete(id);

    // If already stopping, ignore
    if (this.sound3DStopping.has(id)) {
      return;
    }

    const instance = this.sound3DInstances.get(id);
    if (instance) {
      // Mark as stopping to prevent restart during fade-out
      this.sound3DStopping.add(id);
      // Remove from active instances
      this.sound3DInstances.delete(id);

      try {
        // Fade out to avoid pop (300ms for smooth transition)
        const audioContext = this.audioContext;
        if (audioContext) {
          const currentTime = audioContext.currentTime;
          const currentGain = instance.gainNode.gain.value;
          instance.gainNode.gain.setValueAtTime(currentGain, currentTime);
          instance.gainNode.gain.linearRampToValueAtTime(0, currentTime + 0.3);

          // Stop after fade out completes
          setTimeout(() => {
            try {
              instance.source.stop();
              instance.source.disconnect();
              instance.panner.disconnect();
              instance.gainNode.disconnect();
            } catch {
              // Ignore errors if already stopped
            }
            // Remove from stopping set after fully stopped
            this.sound3DStopping.delete(id);
          }, 350);
        } else {
          // No audio context, stop immediately
          instance.source.stop();
          instance.source.disconnect();
          instance.panner.disconnect();
          instance.gainNode.disconnect();
          this.sound3DStopping.delete(id);
        }
      } catch {
        // Ignore errors if already stopped
        this.sound3DStopping.delete(id);
      }
    }
  }

  /**
   * Stop all 3D sounds
   */
  stopAll3DSounds(): void {
    for (const [id] of this.sound3DInstances) {
      this.stop3DSound(id);
    }
    this.sound3DInstances.clear();
    this.sound3DLoading.clear();
    this.sound3DStopping.clear();
    this.sound3DRandomPlaying.clear();
  }

  /**
   * Play a random 3D sound (for RandSound objects)
   * C# Reference: Obj.Update() calls UpdateSound() then PlayRandSound()
   *
   * Key C# behavior:
   * - _soundInstance is a persistent SoundEffectInstance
   * - Play() on SoundEffectInstance does NOT restart if already playing
   * - UpdateSound() updates 3D position every frame
   * - PlayRandSound() has 1/200 chance to call Play()
   *
   * @param id Sound instance identifier (unique per object)
   * @param fileName Sound file name
   * @param emitterPosition Position of the sound emitter
   * @param probability Probability to play (0-1), default 1/200 = 0.005
   */
  async play3DSoundRandom(
    id: string,
    fileName: string,
    emitterPosition: Vector2,
    probability: number = 0.005
  ): Promise<void> {
    if (!fileName) return;

    // Skip if ambient sounds are disabled
    if (this.isAmbientDisabled) return;

    // C# behavior: If sound is already playing, don't restart - just update position
    // This prevents overlapping sounds from the same object
    if (this.sound3DRandomPlaying.has(id)) {
      return;
    }

    // Check distance first (UpdateSound in C# always updates position)
    const direction = {
      x: emitterPosition.x - this.listenerPosition.x,
      y: emitterPosition.y - this.listenerPosition.y,
    };
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (distance > SOUND_MAX_DISTANCE) {
      return; // Too far to hear
    }

    // Random check (C#: Globals.TheRandom.Next(0, 200) == 0)
    if (Math.random() > probability) {
      return; // Didn't trigger this time
    }

    // Mark as playing before async operation
    this.sound3DRandomPlaying.add(id);

    try {
      const audioContext = this.getAudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const baseName = fileName.replace(/\.(wav|mp3|ogg|xnb)$/i, "").toLowerCase();

      // Get or load the audio buffer
      const buffer = await this.loadAudioBuffer(baseName);
      if (!buffer) {
        this.sound3DRandomPlaying.delete(id);
        return;
      }

      // Create source and connect to panner
      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      const panner = this.createPannerNode(audioContext, direction);
      const gainNode = audioContext.createGain();
      const targetVolume = this.masterVolume * this.ambientVolume;

      // Fade in to avoid pop/click (150ms)
      const currentTime = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0, currentTime);
      gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + 0.15);

      // Fade out at the end to avoid pop (150ms before end)
      const fadeOutStart = Math.max(0.15, buffer.duration - 0.15);
      gainNode.gain.setValueAtTime(targetVolume, currentTime + fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, currentTime + buffer.duration);

      source.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // When sound ends, remove from playing set
      source.onended = () => {
        this.sound3DRandomPlaying.delete(id);
      };

      source.start(0);
    } catch (error) {
      this.sound3DRandomPlaying.delete(id);
      logger.warn(`[AudioManager] Failed to play random 3D sound: ${fileName}`, error);
    }
  }

  /**
   * Create a PannerNode with proper 3D settings
   * C# Reference: SoundManager.Apply3D uses AudioListener/AudioEmitter
   */
  private createPannerNode(audioContext: AudioContext, direction: Vector2): PannerNode {
    const panner = audioContext.createPanner();

    // Set panner model to HRTF for realistic 3D audio
    panner.panningModel = "HRTF";
    panner.distanceModel = "linear";
    panner.refDistance = 1;
    panner.maxDistance = SOUND_3D_MAX_DISTANCE;
    panner.rolloffFactor = 1;

    // Cone settings (omnidirectional)
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1;

    // Apply position
    this.apply3DPosition(panner, direction);

    return panner;
  }

  /**
   * Apply 3D position to a PannerNode
   * C# Reference: SoundManager.Apply3D logic
   *
   * In C#:
   * - If distance > SoundMaxDistance, position emitter at (999999, 999999, 999999)
   * - Otherwise, normalize direction and scale by (percent * Sound3DMaxDistance)
   * - Listener is always at origin
   */
  private apply3DPosition(panner: PannerNode, direction: Vector2): void {
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);

    if (distance === 0) {
      // Sound at listener position
      panner.positionX.value = 0;
      panner.positionY.value = 0;
      panner.positionZ.value = 0;
    } else if (distance > SOUND_MAX_DISTANCE) {
      // Too far - move emitter very far away (effectively silent)
      panner.positionX.value = 999999;
      panner.positionY.value = 0;
      panner.positionZ.value = 999999;
    } else {
      // Calculate scaled position
      // C#: percent = length / SoundMaxDistance
      // C#: emitter.Position = new Vector3(direction.X * percent * Sound3DMaxDistance, 0, direction.Y * percent * Sound3DMaxDistance)
      const percent = distance / SOUND_MAX_DISTANCE;
      const normalizedX = direction.x / distance;
      const normalizedY = direction.y / distance;
      const scaledDistance = percent * SOUND_3D_MAX_DISTANCE;

      // Web Audio uses right-handed coordinate system
      // X: left(-) to right(+)
      // Y: down(-) to up(+)
      // Z: front(+) to back(-)
      // Map game X to audio X, game Y to audio Z (depth)
      panner.positionX.value = normalizedX * scaledDistance;
      panner.positionY.value = 0;
      panner.positionZ.value = normalizedY * scaledDistance;
    }
  }

  /**
   * Load audio buffer for a sound file
   * Uses resourceLoader.loadAudio for caching (including failure caching)
   */
  private async loadAudioBuffer(baseName: string): Promise<AudioBuffer | null> {
    const formats = [".ogg", ".mp3", ".wav"];

    for (const ext of formats) {
      const soundPath = `${this.soundBasePath}/${baseName}${ext}`;
      const audioBuffer = await resourceLoader.loadAudio(soundPath);
      if (audioBuffer) return audioBuffer;
    }

    return null;
  }

  /**
   * Update all 3D sounds (call this in game loop)
   * Updates panner positions based on current listener position
   */
  updateAll3DSounds(): void {
    // This is called by ObjManager which passes individual positions
    // Nothing to do here as positions are updated per-object
  }
}
