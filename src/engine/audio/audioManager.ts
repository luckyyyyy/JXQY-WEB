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

  // Autoplay state
  private autoplayEnabled: boolean = false;
  private autoplayRequested: boolean = false;

  // Sound effects cache
  private soundCache: Map<string, HTMLAudioElement> = new Map();
  private activeSounds: Set<HTMLAudioElement> = new Set();

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
   * Note: WMA format is not supported in Chrome/Firefox, so we convert paths to use WMA files as-is
   * and let the browser's canPlayType handle format detection
   */
  playMusic(fileName: string): void {
    if (!fileName) {
      this.stopMusic();
      return;
    }

    // Normalize filename - remove extension and case
    const baseName = fileName.replace(/\.(mp3|wma|ogg|wav)$/i, "");

    // If same music is already playing, don't restart
    if (this.currentMusicFile.toLowerCase() === baseName.toLowerCase() && this.musicElement && !this.isMusicPaused) {
      return;
    }

    // Stop current music
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
    }

    this.currentMusicFile = baseName;

    // WMA is not supported in Chrome/Firefox
    // Try formats in order: mp3 (most compatible), ogg, wma (IE/Edge only)
    const formats = [".mp3", ".ogg", ".wma"];
    let formatIndex = 0;

    const tryNextFormat = () => {
      if (formatIndex >= formats.length) {
        console.warn(`No supported format found for music: ${baseName}`);
        return;
      }

      const ext = formats[formatIndex];
      const musicPath = `${this.musicBasePath}/${baseName}${ext}`;

      const audio = new Audio();
      audio.loop = true;
      audio.volume = this.masterVolume * this.musicVolume;
      audio.preload = 'auto';

      audio.onerror = () => {
        // Try next format
        formatIndex++;
        tryNextFormat();
      };

      audio.oncanplaythrough = () => {
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
    };

    tryNextFormat();
    this.isMusicPaused = false;
  }

  /**
   * Stop background music
   * Based on BackgroundMusic.Stop() in C#
   */
  stopMusic(): void {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
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
    if (this.musicElement && this.isMusicPaused) {
      this.musicElement.play().catch(() => {});
      this.isMusicPaused = false;
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
   */
  playSound(fileName: string): void {
    if (!fileName) return;

    // Normalize filename
    const baseName = fileName.replace(/\.(wav|mp3|ogg|xnb)$/i, "");
    const soundPath = `${this.soundBasePath}/${baseName}.xnb`;

    // Check cache
    let audio = this.soundCache.get(baseName);

    if (!audio) {
      audio = new Audio(soundPath);
      audio.volume = this.masterVolume * this.soundVolume;
      this.soundCache.set(baseName, audio);

      // Try alternative formats on error
      audio.onerror = () => {
        for (const ext of [".wav", ".mp3", ".ogg"]) {
          const altPath = `${this.soundBasePath}/${baseName}${ext}`;
          const altAudio = new Audio(altPath);
          altAudio.volume = this.masterVolume * this.soundVolume;
          this.soundCache.set(baseName, altAudio);
          break;
        }
      };
    }

    // Clone audio for overlapping sounds
    const soundInstance = audio.cloneNode() as HTMLAudioElement;
    soundInstance.volume = this.masterVolume * this.soundVolume;

    this.activeSounds.add(soundInstance);

    soundInstance.onended = () => {
      this.activeSounds.delete(soundInstance);
    };

    soundInstance.play().catch(() => {
      this.activeSounds.delete(soundInstance);
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

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}

export function resetAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.dispose();
    audioManagerInstance = null;
  }
}
