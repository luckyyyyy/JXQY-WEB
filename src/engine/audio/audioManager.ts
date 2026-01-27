/**
 * Audio Manager - based on JxqyHD Engine/BackgroundMusic.cs and SoundManager.cs
 * Handles background music and sound effects
 */

export interface AudioManagerConfig {
  musicBasePath?: string;
  soundBasePath?: string;
  masterVolume?: number;
  musicVolume?: number;
  soundVolume?: number;
}

export class AudioManager {
  private musicBasePath: string;
  private soundBasePath: string;

  // Master volume controls
  private masterVolume: number = 1.0;
  private musicVolume: number = 0.7;
  private soundVolume: number = 1.0;

  // Current music
  private currentMusicFile: string = "";
  private musicElement: HTMLAudioElement | null = null;
  private isMusicPaused: boolean = false;
  private isMusicDisabled: boolean = false; // 用户主动禁用音乐
  private musicRequestId: number = 0; // Used to handle race conditions in async music loading

  // Autoplay state
  private autoplayEnabled: boolean = false;
  private autoplayRequested: boolean = false;

  // Sound effects cache
  private soundCache: Map<string, HTMLAudioElement> = new Map();
  private activeSounds: Set<HTMLAudioElement> = new Set();

  // Web Audio API context for precise fade out
  private audioContext: AudioContext | null = null;

  constructor(config: AudioManagerConfig = {}) {
    this.musicBasePath = config.musicBasePath || "/resources/Content/music";
    this.soundBasePath = config.soundBasePath || "/resources/Content/sound";
    this.masterVolume = config.masterVolume ?? 1.0;
    this.musicVolume = config.musicVolume ?? 0.7;
    this.soundVolume = config.soundVolume ?? 1.0;

    // Request autoplay permission on first user interaction
    this.setupAutoplayRequest();
  }

  /**
   * Setup autoplay permission request
   */
  private setupAutoplayRequest(): void {
    // Listen for first user interaction to enable autoplay
    const enableAutoplay = () => {
      if (!this.autoplayRequested) {
        this.autoplayRequested = true;
        // Try to play a silent audio to unlock autoplay
        const silent = new Audio();
        silent.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD/////////////////////////////////////////////////////////////////AAAAAExhdmM1OC4xMzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/+xDEAAPAAAGkAAAAIAAANIAAAAQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU//sQxAkDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';
        silent.play().then(() => {
          this.autoplayEnabled = true;
        }).catch(() => {
          console.log('Autoplay not available, music will play after user interaction');
        });
      }
    };

    // Add listeners for common user interactions
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
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
      console.log(`[AudioManager] Music disabled, storing music file: ${baseName}`);
      return;
    }

    // Normalize filename - remove extension and convert to lowercase
    const baseName = fileName.replace(/\.(mp3|wma|ogg|wav)$/i, "").toLowerCase();

