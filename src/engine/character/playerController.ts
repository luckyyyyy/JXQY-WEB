/**
 * Player Controller - based on JxqyHD Engine/Player.cs
 * Handles player input, movement, and actions
 */
import type { PlayerData, Vector2, InputState, CharacterConfig, NpcData } from "../core/types";
import { CharacterState, Direction, DEFAULT_PLAYER_STATS, CharacterKind, RelationType } from "../core/types";
import {
  createPlayerData,
  updateCharacterMovement,
  updateCharacterAnimation,
  walkTo,
} from "./character";
import { pixelToTile, getDirection, distance } from "../core/utils";

export interface PlayerAction {
  type: "interact" | "attack" | "use_skill" | "use_item";
  targetNpc?: NpcData;
  skillSlot?: number;
  itemSlot?: number;
}

export class PlayerController {
  private player: PlayerData;
  private isWalkable: (tile: Vector2) => boolean;
  private pendingAction: PlayerAction | null = null;

  constructor(isWalkable: (tile: Vector2) => boolean) {
    this.isWalkable = isWalkable;

    // Create default player
    const config: CharacterConfig = {
      name: "杨影枫",
      npcIni: "z-杨影枫.ini",
      kind: CharacterKind.Player,
      relation: RelationType.None,
      stats: { ...DEFAULT_PLAYER_STATS },
    };

    this.player = createPlayerData(config, 10, 10, Direction.South);
  }

  /**
   * Get player data
   */
  getPlayer(): PlayerData {
    return this.player;
  }

  /**
   * Set walkability checker
   */
  setWalkabilityChecker(checker: (tile: Vector2) => boolean): void {
    this.isWalkable = checker;
  }

  /**
   * Set player position
   */
  setPosition(tileX: number, tileY: number): void {
    this.player.tilePosition = { x: tileX, y: tileY };
    const pixel = { x: tileX * 64 + 32, y: tileY * 16 + 16 };
    this.player.pixelPosition = pixel;
    this.player.path = [];
    this.player.isMoving = false;
    this.player.targetPosition = null;
    this.player.state = CharacterState.Stand;
  }

  /**
   * Set player position in pixels
   */
  setPixelPosition(x: number, y: number): void {
    this.player.pixelPosition = { x, y };
    this.player.tilePosition = pixelToTile(x, y);
  }

  /**
   * Handle input for movement
   */
  handleInput(input: InputState, _cameraX: number, _cameraY: number): PlayerAction | null {
    this.pendingAction = null;

    // Handle keyboard movement
    const moveDir = this.getKeyboardMoveDirection(input.keys);
    if (moveDir !== null) {
      this.moveInDirection(moveDir);
      return null;
    }

    // Handle mouse click for movement/interaction
    if (input.clickedTile) {
      const targetTile = input.clickedTile;

      // Check if we should interact or move
      // For now, just move
      this.walkToTile(targetTile.x, targetTile.y);
      return null;
    }

    return this.pendingAction;
  }

  /**
   * Get movement direction from keyboard input
   */
  private getKeyboardMoveDirection(keys: Set<string>): Direction | null {
    const up = keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Numpad8");
    const down = keys.has("ArrowDown") || keys.has("KeyS") || keys.has("Numpad2");
    const left = keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("Numpad4");
    const right = keys.has("ArrowRight") || keys.has("KeyD") || keys.has("Numpad6");

    // Diagonal movement
    if (up && right) return Direction.NorthEast;
    if (up && left) return Direction.NorthWest;
    if (down && right) return Direction.SouthEast;
    if (down && left) return Direction.SouthWest;

    // Cardinal movement
    if (up) return Direction.North;
    if (down) return Direction.South;
    if (left) return Direction.West;
    if (right) return Direction.East;

    // Numpad diagonal
    if (keys.has("Numpad7")) return Direction.NorthWest;
    if (keys.has("Numpad9")) return Direction.NorthEast;
    if (keys.has("Numpad1")) return Direction.SouthWest;
    if (keys.has("Numpad3")) return Direction.SouthEast;

    return null;
  }

