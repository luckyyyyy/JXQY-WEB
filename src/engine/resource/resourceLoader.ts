/**
 * ResourceLoader - 统一资源加载器
 *
 * 解决问题：
 * 1. 相同资源重复加载 - 通过缓存确保每个资源只加载一次
 * 2. 并发加载冲突 - 通过加载队列防止同一资源被多次请求
 * 3. 缺少加载统计 - 提供详细的加载统计信息
 *
 * 支持的资源类型：
 * - text: UTF-8 文本文件 (.txt, .ini)
 * - binary: 二进制文件 (.map, .asf, .mpc)
 * - audio: 音频文件 (.ogg, .mp3, .wav)
 *
 * 编码处理：
 * - 二进制文件中的路径是 GBK 编码（在二进制解析器中处理）
 * - 所有文本文件已转换为 UTF-8
 */

/**
 * 资源类型
 * - text/binary/audio: 原始资源类型
 * - 其他: 解析后缓存的资源类型
 */
import { logger } from "../core/logger";
import { getResourceRoot, ensureResourcePath } from "@/config/resourcePaths";
export type ResourceType =
  | "text"
  | "binary"
  | "audio" // 原始资源
  | "npcConfig"
  | "npcRes"
  | "objRes" // NPC/物体配置
  | "magic"
  | "goods"
  | "level" // 游戏配置
  | "asf"
  | "mpc"
  | "script" // 二进制解析结果
  | "other";

/**
 * 加载统计信息
 */
export interface ResourceStats {
  /** 总请求次数 */
  totalRequests: number;
  /** 缓存命中次数（从已缓存数据直接返回） */
  cacheHits: number;
  /** 去重命中次数（等待已有请求完成后获取，无需发起新网络请求） */
  dedupeHits: number;
  /** 实际网络请求次数 */
  networkRequests: number;
  /** 加载失败次数 */
  failures: number;
  /** 当前缓存大小（字节估算） */
  cacheSizeBytes: number;
  /** 缓存条目数 */
  cacheEntries: number;
  /** 各类型资源统计 */
  byType: {
    text: { requests: number; hits: number; dedupeHits: number; loads: number };
    binary: { requests: number; hits: number; dedupeHits: number; loads: number };
    audio: { requests: number; hits: number; dedupeHits: number; loads: number };
    npcConfig: { requests: number; hits: number; dedupeHits: number; loads: number };
    npcRes: { requests: number; hits: number; dedupeHits: number; loads: number };
    objRes: { requests: number; hits: number; dedupeHits: number; loads: number };
    magic: { requests: number; hits: number; dedupeHits: number; loads: number };
    goods: { requests: number; hits: number; dedupeHits: number; loads: number };
    level: { requests: number; hits: number; dedupeHits: number; loads: number };
    asf: { requests: number; hits: number; dedupeHits: number; loads: number };
    mpc: { requests: number; hits: number; dedupeHits: number; loads: number };
    script: { requests: number; hits: number; dedupeHits: number; loads: number };
    other: { requests: number; hits: number; dedupeHits: number; loads: number };
  };
  /** 最近加载的资源（最多20条） */
  recentLoads: { path: string; type: ResourceType; size: number; timestamp: number }[];
}

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  data: T;
  size: number;
  loadTime: number;
  lastAccess: number;
  accessCount: number;
}

/**
 * 统一资源加载器
 */
class ResourceLoaderImpl {
  // 文本资源缓存
  private textCache = new Map<string, CacheEntry<string>>();
  // 二进制资源缓存
  private binaryCache = new Map<string, CacheEntry<ArrayBuffer>>();
  // 音频资源缓存（AudioBuffer）
  private audioCache = new Map<string, CacheEntry<AudioBuffer>>();
  // INI 解析结果缓存（缓存解析后的对象，避免重复解析）
  private iniCache = new Map<string, CacheEntry<unknown>>();

  // 正在加载中的资源（防止重复请求）
  private pendingLoads = new Map<string, Promise<unknown>>();

  // 失败缓存：记录加载失败的资源路径，避免重复请求不存在的资源
  private failedPaths = new Set<string>();

