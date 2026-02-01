/**
 * GUI 管理器 - 事件驱动架构，通过 EventEmitter 发送状态变化事件
 */

import { getEngineContext } from "../core/engineContext";
import type { EventEmitter } from "../core/eventEmitter";
import {
  GameEvents,
  type UIDialogChangeEvent,
  type UIDialogClosedEvent,
  type UIMemoChangeEvent,
  type UIMenuCloseEvent,
  type UIMenuOpenEvent,
  type UIMessageChangeEvent,
  type UIMultiSelectionChangeEvent,
  type UIPanelChangeEvent,
  type UISelectionChangeEvent,
  type UIVideoPlayEvent,
} from "../core/gameEvents";
import { logger } from "../core/logger";
import type { MemoListManager } from "../listManager";
import type { GuiManagerState, SelectionOptionData } from "./types";
import { createDefaultGuiState } from "./types";

export class GuiManager {
  private state: GuiManagerState;
  private typewriterSpeed: number = 50; // ms per character
  private isMoviePlaying: boolean = false; // Track movie playback state
  private pendingMovieFile: string | null = null; // Pending movie file for late subscribers

  constructor(
    private events: EventEmitter,
    private memoListManager: MemoListManager
  ) {
    this.state = createDefaultGuiState();

    // Listen for video end event
    this.events.on(GameEvents.UI_VIDEO_END, () => {
      logger.log("[GuiManager] Video playback ended");
      this.isMoviePlaying = false;
      this.pendingMovieFile = null;
    });
  }

  getState(): GuiManagerState {
    return this.state;
  }

  private emitDialogChange(): void {
    this.events.emit(GameEvents.UI_DIALOG_CHANGE, {
      dialog: { ...this.state.dialog },
    } as UIDialogChangeEvent);
  }

  private emitSelectionChange(): void {
    this.events.emit(GameEvents.UI_SELECTION_CHANGE, {
      selection: { ...this.state.selection, options: [...this.state.selection.options] },
    } as UISelectionChangeEvent);
  }

  private emitPanelChange(panel: keyof GuiManagerState["panels"] | null, isOpen: boolean): void {
    this.events.emit(GameEvents.UI_PANEL_CHANGE, {
      panel, isOpen, panels: { ...this.state.panels },
    } as UIPanelChangeEvent);
  }

  private emitMessageChange(): void {
    this.events.emit(GameEvents.UI_MESSAGE_CHANGE, {
      messageText: this.state.hud.messageText,
      messageVisible: this.state.hud.messageVisible,
      messageTimer: this.state.hud.messageTimer,
    } as UIMessageChangeEvent);
  }

  // ============= Dialog =============

  showDialog(text: string, portraitIndex: number = 0, name: string = ""): void {
    logger.log(`[GuiManager] showDialog: "${text.substring(0, 50)}..." portrait=${portraitIndex}`);
    this.state.dialog = {
      isVisible: true, text, portraitIndex, portraitSide: "left", nameText: name,
      textProgress: 0, isComplete: false,
      isInSelecting: false, selectA: "", selectB: "", selection: 0,
    };
    this.emitDialogChange();
  }

  hideDialog(): void {
    this.state.dialog.isVisible = false;
    this.emitDialogChange();
    this.events.emit(GameEvents.UI_DIALOG_CLOSED, {} as UIDialogClosedEvent);
  }

  isDialogVisible(): boolean {
    return this.state.dialog.isVisible;
  }

  completeDialog(): void {
    this.state.dialog.textProgress = this.state.dialog.text.length;
    this.state.dialog.isComplete = true;
    this.emitDialogChange();
  }

  /** 在对话框面板上显示选择 (Choose/Select 命令) */
  showDialogSelection(message: string, selectA: string, selectB: string): void {
    this.state.dialog = {
      isVisible: true, text: message, portraitIndex: 0, portraitSide: "left", nameText: "",
      textProgress: message.length, isComplete: true,
      isInSelecting: true, selectA, selectB, selection: -1,
    };
    this.emitDialogChange();
  }

  onDialogSelectionMade(selection: number): void {
    this.state.dialog.selection = selection;
    this.state.dialog.isInSelecting = false;
    this.hideDialog();
  }

  isDialogSelectionEnd(): boolean {
    return !this.state.dialog.isInSelecting;
  }

  getDialogSelection(): number {
    return this.state.dialog.selection;
  }

  handleDialogClick(): boolean {
    if (!this.state.dialog.isVisible || this.state.dialog.isInSelecting) return false;
    if (!this.state.dialog.isComplete) {
      this.completeDialog();
    } else {
      this.hideDialog();
    }
    return true;
  }

