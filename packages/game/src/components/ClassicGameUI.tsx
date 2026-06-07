/**
 * ClassicGameUI - 经典风格游戏UI渲染组件
 *
 * 使用 ASF 精灵的复古像素风格 UI
 * 渲染逻辑从 GameUI 提取，与 useGameUILogic 配合使用
 */

import { logger } from "@miu2d/engine/core/logger";
import type React from "react";
import { useEffect } from "react";
import { GameUIContext } from "../contexts";
import { EngineWatermark } from "./common/EngineWatermark";
import type { GameUILogic } from "./hooks";
import { useBuildGameUIContextValue, useTouchDropHandlers } from "./hooks";
import {
  BottomGui,
  BottomStateGui,
  BuyGui,
  DialogUI,
  EquipGui,
  FogOfWarMap,
  GoodsGui,
  ItemTooltip,
  LittleHeadGui,
  // LittleMapGui,
  MagicGui,
  MagicTooltip,
  MemoGui,
  MessageGui,
  NpcLifeBar,
  SelectionMultipleUI,
  SelectionUI,
  StateGui,
  TimerGui,
  TopGui,
  XiuLianGui,
} from "./ui/classic";
import { useEquipGuiConfig, useStateGuiConfig } from "./ui/classic/useUISettings";
import { NewMinimap } from "./ui/modern/NewMinimap";
import { GamblePanel } from "./ui/GamblePanel";
import { SlotPanel } from "./ui/SlotPanel";
import { DoudizhuPanel } from "./ui/DoudizhuPanel";
import type { BetChoice, DiceResult } from "@miu2d/engine";

interface ClassicGameUIProps {
  logic: GameUILogic;
  width: number;
  height: number;
}

/**
 * ClassicGameUI Component
 */
