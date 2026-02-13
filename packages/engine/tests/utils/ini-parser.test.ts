import { describe, it, expect } from "vitest";
import { parseIni } from "../../src/utils/ini-parser";

describe("parseIni", () => {
  it("parses simple section with key-value pairs", () => {
    const result = parseIni("[Section]\nkey1=value1\nkey2=value2");
    expect(result.Section).toEqual({ key1: "value1", key2: "value2" });
  });

  it("handles empty input", () => {
    expect(parseIni("")).toEqual({});
  });

  it("handles multiple sections", () => {
    const content = `[Section1]
key1=val1
[Section2]
key2=val2`;
    const result = parseIni(content);
    expect(result.Section1).toEqual({ key1: "val1" });
    expect(result.Section2).toEqual({ key2: "val2" });
  });

  it("strips semicolon comments", () => {
    const result = parseIni("[S]\nkey=value ; this is a comment");
    // Parser strips comment then trims the value
    expect(result.S.key).toBe("value");
  });

  it("strips // comments", () => {
    const result = parseIni("[S]\nkey=value // comment");
    expect(result.S.key).toBe("value");
  });

  it("skips full-line comments", () => {
    const result = parseIni("[S]\n; comment line\nkey=val");
    expect(result.S).toEqual({ key: "val" });
  });

  it("handles empty lines", () => {
    const result = parseIni("[S]\n\n\nkey=val\n\n");
    expect(result.S).toEqual({ key: "val" });
  });

  it("trims section names", () => {
    const result = parseIni("[ MySection ]\nk=v");
    expect(result.MySection).toEqual({ k: "v" });
  });

  it("handles Windows-style line endings (\\r\\n)", () => {
    const result = parseIni("[S]\r\nkey=val\r\n");
    expect(result.S).toEqual({ key: "val" });
  });

  it("handles = in value", () => {
    const result = parseIni("[S]\nformula=a=b");
    expect(result.S.formula).toBe("a=b");
  });

  it("ignores keys without section", () => {
    const result = parseIni("orphan=value\n[S]\nkey=val");
    expect(result.S).toEqual({ key: "val" });
    // orphan key has no section prefix, so it's skipped
    expect(Object.keys(result)).toEqual(["S"]);
  });

  it("handles real game INI format", () => {
    const content = `[Init]
Name=小花
Kind=0
Relation=0
Life=100
LifeMax=100
Attack=20
Defend=10`;
    const result = parseIni(content);
    expect(result.Init.Name).toBe("小花");
    expect(result.Init.Kind).toBe("0");
    expect(result.Init.Life).toBe("100");
    expect(result.Init.Attack).toBe("20");
  });
});
