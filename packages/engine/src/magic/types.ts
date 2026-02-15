/**
 * Magic Types — barrel re-export
 *
 * All magic type definitions are now split into focused modules:
 * - magic-enums.ts    — enums + constants
 * - magic-data.ts     — core data interfaces (MagicData, MagicItemInfo, etc.)
 * - magic-defaults.ts — factory functions (createDefaultMagicData, etc.)
 *
 * This file re-exports everything for backward compatibility.
 */

// Data interfaces
export type {
  Kind19MagicInfo,
  MagicData,
  MagicItemInfo,
  UseMagicParams,
} from "./magic-data";
// Factory functions
export {
  createDefaultMagicData,
  createDefaultMagicItemInfo,
} from "./magic-defaults";
// Enums & constants
export {
  MAGIC_BASE_SPEED,
  MagicAddonEffect,
  MagicMoveKind,
  MagicSpecialKind,
  RestorePropertyType,
  SideEffectDamageType,
} from "./magic-enums";

// Utility function
import type { MagicData } from "./magic-data";
import { MagicMoveKind } from "./magic-enums";

/**
 * 判断武功是否需要方向指向器
 *
 * 不需要方向指向器的武功类型（自身施放/全方位释放）：
 * - MoveKind 4: CircleMove - 圆形扩散，以自身为中心
 * - MoveKind 5: HeartMove - 心形移动，自身发出
 * - MoveKind 13: FollowCharacter - 跟随自身（清心咒、金钟罩等BUFF类）
 * - MoveKind 15: SuperMode - 超级模式，作用于自身
 * - MoveKind 19: Kind19 - 持续留痕武功
 * - MoveKind 23: TimeStop - 时间停止，同 FollowCharacter
 */
export function magicNeedsDirectionPointer(magic: MagicData | null | undefined): boolean {
  if (!magic) return false;

  const selfTargetMoveKinds = [
    MagicMoveKind.CircleMove,
    MagicMoveKind.HeartMove,
    MagicMoveKind.FollowCharacter,
    MagicMoveKind.SuperMode,
    MagicMoveKind.Kind19,
    MagicMoveKind.TimeStop,
  ];

  return !selfTargetMoveKinds.includes(magic.moveKind);
}
