/**
 * GameUI - 游戏UI组件
 *
 * 职责:
 * 1. 渲染所有UI组件
 * 2. 通过hooks获取游戏状态
 * 3. 处理UI交互
 *
 * 特点:
 * - 不直接依赖GameManager，通过GameEngine获取状态
 * - 仅在UI面板打开时获取详细数据
 * - 使用事件驱动的状态更新
 */

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultPaths } from "@/config";
import type { Npc } from "@/engine/character/npc";
import { logger } from "@/engine/core/logger";
import type { JxqyMapData } from "@/engine/core/mapTypes";
import { toTilePosition } from "@/engine/map/map";
import { resourceLoader } from "@/engine/resource/resourceLoader";
import type { Vector2 } from "@/engine/core/types";
import type { GameEngine } from "@/engine/game/gameEngine";
import type { MagicItemInfo } from "@/engine/magic";
import type { Good } from "@/engine/player/goods";
import { GoodKind } from "@/engine/player/goods";
import type { TimerState } from "@/engine/timer";
import { useGameUI } from "@/hooks";
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
} from "./ui";
import type { DragData, EquipSlotType } from "./ui/EquipGui";
import { slotTypeToEquipPosition } from "./ui/EquipGui";
import type { TooltipState } from "./ui/ItemTooltip";
import type { MagicDragData } from "./ui/MagicGui";
import type { MagicTooltipState } from "./ui/MagicTooltip";

interface GameUIProps {
  engine: GameEngine | null;
  width: number;
  height: number;
}

/**
 * GameUI Component
 */
