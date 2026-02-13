/**
 * ClassicGameUI - 经典风格游戏UI渲染组件
 *
 * 使用 ASF 精灵的复古像素风格 UI
 * 渲染逻辑从 GameUI 提取，与 useGameUILogic 配合使用
 */

import { logger } from "@miu2d/engine/core/logger";
import { GoodKind } from "@miu2d/engine/player/goods";
import type { UIEquipSlotName } from "@miu2d/engine/gui/contract";
import type React from "react";
import { useCallback } from "react";
import type { TouchDragData } from "@/contexts";
import type { GameUILogic } from "./hooks";
import type { EquipSlotType } from "./ui/classic";
import {
  BottomGui,
  BottomStateGui,
  BuyGui,
  DialogUI,
  EquipGui,
  GoodsGui,
  ItemTooltip,
  LittleHeadGui,
  LittleMapGui,
  MagicGui,
  MagicTooltip,
  MemoGui,
  MessageGui,
  NpcLifeBar,
  SelectionMultipleUI,
  SelectionUI,
  StateGui,
  slotTypeToEquipPosition,
  TimerGui,
  TopGui,
  XiuLianGui,
} from "./ui/classic";

interface ClassicGameUIProps {
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
 * ClassicGameUI Component
 */
export const ClassicGameUI: React.FC<ClassicGameUIProps> = ({ logic, width, height }) => {
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
    partnersData,
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

  // ============= Touch Drop Handlers =============
  // 这些处理器需要在组件内部定义以访问最新的 logic 状态

  const handleBottomTouchDrop = useCallback(
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
              ?.getMagicListManager()
              ?.bottomIndexToListIndex(touchData.bottomSlot - 3);
            const toListIndex = engine
              ?.getGameManager()
              ?.getMagicListManager()
              ?.bottomIndexToListIndex(targetBottomSlot);
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
          ?.getMagicListManager()
          ?.bottomIndexToListIndex(touchData.bottomSlot - 3);
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
            ?.getMagicListManager()
            ?.bottomIndexToListIndex(touchData.bottomSlot - 3);
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

      {/* Partner Heads (队友头像) */}
      {partnersData.length > 0 && (
        <LittleHeadGui
          partners={partnersData}
          onPartnerClick={(_index, partner) => {
            if (partner.canEquip) {
              // TODO: 打开 NPC 装备界面
              logger.debug(`[ClassicGameUI] Partner clicked: ${partner.name}`);
            }
          }}
        />
      )}

      {/* Timer GUI */}
      {timerState.isRunning && !timerState.isHidden && (
        <TimerGui timerState={timerState} screenWidth={width} />
      )}

      {/* NPC Life Bar */}
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
            handleUseBottomGood(index);
          } else {
            dispatch({ type: "USE_MAGIC_BY_BOTTOM", bottomSlot: index - 3 });
          }
        }}
        onItemRightClick={(index) => {
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
            if (dragData) {
              handleGoodsDropOnBottom(targetIndex);
            }
          } else if (targetIndex >= 3 && (magicDragData || bottomMagicDragData)) {
            handleMagicDropOnBottom(targetIndex - 3);
          }
        }}
        onTouchDrop={handleBottomTouchDrop}
        onDragEnd={() => {
          handleMagicDragEnd();
          setDragData(null);
        }}
        onMagicHover={handleMagicHover}
        onMagicLeave={handleMagicLeave}
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
      />

      {/* Dialog */}
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

      {/* Selection */}
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

      {/* Multi-Selection */}
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

      {/* State Panel */}
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
            manaLimit: player.manaLimit,
            attack: player.attack,
            attack2: player.attack2,
            attack3: player.attack3,
            defend: player.defend,
            defend2: player.defend2,
            defend3: player.defend3,
            evade: player.evade,
          }}
          playerIndex={uiPlayer?.playerIndex ?? 0}
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
          onTouchDrop={handleEquipTouchDrop}
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
          onTouchDrop={handleXiuLianTouchDrop}
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
          onTouchDrop={handleGoodsTouchDrop}
        />
      )}

      {/* Magic Panel */}
      {panels?.magic && (
        <MagicGui
          isVisible={true}
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
          onMagicHover={handleMagicHover}
          onMagicLeave={handleMagicLeave}
          onTouchDrop={handleMagicTouchDrop}
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
          items={buyData.items.map((item) => {
            if (!item) return null;
            const basePrice = item.price > 0 ? item.price : item.good.cost;
            const effectivePrice = Math.floor((basePrice * buyData.buyPercent) / 100);
            return { good: item.good, count: item.count, price: effectivePrice };
          })}
          screenWidth={width}
          buyPercent={buyData.buyPercent}
          numberValid={buyData.numberValid}
          onItemRightClick={handleShopItemRightClick}
          onItemMouseEnter={handleShopItemMouseEnter}
          onItemMouseLeave={handleMouseLeave}
          onClose={handleShopClose}
        />
      )}

      {/* System Menu - 已由 GameScreen 的 GameMenuPanel 替代 */}

      {/* LittleMap */}
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
            dispatch({ type: "MINIMAP_CLICK", worldX: worldPos.x, worldY: worldPos.y });
            togglePanel("littleMap");
          }}
        />
      )}

      {/* Message Notification */}
      <MessageGui
        isVisible={message?.isVisible ?? false}
        message={message?.text ?? ""}
        screenWidth={width}
        screenHeight={height}
      />

      {/* Item Tooltip */}
      <ItemTooltip isVisible={tooltip.isVisible} good={tooltip.good} shopPrice={tooltip.shopPrice} position={tooltip.position} />

      {/* Magic Tooltip */}
      <MagicTooltip
        isVisible={magicTooltip.isVisible}
        magicInfo={magicTooltip.magicInfo}
        position={magicTooltip.position}
      />

      {/* Video Player */}

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
    </>
  );
};
