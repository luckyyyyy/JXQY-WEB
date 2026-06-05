/**
 * UIBridge - 引擎与 UI 层之间的桥接器
 *
 * 职责：
 * 1. 监听引擎事件，转换为标准化 UI 状态
 * 2. 接收 UI 动作，转发给引擎
 * 3. 管理状态订阅者
 *
 * 这是引擎暴露给 UI 层的唯一接口，UI 层不应直接访问引擎内部。
 */

import { logger } from "../core/logger";
import type { TypedEventEmitter } from "../events/event-emitter";
import {
  type GameEventMap,
  GameEvents,
  type UIBuyChangeEvent,
  type UIDialogChangeEvent,
  type UIGambleChangeEvent,
  type UISlotChangeEvent,
  type UIDoudizhuChangeEvent,
  type UIMemoChangeEvent,
  type UIMessageChangeEvent,
  type UIMultiSelectionChangeEvent,
  type UIPanelChangeEvent,
  type UISelectionChangeEvent,
  type UIVideoPlayEvent,
} from "../events/game-events";
import type { MemoListManager } from "../gui/memo-list-manager";
import type { MagicItemInfo } from "../magic/types";
import {
  EQUIP_SLOT_COUNT,
  type GoodsItemInfo,
  type GoodsListManager,
  STORE_INDEX_BEGIN,
  STORE_INDEX_END,
} from "../player/goods/goods-list-manager";
import { MAGIC_LIST_CONFIG } from "../player/magic/magic-list-config";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { Player } from "../player/player";
import type { TimerManager } from "../runtime/timer-manager";
import type { BuyManager, ShopItemInfo } from "./buy-manager";
import type { GambleManager } from "./gamble-manager";
import type { SlotManager } from "./slot-manager";
import type { DoudizhuManager } from "./doudizhu/doudizhu-manager";
import type {
  MultiSelectionGuiState,
  SelectionGuiState,
  UIAction,
  UIBridge,
  UIDialogState,
  UIEquipSlots,
  UIGoodsSlot,
  UIGoodsState,
  UIMagicSlot,
  UIMagicState,
  UIMemoEntry,
  UIMemoState,
  UIMessageState,
  UIMultiSelectionState,
  UIPanelName,
  UIPanelVisibility,
  UIPlayerState,
  UISelectionOption,
  UISelectionState,
  UIShopItem,
  UIShopState,
  UISnapshot,
  UIStateSubscriber,
  UITimerState,
  UIGambleState,
  UISlotState,
  UIDoudizhuState,
  UIVideoState,
} from "./ui-types";

// ============= 数据转换工具 =============

function convertGoodsItemToSlot(info: GoodsItemInfo | null, index: number): UIGoodsSlot {
  return {
    index,
    good: info?.good ?? null,
    count: info?.count ?? 0,
  };
}

function convertMagicInfoToSlot(info: MagicItemInfo | null, index: number): UIMagicSlot | null {
  if (!info?.magic) return null;
  const magic = info.magic;
  return {
    index,
    magic: {
      fileName: magic.fileName,
      name: magic.name,
      intro: magic.intro,
      imagePath: magic.image ?? magic.icon ?? "",
      iconPath: magic.icon ?? magic.image ?? "",
      level: info.level,
      maxLevel: magic.maxLevel || 10,
      currentLevelExp: info.exp,
      levelUpExp: magic.levelupExp ?? 0,
      manaCost: magic.manaCost,
    },
  };
}

// ============= UIBridge 依赖分组接口 =============

/** 状态获取器 - 用于获取游戏状态 */
export interface UIStateGetters {
  getPlayer: () => Player;
  getPlayerIndex: () => number;
  getGoodsListManager: () => GoodsListManager;
  getPlayerMagicInventory: () => PlayerMagicInventory;
  getBuyManager: () => BuyManager;
  getGambleManager: () => GambleManager;
  getSlotManager: () => SlotManager;
  getDoudizhuManager: () => DoudizhuManager;
  getMemoListManager: () => MemoListManager;
  getTimerManager: () => TimerManager;
  getPanels: () => UIPanelVisibility;
  getDialogState: () => UIDialogState;
  getSelectionState: () => UISelectionState;
  getMultiSelectionState: () => UIMultiSelectionState;
  canSaveGame: () => boolean;
}

