/**
 * Modern UI - 主组件
 * 整合所有现代UI子组件
 */

import type { Good } from "@miu2d/engine/player/goods";
import type {
  UIDialogState,
  UIGoodData,
  UIGoodsState,
  UIMagicData,
  UIMagicState,
  UIMemoState,
  UIMessageState,
  UIMultiSelectionState,
  UIPlayerState,
  UISelectionState,
  UIShopState,
  UITimerState,
} from "@miu2d/engine/gui/contract";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import type { DragData, EquipSlotType, GoodItemData } from "../classic";
import type { PlayerStats } from "../classic/StateGui";
import { BottomBar } from "./BottomBar";
import { BuyPanel } from "./BuyPanel";
import { DialogBox } from "./DialogBox";
import { EquipPanel } from "./EquipPanel";
import { GoodsPanel } from "./GoodsPanel";
import { MagicPanel } from "./MagicPanel";
import { MemoPanel } from "./MemoPanel";
import { MessageBox } from "./MessageBox";
import { SelectionMultipleUI } from "./SelectionMultipleUI";
import { SelectionUI } from "./SelectionUI";
import { StatePanel } from "./StatePanel";
import { SystemPanel } from "./SystemPanel";
import { TimerDisplay } from "./TimerDisplay";
import { ItemTooltip, MagicTooltip } from "./Tooltips";
// 导入现代UI组件
import { TopBar } from "./TopBar";
import { XiuLianPanel } from "./XiuLianPanel";

// UI面板类型
type PanelType = "state" | "equip" | "goods" | "magic" | "xiulian" | "memo" | "system" | null;

interface ModernGameUIProps {
  screenWidth: number;
  screenHeight: number;
  // 状态数据
  playerState?: UIPlayerState | null;
  goodsState?: UIGoodsState | null;
  magicState?: UIMagicState | null;
  dialogState?: UIDialogState | null;
  selectionState?: UISelectionState | null;
  multiSelectionState?: UIMultiSelectionState | null;
  shopState?: UIShopState | null;
  memoState?: UIMemoState | null;
  messageState?: UIMessageState | null;
  timerState?: UITimerState | null;
  // 回调
  onDispatch?: (action: string, data?: unknown) => void;
  onOptions?: () => void;
  onExit?: () => void;
}

