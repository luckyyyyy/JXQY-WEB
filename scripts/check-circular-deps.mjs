#!/usr/bin/env node
/**
 * Detect circular dependencies in the engine package.
 * Builds a module-level import graph and finds all cycles.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const ENGINE_SRC = resolve("packages/engine/src");

// Collect all .ts files
function collectFiles(dir) {
  const result = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      result.push(...collectFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      result.push(full);
    }
  }
  return result;
}

// Resolve an import path to an absolute file path
function resolveImport(sourceFile, importPath) {
  if (!importPath.startsWith(".")) return null;
  const dir = dirname(sourceFile);
  const resolved = resolve(dir, importPath);

  // Try: exact.ts, /index.ts
  if (existsSync(resolved + ".ts")) return resolved + ".ts";
  if (existsSync(resolved + "/index.ts")) return resolved + "/index.ts";
  if (existsSync(resolved) && statSync(resolved).isFile()) return resolved;
  return null;
}

// Extract imports from a file
function getImports(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const imports = [];
  // Match: import ... from "..."  and  export ... from "..."
  const regex = /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath.startsWith(".")) continue;

    // Check if this is a type-only import (won't cause runtime circular dep)
    const stmt = match[0];
    const isTypeOnly = /^(?:import|export)\s+type\s/.test(stmt);

    const resolved = resolveImport(filePath, importPath);
    if (resolved) {
      imports.push({ target: resolved, isTypeOnly, raw: importPath });
    }
  }
  return imports;
}

// Get module (directory) for a file
function getModule(filePath) {
  const rel = relative(ENGINE_SRC, filePath);
  const parts = rel.split("/");
  if (parts.length === 1) return "."; // root files
  return parts[0]; // top-level module
}

// Build file-level graph (value imports only)
function buildFileGraph(files) {
  const graph = new Map(); // file -> Set<file>
  for (const file of files) {
    const imports = getImports(file);
    const deps = new Set();
    for (const imp of imports) {
      if (!imp.isTypeOnly) {
        deps.add(imp.target);
      }
    }
    graph.set(file, deps);
  }
  return graph;
}

// Find all cycles using DFS
function findCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();
  const stack = [];

  function dfs(node) {
    if (inStack.has(node)) {
      // Found a cycle
      const cycleStart = stack.indexOf(node);
      const cycle = stack.slice(cycleStart).map(f => relative(ENGINE_SRC, f));
      cycles.push(cycle);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const deps = graph.get(node) || new Set();
    for (const dep of deps) {
      if (graph.has(dep)) { // only follow files we know about
        dfs(dep);
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node);
  }

  return cycles;
}

// Deduplicate cycles (same cycle can be found from different starting points)
function deduplicateCycles(cycles) {
  const seen = new Set();
  const unique = [];
  for (const cycle of cycles) {
    // Normalize: rotate to start with smallest element
    const min = cycle.reduce((a, b) => a < b ? a : b);
    const idx = cycle.indexOf(min);
    const normalized = [...cycle.slice(idx), ...cycle.slice(0, idx)].join(" -> ");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(cycle);
    }
  }
  return unique;
}

// Also build module-level graph for overview
function buildModuleGraph(fileGraph) {
  const moduleGraph = new Map(); // module -> Map<module, Set<{from, to}>>
  for (const [file, deps] of fileGraph) {
    const fromModule = getModule(file);
    for (const dep of deps) {
      const toModule = getModule(dep);
      if (fromModule === toModule) continue; // skip intra-module

      if (!moduleGraph.has(fromModule)) moduleGraph.set(fromModule, new Map());
      const targets = moduleGraph.get(fromModule);
      if (!targets.has(toModule)) targets.set(toModule, new Set());
      targets.get(toModule).add(`${relative(ENGINE_SRC, file)} -> ${relative(ENGINE_SRC, dep)}`);
    }
  }
  return moduleGraph;
}

function findModuleCycles(moduleGraph) {
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();
  const stack = [];

  function dfs(node) {
    if (inStack.has(node)) {
      const cycleStart = stack.indexOf(node);
      cycles.push(stack.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    const deps = moduleGraph.get(node);
    if (deps) {
      for (const dep of deps.keys()) {
        dfs(dep);
      }
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of moduleGraph.keys()) {
    dfs(node);
  }

  return deduplicateCycles(cycles);
}

// Main
const files = collectFiles(ENGINE_SRC);
console.log(`Scanning ${files.length} files...\n`);

const fileGraph = buildFileGraph(files);

// Module-level analysis
console.log("=== MODULE-LEVEL CIRCULAR DEPENDENCIES (value imports only) ===\n");
const moduleGraph = buildModuleGraph(fileGraph);
const moduleCycles = findModuleCycles(moduleGraph);

if (moduleCycles.length === 0) {
  console.log("No module-level circular dependencies found!\n");
} else {
  console.log(`Found ${moduleCycles.length} module-level cycle(s):\n`);
  for (const cycle of moduleCycles) {
    console.log(`  ${cycle.join(" -> ")} -> ${cycle[0]}`);
    // Show the actual file-level edges
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      const edges = moduleGraph.get(from)?.get(to);
      if (edges) {
        for (const edge of edges) {
          console.log(`    ${edge}`);
        }
      }
    }
    console.log();
  }
}

// File-level analysis
console.log("=== FILE-LEVEL CIRCULAR DEPENDENCIES (value imports only) ===\n");
const fileCycles = deduplicateCycles(findCycles(fileGraph));

if (fileCycles.length === 0) {
  console.log("No file-level circular dependencies found!\n");
} else {
  console.log(`Found ${fileCycles.length} file-level cycle(s):\n`);
  for (const cycle of fileCycles) {
    console.log(`  ${cycle.join("\n  -> ")}\n  -> ${cycle[0]}\n`);
  }
}

// Barrel import risk analysis
console.log("=== BARREL IMPORT RISK ANALYSIS ===\n");
console.log("Barrel (index.ts) files that import from other top-level modules via VALUE imports:\n");
for (const file of files) {
  if (!file.endsWith("index.ts")) continue;
  const rel = relative(ENGINE_SRC, file);
  const imports = getImports(file);
  const riskyImports = [];
  for (const imp of imports) {
    if (imp.isTypeOnly) continue;
    const targetModule = getModule(imp.target);
    const sourceModule = getModule(file);
    if (targetModule !== sourceModule && targetModule !== ".") {
      riskyImports.push(`${imp.raw} -> ${relative(ENGINE_SRC, imp.target)} (module: ${targetModule})`);
    }
  }
  if (riskyImports.length > 0) {
    console.log(`  ${rel}:`);
    for (const ri of riskyImports) {
      console.log(`    ${ri}`);
    }
  }
}