/** 物品操作 */
export interface UIGoodsActions {
  useItem: (index: number) => void;
  equipItem: (fromIndex: number, toSlot: string) => void;
  unequipItem: (slot: string) => void;
  swapItems: (fromIndex: number, toIndex: number) => void;
  useBottomItem: (slotIndex: number) => void;
  sellBottomGoods: (slotIndex: number) => void;
  moveBagToBottom: (bagIndex: number, bottomSlot: number) => void;
  moveBottomToBag: (bottomSlot: number, bagIndex: number) => void;
  swapBottomGoods: (fromSlot: number, toSlot: number) => void;
  swapEquipSlots: (fromSlot: string, toSlot: string) => void;
}

/** 武功操作 */
export interface UIMagicActions {
  useMagic: (magicIndex: number) => Promise<void>;
  useMagicByBottom: (bottomSlot: number) => Promise<void>;
  setCurrentMagic: (magicIndex: number) => void;
  setCurrentMagicByBottom: (bottomIndex: number) => void;
  swapMagic: (fromIndex: number, toIndex: number) => void;
  assignMagicToBottom: (magicIndex: number, bottomSlot: number) => void;
  swapBottomSlots: (fromSlot: number, toSlot: number) => void;
  clearBottomSlot: (bottomSlot: number) => void;
  moveBottomToPanel: (bottomSlot: number, panelIndex: number) => void;
  setXiuLianMagic: (magicIndex: number) => void;
  setXiuLianFromBottom: (bottomSlot: number) => void;
}

/** 商店操作 */
export interface UIShopActions {
  buyItem: (shopIndex: number) => Promise<boolean>;
  sellItem: (bagIndex: number) => void;
  closeShop: () => void;
}

/** 存档操作 */
export interface UISaveActions {
  showSaveLoad: (visible: boolean) => void;
}

/** 赌博操作 */
export interface UIGambleActions {
  placeBet: (choice: "big" | "small") => void;
  closeGamble: () => void;
}

/** 老虎机操作 */
export interface UISlotActions {
  spin: (multiplier?: number) => void;
  closeSlot: () => void;
}

/** 斗地主操作 */
export interface UIDoudizhuActions {
  bid: (bid: boolean) => void;
  play: (cards: unknown[]) => boolean;
  pass: () => boolean;
  closeDoudizhu: () => void;
}

/** 对话操作 */
export interface UIDialogActions {
  dialogClick: () => void;
  dialogSelect: (selection: number) => void;
  selectionChoose: (index: number) => void;
  multiSelectionToggle: (index: number) => void;
}

/** 系统操作 */
export interface UISystemActions {
  togglePanel: (panel: UIPanelName) => void;
  showMessage: (text: string) => void;
  showSystem: (visible: boolean) => void;
  minimapClick: (worldX: number, worldY: number) => void;
  onVideoEnd: () => void;
}

// ============= UIBridge 依赖接口（分组版本）=============

export interface UIBridgeDeps {
  events: TypedEventEmitter<GameEventMap>;
  // 分组的依赖
  state: UIStateGetters;
  goods: UIGoodsActions;
  magic: UIMagicActions;
  shop: UIShopActions;
  gamble: UIGambleActions;
  slot: UISlotActions;
  doudizhu: UIDoudizhuActions;
  save: UISaveActions;
  dialog: UIDialogActions;
  system: UISystemActions;
}

// ============= UIBridge 实现 =============

export class UIBridgeImpl implements UIBridge {
  private subscribers = new Set<Partial<UIStateSubscriber>>();
  private deps: UIBridgeDeps;

  // 缓存的状态版本号
  private goodsVersion = 0;
  private magicVersion = 0;
  private shopVersion = 0;
  private gambleVersion = 0;
  private slotVersion = 0;
  private doudizhuVersion = 0;

  constructor(deps: UIBridgeDeps) {
    this.deps = deps;
    this.setupEventListeners();
  }

  // ============= 事件监听 =============