  updateDialog(deltaTime: number): void {
    if (!this.state.dialog.isVisible || this.state.dialog.isComplete) return;

    const prevProgress = Math.floor(this.state.dialog.textProgress);
    this.state.dialog.textProgress += (deltaTime * 1000) / this.typewriterSpeed;

    if (this.state.dialog.textProgress >= this.state.dialog.text.length) {
      this.state.dialog.textProgress = this.state.dialog.text.length;
      this.state.dialog.isComplete = true;
    }

    if (Math.floor(this.state.dialog.textProgress) !== prevProgress) {
      this.emitDialogChange();
    }
  }

  // ============= Selection =============

  showSelection(options: SelectionOptionData[], message: string = ""): void {
    this.state.selection = {
      isVisible: true, message, options, selectedIndex: 0, hoveredIndex: -1,
    };
    this.emitSelectionChange();
  }

  hideSelection(): void {
    this.state.selection.isVisible = false;
    this.emitSelectionChange();
  }

  isSelectionVisible(): boolean {
    return this.state.selection.isVisible;
  }

  moveSelectionUp(): void {
    if (this.state.selection.selectedIndex > 0) {
      this.state.selection.selectedIndex--;
      this.emitSelectionChange();
    }
  }

  moveSelectionDown(): void {
    if (this.state.selection.selectedIndex < this.state.selection.options.length - 1) {
      this.state.selection.selectedIndex++;
      this.emitSelectionChange();
    }
  }

  setSelectionHover(index: number): void {
    this.state.selection.hoveredIndex = index;
    this.emitSelectionChange();
  }

  confirmSelection(): SelectionOptionData | null {
    if (!this.state.selection.isVisible) return null;
    const selected = this.state.selection.options[this.state.selection.selectedIndex];
    if (selected?.enabled) {
      this.hideSelection();
      return selected;
    }
    return null;
  }

  selectByIndex(index: number): SelectionOptionData | null {
    if (index >= 0 && index < this.state.selection.options.length) {
      this.state.selection.selectedIndex = index;
      return this.confirmSelection();
    }
    return null;
  }

  // ============= MultiSelection =============

  private emitMultiSelectionChange(): void {
    this.events.emit(GameEvents.UI_MULTI_SELECTION_CHANGE, {
      selection: {
        ...this.state.multiSelection,
        options: [...this.state.multiSelection.options],
      },
    } as UIMultiSelectionChangeEvent);
  }

  showMultiSelection(
    columns: number,
    selectionCount: number,
    message: string,
    options: SelectionOptionData[]
  ): void {
    const visibleOptions = options.filter((opt) => opt.enabled);
    if (visibleOptions.length === 0) {
      logger.warn("[GuiManager] showMultiSelection: no visible options");
      return;
    }
    this.state.multiSelection = {
      isVisible: true, message, options, columns, selectionCount, selectedIndices: [],
    };
    logger.log(`[GuiManager] showMultiSelection: ${columns} cols, need ${selectionCount}, ${options.length} opts`);
    this.emitMultiSelectionChange();
  }

  toggleMultiSelection(index: number): boolean {
    if (!this.state.multiSelection.isVisible) return false;
    const option = this.state.multiSelection.options[index];
    if (!option?.enabled) return false;

    const selectedIndices = this.state.multiSelection.selectedIndices;
    const existingIdx = selectedIndices.indexOf(index);

    if (existingIdx >= 0) {
      selectedIndices.splice(existingIdx, 1);
    } else {
      selectedIndices.push(index);
      if (selectedIndices.length >= this.state.multiSelection.selectionCount) {
        this.state.multiSelection.isVisible = false;
        this.emitMultiSelectionChange();
        return true;
      }
    }
    this.emitMultiSelectionChange();
    return false;
  }

  isMultiSelectionEnd(): boolean {
    return !this.state.multiSelection.isVisible;
  }

  getMultiSelectionResult(): number[] {
    return [...this.state.multiSelection.selectedIndices];
  }

  hideMultiSelection(): void {
    this.state.multiSelection.isVisible = false;
    this.emitMultiSelectionChange();
  }

  // ============= HUD =============

  updateHud(
    life: number, lifeMax: number, mana: number, manaMax: number, thew: number, thewMax: number
  ): void {
    Object.assign(this.state.hud, { life, lifeMax, mana, manaMax, thew, thewMax });
  }

  showMessage(text: string, duration: number = 3000): void {
    this.state.hud.messageText = text;
    this.state.hud.messageVisible = true;
    this.state.hud.messageTimer = duration;
    this.emitMessageChange();
  }