  // 统计信息
  private stats: ResourceStats = {
    totalRequests: 0,
    cacheHits: 0,
    dedupeHits: 0,
    networkRequests: 0,
    failures: 0,
    cacheSizeBytes: 0,
    cacheEntries: 0,
    byType: {
      text: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      binary: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      audio: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      npcConfig: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      npcRes: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      objRes: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      magic: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      goods: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      level: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      asf: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      mpc: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      script: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      other: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
    },
    recentLoads: [],
  };

  // AudioContext for decoding audio
  private audioContext: AudioContext | null = null;

  /**
   * 获取或创建 AudioContext
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    return this.audioContext;
  }

  /**
   * 规范化路径
   */
  private normalizePath(path: string): string {
    // 转换反斜杠为正斜杠
    let normalized = path.replace(/\\/g, "/");

    // 如果是完整 URL，提取路径部分
    if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
      try {
        const url = new URL(normalized);
        normalized = url.pathname;
      } catch {
        // 解析失败，保持原样
      }
    }

    // 确保以 / 开头
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }

    // 使用配置的资源根目录
    const resourceRoot = getResourceRoot();

    // 确保 resources 路径（避免重复添加）
    if (!normalized.startsWith(resourceRoot + "/") && !normalized.startsWith(resourceRoot)) {
      if (normalized.startsWith("/")) {
        normalized = `${resourceRoot}${normalized}`;
      } else {
        normalized = `${resourceRoot}/${normalized}`;
      }
    }

    return normalized;
  }

  /**
   * 加载文本资源（UTF-8）
   */
  async loadText(path: string): Promise<string | null> {
    const normalizedPath = this.normalizePath(path);
    this.stats.totalRequests++;
    this.stats.byType.text.requests++;

    // 检查缓存
    const cached = this.textCache.get(normalizedPath);
    if (cached) {
      this.stats.cacheHits++;
      this.stats.byType.text.hits++;
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data;
    }

    // 检查是否正在加载（去重：等待已有请求完成，不发起新网络请求）
    const pending = this.pendingLoads.get(normalizedPath);
    if (pending) {
      this.stats.dedupeHits++;
      this.stats.byType.text.dedupeHits++;
      return (await pending) as string | null;
    }

    // 开始加载
    const loadPromise = this.fetchText(normalizedPath);
    this.pendingLoads.set(normalizedPath, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.pendingLoads.delete(normalizedPath);
    }
  }

  /**
   * 实际获取文本资源
   */
  private async fetchText(path: string): Promise<string | null> {
    this.stats.networkRequests++;
    this.stats.byType.text.loads++;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        this.stats.failures++;
        return null;
      }

      const text = await response.text();

      // Check for Vite HTML fallback (file doesn't exist, Vite returns index.html)
      const trimmed = text.trim();
      if (
        trimmed.startsWith("<!DOCTYPE") ||
        trimmed.startsWith("<html") ||
        trimmed.startsWith("<HTML")
      ) {
        // Not a real resource, Vite returned HTML fallback
        this.stats.failures++;
        return null;
      }

      const size = new Blob([text]).size;

      // 缓存
      const entry: CacheEntry<string> = {
        data: text,
        size,
        loadTime: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
      };
      this.textCache.set(path, entry);
      this.updateCacheStats();
      this.recordRecentLoad(path, "text", size);

      return text;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load text: ${path}`, error);
      this.stats.failures++;
      return null;
    }
  }

  /**
   * 加载二进制资源
   */
  async loadBinary(path: string): Promise<ArrayBuffer | null> {
    const normalizedPath = this.normalizePath(path);
    this.stats.totalRequests++;
    this.stats.byType.binary.requests++;

    // 检查缓存
    const cached = this.binaryCache.get(normalizedPath);
    if (cached) {
      this.stats.cacheHits++;
      this.stats.byType.binary.hits++;
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data;
    }

    // 检查是否正在加载（去重：等待已有请求完成，不发起新网络请求）
    const pending = this.pendingLoads.get(normalizedPath);
    if (pending) {
      this.stats.dedupeHits++;
      this.stats.byType.binary.dedupeHits++;
      return (await pending) as ArrayBuffer | null;
    }

    // 开始加载
    const loadPromise = this.fetchBinary(normalizedPath);
    this.pendingLoads.set(normalizedPath, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.pendingLoads.delete(normalizedPath);
    }
  }

  /**
   * 实际获取二进制资源
   */
  private async fetchBinary(path: string): Promise<ArrayBuffer | null> {
    this.stats.networkRequests++;
    this.stats.byType.binary.loads++;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        logger.warn(
          `[ResourceLoader] Failed to load binary: ${path} (HTTP ${response.status} ${response.statusText})`
        );
        this.stats.failures++;
        return null;
      }

      const buffer = await response.arrayBuffer();

      // 缓存
      const entry: CacheEntry<ArrayBuffer> = {
        data: buffer,
        size: buffer.byteLength,
        loadTime: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
      };
      this.binaryCache.set(path, entry);
      this.updateCacheStats();
      this.recordRecentLoad(path, "binary", buffer.byteLength);

      return buffer;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load binary: ${path}`, error);
      this.stats.failures++;
      return null;
    }
  }

  /**
   * 加载音频资源（返回 AudioBuffer）
   */
  async loadAudio(path: string): Promise<AudioBuffer | null> {
    const normalizedPath = this.normalizePath(path);
    this.stats.totalRequests++;
    this.stats.byType.audio.requests++;

    // 检查失败缓存（避免重复请求不存在的资源）
    if (this.failedPaths.has(normalizedPath)) {
      this.stats.cacheHits++;
      this.stats.byType.audio.hits++;
      return null;
    }

    // 检查缓存
    const cached = this.audioCache.get(normalizedPath);
    if (cached) {
      this.stats.cacheHits++;
      this.stats.byType.audio.hits++;
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data;
    }

    // 检查是否正在加载（去重：等待已有请求完成，不发起新网络请求）
    const pending = this.pendingLoads.get(normalizedPath);
    if (pending) {
      this.stats.dedupeHits++;
      this.stats.byType.audio.dedupeHits++;
      return (await pending) as AudioBuffer | null;
    }

    // 开始加载
    const loadPromise = this.fetchAudio(normalizedPath);
    this.pendingLoads.set(normalizedPath, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.pendingLoads.delete(normalizedPath);
    }
  }

  /**
   * 实际获取音频资源
   */
  private async fetchAudio(path: string): Promise<AudioBuffer | null> {
    this.stats.networkRequests++;
    this.stats.byType.audio.loads++;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        this.stats.failures++;
        // 缓存失败的路径，避免重复请求
        this.failedPaths.add(path);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioContext = this.getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

      // 缓存
      const estimatedSize = audioBuffer.length * audioBuffer.numberOfChannels * 4; // Float32
      const entry: CacheEntry<AudioBuffer> = {
        data: audioBuffer,
        size: estimatedSize,
        loadTime: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
      };
      this.audioCache.set(path, entry);
      this.updateCacheStats();
      this.recordRecentLoad(path, "audio", estimatedSize);

      return audioBuffer;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load audio: ${path}`, error);
      this.stats.failures++;
      // 缓存失败的路径，避免重复请求
      this.failedPaths.add(path);
      return null;
    }
  }

  /**
   * 加载并解析配置文件（缓存解析后的结果）
   * @param path 文件路径
   * @param parser 解析函数，将文本内容转换为对象
   * @param resourceType 资源类型，用于分类统计（默认 'other'）
   * @returns 解析后的对象，失败返回 null
   */
  async loadIni<T>(
    path: string,
    parser: (content: string) => T | null,
    resourceType: ResourceType = "other"
  ): Promise<T | null> {
    const normalizedPath = this.normalizePath(path);
    // 使用带类型前缀的缓存键，支持按类型精确清除
    const cacheKey = `${resourceType}:${normalizedPath}`;
    const typeStats = this.stats.byType[resourceType] || this.stats.byType.other;
    this.stats.totalRequests++;
    typeStats.requests++;

    // 检查解析结果缓存
    const cached = this.iniCache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      typeStats.hits++;
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data as T;
    }

    // 检查是否正在加载（去重）
    const pendingKey = `${cacheKey}:parsed`;
    const pending = this.pendingLoads.get(pendingKey);
    if (pending) {
      this.stats.dedupeHits++;
      typeStats.dedupeHits++;
      return (await pending) as T | null;
    }

    // 开始加载和解析
    const loadPromise = this.fetchAndParseIni(cacheKey, normalizedPath, parser, resourceType);
    this.pendingLoads.set(pendingKey, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.pendingLoads.delete(pendingKey);
    }
  }

  /**
   * 实际加载并解析配置文件
   * @param cacheKey 缓存键（包含类型前缀）
   * @param path 实际请求路径
   */
  private async fetchAndParseIni<T>(
    cacheKey: string,
    path: string,
    parser: (content: string) => T | null,
    resourceType: ResourceType
  ): Promise<T | null> {
    const typeStats = this.stats.byType[resourceType] || this.stats.byType.other;
    this.stats.networkRequests++;
    typeStats.loads++;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        this.stats.failures++;
        return null;
      }

      const text = await response.text();

      // 检测 Vite HTML fallback
      const trimmed = text.trim();
      if (
        trimmed.startsWith("<!DOCTYPE") ||
        trimmed.startsWith("<html") ||
        trimmed.startsWith("<HTML")
      ) {
        this.stats.failures++;
        return null;
      }

      // 解析
      const parsed = parser(text);
      if (!parsed) {
        this.stats.failures++;
        return null;
      }

      // 缓存解析结果
      const estimatedSize = text.length * 2; // 估算：解析后对象通常比原文本大
      const entry: CacheEntry<unknown> = {
        data: parsed,
        size: estimatedSize,
        loadTime: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
      };
      this.iniCache.set(cacheKey, entry);
      this.updateCacheStats();
      this.recordRecentLoad(path, resourceType, estimatedSize);

      return parsed;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load/parse INI: ${path}`, error);
      this.stats.failures++;
      return null;
    }
  }

  /**
   * 加载并解析二进制资源（缓存解析后的结果，不缓存原始二进制）
   * @param path 文件路径
   * @param parser 解析函数，将二进制内容转换为对象
   * @param resourceType 资源类型，用于分类统计
   * @returns 解析后的对象，失败返回 null
   */
  async loadParsedBinary<T>(
    path: string,
    parser: (buffer: ArrayBuffer) => T | null,
    resourceType: ResourceType
  ): Promise<T | null> {
    const normalizedPath = this.normalizePath(path);
    // 使用带类型前缀的缓存键，支持按类型精确清除
    const cacheKey = `${resourceType}:${normalizedPath}`;
    const typeStats = this.stats.byType[resourceType] || this.stats.byType.other;
    this.stats.totalRequests++;
    typeStats.requests++;

    // 检查解析结果缓存
    const cached = this.iniCache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      typeStats.hits++;
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data as T;
    }

    // 检查是否正在加载（去重）
    const pendingKey = `${cacheKey}:parsed`;
    const pending = this.pendingLoads.get(pendingKey);
    if (pending) {
      this.stats.dedupeHits++;
      typeStats.dedupeHits++;
      return (await pending) as T | null;
    }

    // 开始加载和解析
    const loadPromise = this.fetchAndParseBinary(cacheKey, normalizedPath, parser, resourceType);
    this.pendingLoads.set(pendingKey, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.pendingLoads.delete(pendingKey);
    }
  }

  /**
   * 实际加载并解析二进制资源
   * @param cacheKey 缓存键（包含类型前缀）
   * @param path 实际请求路径
   */
  private async fetchAndParseBinary<T>(
    cacheKey: string,
    path: string,
    parser: (buffer: ArrayBuffer) => T | null,
    resourceType: ResourceType
  ): Promise<T | null> {
    const typeStats = this.stats.byType[resourceType] || this.stats.byType.other;
    this.stats.networkRequests++;
    typeStats.loads++;

    try {
      const response = await fetch(path);
      if (!response.ok) {
        this.stats.failures++;
        return null;
      }

      const buffer = await response.arrayBuffer();

      // 解析
      const parsed = parser(buffer);
      if (!parsed) {
        this.stats.failures++;
        return null;
      }

      // 缓存解析结果（估算大小）
      const estimatedSize = buffer.byteLength;
      const entry: CacheEntry<unknown> = {
        data: parsed,
        size: estimatedSize,
        loadTime: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
      };
      this.iniCache.set(cacheKey, entry);
      this.updateCacheStats();
      this.recordRecentLoad(path, resourceType, estimatedSize);

      return parsed;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load/parse binary: ${path}`, error);
      this.stats.failures++;
      return null;
    }
  }

  /**
   * 检查资源是否已缓存
   */
  isCached(path: string, type: ResourceType): boolean {
    const normalizedPath = this.normalizePath(path);
    switch (type) {
      case "text":
        return this.textCache.has(normalizedPath);
      case "binary":
        return this.binaryCache.has(normalizedPath);
      case "audio":
        return this.audioCache.has(normalizedPath);
      // 解析后的资源使用带类型前缀的缓存键
      case "npcConfig":
      case "npcRes":
      case "objRes":
      case "magic":
      case "goods":
      case "level":
      case "asf":
      case "mpc":
      case "script":
      case "other": {
        const cacheKey = `${type}:${normalizedPath}`;
        return this.iniCache.has(cacheKey);
      }
      default:
        return false;
    }
  }

  /**
   * 预加载资源
   */
  async preload(paths: string[], type: ResourceType): Promise<void> {
    const loadFn =
      type === "text"
        ? this.loadText.bind(this)
        : type === "binary"
          ? this.loadBinary.bind(this)
          : this.loadAudio.bind(this);

    await Promise.all(paths.map((path) => loadFn(path)));
  }

  /**
   * 更新缓存统计
   */
  private updateCacheStats(): void {
    let totalSize = 0;
    let totalEntries = 0;

    for (const entry of this.textCache.values()) {
      totalSize += entry.size;
      totalEntries++;
    }
    for (const entry of this.binaryCache.values()) {
      totalSize += entry.size;
      totalEntries++;
    }
    for (const entry of this.audioCache.values()) {
      totalSize += entry.size;
      totalEntries++;
    }
    for (const entry of this.iniCache.values()) {
      totalSize += entry.size;
      totalEntries++;
    }

    this.stats.cacheSizeBytes = totalSize;
    this.stats.cacheEntries = totalEntries;
  }

  /**
   * 记录最近加载
   */
  private recordRecentLoad(path: string, type: ResourceType, size: number): void {
    this.stats.recentLoads.unshift({
      path,
      type,
      size,
      timestamp: Date.now(),
    });
    if (this.stats.recentLoads.length > 20) {
      this.stats.recentLoads.pop();
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): ResourceStats {
    return { ...this.stats };
  }

  /**
   * 获取缓存命中率
   */
  getCacheHitRate(): number {
    if (this.stats.totalRequests === 0) return 0;
    return this.stats.cacheHits / this.stats.totalRequests;
  }

  /**
   * 格式化大小
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  /**
   * 清除特定类型的缓存
   * 支持按类型精确清除，不会影响其他类型的缓存
   */
  clearCache(type?: ResourceType): void {
    if (!type) {
      this.textCache.clear();
      this.binaryCache.clear();
      this.audioCache.clear();
      this.iniCache.clear();
    } else if (type === "text") {
      this.textCache.clear();
    } else if (type === "binary") {
      this.binaryCache.clear();
    } else if (type === "audio") {
      this.audioCache.clear();
    } else {
      // 按类型前缀精确清除 iniCache 中的条目
      // 缓存键格式: "${resourceType}:${path}"
      const prefix = `${type}:`;
      for (const key of this.iniCache.keys()) {
        if (key.startsWith(prefix)) {
          this.iniCache.delete(key);
        }
      }
    }
    this.updateCacheStats();
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      dedupeHits: 0,
      networkRequests: 0,
      failures: 0,
      cacheSizeBytes: this.stats.cacheSizeBytes,
      cacheEntries: this.stats.cacheEntries,
      byType: {
        text: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        binary: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        audio: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        npcConfig: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        npcRes: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        objRes: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        magic: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        goods: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        level: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        asf: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        mpc: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        script: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
        other: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
      },
      recentLoads: [],
    };
  }

  /**
   * 获取总命中率（缓存命中 + 去重命中）
   */
  getTotalHitRate(): number {
    if (this.stats.totalRequests === 0) return 0;
    return (this.stats.cacheHits + this.stats.dedupeHits) / this.stats.totalRequests;
  }

  /**
   * 获取调试摘要
   */
  getDebugSummary(): string {
    const stats = this.stats;
    const totalHits = stats.cacheHits + stats.dedupeHits;
    const hitRate = (this.getTotalHitRate() * 100).toFixed(1);
    return [
      `📊 资源加载统计`,
      `请求: ${stats.totalRequests} | 总命中: ${totalHits} (${hitRate}%) | 网络: ${stats.networkRequests} | 失败: ${stats.failures}`,
      `  缓存命中: ${stats.cacheHits} | 去重命中: ${stats.dedupeHits}`,
      `缓存: ${stats.cacheEntries} 条 (${this.formatSize(stats.cacheSizeBytes)})`,
      ``,
      `按类型:`,
      `  文本: ${stats.byType.text.requests} / ${stats.byType.text.hits}+${stats.byType.text.dedupeHits} / ${stats.byType.text.loads}`,
      `  二进制: ${stats.byType.binary.requests} / ${stats.byType.binary.hits}+${stats.byType.binary.dedupeHits} / ${stats.byType.binary.loads}`,
      `  音频: ${stats.byType.audio.requests} / ${stats.byType.audio.hits}+${stats.byType.audio.dedupeHits} / ${stats.byType.audio.loads}`,
      `  ASF: ${stats.byType.asf.requests} / ${stats.byType.asf.hits}+${stats.byType.asf.dedupeHits} / ${stats.byType.asf.loads}`,
      `  MPC: ${stats.byType.mpc.requests} / ${stats.byType.mpc.hits}+${stats.byType.mpc.dedupeHits} / ${stats.byType.mpc.loads}`,
      `  脚本: ${stats.byType.script.requests} / ${stats.byType.script.hits}+${stats.byType.script.dedupeHits} / ${stats.byType.script.loads}`,
      `  NPC配置: ${stats.byType.npcConfig.requests} / ${stats.byType.npcConfig.hits}+${stats.byType.npcConfig.dedupeHits} / ${stats.byType.npcConfig.loads}`,
      `  NPC资源: ${stats.byType.npcRes.requests} / ${stats.byType.npcRes.hits}+${stats.byType.npcRes.dedupeHits} / ${stats.byType.npcRes.loads}`,
      `  物体资源: ${stats.byType.objRes.requests} / ${stats.byType.objRes.hits}+${stats.byType.objRes.dedupeHits} / ${stats.byType.objRes.loads}`,
      `  武功: ${stats.byType.magic.requests} / ${stats.byType.magic.hits}+${stats.byType.magic.dedupeHits} / ${stats.byType.magic.loads}`,
      `  物品: ${stats.byType.goods.requests} / ${stats.byType.goods.hits}+${stats.byType.goods.dedupeHits} / ${stats.byType.goods.loads}`,
      `  等级: ${stats.byType.level.requests} / ${stats.byType.level.hits}+${stats.byType.level.dedupeHits} / ${stats.byType.level.loads}`,
      `  其他: ${stats.byType.other.requests} / ${stats.byType.other.hits}+${stats.byType.other.dedupeHits} / ${stats.byType.other.loads}`,
    ].join("\n");
  }
}

/**
 * 全局单例
 */
export const resourceLoader = new ResourceLoaderImpl();

/**
 * 导出便捷函数
 */
export const loadText = resourceLoader.loadText.bind(resourceLoader);
export const loadBinary = resourceLoader.loadBinary.bind(resourceLoader);
export const loadAudio = resourceLoader.loadAudio.bind(resourceLoader);
export const loadIni = resourceLoader.loadIni.bind(resourceLoader);
export const getResourceStats = resourceLoader.getStats.bind(resourceLoader);
export const getResourceDebugSummary = resourceLoader.getDebugSummary.bind(resourceLoader);