  private setupEventListeners(): void {
    const { events } = this.deps;

    // 面板变化
    events.on(GameEvents.UI_PANEL_CHANGE, (event: UIPanelChangeEvent) => {
      const panels = event.panels as UIPanelVisibility;
      this.notifySubscribers("onPanelsChange", panels);
    });

    // 对话变化
    events.on(GameEvents.UI_DIALOG_CHANGE, (event: UIDialogChangeEvent) => {
      this.notifySubscribers("onDialogChange", event.dialog);
    });

    // 选择变化
    events.on(GameEvents.UI_SELECTION_CHANGE, (event: UISelectionChangeEvent) => {
      const selection = this.convertSelectionState(event.selection);
      this.notifySubscribers("onSelectionChange", selection);
    });

    // 多选变化
    events.on(GameEvents.UI_MULTI_SELECTION_CHANGE, (event: UIMultiSelectionChangeEvent) => {
      const multiSelection = this.convertMultiSelectionState(event.selection);
      this.notifySubscribers("onMultiSelectionChange", multiSelection);
    });

    // 消息变化
    events.on(GameEvents.UI_MESSAGE_CHANGE, (event: UIMessageChangeEvent) => {
      const message: UIMessageState = {
        text: event.messageText,
        isVisible: event.messageVisible,
        showKey: event.showKey,
      };
      this.notifySubscribers("onMessageChange", message);
    });

    // 玩家状态变化 (PlayerChange 切换角色后触发)
    events.on(GameEvents.UI_PLAYER_CHANGE, () => {
      const player = this.buildPlayerState();
      this.notifySubscribers("onPlayerChange", player);
    });

    // 物品变化
    events.on(GameEvents.UI_GOODS_CHANGE, () => {
      this.goodsVersion++;
      const goods = this.buildGoodsState();
      this.notifySubscribers("onGoodsChange", goods);
    });

    // 武功变化
    events.on(GameEvents.UI_MAGIC_CHANGE, () => {
      this.magicVersion++;
      const magic = this.buildMagicState();
      this.notifySubscribers("onMagicChange", magic);
    });

    // 商店变化
    events.on(GameEvents.UI_BUY_CHANGE, (_event: UIBuyChangeEvent) => {
      this.shopVersion++;
      const shop = this.buildShopState();
      this.notifySubscribers("onShopChange", shop);
    });

    // 赌博变化
    events.on(GameEvents.UI_GAMBLE_CHANGE, (_event: UIGambleChangeEvent) => {
      this.gambleVersion++;
      const gamble = this.buildGambleState();
      this.notifySubscribers("onGambleChange", gamble);
    });

    // 老虎机变化
    events.on(GameEvents.UI_SLOT_CHANGE, (_event: UISlotChangeEvent) => {
      this.slotVersion++;
      const slot = this.buildSlotState();
      this.notifySubscribers("onSlotChange", slot);
    });

    // 斗地主变化
    events.on(GameEvents.UI_DOUDIZHU_CHANGE, (_event: UIDoudizhuChangeEvent) => {
      this.doudizhuVersion++;
      const doudizhu = this.buildDoudizhuState();
      this.notifySubscribers("onDoudizhuChange", doudizhu);
    });

    // 备忘录变化
    events.on(GameEvents.UI_MEMO_CHANGE, (_event: UIMemoChangeEvent) => {
      const memo = this.buildMemoState();
      this.notifySubscribers("onMemoChange", memo);
    });

    // 视频播放
    events.on(GameEvents.UI_VIDEO_PLAY, (event: UIVideoPlayEvent) => {
      const video: UIVideoState = {
        isPlaying: true,
        videoFile: event.file,
      };
      this.notifySubscribers("onVideoChange", video);
    });

    // 视频结束
    events.on(GameEvents.UI_VIDEO_END, () => {
      const video: UIVideoState = {
        isPlaying: false,
        videoFile: null,
      };
      this.notifySubscribers("onVideoChange", video);
    });
  }

  // ============= 状态转换 =============

  private convertSelectionState(state: SelectionGuiState): UISelectionState {
    return {
      isVisible: state.isVisible,
      message: state.message,
      options: state.options.map(
        (o): UISelectionOption => ({
          text: o.text,
          label: o.label,
          enabled: o.enabled,
        })
      ),
      selectedIndex: state.selectedIndex,
      hoveredIndex: state.hoveredIndex,
    };
  }