  hideMessage(): void {
    this.state.hud.messageVisible = false;
    this.emitMessageChange();
  }

  updateMessage(deltaTime: number): void {
    if (this.state.hud.messageVisible && this.state.hud.messageTimer > 0) {
      this.state.hud.messageTimer -= deltaTime * 1000;
      if (this.state.hud.messageTimer <= 0) this.hideMessage();
    }
  }

  toggleMinimap(): void {
    this.state.panels.littleMap = !this.state.panels.littleMap;
    this.emitPanelChange("littleMap", this.state.panels.littleMap);
  }

  // ============= Panel =============

  /** 通用面板切换 - 指定面板和互斥组 */
  private togglePanel(
    panel: keyof GuiManagerState["panels"],
    exclusiveGroup: (keyof GuiManagerState["panels"])[]
  ): void {
    this.state.panels[panel] = !this.state.panels[panel];
    if (this.state.panels[panel]) {
      for (const other of exclusiveGroup) {
        if (other !== panel) this.state.panels[other] = false;
      }
    }
    this.emitPanelChange(panel, this.state.panels[panel]);
  }

  // 左侧面板互斥组
  private readonly leftPanels: (keyof GuiManagerState["panels"])[] = ["state", "equip", "xiulian"];
  // 右侧面板互斥组
  private readonly rightPanels: (keyof GuiManagerState["panels"])[] = ["goods", "magic", "memo"];

  toggleStateGui(): void { this.togglePanel("state", this.leftPanels); }
  toggleEquipGui(): void { this.togglePanel("equip", this.leftPanels); }
  toggleXiuLianGui(): void { this.togglePanel("xiulian", this.leftPanels); }
  toggleGoodsGui(): void { this.togglePanel("goods", this.rightPanels); }
  toggleMagicGui(): void { this.togglePanel("magic", this.rightPanels); }
  toggleMemoGui(): void { this.togglePanel("memo", this.rightPanels); }

  showSystem(show: boolean = true): void {
    this.state.panels.system = show;
    this.emitPanelChange("system", show);
  }

  toggleSystemGui(): void {
    this.showSystem(!this.state.panels.system);
  }

  showSaveLoad(show: boolean = true): void {
    this.state.panels.saveLoad = show;
    if (show) this.state.panels.system = false;
    this.emitPanelChange("saveLoad", show);
  }

  toggleSaveLoadGui(): void {
    this.showSaveLoad(!this.state.panels.saveLoad);
  }

  isSaveLoadGuiOpen(): boolean {
    return this.state.panels.saveLoad;
  }

  closeAllPanels(): void {
    const wasBuyOpen = this.state.panels.buy;
    const panelKeys: (keyof GuiManagerState["panels"])[] = [
      "state", "equip", "xiulian", "goods", "magic", "memo", "system", "saveLoad", "buy"
    ];
    for (const key of panelKeys) this.state.panels[key] = false;

    if (wasBuyOpen) {
      getEngineContext()?.getManager("buy")?.endBuy();
    }
    this.emitPanelChange(null, false);
  }

  isAnyPanelOpen(): boolean {
    const { state, equip, xiulian, goods, magic, memo, system, saveLoad, buy } = this.state.panels;
    return state || equip || xiulian || goods || magic || memo || system || saveLoad || buy;
  }

  // ============= Buy =============

  openBuyGui(): void {
    const panelKeys: (keyof GuiManagerState["panels"])[] = [
      "state", "equip", "xiulian", "magic", "memo", "system", "saveLoad"
    ];
    for (const key of panelKeys) this.state.panels[key] = false;
    this.state.panels.buy = true;
    this.state.panels.goods = true;
    this.emitPanelChange("buy", true);
  }

  closeBuyGui(): void {
    this.state.panels.buy = false;
    this.state.panels.goods = false;
    this.emitPanelChange("buy", false);
  }

  isBuyGuiOpen(): boolean {
    return this.state.panels.buy;
  }

  // ============= Menu =============

  openMenu(menu: GuiManagerState["menu"]["currentMenu"]): void {
    this.state.menu.currentMenu = menu;
    this.state.menu.isOpen = true;
    this.events.emit(GameEvents.UI_MENU_OPEN, { menu } as UIMenuOpenEvent);
  }

  closeMenu(): void {
    this.state.menu.isOpen = false;
    this.state.menu.currentMenu = null;
    this.events.emit(GameEvents.UI_MENU_CLOSE, {} as UIMenuCloseEvent);
  }

  toggleMenu(menu: GuiManagerState["menu"]["currentMenu"]): void {
    if (this.state.menu.isOpen && this.state.menu.currentMenu === menu) {
      this.closeMenu();
    } else {
      this.openMenu(menu);
    }
  }

