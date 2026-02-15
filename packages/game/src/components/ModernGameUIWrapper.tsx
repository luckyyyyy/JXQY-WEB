/**
 * ModernGameUIWrapper - 现代风格游戏UI渲染组件
 *
 * 使用毛玻璃效果的现代风格 UI
 * 使用 useGameUILogic 获取状态和回调，渲染 modern UI 组件
 */

import { logger } from "@miu2d/engine/core/logger";
import type { UIEquipSlotName } from "@miu2d/engine/gui/ui-types";
import type { Good } from "@miu2d/engine/player/goods";
import { GoodKind } from "@miu2d/engine/player/goods";
import type React from "react";
import { useCallback, useMemo } from "react";
import type { TouchDragData } from "../contexts";
import type { GameUILogic } from "./hooks";
import type { EquipSlotType, GoodItemData } from "./ui/classic";
// 视频播放器是全屏组件，与 UI 风格无关，复用 classic 版本
import { slotTypeToEquipPosition } from "./ui/classic";
// 导入现代UI组件
import {
  BottomBar,
  BuyPanel,
  DialogBox,
  EquipPanel,
  GoodsPanel,
  ItemTooltip,
  LittleMap,
  MagicPanel,
  MagicTooltip,
  MemoPanel,
  MessageBox,
  NpcLifeBar,
  SelectionMultipleUI,
  SelectionUI,
  StatePanel,
  TimerDisplay,
  TopBar,
  XiuLianPanel,
} from "./ui/modern";

interface ModernGameUIWrapperProps {
  logic: GameUILogic;
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
    handleMouseEnter,
    handleMouseLeave,
    handleMagicHover,
    handleMagicLeave,
    handleShopItemMouseEnter,
    handleShopItemRightClick,
    handleShopClose,
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

  // 底部武功转换
  const bottomMagicItems = useMemo(() => {
    return magicData.bottomMagics.map((slot) => (slot?.magic ? { magic: slot.magic } : null));
  }, [magicData]);

  // ============= Touch Drop Handlers =============

  const _handleBottomTouchDrop = useCallback(
    (targetIndex: number, touchData: TouchDragData) => {
      if (touchData.type === "goods") {
        if (targetIndex < 3 && touchData.bagIndex !== undefined) {
          if (touchData.goodsInfo?.kind !== GoodKind.Drug) {
            dispatch({ type: "SHOW_MESSAGE", text: "只有药品可以放到快捷栏" });
            return;
          }
          const targetBagIndex = 221 + targetIndex;
          dispatch({ type: "SWAP_ITEMS", fromIndex: touchData.bagIndex, toIndex: targetBagIndex });
        } else if (targetIndex < 3 && touchData.bottomSlot !== undefined) {
          const fromIndex = 221 + touchData.bottomSlot;
          const toIndex = 221 + targetIndex;
          dispatch({ type: "SWAP_ITEMS", fromIndex, toIndex });
        }
      } else if (touchData.type === "magic") {
        if (targetIndex >= 3) {
          const targetBottomSlot = targetIndex - 3;
          if (touchData.storeIndex !== undefined) {
            dispatch({
              type: "ASSIGN_MAGIC_TO_BOTTOM",
              magicIndex: touchData.storeIndex,
              bottomSlot: targetBottomSlot,
            });
          } else if (touchData.bottomSlot !== undefined) {
            const fromListIndex = engine
              ?.getGameManager()
              ?.magicInventory?.bottomIndexToListIndex(touchData.bottomSlot - 3);
            const toListIndex = engine
              ?.getGameManager()
              ?.magicInventory?.bottomIndexToListIndex(targetBottomSlot);
            if (fromListIndex !== undefined && toListIndex !== undefined) {
              dispatch({ type: "SWAP_MAGIC", fromIndex: fromListIndex, toIndex: toListIndex });
            }
          }
        }
      }
    },
    [dispatch, engine]
  );

  const handleEquipTouchDrop = useCallback(
    (slot: EquipSlotType, touchData: TouchDragData) => {
      if (touchData.type === "goods" && touchData.bagIndex !== undefined) {
        dispatch({
          type: "EQUIP_ITEM",
          fromIndex: touchData.bagIndex,
          toSlot: equipSlotToUISlot(slot),
        });
      } else if (touchData.type === "equip" && touchData.equipSlot) {
        dispatch({
          type: "SWAP_EQUIP_SLOTS",
          fromSlot: equipSlotToUISlot(touchData.equipSlot as EquipSlotType),
          toSlot: equipSlotToUISlot(slot),
        });
      }
    },
    [dispatch]
  );

