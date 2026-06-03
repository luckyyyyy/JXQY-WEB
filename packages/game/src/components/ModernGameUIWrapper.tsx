/**
 * ModernGameUIWrapper - 现代风格游戏UI渲染组件
 *
 * 使用毛玻璃效果的现代风格 UI
 * 使用 useGameUILogic 获取状态和回调，渲染 modern UI 组件
 */

import { logger } from "@miu2d/engine/core/logger";
import type { UIGoodData } from "@miu2d/engine/gui/ui-types";
import type { Npc } from "@miu2d/engine/npc/npc";
import { EquipPosition, GoodKind } from "@miu2d/engine/player/goods/good";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GameUIContext } from "../contexts";
import { EngineWatermark } from "./common/EngineWatermark";
import type { BottomMagicDragData, GameUILogic, MagicDragData } from "./hooks";
import { useBuildGameUIContextValue, useTouchDropHandlers } from "./hooks";
import type { GoodItemData } from "./ui/classic";
import { FogOfWarMap } from "./ui/classic/FogOfWarMap";
// 视频播放器是全屏组件，与 UI 风格无关，复用 classic 版本
// 导入现代UI组件
import {
  BottomBar,
  BuyPanel,
  DialogBox,
  EquipPanel,
  GoodsPanel,
  ItemTooltip,
  // LittleMap,
  MagicPanel,
  MagicTooltip,
  MemoPanel,
  MessageBox,
  NpcLifeBar,
  PartnerPanel,
  type PartnerDisplayData,
  PartnerPortraits,
  SelectionMultipleUI,
  SelectionUI,
  StatePanel,
  TimerDisplay,
  TopBar,
  XiuLianPanel,
} from "./ui/modern";
import type { EquipSlotType, EquipSlots } from "./ui/classic/EquipGui";
import { slotTypeToEquipPosition } from "./ui/classic/EquipGui";

interface ModernGameUIWrapperProps {
  logic: GameUILogic;
  width: number;
  height: number;
}

// 将 EquipSlotType 转换为 UIEquipSlotName 已由 hooks/useGameUILogic.ts 提供

/**
 * ModernGameUIWrapper Component
 */