export const ClassicGameUI: React.FC<ClassicGameUIProps> = ({ logic, width, height }) => {
  // 检测 State 和 Equip 是否共用同一背景图（整合模式，如 demo2）
  const stateGuiConfig = useStateGuiConfig();
  const equipGuiConfig = useEquipGuiConfig();
  // 同一背景图 AND 同一叠加图才算整合模式（避免 sword2 中两者共用 panel.msf 但 overlayImage 不同被误判）
  const isStateIntegratedWithEquip =
    !!stateGuiConfig &&
    !!equipGuiConfig &&
    stateGuiConfig.panel.image === equipGuiConfig.panel.image &&
    (stateGuiConfig.panel.overlayImage ?? "") === (equipGuiConfig.panel.overlayImage ?? "");

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
    setHoveredNpc,
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
    gamble,
    handleGambleClose,
    slot,
    handleSlotClose,
    doudizhu,
    handleDoudizhuClose,
  } = logic;

  // 告知引擎整合模式：F1 等同 F2，不单独响应 state 面板
  useEffect(() => {
    engine?.setStateEquipIntegrated(isStateIntegratedWithEquip);
  }, [engine, isStateIntegratedWithEquip]);

  // ============= Touch Drop Handlers =============
  const {
    handleBottomTouchDrop,
    handleEquipTouchDrop,
    handleGoodsTouchDrop,
    handleMagicTouchDrop,
    handleXiuLianTouchDrop,
  } = useTouchDropHandlers(logic);

  // ======= GameUIContext value ======= (must be before early-return to satisfy Rules of Hooks)
  const gameUIContextValue = useBuildGameUIContextValue(logic, width, height);

  if (!engine) return null;

  return (
    <GameUIContext.Provider value={gameUIContextValue}>
      {/* Top GUI */}
      <TopGui />

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

      {/* Timer GUI */}
      {timerState.isRunning && !timerState.isHidden && (
        <TimerGui timerState={timerState} screenWidth={width} />
      )}

      {/* NPC Life Bar */}
      <NpcLifeBar key={npcUpdateKey} npc={hoveredNpc} screenWidth={width} />

      {/* Bottom State GUI */}
      <BottomStateGui />

      {/* Bottom GUI */}
      <BottomGui
        goodsItems={goodsData.bottomGoods}
        magicItems={magicData.bottomMagics}
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
              dispatch({ type: "SELL_BOTTOM_GOODS", slotIndex: index });
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
      />

      {/* State Panel - 整合模式下由 EquipGui 通过 overlayStats 渲染文字，此处仅在非整合模式显示 */}
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
          overlayStats={
            isStateIntegratedWithEquip && player
              ? {
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
                }
              : undefined
          }
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

      {/* Good Panel */}
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

      {/* Mini-game Panel (gamble/slot/doudizhu 共用一个面板) */}
      {panels?.gamble && engine.gambleManager.isOpen() && (
        <GamblePanel
          isVisible={true}
          money={player?.money ?? 0}
          betAmount={gamble.betAmount}
          onPlaceBet={(choice: BetChoice, mult: number): DiceResult => {
            const gm = engine.gambleManager;
            const result = gm.rollDice(choice, mult);
            if (!gm.hasEnoughMoney()) { gm.endGamble(); engine.guiManager.closeGambleGui(); }
            return result ?? { dice: [1,1,1,1,1,1], sum: 6, win: false, betAmount: gamble.betAmount, netGain: -gamble.betAmount, randomBonus: 1, randomPenalty: 1, bonusText: null, penaltyText: null, specialEvent: null, comboBonus: null, comboBonusAmount: 0 };
          }}
          onClose={handleGambleClose}
        />
      )}
      {panels?.gamble && engine.slotManager.isOpen() && (
        <SlotPanel
          isVisible={true}
          money={player?.money ?? 0}
          betAmount={slot.betAmount}
          onSpin={(mult: number) => {
            const sm = engine.slotManager;
            const result = sm.spin(mult);
            if (!sm.hasEnoughMoney()) { sm.endSlot(); engine.guiManager.closeSlotGui(); }
            return result ?? { reels: [["coin","coin","coin"],["coin","coin","coin"],["coin","coin","coin"]], winLines: [], totalWin: 0, betAmount: slot.betAmount, freeSpinTriggered: false, jackpot: false, isFreeSpin: false };
          }}
          onClose={handleSlotClose}
        />
      )}
      {panels?.gamble && engine.doudizhuManager.isOpen() && (
        <DoudizhuPanel
          isVisible={true}
          money={player?.money ?? 0}
          betAmount={doudizhu.betAmount}
          state={engine.doudizhuManager.getFullState()}
          onBid={(bid) => engine.doudizhuManager.playerBid(bid)}
          onPlay={(cards) => engine.doudizhuManager.playerPlay(cards)}
          onPass={() => engine.doudizhuManager.playerPass()}
          onClose={handleDoudizhuClose}
          onRestart={() => engine.doudizhuManager.restartGame()}
          onStart={() => engine.doudizhuManager.beginGame()}
          onSuppressMusic={() => engine.audio.pauseMusic()}
          onRestoreMusic={() => engine.audio.resumeMusic()}
        />
      )}

      {/* System Menu - 已由 GameScreen 的 GameMenuPanel 替代 */}

      {/* NewMinimap - 新小地图（替换原 FogOfWarMap） */}
      {panels?.littleMap && (
        <NewMinimap
          mapData={minimapState.mapData}
          mapName={minimapState.mapName}
          mapDisplayName={minimapState.mapDisplayName}
          playerPosition={minimapState.playerPosition}
          characters={minimapState.characters}
          minimapCanvas={minimapState.minimapCanvas}
          minimapCanvasOffset={minimapState.minimapCanvasOffset}
          onClose={() => togglePanel("littleMap")}
          onMapClick={(worldX, worldY) => {
            dispatch({ type: "MINIMAP_CLICK", worldX, worldY });
            togglePanel("littleMap");
          }}
          onMapTeleport={(worldX, worldY) => {
            dispatch({ type: "MINIMAP_TELEPORT", worldX, worldY });
            togglePanel("littleMap");
          }}
        />
      )}
      {/* 原 LittleMapGui（已替换为 FogOfWarMap）
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
      */}

      {/* Dialog - 渲染在弹窗面板之上 */}
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

      {/* Selection - 渲染在弹窗面板之上 */}
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

      {/* Multi-Selection - 渲染在弹窗面板之上 */}
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

      {/* Message Notification */}
      <MessageGui
        isVisible={message?.isVisible ?? false}
        message={message?.text ?? ""}
        screenWidth={width}
        screenHeight={height}
      />

      {/* Item Tooltip */}
      <ItemTooltip
        isVisible={tooltip.isVisible}
        good={tooltip.good}
        shopPrice={tooltip.shopPrice}
        position={tooltip.position}
      />

      {/* Magic Tooltip */}
      <MagicTooltip
        isVisible={magicTooltip.isVisible}
        magicInfo={magicTooltip.magicInfo}
        position={magicTooltip.position}
      />

      {/* Video Player */}

      {/* Engine Watermark */}
      <EngineWatermark />
    </GameUIContext.Provider>
  );
};
