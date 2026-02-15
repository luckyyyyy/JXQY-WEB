import type { CharacterState, Direction } from "../core/types";
import type { AsfData } from "../resource/format/asf";

export interface AnimationFrame {
  frameIndex: number;
  duration: number;
}

export interface Animation {
  name: string;
  frames: AnimationFrame[];
  isLooping: boolean;
}

export interface SpriteData {
  asf: AsfData | null;
  currentFrame: number;
  animationTime: number;
  direction: Direction;
  state: CharacterState;
}
