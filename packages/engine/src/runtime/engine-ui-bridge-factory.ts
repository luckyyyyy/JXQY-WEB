/**
 * engine-ui-bridge-factory — 创建 UIBridge 的工厂函数
 * 从 GameEngine.createUIBridge() 提取，降低主文件复杂度
 */

import type { TypedEventEmitter } from "../events/event-emitter";
import { type GameEventMap, GameEvents } from "../events/game-events";
import type { MemoListManager } from "../gui/memo-list-manager";
import { type UIBridgeDeps, UIBridgeImpl } from "../gui/ui-bridge";
import type { GuiManagerState, UIBridge } from "../gui/ui-types";
import { EquipPosition } from "../player/goods/good";
import { MAGIC_LIST_CONFIG } from "../player/magic/magic-list-config";
import { pixelToTile } from "../utils";
import type { GameManager } from "./game-manager";
import type { TimerManager } from "./timer-manager";

/** 引擎层回调（engine-level callbacks needed by UIBridge） */
export interface UIBridgeEngineCallbacks {
  togglePanel: (panel: keyof GuiManagerState["panels"]) => void;
  onSelectionMade: (index: number) => void;
  handleMagicDrop: (sourceStoreIndex: number, targetBottomSlot: number) => void;
}

const EQUIP_SLOT_MAP: Record<string, EquipPosition> = {
  head: EquipPosition.Head,
  neck: EquipPosition.Neck,
  body: EquipPosition.Body,
  back: EquipPosition.Back,
  hand: EquipPosition.Hand,
  wrist: EquipPosition.Wrist,
  foot: EquipPosition.Foot,
};

function slotNameToPosition(slot: string): EquipPosition {
  return EQUIP_SLOT_MAP[slot] ?? EquipPosition.Head;
}

/**
 * 创建 UIBridge（连接引擎状态与 UI 操作）
 */
export function createEngineUIBridge(
  events: TypedEventEmitter<GameEventMap>,
  gm: GameManager,
  memo: MemoListManager,
  timer: TimerManager,
  callbacks: UIBridgeEngineCallbacks
): UIBridge {
  const deps: UIBridgeDeps = {
    events,
    state: {
      getPlayer: () => gm.player,
      getPlayerIndex: () => gm.player.playerIndex,
      getGoodsListManager: () => gm.goodsListManager,
      getPlayerMagicInventory: () => gm.magicInventory,
      getBuyManager: () => gm.buyManager,
      getMemoListManager: () => memo,
      getTimerManager: () => timer,
      getPanels: () => gm.guiManager.getState().panels,
      getDialogState: () => gm.guiManager.getState().dialog,
      getSelectionState: () => gm.guiManager.getState().selection,
      getMultiSelectionState: () => gm.guiManager.getState().multiSelection,
      canSaveGame: () => gm.isSaveEnabled(),
    },
    goods: {
      useItem: (index) => gm.handleUseItem(index),
      equipItem: (from, slot) =>
        gm.goodsListManager.exchangeListItemAndEquiping(from, slotNameToPosition(slot)),
      unequipItem: (slot) => gm.goodsListManager.unEquipGood(slotNameToPosition(slot)),
      swapItems: (from, to) => gm.goodsListManager.exchangeListItem(from, to),
      useBottomItem: (slot) =>
        gm.goodsListManager.useBottomSlot(slot, gm.player, (fn) =>
          gm.npcManager.forEachPartner(fn)
        ),
      sellBottomGoods: (slot) => {
        const info = gm.goodsListManager.getBottomItemAtSlot(slot);
        if (info?.good && info.good.sellPrice > 0 && gm.buyManager.getCanSellSelfGoods()) {
          gm.player.money += info.good.sellPrice;
          gm.goodsListManager.setBottomItemAtSlot(slot, null);
          gm.buyManager.addGood(info.good);
        }
      },
      moveBagToBottom: (bagIndex, bottomSlot) =>
        gm.goodsListManager.moveBagToBottom(bagIndex, bottomSlot),
      moveBottomToBag: (bottomSlot, bagIndex) =>
        gm.goodsListManager.moveBottomToBag(bottomSlot, bagIndex),
      swapBottomGoods: (fromSlot, toSlot) => gm.goodsListManager.swapBottomGoods(fromSlot, toSlot),
      swapEquipSlots: (from, to) =>
        gm.goodsListManager.swapEquipSlots(slotNameToPosition(from), slotNameToPosition(to)),
    },
    magic: {
      useMagic: async (i) => gm.handleMagicRightClick(i),
      useMagicByBottom: async (slot) => gm.useMagicByBottomSlot(slot),
      setCurrentMagic: (i) => gm.handleMagicRightClick(i),
      setCurrentMagicByBottom: (i) => gm.magicInventory.setCurrentMagicByBottomIndex(i),
      swapMagic: (from, to) => gm.magicInventory.exchangeListItem(from, to),
      assignMagicToBottom: (src, slot) => callbacks.handleMagicDrop(src, slot),
      swapBottomSlots: (fromSlot, toSlot) => gm.magicInventory.swapBottomSlots(fromSlot, toSlot),
      clearBottomSlot: (slot) => gm.magicInventory.assignMagicToBottomSlot(0, slot),
      moveBottomToPanel: (bottomSlot, panelIndex) =>
        gm.magicInventory.moveBottomToPanelAt(bottomSlot, panelIndex),
      setXiuLianMagic: (i) => {
        if (i === 0) {
          // 清除修炼武功
          gm.magicInventory.setXiuLianMagic(null);
        } else {
          gm.magicInventory.exchangeListItem(i, MAGIC_LIST_CONFIG.xiuLianIndex);
        }
      },
      setXiuLianFromBottom: (bottomSlot) => {
        gm.magicInventory.moveBottomSlotToXiuLian(bottomSlot);
      },
    },
    shop: {
      buyItem: (i) => gm.handleBuyItem(i),
      sellItem: (i) => gm.handleSellItem(i),
      closeShop: () => gm.handleCloseShop(),
    },
    save: {
      showSaveLoad: (v) => gm.guiManager.showSaveLoad(v),
    },
    dialog: {
      dialogClick: () => gm.guiManager.handleDialogClick(),
      dialogSelect: (sel) => {
        gm.guiManager.onDialogSelectionMade(sel);
        callbacks.onSelectionMade(sel);
      },
      selectionChoose: (i) => gm.guiManager.selectByIndex(i),
      multiSelectionToggle: (i) => gm.guiManager.toggleMultiSelection(i),
    },
    system: {
      togglePanel: (panel) => callbacks.togglePanel(panel as keyof GuiManagerState["panels"]),
      showMessage: (text) => gm.guiManager.showMessage(text),
      showSystem: (v) => gm.guiManager.showSystem(v),
      minimapClick: (wx, wy) => {
        gm.player.walkTo(pixelToTile(wx, wy));
        callbacks.togglePanel("littleMap");
      },
      onVideoEnd: () => events.emit(GameEvents.UI_VIDEO_END, {}),
    },
  };
  return new UIBridgeImpl(deps);
}