export const GameUI: React.FC<GameUIProps> = ({ engine, width, height }) => {
  // 使用 useGameUI hook 获取UI状态 (方案A: 事件驱动)
  const { dialogState, selectionState, multiSelectionState, panelState, messageState, goodsData, magicData, buyData } =
    useGameUI(engine);

  // 获取玩家数据
  const player = engine?.getPlayer();

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
    if (!engine || !panelState?.littleMap) return;

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
  }, [engine, panelState?.littleMap]);

  // ============= Equipment Handlers =============

  const handleEquipRightClick = useCallback(
    (slot: EquipSlotType) => {
      const goodsManager = engine?.getGoodsListManager();
      if (!goodsManager) return;
      const slotIndex = slotTypeToEquipPosition(slot) + 200;
      goodsManager.unEquipGood(slotIndex);
    },
    [engine]
  );

  const handleEquipDrop = useCallback(
    (slot: EquipSlotType, data: DragData) => {
      const goodsManager = engine?.getGoodsListManager();
      if (!goodsManager) return;
      const slotIndex = slotTypeToEquipPosition(slot) + 200;

      if (data.type === "goods") {
        goodsManager.exchangeListItemAndEquiping(data.index, slotIndex);
      } else if (data.type === "equip" && data.sourceSlot) {
        const sourceIndex = slotTypeToEquipPosition(data.sourceSlot) + 200;
        goodsManager.exchangeListItem(sourceIndex, slotIndex);
      }

      setDragData(null);
    },
    [engine]
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
      const goodsManager = engine?.getGoodsListManager();
      if (!goodsManager) return;
      const actualIndex = index + 1;
      const entry = goodsManager.getItemInfo(actualIndex);

      if (!entry || !entry.good) return;

      // 如果商店打开，右键物品是卖给商店
      const gameManager = engine?.getGameManager();
      const buyManager = gameManager?.getBuyManager();
      if (buyManager?.isOpen()) {
        const sellPrice = entry.good.sellPrice;
        if (sellPrice > 0) {
          if (buyManager.getCanSellSelfGoods()) {
            // 卖出物品：获得金钱，物品从背包移除，加入商店
            const player = engine?.getPlayer();
            if (player) {
              player.money += sellPrice;
            }
            // 从背包删除物品
            goodsManager.deleteGood(entry.good.fileName);
            // 添加到商店库存
            buyManager.addGood(entry.good);
          } else {
            gameManager?.getGuiManager().showMessage("当前只能买物品");
          }
        }
        return;
      }

      // 商店未打开时，右键是使用/装备物品
      if (entry.good.kind === GoodKind.Equipment) {
        const equipIndex = entry.good.part + 200;
        goodsManager.exchangeListItemAndEquiping(actualIndex, equipIndex);
      } else if (entry.good.kind === GoodKind.Drug) {
        goodsManager.usingGood(actualIndex);
      }
    },
    [engine]
  );

  const handleGoodsDrop = useCallback(
    (targetIndex: number, data: DragData) => {
      const goodsManager = engine?.getGoodsListManager();
      if (!goodsManager) return;
      const actualTargetIndex = targetIndex + 1;

      if (data.type === "goods") {
        goodsManager.exchangeListItem(data.index, actualTargetIndex);
      } else if (data.type === "equip") {
        goodsManager.exchangeListItemAndEquiping(actualTargetIndex, data.index);
      } else if (data.type === "bottom") {
        // 从底栏拖回背包
        goodsManager.exchangeListItem(data.index, actualTargetIndex);
      }

      setDragData(null);
    },
    [engine]
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
      const goodsManager = engine?.getGoodsListManager();
      if (!goodsManager || !dragData) return;

      // 只有药品(Drug)可以放到快捷栏
      if (dragData.good.kind !== GoodKind.Drug) {
        engine?.getGameManager()?.getGuiManager().showMessage("只有药品可以放到快捷栏");
        setDragData(null);
        return;
      }

      // 底栏物品索引: 221 + slotIndex (0-2)
      const targetIndex = 221 + targetBottomSlot;

      if (dragData.type === "goods") {
        // 从背包拖到底栏
        goodsManager.exchangeListItem(dragData.index, targetIndex);
      } else if (dragData.type === "bottom") {
        // 底栏内交换
        goodsManager.exchangeListItem(dragData.index, targetIndex);
      }

      setDragData(null);
    },
    [engine, dragData]
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
      const goodsManager = engine?.getGoodsListManager();
      if (!goodsManager) return;

      const actualIndex = 221 + bottomSlot;
      const player = engine?.getPlayer();
      goodsManager.usingGood(actualIndex, player?.level ?? 1);
    },
    [engine]
  );

  // ============= Magic Handlers =============

  const handleMagicDragStart = useCallback((data: MagicDragData) => {
    setMagicDragData(data);
    setBottomMagicDragData(null);
  }, []);

  const handleBottomMagicDragStart = useCallback(
    (bottomSlot: number) => {
      const gameManager = engine?.getGameManager();
      if (!gameManager) return;
      const listIndex = gameManager.getMagicListManager().bottomIndexToListIndex(bottomSlot);
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
      const gameManager = engine?.getGameManager();
      if (!gameManager) return;

      if (source && source.storeIndex > 0) {
        gameManager.getMagicListManager().exchangeListItem(source.storeIndex, targetStoreIndex);
      } else if (bottomMagicDragData) {
        gameManager
          .getMagicListManager()
          .exchangeListItem(bottomMagicDragData.listIndex, targetStoreIndex);
      }

      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [engine, bottomMagicDragData]
  );

  const handleMagicDropOnBottom = useCallback(
    (targetBottomSlot: number) => {
      if (!engine) return;

      if (magicDragData) {
        engine.handleMagicDrop(magicDragData.storeIndex, targetBottomSlot);
      } else if (bottomMagicDragData) {
        const gameManager = engine.getGameManager();
        const targetListIndex = gameManager
          ?.getMagicListManager()
          .bottomIndexToListIndex(targetBottomSlot);
        if (targetListIndex !== undefined) {
          gameManager
            ?.getMagicListManager()
            .exchangeListItem(bottomMagicDragData.listIndex, targetListIndex);
        }
      }

      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [engine, magicDragData, bottomMagicDragData]
  );

  const handleMagicDropOnXiuLian = useCallback(
    (sourceIndex: number) => {
      const gameManager = engine?.getGameManager();
      if (!gameManager) return;

      const xiuLianIndex = 49;

      if (magicDragData && magicDragData.storeIndex > 0) {
        gameManager.getMagicListManager().exchangeListItem(magicDragData.storeIndex, xiuLianIndex);
      } else if (bottomMagicDragData) {
        gameManager
          .getMagicListManager()
          .exchangeListItem(bottomMagicDragData.listIndex, xiuLianIndex);
      } else if (sourceIndex > 0 && sourceIndex !== xiuLianIndex) {
        gameManager.getMagicListManager().exchangeListItem(sourceIndex, xiuLianIndex);
      }

      setMagicDragData(null);
      setBottomMagicDragData(null);
    },
    [engine, magicDragData, bottomMagicDragData]
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
    if (!panelState?.goods && !panelState?.equip && !panelState?.buy) {
      setTooltip((prev) => ({ ...prev, isVisible: false }));
    }
  }, [panelState?.goods, panelState?.equip, panelState?.buy]);

  // 当武功/修炼面板关闭时，隐藏MagicTooltip
  useEffect(() => {
    if (!panelState?.magic && !panelState?.xiulian) {
      setMagicTooltip((prev) => ({ ...prev, isVisible: false }));
    }
  }, [panelState?.magic, panelState?.xiulian]);

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
      const gameManager = engine?.getGameManager();
      if (!gameManager) return;

      const buyManager = gameManager.getBuyManager();
      const player = engine?.getPlayer();
      if (!buyManager || !player) return;

      // 尝试购买物品
      // index 是从 0 开始的显示索引，需要 +1 转为商店物品索引
      const success = await buyManager.buyGood(
        index + 1,
        player.money,
        async (fileName) => {
          // 尝试将物品添加到玩家背包
          const goodsManager = engine?.getGoodsListManager();
          if (!goodsManager) return false;
          const result = await goodsManager.addGoodToList(fileName);
          return result.success;
        },
        (amount) => {
          // 扣除金钱
          player.money -= amount;
        }
      );

      if (success) {
        logger.log(`[Shop] Purchased item at index ${index + 1}`);
      }
    },
    [engine]
  );

  // 关闭商店
  const handleShopClose = useCallback(() => {
    const gameManager = engine?.getGameManager();
    if (!gameManager) return;

    const buyManager = gameManager.getBuyManager();
    buyManager.endBuy();
    gameManager.getGuiManager().closeBuyGui();
  }, [engine]);

  // ============= Panel Toggles =============

  const togglePanel = useCallback(
    (panel: "state" | "equip" | "xiulian" | "goods" | "magic" | "memo" | "system" | "littleMap") => {
      engine?.togglePanel(panel);
    },
    [engine]
  );

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
            engine?.useMagicByBottomSlot(index - 3);
          }
        }}
        onItemRightClick={(index) => {
          if (index < 3) {
            // 物品槽右键
            const gameManager = engine?.getGameManager();
            const buyManager = gameManager?.getBuyManager();

            // 如果商店打开，卖物品
            if (buyManager?.isOpen()) {
              const goodsManager = engine?.getGoodsListManager();
              const bottomSlot = index;
              const actualIndex = 221 + bottomSlot;
              const entry = goodsManager?.getItemInfo(actualIndex);

              if (entry?.good && entry.good.sellPrice > 0) {
                if (buyManager.getCanSellSelfGoods()) {
                  const player = engine?.getPlayer();
                  if (player) {
                    player.money += entry.good.sellPrice;
                  }
                  goodsManager?.deleteGood(entry.good.fileName);
                  buyManager.addGood(entry.good);
                } else {
                  gameManager?.getGuiManager().showMessage("当前只能买物品");
                }
              }
            } else {
              // 商店未打开，使用物品
              handleUseBottomGood(index);
            }
          } else {
            // 武功槽右键 - 设置为当前武功
            engine
              ?.getGameManager()
              ?.getMagicListManager()
              .setCurrentMagicByBottomIndex(index - 3);
          }
        }}
        onMagicRightClick={(magicIndex) => {
          engine?.getGameManager()?.getMagicListManager().setCurrentMagicByBottomIndex(magicIndex);
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
      {dialogState?.isVisible && (
        <DialogUI
          state={dialogState}
          screenWidth={width}
          screenHeight={height}
          onClose={() => engine?.getGameManager()?.getGuiManager().handleDialogClick()}
          onSelectionMade={(selection) => {
            engine?.getGameManager()?.getGuiManager().onDialogSelectionMade(selection);
            engine?.onSelectionMade(selection);
          }}
        />
      )}

      {/* Selection - 使用事件驱动状态 */}
      {selectionState?.isVisible && (
        <SelectionUI
          state={selectionState}
          screenWidth={width}
          screenHeight={height}
          onSelect={(index) => engine?.getGameManager()?.getGuiManager().selectByIndex(index)}
        />
      )}

      {/* Multi-Selection - 多选UI */}
      {multiSelectionState?.isVisible && (
        <SelectionMultipleUI
          state={multiSelectionState}
          screenWidth={width}
          screenHeight={height}
          onToggleSelection={(index) => engine?.getGameManager()?.getGuiManager().toggleMultiSelection(index)}
        />
      )}

      {/* State Panel - 使用事件驱动状态 */}
      {panelState?.state && player && (
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
      {panelState?.equip && (
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
      {panelState?.xiulian && (
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
      {panelState?.goods && (
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
      {panelState?.magic && (
        <MagicGui
          isVisible={true}
          magicInfos={magicData.storeMagics}
          screenWidth={width}
          onMagicClick={(storeIndex) => logger.log("Magic clicked:", storeIndex)}
          onMagicRightClick={(storeIndex) => engine?.handleMagicRightClick(storeIndex)}
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
      {panelState?.memo && (
        <MemoGui
          isVisible={true}
          memos={engine?.memoListManager?.getAllMemos() ?? []}
          screenWidth={width}
          onClose={() => togglePanel("memo")}
        />
      )}

      {/* Buy/Shop Panel */}
      {panelState?.buy && (
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
      {panelState?.system && (
        <SystemGui
          isVisible={true}
          screenWidth={width}
          screenHeight={height}
          onSaveLoad={() => engine?.getGameManager()?.getGuiManager().showSaveLoad(true)}
          onOption={() =>
            engine?.getGameManager()?.getGuiManager().showMessage("请用游戏设置程序进行设置")
          }
          onExit={() => {
            engine?.getGameManager()?.getGuiManager().showSystem(false);
          }}
          onReturn={() => engine?.getGameManager()?.getGuiManager().showSystem(false)}
        />
      )}

      {/* SaveLoad Panel (存档/读档界面) */}
      {panelState?.saveLoad && (
        <SaveLoadGui
          isVisible={true}
          screenWidth={width}
          screenHeight={height}
          canSave={engine?.getGameManager()?.isSaveEnabled() ?? false}
          onSave={async (index) => {
            const result = await engine?.saveGameToSlot(index);
            return result ?? false;
          }}
          onLoad={async (index) => {
            try {
              await engine?.loadGameFromSlot(index);
              return true;
            } catch {
              return false;
            }
          }}
          onClose={() => engine?.getGameManager()?.getGuiManager().showSaveLoad(false)}
        />
      )}

      {/* LittleMap (小地图) - Tab键打开 */}
      {panelState?.littleMap && (
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
            const player = engine?.getPlayer();
            if (player && engine) {
              // 使用正确的等距坐标转换 - C#: MapBase.ToTilePosition
              const tile = toTilePosition(worldPos.x, worldPos.y);
              player.walkTo(tile);
              // 关闭小地图
              togglePanel("littleMap");
            }
          }}
        />
      )}

      {/* Message Notification - 使用事件驱动状态 */}
      <MessageGui
        isVisible={messageState.messageVisible}
        message={messageState.messageText}
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
