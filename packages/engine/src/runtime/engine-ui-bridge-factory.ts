/**
 * engine-ui-bridge-factory — 创建 UIBridge 的工厂函数
 * 从 GameEngine.createUIBridge() 提取，降低主文件复杂度
 */

import type { TypedEventEmitter } from "../core/event-emitter";
import { type GameEventMap, GameEvents } from "../core/game-events";
import type { MemoListManager } from "../gui/memo-list-manager";
import { type UIBridgeDeps, UIBridgeImpl } from "../gui/ui-bridge";
import type { GuiManagerState, UIBridge } from "../gui/ui-types";
import { pixelToTile } from "../utils";
import type { GameManager } from "./game-manager";
import type { TimerManager } from "./timer-manager";

/** 引擎层回调（engine-level callbacks needed by UIBridge） */
export interface UIBridgeEngineCallbacks {
  togglePanel: (panel: keyof GuiManagerState["panels"]) => void;
  onSelectionMade: (index: number) => void;
  handleMagicDrop: (sourceStoreIndex: number, targetBottomSlot: number) => void;
}

const EQUIP_SLOT_MAP: Record<string, number> = {
  head: 201,
  neck: 202,
  body: 203,
  back: 204,
  hand: 205,
  wrist: 206,
  foot: 207,
};

function slotNameToIndex(slot: string): number {
  return EQUIP_SLOT_MAP[slot] ?? 201;
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
        gm.goodsListManager.exchangeListItemAndEquiping(from, slotNameToIndex(slot)),
      unequipItem: (slot) => gm.goodsListManager.unEquipGood(slotNameToIndex(slot)),
      swapItems: (from, to) => gm.goodsListManager.exchangeListItem(from, to),
      useBottomItem: (slot) =>
        gm.goodsListManager.useBottomSlot(slot, gm.player, (fn) =>
          gm.npcManager.forEachPartner(fn)
        ),
      swapEquipSlots: (from, to) =>
        gm.goodsListManager.exchangeListItem(slotNameToIndex(from), slotNameToIndex(to)),
    },
    magic: {
      useMagic: async (i) => gm.handleMagicRightClick(i),
      useMagicByBottom: async (slot) => gm.useMagicByBottomSlot(slot),
      setCurrentMagic: (i) => gm.handleMagicRightClick(i),
      setCurrentMagicByBottom: (i) => gm.magicInventory.setCurrentMagicByBottomIndex(i),
      swapMagic: (from, to) => gm.magicInventory.exchangeListItem(from, to),
      assignMagicToBottom: (src, slot) => callbacks.handleMagicDrop(src, slot),
      setXiuLianMagic: (i) => gm.magicInventory.exchangeListItem(i, 49),
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
