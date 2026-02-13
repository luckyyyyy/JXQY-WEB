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

import { getResourceRoot, getResourceUrl } from "./resource-paths";
import { parseXnbAudio, xnbToAudioBuffer } from "./format/xnb";
/**
 * 资源类型
 * - text/binary/audio: 原始资源类型
 * - 其他: 解析后缓存的资源类型
 */
import { logger } from "../core/logger";
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
  | "shd"
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
    shd: { requests: number; hits: number; dedupeHits: number; loads: number };
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
      shd: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
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
      } catch { // URL parse failed
        // 解析失败，保持原样
      }
    }

    // 确保以 / 开头
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }

    // 如果路径已经包含 /game/ 前缀（编辑器场景），说明是完整路径，直接返回
    // 例如: /game/william-chan/resources/mpc/map/...
    if (normalized.startsWith("/game/")) {
      return normalized;
    }

    // 使用配置的资源根目录
    const resourceRoot = getResourceRoot();

    // 确保 resources 路径（避免重复添加）
    if (!normalized.startsWith(`${resourceRoot}/`) && !normalized.startsWith(resourceRoot)) {
      if (normalized.startsWith("/")) {
        normalized = `${resourceRoot}${normalized}`;
      } else {
        normalized = `${resourceRoot}/${normalized}`;
      }
    }

    return normalized;
  }

  // ==================== 通用加载模板方法 ====================

  /**
   * 通用资源加载模板方法
   * 统一处理：缓存检查、失败缓存、去重、统计更新
   * @param normalizedPath 规范化后的路径
   * @param resourceType 资源类型
   * @param cache 缓存 Map
   * @param fetcher 实际获取数据的函数
   */
  private async loadWithCache<T>(
    normalizedPath: string,
    resourceType: "text" | "binary" | "audio",
    cache: Map<string, CacheEntry<T>>,
    fetcher: (path: string) => Promise<T | null>
  ): Promise<T | null> {
    const typeStats = this.stats.byType[resourceType];
    this.stats.totalRequests++;
    typeStats.requests++;

    // 检查失败缓存（避免重复请求不存在的资源）
    if (this.failedPaths.has(normalizedPath)) {
      this.stats.cacheHits++;
      typeStats.hits++;
      return null;
    }

    // 检查缓存
    const cached = cache.get(normalizedPath);
    if (cached) {
      this.stats.cacheHits++;
      typeStats.hits++;
      cached.lastAccess = Date.now();
      cached.accessCount++;
      return cached.data;
    }

    // 检查是否正在加载（去重：等待已有请求完成，不发起新网络请求）
    const pending = this.pendingLoads.get(normalizedPath);
    if (pending) {
      this.stats.dedupeHits++;
      typeStats.dedupeHits++;
      return (await pending) as T | null;
    }

    // 开始加载
    const loadPromise = fetcher(normalizedPath);
    this.pendingLoads.set(normalizedPath, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.pendingLoads.delete(normalizedPath);
    }
  }

  /**
   * 缓存加载结果的通用方法
   */
  private cacheResult<T>(
    cache: Map<string, CacheEntry<T>>,
    path: string,
    data: T,
    size: number,
    resourceType: ResourceType
  ): void {
    const entry: CacheEntry<T> = {
      data,
      size,
      loadTime: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1,
    };
    cache.set(path, entry);
    this.updateCacheStats();
    this.recordRecentLoad(path, resourceType, size);
  }

  /**
   * 记录加载失败
   */
  private recordFailure(path: string): void {
    this.stats.failures++;
    this.failedPaths.add(path);
  }

  // ==================== 文本资源 ====================

  /**
   * 加载文本资源（UTF-8）
   */
  async loadText(path: string): Promise<string | null> {
    const normalizedPath = this.normalizePath(path);
    return this.loadWithCache(
      normalizedPath,
      "text",
      this.textCache,
      (p) => this.fetchText(p)
    );
  }

  /**
   * 实际获取文本资源
   */
  private async fetchText(path: string): Promise<string | null> {
    this.stats.networkRequests++;
    this.stats.byType.text.loads++;

    try {
      const url = getResourceUrl(path);
      const response = await fetch(url);
      if (!response.ok) {
        this.recordFailure(path);
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
        this.recordFailure(path);
        return null;
      }

      const size = new Blob([text]).size;
      this.cacheResult(this.textCache, path, text, size, "text");
      return text;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load text: ${path}`, error);
      this.recordFailure(path);
      return null;
    }
  }

  // ==================== 二进制资源 ====================

  /**
   * 加载二进制资源
   */
  async loadBinary(path: string): Promise<ArrayBuffer | null> {
    const normalizedPath = this.normalizePath(path);
    return this.loadWithCache(
      normalizedPath,
      "binary",
      this.binaryCache,
      (p) => this.fetchBinary(p)
    );
  }

  /**
   * 实际获取二进制资源
   */
  private async fetchBinary(path: string): Promise<ArrayBuffer | null> {
    this.stats.networkRequests++;
    this.stats.byType.binary.loads++;

    try {
      const url = getResourceUrl(path);
      const response = await fetch(url);
      if (!response.ok) {
        logger.warn(
          `[ResourceLoader] Failed to load binary: ${path} (HTTP ${response.status} ${response.statusText})`
        );
        this.recordFailure(path);
        return null;
      }

      const buffer = await response.arrayBuffer();
      this.cacheResult(this.binaryCache, path, buffer, buffer.byteLength, "binary");
      return buffer;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load binary: ${path}`, error);
      this.recordFailure(path);
      return null;
    }
  }

  // ==================== 音频资源 ====================

  /**
   * 加载音频资源（返回 AudioBuffer）
   */
  async loadAudio(path: string): Promise<AudioBuffer | null> {
    const normalizedPath = this.normalizePath(path);
    return this.loadWithCache(
      normalizedPath,
      "audio",
      this.audioCache,
      (p) => this.fetchAudio(p)
    );
  }

  /**
   * 实际获取音频资源
   */
  private async fetchAudio(path: string): Promise<AudioBuffer | null> {
    this.stats.networkRequests++;
    this.stats.byType.audio.loads++;

    try {
      const url = getResourceUrl(path);
      const response = await fetch(url);
      if (!response.ok) {
        this.recordFailure(path);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioContext = this.getAudioContext();

      let audioBuffer: AudioBuffer;

      // 检查是否是 XNB 格式
      if (path.toLowerCase().endsWith(".xnb")) {
        // XNB 格式：使用自定义解析器
        const xnbResult = parseXnbAudio(arrayBuffer);
        if (!xnbResult.success || !xnbResult.data) {
          logger.warn(`[ResourceLoader] XNB parse failed: ${path} - ${xnbResult.error}`);
          this.recordFailure(path);
          return null;
        }
        audioBuffer = xnbToAudioBuffer(xnbResult.data, audioContext);
      } else {
        // 标准音频格式：使用浏览器解码
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      }

      // 缓存
      const estimatedSize = audioBuffer.length * audioBuffer.numberOfChannels * 4; // Float32
      this.cacheResult(this.audioCache, path, audioBuffer, estimatedSize, "audio");
      return audioBuffer;
    } catch (error) {
      logger.warn(`[ResourceLoader] Failed to load audio: ${path}`, error);
      this.recordFailure(path);
      return null;
    }
  }

  // ==================== INI/配置资源 ====================

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
      const url = getResourceUrl(path);
      const response = await fetch(url);
      if (!response.ok) {
        this.stats.failures++;
        // 缓存失败的路径，避免重复请求
        this.failedPaths.add(cacheKey);
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
        // 缓存失败的路径，避免重复请求
        this.failedPaths.add(cacheKey);
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
      // 缓存失败的路径，避免重复请求
      this.failedPaths.add(cacheKey);
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

    // 检查失败缓存（避免重复请求不存在的资源）
    if (this.failedPaths.has(cacheKey)) {
      this.stats.cacheHits++;
      typeStats.hits++;
      return null;
    }

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
      const url = getResourceUrl(path);
      const response = await fetch(url);
      if (!response.ok) {
        this.stats.failures++;
        // 缓存失败的路径，避免重复请求
        this.failedPaths.add(cacheKey);
        return null;
      }

      const buffer = await response.arrayBuffer();

      // 解析
      const parsed = parser(buffer);
      if (!parsed) {
        this.stats.failures++;
        // 解析失败也缓存，避免重复尝试解析无效文件
        this.failedPaths.add(cacheKey);
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
      // 缓存失败的路径，避免重复请求
      this.failedPaths.add(cacheKey);
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
   * 同步从缓存获取资源（必须先通过 load* 方法加载）
   * 用于战斗系统等不允许 async 的场景
   * @returns 已缓存的资源，如果不存在则返回 null
   */
  getFromCache<T>(path: string, type: ResourceType): T | null {
    const normalizedPath = this.normalizePath(path);
    switch (type) {
      case "text": {
        const entry = this.textCache.get(normalizedPath);
        if (entry) {
          entry.lastAccess = Date.now();
          entry.accessCount++;
          return entry.data as T;
        }
        return null;
      }
      case "binary": {
        const entry = this.binaryCache.get(normalizedPath);
        if (entry) {
          entry.lastAccess = Date.now();
          entry.accessCount++;
          return entry.data as T;
        }
        return null;
      }
      case "audio": {
        const entry = this.audioCache.get(normalizedPath);
        if (entry) {
          entry.lastAccess = Date.now();
          entry.accessCount++;
          return entry.data as T;
        }
        return null;
      }
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
        const entry = this.iniCache.get(cacheKey);
        if (entry) {
          entry.lastAccess = Date.now();
          entry.accessCount++;
          return entry.data as T;
        }
        return null;
      }
      default:
        return null;
    }
  }

  /**
   * 同步设置缓存（用于外部预加载的数据）
   * 例如：从 API 获取的武功配置数据
   */
  setCache<T>(path: string, data: T, type: ResourceType): void {
    const normalizedPath = this.normalizePath(path);
    const now = Date.now();

    // 估算数据大小
    const size = JSON.stringify(data).length;

    const cacheKey = `${type}:${normalizedPath}`;
    this.iniCache.set(cacheKey, {
      data,
      size,
      loadTime: now,
      lastAccess: now,
      accessCount: 0,
    });

    this.updateCacheStats();
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
      this.failedPaths.clear();
      // 关闭用于解码音频的 AudioContext，释放 OS 音频线程
      if (this.audioContext) {
        this.audioContext.close().catch(() => {});
        this.audioContext = null;
      }
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
        shd: { requests: 0, hits: 0, dedupeHits: 0, loads: 0 },
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

// ==================== 游戏数据加载器 ====================

/**
 * API 返回的武功等级数据
 */
export interface ApiMagicLevel {
  level: number;
  effect: number;
  manaCost: number;
  levelupExp: number | null;
  speed?: number;
  moveKind?: string;
  lifeFrame?: number;
}

/**
 * API 返回的攻击文件数据（嵌套武功）
 */
export interface ApiAttackFile {
  name: string;
  intro?: string;
  speed: number;
  bounce: boolean;
  region: number;
  moveKind: string;
  attackAll: boolean;
  flyingLum: number;
  lifeFrame: number;
  vanishLum: number;
  waitFrame: number;
  alphaBlend: boolean;
  bounceHurt: number;
  traceEnemy: boolean;
  traceSpeed: number;
  flyingImage: string | null;
  flyingSound: string | null;
  passThrough: boolean;
  rangeRadius: number;
  specialKind?: string;
  vanishImage: string | null;
  vanishSound: string | null;
  passThroughWall: boolean;
  vibratingScreen: boolean;
  specialKindValue: number;
  specialKindMilliSeconds: number;
}

/**
 * API 返回的单个武功数据
 */
export interface ApiMagicData {
  id: string;
  gameId: string;
  key: string;
  userType: "player" | "npc";
  name: string;
  intro?: string;
  icon: string | null;
  image: string | null;
  speed: number;
  belong?: string;
  bounce: boolean;
  levels: ApiMagicLevel[] | null;
  region: number;
  npcFile: string | null;
  flyMagic: string | null;
  moveKind?: string;
  attackAll: boolean;
  flyingLum: number;
  lifeFrame: number;
  parasitic: boolean;
  vanishLum: number;
  waitFrame: number;
  actionFile: string | null;
  alphaBlend: boolean;
  attackFile: ApiAttackFile | null;
  bounceHurt: number;
  traceEnemy: boolean;
  traceSpeed: number;
  beginAtUser: boolean;
  flyInterval: number;
  flyingImage: string | null;
  flyingSound: string | null;
  passThrough: boolean;
  rangeRadius: number;
  specialKind?: string;
  vanishImage: string | null;
  vanishSound: string | null;
  beginAtMouse: boolean;
  parasiticMagic: string | null;
  superModeImage: string | null;
  passThroughWall: boolean;
  vibratingScreen: boolean;
  coldMilliSeconds: number;
  explodeMagicFile: string | null;
  specialKindValue: number;
  parasiticInterval: number;
  specialKindMilliSeconds: number;
  createdAt: string;
  updatedAt: string;
}

/** 物品种类 */
type ApiGoodsKind = "Consumable" | "Equipment" | "Quest";

/** 装备部位 */
type ApiGoodsPart = "Hand" | "Head" | "Body" | "Foot" | "Neck" | "Back" | "Wrist";

/**
 * API 返回的物品数据
 */
export interface ApiGoodsData {
  id: string;
  gameId: string;
  key: string;
  kind: ApiGoodsKind;
  name: string;
  intro?: string;
  cost?: number | null;
  image?: string | null;
  icon?: string | null;
  effect?: string | null;
  life?: number | null;
  thew?: number | null;
  mana?: number | null;
  part?: ApiGoodsPart | null;
  lifeMax?: number | null;
  thewMax?: number | null;
  manaMax?: number | null;
  attack?: number | null;
  defend?: number | null;
  evade?: number | null;
  effectType?: number | null;
  script?: string | null;
}

/** NPC 类型 */
type ApiNpcKind = "Normal" | "Fighter" | "Flyer" | "GroundAnimal" | "WaterAnimal" | "Decoration" | "Intangible";

/** NPC 关系 */
type ApiNpcRelation = "Friendly" | "Neutral" | "Hostile" | "Partner";

/** NPC 资源（动画/音效）*/
interface ApiNpcResource {
  image: string | null;
  sound: string | null;
}

/** NPC 资源集合 */
export interface ApiNpcResources {
  stand?: ApiNpcResource;
  stand1?: ApiNpcResource;
  walk?: ApiNpcResource;
  run?: ApiNpcResource;
  jump?: ApiNpcResource;
  fightStand?: ApiNpcResource;
  fightWalk?: ApiNpcResource;
  fightRun?: ApiNpcResource;
  fightJump?: ApiNpcResource;
  sit?: ApiNpcResource;
  hurt?: ApiNpcResource;
  death?: ApiNpcResource;
  attack?: ApiNpcResource;
  attack1?: ApiNpcResource;
  attack2?: ApiNpcResource;
  special1?: ApiNpcResource;
  special2?: ApiNpcResource;
}

/**
 * API 返回的 NPC 数据
 */
export interface ApiNpcData {
  id: string;
  gameId: string;
  key: string;
  kind: ApiNpcKind;
  name: string;
  relation?: ApiNpcRelation | null;
  level?: number | null;
  life?: number | null;
  lifeMax?: number | null;
  thew?: number | null;
  thewMax?: number | null;
  mana?: number | null;
  manaMax?: number | null;
  attack?: number | null;
  defend?: number | null;
  evade?: number | null;
  exp?: number | null;
  lum?: number | null;
  dir?: number | null;
  walkSpeed?: number | null;
  pathFinder?: number | null;
  attackRadius?: number | null;
  flyIni?: string | null;
  bodyIni?: string | null;
  scriptFile?: string | null;
  deathScript?: string | null;
  resources?: ApiNpcResources | null;
  /** 资源文件名（npcRes key），与 SceneNpcEntry.npcIni 一致 */
  npcIni?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 物体类型 */
type ApiObjKind = "Dynamic" | "Static" | "Body" | "LoopingSound" | "RandSound" | "Door" | "Trap" | "Drop";

/** Obj 资源状态 */
export interface ApiObjResourceState {
  image?: string | null;
  sound?: string | null;
}

/** Obj 资源映射（状态 -> 资源） */
export interface ApiObjResources {
  common?: ApiObjResourceState | null;
  open?: ApiObjResourceState | null;
  opened?: ApiObjResourceState | null;
  closed?: ApiObjResourceState | null;
}

/**
 * API 返回的物体数据
 */
export interface ApiObjData {
  id: string;
  gameId: string;
  key: string;
  kind: ApiObjKind;
  name?: string;
  /** 资源文件名（objRes key），与 SceneObjEntry.objFile 一致 */
  objFile?: string | null;
  /** 内联的资源配置 */
  resources?: ApiObjResources | null;
  scriptFile?: string | null;
  scriptFileRight?: string | null;
  switchSound?: string | null;
  triggerRadius?: number | null;
  interval?: number | null;
  level?: number | null;
  height?: number | null;
  dir?: number | null;
  frame?: number | null;
  offX?: number | null;
  offY?: number | null;
  damage?: number | null;
  lum?: number | null;
  canInteractDirectly?: number | null;
  scriptFileJustTouch?: number | null;
  timerScriptFile?: string | null;
  timerScriptInterval?: number | null;
  reviveNpcIni?: string | null;
  wavFile?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Obj 资源文件数据（objres） */
export interface ApiObjResData {
  id: string;
  gameId: string;
  key: string;
  name: string;
  resources: ApiObjResources;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiMagicResponse {
  player: ApiMagicData[];
  npc: ApiMagicData[];
}

/** NPC 资源文件数据（npcres） */
export interface ApiNpcResData {
  id: string;
  gameId: string;
  key: string;
  name: string;
  resources: ApiNpcResources;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiNpcResponse {
  npcs: ApiNpcData[];
  resources: ApiNpcResData[];
}

export interface ApiObjResponse {
  objs: ApiObjData[];
  resources: ApiObjResData[];
}

/**
 * API 返回的商店商品项
 */
export interface ApiShopItemData {
  goodsKey: string;
  count: number;
  price: number;
}

/**
 * API 返回的商店数据
 */
export interface ApiShopData {
  id: string;
  gameId: string;
  key: string;
  name: string;
  numberValid: boolean;
  buyPercent: number;
  recyclePercent: number;
  items: ApiShopItemData[];
}

/**
 * API 返回的玩家角色数据
 */
export interface ApiPlayerData {
  id: string;
  gameId: string;
  key: string;
  name: string;
  index: number;
  npcIni: string;
  bodyIni: string;
  flyIni: string;
  flyIni2: string;
  levelIni: string;
  deathScript: string;
  scriptFile: string;
  secondAttack: string;
  timeScript: string;
  mapX: number;
  mapY: number;
  desX: number;
  desY: number;
  dir: number;
  kind: number;
  relation: number;
  pathFinder: number;
  idle: number;
  walkSpeed: number;
  visionRadius: number;
  attackRadius: number;
  dialogRadius: number;
  attackLevel: number;
  life: number;
  lifeMax: number;
  mana: number;
  manaMax: number;
  thew: number;
  thewMax: number;
  attack: number;
  defend: number;
  evade: number;
  exp: number;
  levelUpExp: number;
  level: number;
  money: number;
  lum: number;
  action: number;
  state: number;
  doing: number;
  fight: number;
  magic: number;
  belong: number;
  expBonus: number;
  manaLimit: number;
  timeCount: number;
  timeLimit: number;
  timeTrigger: number;
  /** 初始武功列表（从 API 配置） */
  initialMagics: Array<{ iniFile: string; level: number; exp: number }>;
  /** 初始物品列表（从 API 配置） */
  initialGoods: Array<{ iniFile: string; number: number }>;
}

/**
 * API 返回的游戏全局配置
 */
export interface ApiConfigResponse {
  gameEnabled: boolean;
  gameName: string;
  gameVersion: string;
  gameDescription: string;
  logoUrl: string;
  playerKey: string;
  initialMap: string;
  initialNpc: string;
  initialObj: string;
  initialBgm: string;
  titleMusic: string;
  newGameScript: string;
  portraitAsf: string;
  player: {
    thewCost: {
      runCost: number;
      attackCost: number;
      jumpCost: number;
      useThewWhenNormalRun: boolean;
    };
    restore: {
      lifeRestorePercent: number;
      thewRestorePercent: number;
      manaRestorePercent: number;
      restoreIntervalMs: number;
      sittingManaRestoreInterval: number;
    };
    speed: {
      baseSpeed: number;
      runSpeedFold: number;
      minChangeMoveSpeedPercent: number;
    };
    combat: {
      maxNonFightSeconds: number;
      dialogRadius: number;
    };
  };
  drop: unknown;
  magicExp?: {
    expByLevel: Array<{ level: number; exp: number }>;
    xiuLianMagicExpFraction: number;
    useMagicExpFraction: number;
  };
}

export interface ApiDataResponse {
  magics: ApiMagicResponse;
  goods: ApiGoodsData[];
  shops: ApiShopData[];
  npcs: ApiNpcResponse;
  objs: ApiObjResponse;
  players: ApiPlayerData[];
  portraits: Array<{ index: number; asfFile: string }>;
  talks: Array<{ id: number; portraitIndex: number; text: string }>;
}

// ========== 共享状态 ==========

let currentGameSlug = "";

// ========== 游戏配置缓存 ==========

let cachedGameConfig: ApiConfigResponse | null = null;
let isGameConfigLoadedFlag = false;
let configLoadingPromise: Promise<void> | null = null;

/**
 * 从 API 加载游戏全局配置
 */
export async function loadGameConfig(gameSlug: string, force = false): Promise<void> {
  if (!force && isGameConfigLoadedFlag && currentGameSlug === gameSlug) {
    return;
  }

  if (configLoadingPromise && currentGameSlug === gameSlug) {
    await configLoadingPromise;
    return;
  }

  configLoadingPromise = (async () => {
    const apiUrl = `/game/${gameSlug}/api/config?_t=${Date.now()}`;
    logger.info(`[ResourceLoader] Loading game config from ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      cachedGameConfig = await response.json();

      // 游戏未开放（不存在/未公开/未启用均返回 gameEnabled: false）
      if (!cachedGameConfig?.gameEnabled) {
        cachedGameConfig = null;
        throw new Error("GAME_NOT_AVAILABLE");
      }

      isGameConfigLoadedFlag = true;
      currentGameSlug = gameSlug;

      logger.info(
        `[ResourceLoader] Loaded config: playerKey=${cachedGameConfig?.playerKey}, gameName=${cachedGameConfig?.gameName}`
      );
    } catch (error) {
      logger.error(`[ResourceLoader] Failed to load game config:`, error);
      throw error;
    } finally {
      configLoadingPromise = null;
    }
  })();

  await configLoadingPromise;
}

export function isGameConfigLoaded(): boolean {
  return isGameConfigLoadedFlag;
}

export function getGameConfig(): ApiConfigResponse | null {
  return cachedGameConfig;
}

// ========== 游戏数据缓存 ==========

let cachedGameData: ApiDataResponse | null = null;
let isGameDataLoadedFlag = false;
let loadingPromise: Promise<void> | null = null;
const cacheBuilders: Array<() => void | Promise<void>> = [];

/**
 * 注册缓存构建回调（数据加载完成后自动调用）
 */
export function registerCacheBuilder(builder: () => void | Promise<void>): void {
  cacheBuilders.push(builder);
}

/**
 * 从 API 加载所有游戏数据
 */
export async function loadGameData(gameSlug: string, force = false): Promise<void> {
  if (!force && isGameDataLoadedFlag && currentGameSlug === gameSlug) {
    return;
  }

  if (loadingPromise && currentGameSlug === gameSlug) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    const apiUrl = `/game/${gameSlug}/api/data?_t=${Date.now()}`;
    logger.info(`[ResourceLoader] Loading game data from ${apiUrl}`);

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      cachedGameData = await response.json();
      isGameDataLoadedFlag = true;
      currentGameSlug = gameSlug;

      // 构建所有模块的缓存
      for (const builder of cacheBuilders) {
        await builder();
      }

      const magicCount = (cachedGameData?.magics.player.length ?? 0) + (cachedGameData?.magics.npc.length ?? 0);
      const goodsCount = cachedGameData?.goods.length ?? 0;
      const shopCount = cachedGameData?.shops.length ?? 0;
      const npcCount = cachedGameData?.npcs.npcs.length ?? 0;
      const npcResCount = cachedGameData?.npcs.resources.length ?? 0;
      const objCount = cachedGameData?.objs.objs.length ?? 0;
      const objResCount = cachedGameData?.objs.resources.length ?? 0;
      const portraitCount = cachedGameData?.portraits?.length ?? 0;
      const talkCount = cachedGameData?.talks?.length ?? 0;

      logger.info(
        `[ResourceLoader] Loaded: ${magicCount} magics, ${goodsCount} goods, ${shopCount} shops, ${npcCount} npcs, ${npcResCount} npcres, ${objCount} objs, ${objResCount} objres, ${portraitCount} portraits, ${talkCount} talks`
      );
    } catch (error) {
      logger.error(`[ResourceLoader] Failed to load game data:`, error);
      throw error;
    } finally {
      loadingPromise = null;
    }
  })();

  await loadingPromise;
}

export async function reloadGameData(gameSlug: string): Promise<void> {
  await loadGameData(gameSlug, true);
}

/**
 * 直接注入游戏数据（跳过 REST fetch），用于 Dashboard 等已有 tRPC 数据的场景
 *
 * 注入后会自动运行 cacheBuilders，使各模块缓存就绪
 */
export async function setGameData(gameSlug: string, data: ApiDataResponse): Promise<void> {
  cachedGameData = data;
  isGameDataLoadedFlag = true;
  currentGameSlug = gameSlug;

  for (const builder of cacheBuilders) {
    await builder();
  }

  const magicCount = (data.magics.player.length ?? 0) + (data.magics.npc.length ?? 0);
  const npcCount = data.npcs.npcs.length ?? 0;
  const objCount = data.objs.objs.length ?? 0;
  logger.info(
    `[ResourceLoader] setGameData: ${magicCount} magics, ${npcCount} npcs, ${objCount} objs`
  );
}

export function isGameDataLoaded(): boolean {
  return isGameDataLoadedFlag;
}

/**
 * 获取当前游戏 slug
 */
export function getGameSlug(): string {
  return currentGameSlug;
}

export function getMagicsData(): ApiMagicResponse | null {
  return cachedGameData?.magics ?? null;
}

export function getGoodsData(): ApiGoodsData[] | null {
  return cachedGameData?.goods ?? null;
}

export function getNpcsData(): ApiNpcResponse | null {
  return cachedGameData?.npcs ?? null;
}

export function getObjsData(): ApiObjResponse | null {
  return cachedGameData?.objs ?? null;
}

export function getShopsData(): ApiShopData[] | null {
  return cachedGameData?.shops ?? null;
}

export function getPlayersData(): ApiPlayerData[] | null {
  return cachedGameData?.players ?? null;
}

export function getPortraitsData(): Array<{ index: number; asfFile: string }> | null {
  return cachedGameData?.portraits ?? null;
}

export function getTalksData(): Array<{ id: number; portraitIndex: number; text: string }> | null {
  return cachedGameData?.talks ?? null;
}
