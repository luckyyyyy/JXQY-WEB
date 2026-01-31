/**
 * GameUI - 游戏UI组件 (使用 UIBridge 架构)
 *
 * 职责:
 * 1. 渲染所有UI组件
 * 2. 通过 UIBridge 获取游戏状态
 * 3. 通过 dispatch 派发 UI 交互动作
 *
 * 特点:
 * - 不直接依赖 GameManager，通过 UIBridge 获取状态
 * - 使用事件驱动的状态更新
 * - 所有交互通过 UIAction 类型约束
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultPaths } from "@/config";
import type { Npc } from "@/engine/character/npc";
import { logger } from "@/engine/core/logger";
import type { JxqyMapData } from "@/engine/core/mapTypes";
import { resourceLoader } from "@/engine/resource/resourceLoader";
import type { Vector2 } from "@/engine/core/types";
import type { GameEngine } from "@/engine/game/gameEngine";
import type { MagicItemInfo } from "@/engine/magic";
import type { Good } from "@/engine/player/goods";
import { GoodKind } from "@/engine/player/goods";
import type { TimerState } from "@/engine/timer";
import type { ShopItemInfo } from "@/engine/gui/buyManager";
import type { UIEquipSlotName } from "@/engine/ui/contract";
import { useUIBridge } from "./adapters";
import {
  BottomGui,
  BottomStateGui,
  BuyGui,
  type CharacterMarker,
  DialogUI,
  EquipGui,
  GoodsGui,
  ItemTooltip,
  LittleMapGui,
  MagicGui,
  MagicTooltip,
  MemoGui,
  MessageGui,
  NpcLifeBar,
  SaveLoadGui,
  SelectionMultipleUI,
  SelectionUI,
  StateGui,
  SystemGui,
  TimerGui,
  TopGui,
  VideoPlayer,
  XiuLianGui,
  slotTypeToEquipPosition,
} from "./ui";
import type { DragData, EquipSlotType } from "./ui";
import type { TooltipState } from "./ui";
import type { MagicDragData } from "./ui";
import type { MagicTooltipState } from "./ui";

interface GameUIProps {
  engine: GameEngine | null;
  width: number;
  height: number;
}

// 将 EquipSlotType 转换为 UIEquipSlotName
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

/**
 * GameUI Component
 */