export const ModernGameUI: React.FC<ModernGameUIProps> = ({
  screenWidth,
  screenHeight,
  playerState,
  goodsState,
  magicState,
  dialogState,
  selectionState,
  multiSelectionState,
  shopState,
  memoState,
  messageState,
  timerState,
  onDispatch,
  onOptions,
  onExit,
}) => {
  // 面板状态
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  // 拖拽状态
  const [dragData, setDragData] = useState<DragData | null>(null);

  // Tooltip状态
  const [tooltipItem, setTooltipItem] = useState<{
    type: "item" | "magic";
    data: UIGoodData | UIMagicData;
    position: { x: number; y: number };
  } | null>(null);

  // 转换玩家状态为 PlayerStats
  const playerStats: PlayerStats = useMemo(
    () => ({
      level: playerState?.level ?? 1,
      exp: playerState?.exp ?? 0,
      levelUpExp: playerState?.levelUpExp ?? 100,
      life: playerState?.life ?? 100,
      lifeMax: playerState?.lifeMax ?? 100,
      mana: playerState?.mana ?? 50,
      manaMax: playerState?.manaMax ?? 50,
      manaLimit: playerState?.manaLimit ?? false,
      thew: playerState?.thew ?? 100,
      thewMax: playerState?.thewMax ?? 100,
      attack: playerState?.attack ?? 10,
      defend: playerState?.defend ?? 5,
      evade: playerState?.evade ?? 5,
    }),
    [playerState]
  );

  // 物品数据转换
  const goodsItems = useMemo((): (GoodItemData | null)[] => {
    if (!goodsState) return [];
    return goodsState.items.map((slot) =>
      slot?.good ? { good: slot.good as unknown as GoodItemData["good"], count: slot.count } : null
    );
  }, [goodsState]);

  // 面板切换
  const handlePanelToggle = useCallback((panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  // 物品操作
  const handleItemClick = useCallback(
    (index: number) => {
      onDispatch?.("goods.use", { index });
    },
    [onDispatch]
  );

  const handleItemRightClick = useCallback(
    (index: number) => {
      onDispatch?.("goods.drop", { index });
    },
    [onDispatch]
  );

  const handleItemDragStart = useCallback((index: number, good: GoodItemData["good"]) => {
    setDragData({ type: "goods", index, good });
  }, []);

  const handleItemDrop = useCallback(
    (targetIndex: number, data: DragData) => {
      if (data.type === "goods") {
        onDispatch?.("goods.swap", {
          fromIndex: data.index,
          toIndex: targetIndex,
        });
      }
      setDragData(null);
    },
    [onDispatch]
  );

  // 武功操作
  const _handleMagicClick = useCallback(
    (magic: UIMagicData) => {
      onDispatch?.("magic.use", { name: magic.name });
    },
    [onDispatch]
  );

  // 装备操作
  const handleEquipClick = useCallback(
    (slot: EquipSlotType) => {
      onDispatch?.("equip.unequip", { slot });
    },
    [onDispatch]
  );

  const handleEquipDrop = useCallback(
    (slot: EquipSlotType, data: DragData) => {
      if (data.type === "goods") {
        onDispatch?.("equip.equip", { slot, itemIndex: data.index });
      }
      setDragData(null);
    },
    [onDispatch]
  );

  // Tooltip处理 - 使用鼠标位置
  const handleItemHover = useCallback((good: GoodItemData["good"] | null, x: number, y: number) => {
    if (good) {
      setTooltipItem({
        type: "item",
        data: good as unknown as UIGoodData,
        position: { x: x + 16, y },
      });
    } else {
      setTooltipItem(null);
    }
  }, []);

  const _handleMagicMouseEnter = useCallback((magic: UIMagicData, rect: DOMRect) => {
    setTooltipItem({
      type: "magic",
      data: magic,
      position: { x: rect.right, y: rect.top },
    });
  }, []);

  const handleTooltipHide = useCallback(() => {
    setTooltipItem(null);
  }, []);

  // 选择框操作
  const handleSelectionSelect = useCallback(
    (index: number) => {
      onDispatch?.("selection.select", { index });
    },
    [onDispatch]
  );

  const handleSelectionMultipleConfirm = useCallback(
    (indices: number[]) => {
      onDispatch?.("multiSelection.confirm", { indices });
    },
    [onDispatch]
  );

  const handleSelectionMultipleCancel = useCallback(() => {
    onDispatch?.("multiSelection.cancel", {});
  }, [onDispatch]);

  // 对话框点击
  const handleDialogClick = useCallback(() => {
    onDispatch?.("dialog.next", {});
  }, [onDispatch]);

  // 购买操作
  const handleBuy = useCallback(
    (index: number, count: number) => {
      onDispatch?.("shop.buy", { index, count });
    },
    [onDispatch]
  );

  const handleBuyClose = useCallback(() => {
    onDispatch?.("shop.close", {});
  }, [onDispatch]);

  // 底部栏物品和武功数据转换
  const bottomGoodsItems = useMemo(() => {
    if (!goodsState?.bottomGoods) return [];
    return goodsState.bottomGoods.map((slot) =>
      slot?.good ? { good: slot.good as unknown as GoodItemData["good"], count: slot.count } : null
    );
  }, [goodsState]);

  const bottomMagicItems = useMemo(() => {
    if (!magicState?.bottomMagics) return [];
    return magicState.bottomMagics.map((slot) =>
      slot?.magic
        ? {
            magic: {
              name: slot.magic.name,
              icon: slot.magic.iconPath,
              image: slot.magic.iconPath,
              iconPath: slot.magic.iconPath,
            },
            level: slot.magic.level ?? 0,
          }
        : null
    );
  }, [magicState]);

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
        screenWidth={screenWidth}
        onStateClick={() => handlePanelToggle("state")}
        onEquipClick={() => handlePanelToggle("equip")}
        onXiuLianClick={() => handlePanelToggle("xiulian")}
        onGoodsClick={() => handlePanelToggle("goods")}
        onMagicClick={() => handlePanelToggle("magic")}
        onMemoClick={() => handlePanelToggle("memo")}
        onSystemClick={() => handlePanelToggle("system")}
      />

      {/* 底部快捷栏 */}
      <BottomBar
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        goodsItems={bottomGoodsItems}
        magicItems={bottomMagicItems}
        life={playerStats.life}
        lifeMax={playerStats.lifeMax}
        mana={playerStats.mana}
        manaMax={playerStats.manaMax}
        thew={playerStats.thew}
        thewMax={playerStats.thewMax}
        onItemClick={(index: number) => onDispatch?.("bottomGoods.use", { index })}
        onItemRightClick={(index: number) => onDispatch?.("bottomGoods.remove", { index })}
        onMagicRightClick={(magicIndex: number) =>
          onDispatch?.("bottomMagic.remove", { index: magicIndex })
        }
        onDrop={() => setDragData(null)}
        onGoodsHover={(goodData, x, y) => {
          console.log("[ModernGameUI] onGoodsHover", { goodData, x, y });
          if (goodData?.good) {
            setTooltipItem({
              type: "item",
              data: goodData.good as unknown as UIGoodData,
              position: { x, y },
            });
          }
        }}
        onGoodsLeave={handleTooltipHide}
        onMagicHover={(magicInfo, x, y) => {
          console.log("[ModernGameUI] onMagicHover", {
            magicInfo,
            x,
            y,
            bottomMagics: magicState?.bottomMagics,
          });
          // 从 magicInfo.magic.name 找到对应的原始 UIMagicData
          if (magicInfo?.magic?.name) {
            const originalMagic = magicState?.bottomMagics?.find(
              (slot) => slot?.magic?.name === magicInfo.magic?.name
            )?.magic;
            console.log("[ModernGameUI] found originalMagic", originalMagic);
            if (originalMagic) {
              setTooltipItem({
                type: "magic",
                data: originalMagic as unknown as UIMagicData,
                position: { x, y },
              });
            }
          }
        }}
        onMagicLeave={handleTooltipHide}
      />

      {/* 状态面板 */}
      <StatePanel
        isVisible={activePanel === "state"}
        stats={playerStats}
        playerIndex={playerState?.playerIndex}
        playerName={playerState?.playerName}
        screenWidth={screenWidth}
        onClose={closePanel}
      />

      {/* 装备面板 */}
      <EquipPanel
        isVisible={activePanel === "equip"}
        equips={{
          head: goodsState?.equips?.head
            ? { good: goodsState.equips.head.good as unknown as Good, count: 1 }
            : null,
          neck: goodsState?.equips?.neck
            ? { good: goodsState.equips.neck.good as unknown as Good, count: 1 }
            : null,
          body: goodsState?.equips?.body
            ? { good: goodsState.equips.body.good as unknown as Good, count: 1 }
            : null,
          back: goodsState?.equips?.back
            ? { good: goodsState.equips.back.good as unknown as Good, count: 1 }
            : null,
          hand: goodsState?.equips?.hand
            ? { good: goodsState.equips.hand.good as unknown as Good, count: 1 }
            : null,
          wrist: goodsState?.equips?.wrist
            ? { good: goodsState.equips.wrist.good as unknown as Good, count: 1 }
            : null,
          foot: goodsState?.equips?.foot
            ? { good: goodsState.equips.foot.good as unknown as Good, count: 1 }
            : null,
        }}
        screenWidth={screenWidth}
        onSlotClick={handleEquipClick}
        onSlotDrop={handleEquipDrop}
        onClose={closePanel}
        dragData={dragData}
      />

      {/* 物品面板 */}
      <GoodsPanel
        isVisible={activePanel === "goods"}
        items={goodsItems}
        money={goodsState?.money ?? 0}
        screenWidth={screenWidth}
        onItemClick={handleItemClick}
        onItemRightClick={handleItemRightClick}
        onItemDragStart={handleItemDragStart}
        onItemDrop={handleItemDrop}
        onItemHover={handleItemHover}
        onItemMouseLeave={handleTooltipHide}
        onClose={closePanel}
        dragData={dragData}
      />

      {/* 武功面板 */}
      <MagicPanel
        isVisible={activePanel === "magic"}
        magicInfos={
          magicState?.storeMagics?.map((slot) =>
            slot?.magic
              ? {
                  magic: slot.magic as unknown as import("@miu2d/engine/magic").MagicData,
                  level: slot.magic.level ?? 0,
                  exp: slot.magic.currentLevelExp ?? 0,
                  remainColdMilliseconds: 0,
                  hideCount: 0,
                  lastIndexWhenHide: 0,
                }
              : null
          ) ?? []
        }
        screenWidth={screenWidth}
        onMagicClick={(storeIndex: number) => onDispatch?.("magic.use", { storeIndex })}
        onMagicRightClick={(storeIndex: number) => onDispatch?.("magic.setXiuLian", { storeIndex })}
        onClose={closePanel}
      />

      {/* 修炼面板 */}
      <XiuLianPanel
        isVisible={activePanel === "xiulian"}
        magicInfo={
          magicState?.xiuLianMagic?.magic
            ? {
                magic: magicState.xiuLianMagic
                  .magic as unknown as import("@miu2d/engine/magic").MagicData,
                level: magicState.xiuLianMagic.magic.level ?? 0,
                exp: magicState.xiuLianMagic.magic.currentLevelExp ?? 0,
                remainColdMilliseconds: 0,
                hideCount: 0,
                lastIndexWhenHide: 0,
              }
            : null
        }
        screenWidth={screenWidth}
        onClose={closePanel}
      />

      {/* 任务面板 */}
      <MemoPanel
        isVisible={activePanel === "memo"}
        memos={memoState?.memos?.map((e) => e.text) ?? []}
        screenWidth={screenWidth}
        onClose={closePanel}
      />

      {/* 系统面板 */}
      <SystemPanel
        isVisible={activePanel === "system"}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        onSaveLoad={() => {
          onDispatch?.("system.saveLoad");
        }}
        onOption={onOptions ?? (() => {})}
        onExit={onExit ?? (() => {})}
        onReturn={closePanel}
      />

      {/* 对话框 */}
      <DialogBox
        state={{
          isVisible: dialogState?.isVisible ?? false,
          text: dialogState?.text ?? "",
          nameText: dialogState?.nameText ?? "",
          portraitIndex: 0,
          portraitSide: "left",
          textProgress: 1,
          isComplete: true,
          isInSelecting: false,
          selectA: "",
          selectB: "",
          selection: -1,
        }}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        onClose={handleDialogClick}
      />

      {/* 选择框 */}
      <SelectionUI
        state={{
          isVisible: selectionState?.isVisible ?? false,
          message: selectionState?.message ?? "",
          options:
            selectionState?.options?.map((o) => ({
              text: o.text,
              label: o.label ?? "",
              enabled: o.enabled ?? true,
            })) ?? [],
          selectedIndex: selectionState?.selectedIndex ?? -1,
          hoveredIndex: selectionState?.hoveredIndex ?? -1,
        }}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        onSelect={handleSelectionSelect}
      />

      {/* 多选框 */}
      <SelectionMultipleUI
        isVisible={multiSelectionState?.isVisible ?? false}
        title={multiSelectionState?.message ?? "请选择"}
        options={multiSelectionState?.options?.map((o) => o.text) ?? []}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        onConfirm={handleSelectionMultipleConfirm}
        onCancel={handleSelectionMultipleCancel}
      />

      {/* 消息提示 */}
      <MessageBox
        isVisible={messageState?.isVisible ?? false}
        message={messageState?.text ?? ""}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
      />

      {/* 商店 */}
      <BuyPanel
        isVisible={shopState?.isOpen ?? false}
        items={
          shopState?.items?.map((item) =>
            item ? { good: item.good as unknown as Good, count: item.count, price: item.price } : null
          ) ?? []
        }
        screenWidth={screenWidth}
        buyPercent={shopState?.buyPercent ?? 100}
        numberValid={shopState?.numberValid ?? false}
        onItemClick={(index: number) => onDispatch?.("shop.select", { index })}
        onItemRightClick={(index: number) => handleBuy(index, 1)}
        onClose={handleBuyClose}
      />

      {/* 小地图 - 暂时隐藏，需要完整的地图数据 */}
      {/* <LittleMap
        isVisible={true}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        mapData={null}
        mapName=""
        playerPosition={{ x: 0, y: 0 }}
        characters={[]}
        cameraPosition={{ x: 0, y: 0 }}
        onClose={() => {}}
      /> */}

      {/* 计时器 */}
      <TimerDisplay
        timerState={{
          isRunning: timerState?.isRunning ?? false,
          seconds: timerState?.seconds ?? 0,
          isHidden: false,
          elapsedMilliseconds: 0,
          timeScripts: [],
        }}
        screenWidth={screenWidth}
      />

      {/* 物品提示 */}
      {tooltipItem?.type === "item" && (
        <ItemTooltip
          isVisible={true}
          good={tooltipItem.data as unknown as GoodItemData["good"]}
          position={tooltipItem.position}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      )}

      {/* 武功提示 */}
      {tooltipItem?.type === "magic" && (
        <MagicTooltip
          isVisible={true}
          magic={tooltipItem.data as unknown as UIMagicData}
          position={tooltipItem.position}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
        />
      )}
    </div>
  );
};
