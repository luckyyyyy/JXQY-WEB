/**
 * useGameUILogic - 游戏 UI 核心逻辑 Hook
 *
 * 将 GameUI 的业务逻辑与渲染分离，支持 Classic/Modern 两套 UI 共享相同逻辑
 *
 * 职责:
 * 1. 管理 UI 状态（拖拽、Tooltip、面板等）
 * 2. 处理所有 UI 交互回调
 * 3. 从引擎获取数据并转换为 UI 友好格式
 */

import type { ShopItemInfo } from "@miu2d/engine";
import { logger } from "@miu2d/engine/core/logger";
import type { Vector2 } from "@miu2d/engine/core/types";
import type { UIEquipSlotName } from "@miu2d/engine/gui/ui-types";
import type { MagicItemInfo } from "@miu2d/engine/magic";
import type { MiuMapData } from "@miu2d/engine/map/types";
import type { Npc } from "@miu2d/engine/npc";
import type { Good } from "@miu2d/engine/player/goods";
import { GoodKind } from "@miu2d/engine/player/goods";
import { DefaultPaths } from "@miu2d/engine/resource";
import { resourceLoader } from "@miu2d/engine/resource/resource-loader";
import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import type { TimerState } from "@miu2d/engine/runtime/timer-manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUIBridge } from "../adapters";
import type { DragData, EquipSlotType } from "../ui/classic";
import { slotTypeToEquipPosition } from "../ui/classic";
import type { CharacterMarker } from "../ui/classic/LittleMapGui";

// ============= Types =============

// 拖放数据类型 - 与 ui/classic/MagicGui 保持一致
export interface MagicDragData {
  type: "magic";
  storeIndex: number; // 在 store 中的索引 (1-36)
}

export interface BottomMagicDragData {
  bottomSlot: number;
  listIndex: number;
}

export interface TooltipState {
  isVisible: boolean;
  good: Good | null;
  isRecycle: boolean;
  shopPrice?: number; // 商店自定义价格（已含 buyPercent），用于覆盖 good.cost 显示
  position: { x: number; y: number };
}

export interface MagicTooltipState {
  isVisible: boolean;
  magicInfo: MagicItemInfo | null;
  position: { x: number; y: number };
}

export interface MinimapState {
  mapData: MiuMapData | null;
  mapName: string;
  mapDisplayName: string;
  playerPosition: Vector2;
  cameraPosition: Vector2;
  characters: CharacterMarker[];
}

// PartnerData 用于渲染队友头像
export interface PartnerData {
  name: string;
  level: number;
  canLevelUp: boolean;
  canEquip: boolean;
}

// GoodsData 用于渲染物品相关 UI
export interface GoodsData {
  items: ({ good: Good; count: number } | null)[];
  equips: Partial<Record<EquipSlotType, { good: Good; count: number } | null>>;
  bottomGoods: ({ good: Good; count: number } | null)[];
  money: number;
}

// MagicData 用于渲染武功相关 UI
export interface MagicData {
  storeMagics: (MagicItemInfo | null)[];
  bottomMagics: (MagicItemInfo | null)[];
  xiuLianMagic: MagicItemInfo | null;
}

// BuyData 用于渲染商店 UI
export interface BuyData {
  items: (ShopItemInfo | null)[];
  buyPercent: number;
  numberValid: boolean;
  canSellSelfGoods: boolean;
}

// ============= Utility Functions =============

const equipSlotToUISlot = (slot: EquipSlotType): UIEquipSlotName => {
  const mapping: Record<EquipSlotType, UIEquipSlotName> = {
    head: "head",
    neck: "neck",
    body: "body",
    back: "back",
    hand: "hand",
    wrist: "wrist",
    foot: "foot",
  };
  return mapping[slot];
};

// ============= Hook =============

export interface UseGameUILogicOptions {
  engine: GameEngine | null;
}