  private convertMultiSelectionState(state: MultiSelectionGuiState): UIMultiSelectionState {
    return {
      isVisible: state.isVisible,
      message: state.message,
      options: state.options.map(
        (o): UISelectionOption => ({
          text: o.text,
          label: o.label,
          enabled: o.enabled,
        })
      ),
      columns: state.columns,
      selectionCount: state.selectionCount,
      selectedIndices: [...state.selectedIndices],
    };
  }

  // ============= 状态构建 =============

  private buildPlayerState(): UIPlayerState {
    const player = this.deps.state.getPlayer();

    // 获取当前角色索引用于面板图像切换
    const playerIndex = this.deps.state.getPlayerIndex();

    return {
      playerIndex,
      playerName: player.name ?? "",
      level: player.level,
      exp: player.exp,
      levelUpExp: player.levelUpExp,
      life: player.life,
      lifeMax: player.lifeMax,
      thew: player.thew,
      thewMax: player.thewMax,
      mana: player.mana,
      manaMax: player.manaMax,
      manaLimit: player.manaLimit ?? false,
      attack: player.attack,
      defend: player.defend,
      evade: player.evade,
      money: player.money,
    };
  }

  private buildGoodsState(): UIGoodsState {
    const goodsManager = this.deps.state.getGoodsListManager();
    const player = this.deps.state.getPlayer();

    // 背包物品 (1-STORE_INDEX_END)
    const items: UIGoodsSlot[] = [];
    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = goodsManager.getItemInfo(i);
      items.push(convertGoodsItemToSlot(info, i));
    }

    // 装备（独立 equipSlots 数组，0=Head..6=Foot）
    const equipSlots: (keyof UIEquipSlots)[] = [
      "head",
      "neck",
      "body",
      "back",
      "hand",
      "wrist",
      "foot",
    ];
    // Use a mutable version during construction, then return readonly
    const equips: {
      head: UIGoodsSlot | null;
      neck: UIGoodsSlot | null;
      body: UIGoodsSlot | null;
      back: UIGoodsSlot | null;
      hand: UIGoodsSlot | null;
      wrist: UIGoodsSlot | null;
      foot: UIGoodsSlot | null;
    } = {
      head: null,
      neck: null,
      body: null,
      back: null,
      hand: null,
      wrist: null,
      foot: null,
    };
    for (let i = 0; i < EQUIP_SLOT_COUNT; i++) {
      const info = goodsManager.getEquipAtSlotIndex(i);
      if (info?.good) {
        const slotName = equipSlots[i];
        // Use slot order index (0-based) + 1 = EquipPosition (1-7) as the UI slot identifier
        const slot = convertGoodsItemToSlot(info, i + 1);
        // Type-safe assignment using switch
        switch (slotName) {
          case "head":
            equips.head = slot;
            break;
          case "neck":
            equips.neck = slot;
            break;
          case "body":
            equips.body = slot;
            break;
          case "back":
            equips.back = slot;
            break;
          case "hand":
            equips.hand = slot;
            break;
          case "wrist":
            equips.wrist = slot;
            break;
          case "foot":
            equips.foot = slot;
            break;
        }
      }
    }

    // 底栏物品（独立 bottomItems 数组）
    const bottomGoods: (UIGoodsSlot | null)[] = [];
    const bottomCount = goodsManager.getBottomItems().length;
    for (let i = 0; i < bottomCount; i++) {
      const info = goodsManager.getBottomItemAtSlot(i);
      bottomGoods.push(info?.good ? convertGoodsItemToSlot(info, i) : null);
    }