export const ModernGameUIWrapper: React.FC<ModernGameUIWrapperProps> = ({
  logic,
  width,
  height,
}) => {
  const {
    engine,
    dispatch,
    panels,
    dialog,
    selection,
    multiSelection,
    message,
    uiPlayer,
    player,
    goodsData,
    magicData,
    buyData,
    hoveredNpc,
    setHoveredNpc,
    partnersData,
    npcUpdateKey,
    dragData,
    setDragData,
    magicDragData,
    bottomMagicDragData,
    tooltip,
    magicTooltip,
    timerState,
    minimapState,
    togglePanel,
    handleEquipRightClick,
    handleEquipDrop,
    handleEquipDragStart,
    handleGoodsRightClick,
    handleGoodsDrop,
    handleGoodsDragStart,
    handleGoodsDropOnBottom,
    handleBottomGoodsDragStart,
    handleUseBottomGood,
    handleMagicDragStart,
    handleBottomMagicDragStart,
    handleMagicDragEnd,
    handleMagicDropOnStore,
    handleMagicDropOnBottom,
    handleMagicDropOnXiuLian,
    handleXiuLianDragStart,
    handleGoodsHover,
    handleMouseLeave,
    handleMagicHover,
    handleMagicLeave,
    handleShopItemMouseEnter,
    handleShopItemRightClick,
    handleShopClose,
    setTooltip,
    setMagicDragData,
    setBottomMagicDragData,
  } = logic;

  // 玩家状态 - 直接内联计算，与老面板保持一致
  // 不使用 useMemo，确保每次渲染都读取最新值
  const playerStats = {
    level: player?.level ?? 1,
    exp: player?.exp ?? 0,
    levelUpExp: player?.levelUpExp ?? 100,
    life: player?.life ?? 100,
    lifeMax: player?.lifeMax ?? 100,
    mana: player?.mana ?? 50,
    manaMax: player?.manaMax ?? 50,
    manaLimit: player?.manaLimit ?? false,
    thew: player?.thew ?? 100,
    thewMax: player?.thewMax ?? 100,
    attack: player?.attack ?? 10,
    attack2: player?.attack2 ?? 0,
    attack3: player?.attack3 ?? 0,
    defend: player?.defend ?? 5,
    defend2: player?.defend2 ?? 0,
    defend3: player?.defend3 ?? 0,
    evade: player?.evade ?? 5,
  };

  // 物品数据转换 (modern UI 使用的格式)
  const goodsItems = useMemo((): (GoodItemData | null)[] => {
    return goodsData.items.map((slot) =>
      slot?.good ? { good: slot.good, count: slot.count } : null
    );
  }, [goodsData]);

  // 底部物品转换
  const bottomGoodsItems = useMemo(() => {
    return goodsData.bottomGoods.map((slot) =>
      slot?.good ? { good: slot.good, count: slot.count } : null
    );
  }, [goodsData]);

  // ============= Touch Drop Handlers =============
  const {
    handleBottomTouchDrop: _handleBottomTouchDrop,
    handleEquipTouchDrop,
    handleGoodsTouchDrop,
    handleMagicTouchDrop,
    handleXiuLianTouchDrop,
  } = useTouchDropHandlers(logic);

  // ============= Partner Panel State =============

  const [selectedPartnerIndex, setSelectedPartnerIndex] = useState(0);
  const [partnerUpdateTrigger, setPartnerUpdateTrigger] = useState(0);

  // 读档/伙伴列表收缩时若 selectedPartnerIndex 越界，回退到 0，避免 partnerPanelData 为空
  useEffect(() => {
    if (partnersData.length > 0 && selectedPartnerIndex >= partnersData.length) {
      setSelectedPartnerIndex(0);
    }
  }, [partnersData.length, selectedPartnerIndex]);

  // 获取当前选中的伙伴 NPC 对象
  // 直接从 partnersData 取 npc 引用，避免 engine.npcManager.getAllPartner() 与
  // partnersData 之间的缓存错位（读档后 partner npc 实例会被替换，partnersData 已通过
  // 引用比较触发更新，这里随之拿到新实例）
  const selectedNpc = useMemo((): Npc | null => {
    return partnersData[selectedPartnerIndex]?.npc ?? null;
  }, [partnersData, selectedPartnerIndex]);

  // 伙伴面板显示数据：使用 RAF 在面板可见时持续刷新，避免 useMemo 缓存住"读档瞬间
  // npc 实例新但内部数据(goodsManager/magicInventory)未填充"的中间态。
  // panels.npcEquip 关闭后停止刷新，省 CPU。
  const computePartnerPanelData = useCallback(() => {
    if (!selectedNpc) return null;
    const gm = selectedNpc.goodsManager;
    const mi = selectedNpc.magicInventory;
    const equips: Record<string, { good: UIGoodData; count: number } | null> = {};
    if (gm) {
      const slotNamesArr: string[] = ["head", "neck", "body", "back", "hand", "wrist", "foot"];
      for (let i = 0; i < 7; i++) {
        const info = gm.getEquipAtSlotIndex(i);
        equips[slotNamesArr[i]] = info?.good ? { good: info.good, count: info.count } : null;
      }
    }
    const storeMagics = mi?.getStoreMagics() ?? [];
    const bottomMagicsArr = mi?.getBottomMagics() ?? [];
    return { equips, magicInfos: storeMagics, bottomMagics: bottomMagicsArr };
  }, [selectedNpc]);

  const [partnerPanelData, setPartnerPanelData] = useState(() => computePartnerPanelData());

  useEffect(() => {
    if (!panels?.npcEquip) {
      setPartnerPanelData(null);
      return;
    }
    let rafId: number;
    let prevSig = "";
    const tick = () => {
      const next = computePartnerPanelData();
      // 简单签名：装备 + 武功槽位的引用 hash；不一致就更新
      const sig = next
        ? `${Object.values(next.equips)
            .map((e) => `${e?.good?.fileName ?? "_"}:${e?.count ?? 0}`)
            .join("|")}#${next.magicInfos
            .map((m) => `${m?.magic?.fileName ?? "_"}:${m?.level ?? 0}`)
            .join("|")}#${next.bottomMagics
            .map((m) => m?.magic?.fileName ?? "_")
            .join("|")}`
        : "_null_";
      if (sig !== prevSig) {
        prevSig = sig;
        setPartnerPanelData(next);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [panels?.npcEquip, computePartnerPanelData]);

  // 伙伴装备列表 (PartnerDisplayData[])
  const partnerDisplayList = useMemo((): PartnerDisplayData[] => {
    return partnersData.map((p) => ({
      name: p.name,
      level: p.level,
      portraitPath: `asf/ui/littlehead/${p.name}.asf`,
      canEquip: p.canEquip,
    }));
  }, [partnersData]);

  // 伙伴装备拖拽处理
  const handlePartnerEquipDrop = useCallback(
    (slot: EquipSlotType, data: { type: string; index: number; good: UIGoodData }) => {
      if (!selectedNpc || !engine) return;
      if (data.type !== "goods") return;
      const playerGm = engine.player.getGoodsListManager();
      const equipPos = slotTypeToEquipPosition(slot) as EquipPosition;
      selectedNpc.equipFromPlayerBag(playerGm, data.index, equipPos);
      setPartnerUpdateTrigger((n) => n + 1);
    },
    [selectedNpc, engine]
  );

  const handlePartnerEquipRightClick = useCallback(
    (slot: EquipSlotType) => {
      if (!selectedNpc || !engine) return;
      const playerGm = engine.player.getGoodsListManager();
      const equipPos = slotTypeToEquipPosition(slot) as EquipPosition;
      selectedNpc.unequipToPlayerBag(playerGm, equipPos);
      setPartnerUpdateTrigger((n) => n + 1);
    },
    [selectedNpc, engine]
  );

  // 伙伴武功处理
  const handlePartnerMagicRightClick = useCallback(
    (storeIndex: number) => {
      if (!selectedNpc?.magicInventory) return;
      const mi = selectedNpc.magicInventory;
      for (let i = 0; i < 5; i++) {
        if (!mi.getBottomMagicInfo(i)) {
          mi.assignMagicToBottomSlot(storeIndex, i);
          break;
        }
      }
      setPartnerUpdateTrigger((n) => n + 1);
    },
    [selectedNpc]
  );

  const handlePartnerMagicDrop = useCallback(
    (targetStoreIndex: number, source: MagicDragData) => {
      if (!selectedNpc?.magicInventory) return;
      const mi = selectedNpc.magicInventory;
      if (source.storeIndex > 0) {
        mi.exchangeListItem(source.storeIndex, targetStoreIndex);
      }
      setPartnerUpdateTrigger((n) => n + 1);
    },
    [selectedNpc]
  );

  const handlePartnerBottomMagicDrop = useCallback(
    (targetBottomSlot: number, source: MagicDragData | BottomMagicDragData, targetStoreIndex?: number) => {
      if (!selectedNpc?.magicInventory) return;
      const mi = selectedNpc.magicInventory;
      if ("bottomSlot" in source) {
        // 来源是快捷栏
        if (targetStoreIndex !== undefined) {
          // 拖到面板指定位置：移到面板该位置（交换）
          mi.moveBottomToPanelSlot(source.bottomSlot, targetStoreIndex);
        } else {
          // 拖到另一个快捷栏：交换两个快捷栏
          mi.swapBottomSlots(source.bottomSlot, targetBottomSlot);
        }
      } else if ("storeIndex" in source) {
        // 来源是面板：放到快捷栏
        mi.assignMagicToBottomSlot(source.storeIndex, targetBottomSlot);
      }
      setPartnerUpdateTrigger((n) => n + 1);
    },
    [selectedNpc]
  );

  // 右键物品自动装备到伙伴
  const handlePartnerPlayerItemRightClick = useCallback(
    (bagIndex: number) => {
      if (!selectedNpc || !engine) return;
      const playerGm = engine.player.getGoodsListManager();
      const item = playerGm.getItemInfo(bagIndex);
      if (!item) return;
      if (item.good.kind === GoodKind.Equipment) {
        const equipPos = item.good.part as EquipPosition;
        if (equipPos > 0) {
          selectedNpc.equipFromPlayerBag(playerGm, bagIndex, equipPos);
          setPartnerUpdateTrigger((n) => n + 1);
        }
      }
    },
    [selectedNpc, engine]
  );

  // 伙伴装备拖拽开始
  const handlePartnerEquipDragStart = useCallback(
    (slot: EquipSlotType, good: UIGoodData) => {
      setDragData({ type: "equip", index: 0, good, sourceSlot: slot });
    },
    [setDragData]
  );

  // 伙伴武功拖拽
  const handlePartnerMagicDragStart = useCallback(
    (data: MagicDragData) => {
      setMagicDragData(data);
      setBottomMagicDragData(null);
    },
    [setMagicDragData, setBottomMagicDragData]
  );
  const handlePartnerMagicDragEnd = useCallback(() => {
    setMagicDragData(null);
  }, [setMagicDragData]);
  const handlePartnerBottomMagicDragStart = useCallback(
    (bottomSlot: number) => {
      if (!selectedNpc?.magicInventory) return;
      const info = selectedNpc.magicInventory.getBottomMagicInfo(bottomSlot);
      if (info) {
        setBottomMagicDragData({ bottomSlot, listIndex: 0 });
        setMagicDragData(null);
      }
    },
    [selectedNpc, setBottomMagicDragData, setMagicDragData]
  );

  // 主角背包物品 (用于伙伴装备)
  const playerGoodsItems = useMemo((): (GoodItemData | null)[] => {
    return goodsData.items;
  }, [goodsData]);

  // ======= GameUIContext value ======= (must be before early-return to satisfy Rules of Hooks)
  const gameUIContextValue = useBuildGameUIContextValue(logic, width, height);

  if (!engine) return null;

  return (
    <GameUIContext.Provider value={gameUIContextValue}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {/* 顶部按钮栏 */}
        <TopBar />

        {/* 计时器 */}
        {timerState.isRunning && !timerState.isHidden && <TimerDisplay timerState={timerState} />}

        {/* NPC 血条 */}
        <NpcLifeBar key={npcUpdateKey} npc={hoveredNpc} screenWidth={width} />

        {/* 伙伴头像 */}
        {partnersData.length > 0 && (
          <PartnerPortraits
            partners={partnersData}
            onPartnerClick={(index, partner) => {
              if (partner.canEquip) {
                setSelectedPartnerIndex(index);
                togglePanel("npcEquip");
              }
            }}
            onPartnerHover={(partner) => {
              if (!engine || !partner) {
                setHoveredNpc(null);
                engine.interactionManager.setHoverLock(null);
                return;
              }
              const all = engine.npcManager.getAllPartner();
              const npc = all.find((n) => n.name === partner.name) ?? null;
              setHoveredNpc(npc);
              engine.interactionManager.setHoverLock(npc);
            }}
          />
        )}

        {/* 伙伴管理面板 */}
        {panels?.npcEquip && partnerPanelData && (
          <PartnerPanel
            isVisible={true}
            partners={partnerDisplayList}
            selectedPartnerIndex={selectedPartnerIndex}
            onSelectPartner={(i) => setSelectedPartnerIndex(i)}
            equips={partnerPanelData.equips as EquipSlots}
            onEquipDrop={handlePartnerEquipDrop}
            onEquipRightClick={handlePartnerEquipRightClick}
            onEquipDragStart={handlePartnerEquipDragStart}
            onEquipMouseEnter={(slot, good, rect) =>
              good && setTooltip({ isVisible: true, good, isRecycle: false, position: { x: rect.right + 8, y: rect.top } })
            }
            onEquipMouseLeave={() => setTooltip((t) => ({ ...t, isVisible: false }))}
            magicInfos={partnerPanelData.magicInfos}
            bottomMagics={partnerPanelData.bottomMagics}
            onMagicRightClick={handlePartnerMagicRightClick}
            onMagicDragStart={handlePartnerMagicDragStart}
            onMagicDragEnd={handlePartnerMagicDragEnd}
            onMagicDrop={handlePartnerMagicDrop}
            onBottomMagicDrop={handlePartnerBottomMagicDrop}
            onBottomMagicDragStart={handlePartnerBottomMagicDragStart}
            onMagicHover={handleMagicHover}
            onMagicLeave={handleMagicLeave}
            playerItems={playerGoodsItems}
            playerMoney={goodsData.money}
            onPlayerItemRightClick={handlePartnerPlayerItemRightClick}
            onPlayerItemDragStart={handleGoodsDragStart}
            onPlayerItemHover={(good, x, y) =>
              good && setTooltip({ isVisible: true, good, isRecycle: false, position: { x, y } })
            }
            onPlayerItemLeave={() => setTooltip((t) => ({ ...t, isVisible: false }))}
            onClose={() => togglePanel("npcEquip")}
            dragData={dragData}
            magicDragData={magicDragData}
            bottomMagicDragData={bottomMagicDragData}
          />
        )}

        {/* 底部快捷栏 */}
        <BottomBar
          goodsItems={bottomGoodsItems}
          magicItems={magicData.bottomMagics}
          onItemClick={(index: number) => {
            if (index < 3) {
              handleUseBottomGood(index);
            } else {
              dispatch({ type: "USE_MAGIC_BY_BOTTOM", bottomSlot: index - 3 });
            }
          }}
          onItemRightClick={(index: number) => {
            if (index < 3) {
              if (panels?.buy) {
                dispatch({ type: "SELL_BOTTOM_GOODS", slotIndex: index });
              } else {
                handleUseBottomGood(index);
              }
            } else {
              dispatch({ type: "SET_CURRENT_MAGIC_BY_BOTTOM", bottomIndex: index - 3 });
            }
          }}
          onMagicRightClick={(magicIndex: number) => {
            dispatch({ type: "SET_CURRENT_MAGIC_BY_BOTTOM", bottomIndex: magicIndex });
          }}
          onDragStart={(data) => {
            if (data.type === "goods") {
              handleBottomGoodsDragStart(data.slotIndex);
            } else if (data.type === "magic") {
              handleBottomMagicDragStart(data.slotIndex - 3);
            }
          }}
          onDrop={(targetIndex: number) => {
            if (targetIndex < 3) {
              // 物品槽
              handleGoodsDropOnBottom(targetIndex);
            } else {
              // 武功槽
              handleMagicDropOnBottom(targetIndex - 3);
            }
            setDragData(null);
          }}
          onDragEnd={() => {
            handleMagicDragEnd();
            setDragData(null);
          }}
        />

        {/* 状态面板 */}
        <StatePanel
          isVisible={panels?.state ?? false}
          stats={playerStats}
          playerIndex={uiPlayer?.playerIndex}
          playerName={uiPlayer?.playerName}
          onClose={() => togglePanel("state")}
        />

        {/* 装备面板 */}
        <EquipPanel
          isVisible={panels?.equip ?? false}
          equips={{
            head: goodsData.equips.head ? { good: goodsData.equips.head.good, count: 1 } : null,
            neck: goodsData.equips.neck ? { good: goodsData.equips.neck.good, count: 1 } : null,
            body: goodsData.equips.body ? { good: goodsData.equips.body.good, count: 1 } : null,
            back: goodsData.equips.back ? { good: goodsData.equips.back.good, count: 1 } : null,
            hand: goodsData.equips.hand ? { good: goodsData.equips.hand.good, count: 1 } : null,
            wrist: goodsData.equips.wrist ? { good: goodsData.equips.wrist.good, count: 1 } : null,
            foot: goodsData.equips.foot ? { good: goodsData.equips.foot.good, count: 1 } : null,
          }}
          onSlotClick={handleEquipRightClick}
          onSlotRightClick={handleEquipRightClick}
          onSlotDrop={handleEquipDrop}
          onSlotDragStart={handleEquipDragStart}
          onClose={() => togglePanel("equip")}
          dragData={dragData}
          onTouchDrop={handleEquipTouchDrop}
        />

        {/* 物品面板 */}
        <GoodsPanel
          isVisible={panels?.goods ?? false}
          items={goodsItems}
          money={goodsData.money}
          onItemClick={(index) => logger.log("Item clicked:", index)}
          onItemRightClick={handleGoodsRightClick}
          onItemDragStart={handleGoodsDragStart}
          onItemDrop={handleGoodsDrop}
          onItemHover={handleGoodsHover}
          onItemMouseLeave={handleMouseLeave}
          onClose={() => togglePanel("goods")}
          dragData={dragData}
          onTouchDrop={handleGoodsTouchDrop}
        />

        {/* 武功面板 */}
        <MagicPanel
          isVisible={panels?.magic ?? false}
          magicInfos={magicData.storeMagics}
          onMagicClick={(storeIndex) => logger.log("Magic clicked:", storeIndex)}
          onMagicRightClick={(storeIndex) =>
            dispatch({ type: "SET_CURRENT_MAGIC", magicIndex: storeIndex })
          }
          onClose={() => togglePanel("magic")}
          onDragStart={handleMagicDragStart}
          onDragEnd={handleMagicDragEnd}
          onDrop={handleMagicDropOnStore}
          dragData={magicDragData}
          bottomDragData={bottomMagicDragData}
          onMagicHover={handleMagicHover}
          onMagicLeave={handleMagicLeave}
          onTouchDrop={handleMagicTouchDrop}
        />

        {/* 修炼面板 */}
        <XiuLianPanel
          isVisible={panels?.xiulian ?? false}
          magicInfo={magicData.xiuLianMagic}
          onClose={() => togglePanel("xiulian")}
          onDrop={handleMagicDropOnXiuLian}
          onDragStart={handleXiuLianDragStart}
          onDragEnd={handleMagicDragEnd}
          dragData={magicDragData}
          bottomDragData={bottomMagicDragData}
          onMagicHover={handleMagicHover}
          onMagicLeave={handleMagicLeave}
          onTouchDrop={handleXiuLianTouchDrop}
        />

        {/* 任务面板 */}
        <MemoPanel
          isVisible={panels?.memo ?? false}
          memos={engine?.memoListManager?.getAllMemos() ?? []}
          onClose={() => togglePanel("memo")}
        />

        {/* 系统面板 - 已由 GameScreen 的 GameMenuPanel 替代 */}

        {/* 对话框 */}
        {dialog?.isVisible && (
          <DialogBox
            state={{
              isVisible: dialog.isVisible,
              text: dialog.text,
              nameText: dialog.nameText,
              portraitIndex: dialog.portraitIndex ?? 0,
              portraitSide: dialog.portraitSide ?? "left",
              textProgress: dialog.textProgress ?? 1,
              isComplete: dialog.isComplete ?? true,
              isInSelecting: dialog.isInSelecting ?? false,
              selectA: dialog.selectA ?? "",
              selectB: dialog.selectB ?? "",
              selection: dialog.selection ?? -1,
            }}
            onClose={() => dispatch({ type: "DIALOG_CLICK" })}
            onSelectionMade={(sel: number) => {
              dispatch({ type: "DIALOG_SELECT", selection: sel });
            }}
          />
        )}

        {/* 选择框 */}
        {selection?.isVisible && (
          <SelectionUI
            state={{
              isVisible: selection.isVisible,
              message: selection.message ?? "",
              options: selection.options.map((o) => ({
                text: o.text,
                label: o.label ?? "",
                enabled: o.enabled ?? true,
              })),
              selectedIndex: selection.selectedIndex ?? -1,
              hoveredIndex: selection.hoveredIndex ?? -1,
            }}
            onSelect={(index) => dispatch({ type: "SELECTION_CHOOSE", index })}
          />
        )}

        {/* 多选框 */}
        {multiSelection?.isVisible && (
          <SelectionMultipleUI
            isVisible={multiSelection.isVisible}
            title={multiSelection.message ?? "请选择"}
            options={multiSelection.options.map((o) => o.text)}
            onConfirm={(indices) => {
              // 循环 toggle 选中的项
              indices.forEach((index) => {
                dispatch({ type: "MULTI_SELECTION_TOGGLE", index });
              });
            }}
            onCancel={() => {
              // 取消
            }}
          />
        )}

        {/* 消息提示 */}
        <MessageBox
          isVisible={message?.isVisible ?? false}
          message={message?.text ?? ""}
          showKey={message?.showKey ?? 0}
        />

        {/* 商店面板 */}
        {panels?.buy && buyData.items.length > 0 && (
          <BuyPanel
            isVisible={true}
            items={buyData.items.map((item) => {
              if (!item) return null;
              const basePrice = item.price > 0 ? item.price : item.good.cost;
              const effectivePrice = Math.floor((basePrice * buyData.buyPercent) / 100);
              return { good: item.good, count: item.count, price: effectivePrice };
            })}
            buyPercent={buyData.buyPercent}
            numberValid={buyData.numberValid}
            onItemClick={(index) => logger.log("Shop item clicked:", index)}
            onItemRightClick={handleShopItemRightClick}
            onItemMouseEnter={handleShopItemMouseEnter}
            onItemMouseLeave={handleMouseLeave}
            onClose={handleShopClose}
          />
        )}

        {/* FogOfWarMap - 战争迷雾风格地图（替换原 LittleMap） */}
        {panels?.littleMap && (
          <FogOfWarMap
            mapData={minimapState.mapData}
            mapName={minimapState.mapName}
            playerPosition={minimapState.playerPosition}
            characters={minimapState.characters}
          />
        )}
        {/* 原 LittleMap（已替换为 FogOfWarMap）
      {panels?.littleMap && (
        <LittleMap
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
            dispatch({ type: "MINIMAP_CLICK", worldX: worldPos.x, worldY: worldPos.y });
            togglePanel("littleMap");
          }}
        />
      )}
      */}

        {/* 物品提示 */}
        <ItemTooltip
          isVisible={tooltip.isVisible}
          good={tooltip.good}
          shopPrice={tooltip.shopPrice}
          position={tooltip.position}
        />

        {/* 武功提示 */}
        {magicTooltip.magicInfo?.magic && (
          <MagicTooltip
            isVisible={magicTooltip.isVisible}
            magic={{
              fileName: magicTooltip.magicInfo.magic.fileName ?? "",
              name: magicTooltip.magicInfo.magic.name,
              intro: magicTooltip.magicInfo.magic.intro ?? "",
              imagePath: magicTooltip.magicInfo.magic.image ?? magicTooltip.magicInfo.magic.icon ?? "",
              iconPath: magicTooltip.magicInfo.magic.icon ?? "",
              level: magicTooltip.magicInfo.level,
              maxLevel: magicTooltip.magicInfo.magic.maxLevel ?? 10,
              currentLevelExp: magicTooltip.magicInfo.exp,
              levelUpExp: magicTooltip.magicInfo.magic.levelupExp ?? 0,
              manaCost: magicTooltip.magicInfo.magic.manaCost ?? 0,
            }}
            position={magicTooltip.position}
          />
        )}

        {/* 视频播放器 */}

        {/* Engine Watermark */}
        <EngineWatermark />
      </div>
    </GameUIContext.Provider>
  );
};