export function useGameUILogic({ engine }: UseGameUILogicOptions) {
  // 使用 UIBridge hook 获取UI状态
  const {
    dispatch,
    panels,
    dialog,
    selection,
    multiSelection,
    message,
    player: uiPlayer,
  } = useUIBridge(engine);

  // 获取玩家数据
  const player = engine?.player;

  // 更新触发器
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // 订阅数据变化事件
  useEffect(() => {
    if (!engine) return;
    const events = engine.getEvents();

    const unsubs = [
      events.on("ui:goods:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:magic:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:buy:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:panel:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:player:change", () => setUpdateTrigger((v) => v + 1)),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [engine]);

  // 定期刷新 player 状态
  // 当状态面板打开时，每 200ms 刷新一次
  useEffect(() => {
    if (!panels?.state) return;

    const intervalId = setInterval(() => {
      setUpdateTrigger((v) => v + 1);
    }, 200);

    return () => clearInterval(intervalId);
  }, [panels?.state]);

  // ============= Data Getters =============

  // 获取物品数据
  const goodsData: GoodsData = useMemo(() => {
    if (!engine) {
      return { items: [], equips: {}, bottomGoods: [], money: 0 };
    }

    void updateTrigger;

    const goodsManager = engine.getGoodsListManager();
    if (!goodsManager) {
      return { items: [], equips: {}, bottomGoods: [], money: 0 };
    }

    // 底栏物品
    const bottomGoods: ({ good: Good; count: number } | null)[] = [];
    for (let i = 221; i <= 223; i++) {
      const entry = goodsManager.getItemInfo(i);
      if (entry?.good) {
        bottomGoods.push({ good: entry.good, count: entry.count });
      } else {
        bottomGoods.push(null);
      }
    }

    // 背包物品
    const items: ({ good: Good; count: number } | null)[] = [];
    for (let i = 1; i <= 198; i++) {
      const entry = goodsManager.getItemInfo(i);
      if (entry?.good) {
        items.push({ good: entry.good, count: entry.count });
      } else {
        items.push(null);
      }
    }

    // 装备
    type EquipSlots = Partial<Record<EquipSlotType, { good: Good; count: number } | null>>;
    const equips: EquipSlots = {};
    const equipIndices = [201, 202, 203, 204, 205, 206, 207];
    const equipSlots: EquipSlotType[] = ["head", "neck", "body", "back", "hand", "wrist", "foot"];

    equipIndices.forEach((index, i) => {
      const entry = goodsManager.getItemInfo(index);
      if (entry?.good) {
        equips[equipSlots[i]] = { good: entry.good, count: entry.count };
      }
    });

    const playerMoney = engine.player.money;
    return { items, equips, bottomGoods, money: playerMoney };
  }, [engine, updateTrigger]);

  // 获取武功数据
  const magicData: MagicData = useMemo(() => {
    if (!engine) {
      return { storeMagics: [], bottomMagics: [], xiuLianMagic: null };
    }

    void updateTrigger;

    const bottomMagics = engine.getBottomMagics();
    const storeMagics = engine.getStoreMagics();
    const gameManager = engine.getGameManager();
    const xiuLianMagic = gameManager.magicInventory.getItemInfo(49) ?? null;

    return { storeMagics, bottomMagics, xiuLianMagic };
  }, [engine, updateTrigger]);

  // 获取商店数据
  const buyData: BuyData = useMemo(() => {
    const defaultData: BuyData = {
      items: [],
      buyPercent: 100,
      numberValid: false,
      canSellSelfGoods: true,
    };

    if (!engine) return defaultData;

    void updateTrigger;

    const gameManager = engine.getGameManager();
    const buyManager = gameManager.buyManager;
    if (!buyManager.isOpen()) return defaultData;

    return {
      items: buyManager.getGoodsArray(),
      buyPercent: buyManager.getBuyPercent(),
      numberValid: buyManager.isNumberValid(),
      canSellSelfGoods: buyManager.getCanSellSelfGoods(),
    };
  }, [engine, updateTrigger]);

  // ============= NPC Hover State =============

  const [hoveredNpc, setHoveredNpc] = useState<Npc | null>(null);
  const [npcUpdateKey, setNpcUpdateKey] = useState(0);

  useEffect(() => {
    if (!engine) return;

    let animationFrameId: number;
    let lastNpcId: string | null = null;
    let lastLife = -1;

    const updateHoveredNpc = () => {
      const gameManager = engine.getGameManager();
      const interactionManager = (
        gameManager as unknown as {
          interactionManager?: { getHoverTarget: () => { npc: Npc | null } };
        }
      ).interactionManager;
      if (interactionManager) {
        const hoverTarget = interactionManager.getHoverTarget();
        const currentNpc = hoverTarget.npc;

        const currentNpcId = currentNpc?.id ?? null;
        const currentLife = currentNpc?.life ?? -1;

        if (currentNpcId !== lastNpcId) {
          lastNpcId = currentNpcId;
          lastLife = currentLife;
          setHoveredNpc(currentNpc);
        } else if (currentNpc && currentLife !== lastLife) {
          lastLife = currentLife;
          setNpcUpdateKey((k) => k + 1);
        }
      }

      animationFrameId = requestAnimationFrame(updateHoveredNpc);
    };

    animationFrameId = requestAnimationFrame(updateHoveredNpc);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [engine]);

  // ============= Drag-Drop State =============

  const [dragData, setDragData] = useState<DragData | null>(null);
  const [magicDragData, setMagicDragData] = useState<MagicDragData | null>(null);
  const [bottomMagicDragData, setBottomMagicDragData] = useState<BottomMagicDragData | null>(null);

  // ============= Tooltip State =============

  const [tooltip, setTooltip] = useState<TooltipState>({
    isVisible: false,
    good: null,
    isRecycle: false,
    position: { x: 0, y: 0 },
  });

  const [magicTooltip, setMagicTooltip] = useState<MagicTooltipState>({
    isVisible: false,
    magicInfo: null,
    position: { x: 0, y: 0 },
  });

  // ============= Timer State =============

  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    seconds: 0,
    isHidden: false,
    elapsedMilliseconds: 0,
    timeScripts: [],
  });

  useEffect(() => {
    if (!engine) return;

    let animationFrameId: number;

    const updateTimerState = () => {
      const timerManager = engine.getTimerManager();
      const state = timerManager.getState();
      setTimerState((prev) => {
        if (
          prev.isRunning === state.isRunning &&
          prev.seconds === state.seconds &&
          prev.isHidden === state.isHidden &&
          prev.elapsedMilliseconds === state.elapsedMilliseconds &&
          prev.timeScripts.length === state.timeScripts.length
        ) {
          return prev;
        }
        return { ...state };
      });
      animationFrameId = requestAnimationFrame(updateTimerState);
    };

    animationFrameId = requestAnimationFrame(updateTimerState);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [engine]);

  // ============= Partner State (队友头像) =============

  const [partnersData, setPartnersData] = useState<PartnerData[]>([]);

  useEffect(() => {
    if (!engine) return;

    let animationFrameId: number;

    const updatePartnersData = () => {
      const npcManager = engine.npcManager;
      if (!npcManager) {
        animationFrameId = requestAnimationFrame(updatePartnersData);
        return;
      }

      const partners = npcManager.getAllPartner();
      const newData: PartnerData[] = partners.map((npc) => ({
        name: npc.name,
        level: npc.level,
        canLevelUp: npc.canLevelUp > 0,
        canEquip: npc.canEquip > 0,
      }));

      // 只在数据变化时更新
      setPartnersData((prev) => {
        if (prev.length !== newData.length) return newData;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].name !== newData[i].name || prev[i].level !== newData[i].level) {
            return newData;
          }
        }
        return prev;
      });

      animationFrameId = requestAnimationFrame(updatePartnersData);
    };

    animationFrameId = requestAnimationFrame(updatePartnersData);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [engine]);

  // ============= Minimap State =============

  const [minimapState, setMinimapState] = useState<MinimapState>({
    mapData: null,
    mapName: "",
    mapDisplayName: "",
    playerPosition: { x: 0, y: 0 },
    cameraPosition: { x: 0, y: 0 },
    characters: [],
  });

  const mapNameDictionaryRef = useRef<Map<string, string> | null>(null);

  // 加载地图名称字典
  useEffect(() => {
    const loadMapNameDictionary = async () => {
      if (mapNameDictionaryRef.current) return;
      try {
        const content = await resourceLoader.loadText(DefaultPaths.MAP_NAME_INI);
        if (!content) {
          logger.warn("[useGameUILogic] Failed to load mapname.ini");
          return;
        }
        const dictionary = new Map<string, string>();
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith(";")) continue;
          const eqIndex = trimmed.indexOf("=");
          if (eqIndex === -1) continue;
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (key && value) {
            dictionary.set(key, value);
          }
        }
        mapNameDictionaryRef.current = dictionary;
        logger.debug("[useGameUILogic] Loaded mapname.ini with", dictionary.size, "entries");
      } catch (error) {
        logger.error("[useGameUILogic] Error loading mapname.ini:", error);
      }
    };
    loadMapNameDictionary();
  }, []);

  // 更新小地图状态
  useEffect(() => {
    if (!engine || !panels?.littleMap) return;

    let animationFrameId: number;

    const updateMinimapState = () => {
      const playerInst = engine.player;
      const cameraPos = engine.getCameraPosition();
      const mapData = engine.getMapData();
      const npcManager = engine.npcManager;
      const mapName = engine.getCurrentMapName();

      let mapDisplayName = "无名地图";
      if (mapNameDictionaryRef.current && mapName) {
        const displayName = mapNameDictionaryRef.current.get(mapName);
        if (displayName) {
          mapDisplayName = displayName;
        }
      }

      const characters: CharacterMarker[] = [];
      if (npcManager) {
        const npcs = npcManager.getAllNpcs();
        for (const [_id, npc] of npcs) {
          if (!npc.isDeathInvoked && npc.isVisible && npc.shouldShowOnMinimap()) {
            let type: CharacterMarker["type"] = "neutral";
            if (npc.isEnemy) {
              type = "enemy";
            } else if (npc.isPartner) {
              type = "partner";
            }
            characters.push({
              x: npc.pixelPosition.x,
              y: npc.pixelPosition.y,
              type,
            });
          }
        }
      }

      setMinimapState({
        mapData: mapData,
        mapName: mapName,
        mapDisplayName: mapDisplayName,
        playerPosition: playerInst
          ? { x: playerInst.pixelPosition.x, y: playerInst.pixelPosition.y }
          : { x: 0, y: 0 },
        cameraPosition: cameraPos || { x: 0, y: 0 },
        characters,
      });

      animationFrameId = requestAnimationFrame(updateMinimapState);
    };

    animationFrameId = requestAnimationFrame(updateMinimapState);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [engine, panels?.littleMap]);

  // ============= Panel Toggles =============

  const togglePanel = useCallback(
    (
      panel: "state" | "equip" | "xiulian" | "goods" | "magic" | "memo" | "system" | "littleMap"
    ) => {
      dispatch({ type: "TOGGLE_PANEL", panel });
    },
    [dispatch]
  );

  // ============= Equipment Handlers =============

  const handleEquipRightClick = useCallback(
    (slot: EquipSlotType) => {
      dispatch({ type: "UNEQUIP_ITEM", slot: equipSlotToUISlot(slot) });
    },
    [dispatch]
  );

  const handleEquipDrop = useCallback(
    (slot: EquipSlotType, data: DragData) => {
      if (data.type === "goods") {
        dispatch({ type: "EQUIP_ITEM", fromIndex: data.index, toSlot: equipSlotToUISlot(slot) });
      } else if (data.type === "equip" && data.sourceSlot) {
        dispatch({
          type: "SWAP_EQUIP_SLOTS",
          fromSlot: equipSlotToUISlot(data.sourceSlot),
          toSlot: equipSlotToUISlot(slot),
        });
      }
      setDragData(null);
    },
    [dispatch]
  );

  const handleEquipDragStart = useCallback((slot: EquipSlotType, good: Good) => {
    const slotIndex = slotTypeToEquipPosition(slot) + 200;
    setDragData({
      type: "equip",
      index: slotIndex,
      good,
      sourceSlot: slot,
    });
  }, []);

  // ============= Good Handlers =============

  const handleGoodsRightClick = useCallback(
    (index: number) => {
      // index 已经是 1-based 的背包索引，由 GoodsPanel/GoodsGui 传入
      if (panels?.buy) {
        dispatch({ type: "SELL_ITEM", bagIndex: index });
        return;
      }

      dispatch({ type: "USE_ITEM", index });
    },
    [dispatch, panels?.buy]
  );

  const handleGoodsDrop = useCallback(
    (targetIndex: number, data: DragData) => {
      if (data.type === "goods") {
        dispatch({ type: "SWAP_ITEMS", fromIndex: data.index, toIndex: targetIndex });
      } else if (data.type === "equip") {
        dispatch({
          type: "EQUIP_ITEM",
          fromIndex: targetIndex,
          toSlot: equipSlotToUISlot(data.sourceSlot!),
        });
      } else if (data.type === "bottom") {
        dispatch({ type: "SWAP_ITEMS", fromIndex: data.index, toIndex: targetIndex });
      }
      setDragData(null);
    },
    [dispatch]
  );

  const handleGoodsDragStart = useCallback((index: number, good: Good) => {
    setDragData({
      type: "goods",
      index,
      good,
    });
  }, []);

  const handleGoodsDropOnBottom = useCallback(
    (targetBottomSlot: number) => {
      if (!dragData) return;

      if (dragData.good.kind !== GoodKind.Drug) {
        dispatch({ type: "SHOW_MESSAGE", text: "只有药品可以放到快捷栏" });
        setDragData(null);
        return;
      }

      const targetIndex = 221 + targetBottomSlot;

      if (dragData.type === "goods") {
        dispatch({ type: "SWAP_ITEMS", fromIndex: dragData.index, toIndex: targetIndex });
      } else if (dragData.type === "bottom") {
        dispatch({ type: "SWAP_ITEMS", fromIndex: dragData.index, toIndex: targetIndex });
      }

      setDragData(null);
    },
    [dispatch, dragData]
  );

  const handleBottomGoodsDragStart = useCallback(
    (bottomSlot: number) => {
      if (!engine) return;
      const goodsManager = engine.getGoodsListManager();

      const actualIndex = 221 + bottomSlot;
      const entry = goodsManager.getItemInfo(actualIndex);
      if (entry?.good) {
        setDragData({
          type: "bottom",
          index: actualIndex,
          good: entry.good,
        });
      }
    },
    [engine]
  );

  const handleUseBottomGood = useCallback(
    (bottomSlot: number) => {
      dispatch({ type: "USE_BOTTOM_ITEM", slotIndex: bottomSlot });
    },
    [dispatch]
  );

  // ============= Magic Handlers =============

  const handleMagicDragStart = useCallback((data: MagicDragData) => {
    setMagicDragData(data);
    setBottomMagicDragData(null);
  }, []);

  const handleBottomMagicDragStart = useCallback(
    (bottomSlot: number) => {
      if (!engine) return;
      const listIndex =
        engine.getGameManager().magicInventory.bottomIndexToListIndex(bottomSlot) ??
        bottomSlot + 41;
      setBottomMagicDragData({ bottomSlot, listIndex });
      setMagicDragData(null);
    },
    [engine]
  );

  const handleMagicDragEnd = useCallback(() => {
    setMagicDragData(null);
    setBottomMagicDragData(null);
  }, []);

  const handleMagicDropOnStore = useCallback(
    (targetStoreIndex: number, source: MagicDragData) => {
      if (source && source.storeIndex > 0) {
        dispatch({ type: "SWAP_MAGIC", fromIndex: source.storeIndex, toIndex: targetStoreIndex });
      } else if (bottomMagicDragData) {
        dispatch({
          type: "SWAP_MAGIC",
          fromIndex: bottomMagicDragData.listIndex,
          toIndex: targetStoreIndex,
        });
      }
      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [dispatch, bottomMagicDragData]
  );

  const handleMagicDropOnBottom = useCallback(
    (targetBottomSlot: number) => {
      if (magicDragData) {
        dispatch({
          type: "ASSIGN_MAGIC_TO_BOTTOM",
          magicIndex: magicDragData.storeIndex,
          bottomSlot: targetBottomSlot,
        });
      } else if (bottomMagicDragData) {
        if (!engine) return;
        const targetListIndex = engine
          .getGameManager()
          .magicInventory.bottomIndexToListIndex(targetBottomSlot);
        if (targetListIndex !== undefined) {
          dispatch({
            type: "SWAP_MAGIC",
            fromIndex: bottomMagicDragData.listIndex,
            toIndex: targetListIndex,
          });
        }
      }
      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [dispatch, engine, magicDragData, bottomMagicDragData]
  );

  const handleMagicDropOnXiuLian = useCallback(
    (sourceIndex: number) => {
      const xiuLianIndex = 49;

      if (magicDragData && magicDragData.storeIndex > 0) {
        dispatch({
          type: "SWAP_MAGIC",
          fromIndex: magicDragData.storeIndex,
          toIndex: xiuLianIndex,
        });
      } else if (bottomMagicDragData) {
        dispatch({
          type: "SWAP_MAGIC",
          fromIndex: bottomMagicDragData.listIndex,
          toIndex: xiuLianIndex,
        });
      } else if (sourceIndex > 0 && sourceIndex !== xiuLianIndex) {
        dispatch({ type: "SWAP_MAGIC", fromIndex: sourceIndex, toIndex: xiuLianIndex });
      }

      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [dispatch, magicDragData, bottomMagicDragData]
  );

  const handleXiuLianDragStart = useCallback((data: MagicDragData) => {
    setMagicDragData(data);
    setBottomMagicDragData(null);
  }, []);

  // ============= Tooltip Handlers =============

  const handleMouseEnter = useCallback(
    (_: number | EquipSlotType, good: Good | null, rect: DOMRect) => {
      if (good) {
        setTooltip({
          isVisible: true,
          good,
          isRecycle: false,
          shopPrice: undefined,
          position: { x: rect.right + 10, y: rect.top },
        });
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const handleMagicHover = useCallback((magicInfo: MagicItemInfo | null, x: number, y: number) => {
    if (magicInfo?.magic) {
      setMagicTooltip({
        isVisible: true,
        magicInfo,
        position: { x, y },
      });
    }
  }, []);

  const handleMagicLeave = useCallback(() => {
    setMagicTooltip((prev) => ({ ...prev, isVisible: false }));
  }, []);

  // Hide tooltips when panels close
  useEffect(() => {
    if (!panels?.goods && !panels?.equip && !panels?.buy) {
      setTooltip((prev) => ({ ...prev, isVisible: false }));
    }
  }, [panels?.goods, panels?.equip, panels?.buy]);

  useEffect(() => {
    if (!panels?.magic && !panels?.xiulian) {
      setMagicTooltip((prev) => ({ ...prev, isVisible: false }));
    }
  }, [panels?.magic, panels?.xiulian]);

  // ============= Shop Handlers =============

  const handleShopItemMouseEnter = useCallback(
    (_index: number, good: Good | null, rect: DOMRect) => {
      if (good) {
        // 查找当前商店物品的自定义价格
        const shopItem = buyData.items[_index];
        const rawPrice = shopItem?.price ?? 0;
        const basePrice = rawPrice > 0 ? rawPrice : good.cost;
        const effectivePrice = Math.floor((basePrice * buyData.buyPercent) / 100);
        setTooltip({
          isVisible: true,
          good,
          isRecycle: false,
          shopPrice: effectivePrice,
          position: { x: rect.right + 10, y: rect.top },
        });
      }
    },
    [buyData]
  );

  const handleShopItemRightClick = useCallback(
    (index: number) => {
      dispatch({ type: "BUY_ITEM", shopIndex: index + 1 });
    },
    [dispatch]
  );

  const handleShopClose = useCallback(() => {
    dispatch({ type: "CLOSE_SHOP" });
  }, [dispatch]);

  // ============= Return =============

  return {
    // Engine & UIBridge
    engine,
    dispatch,
    panels,
    dialog,
    selection,
    multiSelection,
    message,
    uiPlayer,
    player,

    // Data
    goodsData,
    magicData,
    buyData,
    partnersData,

    // Update trigger (用于强制刷新 player 状态)
    updateTrigger,

    // NPC hover
    hoveredNpc,
    npcUpdateKey,

    // Drag-drop state
    dragData,
    setDragData,
    magicDragData,
    setMagicDragData,
    bottomMagicDragData,
    setBottomMagicDragData,

    // Tooltips
    tooltip,
    setTooltip,
    magicTooltip,
    setMagicTooltip,

    // Timer
    timerState,

    // Minimap
    minimapState,

    // Panel toggles
    togglePanel,

    // Equipment handlers
    handleEquipRightClick,
    handleEquipDrop,
    handleEquipDragStart,

    // Good handlers
    handleGoodsRightClick,
    handleGoodsDrop,
    handleGoodsDragStart,
    handleGoodsDropOnBottom,
    handleBottomGoodsDragStart,
    handleUseBottomGood,

    // Magic handlers
    handleMagicDragStart,
    handleBottomMagicDragStart,
    handleMagicDragEnd,
    handleMagicDropOnStore,
    handleMagicDropOnBottom,
    handleMagicDropOnXiuLian,
    handleXiuLianDragStart,

    // Tooltip handlers
    handleMouseEnter,
    handleMouseLeave,
    handleMagicHover,
    handleMagicLeave,

    // Shop handlers
    handleShopItemMouseEnter,
    handleShopItemRightClick,
    handleShopClose,
  };
}

export type GameUILogic = ReturnType<typeof useGameUILogic>;