  const handleGoodsTouchDrop = useCallback(
    (targetIndex: number, touchData: TouchDragData) => {
      if (touchData.type === "goods" && touchData.bagIndex !== undefined) {
        dispatch({ type: "SWAP_ITEMS", fromIndex: touchData.bagIndex, toIndex: targetIndex });
      } else if (touchData.type === "goods" && touchData.bottomSlot !== undefined) {
        const fromIndex = 221 + touchData.bottomSlot;
        dispatch({ type: "SWAP_ITEMS", fromIndex, toIndex: targetIndex });
      } else if (touchData.type === "equip" && touchData.equipSlot) {
        const fromIndex = slotTypeToEquipPosition(touchData.equipSlot as EquipSlotType) + 200;
        dispatch({ type: "SWAP_ITEMS", fromIndex, toIndex: targetIndex });
      }
    },
    [dispatch]
  );

  const handleMagicTouchDrop = useCallback(
    (targetStoreIndex: number, touchData: TouchDragData) => {
      if (touchData.type === "magic" && touchData.storeIndex !== undefined) {
        dispatch({
          type: "SWAP_MAGIC",
          fromIndex: touchData.storeIndex,
          toIndex: targetStoreIndex,
        });
      } else if (touchData.type === "magic" && touchData.bottomSlot !== undefined) {
        const fromListIndex = engine
          ?.getGameManager()
          ?.magicInventory?.bottomIndexToListIndex(touchData.bottomSlot - 3);
        if (fromListIndex !== undefined) {
          dispatch({ type: "SWAP_MAGIC", fromIndex: fromListIndex, toIndex: targetStoreIndex });
        }
      }
    },
    [dispatch, engine]
  );

  const handleXiuLianTouchDrop = useCallback(
    (touchData: TouchDragData) => {
      const xiuLianIndex = 49;
      if (touchData.type === "magic") {
        if (
          touchData.storeIndex !== undefined &&
          touchData.storeIndex > 0 &&
          touchData.storeIndex !== xiuLianIndex
        ) {
          dispatch({ type: "SWAP_MAGIC", fromIndex: touchData.storeIndex, toIndex: xiuLianIndex });
        } else if (touchData.bottomSlot !== undefined) {
          const fromListIndex = engine
            ?.getGameManager()
            ?.magicInventory?.bottomIndexToListIndex(touchData.bottomSlot - 3);
          if (fromListIndex !== undefined) {
            dispatch({ type: "SWAP_MAGIC", fromIndex: fromListIndex, toIndex: xiuLianIndex });
          }
        }
      }
    },
    [dispatch, engine]
  );

