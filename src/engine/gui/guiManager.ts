/**
 * GUI Manager - based on JxqyHD Engine/Gui/GuiManager.cs
 * Central controller for all GUI elements
 */
import type { Vector2 } from "../core/types";
import type {
  GuiManagerState,
  DialogGuiState,
  SelectionGuiState,
  SelectionOptionData,
  HudState,
  HotkeyAction,
} from "./types";
import { createDefaultGuiState, DEFAULT_HOTKEYS } from "./types";

export type GuiEventHandler = (event: string, data?: any) => void;

export class GuiManager {
  private state: GuiManagerState;
  private eventHandler: GuiEventHandler | null = null;
  private typewriterSpeed: number = 50; // ms per character

  constructor() {
    this.state = createDefaultGuiState();
  }

  /**
   * Set event handler
   */
  setEventHandler(handler: GuiEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Get current state
   */
  getState(): GuiManagerState {
    return this.state;
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    this.eventHandler?.(event, data);
  }

  // ============= Dialog Methods =============

  /**
   * Show dialog with text and portrait
   */
  showDialog(text: string, portraitIndex: number = 0, name: string = ""): void {
    console.log(`[GuiManager] showDialog: "${text.substring(0, 50)}..." portrait=${portraitIndex}`);
    this.state.dialog = {
      isVisible: true,
      text,
      portraitIndex,
      portraitSide: "left",
      nameText: name,
      textProgress: 0,
      isComplete: false,
    };
    this.emit("dialog:show", { text, portraitIndex, name });
  }

  /**
   * Hide dialog
   */
  hideDialog(): void {
    this.state.dialog.isVisible = false;
    this.emit("dialog:hide");
  }

  /**
   * Check if dialog is visible
   */
  isDialogVisible(): boolean {
    return this.state.dialog.isVisible;
  }

  /**
   * Complete dialog text immediately
   */
  completeDialog(): void {
    this.state.dialog.textProgress = this.state.dialog.text.length;
    this.state.dialog.isComplete = true;
  }

  /**
   * Handle dialog click (advance or skip)
   */
  handleDialogClick(): boolean {
    if (!this.state.dialog.isVisible) return false;

    if (!this.state.dialog.isComplete) {
      // Skip to end of text
      this.completeDialog();
      return true;
    } else {
      // Close dialog
      this.hideDialog();
      this.emit("dialog:closed");
      return true;
    }
  }

  /**
   * Update dialog typewriter effect
   */
  updateDialog(deltaTime: number): void {
    if (!this.state.dialog.isVisible || this.state.dialog.isComplete) return;

    const charsToAdd = (deltaTime * 1000) / this.typewriterSpeed;
    this.state.dialog.textProgress += charsToAdd;

    if (this.state.dialog.textProgress >= this.state.dialog.text.length) {
      this.state.dialog.textProgress = this.state.dialog.text.length;
      this.state.dialog.isComplete = true;
    }
  }

  // ============= Selection Methods =============

  /**
   * Show selection dialog
   */
  showSelection(options: SelectionOptionData[]): void {
    this.state.selection = {
      isVisible: true,
      options,
      selectedIndex: 0,
      hoveredIndex: -1,
    };
    this.emit("selection:show", options);
  }

  /**
   * Hide selection
   */
  hideSelection(): void {
    this.state.selection.isVisible = false;
    this.emit("selection:hide");
  }

  /**
   * Check if selection is visible
   */
  isSelectionVisible(): boolean {
    return this.state.selection.isVisible;
  }

  /**
   * Move selection up
   */
  moveSelectionUp(): void {
    if (this.state.selection.selectedIndex > 0) {
      this.state.selection.selectedIndex--;
    }
  }

  /**
   * Move selection down
   */
  moveSelectionDown(): void {
    if (this.state.selection.selectedIndex < this.state.selection.options.length - 1) {
      this.state.selection.selectedIndex++;
    }
  }

  /**
   * Set selection hover
   */
  setSelectionHover(index: number): void {
    this.state.selection.hoveredIndex = index;
  }

  /**
   * Confirm selection
   */
  confirmSelection(): SelectionOptionData | null {
    if (!this.state.selection.isVisible) return null;

    const selectedIndex = this.state.selection.selectedIndex;
    const selected = this.state.selection.options[selectedIndex];
    if (selected && selected.enabled) {
      this.hideSelection();
      this.emit("selection:confirmed", { ...selected, index: selectedIndex });
      return selected;
    }
    return null;
  }

  /**
   * Select by index
   */
  selectByIndex(index: number): SelectionOptionData | null {
    if (index >= 0 && index < this.state.selection.options.length) {
      this.state.selection.selectedIndex = index;
      return this.confirmSelection();
    }
    return null;
  }

  // ============= HUD Methods =============

  /**
   * Update HUD values
   */
  updateHud(
    life: number,
    lifeMax: number,
    mana: number,
    manaMax: number,
    thew: number,
    thewMax: number
  ): void {
    this.state.hud.life = life;
    this.state.hud.lifeMax = lifeMax;
    this.state.hud.mana = mana;
    this.state.hud.manaMax = manaMax;
    this.state.hud.thew = thew;
    this.state.hud.thewMax = thewMax;
  }

  /**
   * Show message
   */
  showMessage(text: string, duration: number = 3000): void {
    this.state.hud.messageText = text;
    this.state.hud.messageVisible = true;
    this.state.hud.messageTimer = duration;
    this.emit("message:show", { text, duration });
  }

  /**
   * Hide message
   */
  hideMessage(): void {
    this.state.hud.messageVisible = false;
    this.emit("message:hide");
  }

  /**
   * Update message timer
   */
  updateMessage(deltaTime: number): void {
    if (this.state.hud.messageVisible && this.state.hud.messageTimer > 0) {
      this.state.hud.messageTimer -= deltaTime * 1000;
      if (this.state.hud.messageTimer <= 0) {
        this.hideMessage();
      }
    }
  }

  /**
   * Toggle minimap
   */
  toggleMinimap(): void {
    this.state.hud.minimapVisible = !this.state.hud.minimapVisible;
  }

  // ============= Menu Methods =============

  /**
   * Open menu
   */
  openMenu(menu: GuiManagerState["menu"]["currentMenu"]): void {
    this.state.menu.currentMenu = menu;
    this.state.menu.isOpen = true;
    this.emit("menu:open", menu);
  }

  /**
   * Close menu
   */
  closeMenu(): void {
    this.state.menu.isOpen = false;
    this.state.menu.currentMenu = null;
    this.emit("menu:close");
  }

  /**
   * Toggle menu
   */
  toggleMenu(menu: GuiManagerState["menu"]["currentMenu"]): void {
    if (this.state.menu.isOpen && this.state.menu.currentMenu === menu) {
      this.closeMenu();
    } else {
      this.openMenu(menu);
    }
  }

  /**
   * Check if any menu is open
   */
  isMenuOpen(): boolean {
    return this.state.menu.isOpen;
  }

  // ============= Tooltip Methods =============

  /**
   * Show tooltip
   */
  showTooltip(text: string, x: number, y: number): void {
    this.state.tooltipText = text;
    this.state.tooltipPosition = { x, y };
    this.state.tooltipVisible = true;
  }

  /**
   * Hide tooltip
   */
  hideTooltip(): void {
    this.state.tooltipVisible = false;
  }

  // ============= Hotkey Handling =============

  /**
   * Handle hotkey press
   */
  handleHotkey(code: string): boolean {
    // Check for dialog/selection input first
    if (this.state.dialog.isVisible) {
      if (code === "Space" || code === "Enter") {
        this.handleDialogClick();
        return true;
      }
    }

    if (this.state.selection.isVisible) {
      if (code === "ArrowUp" || code === "KeyW") {
        this.moveSelectionUp();
        return true;
      }
      if (code === "ArrowDown" || code === "KeyS") {
        this.moveSelectionDown();
        return true;
      }
      if (code === "Space" || code === "Enter") {
        this.confirmSelection();
        return true;
      }
      // Number keys to select directly
      const numMatch = code.match(/^Digit(\d)$/);
      if (numMatch) {
        const index = parseInt(numMatch[1], 10) - 1;
        this.selectByIndex(index);
        return true;
      }
    }

    // Menu hotkeys
    if (code === DEFAULT_HOTKEYS.inventory) {
      this.toggleMenu("inventory");
      return true;
    }
    if (code === DEFAULT_HOTKEYS.equipment) {
      this.toggleMenu("equipment");
      return true;
    }
    if (code === DEFAULT_HOTKEYS.magic) {
      this.toggleMenu("magic");
      return true;
    }
    if (code === DEFAULT_HOTKEYS.status) {
      this.toggleMenu("status");
      return true;
    }
    if (code === DEFAULT_HOTKEYS.system) {
      if (this.state.menu.isOpen) {
        this.closeMenu();
      } else {
        this.toggleMenu("system");
      }
      return true;
    }
    if (code === DEFAULT_HOTKEYS.minimap) {
      this.toggleMinimap();
      return true;
    }

    return false;
  }

  // ============= Update =============

  /**
   * Update GUI state
   */
  update(deltaTime: number): void {
    this.updateDialog(deltaTime);
    this.updateMessage(deltaTime);
  }

  /**
   * Check if any UI is blocking game input
   */
  isBlockingInput(): boolean {
    return (
      this.state.dialog.isVisible ||
      this.state.selection.isVisible ||
      this.state.menu.isOpen
    );
  }

  /**
   * Reset GUI state
   */
  reset(): void {
    this.state = createDefaultGuiState();
  }
}
