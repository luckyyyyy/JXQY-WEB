/**
 * Script Parser - based on JxqyHD Engine/Script/ScriptParser.cs
 * Parses script files into executable code structures
 */

import { extractRelativePath, ResourcePath } from "../resource/resource-paths";
import { logger } from "../core/logger";
import type { ScriptCode, ScriptData } from "../core/types";
import { resourceLoader } from "../resource/resource-loader";

/**
 * Label regex - matches @LabelName: format
 * Note: uses ^@([a-zA-Z0-9]+): to match labels
 */
const REG_LABEL = /^@([a-zA-Z0-9_]+):/;

/**
 * Parse a single line of script into a ScriptCode object
 */
function parseLine(line: string, lineNumber: number): ScriptCode | null {
  let trimmed = line.trim();

  // Skip empty lines and full-line comments
  if (!trimmed || trimmed.startsWith("//")) {
    return null;
  }

  // Strip inline comments (// after code), but not inside quoted strings.
  // Find the first // that is outside of any quoted string.
  let inQuote = false;
  for (let i = 0; i < trimmed.length - 1; i++) {
    if (trimmed[i] === '"') {
      inQuote = !inQuote;
    } else if (!inQuote && trimmed[i] === "/" && trimmed[i + 1] === "/") {
      trimmed = trimmed.slice(0, i).trimEnd();
      break;
    }
  }

  // Check if it's a label (format: @LabelName:)
  // labels are stored with the colon, e.g., "@Begin:"
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
    } else if (
      !inQuotes &&
      parenDepth === 0 &&
      (char === "," || char === "\uFF0C")
    ) {
      // Support both regular comma and full-width comma (，)
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
 * Implements Utils.GetScriptFilePath fallback:
 * 1. First tries map-specific path: script/map/{mapName}/{fileName}
 * 2. Falls back to common path: script/common/{fileName}
 *
 * Uses unified resourceLoader for caching parsed results
 */
export async function loadScript(url: string): Promise<ScriptData | null> {
  // 先尝试从缓存加载原始路径
  const cachedResult = await resourceLoader.loadIni<ScriptData>(
    url,
    (content) => parseScript(content, url.replace(/^\/resources\//, "")),
    "script"
  );
  if (cachedResult) {
    return cachedResult;
  }

  // If map-specific script not found, try fallback paths
  if (url.includes("/script/map/")) {
    const fileName = url.split("/").pop() || "";

    // First try alternate case (trap -> Trap or Trap -> trap)
    const altCaseFileName =
      fileName.charAt(0) === fileName.charAt(0).toLowerCase()
        ? fileName.charAt(0).toUpperCase() + fileName.slice(1)
        : fileName.charAt(0).toLowerCase() + fileName.slice(1);
    const altCaseUrl = url.replace(fileName, altCaseFileName);
    logger.log(`[loadScript] Map script not found, trying alternate case: ${altCaseUrl}`);

    const altResult = await resourceLoader.loadIni<ScriptData>(
      altCaseUrl,
      (content) => parseScript(content, altCaseUrl.replace(/^\/resources\//, "")),
      "script"
    );
    if (altResult) {
      return altResult;
    }

    // Try common folder
    const commonUrl = ResourcePath.scriptCommon(fileName);
    logger.log(`[loadScript] Map script not found, trying common: ${commonUrl}`);
    const commonResult = await resourceLoader.loadIni<ScriptData>(
      commonUrl,
      (content) => parseScript(content, extractRelativePath(commonUrl)),
      "script"
    );
    if (commonResult) {
      return commonResult;
    }
  }

  logger.error(`Script not found: ${url}`);
  return null;
}
