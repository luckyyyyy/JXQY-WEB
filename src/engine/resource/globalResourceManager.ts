/**
 * GlobalResourceManager - 全局资源管理器
 *
 * 统一管理游戏运行所需的全局配置数据，这些数据在整个游戏生命周期内只加载一次。
 *
 * 对应 C# 的:
 * - JxqyGame.Initialize(): TalkTextList.Initialize()
 * - JxqyGame.LoadContent(): Utils.LoadMagicExpList(), PartnerList.Load()
 *
 * ================== 包含的全局资源 ==================
 *
 * 1. TalkTextList - 对话文本数据 (TalkIndex.txt)
 * 2. LevelManager - 等级配置 (Level-easy.ini 等)
 * 3. MagicExpManager - 武功经验配置 (MagicExp.ini)
 * 4. PartnerList - 伙伴名单 (PartnerIdx.ini)
 *
 * ===================================================
 */

import { TalkTextListManager } from "../listManager";
import { LevelManager } from "../level";
import { parseIni } from "../core/utils";
import { resourceLoader } from "./resourceLoader";

/**
 * 武功经验配置
 * 对应 C# Utils.cs 中的 MagicExp 相关
 */
export interface MagicExpConfig {
  /** 根据命中角色等级获取经验值 */
  expByLevel: Map<number, number>;
  /** 修炼武功经验倍率 */
  xiuLianMagicExpFraction: number;
  /** 使用武功经验倍率 */
  useMagicExpFraction: number;
}

/**
 * 伙伴列表
 * 对应 C# PartnerList.cs
 */
export interface PartnerListData {
  /** 索引 -> 名称 */
  list: Map<number, string>;
}

/**
 * 全局资源管理器
 *
 * 由 GameEngine 创建和管理，生命周期与 GameEngine 一致。
 */
export class GlobalResourceManager {
  // ============= 全局资源 =============
  readonly talkTextList: TalkTextListManager;
  readonly levelManager: LevelManager;

  // 武功经验配置
  private magicExpConfig: MagicExpConfig = {
    expByLevel: new Map(),
    xiuLianMagicExpFraction: 1.0,
    useMagicExpFraction: 1.0,
  };

  // 伙伴列表
  private partnerList: PartnerListData = {
    list: new Map(),
  };

  // 初始化状态
  private isInitialized: boolean = false;

  constructor() {
    this.talkTextList = new TalkTextListManager();
    this.levelManager = new LevelManager();
  }

  /**
   * 初始化所有全局资源（只执行一次）
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("[GlobalResourceManager] Already initialized");
      return;
    }

    console.log("[GlobalResourceManager] Initializing global resources...");

    // 1. 加载对话文本 - 对应 C# TalkTextList.Initialize()
    console.log("[GlobalResourceManager] Loading TalkTextList...");
    await this.talkTextList.initialize();

    // 2. 加载等级配置 - 对应 C# Utils.GetLevelLists()
    console.log("[GlobalResourceManager] Loading LevelManager...");
    await this.levelManager.initialize();

    // 3. 加载武功经验配置 - 对应 C# Utils.LoadMagicExpList()
    console.log("[GlobalResourceManager] Loading MagicExp...");
    await this.loadMagicExpList();

    // 4. 加载伙伴名单 - 对应 C# PartnerList.Load()
    console.log("[GlobalResourceManager] Loading PartnerList...");
    await this.loadPartnerList();

    this.isInitialized = true;
    console.log("[GlobalResourceManager] All global resources initialized");
  }

  /**
   * 是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  // ============= 武功经验配置 =============

  /**
   * 加载武功经验配置
   * 对应 C# Utils.LoadMagicExpList()
   */
  private async loadMagicExpList(): Promise<void> {
    const path = "/resources/ini/level/MagicExp.ini";
    try {
      const content = await resourceLoader.loadText(path);
      if (!content) {
        console.warn(`[GlobalResourceManager] MagicExp.ini not found`);
        return;
      }

      this.parseMagicExpIni(content);
      console.log(`[GlobalResourceManager] MagicExp loaded: ${this.magicExpConfig.expByLevel.size} levels`);
    } catch (error) {
      console.error(`[GlobalResourceManager] Error loading MagicExp.ini:`, error);
    }
  }

