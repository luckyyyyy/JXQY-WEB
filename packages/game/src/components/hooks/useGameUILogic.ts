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
import type { UIEquipSlotName, UIGoodData } from "@miu2d/engine/gui/ui-types";
import type { MagicItemInfo } from "@miu2d/engine/magic";
import type { MiuMapData } from "@miu2d/engine/map/types";
import type { Npc } from "@miu2d/engine/npc";
import { GoodKind } from "@miu2d/engine/player/goods";
import { MAGIC_LIST_CONFIG } from "@miu2d/engine/player/magic/magic-list-config";
import type { GameEngine } from "@miu2d/engine/runtime/game-engine";
import type { TimerState } from "@miu2d/engine/runtime/timer-manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MagicHoverData, PanelType, PlayerVitals } from "../../contexts";
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
  good: UIGoodData | null;
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
  /** 预渲染的全图 canvas（地图加载时生成） */
  minimapCanvas: HTMLCanvasElement | null;
  /** minimapCanvas 的坐标偏移：canvasPixel = worldPixel + offset */
  minimapCanvasOffset: { x: number; y: number } | null;
}

// PartnerData 用于渲染队友头像
export interface PartnerData {
  name: string;
  level: number;
  canLevelUp: boolean;
  canEquip: boolean;
  /** 引擎中的 NPC 实例引用：读档后实例会被替换，UI 据此感知"伙伴数据已重置" */
  npc: Npc;
}

// GoodsData 用于渲染物品相关 UI
export interface GoodsData {
  items: ({ good: UIGoodData; count: number } | null)[];
  equips: Partial<Record<EquipSlotType, { good: UIGoodData; count: number } | null>>;
  bottomGoods: ({ good: UIGoodData; count: number } | null)[];
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

// PlayerVitals 定义在 GameUIContext.tsx，此处通过 contexts 导入共享
export type { PlayerVitals };

// ============= Utility Functions =============

export const equipSlotToUISlot = (slot: EquipSlotType): UIEquipSlotName => {
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
    gamble,
    slot,
    doudizhu,
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
      events.on("ui:gamble:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:slot:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:doudizhu:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:panel:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:player:change", () => setUpdateTrigger((v) => v + 1)),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [engine]);

  // 血量/体力/内力实时状态 — 用 rAF 驱动，值不变时不触发 re-render
  const [playerVitals, setPlayerVitals] = useState<PlayerVitals>({
    life: 100,
    lifeMax: 100,
    mana: 50,
    manaMax: 50,
    thew: 100,
    thewMax: 100,
  });

  useEffect(() => {
    if (!engine) return;

    let animationFrameId: number;

    const updateVitals = () => {
      const p = engine.player;
      if (p) {
        setPlayerVitals((prev) => {
          if (
            prev.life === p.life &&
            prev.lifeMax === p.lifeMax &&
            prev.mana === p.mana &&
            prev.manaMax === p.manaMax &&
            prev.thew === p.thew &&
            prev.thewMax === p.thewMax
          ) {
            return prev;
          }
          return {
            life: p.life,
            lifeMax: p.lifeMax,
            mana: p.mana,
            manaMax: p.manaMax,
            thew: p.thew,
            thewMax: p.thewMax,
          };
        });
      }
      animationFrameId = requestAnimationFrame(updateVitals);
    };

    animationFrameId = requestAnimationFrame(updateVitals);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine]);

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

    // 底栏物品（独立容器，3 个槽位）
    const bottomGoods: ({ good: UIGoodData; count: number } | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const entry = goodsManager.getBottomItemAtSlot(i);
      if (entry?.good) {
        bottomGoods.push({ good: entry.good, count: entry.count });
      } else {
        bottomGoods.push(null);
      }
    }

    // 背包物品（1-500）
    const items: ({ good: UIGoodData; count: number } | null)[] = [];
    for (let i = 1; i <= 500; i++) {
      const entry = goodsManager.getItemInfo(i);
      if (entry?.good) {
        items.push({ good: entry.good, count: entry.count });
      } else {
        items.push(null);
      }
    }

