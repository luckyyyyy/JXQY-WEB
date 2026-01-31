/**
 * useGameUI - React Hook 用于获取游戏UI状态
 *
 * 职责:
 * 1. 订阅UI相关事件
 * 2. 管理UI状态的React化
 * 3. 仅在UI打开时获取实时数据
 *
 * 方案 A: 完全事件驱动
 * - 事件携带完整状态数据
 * - React 直接使用事件数据，不读取引擎可变状态
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GameEvents,
  type UIBuyChangeEvent,
  type UIDialogChangeEvent,
  type UIMessageChangeEvent,
  type UIMultiSelectionChangeEvent,
  type UIPanelChangeEvent,
  type UISelectionChangeEvent,
} from "../engine/core/gameEvents";
import type { GameEngine } from "../engine/game/gameEngine";
import type { ShopItemInfo } from "../engine/gui/buyManager";
import type { DialogGuiState, MultiSelectionGuiState, PanelState, SelectionGuiState } from "../engine/gui/types";
import type { MagicItemInfo } from "../engine/magic";
import type { Good } from "../engine/player/goods";

export interface GoodItemData {
  good: Good;
  count: number;
}

export interface EquipSlots {
  head?: GoodItemData;
  neck?: GoodItemData;
  body?: GoodItemData;
  back?: GoodItemData;
  hand?: GoodItemData;
  wrist?: GoodItemData;
  foot?: GoodItemData;
}

export interface GoodsData {
  items: (GoodItemData | null)[];
  equips: EquipSlots;
  bottomGoods: (GoodItemData | null)[]; // 底栏物品 (索引 221-223, Z/X/C)
  money: number;
}

export interface MagicData {
  storeMagics: (MagicItemInfo | null)[];
  bottomMagics: (MagicItemInfo | null)[];
  xiuLianMagic: MagicItemInfo | null;
}

export interface BuyData {
  items: (ShopItemInfo | null)[];
  buyPercent: number;
  numberValid: boolean;
  canSellSelfGoods: boolean;
}

export interface MessageState {
  messageText: string;
  messageVisible: boolean;
}

export interface UseGameUIResult {
  // 事件驱动的UI状态
  dialogState: DialogGuiState | null;
  selectionState: SelectionGuiState | null;
  multiSelectionState: MultiSelectionGuiState | null;
  panelState: PanelState | null;
  messageState: MessageState;
  // 物品/武功数据
  goodsData: GoodsData;
  magicData: MagicData;
  buyData: BuyData;
  refreshGoods: () => void;
  refreshMagic: () => void;
}

/**
 * 游戏UI状态 Hook
 */