export const GameUI: React.FC<GameUIProps> = ({ engine, width, height }) => {
  // 使用 UIBridge hook 获取UI状态 - 用于派发动作和获取面板状态
  const { dispatch, panels, dialog, selection, multiSelection, message } = useUIBridge(engine);

  // 获取玩家数据 - 直接从 engine 获取 (读取需要与现有组件类型兼容)
  const player = engine?.getPlayer();

  // 更新触发器 - 用于强制重新计算数据
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // 订阅数据变化事件
  useEffect(() => {
    if (!engine) return;
    const events = engine.getEvents();

    // 订阅物品/武功/商店变化 - 使用正确的事件名称
    const unsubs = [
      events.on("ui:goods:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:magic:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:buy:change", () => setUpdateTrigger((v) => v + 1)),
      events.on("ui:panel:change", () => setUpdateTrigger((v) => v + 1)),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [engine]);

  // 获取物品数据（与现有组件类型兼容）
  const goodsData = useMemo(() => {
    if (!engine) {
      return { items: [], equips: {}, bottomGoods: [], money: 0 };
    }

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

    const playerMoney = engine.getPlayer()?.money ?? 0;
    return { items, equips, bottomGoods, money: playerMoney };
  }, [engine, panels?.goods, panels?.equip, updateTrigger]);

  // 获取武功数据
  const magicData = useMemo(() => {
    if (!engine) {
      return { storeMagics: [], bottomMagics: [], xiuLianMagic: null };
    }

    const bottomMagics = engine.getBottomMagics();
    const storeMagics = engine.getStoreMagics();
    const gameManager = engine.getGameManager();
    const xiuLianMagic = gameManager?.getMagicListManager().getItemInfo(49) ?? null;

    return { storeMagics, bottomMagics, xiuLianMagic };
  }, [engine, panels?.magic, panels?.xiulian, updateTrigger]);

  // 获取商店数据
  const buyData = useMemo(() => {
    const defaultData: {
      items: (ShopItemInfo | null)[];
      buyPercent: number;
      numberValid: boolean;
      canSellSelfGoods: boolean;
    } = {
      items: [],
      buyPercent: 100,
      numberValid: false,
      canSellSelfGoods: true,
    };

    if (!engine) return defaultData;

    const gameManager = engine.getGameManager();
    if (!gameManager) return defaultData;

    const buyManager = gameManager.getBuyManager();
    if (!buyManager || !buyManager.isOpen()) return defaultData;

    return {
      items: buyManager.getGoodsArray(),
      buyPercent: buyManager.getBuyPercent(),
      numberValid: buyManager.isNumberValid(),
      canSellSelfGoods: buyManager.getCanSellSelfGoods(),
    };
  }, [engine, panels?.buy, updateTrigger]);

  // 获取悬停的NPC (用于血条显示) - 使用 useRef 存储当前NPC以避免频繁重渲染
  const [hoveredNpc, setHoveredNpc] = useState<Npc | null>(null);
  // 使用 key 来强制组件在NPC状态变化时重新渲染
  const [npcUpdateKey, setNpcUpdateKey] = useState(0);

  // 实时更新悬停NPC状态 - 使用 requestAnimationFrame 与游戏帧同步
  useEffect(() => {
    if (!engine) return;

    let animationFrameId: number;
    let lastNpcId: string | null = null;
    let lastLife = -1;

    const updateHoveredNpc = () => {
      const gameManager = engine.getGameManager();
      if (gameManager) {
        const interactionManager = (gameManager as any).interactionManager;
        if (interactionManager) {
          const hoverTarget = interactionManager.getHoverTarget();
          const currentNpc = hoverTarget.npc as Npc | null;

          // 检查NPC是否变化或生命值是否变化
          const currentNpcId = currentNpc?.id ?? null;
          const currentLife = currentNpc?.life ?? -1;

          if (currentNpcId !== lastNpcId) {
            // NPC 变化了，更新状态
            lastNpcId = currentNpcId;
            lastLife = currentLife;
            setHoveredNpc(currentNpc);
          } else if (currentNpc && currentLife !== lastLife) {
            // 同一个NPC但生命值变化了，强制更新
            lastLife = currentLife;
            setNpcUpdateKey((k) => k + 1);
          }
        }
      }

      // 继续下一帧
      animationFrameId = requestAnimationFrame(updateHoveredNpc);
    };

    // 启动帧循环
    animationFrameId = requestAnimationFrame(updateHoveredNpc);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [engine]);

  // Drag-drop state for goods/equipment
  const [dragData, setDragData] = useState<DragData | null>(null);

  // Drag-drop state for magic
  const [magicDragData, setMagicDragData] = useState<MagicDragData | null>(null);
  const [bottomMagicDragData, setBottomMagicDragData] = useState<{
    bottomSlot: number;
    listIndex: number;
  } | null>(null);

  // Tooltip states
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

  // Timer state - updated from timerManager
  const [timerState, setTimerState] = useState<TimerState>({
    isRunning: false,
    seconds: 0,
    isHidden: false,
    elapsedMilliseconds: 0,
    timeScripts: [],
  });

  // Minimap state - updated when littleMap panel is visible
  const [minimapState, setMinimapState] = useState<{
    mapData: JxqyMapData | null;
    mapName: string;
    mapDisplayName: string; // 从 mapname.ini 获取的显示名称
    playerPosition: Vector2;
    cameraPosition: Vector2;
    characters: CharacterMarker[];
  }>({
    mapData: null,
    mapName: "",
    mapDisplayName: "",
    playerPosition: { x: 0, y: 0 },
    cameraPosition: { x: 0, y: 0 },
    characters: [],
  });

  // 地图名称字典 - C# LoadNameList()
  const mapNameDictionaryRef = useRef<Map<string, string> | null>(null);

  // 加载地图名称字典 (ini/map/mapname.ini)
  useEffect(() => {
    const loadMapNameDictionary = async () => {
      if (mapNameDictionaryRef.current) return; // 已加载
      try {
        const content = await resourceLoader.loadText(DefaultPaths.MAP_NAME_INI);
        if (!content) {
          logger.warn("[GameUI] Failed to load mapname.ini");
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
        logger.debug("[GameUI] Loaded mapname.ini with", dictionary.size, "entries");
      } catch (error) {
        logger.error("[GameUI] Error loading mapname.ini:", error);
      }
    };
    loadMapNameDictionary();
  }, []);

  // Update timer state from engine
  useEffect(() => {
    if (!engine) return;

    let animationFrameId: number;

    const updateTimerState = () => {
      const timerManager = engine.getTimerManager();
      const state = timerManager.getState();
      // Copy the state to trigger React update
      setTimerState({ ...state });
      animationFrameId = requestAnimationFrame(updateTimerState);
    };

    animationFrameId = requestAnimationFrame(updateTimerState);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [engine]);

  // Update minimap state when littleMap panel is visible
  useEffect(() => {
    if (!engine || !panels?.littleMap) return;

    let animationFrameId: number;

    const updateMinimapState = () => {
      const player = engine.getPlayer();
      const cameraPos = engine.getCameraPosition();
      const mapData = engine.getMapData();
      const npcManager = engine.getNpcManager();
      const mapName = engine.getCurrentMapName();

      // 获取地图显示名称 - C#: LittleMapGui.Update() 中的逻辑
      let mapDisplayName = "无名地图";
      if (mapNameDictionaryRef.current && mapName) {
        const displayName = mapNameDictionaryRef.current.get(mapName);
        if (displayName) {
          mapDisplayName = displayName;
        }
      }

      // 收集角色标记 - C#: LittleMapGui.DrawCharacter()
      // 只显示 shouldShowOnMinimap() 返回 true 的角色
      const characters: CharacterMarker[] = [];
      if (npcManager) {
        const npcs = npcManager.getAllNpcs();
        for (const [_id, npc] of npcs) {
          // C#: DrawCharacter 中检查角色是否在视口内，但我们这里收集所有应该显示的
          // 过滤条件：未死亡、可见、shouldShowOnMinimap()
          if (!npc.isDeathInvoked && npc.isVisible && npc.shouldShowOnMinimap()) {
            let type: CharacterMarker["type"] = "neutral";
            if (npc.isEnemy) {
              type = "enemy";
            } else if (npc.isPartner) {
              type = "partner";
            }
            // 只有 Normal/Fighter/Eventer 类型才会走到这里显示为 neutral
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
        playerPosition: player ? { x: player.pixelPosition.x, y: player.pixelPosition.y } : { x: 0, y: 0 },
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
    (panel: "state" | "equip" | "xiulian" | "goods" | "magic" | "memo" | "system" | "littleMap") => {
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
        dispatch({ type: "SWAP_EQUIP_SLOTS", fromSlot: equipSlotToUISlot(data.sourceSlot), toSlot: equipSlotToUISlot(slot) });
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

  // ============= Goods Handlers =============

  const handleGoodsRightClick = useCallback(
    (index: number) => {
      const actualIndex = index + 1;

      // 如果商店打开，右键物品是卖给商店
      if (panels?.buy) {
        dispatch({ type: "SELL_ITEM", bagIndex: actualIndex });
        return;
      }

      // 商店未打开时，右键是使用/装备物品
      dispatch({ type: "USE_ITEM", index: actualIndex });
    },
    [dispatch, panels?.buy]
  );

  const handleGoodsDrop = useCallback(
    (targetIndex: number, data: DragData) => {
      const actualTargetIndex = targetIndex + 1;

      if (data.type === "goods") {
        dispatch({ type: "SWAP_ITEMS", fromIndex: data.index, toIndex: actualTargetIndex });
      } else if (data.type === "equip") {
        dispatch({ type: "EQUIP_ITEM", fromIndex: actualTargetIndex, toSlot: equipSlotToUISlot(data.sourceSlot!) });
      } else if (data.type === "bottom") {
        // 从底栏拖回背包
        dispatch({ type: "SWAP_ITEMS", fromIndex: data.index, toIndex: actualTargetIndex });
      }

      setDragData(null);
    },
    [dispatch]
  );

  const handleGoodsDragStart = useCallback((index: number, good: Good) => {
    const actualIndex = index + 1;
    setDragData({
      type: "goods",
      index: actualIndex,
      good,
    });
  }, []);

  // 物品拖拽到底栏 (Z/X/C 快捷栏) - 只允许药品
  const handleGoodsDropOnBottom = useCallback(
    (targetBottomSlot: number) => {
      if (!dragData) return;

      // 只有药品(Drug)可以放到快捷栏
      if (dragData.good.kind !== GoodKind.Drug) {
        dispatch({ type: "SHOW_MESSAGE", text: "只有药品可以放到快捷栏" });
        setDragData(null);
        return;
      }

      // 底栏物品索引: 221 + slotIndex (0-2)
      const targetIndex = 221 + targetBottomSlot;

      if (dragData.type === "goods") {
        // 从背包拖到底栏
        dispatch({ type: "SWAP_ITEMS", fromIndex: dragData.index, toIndex: targetIndex });
      } else if (dragData.type === "bottom") {
        // 底栏内交换
        dispatch({ type: "SWAP_ITEMS", fromIndex: dragData.index, toIndex: targetIndex });
      }

      setDragData(null);
    },
    [dispatch, dragData]
  );

  // 从底栏开始拖拽物品
  const handleBottomGoodsDragStart = useCallback(
    (bottomSlot: number) => {
      const goodsManager = engine?.getGoodsListManager();
      if (!goodsManager) return;

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

  // 使用底栏物品 (Z/X/C)
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
      // Get the list index from bottom slot
      const listIndex = engine?.getGameManager()?.getMagicListManager()?.bottomIndexToListIndex(bottomSlot) ?? (bottomSlot + 41);
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
        dispatch({ type: "SWAP_MAGIC", fromIndex: bottomMagicDragData.listIndex, toIndex: targetStoreIndex });
      }

      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [dispatch, bottomMagicDragData]
  );

  const handleMagicDropOnBottom = useCallback(
    (targetBottomSlot: number) => {
      if (magicDragData) {
        dispatch({ type: "ASSIGN_MAGIC_TO_BOTTOM", magicIndex: magicDragData.storeIndex, bottomSlot: targetBottomSlot });
      } else if (bottomMagicDragData) {
        const targetListIndex = engine?.getGameManager()?.getMagicListManager()?.bottomIndexToListIndex(targetBottomSlot);
        if (targetListIndex !== undefined) {
          dispatch({ type: "SWAP_MAGIC", fromIndex: bottomMagicDragData.listIndex, toIndex: targetListIndex });
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
        dispatch({ type: "SWAP_MAGIC", fromIndex: magicDragData.storeIndex, toIndex: xiuLianIndex });
      } else if (bottomMagicDragData) {
        dispatch({ type: "SWAP_MAGIC", fromIndex: bottomMagicDragData.listIndex, toIndex: xiuLianIndex });
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

  // ============= Hide Tooltips when Panels Close =============
  // 当物品/装备面板关闭时，隐藏ItemTooltip
  useEffect(() => {
    if (!panels?.goods && !panels?.equip && !panels?.buy) {
      setTooltip((prev) => ({ ...prev, isVisible: false }));
    }
  }, [panels?.goods, panels?.equip, panels?.buy]);

  // 当武功/修炼面板关闭时，隐藏MagicTooltip
  useEffect(() => {
    if (!panels?.magic && !panels?.xiulian) {
      setMagicTooltip((prev) => ({ ...prev, isVisible: false }));
    }
  }, [panels?.magic, panels?.xiulian]);

  // ============= Shop Handlers =============

  // 商店物品鼠标悬停显示 Tooltip
  const handleShopItemMouseEnter = useCallback(
    (_index: number, good: Good | null, rect: DOMRect) => {
      if (good) {
        setTooltip({
          isVisible: true,
          good,
          isRecycle: false, // 商店显示购买价格
          position: { x: rect.right + 10, y: rect.top },
        });
      }
    },
    []
  );

  // 商店物品右键购买
  const handleShopItemRightClick = useCallback(
    async (index: number) => {
      // index 是从 0 开始的显示索引，需要 +1 转为商店物品索引
      dispatch({ type: "BUY_ITEM", shopIndex: index + 1 });
    },
    [dispatch]
  );

  // 关闭商店
  const handleShopClose = useCallback(() => {
    dispatch({ type: "CLOSE_SHOP" });
  }, [dispatch]);

  if (!engine) return null;

  return (
    <>
      {/* Top GUI */}
      <TopGui
        screenWidth={width}
        onStateClick={() => togglePanel("state")}
        onEquipClick={() => togglePanel("equip")}
        onXiuLianClick={() => togglePanel("xiulian")}
        onGoodsClick={() => togglePanel("goods")}
        onMagicClick={() => togglePanel("magic")}
        onMemoClick={() => togglePanel("memo")}
        onSystemClick={() => togglePanel("system")}
      />

      {/* Timer GUI - shown when timer is running */}
      {timerState.isRunning && !timerState.isHidden && (
        <TimerGui timerState={timerState} screenWidth={width} />
      )}

      {/* NPC Life Bar - shown when hovering over NPC, key forces re-render on life change */}
      <NpcLifeBar key={npcUpdateKey} npc={hoveredNpc} screenWidth={width} />

      {/* Bottom State GUI */}
      {player && (
        <BottomStateGui
          life={player.life}
          maxLife={player.lifeMax}
          thew={player.thew}
          maxThew={player.thewMax}
          mana={player.mana}
          maxMana={player.manaMax}
          screenWidth={width}
          screenHeight={height}
        />
      )}

      {/* Bottom GUI */}
      <BottomGui
        goodsItems={goodsData.bottomGoods}
        magicItems={magicData.bottomMagics}
        screenWidth={width}
        screenHeight={height}
        onItemClick={(index) => {
          if (index < 3) {
            // 物品槽点击 - 使用物品
            handleUseBottomGood(index);
          } else {
            // 武功槽点击 - 使用武功
            dispatch({ type: "USE_MAGIC_BY_BOTTOM", bottomSlot: index - 3 });
          }
        }}
        onItemRightClick={(index) => {
          if (index < 3) {
            // 物品槽右键
            // 如果商店打开，卖物品
            if (panels?.buy) {
              dispatch({ type: "SELL_ITEM", bagIndex: 221 + index });
            } else {
              // 商店未打开，使用物品
              handleUseBottomGood(index);
            }
          } else {
            // 武功槽右键 - 设置为当前武功
            dispatch({ type: "SET_CURRENT_MAGIC_BY_BOTTOM", bottomIndex: index - 3 });
          }
        }}
        onMagicRightClick={(magicIndex) => {
          dispatch({ type: "SET_CURRENT_MAGIC_BY_BOTTOM", bottomIndex: magicIndex });
        }}
        onDragStart={(data) => {
          if (data.type === "magic") {
            handleBottomMagicDragStart(data.listIndex);
          } else if (data.type === "goods") {
            handleBottomGoodsDragStart(data.slotIndex);
          }
        }}
        onDrop={(targetIndex) => {
          if (targetIndex < 3) {
            // 拖到物品槽
            if (dragData) {
              handleGoodsDropOnBottom(targetIndex);
            }
          } else if (targetIndex >= 3 && (magicDragData || bottomMagicDragData)) {
            // 拖到武功槽
            handleMagicDropOnBottom(targetIndex - 3);
          }
        }}
        onDragEnd={() => {
          handleMagicDragEnd();
          setDragData(null);
        }}
        onMagicHover={handleMagicHover}
        onMagicLeave={handleMagicLeave}
        onGoodsHover={(goodData, x, y) => {
          if (goodData?.good) {
            setTooltip({
              isVisible: true,
              good: goodData.good,
              isRecycle: false,
              position: { x, y },
            });
          }
        }}
        onGoodsLeave={handleMouseLeave}
      />

      {/* Dialog - 使用事件驱动状态 */}
      {dialog?.isVisible && (
        <DialogUI
          state={dialog}
          screenWidth={width}
          screenHeight={height}
          onClose={() => dispatch({ type: "DIALOG_CLICK" })}
          onSelectionMade={(sel) => {
            dispatch({ type: "DIALOG_SELECT", selection: sel });
          }}
        />
      )}

      {/* Selection - 使用事件驱动状态 */}
      {selection?.isVisible && (
        <SelectionUI
          state={{
            ...selection,
            options: selection.options.map((o) => ({ ...o })),
          }}
          screenWidth={width}
          screenHeight={height}
          onSelect={(index) => dispatch({ type: "SELECTION_CHOOSE", index })}
        />
      )}

      {/* Multi-Selection - 多选UI */}
      {multiSelection?.isVisible && (
        <SelectionMultipleUI
          state={{
            ...multiSelection,
            options: multiSelection.options.map((o) => ({ ...o })),
            selectedIndices: [...multiSelection.selectedIndices],
          }}
          screenWidth={width}
          screenHeight={height}
          onToggleSelection={(index) => dispatch({ type: "MULTI_SELECTION_TOGGLE", index })}
        />
      )}

      {/* State Panel - 使用事件驱动状态 */}
      {panels?.state && player && (
        <StateGui
          isVisible={true}
          stats={{
            level: player.level,
            exp: player.exp,
            levelUpExp: player.levelUpExp,
            life: player.life,
            lifeMax: player.lifeMax,
            thew: player.thew,
            thewMax: player.thewMax,
            mana: player.mana,
            manaMax: player.manaMax,
            attack: player.attack,
            defend: player.defend,
            evade: player.evade,
          }}
          screenWidth={width}
          onClose={() => togglePanel("state")}
        />
      )}

      {/* Equip Panel */}
      {panels?.equip && (
        <EquipGui
          isVisible={true}
          equips={goodsData.equips}
          screenWidth={width}
          onSlotRightClick={handleEquipRightClick}
          onSlotDrop={handleEquipDrop}
          onSlotDragStart={handleEquipDragStart}
          onSlotMouseEnter={handleMouseEnter}
          onSlotMouseLeave={handleMouseLeave}
          onClose={() => togglePanel("equip")}
          dragData={dragData}
        />
      )}

      {/* XiuLian Panel */}
      {panels?.xiulian && (
        <XiuLianGui
          isVisible={true}
          magicInfo={magicData.xiuLianMagic}
          screenWidth={width}
          onClose={() => togglePanel("xiulian")}
          onDrop={handleMagicDropOnXiuLian}
          onDragStart={handleXiuLianDragStart}
          onDragEnd={handleMagicDragEnd}
          dragData={magicDragData}
          bottomDragData={bottomMagicDragData}
          onMagicHover={handleMagicHover}
          onMagicLeave={handleMagicLeave}
        />
      )}

      {/* Goods Panel */}
      {panels?.goods && (
        <GoodsGui
          isVisible={true}
          items={goodsData.items}
          money={goodsData.money}
          screenWidth={width}
          onItemRightClick={handleGoodsRightClick}
          onItemDrop={handleGoodsDrop}
          onItemDragStart={handleGoodsDragStart}
          onItemMouseEnter={handleMouseEnter}
          onItemMouseLeave={handleMouseLeave}
          onClose={() => togglePanel("goods")}
          dragData={dragData}
        />
      )}

      {/* Magic Panel */}
      {panels?.magic && (
        <MagicGui
          isVisible={true}
          magicInfos={magicData.storeMagics}
          screenWidth={width}
          onMagicClick={(storeIndex) => logger.log("Magic clicked:", storeIndex)}
          onMagicRightClick={(storeIndex) => dispatch({ type: "SET_CURRENT_MAGIC", magicIndex: storeIndex })}
          onClose={() => togglePanel("magic")}
          onDragStart={handleMagicDragStart}
          onDragEnd={handleMagicDragEnd}
          onDrop={handleMagicDropOnStore}
          dragData={magicDragData}
          onMagicHover={handleMagicHover}
          onMagicLeave={handleMagicLeave}
        />
      )}

      {/* Memo Panel */}
      {panels?.memo && (
        <MemoGui
          isVisible={true}
          memos={engine?.memoListManager?.getAllMemos() ?? []}
          screenWidth={width}
          onClose={() => togglePanel("memo")}
        />
      )}

      {/* Buy/Shop Panel */}
      {panels?.buy && buyData.items.length > 0 && (
        <BuyGui
          isVisible={true}
          items={buyData.items}
          screenWidth={width}
          buyPercent={buyData.buyPercent}
          numberValid={buyData.numberValid}
          onItemRightClick={handleShopItemRightClick}
          onItemMouseEnter={handleShopItemMouseEnter}
          onItemMouseLeave={handleMouseLeave}
          onClose={handleShopClose}
        />
      )}

      {/* System Menu */}
      {panels?.system && (
        <SystemGui
          isVisible={true}
          screenWidth={width}
          screenHeight={height}
          onSaveLoad={() => dispatch({ type: "SHOW_SAVE_LOAD", visible: true })}
          onOption={() => dispatch({ type: "SHOW_MESSAGE", text: "请用游戏设置程序进行设置" })}
          onExit={() => {
            dispatch({ type: "SHOW_SYSTEM", visible: false });
          }}
          onReturn={() => dispatch({ type: "SHOW_SYSTEM", visible: false })}
        />
      )}

      {/* SaveLoad Panel (存档/读档界面) */}
      {panels?.saveLoad && (
        <SaveLoadGui
          isVisible={true}
          screenWidth={width}
          screenHeight={height}
          canSave={engine?.getGameManager()?.isSaveEnabled() ?? false}
          onSave={async (index) => {
            dispatch({ type: "SAVE_GAME", slotIndex: index });
            return true;
          }}
          onLoad={async (index) => {
            dispatch({ type: "LOAD_GAME", slotIndex: index });
            return true;
          }}
          onClose={() => dispatch({ type: "SHOW_SAVE_LOAD", visible: false })}
        />
      )}

      {/* LittleMap (小地图) - Tab键打开 */}
      {panels?.littleMap && (
        <LittleMapGui
          isVisible={true}
          screenWidth={width}
          screenHeight={height}
          mapData={minimapState.mapData}
          mapName={minimapState.mapName}
          mapDisplayName={minimapState.mapDisplayName}
          playerPosition={minimapState.playerPosition}
          characters={minimapState.characters}
          cameraPosition={minimapState.cameraPosition}
          onClose={() => togglePanel("littleMap")}
          onMapClick={(worldPos) => {
            // 点击小地图移动玩家 - C#: LittleMapGui.RegisterHadler
            dispatch({ type: "MINIMAP_CLICK", worldX: worldPos.x, worldY: worldPos.y });
            // 关闭小地图
            togglePanel("littleMap");
          }}
        />
      )}

      {/* Message Notification - 使用事件驱动状态 */}
      <MessageGui
        isVisible={message?.isVisible ?? false}
        message={message?.text ?? ""}
        screenWidth={width}
        screenHeight={height}
      />

      {/* Item Tooltip */}
      <ItemTooltip isVisible={tooltip.isVisible} good={tooltip.good} position={tooltip.position} />

      {/* Magic Tooltip */}
      <MagicTooltip
        isVisible={magicTooltip.isVisible}
        magicInfo={magicTooltip.magicInfo}
        position={magicTooltip.position}
      />

      {/* Video Player - 全屏视频播放 */}
      <VideoPlayer engine={engine} />

      {/* Engine Watermark */}
      <div
        style={{
          position: "absolute",
          right: 8,
          bottom: 4,
          fontSize: 10,
          color: "rgba(255, 255, 255, 0.25)",
          pointerEvents: "none",
          userSelect: "none",
          fontFamily: "sans-serif",
          letterSpacing: 0.5,
        }}
      >
        Powered by Vibe2D Engine
      </div>
    </>
  );
};
