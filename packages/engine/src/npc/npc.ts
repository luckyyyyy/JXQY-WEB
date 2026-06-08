/**
 * Npc 类
 * 继承 Character，实现 AI、巡逻、战斗等 NPC 特有功能
 */

import { Character } from "../character";
import { loadCharacterConfig } from "../character/character-config";
import { logger } from "../core/logger";
import type { CharacterConfig, Vector2 } from "../core/types";
import { CharacterKind, CharacterState } from "../core/types";
import { MagicAddonEffect, type MagicData } from "../magic/types";
import { type EquipPosition, GoodKind } from "../player/goods/good";
import { equipPositionToSlotIndex, GoodsListManager } from "../player/goods/goods-list-manager";
import { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { AsfData } from "../resource/format/asf";
import { generateId, tileToPixel } from "../utils";
import { getPositionInDirection } from "../utils/direction";
import { distanceFromDelta } from "../utils/distance";
import { PathType } from "../utils/path-finder";
import { NpcAI, NpcMagicCache } from "./modules";
import type { NpcManager } from "./npc-manager";

/** Npc 类*/
export class Npc extends Character {
  private _id: string;
  private _actionPathTilePositions: Vector2[] | null = null;
  private _idledFrame: number = 0;
  private _isAIDisabled: boolean = false;
  private _blindMilliseconds: number = 0;

  // AI path for LoopWalk from FixedPos config
  private _fixedPathTilePositions: Vector2[] | null = null;

  // Script destination position
  private _destinationMapPosX: number = 0;
  private _destinationMapPosY: number = 0;
  protected _moveTargetChanged: boolean = false;

  // NpcManager 和 Player 现在通过 EngineContext 获取

  // Magic cache - 使用 NpcMagicCache 模块管理武功缓存
  private _magicCache!: NpcMagicCache;

  // AI behavior - 使用 NpcAI 模块管理 AI 行为
  private _ai!: NpcAI;

  // Partner containers (伙伴武功/物品)
  private _magicInventory: PlayerMagicInventory | null = null;
  private _goodsManager: GoodsListManager | null = null;

  /** API 注册角色 index（仅当 NPC 对应 API 玩家时设置） */
  playerIndex?: number;

  constructor(id?: string) {
    super();
    this._id = id || generateId();
  }

  /**
   * 初始化模块（在配置加载后调用）
   */
  private initModules(): void {
    this._magicCache = new NpcMagicCache(this.attackLevel || 1);
    this._ai = new NpcAI(this);
  }

  // === Partner Containers ===

  get magicInventory(): PlayerMagicInventory | null {
    return this._magicInventory;
  }

  get goodsManager(): GoodsListManager | null {
    return this._goodsManager;
  }

  /** 初始化伙伴武功/物品容器（仅伙伴 NPC） */
  initPartnerContainers(): void {
    if (!this.isPartner) return;
    if (!this._magicInventory) {
      this._magicInventory = new PlayerMagicInventory();
    }
    // 加载武功经验配置：awardKillExp 需要 xiuLianMagicExpFraction / useMagicExpFraction
    this._magicInventory.initializeMagicExp();
    if (!this._goodsManager) {
      this._goodsManager = new GoodsListManager();
    }
    // 伙伴共享 NpcManager 持有的等级配置管理器
    this.levelManager = this.npcManager.getLevelManager();
    // 设置装备回调，使装备属性生效（equiping/unEquiping 由基类 CharacterCombat 提供）
    this._goodsManager.setCallbacks({
      onEquiping: (good, currentEquip, justEffectType) => {
        this.equiping(good, currentEquip, justEffectType);
      },
      onUnEquiping: (good, justEffectType) => {
        this.unEquiping(good, justEffectType);
      },
    });
  }

  /**
   * 增加经验。伙伴 NPC 同时给修炼武功和当前使用武功加经验，与 Player.addExp 行为对齐。
   */
  override addExp(amount: number): void {
    if (this.isPartner && this._magicInventory) {
      this._magicInventory.awardKillExp(amount, this.name);
    }
    super.addExp(amount);
  }

  /**
   * 从等级配置 + 武功加成 + 装备加成重新计算基础属性。
   * 用于伙伴 NPC 读档完成后，与 Player.recalculateBaseStats() 对齐。
   * - 基础值：levelManager.getLevelDetail(level) (即主角等级难度表)
   * - 武功加成：所有已学武功（按当前等级数据）
   * - 装备加成：所有装备槽 + noNeedToEquip 背包物品
   */
  protected override getMagicInventoryForRecalc() {
    return this._magicInventory ?? undefined;
  }

  protected override getGoodsManagerForRecalc() {
    return this._goodsManager ?? undefined;
  }

  override recalculateBaseStats(): void {
    if (!this.isPartner) return;
    super.recalculateBaseStats();
    // NPC 额外同步升级经验
    const detail = this.levelManager.getLevelDetail(this.level);
    if (detail) this.levelUpExp = detail.levelUpExp;
  }

  // === Cross-Character Equipment Methods ===

  /**
   * 从主角背包取装备穿到伙伴身上
   * 如果伙伴该槽位已有装备，旧装备放回主角背包
   */
  equipFromPlayerBag(
    playerGoodsManager: GoodsListManager,
    playerBagIndex: number,
    equipPosition: EquipPosition
  ): boolean {
    if (!this._goodsManager) return false;

    const slotIdx = equipPositionToSlotIndex(equipPosition);
    if (slotIdx < 0) return false;

    // 获取主角背包中的物品
    const playerItem = playerGoodsManager.getItemInfo(playerBagIndex);
    if (!playerItem || playerItem.good.kind !== GoodKind.Equipment) return false;
    if (playerItem.good.part !== equipPosition) return false;

    // 获取伙伴当前装备
    const partnerEquip = this._goodsManager.getEquipAtPosition(equipPosition);

    // 如果伙伴有旧装备，放回主角背包
    if (partnerEquip) {
      const addResult = playerGoodsManager.addGoodToList(partnerEquip.good.fileName);
      if (!addResult.success) {
        playerGoodsManager.showBagFullMessage();
        return false;
      }
      // 恢复旧装备的堆叠数
      if (partnerEquip.count > 1) {
        const addedInfo = playerGoodsManager.getItemInfo(addResult.index);
        if (addedInfo) addedInfo.count = partnerEquip.count;
      }
    }

    // 从主角背包移除物品（减1个）
    if (playerItem.count > 1) {
      playerItem.count -= 1;
    } else {
      // 使用 deleteGood 来正确处理 noNeedToEquip 效果
      playerGoodsManager.deleteGoodByIndex(playerBagIndex);
    }

    // 穿到伙伴身上
    this._goodsManager.setEquipAtPosition(equipPosition, {
      good: playerItem.good,
      count: 1,
      remainColdMilliseconds: 0,
    });

    return true;
  }

  /**
   * 卸下伙伴装备，放回主角背包
   */
  unequipToPlayerBag(playerGoodsManager: GoodsListManager, equipPosition: EquipPosition): boolean {
    if (!this._goodsManager) return false;

    const partnerEquip = this._goodsManager.getEquipAtPosition(equipPosition);
    if (!partnerEquip) return false;

    // 放到主角背包
    const addResult = playerGoodsManager.addGoodToList(partnerEquip.good.fileName);
    if (!addResult.success) {
      playerGoodsManager.showBagFullMessage();
      return false;
    }

    // 从伙伴装备槽移除（触发 unEquiping 回调）
    this._goodsManager.setEquipAtPosition(equipPosition, null);

    return true;
  }

  /**
   * 从主角背包移动药品到伙伴快捷栏
   */
  movePlayerBagToPartnerBottom(
    playerGoodsManager: GoodsListManager,
    playerBagIndex: number,
    bottomSlot: number
  ): boolean {
    if (!this._goodsManager) return false;
    if (bottomSlot < 0 || bottomSlot >= 3) return false;

    const playerItem = playerGoodsManager.getItemInfo(playerBagIndex);
    if (!playerItem || playerItem.good.kind !== GoodKind.Drug) return false;

    // 如果伙伴快捷栏有旧物品，放回主角背包
    const existing = this._goodsManager.getBottomItemAtSlot(bottomSlot);
    if (existing) {
      const addResult = playerGoodsManager.addGoodToList(existing.good.fileName);
      if (!addResult.success) {
        playerGoodsManager.showBagFullMessage();
        return false;
      }
    }

    // 从主角背包移除
    if (playerItem.count > 1) {
      playerItem.count -= 1;
    } else {
      playerGoodsManager.deleteGoodByIndex(playerBagIndex);
    }

    // 设置到伙伴快捷栏
    this._goodsManager.setBottomItemAtSlot(bottomSlot, {
      good: playerItem.good,
      count: 1,
      remainColdMilliseconds: 0,
    });

    return true;
  }

  /**
   * 从伙伴快捷栏移除物品，放回主角背包
   */
  movePartnerBottomToPlayerBag(playerGoodsManager: GoodsListManager, bottomSlot: number): boolean {
    if (!this._goodsManager) return false;
    if (bottomSlot < 0 || bottomSlot >= 3) return false;

    const item = this._goodsManager.getBottomItemAtSlot(bottomSlot);
    if (!item) return false;

    const addResult = playerGoodsManager.addGoodToList(item.good.fileName);
    if (!addResult.success) {
      playerGoodsManager.showBagFullMessage();
      return false;
    }

    this._goodsManager.setBottomItemAtSlot(bottomSlot, null);
    return true;
  }

  // === Manager 访问（通过 EngineContext）===

  /**
   * 获取 MagicManager（通过 EngineContext）
   */
  /**
   * 获取 NpcManager（通过 EngineContext）
   */
  get npcManager(): NpcManager {
    return this.engine.npcManager;
  }

  /**
   * 获取 Player（通过 EngineContext）
   */
  get player(): Character {
    return this.engine.player;
  }

  canViewTargetForAI(startTile: Vector2, endTile: Vector2, visionRadius: number): boolean {
    return this.canViewTarget(startTile, endTile, visionRadius);
  }

  /**
   * NPC 寻路失败时直接停止，不使用方向回退
   * 避免 NPC 对着墙壁鬼畜式移动
   */
  protected override shouldFallbackToDirectionWalk(): boolean {
    return false;
  }

  /**
   * NPC walkTo 优化：避免每帧重跑 A* 导致方向抖动（鬼畜）
   *
   * 当 NPC 已经在走路时：
   * - 目标 tile 未变：跳过，不重算路径
   * - 目标 tile 变了（玩家移动）：立即重算路径追击
   */
  override walkTo(
    destTile: Vector2,
    pathTypeOverride: PathType = PathType.End,
    skipDirectionFallback = false
  ): boolean {
    if ((this.isWalking() || this.isRunning()) && this.path.length > 0) {
      if (!this.performActionOk()) return false;
      if (this._mapX === destTile.x && this._mapY === destTile.y) return true;

      if (
        destTile.x === this._destinationMoveTilePosition.x &&
        destTile.y === this._destinationMoveTilePosition.y
      ) {
        // 目标未变：跳过重算
        return true;
      }

      // 目标变了：立即重算路径
      // logger.debug(
      //   `[NpcAI] ${this._id} walkTo: target moved to (${destTile.x},${destTile.y}), repathing`
      // );
    }
    return super.walkTo(destTile, pathTypeOverride, skipDirectionFallback);
  }

  getRandTilePathForAI(count: number, isFlyer: boolean, maxOffset: number = -1): Vector2[] {
    return this.getRandTilePath(count, isFlyer, maxOffset);
  }

  loopWalkForAI(tilePositionList: Vector2[] | null, randMaxValue: number, isFlyer: boolean): void {
    this.loopWalk(tilePositionList, randMaxValue, isFlyer);
  }

  randWalkForAI(tilePositionList: Vector2[] | null, randMaxValue: number, isFlyer: boolean): void {
    this.randWalk(tilePositionList, randMaxValue, isFlyer);
  }

  // === Properties ===

  /**
   * override
   *
   * NPC PathType depends on Kind, relation, and _pathFinder value:
   * - Flyer: PathStraightLine (ignores obstacles)
   * - IsPartner: PerfectMaxPlayerTry（伙伴行为类似主角，需要完整 A* 上限）
   * - PathFinder=1: PerfectMaxNpcTry
   * - Normal NPC (Kind=0 or 5): PerfectMaxPlayerTry
   * - PathFinder=0 or IsInLoopWalk or IsEnemy: PathOneStep
   * - Default: PerfectMaxNpcTry
   */
  override getPathType(): PathType {
    if (this.kind === CharacterKind.Flyer) {
      return PathType.PathStraightLine;
    }

    if (this.isPartner) {
      return PathType.PerfectMaxPlayerTry;
    }

    if (this.pathFinder === 1) {
      return PathType.PerfectMaxNpcTry;
    }

    if (this.kind === CharacterKind.Normal || this.kind === CharacterKind.Eventer) {
      return PathType.PerfectMaxPlayerTry;
    }

    if (this.pathFinder === 0 || this._isInLoopWalk || this.isEnemy) {
      return PathType.PathOneStep;
    }

    // Default
    return PathType.PerfectMaxNpcTry;
  }

  get id(): string {
    return this._id;
  }

  get actionPathTilePositions(): Vector2[] {
    if (this._actionPathTilePositions === null) {
      this._actionPathTilePositions = this.getRandTilePath(8, this.kind === CharacterKind.Flyer);
    }
    return this._actionPathTilePositions;
  }

  set actionPathTilePositions(value: Vector2[]) {
    this._actionPathTilePositions = value;
  }

  get idledFrame(): number {
    return this._idledFrame;
  }

  set idledFrame(value: number) {
    this._idledFrame = value;
  }

  get isAIDisabled(): boolean {
    return this._isAIDisabled;
  }

  set isAIDisabled(value: boolean) {
    this._isAIDisabled = value;
  }

  get blindMilliseconds(): number {
    return this._blindMilliseconds;
  }

  set blindMilliseconds(value: number) {
    this._blindMilliseconds = value;
  }

  get actionType(): number {
    return this.action;
  }

  set actionType(value: number) {
    this.action = value;
  }

  // followTarget, isFollowTargetFound - inherited from Character
  // idle, aiType, stopFindingTarget, keepRadiusWhenLifeLow, lifeLowPercent, keepRadiusWhenFriendDeath - inherited from Character

  get destinationMapPosX(): number {
    return this._destinationMapPosX;
  }

  set destinationMapPosX(value: number) {
    this._destinationMapPosX = value;
  }

  get destinationMapPosY(): number {
    return this._destinationMapPosY;
  }

  set destinationMapPosY(value: number) {
    this._destinationMapPosY = value;
  }

  // aiType getter/setter - inherited from Character
  // isRandMoveRandAttack, isNotFightBackWhenBeHit - inherited from CharacterBase

  get fixedPathTilePositions(): Vector2[] | null {
    return this._fixedPathTilePositions;
  }

  set fixedPathTilePositions(value: Vector2[] | null) {
    this._fixedPathTilePositions = value;
  }

  /** 移动目标是否已改变（供 AI 模块使用）*/
  get moveTargetChanged(): boolean {
    return this._moveTargetChanged;
  }

  set moveTargetChanged(value: boolean) {
    this._moveTargetChanged = value;
  }

  // === Setup ===

  // NpcManager 和 Player 现在通过 getter 从 EngineContext 获取，无需 setAIReferences

  /**
   * 预加载 NPC 的所有武功（唯一的异步入口）
   * Magic objects are loaded when Character is constructed
   *
   * 使用 NpcMagicCache 模块管理
   */
  async loadAllMagics(): Promise<void> {
    return this._magicCache.loadAll(
      this._flyIniInfos,
      {
        lifeLow: this.magicToUseWhenLifeLow,
        beAttacked: this.magicToUseWhenBeAttacked,
        death: this.magicToUseWhenDeath,
      },
      this.name
    );
  }

  /**
   * 获取已缓存的武功数据（同步）
   * 如果未缓存，返回 null（需要先调用 loadAllMagics）
   */
  getCachedMagic(magicIni: string): MagicData | null {
    return this._magicCache.get(magicIni);
  }

  /**
   * 清除武功缓存（用于热重载武功配置）
   */
  clearMagicCache(): void {
    this._magicCache.clear();
  }

  /**
   * 动态添加武功到缓存（供 AddOneMagic 脚本命令使用）
   */
  async addMagicToCache(magicIni: string): Promise<MagicData | null> {
    return this._magicCache.add(magicIni);
  }

  /**
   * 设置 NPC 武功等级（供 SetNpcMagicLevel 脚本命令使用）
   * 会清除缓存并在下次加载时使用新等级
   */
  setMagicAttackLevel(level: number): void {
    this._magicCache.setAttackLevel(level);
  }

  // === Factory Methods ===

  /**
   * Create NPC from config file path
   * (string filePath) constructor
   */
  static async fromFile(
    configPath: string,
    tileX: number,
    tileY: number,
    direction: number = 4
  ): Promise<Npc | null> {
    const config = await loadCharacterConfig(configPath);
    if (!config) {
      return null;
    }
    return Npc.fromConfig(config, tileX, tileY, direction);
  }

  /**
   * Create NPC from config object
   * (KeyDataCollection) constructor
   */
  static fromConfig(
    config: CharacterConfig,
    tileX: number,
    tileY: number,
    direction: number = 4
  ): Npc {
    const npc = new Npc();
    npc.loadFromConfig(config);
    npc.initModules(); // 配置加载后初始化模块
    npc.initPartnerContainers(); // 伙伴初始化武功/物品容器
    npc.setPosition(tileX, tileY);
    npc._currentDirection = direction;
    return npc;
  }

  // === Death Handling ===

  /**
   * Override death to run death script
   * Character.Death() runs _currentRunDeathScript = ScriptManager.RunScript(DeathScript, this)
   */
  override death(killer: Character | null = null): void {
    if (this.isDeathInvoked) return;

    // NpcManager.AddDead(this)
    this.npcManager.addDead(this);

    // 使用死亡时的武功 (MagicToUseWhenDeath)
    this.useMagicWhenDeath(killer);

    // Run death script
    if (this.deathScript) {
      logger.debug(`[NPC] ${this.name} running death script: ${this.deathScript}`);
      this.npcManager.runDeathScript(this.deathScript, this);
    }

    // Call base implementation (sets state, handles summoned NPCs, plays death animation)
    super.death(killer);
  }

  /**
   * 使用死亡时的武功
   * 检查 MagicToUseWhenDeath
   *
   * 逻辑:
   * if (character.MagicToUseWhenDeath != null) {
   *     var magicDirectionType = character.MagicDirectionWhenDeath;
   *     Vector2 magicDirection = 根据 magicDirectionType 计算方向;
   *     MagicManager.UseMagic(character, MagicToUseWhenDeath, position, position + magicDirection);
   * }
   */
  private useMagicWhenDeath(killer: Character | null): void {
    const magic = this._magicCache.getSpecial("death");
    if (!magic) {
      return;
    }

    // MagicDirectionWhenDeath 决定武功方向
    // 0 = 当前朝向, 1 = 朝向攻击者, 2 = 攻击者位置
    const dirType = this.magicDirectionWhenDeath;
    let destination: Vector2;

    if (dirType === 1 && killer) {
      // 朝向攻击者方向
      const dx = killer.pixelPosition.x - this._positionInWorld.x;
      const dy = killer.pixelPosition.y - this._positionInWorld.y;
      const len = distanceFromDelta(dx, dy);
      if (len > 0) {
        destination = {
          x: this._positionInWorld.x + (dx / len) * 32,
          y: this._positionInWorld.y + (dy / len) * 32,
        };
      } else {
        destination = { ...this._positionInWorld };
      }
    } else if (dirType === 2 && killer) {
      // 攻击者位置
      destination = { ...killer.pixelPosition };
    } else {
      // 当前朝向 (默认)
      destination = getPositionInDirection(this._positionInWorld, this._currentDirection);
    }

    logger.debug(`[NPC] ${this.name} uses MagicToUseWhenDeath: ${this.magicToUseWhenDeath}`);

    this.engine.magicSpriteManager.useMagic({
      userId: this._id,
      magic: magic,
      origin: this._positionInWorld,
      destination,
    });
  }

  // === AI Update ===

  /**
   * 主更新循环：先推进状态机（动画 + 状态转换），再执行 AI。
   * 确保攻击动画结束→站立→AI 立即发起新攻击，避免 1 帧站立闪烁。
   */
  override update(deltaTime: number): void {
    if (!this.isVisibleByVariable) return;

    if (this.isDeathInvoked || this.isDeath) {
      super.update(deltaTime);
      return;
    }

    super.update(deltaTime);
    this._ai.update(deltaTime);
  }

  // === AI 公共方法（供 NpcAI 模块调用）===

  /**
   * 获取被攻击时使用的预加载武功数据（同步）
   * 供 CollisionHandler 在碰撞检测时使用
   */
  getBeAttackedMagicData(): MagicData | null {
    return this._magicCache.getSpecial("beAttacked");
  }

  /**
   * Use magic when life is low - 公开给 AI 模块使用
   * PerformeAttack(PositionInWorld + Utils.GetDirection8(CurrentDirection), MagicToUseWhenLifeLow)
   */
  useMagicWhenLifeLow(): void {
    const magic = this._magicCache.getSpecial("lifeLow");
    if (!magic) {
      return;
    }

    // Get direction offset for current direction
    const destination = getPositionInDirection(this._positionInWorld, this._currentDirection);

    this.engine.magicSpriteManager.useMagic({
      userId: this._id,
      magic: magic,
      origin: this._positionInWorld,
      destination,
    });

    logger.debug(`[NPC] ${this.name} uses MagicToUseWhenLifeLow: ${this.magicToUseWhenLifeLow}`);
  }

  // === Partner Attack Magic Selection ===

  /**
   * Override: 伙伴优先从技能栏/面板选择武功，否则走 FlyIni
   */
  protected override selectMagicForAttack(useDistance: number): string | null {
    if (this.isPartner && this._magicInventory) {
      const magic = this.pickPartnerMagic();
      if (magic) return magic;
    }
    return super.selectMagicForAttack(useDistance);
  }

  /**
   * 伙伴武功选择：快捷栏优先 → 面板前5 → null
   */
  private pickPartnerMagic(): string | null {
    const inv = this._magicInventory;
    if (!inv) return null;

    // Priority 1: 快捷栏武功
    const bottomItems = inv.getBottomSlotsItems();
    const bottomMagics: string[] = [];
    for (const info of bottomItems) {
      if (info?.magic) bottomMagics.push(info.magic.fileName);
    }
    if (bottomMagics.length > 0) {
      return this.weightedRandomPick(bottomMagics);
    }

    // Priority 2: 面板前5个武功
    const panelMagics: string[] = [];
    for (let i = 1; i <= 500 && panelMagics.length < 5; i++) {
      const info = inv.getItemInfo(i);
      if (info?.magic) panelMagics.push(info.magic.fileName);
    }
    if (panelMagics.length > 0) {
      return this.weightedRandomPick(panelMagics);
    }

    return null;
  }

  /**
   * 加权随机选择：第一个概率最高，依次递减
   * 权重: [5, 4, 3, 2, 1]
   */
  private weightedRandomPick(items: string[]): string {
    const weights = [5, 4, 3, 2, 1];
    let totalWeight = 0;
    for (let i = 0; i < items.length; i++) {
      totalWeight += weights[i] ?? 1;
    }
    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i] ?? 1;
      if (random <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  /**
   * Attacking(destinationTilePosition)
   * 始终使用 Attack/Attack1/Attack2 状态（而非 Magic 状态）。
   * 武功在攻击动画结束时通过 _magicToUseWhenAttack 发射。
   * CharacterState.Magic 仅用于玩家手动释放武功（UseMagic），NPC 不应使用。
   */
  attacking(destinationTilePosition: Vector2): void {
    if (
      !this.canPerformAction() ||
      !(
        this.isStateImageOk(CharacterState.Attack) ||
        this.isStateImageOk(CharacterState.Attack1) ||
        this.isStateImageOk(CharacterState.Attack2)
      )
    ) {
      return;
    }

    this._destinationAttackTilePosition = destinationTilePosition;

    const result = this.attackingIsOk();
    if (result.isOk) {
      this.performAttack(destinationTilePosition, result.magicIni ?? undefined);
    }
  }

  /**
   * Perform the actual attack - set state and play animation
   * PerformeAttack(destinationPositionInWorld, Magic magicToUse)
   *
   * 使用基类的 performeAttack 方法，传入武功文件名和缓存的武功数据
   *
   * @param targetTilePosition 目标瓦片位置
   * @param magicIni 可选的武功文件名（如果有配置 FlyIni）
   */
  private performAttack(targetTilePosition: Vector2, magicIni?: string): void {
    // 转换为像素位置
    const destPixel = tileToPixel(targetTilePosition.x, targetTilePosition.y);
    // 获取缓存的武功数据（FlyIni 缓存优先，伙伴从武功栏查找）
    let magicData: MagicData | undefined;
    if (magicIni) {
      magicData = this.getCachedMagic(magicIni) ?? undefined;
      if (!magicData && this.isPartner && this._magicInventory) {
        const info = this._magicInventory.getMagicByFileName(magicIni);
        if (info?.magic) magicData = info.magic;
      }
    }
    this.performeAttack(destPixel, magicIni, magicData);
  }

  /**
   * Override: 攻击动画结束时发射武功
   * MagicManager.UseMagic(this, _magicToUseWhenAttack, PositionInWorld, _attackDestination)
   *
   * NPC 使用缓存的武功数据，避免异步加载延迟
   */
  protected override useMagicWhenAttack(): void {
    if (!this._magicToUseWhenAttack || !this._attackDestination) {
      // 没有配置武功，清理并返回
      this._magicToUseWhenAttack = null;
      this._attackDestination = null;
      return;
    }

    // NPC 使用缓存的武功数据（FlyIni 缓存优先，伙伴从武功栏查找）
    let magic = this.getCachedMagic(this._magicToUseWhenAttack);
    let partnerMagicInfo: import("../magic/types").MagicItemInfo | null = null;
    if (this.isPartner && this._magicInventory) {
      partnerMagicInfo = this._magicInventory.getMagicByFileName(this._magicToUseWhenAttack);
      if (!magic && partnerMagicInfo?.magic) {
        magic = partnerMagicInfo.magic;
      }
    }

    if (magic) {
      // 应用武器附加效果（中毒/冰冻/石化）到武功
      if (this._flyIniAdditionalEffect !== MagicAddonEffect.None) {
        magic = {
          ...magic,
          additionalEffect: this._flyIniAdditionalEffect,
        };
      }

      // 伙伴：将正在释放的武功登记为 currentMagicInUse，
      // 以便 CollisionHandler / awardKillExp 能定位到该武功并累计经验
      if (partnerMagicInfo && this._magicInventory) {
        this._magicInventory.setCurrentMagicInUse(partnerMagicInfo);
      }

      this.engine.magicSpriteManager.useMagic({
        userId: this._id,
        magic: magic,
        origin: this._positionInWorld,
        destination: this._attackDestination,
      });

      logger.debug(`[NPC] ${this.name} used attack magic: ${this._magicToUseWhenAttack}`);
    } else {
      logger.warn(`[NPC] ${this.name} has no cached magic for: ${this._magicToUseWhenAttack}`);
    }

    // 清理
    this._magicToUseWhenAttack = null;
    this._attackDestination = null;
  }

  /**
   * Override: Called when attack animation completes
   * Reference: Character.OnAttacking(_attackDestination)
   *
   * 武功发射已经在 useMagicWhenAttack() 中处理
   * 这里只做清理工作
   */
  protected override onAttacking(_attackDestinationPixelPosition: Vector2 | null): void {
    // 清理攻击目标位置
    this._destinationAttackTilePosition = null;
  }

  /**
   * CancelAttackTarget()
   */
  cancelAttackTarget(): void {
    this._destinationAttackTilePosition = null;
  }

  /**
   * Override: Called when character takes damage
   * triggers MagicToUseWhenBeAttacked
   *
   * Note: MagicToUseWhenBeAttacked 现在在 MagicManager.handleMagicToUseWhenBeAttacked 中处理，
   * 因为需要武功精灵的方向信息。这里只处理其他受伤反应。
   */
  protected override onDamaged(attacker: Character | null, damage: number): void {
    // 调用父类方法
    super.onDamaged(attacker, damage);

    // 其他受伤反应可以在这里处理
    // MagicToUseWhenBeAttacked 由 MagicManager.characterHited 处理
  }

  // === Obstacle Check ===

  /**
   * override HasObstacle(tilePosition)
   * Check if position is blocked (includes NPCs, objects, magic)
   * NPC version adds Flyer check and player position check
   *
   * 注意：Npc.HasObstacle 不检查地图障碍，地图障碍由 PathFinder 单独处理
   */
  override hasObstacle(tilePosition: Vector2): boolean {
    if (this.kind === CharacterKind.Flyer) return false;

    if (this.hasEntityObstacle(tilePosition)) return true;

    // Check player position
    if (this.player.mapX === tilePosition.x && this.player.mapY === tilePosition.y) {
      return true;
    }

    return false;
  }

  // === Special Actions ===

  /**
   * Start special action animation
   *
   */
  startSpecialAction(asf: AsfData | null): void {
    this.isInSpecialAction = true;
    this.specialActionLastDirection = this._currentDirection;
    this.specialActionFrame = 0;

    if (asf) {
      this._texture = asf;
      this._currentFrameIndex = 0;
      const framesPerDir = asf.framesPerDirection || 1;
      this._leftFrameToPlay = framesPerDir;
      this._frameEnd = framesPerDir - 1;
    }
  }

  /**
   * Set custom action file for a state
   * 直接调用父类的 setNpcActionFile
   */
  setActionFile(stateType: number, asfFile: string): void {
    this.setNpcActionFile(stateType, asfFile);
    logger.debug(`[Npc] SetActionFile: ${this.name}, state=${stateType}, file=${asfFile}`);
  }

  /**
   * FixedPos getter
   */
  getFixedPos(): string {
    // Return empty string - the actual path is stored in _fixedPathTilePositions
    return "";
  }

  /**
   * FixedPos setter - parse and set LoopWalk path
   * Overrides base to also parse the path
   */
  override setFixedPos(value: string): void {
    this.fixedPos = value; // Store original value
    this._fixedPathTilePositions = this.parseFixedPos(value);
  }

  /**
   * ToFixedPosTilePositionList(fixPos)
   * Parse FixedPos hex string to tile position list
   */
  private parseFixedPos(fixPos: string): Vector2[] | null {
    return parseFixedPos(fixPos);
  }
}

/**
 * Parse FixedPos hex string to tile position list.
 *
 * FixedPos string pattern: xx000000yy000000xx000000yy000000
 * Each coordinate pair is encoded as 2 hex chars followed by 6 zero-padding
 * chars, so each "step" is 8 chars.
 *
 * Reusable standalone version of Npc.parseFixedPos / splitStringInCharCount.
 */
export function parseFixedPos(fixPos: string): Vector2[] | null {
  const steps: string[] = [];
  for (let i = 0; i < fixPos.length; i += 8) {
    steps.push(fixPos.substring(i, i + 8));
  }
  const count = steps.length;
  if (count < 4) return null; // Less than 2 positions

  const path: Vector2[] = [];
  try {
    for (let i = 0; i < count - 1; i += 2) {
      const xHex = steps[i].substring(0, 2);
      const yHex = steps[i + 1].substring(0, 2);
      const x = parseInt(xHex, 16);
      const y = parseInt(yHex, 16);
      if (x === 0 && y === 0) break;
      path.push({ x, y });
    }
    return path.length >= 2 ? path : null;
  } catch {
    // parse failed
    return null;
  }
}