  /**
   * 解析武功经验配置文件
   */
  private parseMagicExpIni(content: string): void {
    const sections = parseIni(content);

    // Parse [Exp] section
    if (sections["Exp"]) {
      for (const [key, value] of Object.entries(sections["Exp"])) {
        const level = parseInt(key, 10);
        const exp = parseInt(value, 10);
        if (!isNaN(level) && !isNaN(exp)) {
          this.magicExpConfig.expByLevel.set(level, exp);
        }
      }
    }

    // Parse [XiuLianMagicExp] section
    if (sections["XiuLianMagicExp"]?.["Fraction"]) {
      this.magicExpConfig.xiuLianMagicExpFraction = parseFloat(sections["XiuLianMagicExp"]["Fraction"]) || 1.0;
    }

    // Parse [UseMagicExp] section
    if (sections["UseMagicExp"]?.["Fraction"]) {
      this.magicExpConfig.useMagicExpFraction = parseFloat(sections["UseMagicExp"]["Fraction"]) || 1.0;
    }
  }

  /**
   * 获取武功经验（根据命中角色等级）
   * 对应 C# Utils.GetMagicExp()
   */
  getMagicExp(hitedCharacterLevel: number): number {
    if (this.magicExpConfig.expByLevel.has(hitedCharacterLevel)) {
      return this.magicExpConfig.expByLevel.get(hitedCharacterLevel)!;
    }
    // 返回最高等级的经验值
    let maxLevel = 0;
    let maxExp = 0;
    for (const [level, exp] of this.magicExpConfig.expByLevel) {
      if (level > maxLevel) {
        maxLevel = level;
        maxExp = exp;
      }
    }
    return maxExp;
  }

  /**
   * 获取修炼武功经验倍率
   */
  getXiuLianMagicExpFraction(): number {
    return this.magicExpConfig.xiuLianMagicExpFraction;
  }

  /**
   * 获取使用武功经验倍率
   */
  getUseMagicExpFraction(): number {
    return this.magicExpConfig.useMagicExpFraction;
  }

  // ============= 伙伴列表 =============

  /**
   * 加载伙伴名单
   * 对应 C# PartnerList.Load()
   */
  private async loadPartnerList(): Promise<void> {
    const path = "/resources/Content/PartnerIdx.ini";
    try {
      const content = await resourceLoader.loadText(path);
      if (!content) {
        console.warn(`[GlobalResourceManager] PartnerIdx.ini not found`);
        return;
      }

      this.parsePartnerListIni(content);
      console.log(`[GlobalResourceManager] PartnerList loaded: ${this.partnerList.list.size} partners`);
    } catch (error) {
      console.error(`[GlobalResourceManager] Error loading PartnerIdx.ini:`, error);
    }
  }

  /**
   * 解析伙伴名单文件
   */
  private parsePartnerListIni(content: string): void {
    const sections = parseIni(content);

    // 获取第一个 section（伙伴列表）
    const firstSectionName = Object.keys(sections)[0];
    if (firstSectionName) {
      for (const [key, value] of Object.entries(sections[firstSectionName])) {
        const index = parseInt(key, 10);
        if (!isNaN(index)) {
          this.partnerList.list.set(index, value);
        }
      }
    }
  }

  /**
   * 获取伙伴总数
   * 对应 C# PartnerList.GetCount()
   */
  getPartnerCount(): number {
    return this.partnerList.list.size;
  }

  /**
   * 根据名称获取伙伴索引
   * 对应 C# PartnerList.GetIndex()
   */
  getPartnerIndex(name: string): number {
    for (const [index, partnerName] of this.partnerList.list) {
      if (partnerName === name) return index;
    }
    return this.getPartnerCount() + 1;
  }

  /**
   * 根据索引获取伙伴名称
   * 对应 C# PartnerList.GetName()
   */
  getPartnerName(index: number): string | null {
    return this.partnerList.list.get(index) ?? null;
  }
}
