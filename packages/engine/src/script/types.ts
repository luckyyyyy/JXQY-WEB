/**
 * Script domain types
 */

export interface ScriptCode {
  name: string;
  parameters: string[];
  result: string;
  literal: string;
  lineNumber: number;
  isGoto: boolean;
  isLabel: boolean;
}

export interface ScriptData {
  fileName: string;
  codes: ScriptCode[];
  labels: Map<string, number>;
}

export interface ScriptState {
  currentScript: ScriptData | null;
  currentLine: number;
  isRunning: boolean;
  isPaused: boolean;
  callStack: { script: ScriptData; line: number }[];
  belongObject: { type: "npc" | "obj" | "good"; id: string } | null;
}
