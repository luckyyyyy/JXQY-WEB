/**
 * useUIBridge - React 适配器 Hook
 *
 * 将 UIBridge 的订阅模式适配为 React 响应式状态。
 * UI 组件使用此 Hook 获取游戏状态和派发动作。
 *
 * 设计原则：
 * - UI 组件不直接访问 GameEngine 内部
 * - 所有状态通过 UIBridge 获取
 * - 所有动作通过 dispatch 派发
 */

import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import type {
  UIAction,
  UIDialogState,
  UIGoodsState,
  UIMagicState,
  UIMemoState,
  UIMessageState,
  UIMinimapState,
  UIMultiSelectionState,
  UINpcLifeBarState,
  UIPanelVisibility,
  UIPlayerState,
  UISelectionState,
  UIShopState,
  UITimerState,
  UIVideoState,
} from "@miu2d/engine/gui/contract";
import { useCallback, useEffect, useMemo, useState } from "react";

// ============= 返回类型 =============

export interface UseUIBridgeResult {
  // 状态
  player: UIPlayerState | null;
  panels: UIPanelVisibility;
  dialog: UIDialogState;
  selection: UISelectionState;
  multiSelection: UIMultiSelectionState;
  message: UIMessageState;
  goods: UIGoodsState;
  magic: UIMagicState;
  shop: UIShopState;
  memo: UIMemoState;
  timer: UITimerState;
  npcLifeBar: UINpcLifeBarState;
  video: UIVideoState;
  minimap: UIMinimapState;

  // 动作派发
  dispatch: (action: UIAction) => void;

  // 刷新请求
  refreshGoods: () => void;
  refreshMagic: () => void;
  refreshShop: () => void;
  refreshAll: () => void;

  // 是否已连接
  isConnected: boolean;
}

// ============= 默认状态 =============

const defaultPanels: UIPanelVisibility = {
  state: false,
  equip: false,
  xiulian: false,
  goods: false,
  magic: false,
  memo: false,
  system: false,
  saveLoad: false,
  buy: false,
  npcEquip: false,
  title: false,
  timer: false,
  littleMap: false,
};

const defaultDialog: UIDialogState = {
  isVisible: false,
  text: "",
  portraitIndex: 0,
  portraitSide: "left",
  nameText: "",
  textProgress: 0,
  isComplete: true,
  isInSelecting: false,
  selectA: "",
  selectB: "",
  selection: -1,
};

const defaultSelection: UISelectionState = {
  isVisible: false,
  message: "",
  options: [],
  selectedIndex: 0,
  hoveredIndex: -1,
};

const defaultMultiSelection: UIMultiSelectionState = {
  isVisible: false,
  message: "",
  options: [],
  columns: 1,
  selectionCount: 1,
  selectedIndices: [],
};

const defaultMessage: UIMessageState = {
  text: "",
  isVisible: false,
};

const defaultGoods: UIGoodsState = {
  items: [],
  equips: {
    head: null,
    neck: null,
    body: null,
    back: null,
    hand: null,
    wrist: null,
    foot: null,
  },
  bottomGoods: [],
  money: 0,
};

const defaultMagic: UIMagicState = {
  storeMagics: [],
  bottomMagics: [],
  xiuLianMagic: null,
};

const defaultShop: UIShopState = {
  isOpen: false,
  items: [],
  buyPercent: 100,
  numberValid: false,
  canSellSelfGoods: true,
};

const defaultMemo: UIMemoState = {
  memos: [],
};

const defaultTimer: UITimerState = {
  isRunning: false,
  seconds: 0,
  isHidden: false,
};

const defaultNpcLifeBar: UINpcLifeBarState = {
  isVisible: false,
  name: "",
  life: 0,
  lifeMax: 0,
};

const defaultVideo: UIVideoState = {
  isPlaying: false,
  videoFile: null,
};

const defaultMinimap: UIMinimapState = {
  isVisible: false,
  mapName: "",
  mapDisplayName: "",
  playerPosition: { x: 0, y: 0 },
  cameraPosition: { x: 0, y: 0 },
  characters: [],
  mapWidth: 0,
  mapHeight: 0,
  mapData: null,
};

// ============= Hook 实现 =============

/**
 * 使用 UIBridge 的 React Hook
 *
 * @param engine GameEngine 实例（可选，未连接时返回默认状态）
 */
