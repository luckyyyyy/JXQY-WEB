/**
 * MMF DTO (Data Transfer Object) conversion utilities
 *
 * Converts between MiuMapData (engine runtime, Uint8Array fields)
 * and MiuMapDataDto (JSON-safe, base64-encoded string fields).
 *
 * Used by:
 * - Server: parseMMF → miuMapDataToDto → store as JSONB / return in API
 * - Frontend: receive mapParsed → dtoToMiuMapData → pass to MapViewer
 */

import type { MiuMapDataDto } from "@miu2d/types";
import type { MiuMapData } from "../../map/types";

// ============= Base64 helpers (works in both Node.js and browser) =============

function uint8ArrayToBase64(arr: Uint8Array): string {
  // Node.js
  if (typeof Buffer !== "undefined") {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString("base64");
  }
  // Browser
  let binary = "";
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(b64: string): Uint8Array {
  // Node.js
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  // Browser
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

// ============= Conversion functions =============

/**
 * Convert MiuMapData (engine runtime) to MiuMapDataDto (JSON-safe)
 *
 * Encodes all Uint8Array fields as base64 strings.
 */
export function miuMapDataToDto(data: MiuMapData): MiuMapDataDto {
  return {
    mapColumnCounts: data.mapColumnCounts,
    mapRowCounts: data.mapRowCounts,
    mapPixelWidth: data.mapPixelWidth,
    mapPixelHeight: data.mapPixelHeight,
    msfEntries: data.msfEntries.map((e) => ({ name: e.name, looping: e.looping })),
    trapTable: data.trapTable.map((e) => ({ trapIndex: e.trapIndex, scriptPath: e.scriptPath })),
    layer1: uint8ArrayToBase64(data.layer1),
    layer2: uint8ArrayToBase64(data.layer2),
    layer3: uint8ArrayToBase64(data.layer3),
    barriers: uint8ArrayToBase64(data.barriers),
    traps: uint8ArrayToBase64(data.traps),
  };
}

/**
 * Convert MiuMapDataDto (JSON-safe) back to MiuMapData (engine runtime)
 *
 * Decodes base64 string fields back to Uint8Array.
 */
export function dtoToMiuMapData(dto: MiuMapDataDto): MiuMapData {
  return {
    mapColumnCounts: dto.mapColumnCounts,
    mapRowCounts: dto.mapRowCounts,
    mapPixelWidth: dto.mapPixelWidth,
    mapPixelHeight: dto.mapPixelHeight,
    msfEntries: dto.msfEntries.map((e) => ({ name: e.name, looping: e.looping })),
    trapTable: dto.trapTable.map((e) => ({ trapIndex: e.trapIndex, scriptPath: e.scriptPath })),
    layer1: base64ToUint8Array(dto.layer1),
    layer2: base64ToUint8Array(dto.layer2),
    layer3: base64ToUint8Array(dto.layer3),
    barriers: base64ToUint8Array(dto.barriers),
    traps: base64ToUint8Array(dto.traps),
  };
}