export function useGameUI(engine: GameEngine | null): UseGameUIResult {
  // 事件驱动的UI状态
  const [dialogState, setDialogState] = useState<DialogGuiState | null>(null);
  const [selectionState, setSelectionState] = useState<SelectionGuiState | null>(null);
  const [multiSelectionState, setMultiSelectionState] = useState<MultiSelectionGuiState | null>(null);
  const [panelState, setPanelState] = useState<PanelState | null>(null);
  const [messageState, setMessageState] = useState<MessageState>({
    messageText: "",
    messageVisible: false,
  });

  // 强制更新触发器 (用于物品/武功等)
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // 缓存版本号，用于检测变化
  const goodsVersionRef = useRef(0);
  const magicVersionRef = useRef(0);
  const buyVersionRef = useRef(0);

  // 订阅UI事件
  useEffect(() => {
    if (!engine) return;

    const events = engine.getEvents();

    // 订阅对话框状态变化 (方案A: 事件携带完整状态)
    const unsubDialog = events.on(GameEvents.UI_DIALOG_CHANGE, (event: UIDialogChangeEvent) => {
      setDialogState(event.dialog);
    });

    // 订阅选择框状态变化
    const unsubSelection = events.on(
      GameEvents.UI_SELECTION_CHANGE,
      (event: UISelectionChangeEvent) => {
        setSelectionState(event.selection);
      }
    );

    // 订阅多选框状态变化
    const unsubMultiSelection = events.on(
      GameEvents.UI_MULTI_SELECTION_CHANGE,
      (event: UIMultiSelectionChangeEvent) => {
        setMultiSelectionState(event.selection);
      }
    );

    // 订阅面板状态变化
    const unsubPanel = events.on(GameEvents.UI_PANEL_CHANGE, (event: UIPanelChangeEvent) => {
      setPanelState(event.panels);
      // 面板变化也触发更新（物品/武功面板需要）
      setUpdateTrigger((prev) => prev + 1);
    });

    // 订阅消息状态变化
    const unsubMessage = events.on(GameEvents.UI_MESSAGE_CHANGE, (event: UIMessageChangeEvent) => {
      setMessageState({
        messageText: event.messageText,
        messageVisible: event.messageVisible,
      });
    });

    // 订阅物品变化
    const unsubGoods = events.on(GameEvents.UI_GOODS_CHANGE, () => {
      setUpdateTrigger((prev) => prev + 1);
    });

    // 订阅武功变化
    const unsubMagic = events.on(GameEvents.UI_MAGIC_CHANGE, () => {
      setUpdateTrigger((prev) => prev + 1);
    });

    // 订阅商店变化
    const unsubBuy = events.on(GameEvents.UI_BUY_CHANGE, (_event: UIBuyChangeEvent) => {
      setUpdateTrigger((prev) => prev + 1);
    });

    // 初始化状态 - 从引擎获取当前状态
    const initialGuiState = engine.getGuiState();
    if (initialGuiState) {
      setDialogState({ ...initialGuiState.dialog });
      setSelectionState({ ...initialGuiState.selection });
      setMultiSelectionState({ ...initialGuiState.multiSelection });
      setPanelState({ ...initialGuiState.panels });
      setMessageState({
        messageText: initialGuiState.hud.messageText,
        messageVisible: initialGuiState.hud.messageVisible,
      });
    }

    return () => {
      unsubDialog();
      unsubSelection();
      unsubMultiSelection();
      unsubPanel();
      unsubMessage();
      unsubGoods();
      unsubMagic();
      unsubBuy();
    };
  }, [engine]);

  // 手动刷新物品数据
  const refreshGoods = useCallback(() => {
    setUpdateTrigger((prev) => prev + 1);
  }, []);

  // 手动刷新武功数据
  const refreshMagic = useCallback(() => {
    setUpdateTrigger((prev) => prev + 1);
  }, []);

  // 获取物品数据（仅在背包/装备界面打开时计算）
  const goodsData = useMemo<GoodsData>(() => {
    if (!engine) {
      return { items: [], equips: {}, bottomGoods: [], money: 0 };
    }

    // 获取物品管理器
    const goodsManager = engine.getGoodsListManager();
    if (!goodsManager) {
      return { items: [], equips: {}, bottomGoods: [], money: 0 };
    }

    // 底栏物品数据始终需要获取（用于底栏显示）
    const bottomGoods: (GoodItemData | null)[] = [];
    for (let i = 221; i <= 223; i++) {
      const entry = goodsManager.getItemInfo(i);
      if (entry?.good) {
        bottomGoods.push({ good: entry.good, count: entry.count });
      } else {
        bottomGoods.push(null);
      }
    }

    // 检查是否需要更新（面板打开或版本变化）
    const isPanelOpen = panelState?.goods || panelState?.equip;
    const currentVersion = engine.getGoodsVersion();

    // 即使面板未打开，如果版本变化也要更新（用于底栏显示金钱等）
    if (!isPanelOpen && currentVersion === goodsVersionRef.current) {
      // 返回基础数据（底栏物品和金钱）
      const player = engine.getPlayer();
      return {
        items: [],
        equips: {},
        bottomGoods,
        money: player?.money ?? 0,
      };
    }

    goodsVersionRef.current = currentVersion;

    const items: (GoodItemData | null)[] = [];
    const equips: EquipSlots = {};

    // 获取背包物品 (索引 1-198)
    for (let i = 1; i <= 198; i++) {
      const entry = goodsManager.getItemInfo(i);
      if (entry?.good) {
        items.push({ good: entry.good, count: entry.count });
      } else {
        items.push(null);
      }
    }

    // 获取装备 (索引 201-207)
    const equipIndices = [201, 202, 203, 204, 205, 206, 207];
    const equipSlots: (keyof EquipSlots)[] = [
      "head",
      "neck",
      "body",
      "back",
      "hand",
      "wrist",
      "foot",
    ];

    equipIndices.forEach((index, i) => {
      const entry = goodsManager.getItemInfo(index);
      if (entry?.good) {
        equips[equipSlots[i]] = { good: entry.good, count: entry.count };
      }
    });

    const player = engine.getPlayer();
    return {
      items,
      equips,
      bottomGoods,
      money: player?.money ?? 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, panelState?.goods, panelState?.equip, updateTrigger]);

  // 获取武功数据（仅在武功/修炼界面打开时计算）
  const magicData = useMemo<MagicData>(() => {
    if (!engine) {
      return { storeMagics: [], bottomMagics: [], xiuLianMagic: null };
    }

    // 检查是否需要更新
    const isPanelOpen = panelState?.magic || panelState?.xiulian;
    const currentVersion = engine.getMagicVersion();

    // 底栏武功需要实时更新
    const bottomMagics = engine.getBottomMagics();

    if (!isPanelOpen && currentVersion === magicVersionRef.current) {
      // 仅返回底栏武功
      return {
        storeMagics: [],
        bottomMagics,
        xiuLianMagic: null,
      };
    }

    magicVersionRef.current = currentVersion;

    // 获取完整武功数据
    const gameManager = engine.getGameManager();
    const xiuLianMagic = gameManager?.getMagicListManager().getItemInfo(49) ?? null;

    return {
      storeMagics: engine.getStoreMagics(),
      bottomMagics,
      xiuLianMagic,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, panelState?.magic, panelState?.xiulian, updateTrigger]);

  // 获取商店数据（仅在商店界面打开时计算）
  const buyData = useMemo<BuyData>(() => {
    const defaultData: BuyData = {
      items: [],
      buyPercent: 100,
      numberValid: false,
      canSellSelfGoods: true,
    };

    if (!engine) {
      return defaultData;
    }

    const gameManager = engine.getGameManager();
    if (!gameManager) {
      return defaultData;
    }

    const buyManager = gameManager.getBuyManager();
    if (!buyManager || !buyManager.isOpen()) {
      return defaultData;
    }

    // Check version
    const currentVersion = gameManager.getBuyVersion();
    if (currentVersion === buyVersionRef.current && !panelState?.buy) {
      return defaultData;
    }

    buyVersionRef.current = currentVersion;

    return {
      items: buyManager.getGoodsArray(),
      buyPercent: buyManager.getBuyPercent(),
      numberValid: buyManager.isNumberValid(),
      canSellSelfGoods: buyManager.getCanSellSelfGoods(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, panelState?.buy, updateTrigger]);

  return {
    // 事件驱动状态
    dialogState,
    selectionState,
    multiSelectionState,
    panelState,
    messageState,
    // 物品/武功数据
    goodsData,
    magicData,
    buyData,
    refreshGoods,
    refreshMagic,
  };
}
