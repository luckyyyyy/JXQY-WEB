/**
 * Script Parser - based on JxqyHD Engine/Script/ScriptParser.cs
 * Parses script files into executable code structures
 */
import type { ScriptCode, ScriptData } from "../core/types";

/**
 * Label regex - matches @LabelName: format (like C# RegGoto)
 * Note: C# uses ^@([a-zA-Z0-9]+): to match labels
 */
const REG_LABEL = /^@([a-zA-Z0-9_]+):/;

/**
 * Parse a single line of script into a ScriptCode object
 */
function parseLine(line: string, lineNumber: number): ScriptCode | null {
  const trimmed = line.trim();

  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  // Check if it's a label (format: @LabelName:)
  // In C#, labels are stored with the colon, e.g., "@Begin:"
  const labelMatch = REG_LABEL.exec(trimmed);
  if (labelMatch) {
    return {
      name: labelMatch[0], // Store with colon, e.g., "@Begin:"
      parameters: [],
      result: "",
      literal: line,
      lineNumber,
      isGoto: false,
      isLabel: true,
    };
  }

  // Parse conditional: If (condition) @Label; - MUST come before generic function match
  // Support formats: If($Event <> 710) @end; or If ($Event == 0) @Label;
  const ifMatch = trimmed.match(/^If\s*\((.+)\)\s*(@\w+)\s*;?\s*$/i);
  if (ifMatch) {
    const [, condition, label] = ifMatch;
    return {
      name: "If",
      parameters: [condition.trim()],
      result: label.trim(),
      literal: line,
      lineNumber,
      isGoto: false,
      isLabel: false,
    };
  }

  // Parse Goto: Goto @Label; - MUST come before generic function match
  const gotoMatch = trimmed.match(/^Goto\s+(@\w+)\s*;?\s*$/i);
  if (gotoMatch) {
    return {
      name: "Goto",
      parameters: [gotoMatch[1]],
      result: "",
      literal: line,
      lineNumber,
      isGoto: true,
      isLabel: false,
    };
  }

  // Parse function call: FunctionName(param1, param2, ...);
  // More tolerant regex: handles malformed closing like 2_; or 2_)
  const funcMatch = trimmed.match(/^(\w+)\s*\((.*?)\s*[);_]+\s*$/);
  if (funcMatch) {
    const [, funcName, paramsStr] = funcMatch;
    // Clean up malformed parameter endings (like "2_" -> "2")
    const cleanedParams = paramsStr.replace(/[_]+$/, "").trim();
    const parameters = parseParameters(cleanedParams);
    return {
      name: funcName,
      parameters,
      result: "",
      literal: line,
      lineNumber,
      isGoto: false,
      isLabel: false,
    };
  }

  // Parse simple command without parentheses: Return;
  const simpleMatch = trimmed.match(/^(\w+)\s*;?\s*$/);
  if (simpleMatch) {
    return {
      name: simpleMatch[1],
      parameters: [],
      result: "",
      literal: line,
      lineNumber,
      isGoto: false,
      isLabel: false,
    };
  }

  return null;
}

/**
 * Parse function parameters, handling quoted strings and nested parentheses
 */
function parseParameters(paramsStr: string): string[] {
  const params: string[] = [];
  let current = "";
  let inQuotes = false;
  let parenDepth = 0;

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];

    if (char === '"' && paramsStr[i - 1] !== "\\") {
      inQuotes = !inQuotes;
      current += char;
    } else if (!inQuotes && char === "(") {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ")") {
      parenDepth--;
      current += char;
    } else if (!inQuotes && parenDepth === 0 && char === ",") {
      params.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  return params.map((p) => {
    // Remove surrounding quotes
    if (p.startsWith('"') && p.endsWith('"')) {
      return p.slice(1, -1);
    }
    return p;
  });
}

/**
 * Parse a complete script file
 */
export function parseScript(content: string, fileName: string): ScriptData {
  const lines = content.split("\n");
  const codes: ScriptCode[] = [];
  const labels = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const code = parseLine(lines[i], i);
    if (code) {
      if (code.isLabel) {
        labels.set(code.name, codes.length);
      }
      codes.push(code);
    }
  }

  return {
    fileName,
    codes,
    labels,
  };
}

/**
 * Load and parse a script file from URL
 */
export async function loadScript(url: string): Promise<ScriptData | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to load script: ${url}`);
      return null;
    }
    // Try to decode as GB2312/GBK for Chinese characters
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let content: string;
    try {
      // Try GB2312/GBK first (for Chinese game content)
      const decoder = new TextDecoder('gb2312');
      content = decoder.decode(bytes);
    } catch {
      try {
        // Fallback to GBK
        const decoder = new TextDecoder('gbk');
        content = decoder.decode(bytes);
      } catch {
        // Last resort: UTF-8
        const decoder = new TextDecoder('utf-8');
        content = decoder.decode(bytes);
      }
    }

    const fileName = url.split("/").pop() || url;
    return parseScript(content, fileName);
  } catch (error) {
    console.error(`Error loading script ${url}:`, error);
    return null;
  }
}
