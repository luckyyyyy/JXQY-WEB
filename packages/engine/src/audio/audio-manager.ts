/**
 * Audio Manager - 精简版
 * 支持：背景音乐、音效、循环音效、3D空间音效
 */

import { logger } from "../core/logger";
import type { Vector2 } from "../core/types";
import { resourceLoader } from "../resource/resource-loader";
import { DefaultPaths, getResourceUrl } from "../resource/resource-paths";

export interface AudioManagerConfig {
  musicBasePath?: string;
  soundBasePath?: string;
  masterVolume?: number;
  musicVolume?: number;
  soundVolume?: number;
  ambientVolume?: number;
}

/** 3D 音效实例 */
export interface Sound3DInstance {
  source: AudioBufferSourceNode;
  panner: PannerNode;
  gainNode: GainNode;
  isLooping: boolean;
}

// 常量
const SOUND_MAX_DISTANCE = 1000; // 最大听觉距离（像素）
const SOUND_3D_MAX_DISTANCE = 8; // Web Audio 坐标缩放因子
const CLEANUP_INTERVAL_MS = 30000; // 音频实例清理间隔（30秒）
const MAX_SOUND_INSTANCES = 50; // 最大音效实例数

export class AudioManager {
  private musicBasePath: string;
  private soundBasePath: string;

  // 音量控制
  private masterVolume = 1.0;
  private musicVolume = 0.7;
  private soundVolume = 1.0;
  private ambientVolume = 1.0;

  // 背景音乐
  private currentMusicFile = "";
  private musicElement: HTMLAudioElement | null = null;
  private isMusicPaused = false;
  private isMusicDisabled = false;
  private isAmbientDisabled = false;

  // 循环音效（脚步声）
  private loopingSoundFile = "";
  private loopingSourceNode: AudioBufferSourceNode | null = null;
  private loopingGainNode: GainNode | null = null;

  // 环境循环音效（雨声等，独立于脚步声通道）
  private ambientLoopFile = "";
  private ambientLoopSource: AudioBufferSourceNode | null = null;
  private ambientLoopGain: GainNode | null = null;

  // Web Audio
  private audioContext: AudioContext | null = null;

  // 音效实例缓存（同一音效同时只播一个，复用实例）
  private soundInstances = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

  // 3D 音效
  private listenerPosition: Vector2 = { x: 0, y: 0 };
  private sound3DInstances = new Map<string, Sound3DInstance>();
  private sound3DLoading = new Set<string>();
  private sound3DStopping = new Set<string>();