  isMenuOpen(): boolean {
    return this.state.menu.isOpen;
  }

  // ============= Tooltip =============

  showTooltip(text: string, x: number, y: number): void {
    this.state.tooltipText = text;
    this.state.tooltipPosition = { x, y };
    this.state.tooltipVisible = true;
  }

  hideTooltip(): void {
    this.state.tooltipVisible = false;
  }

  // ============= Hotkey Handling =============

  /**
   * Handle hotkey press
   * C# Reference: GuiManager.Update - 按优先级处理各种界面的输入
   *
   * 优先级顺序（与 C# 完全一致）:
   * 1. SaveLoadInterface - ESC 关闭
   * 2. TitleInterface - 不处理 ESC
   * 3. SystemInterface - ESC 关闭
   * 4. LittleMapInterface - ESC/Tab 关闭
   * 5. SelectionInterface - 不处理 ESC（必须选择）
   * 6. SelectionMultipleInterface - 不处理 ESC（必须选择）
   * 7. DialogInterface - ESC 仅在编辑模式下跳过对话
   * 8. BuyInterface - ESC 关闭商店
   * 9. 默认 - ESC 关闭面板或打开系统菜单
   */
  handleHotkey(code: string): boolean {
    // ============= 1. SaveLoad 界面 =============
    // C#: if (SaveLoadInterface.IsShow) { if (ESC) ShowSaveLoad(false); }
    if (this.state.panels.saveLoad) {
      if (code === "Escape") {
        this.showSaveLoad(false);
        return true;
      }
      return true; // 阻止其他输入
    }

    // ============= 2. Title 界面 =============
    // C#: else if (TitleInterface.IsShow) { /* 不处理 ESC */ }
    // Title 界面由 TitleGui 组件自行处理

    // ============= 3. System 菜单 =============
    // C#: else if (SystemInterface.IsShow) { if (ESC) ShowSystem(false); }
    if (this.state.panels.system) {
      if (code === "Escape") {
        this.showSystem(false);
        return true;
      }
      return true; // 阻止其他输入
    }

    // ============= 4. 小地图界面 =============
    // C#: else if (LittleMapInterface.IsShow) { if (Tab || ESC) close; }
    if (this.state.panels.littleMap) {
      if (code === "Tab" || code === "Escape") {
        this.toggleMinimap();
        return true;
      }
      return true; // 阻止其他输入
    }

    // ============= 5 & 6. Selection 界面 (ChooseEx / ChooseMultiple) =============
    // C#: else if (SelectionInterface.IsShow) { /* 不处理 ESC，必须选择 */ }
    if (this.state.selection.isVisible) {
      // 方向键选择
      if (code === "ArrowUp" || code === "KeyW") {
        this.moveSelectionUp();
        return true;
      }
      if (code === "ArrowDown" || code === "KeyS") {
        this.moveSelectionDown();
        return true;
      }
      // 确认选择
      if (code === "Space" || code === "Enter") {
        this.confirmSelection();
        return true;
      }
      // 数字键直接选择
      const numMatch = code.match(/^Digit(\d)$/);
      if (numMatch) {
        const index = parseInt(numMatch[1], 10) - 1;
        this.selectByIndex(index);
        return true;
      }
      // ESC 不关闭选择界面 - 必须做出选择
      return true;
    }

    // MultiSelection 界面
    if (this.state.multiSelection.isVisible) {
      // ESC 不关闭多选界面 - 必须做出选择
      return true;
    }

    // ============= 7. Dialog 界面 =============
    // C#: else if (DialogInterface.IsShow) { if (IsTalkNext()) NextPage(); }
    // IsTalkNext = 鼠标点击 || 空格 || (编辑模式 && ESC)
    if (this.state.dialog.isVisible) {
      // 选择模式下不处理跳过
      if (this.state.dialog.isInSelecting) {
        return true; // 阻止输入，必须点击选择
      }
      // Space/Enter 推进对话
      if (code === "Space" || code === "Enter") {
        this.handleDialogClick();
        return true;
      }
      // C#: ESC 在编辑模式下跳过对话 (Globals.TheGame.IsInEditMode)
      // Web 版本始终允许 ESC 跳过对话，方便调试
      if (code === "Escape") {
        this.handleDialogClick();
        return true;
      }
      return true; // 阻止其他输入
    }

    // ============= 8. Buy/Shop 界面 =============
    // C#: if (BuyInterface.IsShow) { if (ESC) { EndBuyGoods(); ShowAllPanels(false); } }
    if (this.state.panels.buy) {
      if (code === "Escape") {
        // 结束购物会话
        const engineContext = getEngineContext();
        engineContext?.getManager("buy")?.endBuy();
        // 关闭商店和背包
        this.closeBuyGui();
        return true;
      }
      // 商店打开时阻止其他面板热键
      return true;
    }

    // ============= 9. 默认情况 - 常规面板和热键 =============
    // C#: IsKeyPressedAndCanInput - 脚本运行期间禁止打开面板
    const isScriptRunning = this.isScriptRunning();

    // ESC 处理
    // C#: if (HasPanelsShow()) ShowAllPanels(false); else ShowSystem();
    if (code === "Escape") {
      if (this.isAnyPanelOpen()) {
        this.closeAllPanels();
      } else if (!isScriptRunning) {
        // 仅在脚本未运行时打开系统菜单
        this.showSystem(true);
      }
      return true;
    }

    // 脚本运行期间阻止所有面板热键
    if (isScriptRunning) {
      return false;
    }

    // Tab - 小地图
    // C#: if (IsShowLittleMapKeyPressed) { ShowAllPanels(false); LittleMapInterface.IsShow = true; }
    if (code === "Tab") {
      this.closeAllPanels();
      this.toggleMinimap();
      return true;
    }

    // F1 - 状态面板
    if (code === "F1") {
      this.toggleStateGui();
      return true;
    }

    // F2 - 装备面板
    if (code === "F2") {
      this.toggleEquipGui();
      return true;
    }

    // F3 - 修炼面板
    if (code === "F3") {
      this.toggleXiuLianGui();
      return true;
    }

    // F5 - 物品面板
    if (code === "F5") {
      this.toggleGoodsGui();
      return true;
    }

    // F6 - 武功面板
    if (code === "F6") {
      this.toggleMagicGui();
      return true;
    }

    // F7 - 任务面板
    if (code === "F7") {
      this.toggleMemoGui();
      return true;
    }

    // 备用热键 (I, M, E, T)
    if (code === "KeyI") {
      this.toggleGoodsGui();
      return true;
    }
    if (code === "KeyM") {
      this.toggleMagicGui();
      return true;
    }
    if (code === "KeyE") {
      this.toggleEquipGui();
      return true;
    }
    if (code === "KeyT") {
      this.toggleStateGui();
      return true;
    }

    return false;
  }

