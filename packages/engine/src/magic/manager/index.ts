/**
 * Magic Manager Module - 导出
 */

export { CharacterHelper } from "./character-helper";
export { CollisionHandler } from "./collision-handler";
export { MagicManager, type MagicManagerDeps } from "./magic-manager";
export { SpriteFactory } from "./sprite-factory";
export { SpriteUpdater } from "./sprite-updater";
export type {
  ICharacterHelper,
  ICollisionHandler,
  ISpriteAdder,
  ISpriteFactoryCallbacks,
  MagicManagerState,
} from "./types";