    // 装备（独立 equipSlots，0=Head..6=Foot）
    type EquipSlots = Partial<Record<EquipSlotType, { good: UIGoodData; count: number } | null>>;
    const equips: EquipSlots = {};
    const equipSlots: EquipSlotType[] = ["head", "neck", "body", "back", "hand", "wrist", "foot"];

    for (let i = 0; i < equipSlots.length; i++) {
      const entry = goodsManager.getEquipAtSlotIndex(i);
      if (entry?.good) {
        equips[equipSlots[i]] = { good: entry.good, count: entry.count };
      }
    }

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
    const xiuLianMagic = gameManager.magicInventory.getXiuLianMagicForDisplay();

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
        npc,
      }));

      // 数据变化（含 NPC 实例引用变化，覆盖读档场景）才更新引用
      setPartnersData((prev) => {
        if (prev.length !== newData.length) return newData;
        for (let i = 0; i < prev.length; i++) {
          const p = prev[i];
          const n = newData[i];
          if (
            p.npc !== n.npc ||
            p.name !== n.name ||
            p.level !== n.level ||
            p.canLevelUp !== n.canLevelUp ||
            p.canEquip !== n.canEquip
          ) {
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
    minimapCanvas: null,
    minimapCanvasOffset: null,
  });

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

      const mapDisplayName = mapName ?? "无名地图";

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
              name: npc.name,
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
        minimapCanvas: engine.getMinimapCanvas(),
        minimapCanvasOffset: engine.getMinimapCanvasOffset(),
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
    (panel: PanelType) => {
      dispatch({ type: "TOGGLE_PANEL", panel });
    },
    [dispatch]
  );

  // ============= Equipment Handlers =============

  const handleEquipRightClick = useCallback(
    (slot: EquipSlotType) => {
      dispatch({ type: "UNEQUIP_ITEM", slot: equipSlotToUISlot(slot) });
      // 卸下装备后格子变空，隐藏 tooltip
      setTooltip((prev) => ({ ...prev, isVisible: false }));
    },
    [dispatch, setTooltip]
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

  const handleEquipDragStart = useCallback((slot: EquipSlotType, good: UIGoodData) => {
    setDragData({
      type: "equip",
      index: slotTypeToEquipPosition(slot), // EquipPosition (1-7) as identifier
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
        setTooltip((prev) => ({ ...prev, isVisible: false }));
        return;
      }

      dispatch({ type: "USE_ITEM", index });
      // 右键装备可能触发装备交换：引擎状态同步更新，读取新格子内容更新 tooltip
      const newInfo = engine?.getGoodsListManager()?.getItemInfo(index);
      if (newInfo?.good) {
        setTooltip((prev) => ({ ...prev, good: newInfo.good }));
      } else {
        setTooltip((prev) => ({ ...prev, isVisible: false }));
      }
    },
    [dispatch, engine, panels?.buy, setTooltip]
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
        dispatch({
          type: "MOVE_BOTTOM_TO_BAG",
          bottomSlot: data.index,
          bagIndex: targetIndex,
        });
      }
      setDragData(null);
    },
    [dispatch]
  );

  const handleGoodsDragStart = useCallback((index: number, good: UIGoodData) => {
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

      if (dragData.type === "goods") {
        dispatch({
          type: "MOVE_BAG_TO_BOTTOM",
          bagIndex: dragData.index,
          bottomSlot: targetBottomSlot,
        });
      } else if (dragData.type === "bottom") {
        dispatch({ type: "SWAP_BOTTOM_GOODS", fromSlot: dragData.index, toSlot: targetBottomSlot });
      }

      setDragData(null);
    },
    [dispatch, dragData]
  );

  const handleBottomGoodsDragStart = useCallback(
    (bottomSlot: number) => {
      if (!engine) return;
      const goodsManager = engine.getGoodsListManager();
      const entry = goodsManager.getBottomItemAtSlot(bottomSlot);
      if (entry?.good) {
        setDragData({
          type: "bottom",
          index: bottomSlot,
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

  const handleBottomMagicDragStart = useCallback((bottomSlot: number) => {
    setBottomMagicDragData({ bottomSlot, listIndex: bottomSlot });
    setMagicDragData(null);
  }, []);

  const handleMagicDragEnd = useCallback(() => {
    setMagicDragData(null);
    setBottomMagicDragData(null);
  }, []);

  const handleMagicDropOnStore = useCallback(
    (targetStoreIndex: number, source: MagicDragData) => {
      if (source && source.storeIndex > 0) {
        dispatch({ type: "SWAP_MAGIC", fromIndex: source.storeIndex, toIndex: targetStoreIndex });
      } else if (bottomMagicDragData) {
        // 从快捷栏拖回技能栏：物理移动到目标面板槽位（互换）
        dispatch({
          type: "MOVE_BOTTOM_TO_PANEL",
          bottomSlot: bottomMagicDragData.bottomSlot,
          panelIndex: targetStoreIndex,
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
        // 快捷栏之间拖拽：交换两槽位引用
        dispatch({
          type: "SWAP_BOTTOM_SLOTS",
          fromSlot: bottomMagicDragData.bottomSlot,
          toSlot: targetBottomSlot,
        });
      }
      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [dispatch, magicDragData, bottomMagicDragData]
  );

  const handleMagicDropOnXiuLian = useCallback(
    (sourceIndex: number) => {
      const xiuLianIndex = MAGIC_LIST_CONFIG.xiuLianIndex;

      if (magicDragData && magicDragData.storeIndex > 0) {
        const fromIndex = magicDragData.storeIndex;
        dispatch({ type: "SWAP_MAGIC", fromIndex, toIndex: xiuLianIndex });
      } else if (bottomMagicDragData) {
        // 从快捷栏拖到修炼区：直接互换快捷栏槽位与修炼区
        dispatch({ type: "SET_XIULIAN_FROM_BOTTOM", bottomSlot: bottomMagicDragData.bottomSlot });
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
    (_: number | EquipSlotType, good: UIGoodData | null, rect: DOMRect) => {
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

  const handleMagicHover = useCallback((magicInfo: MagicHoverData | null, x: number, y: number) => {
    if (magicInfo?.magic) {
      setMagicTooltip({
        isVisible: true,
        // Safe cast: callers pass full MagicItemInfo (structurally extends MagicHoverData)
        magicInfo: magicInfo as unknown as MagicItemInfo | null,
        position: { x, y },
      });
    }
  }, []);

  const handleMagicLeave = useCallback(() => {
    setMagicTooltip((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const handleGoodsHover = useCallback((good: UIGoodData | null, x: number, y: number) => {
    if (good) {
      setTooltip({
        isVisible: true,
        good,
        isRecycle: false,
        shopPrice: undefined,
        position: { x, y },
      });
    }
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
    (_index: number, good: UIGoodData | null, rect: DOMRect) => {
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

  // ============= Gamble Handlers =============

  const handleGambleClose = useCallback(() => {
    dispatch({ type: "CLOSE_GAMBLE" });
  }, [dispatch]);

  const handleSlotClose = useCallback(() => {
    dispatch({ type: "CLOSE_SLOT" });
  }, [dispatch]);

  const handleDoudizhuClose = useCallback(() => {
    dispatch({ type: "CLOSE_DOUDIZHU" });
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
    gamble,
    slot,
    doudizhu,
    partnersData,

    // Update trigger (事件驱动：goods/magic/buy/panel/player 变化)
    updateTrigger,

    // Player vitals (rAF 驱动，只有值变化才 re-render)
    playerVitals,

    // NPC hover
    hoveredNpc,
    setHoveredNpc,
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
    handleGoodsHover,
    handleMagicHover,
    handleMagicLeave,

    // Shop handlers
    handleShopItemMouseEnter,
    handleShopItemRightClick,
    handleShopClose,

    // Gamble handlers
    handleGambleClose,

    // Slot handlers
    handleSlotClose,

    // Doudizhu handlers
    handleDoudizhuClose,
  };
}

export type GameUILogic = ReturnType<typeof useGameUILogic>;