  if (!engine) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* 顶部按钮栏 */}
      <TopBar
        screenWidth={width}
        onStateClick={() => togglePanel("state")}
        onEquipClick={() => togglePanel("equip")}
        onXiuLianClick={() => togglePanel("xiulian")}
        onGoodsClick={() => togglePanel("goods")}
        onMagicClick={() => togglePanel("magic")}
        onMemoClick={() => togglePanel("memo")}
        onSystemClick={() => togglePanel("system")}
      />

      {/* 计时器 */}
      {timerState.isRunning && !timerState.isHidden && (
        <TimerDisplay timerState={timerState} screenWidth={width} />
      )}

      {/* NPC 血条 */}
      <NpcLifeBar key={npcUpdateKey} npc={hoveredNpc} screenWidth={width} />

      {/* 底部快捷栏 */}
      <BottomBar
        screenWidth={width}
        screenHeight={height}
        goodsItems={bottomGoodsItems}
        magicItems={bottomMagicItems as unknown as Parameters<typeof BottomBar>[0]["magicItems"]}
        life={player?.life ?? 100}
        lifeMax={player?.lifeMax ?? 100}
        mana={player?.mana ?? 50}
        manaMax={player?.manaMax ?? 50}
        thew={player?.thew ?? 100}
        thewMax={player?.thewMax ?? 100}
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
              dispatch({ type: "SELL_ITEM", bagIndex: 221 + index });
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
        onGoodsHover={(goodData, x, y) => {
          if (goodData?.good) {
            logic.setTooltip({
              isVisible: true,
              good: goodData.good,
              isRecycle: false,
              position: { x, y },
            });
          }
        }}
        onGoodsLeave={handleMouseLeave}
        onMagicHover={(magicInfo, x, y) => {
          if (magicInfo?.magic) {
            // 从 bottomMagics 找到完整的 MagicItemInfo
            const fullMagicInfo = magicData.bottomMagics?.find(
              (slot) => slot?.magic?.name === magicInfo.magic?.name
            );
            if (fullMagicInfo) {
              handleMagicHover(fullMagicInfo, x, y);
            }
          }
        }}
        onMagicLeave={handleMagicLeave}
      />

      {/* 状态面板 */}
      <StatePanel
        isVisible={panels?.state ?? false}
        stats={playerStats}
        playerIndex={uiPlayer?.playerIndex}
        playerName={uiPlayer?.playerName}
        screenWidth={width}
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
        screenWidth={width}
        onSlotClick={handleEquipRightClick}
        onSlotRightClick={handleEquipRightClick}
        onSlotDrop={handleEquipDrop}
        onSlotDragStart={handleEquipDragStart}
        onSlotMouseEnter={handleMouseEnter}
        onSlotMouseLeave={handleMouseLeave}
        onClose={() => togglePanel("equip")}
        dragData={dragData}
        onTouchDrop={handleEquipTouchDrop}
      />

      {/* 物品面板 */}
      <GoodsPanel
        isVisible={panels?.goods ?? false}
        items={goodsItems}
        money={goodsData.money}
        screenWidth={width}
        onItemClick={(index) => logger.log("Item clicked:", index)}
        onItemRightClick={handleGoodsRightClick}
        onItemDragStart={handleGoodsDragStart}
        onItemDrop={handleGoodsDrop}
        onItemMouseEnter={handleMouseEnter}
        onItemMouseLeave={handleMouseLeave}
        onClose={() => togglePanel("goods")}
        dragData={dragData}
        onTouchDrop={handleGoodsTouchDrop}
      />

      {/* 武功面板 */}
      <MagicPanel
        isVisible={panels?.magic ?? false}
        magicInfos={magicData.storeMagics}
        screenWidth={width}
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
        screenWidth={width}
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
        screenWidth={width}
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
          screenWidth={width}
          screenHeight={height}
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
          screenWidth={width}
          screenHeight={height}
          onSelect={(index) => dispatch({ type: "SELECTION_CHOOSE", index })}
        />
      )}

      {/* 多选框 */}
      {multiSelection?.isVisible && (
        <SelectionMultipleUI
          isVisible={multiSelection.isVisible}
          title={multiSelection.message ?? "请选择"}
          options={multiSelection.options.map((o) => o.text)}
          screenWidth={width}
          screenHeight={height}
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
        screenWidth={width}
        screenHeight={height}
      />

      {/* 商店面板 */}
      {panels?.buy && buyData.items.length > 0 && (
        <BuyPanel
          isVisible={true}
          items={buyData.items.map((item) => {
            if (!item) return null;
            const basePrice = item.price > 0 ? item.price : item.good.cost;
            const effectivePrice = Math.floor((basePrice * buyData.buyPercent) / 100);
            return { good: item.good as Good, count: item.count, price: effectivePrice };
          })}
          screenWidth={width}
          buyPercent={buyData.buyPercent}
          numberValid={buyData.numberValid}
          onItemClick={(index) => logger.log("Shop item clicked:", index)}
          onItemRightClick={handleShopItemRightClick}
          onItemMouseEnter={handleShopItemMouseEnter}
          onItemMouseLeave={handleMouseLeave}
          onClose={handleShopClose}
        />
      )}

      {/* 小地图 */}
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

      {/* 物品提示 */}
      <ItemTooltip
        isVisible={tooltip.isVisible}
        good={tooltip.good}
        shopPrice={tooltip.shopPrice}
        position={tooltip.position}
        screenWidth={width}
        screenHeight={height}
      />

      {/* 武功提示 */}
      {magicTooltip.magicInfo?.magic && (
        <MagicTooltip
          isVisible={magicTooltip.isVisible}
          magic={{
            fileName: magicTooltip.magicInfo.magic.fileName ?? "",
            name: magicTooltip.magicInfo.magic.name,
            intro: magicTooltip.magicInfo.magic.intro ?? "",
            iconPath: magicTooltip.magicInfo.magic.icon ?? "",
            level: magicTooltip.magicInfo.level,
            maxLevel: magicTooltip.magicInfo.magic.maxLevel ?? 10,
            currentLevelExp: magicTooltip.magicInfo.exp,
            levelUpExp: magicTooltip.magicInfo.magic.levelupExp ?? 0,
            manaCost: magicTooltip.magicInfo.magic.manaCost ?? 0,
          }}
          position={magicTooltip.position}
          screenWidth={width}
          screenHeight={height}
        />
      )}

      {/* 视频播放器 */}

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
        Powered by Miu2D Engine
      </div>
    </div>
  );
};
