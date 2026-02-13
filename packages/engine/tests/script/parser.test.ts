import { describe, it, expect, vi } from "vitest";
import { parseScript } from "../../src/script/parser";

// Mock dependencies
vi.mock("../../src/core/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../src/resource/resourceLoader", () => ({
  resourceLoader: {
    loadText: vi.fn(),
  },
}));

vi.mock("../../src/config/resourcePaths", () => ({
  extractRelativePath: (p: string) => p,
  ResourcePath: {
    scriptCommon: (f: string) => `/resources/script/common/${f}`,
  },
}));

describe("parseScript", () => {
  it("parses empty script", () => {
    const result = parseScript("", "test.txt");
    expect(result.fileName).toBe("test.txt");
    expect(result.codes).toHaveLength(0);
    expect(result.labels.size).toBe(0);
  });

  it("skips empty lines and comments", () => {
    const result = parseScript("// comment\n\n// another comment\n", "test.txt");
    expect(result.codes).toHaveLength(0);
  });

  it("parses labels", () => {
    const result = parseScript("@Begin:\n@End:", "test.txt");
    expect(result.labels.has("@Begin:")).toBe(true);
    expect(result.labels.has("@End:")).toBe(true);
    expect(result.codes).toHaveLength(2);
    expect(result.codes[0].isLabel).toBe(true);
    expect(result.codes[0].name).toBe("@Begin:");
  });

  it("parses function call with parameters", () => {
    const result = parseScript('Talk(1, "你好");', "test.txt");
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].name).toBe("Talk");
    expect(result.codes[0].parameters).toEqual(["1", "你好"]);
  });

  it("parses function call with no parameters", () => {
    const result = parseScript("Return;", "test.txt");
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].name).toBe("Return");
    expect(result.codes[0].parameters).toHaveLength(0);
  });

  it("parses Goto statement", () => {
    const result = parseScript("Goto @End;", "test.txt");
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].name).toBe("Goto");
    expect(result.codes[0].isGoto).toBe(true);
    expect(result.codes[0].parameters).toEqual(["@End"]);
  });

  it("parses If conditional", () => {
    const result = parseScript("If($Event <> 710) @end;", "test.txt");
    expect(result.codes).toHaveLength(1);
    const code = result.codes[0];
    expect(code.name).toBe("If");
    expect(code.parameters).toEqual(["$Event <> 710"]);
    expect(code.result).toBe("@end");
  });

  it("maps labels to correct code indices", () => {
    const script = `@Begin:
Talk(1, "hello");
Goto @End;
@End:
Return;`;
    const result = parseScript(script, "test.txt");
    expect(result.labels.get("@Begin:")).toBe(0);
    expect(result.labels.get("@End:")).toBe(3);
  });

  it("strips inline comments", () => {
    const result = parseScript('Talk(1, "hello"); // say hello', "test.txt");
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].name).toBe("Talk");
  });

  it("does not strip // inside quoted strings", () => {
    const result = parseScript('Talk(1, "http://example.com");', "test.txt");
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].parameters[1]).toBe("http://example.com");
  });

  it("handles full-width commas as parameter separators", () => {
    const result = parseScript("SetTo(100，200);", "test.txt");
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].parameters).toEqual(["100", "200"]);
  });

  it("parses a complete game script", () => {
    const script = `@Begin:
If($Event == 0) @FirstTime;
If($Event == 1) @SecondTime;
Goto @End;
@FirstTime:
Talk(1, "你好，初次见面！");
AddMemo("遇到了小花");
SetEvent(1);
Goto @End;
@SecondTime:
Talk(1, "又见面了");
@End:
Return;`;
    const result = parseScript(script, "npc-dialog.txt");
    expect(result.labels.size).toBe(4);
    expect(result.codes.length).toBeGreaterThan(5);

    // Find the If statement
    const ifCode = result.codes.find((c) => c.name === "If");
    expect(ifCode).toBeDefined();
    expect(ifCode!.parameters[0]).toBe("$Event == 0");
    expect(ifCode!.result).toBe("@FirstTime");
  });

  it("handles malformed function closing gracefully", () => {
    // Some scripts have trailing underscores like "2_;"
    const result = parseScript("SetLevel(2_);", "test.txt");
    expect(result.codes).toHaveLength(1);
    expect(result.codes[0].name).toBe("SetLevel");
    expect(result.codes[0].parameters[0]).toBe("2");
  });
});