    return {
      items,
      equips,
      bottomGoods,
      money: player.money,
    };
  }

  private buildMagicState(): UIMagicState {
    const magicInventory = this.deps.state.getPlayerMagicInventory();

    // 武功仓库 (storeIndexBegin - storeIndexEnd)
    const storeMagics: (UIMagicSlot | null)[] = [];
    for (let i = MAGIC_LIST_CONFIG.storeIndexBegin; i <= MAGIC_LIST_CONFIG.storeIndexEnd; i++) {
      const info = magicInventory.getItemInfo(i);
      storeMagics.push(convertMagicInfoToSlot(info, i));
    }

    // 底栏武功（独立容器，直接持有武功项）
    const bottomMagics: (UIMagicSlot | null)[] = [];
    const bottomItems = magicInventory.getBottomMagics();
    for (let s = 0; s < bottomItems.length; s++) {
      // 用负值区分底栏槽位，避免与面板索引冲突
      bottomMagics.push(convertMagicInfoToSlot(bottomItems[s], -(s + 1)));
    }

    // 修炼武功（独立容器，直接读取）
    const xiuLianInfo = magicInventory.getXiuLianMagic();
    const xiuLianMagic = convertMagicInfoToSlot(xiuLianInfo, MAGIC_LIST_CONFIG.xiuLianIndex);

    return {
      storeMagics,
      bottomMagics,
      xiuLianMagic,
    };
  }

  private buildShopState(): UIShopState {
    const buyManager = this.deps.state.getBuyManager();

    if (!buyManager || !buyManager.isOpen()) {
      return {
        isOpen: false,
        items: [],
        buyPercent: 100,
        numberValid: false,
        canSellSelfGoods: true,
      };
    }

    const shopItems = buyManager.getGoodsArray();
    const items: (UIShopItem | null)[] = shopItems.map((item: ShopItemInfo | null) => {
      if (!item?.good) return null;
      // Use item.price override if set, otherwise fall back to good.cost
      const basePrice = item.price > 0 ? item.price : item.good.cost;
      const price = Math.floor((basePrice * buyManager.getBuyPercent()) / 100);
      return {
        good: item.good,
        price,
        count: item.count,
      };
    });

    return {
      isOpen: true,
      items,
      buyPercent: buyManager.getBuyPercent(),
      numberValid: buyManager.isNumberValid(),
      canSellSelfGoods: buyManager.getCanSellSelfGoods(),
    };
  }

  private buildGambleState(): UIGambleState {
    const gambleManager = this.deps.state.getGambleManager();
    const state = gambleManager.getState();
    return {
      isOpen: state.isOpen,
      betAmount: state.betAmount,
    };
  }

  private buildSlotState(): UISlotState {
    const slotManager = this.deps.state.getSlotManager();
    const state = slotManager.getState();
    return {
      isOpen: state.isOpen,
      betAmount: state.betAmount,
    };
  }

  private buildDoudizhuState(): UIDoudizhuState {
    const doudizhuManager = this.deps.state.getDoudizhuManager();
    const state = doudizhuManager.getState();
    return {
      isOpen: doudizhuManager.isOpen(),
      betAmount: 0,
    };
  }

  private buildMemoState(): UIMemoState {
    const memoManager = this.deps.state.getMemoListManager();
    const memos = memoManager.getAllMemos();

    return {
      // getAllMemos returns string[], we convert to UIMemoEntry with sequential IDs
      memos: memos.map(
        (text, index): UIMemoEntry => ({
          id: index,
          text: text,
        })
      ),
    };
  }

  private buildTimerState(): UITimerState {
    const timerManager = this.deps.state.getTimerManager();
    const state = timerManager.getState();

    return {
      isRunning: state.isRunning,
      seconds: state.seconds,
      isHidden: state.isHidden,
    };
  }

  // ============= 公共 API =============

  subscribe(subscriber: Partial<UIStateSubscriber>): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  dispatch(action: UIAction): void {
    logger.debug("[UIBridge] dispatch:", action.type);

    switch (action.type) {
      // 面板控制
      case "TOGGLE_PANEL":
        this.deps.system.togglePanel(action.panel);
        break;

      // 对话
      case "DIALOG_CLICK":
        this.deps.dialog.dialogClick();
        break;
      case "DIALOG_SELECT":
        this.deps.dialog.dialogSelect(action.selection);
        break;

      // 选择
      case "SELECTION_CHOOSE":
        this.deps.dialog.selectionChoose(action.index);
        break;
      case "MULTI_SELECTION_TOGGLE":
        this.deps.dialog.multiSelectionToggle(action.index);
        break;

      // 物品
      case "USE_ITEM":
        this.deps.goods.useItem(action.index);
        break;
      case "EQUIP_ITEM":
        this.deps.goods.equipItem(action.fromIndex, action.toSlot);
        break;
      case "UNEQUIP_ITEM":
        this.deps.goods.unequipItem(action.slot);
        break;
      case "SWAP_ITEMS":
        this.deps.goods.swapItems(action.fromIndex, action.toIndex);
        break;
      case "USE_BOTTOM_ITEM":
        this.deps.goods.useBottomItem(action.slotIndex);
        break;
      case "SELL_BOTTOM_GOODS":
        this.deps.goods.sellBottomGoods(action.slotIndex);
        break;
      case "MOVE_BAG_TO_BOTTOM":
        this.deps.goods.moveBagToBottom(action.bagIndex, action.bottomSlot);
        break;
      case "MOVE_BOTTOM_TO_BAG":
        this.deps.goods.moveBottomToBag(action.bottomSlot, action.bagIndex);
        break;
      case "SWAP_BOTTOM_GOODS":
        this.deps.goods.swapBottomGoods(action.fromSlot, action.toSlot);
        break;
      case "SWAP_EQUIP_SLOTS":
        this.deps.goods.swapEquipSlots(action.fromSlot, action.toSlot);
        break;

      // 武功
      case "USE_MAGIC":
        this.deps.magic.useMagic(action.magicIndex);
        break;
      case "USE_MAGIC_BY_BOTTOM":
        this.deps.magic.useMagicByBottom(action.bottomSlot);
        break;
      case "SET_CURRENT_MAGIC":
        this.deps.magic.setCurrentMagic(action.magicIndex);
        break;
      case "SET_CURRENT_MAGIC_BY_BOTTOM":
        this.deps.magic.setCurrentMagicByBottom(action.bottomIndex);
        break;
      case "SWAP_MAGIC":
        this.deps.magic.swapMagic(action.fromIndex, action.toIndex);
        break;
      case "ASSIGN_MAGIC_TO_BOTTOM":
        this.deps.magic.assignMagicToBottom(action.magicIndex, action.bottomSlot);
        break;
      case "SWAP_BOTTOM_SLOTS":
        this.deps.magic.swapBottomSlots(action.fromSlot, action.toSlot);
        break;
      case "CLEAR_BOTTOM_SLOT":
        this.deps.magic.clearBottomSlot(action.bottomSlot);
        break;
      case "MOVE_BOTTOM_TO_PANEL":
        this.deps.magic.moveBottomToPanel(action.bottomSlot, action.panelIndex);
        break;
      case "SET_XIULIAN_MAGIC":
        this.deps.magic.setXiuLianMagic(action.magicIndex);
        break;
      case "SET_XIULIAN_FROM_BOTTOM":
        this.deps.magic.setXiuLianFromBottom(action.bottomSlot);
        break;

      // 商店
      case "BUY_ITEM":
        this.deps.shop.buyItem(action.shopIndex);
        break;
      case "SELL_ITEM":
        this.deps.shop.sellItem(action.bagIndex);
        break;
      case "CLOSE_SHOP":
        this.deps.shop.closeShop();
        break;

      // 赌博
      case "PLACE_GAMBLE_BET":
        this.deps.gamble.placeBet(action.choice);
        break;
      case "CLOSE_GAMBLE":
        this.deps.gamble.closeGamble();
        break;

      // 老虎机
      case "PLACE_SLOT_BET":
        this.deps.slot.spin(action.multiplier);
        break;
      case "CLOSE_SLOT":
        this.deps.slot.closeSlot();
        break;

      // 斗地主
      case "DOUDIZHU_BID":
        this.deps.doudizhu.bid(action.bid);
        break;
      case "DOUDIZHU_PLAY":
        this.deps.doudizhu.play(action.cards);
        break;
      case "DOUDIZHU_PASS":
        this.deps.doudizhu.pass();
        break;
      case "CLOSE_DOUDIZHU":
        this.deps.doudizhu.closeDoudizhu();
        break;

      // 存档
      case "SHOW_SAVE_LOAD":
        this.deps.save.showSaveLoad(action.visible);
        break;

      // 小地图
      case "MINIMAP_CLICK":
        this.deps.system.minimapClick(action.worldX, action.worldY);
        break;

      // 视频
      case "VIDEO_END":
        this.deps.system.onVideoEnd();
        break;

      // 系统
      case "SHOW_MESSAGE":
        this.deps.system.showMessage(action.text);
        break;
      case "SHOW_SYSTEM":
        this.deps.system.showSystem(action.visible);
        break;
      case "EXIT_GAME":
        // Web 应用无法真正退出，仅显示提示
        logger.log("[UIBridge] EXIT_GAME: Web app cannot exit, consider returning to main menu");
        break;

      default:
        logger.warn("[UIBridge] Unknown action:", (action as UIAction).type);
    }
  }

  getSnapshot(): UISnapshot {
    return {
      player: this.buildPlayerState(),
      panels: this.deps.state.getPanels(),
      dialog: this.deps.state.getDialogState(),
      selection: this.deps.state.getSelectionState(),
      multiSelection: this.deps.state.getMultiSelectionState(),
      message: { text: "", isVisible: false, showKey: 0 },
      goods: this.buildGoodsState(),
      magic: this.buildMagicState(),
      shop: this.buildShopState(),
      memo: this.buildMemoState(),
      timer: this.buildTimerState(),
      npcLifeBar: { isVisible: false, name: "", life: 0, lifeMax: 0 },
      minimap: {
        isVisible: false,
        mapName: "",
        mapDisplayName: "",
        playerPosition: { x: 0, y: 0 },
        cameraPosition: { x: 0, y: 0 },
        characters: [],
        mapWidth: 0,
        mapHeight: 0,
        mapData: null,
      },
      video: { isPlaying: false, videoFile: null },
      saveLoad: {
        isVisible: false,
        canSave: this.deps.state.canSaveGame(),
        slots: [],
      },
      gamble: this.buildGambleState(),
      slot: this.buildSlotState(),
      doudizhu: this.buildDoudizhuState(),
    };
  }

  requestRefresh(state: "goods" | "magic" | "shop" | "gamble" | "slot" | "doudizhu" | "memo" | "all"): void {
    // biome-ignore lint/nursery/noUnnecessaryConditions: switch on string union is always non-null by design
    switch (state) {
      case "goods":
        this.notifySubscribers("onGoodsChange", this.buildGoodsState());
        break;
      case "magic":
        this.notifySubscribers("onMagicChange", this.buildMagicState());
        break;
      case "shop":
        this.notifySubscribers("onShopChange", this.buildShopState());
        break;
      case "gamble":
        this.notifySubscribers("onGambleChange", this.buildGambleState());
        break;
      case "slot":
        this.notifySubscribers("onSlotChange", this.buildSlotState());
        break;
      case "doudizhu":
        this.notifySubscribers("onDoudizhuChange", this.buildDoudizhuState());
        break;
      case "memo":
        this.notifySubscribers("onMemoChange", this.buildMemoState());
        break;
      case "all":
        this.notifySubscribers("onPlayerChange", this.buildPlayerState());
        this.notifySubscribers("onGoodsChange", this.buildGoodsState());
        this.notifySubscribers("onMagicChange", this.buildMagicState());
        this.notifySubscribers("onShopChange", this.buildShopState());
        this.notifySubscribers("onGambleChange", this.buildGambleState());
        this.notifySubscribers("onSlotChange", this.buildSlotState());
        this.notifySubscribers("onDoudizhuChange", this.buildDoudizhuState());
        this.notifySubscribers("onMemoChange", this.buildMemoState());
        break;
    }
  }

  // ============= 内部方法 =============

  private notifySubscribers<K extends keyof UIStateSubscriber>(method: K, data: unknown): void {
    for (const subscriber of this.subscribers) {
      const handler = subscriber[method];
      if (handler) {
        try {
          (handler as (arg: unknown) => void)(data);
        } catch (error) {
          logger.error(`[UIBridge] Subscriber error in ${method}:`, error);
        }
      }
    }
  }
}