  // ============= Update =============

  update(deltaTime: number): void {
    this.updateDialog(deltaTime);
    this.updateMessage(deltaTime);
  }

  isBlockingInput(): boolean {
    return this.state.dialog.isVisible || this.state.selection.isVisible || this.state.menu.isOpen;
  }

  private isScriptRunning(): boolean {
    try {
      return getEngineContext().getManager("script").isRunning();
    } catch {
      return false;
    }
  }

  // ============= Memo =============

  addMemo(text: string): void {
    this.memoListManager.addMemo(text);
    this.emitMemoChange("added", text);
  }

  delMemo(text: string): void {
    this.memoListManager.delMemo(text);
    this.emitMemoChange("deleted", text);
  }

  async addToMemo(textId: number): Promise<void> {
    await this.memoListManager.addToMemo(textId);
    this.emitMemoChange("added", undefined, textId);
  }

  getMemoList(): string[] {
    return this.memoListManager.getAllMemos();
  }

  updateMemoView(): void {
    this.emitMemoChange("updated");
  }

  private emitMemoChange(action: "added" | "deleted" | "updated", text?: string, textId?: number): void {
    this.events.emit(GameEvents.UI_MEMO_CHANGE, { action, text, textId } as UIMemoChangeEvent);
  }

  playMovie(file: string): void {
    logger.log(`[GuiManager] playMovie: ${file}`);
    this.isMoviePlaying = true;
    this.pendingMovieFile = file;
    this.events.emit(GameEvents.UI_VIDEO_PLAY, { file } as UIVideoPlayEvent);
  }

  /**
   * Get pending movie file (for late subscribers)
   * VideoPlayer calls this when it mounts to check if a movie is waiting
   */
  getPendingMovie(): string | null {
    return this.pendingMovieFile;
  }

  isMovieEnd(): boolean {
    return !this.isMoviePlaying;
  }

  reset(): void {
    this.state = createDefaultGuiState();
  }

  resetAllUI(): void {
    logger.debug("[GuiManager] Resetting all UI state");
    this.state = createDefaultGuiState();
    this.emitDialogChange();
    this.emitSelectionChange();
    this.emitMessageChange();
    this.emitPanelChange(null, false);
    this.closeMenu();
    this.hideTooltip();
  }
}
