import { describe, it, expect, vi } from "vitest";
import { getLittleEndianInt, readNullTerminatedString } from "../../src/resource/format/binary-utils";

// Mock encoding module since GBK TextDecoder might not be available in Node
vi.mock("../../src/resource/format/encoding", () => ({
  getTextDecoder: () => new TextDecoder("utf-8"),
}));

describe("getLittleEndianInt", () => {
  it("reads 0 from zero bytes", () => {
    const data = new Uint8Array([0, 0, 0, 0]);
    expect(getLittleEndianInt(data, 0)).toBe(0);
  });

  it("reads small positive integer", () => {
    // 1 in little-endian: 01 00 00 00
    const data = new Uint8Array([1, 0, 0, 0]);
    expect(getLittleEndianInt(data, 0)).toBe(1);
  });

  it("reads 256 (0x100)", () => {
    // 256 in little-endian: 00 01 00 00
    const data = new Uint8Array([0, 1, 0, 0]);
    expect(getLittleEndianInt(data, 0)).toBe(256);
  });

  it("reads from offset", () => {
    const data = new Uint8Array([0xFF, 0xFF, 42, 0, 0, 0]);
    expect(getLittleEndianInt(data, 2)).toBe(42);
  });

  it("reads negative number (two's complement)", () => {
    // -1 in little-endian: FF FF FF FF
    const data = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
    expect(getLittleEndianInt(data, 0)).toBe(-1);
  });

  it("reads 0x12345678", () => {
    // 0x12345678 in little-endian: 78 56 34 12
    const data = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
    expect(getLittleEndianInt(data, 0)).toBe(0x12345678);
  });

  it("reads max positive int32", () => {
    // 2147483647 = 0x7FFFFFFF in little-endian: FF FF FF 7F
    const data = new Uint8Array([0xFF, 0xFF, 0xFF, 0x7F]);
    expect(getLittleEndianInt(data, 0)).toBe(2147483647);
  });

  it("reads min negative int32", () => {
    // -2147483648 = 0x80000000 in little-endian: 00 00 00 80
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x80]);
    expect(getLittleEndianInt(data, 0)).toBe(-2147483648);
  });
});

describe("readNullTerminatedString", () => {
  it("reads empty string when first byte is null", () => {
    const data = new Uint8Array([0, 65, 66]);
    expect(readNullTerminatedString(data, 0, 10)).toBe("");
  });

  it("reads ASCII string", () => {
    const data = new Uint8Array([72, 101, 108, 108, 111, 0]); // "Hello\0"
    expect(readNullTerminatedString(data, 0, 10)).toBe("Hello");
  });

  it("reads from offset", () => {
    const data = new Uint8Array([0, 0, 72, 105, 0]); // ..Hi\0
    expect(readNullTerminatedString(data, 2, 10)).toBe("Hi");
  });

  it("respects maxLength", () => {
    const data = new Uint8Array([65, 66, 67, 68, 69, 0]); // "ABCDE\0"
    expect(readNullTerminatedString(data, 0, 3)).toBe("ABC");
  });

  it("handles string without null terminator (uses maxLength)", () => {
    const data = new Uint8Array([65, 66, 67]); // "ABC" no null
    expect(readNullTerminatedString(data, 0, 3)).toBe("ABC");
  });
});