    // If same music is already playing, don't restart
    if (this.currentMusicFile.toLowerCase() === baseName.toLowerCase() && this.musicElement && !this.isMusicPaused) {
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
  private tryLoadMusic(baseName: string, formats: string[], index: number, requestId: number): void {
    if (index >= formats.length) {
      console.warn(`[AudioManager] Failed to load music: ${baseName} (tried all formats)`);
      return;
    }

    const ext = formats[index];
    const musicPath = `${this.musicBasePath}/${baseName}${ext}`;

    const audio = new Audio();
    audio.loop = true;
    audio.volume = this.masterVolume * this.musicVolume;
    audio.preload = 'auto';

    audio.onerror = () => {
      // Try next format
      this.tryLoadMusic(baseName, formats, index + 1, requestId);
    };

    audio.oncanplaythrough = () => {
      // Check if this request is still valid before playing
      if (requestId !== this.musicRequestId) {
        // This request was superseded, clean up this audio element
        audio.pause();
        audio.src = '';
        return;
      }

      // Stop any existing music element (in case of race condition)
      if (this.musicElement && this.musicElement !== audio) {
        this.musicElement.pause();
        this.musicElement.currentTime = 0;
        this.musicElement.src = '';
      }

      this.musicElement = audio;
      audio.play().catch((e) => {
        if (!this.autoplayEnabled) {
          console.log('Music ready but waiting for user interaction to play');
        } else {
          console.warn('Failed to play music:', e.message);
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
      this.musicElement.src = '';
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
        this.musicElement.src = '';
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
   */
  isAutoplayAllowed(): boolean {
    return this.autoplayEnabled;
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

      console.log('[AudioManager] Autoplay unlocked via user interaction');
      return true;
    } catch (error) {
      console.warn('[AudioManager] Failed to unlock autoplay:', error);
      return false;
    }
  }

  /**
   * Set music volume
   */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;
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
   *
   * Note: Original game uses .xnb format which browsers can't play.
   * We try .ogg first (converted files), then .mp3, then .wav.
   * OGG is preferred - no end-of-file padding issue like MP3.
   */
  playSound(fileName: string): void {
    if (!fileName) {
      return;
    }

    // Normalize filename - remove extension and convert to lowercase
    const baseName = fileName.replace(/\.(wav|mp3|ogg|xnb)$/i, "").toLowerCase();

    // Check cache first
    const cached = this.soundCache.get(baseName);
    if (cached) {
      this.playSoundInstance(cached);
      return;
    }

    // Try formats in order: ogg (converted), mp3, wav
    // Browser can't play .xnb directly
    // OGG is preferred - no end-of-file padding issue like MP3
    const formats = [".ogg", ".mp3", ".wav"];
    this.tryLoadSound(baseName, formats, 0);
  }

  /**
   * Try to load sound with different formats
   */
  private tryLoadSound(baseName: string, formats: string[], index: number): void {
    if (index >= formats.length) {
      console.warn(`[AudioManager] Failed to load sound: ${baseName} (tried all formats)`);
      return;
    }

    const ext = formats[index];
    const soundPath = `${this.soundBasePath}/${baseName}${ext}`;
    const audio = new Audio(soundPath);
    audio.volume = this.masterVolume * this.soundVolume;

    audio.oncanplaythrough = () => {
      // Successfully loaded, cache it
      this.soundCache.set(baseName, audio);
      this.playSoundInstance(audio);
    };

    audio.onerror = () => {
      // Try next format
      this.tryLoadSound(baseName, formats, index + 1);
    };

    // Start loading
    audio.load();
  }

  /**
   * Get or create AudioContext for Web Audio API
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Play a sound instance using Web Audio API for precise fade out
   * This prevents audio pop/click at the end of sound playback
   */
  private playSoundInstance(audio: HTMLAudioElement): void {
    const volume = this.masterVolume * this.soundVolume;

    try {
      const audioContext = this.getAudioContext();

      // Resume context if suspended (due to autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Clone and create media element source
      const soundInstance = audio.cloneNode() as HTMLAudioElement;
      soundInstance.volume = 1.0; // Volume will be controlled by GainNode

      const source = audioContext.createMediaElementSource(soundInstance);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);

      this.activeSounds.add(soundInstance);

      // Schedule fade out before end
      const fadeOutDuration = 0.05; // 50ms

      soundInstance.onloadedmetadata = () => {
        const duration = soundInstance.duration;
        if (duration > fadeOutDuration) {
          // Schedule gain reduction near the end
          const fadeStartTime = duration - fadeOutDuration;

          // Use a timer to trigger fade at the right moment
          const checkFade = () => {
            if (soundInstance.currentTime >= fadeStartTime) {
              const currentTime = audioContext.currentTime;
              gainNode.gain.setValueAtTime(volume, currentTime);
              gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeOutDuration);
            } else if (!soundInstance.paused && !soundInstance.ended) {
              requestAnimationFrame(checkFade);
            }
          };
          requestAnimationFrame(checkFade);
        }
      };

      soundInstance.onended = () => {
        this.activeSounds.delete(soundInstance);
        try {
          source.disconnect();
          gainNode.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      };

      soundInstance.play().catch(() => {
        this.activeSounds.delete(soundInstance);
      });

    } catch {
      // Fallback to simple playback if Web Audio API fails
      const soundInstance = audio.cloneNode() as HTMLAudioElement;
      soundInstance.volume = volume;
      this.activeSounds.add(soundInstance);

      soundInstance.onended = () => {
        this.activeSounds.delete(soundInstance);
      };

      soundInstance.play().catch(() => {
        this.activeSounds.delete(soundInstance);
      });
    }
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
  }

  /**
   * Set sound effect volume
   */
  setSoundVolume(volume: number): void {
    this.soundVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get sound effect volume
   */
  getSoundVolume(): number {
    return this.soundVolume;
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;
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
    this.soundCache.clear();
  }
}