export function useUIBridge(engine: GameEngine | null): UseUIBridgeResult {
  // 获取 UIBridge 实例
  const bridge = useMemo(() => {
    if (!engine) return null;
    if (!engine.isInitialized()) return null;
    return engine.getUIBridge();
  }, [engine]);

  // 状态
  const [player, setPlayer] = useState<UIPlayerState | null>(null);
  const [panels, setPanels] = useState<UIPanelVisibility>(defaultPanels);
  const [dialog, setDialog] = useState<UIDialogState>(defaultDialog);
  const [selection, setSelection] = useState<UISelectionState>(defaultSelection);
  const [multiSelection, setMultiSelection] =
    useState<UIMultiSelectionState>(defaultMultiSelection);
  const [message, setMessage] = useState<UIMessageState>(defaultMessage);
  const [goods, setGoods] = useState<UIGoodsState>(defaultGoods);
  const [magic, setMagic] = useState<UIMagicState>(defaultMagic);
  const [shop, setShop] = useState<UIShopState>(defaultShop);
  const [memo, setMemo] = useState<UIMemoState>(defaultMemo);
  const [timer, setTimer] = useState<UITimerState>(defaultTimer);
  const [npcLifeBar, setNpcLifeBar] = useState<UINpcLifeBarState>(defaultNpcLifeBar);
  const [video, setVideo] = useState<UIVideoState>(defaultVideo);
  const [minimap, setMinimap] = useState<UIMinimapState>(defaultMinimap);

  // 是否已连接
  const [isConnected, setIsConnected] = useState(false);

  // 订阅状态变化
  useEffect(() => {
    if (!bridge) {
      setIsConnected(false);
      return;
    }

    // 获取初始快照
    const snapshot = bridge.getSnapshot();
    setPlayer(snapshot.player);
    setPanels(snapshot.panels);
    setDialog(snapshot.dialog);
    setSelection(snapshot.selection);
    setMultiSelection(snapshot.multiSelection);
    setMessage(snapshot.message);
    setGoods(snapshot.goods);
    setMagic(snapshot.magic);
    setShop(snapshot.shop);
    setMemo(snapshot.memo);
    setTimer(snapshot.timer);
    setNpcLifeBar(snapshot.npcLifeBar);
    setVideo(snapshot.video);
    setMinimap(snapshot.minimap);
    setIsConnected(true);

    // 订阅状态变化
    const unsubscribe = bridge.subscribe({
      onPlayerChange: setPlayer,
      onPanelsChange: setPanels,
      onDialogChange: setDialog,
      onSelectionChange: setSelection,
      onMultiSelectionChange: setMultiSelection,
      onMessageChange: setMessage,
      onGoodsChange: setGoods,
      onMagicChange: setMagic,
      onShopChange: setShop,
      onMemoChange: setMemo,
      onTimerChange: setTimer,
      onNpcLifeBarChange: setNpcLifeBar,
      onVideoChange: setVideo,
      onMinimapChange: setMinimap,
    });

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [bridge]);

  // 动作派发
  const dispatch = useCallback(
    (action: UIAction) => {
      bridge?.dispatch(action);
    },
    [bridge]
  );

  // 刷新方法
  const refreshGoods = useCallback(() => {
    bridge?.requestRefresh("goods");
  }, [bridge]);

  const refreshMagic = useCallback(() => {
    bridge?.requestRefresh("magic");
  }, [bridge]);

  const refreshShop = useCallback(() => {
    bridge?.requestRefresh("shop");
  }, [bridge]);

  const refreshAll = useCallback(() => {
    bridge?.requestRefresh("all");
  }, [bridge]);

  return {
    player,
    panels,
    dialog,
    selection,
    multiSelection,
    message,
    goods,
    magic,
    shop,
    memo,
    timer,
    npcLifeBar,
    video,
    minimap,
    dispatch,
    refreshGoods,
    refreshMagic,
    refreshShop,
    refreshAll,
    isConnected,
  };
}

// ============= 细粒度 Hooks (可选) =============
// 这些 hooks 直接接受 UIBridgeResult 或 IUIBridge，避免重复获取 bridge

/**
 * 从 UIBridgeResult 订阅玩家状态
 */
export function useUIPlayer(result: UseUIBridgeResult | null): UIPlayerState | null {
  return result?.player ?? null;
}

/**
 * 从 UIBridgeResult 订阅面板状态
 */
export function useUIPanels(result: UseUIBridgeResult | null): UIPanelVisibility | null {
  return result?.panels ?? null;
}

/**
 * 从 UIBridgeResult 订阅对话状态
 */
export function useUIDialog(result: UseUIBridgeResult | null): UIDialogState | null {
  return result?.dialog ?? null;
}

/**
 * 从 UIBridgeResult 订阅选择状态
 */
export function useUISelection(result: UseUIBridgeResult | null): UISelectionState | null {
  return result?.selection ?? null;
}

/**
 * 从 UIBridgeResult 订阅多选状态
 */
export function useUIMultiSelection(
  result: UseUIBridgeResult | null
): UIMultiSelectionState | null {
  return result?.multiSelection ?? null;
}

/**
 * 从 UIBridgeResult 订阅消息状态
 */
export function useUIMessage(result: UseUIBridgeResult | null): UIMessageState | null {
  return result?.message ?? null;
}

/**
 * 从 UIBridgeResult 订阅物品状态
 */
export function useUIGoods(result: UseUIBridgeResult | null): UIGoodsState | null {
  return result?.goods ?? null;
}

/**
 * 从 UIBridgeResult 订阅武功状态
 */
export function useUIMagic(result: UseUIBridgeResult | null): UIMagicState | null {
  return result?.magic ?? null;
}

/**
 * 从 UIBridgeResult 订阅商店状态
 */
export function useUIShop(result: UseUIBridgeResult | null): UIShopState | null {
  return result?.shop ?? null;
}

/**
 * 从 UIBridgeResult 订阅备忘录状态
 */
export function useUIMemos(
  result: UseUIBridgeResult | null
): readonly import("@miu2d/engine/gui/contract").UIMemoEntry[] | null {
  return result?.memo?.memos ?? null;
}

/**
 * 从 UIBridgeResult 订阅计时器状态
 */
export function useUITimer(result: UseUIBridgeResult | null): UITimerState | null {
  return result?.timer ?? null;
}

/**
 * 从 UIBridgeResult 订阅NPC血条状态
 */
export function useUINpcHover(result: UseUIBridgeResult | null): UINpcLifeBarState | null {
  return result?.npcLifeBar ?? null;
}

/**
 * 从 UIBridgeResult 订阅小地图状态
 */
export function useUIMinimap(result: UseUIBridgeResult | null): UIMinimapState | null {
  return result?.minimap ?? null;
}

/**
 * 派发 UI 动作的便捷 Hook
 */
export function useUIDispatch(engine: GameEngine | null): (action: UIAction) => void {
  const bridge = useMemo(() => {
    if (!engine) return null;
    if (!engine.isInitialized()) return null;
    return engine.getUIBridge();
  }, [engine]);

  return useCallback(
    (action: UIAction) => {
      bridge?.dispatch(action);
    },
    [bridge]
  );
}