  /**
   * Move player in a direction
   */
  private moveInDirection(direction: Direction): void {
    const dirVectors: Vector2[] = [
      { x: 0, y: -2 },  // North
      { x: 1, y: -1 },  // NorthEast
      { x: 1, y: 0 },   // East
      { x: 1, y: 1 },   // SouthEast
      { x: 0, y: 2 },   // South
      { x: -1, y: 1 },  // SouthWest
      { x: -1, y: 0 },  // West
      { x: -1, y: -1 }, // NorthWest
    ];

    const vec = dirVectors[direction];
    const isOddRow = this.player.tilePosition.y % 2 === 1;

    // Adjust for isometric grid
    let targetX = this.player.tilePosition.x + vec.x;
    let targetY = this.player.tilePosition.y + vec.y;

    // Handle odd/even row offset for diagonal movement
    if (vec.y !== 0 && Math.abs(vec.y) === 1) {
      if (isOddRow && vec.x >= 0) {
        targetX = this.player.tilePosition.x + (vec.x > 0 ? 1 : 0);
      } else if (!isOddRow && vec.x <= 0) {
        targetX = this.player.tilePosition.x + (vec.x < 0 ? -1 : 0);
      }
    }

    const targetTile = { x: targetX, y: targetY };
    if (this.isWalkable(targetTile)) {
      this.player.direction = direction;
      this.player.path = [targetTile];
      this.player.isMoving = true;
      this.player.state = CharacterState.Walk;
    } else {
      // Just change direction without moving
      this.player.direction = direction;
    }
  }

  /**
   * Walk to a specific tile
   */
  walkToTile(tileX: number, tileY: number): boolean {
    return walkTo(this.player, { x: tileX, y: tileY }, this.isWalkable);
  }

  /**
   * Stop player movement
   */
  stopMovement(): void {
    this.player.path = [];
    this.player.isMoving = false;
    this.player.targetPosition = null;
    this.player.state = CharacterState.Stand;
  }

  /**
   * Update player state
   */
  update(deltaTime: number): void {
    // Update movement
    const result = updateCharacterMovement(this.player, deltaTime, this.isWalkable);

    // Update animation
    updateCharacterAnimation(this.player, deltaTime);

    // Handle state transitions
    if (!this.player.isMoving && this.player.path.length === 0) {
      if (
        this.player.state === CharacterState.Walk ||
        this.player.state === CharacterState.Run
      ) {
        this.player.state = CharacterState.Stand;
      }
    }
  }

  /**
   * Check if player is near a position
   */
  isNear(position: Vector2, threshold: number = 50): boolean {
    return distance(this.player.pixelPosition, position) <= threshold;
  }

  /**
   * Get player tile position
   */
  getTilePosition(): Vector2 {
    return { ...this.player.tilePosition };
  }

  /**
   * Get player pixel position
   */
  getPixelPosition(): Vector2 {
    return { ...this.player.pixelPosition };
  }

  /**
   * Get player direction
   */
  getDirection(): Direction {
    return this.player.direction;
  }

  /**
   * Set player direction
   */
  setDirection(direction: Direction): void {
    this.player.direction = direction;
  }

  /**
   * Set player state
   */
  setState(state: CharacterState): void {
    this.player.state = state;
    // Reset animation frame when changing states
    this.player.currentFrame = 0;
  }

  /**
   * Add experience
   */
  addExp(amount: number): void {
    this.player.config.stats.exp += amount;
    // TODO: Check for level up
  }

  /**
   * Add money
   */
  addMoney(amount: number): void {
    this.player.money += amount;
  }

  /**
   * Get money
   */
  getMoney(): number {
    return this.player.money;
  }

  /**
   * Heal player
   */
  heal(amount: number): void {
    this.player.config.stats.life = Math.min(
      this.player.config.stats.life + amount,
      this.player.config.stats.lifeMax
    );
  }

  /**
   * Restore mana
   */
  restoreMana(amount: number): void {
    this.player.config.stats.mana = Math.min(
      this.player.config.stats.mana + amount,
      this.player.config.stats.manaMax
    );
  }

  /**
   * Take damage
   */
  takeDamage(amount: number): boolean {
    this.player.config.stats.life -= amount;
    if (this.player.config.stats.life <= 0) {
      this.player.config.stats.life = 0;
      this.player.state = CharacterState.Death;
      return true; // Dead
    }
    return false;
  }

  /**
   * Is player dead
   */
  isDead(): boolean {
    return this.player.config.stats.life <= 0;
  }
}