  // 清理定时器
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: AudioManagerConfig = {}) {
    this.musicBasePath = config.musicBasePath || DefaultPaths.musicBasePath;
    this.soundBasePath = config.soundBasePath || DefaultPaths.soundBasePath;
    this.masterVolume = config.masterVolume ?? 1.0;
    this.musicVolume = config.musicVolume ?? 0.7;
    this.soundVolume = config.soundVolume ?? 1.0;
    this.ambientVolume = config.ambientVolume ?? 1.0;

    // 启动定期清理任务
    this.startCleanupTimer();
  }

  /**
   * 启动定期清理任务，防止音频实例内存泄漏
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupStaleInstances(), CLEANUP_INTERVAL_MS);
  }

  /**
   * 清理已结束但未被正确移除的音频实例
   */
  private cleanupStaleInstances(): void {
    // 清理普通音效实例（检查 playbackState 或 buffer 状态）
    for (const [path, instance] of this.soundInstances) {
      try {
        // AudioBufferSourceNode 播放结束后 buffer 仍然存在，但无法重新播放
        // 通过 context.currentTime 和 startTime 判断是否已结束
        // 简化处理：依赖 onended 回调，这里只做兜底清理
        if (!instance.source.buffer) {
          this.soundInstances.delete(path);
        }
      } catch {
        // instance invalidated
        // 如果访问失败，说明实例已失效
        this.soundInstances.delete(path);
      }
    }

    // 清理 3D 一次性音效实例
    for (const [path, instance] of this.sound3DOnceInstances) {
      try {
        if (!instance.source.buffer) {
          this.sound3DOnceInstances.delete(path);
        }
      } catch {
        // instance invalidated
        this.sound3DOnceInstances.delete(path);
      }
    }

    // 清理过期的 loading/stopping 状态
    // 这些 Set 应该很快被清理，如果残留太久说明有问题
    if (this.sound3DLoading.size > 20) {
      logger.warn(
        `[AudioManager] sound3DLoading has ${this.sound3DLoading.size} stale entries, clearing`
      );
      this.sound3DLoading.clear();
    }
    if (this.sound3DStopping.size > 20) {
      logger.warn(
        `[AudioManager] sound3DStopping has ${this.sound3DStopping.size} stale entries, clearing`
      );
      this.sound3DStopping.clear();
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  // ==================== 内部工具方法 ====================

  /** 安全停止 AudioBufferSourceNode（可能已停止或被回收） */
  private safeStopSource(source: AudioBufferSourceNode): void {
    try {
      source.stop();
    } catch {
      // source already stopped
    }
  }

  /** 规范化音频文件名：保留原始扩展名，无扩展名时默认 .xnb */
  private resolveFileName(fileName: string): string {
    const hasExt = /\.(wav|mp3|ogg|xnb)$/i.test(fileName);
    return hasExt ? fileName.toLowerCase() : `${fileName.toLowerCase()}.xnb`;
  }

  /** 加载音频 buffer，优先 .xnb 格式，失败回退原始格式 */
  private async loadAudioBuffer(soundPath: string): Promise<AudioBuffer | null> {
    if (!soundPath.toLowerCase().endsWith(".xnb")) {
      const xnbPath = soundPath.replace(/\.(wav|mp3|ogg)$/i, ".xnb");
      const buffer = await resourceLoader.loadAudio(xnbPath);
      if (buffer) return buffer;
    }
    return resourceLoader.loadAudio(soundPath);
  }

  // ==================== 背景音乐 ====================

  playMusic(fileName: string): void {
    if (!fileName) {
      this.stopMusic();
      return;
    }

    const baseName = fileName.replace(/\.(mp3|wma|ogg|wav)$/i, "").toLowerCase();

    if (this.isMusicDisabled) {
      this.currentMusicFile = baseName;
      return;
    }

    // 已在播放相同音乐
    if (this.currentMusicFile === baseName && this.musicElement && !this.isMusicPaused) {
      return;
    }

    this.stopMusic();
    this.currentMusicFile = baseName;

    // 尝试 OGG，失败则尝试 MP3
    this.loadMusic(baseName, ".ogg");
  }

  private loadMusic(baseName: string, ext: string): void {
    const musicPath = `${this.musicBasePath}/${baseName}${ext}`;
    const audio = new Audio();
    audio.loop = true;
    audio.volume = this.masterVolume * this.musicVolume;

    audio.onerror = () => {
      if (ext === ".ogg") {
        this.loadMusic(baseName, ".mp3");
      }
    };

    audio.oncanplaythrough = () => {
      if (this.currentMusicFile !== baseName) return;
      this.musicElement = audio;
      audio.play().catch(() => {});
    };

    audio.src = getResourceUrl(musicPath);
    audio.load();
  }

  stopMusic(): void {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.src = "";
      this.musicElement = null;
    }
    this.currentMusicFile = "";
    this.isMusicPaused = false;
  }

  pauseMusic(): void {
    if (this.musicElement && !this.isMusicPaused) {
      this.musicElement.pause();
      this.isMusicPaused = true;
    }
  }

  resumeMusic(): void {
    if (this.isMusicDisabled) {
      this.isMusicDisabled = false;
      if (this.currentMusicFile) this.playMusic(this.currentMusicFile);
      return;
    }
    if (this.musicElement && this.isMusicPaused) {
      this.musicElement.play().catch(() => {});
      this.isMusicPaused = false;
    }
  }

  setMusicEnabled(enabled: boolean): void {
    this.isMusicDisabled = !enabled;
    if (!enabled) {
      if (this.musicElement) {
        this.musicElement.pause();
        this.musicElement.src = "";
        this.musicElement = null;
      }
    } else if (this.currentMusicFile) {
      this.playMusic(this.currentMusicFile);
    }
  }

  isMusicEnabled(): boolean {
    return !this.isMusicDisabled;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;
    }
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  getCurrentMusicFile(): string {
    return this.currentMusicFile;
  }

  // ==================== 音效 ====================

  playSound(fileName: string): void {
    if (!fileName) return;
    const soundPath = `${this.soundBasePath}/${this.resolveFileName(fileName)}`;
    this.playAudioFile(soundPath, this.masterVolume * this.soundVolume);
  }

  private async playAudioFile(path: string, volume: number): Promise<void> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      if (this.soundInstances.has(path)) return;

      const buffer = await this.loadAudioBuffer(path);
      if (!buffer) return;

      // 再次检查（异步加载期间可能已经有了）
      if (this.soundInstances.has(path)) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      this.soundInstances.set(path, { source, gain });
      source.onended = () => {
        if (this.soundInstances.get(path)?.source === source) {
          this.soundInstances.delete(path);
        }
      };

      source.start(0);
    } catch (e) {
      logger.warn(`[AudioManager] playAudioFile error: ${e}`);
    }
  }

  stopAllSounds(): void {
    for (const [, instance] of this.soundInstances) {
      this.safeStopSource(instance.source);
      instance.source.disconnect();
      instance.gain.disconnect();
    }
    this.soundInstances.clear();
    this.stopLoopingSound();
    this.stopAmbientLoop();
  }

  // ==================== 循环音效（脚步声） ====================

  playLoopingSound(fileName: string): void {
    if (!fileName) {
      this.stopLoopingSound();
      return;
    }
    const soundFile = this.resolveFileName(fileName);
    if (this.loopingSoundFile === soundFile && this.loopingSourceNode) return;
    this.stopLoopingSound();
    this.loopingSoundFile = soundFile;
    this.startLoop("looping", soundFile, this.masterVolume * this.soundVolume * 2.5);
  }

  stopLoopingSound(): void {
    this.stopLoopNodes(this.loopingSourceNode, this.loopingGainNode);
    this.loopingSourceNode = null;
    this.loopingGainNode = null;
    this.loopingSoundFile = "";
  }

  isLoopingSoundPlaying(): boolean {
    return this.loopingSourceNode !== null;
  }

  // ==================== 环境循环音效（雨声等） ====================

  playAmbientLoop(fileName: string): void {
    if (!fileName) {
      this.stopAmbientLoop();
      return;
    }
    const soundFile = this.resolveFileName(fileName);
    if (this.ambientLoopFile === soundFile && this.ambientLoopSource) return;
    this.stopAmbientLoop();
    this.ambientLoopFile = soundFile;
    this.startLoop("ambient", soundFile, this.masterVolume * this.soundVolume);
  }

  stopAmbientLoop(): void {
    this.stopLoopNodes(this.ambientLoopSource, this.ambientLoopGain);
    this.ambientLoopSource = null;
    this.ambientLoopGain = null;
    this.ambientLoopFile = "";
  }

  /** 通用循环音效启动（脚步声/环境音共用） */
  private async startLoop(
    channel: "looping" | "ambient",
    baseName: string,
    volume: number
  ): Promise<void> {
    const soundPath = `${this.soundBasePath}/${baseName}`;
    const fileRef = channel === "looping" ? "loopingSoundFile" : "ambientLoopFile";
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const buffer = await this.loadAudioBuffer(soundPath);
      if (!buffer || this[fileRef] !== baseName) return;

      // 先停止当前通道的旧实例
      if (channel === "looping") {
        this.stopLoopNodes(this.loopingSourceNode, this.loopingGainNode);
      } else {
        this.stopLoopNodes(this.ambientLoopSource, this.ambientLoopGain);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = volume;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      if (channel === "looping") {
        this.loopingSourceNode = source;
        this.loopingGainNode = gain;
      } else {
        this.ambientLoopSource = source;
        this.ambientLoopGain = gain;
      }
    } catch (e) {
      logger.warn(`[AudioManager] startLoop(${channel}) error: ${e}`);
      this[fileRef] = "";
    }
  }

  /** 安全停止并断开循环音频节点 */
  private stopLoopNodes(source: AudioBufferSourceNode | null, gain: GainNode | null): void {
    if (source) {
      this.safeStopSource(source);
      source.disconnect();
    }
    if (gain) gain.disconnect();
  }

  // ==================== 音量控制 ====================

  setSoundVolume(volume: number): void {
    this.soundVolume = Math.max(0, Math.min(1, volume));
    if (this.loopingGainNode) {
      this.loopingGainNode.gain.value = this.masterVolume * this.soundVolume * 2.5;
    }
    if (this.ambientLoopGain) {
      this.ambientLoopGain.gain.value = this.masterVolume * this.soundVolume;
    }
  }

  getSoundVolume(): number {
    return this.soundVolume;
  }

  setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));
    for (const instance of this.sound3DInstances.values()) {
      instance.gainNode.gain.value = this.masterVolume * this.ambientVolume;
    }
  }

  getAmbientVolume(): number {
    return this.ambientVolume;
  }

  setAmbientEnabled(enabled: boolean): void {
    this.isAmbientDisabled = !enabled;
    if (!enabled) this.stopAll3DSounds();
  }

  isAmbientEnabled(): boolean {
    return !this.isAmbientDisabled;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.musicElement) {
      this.musicElement.volume = this.masterVolume * this.musicVolume;
    }
    if (this.loopingGainNode) {
      this.loopingGainNode.gain.value = this.masterVolume * this.soundVolume * 2.5;
    }
    if (this.ambientLoopGain) {
      this.ambientLoopGain.gain.value = this.masterVolume * this.soundVolume;
    }
    for (const instance of this.sound3DInstances.values()) {
      instance.gainNode.gain.value = this.masterVolume * this.ambientVolume;
    }
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  // ==================== 3D 音效 ====================

  setListenerPosition(position: Vector2): void {
    this.listenerPosition = { x: position.x, y: position.y };
  }

  getListenerPosition(): Vector2 {
    return this.listenerPosition;
  }

  // 3D 一次性音效实例缓存（同一音效同时只播一个）
  private sound3DOnceInstances = new Map<
    string,
    { source: AudioBufferSourceNode; panner: PannerNode; gain: GainNode }
  >();

  /** 播放一次性 3D 音效 */
  async play3DSoundOnce(fileName: string, emitterPosition: Vector2): Promise<void> {
    if (!fileName || this.isAmbientDisabled) return;

    const soundFile = this.resolveFileName(fileName);
    const direction = this.getDirection(emitterPosition);
    if (Math.hypot(direction.x, direction.y) > SOUND_MAX_DISTANCE) return;

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const soundPath = `${this.soundBasePath}/${soundFile}`;
      if (this.sound3DOnceInstances.has(soundPath)) return;

      const buffer = await this.loadAudioBuffer(soundPath);
      if (!buffer) return;
      if (this.sound3DOnceInstances.has(soundPath)) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const panner = this.createPannerNode(ctx, direction);
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * this.ambientVolume;

      source.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);

      this.sound3DOnceInstances.set(soundPath, { source, panner, gain });
      source.onended = () => {
        if (this.sound3DOnceInstances.get(soundPath)?.source === source) {
          this.sound3DOnceInstances.delete(soundPath);
        }
      };

      source.start(0);
    } catch (e) {
      logger.warn(`[AudioManager] play3DSoundOnce error: ${e}`);
    }
  }

  /** 播放循环 3D 音效 */
  async play3DSoundLoop(id: string, fileName: string, emitterPosition: Vector2): Promise<void> {
    if (!fileName || this.isAmbientDisabled) return;

    if (this.sound3DInstances.has(id)) {
      this.update3DSoundPosition(id, emitterPosition);
      return;
    }
    if (this.sound3DLoading.has(id) || this.sound3DStopping.has(id)) return;

    const direction = this.getDirection(emitterPosition);
    if (Math.hypot(direction.x, direction.y) > SOUND_MAX_DISTANCE) return;

    this.sound3DLoading.add(id);
    const soundFile = this.resolveFileName(fileName);

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const soundPath = `${this.soundBasePath}/${soundFile}`;
      const buffer = await this.loadAudioBuffer(soundPath);
      if (!buffer || this.sound3DInstances.has(id)) {
        this.sound3DLoading.delete(id);
        return;
      }

      const currentDirection = this.getDirection(emitterPosition);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const panner = this.createPannerNode(ctx, currentDirection);
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * this.ambientVolume;

      source.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      this.sound3DInstances.set(id, { source, panner, gainNode: gain, isLooping: true });
      this.sound3DLoading.delete(id);
    } catch (e) {
      this.sound3DLoading.delete(id);
      logger.warn(`[AudioManager] play3DSoundLoop error: ${e}`);
    }
  }

  /** 更新 3D 音效位置 */
  update3DSoundPosition(id: string, emitterPosition: Vector2): void {
    const instance = this.sound3DInstances.get(id);
    if (!instance) return;

    const direction = this.getDirection(emitterPosition);
    this.apply3DPosition(instance.panner, direction);
  }

  /** 停止指定 3D 音效 */
  stop3DSound(id: string): void {
    const instance = this.sound3DInstances.get(id);
    if (!instance || this.sound3DStopping.has(id)) return;
    this.sound3DStopping.add(id);
    this.sound3DInstances.delete(id);
    this.disconnect3DInstance(instance);
    setTimeout(() => this.sound3DStopping.delete(id), 100);
  }

  /** 停止所有 3D 音效 */
  stopAll3DSounds(): void {
    for (const [id, instance] of this.sound3DInstances) {
      this.disconnect3DInstance(instance);
      this.sound3DStopping.add(id);
      setTimeout(() => this.sound3DStopping.delete(id), 100);
    }
    this.sound3DInstances.clear();
    this.sound3DRandomPlaying.clear();
  }

  /** 安全停止并断开 3D 音效实例 */
  private disconnect3DInstance(instance: Sound3DInstance): void {
    this.safeStopSource(instance.source);
    instance.source.disconnect();
    instance.gainNode.disconnect();
  }

  // 随机音效播放状态
  private sound3DRandomPlaying = new Set<string>();

  /** 随机播放 3D 音效（每帧有概率触发） */
  async play3DSoundRandom(
    id: string,
    fileName: string,
    emitterPosition: Vector2,
    chance: number
  ): Promise<void> {
    if (!fileName || this.isAmbientDisabled) return;
    if (this.sound3DRandomPlaying.has(id)) return;
    if (Math.random() > chance) return;

    const direction = this.getDirection(emitterPosition);
    if (Math.hypot(direction.x, direction.y) > SOUND_MAX_DISTANCE) return;

    this.sound3DRandomPlaying.add(id);
    const soundFile = this.resolveFileName(fileName);

    try {
      const ctx = this.getAudioContext();
      if (ctx.state === "suspended") await ctx.resume();

      const soundPath = `${this.soundBasePath}/${soundFile}`;
      const buffer = await this.loadAudioBuffer(soundPath);
      if (!buffer) {
        this.sound3DRandomPlaying.delete(id);
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const panner = this.createPannerNode(ctx, direction);
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume * this.ambientVolume;

      source.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);

      source.onended = () => this.sound3DRandomPlaying.delete(id);
      source.start(0);
    } catch (e) {
      this.sound3DRandomPlaying.delete(id);
      logger.warn(`[AudioManager] play3DSoundRandom error: ${e}`);
    }
  }

  private getDirection(emitterPosition: Vector2): Vector2 {
    return {
      x: emitterPosition.x - this.listenerPosition.x,
      y: emitterPosition.y - this.listenerPosition.y,
    };
  }

  private createPannerNode(ctx: AudioContext, direction: Vector2): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "linear";
    panner.refDistance = 1;
    panner.maxDistance = SOUND_3D_MAX_DISTANCE;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.coneOuterGain = 1;
    this.apply3DPosition(panner, direction);
    return panner;
  }

  private apply3DPosition(panner: PannerNode, direction: Vector2): void {
    const distance = Math.hypot(direction.x, direction.y);

    if (distance === 0) {
      panner.positionX.value = 0;
      panner.positionY.value = 0;
      panner.positionZ.value = 0;
    } else if (distance > SOUND_MAX_DISTANCE) {
      panner.positionX.value = 999999;
      panner.positionY.value = 0;
      panner.positionZ.value = 999999;
    } else {
      const scale = (distance / SOUND_MAX_DISTANCE) * SOUND_3D_MAX_DISTANCE;
      panner.positionX.value = (direction.x / distance) * scale;
      panner.positionY.value = 0;
      panner.positionZ.value = (direction.y / distance) * scale;
    }
  }

  // ==================== 清理 ====================

  dispose(): void {
    // 停止清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.stopMusic();
    this.stopLoopingSound();
    this.stopAmbientLoop();
    this.stopAll3DSounds();
    this.stopAllSounds();

    // 清理所有实例缓存
    this.soundInstances.clear();
    this.sound3DOnceInstances.clear();
    this.sound3DRandomPlaying.clear();

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  // ==================== 兼容性接口 ====================

  /** 检查是否允许自动播放（总是返回 true，简化处理） */
  isAutoplayAllowed(): boolean {
    return true;
  }

  /** 请求自动播放权限（空实现，用户交互时自动解锁） */
  async requestAutoplayPermission(): Promise<boolean> {
    return true;
  }

  updateAll3DSounds(): void {
    // 由 ObjManager 逐个更新位置，这里不需要实现
  }
}
