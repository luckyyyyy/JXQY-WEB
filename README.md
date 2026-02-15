<p align="center">
  <img src="packages/web/public/favicon.svg" width="80" alt="Miu2D Logo" />
</p>

<h1 align="center">Miu2D Engine</h1>

<p align="center">
  <b>A from-scratch 2D RPG engine — raw WebGL, zero game-framework dependencies</b>
</p>

<p align="center">
  <a href="https://miu2d.com">Live Demo</a> · <a href="README_CN.md">中文文档</a>
</p>

---

Miu2D is a **183,000-line** 2D RPG engine written in TypeScript and Rust, rendering through **raw WebGL** with no dependency on Unity, Godot, Phaser, PixiJS, or any other game framework. Every subsystem — sprite batching, A* pathfinding, binary format decoders, scripting VM, weather particles, screen effects — is implemented from first principles.

As a proof of concept, we used Miu2D to rebuild **"Legend of Yue Ying"** (剑侠情缘外传：月影传说), a classic Chinese wuxia RPG originally released by Kingsoft (西山居) in 2001, making the entire game playable in any modern browser.

> **Vibe Coding** — This project is developed with AI-assisted programming from day one.

![Desktop Gameplay](packages/web/public/screenshot/screenshot.png)

<details>
<summary><b>Mobile & Editor Screenshots</b></summary>

**Mobile — virtual joystick + touch controls:**

![Mobile](packages/web/public/screenshot/mobile.png)

**Map Editor — visual tilemap editing, collision zones:**

![Map Editor](packages/web/public/screenshot/map-editor.png)

**ASF Editor — sprite animation frame viewer & debugger:**

![ASF Editor](packages/web/public/screenshot/asf-editor.png)

</details>

---

## Why Build a Game Engine from Scratch?

Most web game projects reach for PixiJS, Phaser, or a WASM-compiled Unity/Godot build. Miu2D takes a different path: the entire rendering pipeline talks directly to `WebGLRenderingContext`, the pathfinder lives in Rust compiled to WASM with zero-copy shared memory, and the scripting engine interprets 182 game commands through a custom parser/executor pair. The result is a system whose every layer is visible, debuggable, and tailored to 2D RPG mechanics.

**What this buys you:**

- **Full control over the render loop** — a `SpriteBatcher` coalesces ~4,800 map tile draws into 1–5 WebGL draw calls; a `RectBatcher` reduces ~300 weather particles to a single call.
- **No abstraction tax** — no unused scene graph, no 3D math overhead, no framework event model to work around.
- **Rust-speed where it matters** — A* pathfinding runs in ~0.2 ms via WASM with obstacle data written directly into linear memory (no serialization, no FFI copy).
- **Clean architecture for study** — a 7-level class hierarchy (Sprite → CharacterBase → Movement → Combat → Character → PlayerBase → PlayerCombat → Player) with clear separation of concerns, ideal for understanding how a full 2D RPG engine works under the hood.

---

## Architecture at a Glance

```
 ┌────────────────────────────────────────────────────────────────┐
 │  React 19 UI Layer (3 themes: Classic / Modern / Mobile)      │
 │  29,070 LOC · 29 Classic + 24 Modern + 7 Mobile components    │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/engine — Pure TypeScript, no React dependency         │
 │  57,210 LOC · 213 source files                                │
 │  ┌──────────┬────────────┬───────────┬──────────────────────┐ │
 │  │ Renderer │  Script VM │ Character │ Magic (22 MoveKinds) │ │
 │  │ WebGL +  │  182 cmds  │ 7-level   │ projectile, AoE,    │ │
 │  │ Canvas2D │  parser +  │ hierarchy │ homing, summon,      │ │
 │  │ fallback │  executor  │ + NPC AI  │ teleport, time-stop  │ │
 │  └──────────┴────────────┴───────────┴──────────────────────┘ │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/engine-wasm — Rust → WebAssembly (2,644 LOC)         │
 │  A* pathfinder · ASF/MPC/MSF decoders · SpatialHash          │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/server — NestJS + tRPC + Drizzle ORM (12,863 LOC)    │
 │  22 PostgreSQL tables · 19 type-safe API routes               │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/dashboard — Full game data editor (33,201 LOC)        │
 │  VS Code-style layout · 12+ editing modules                   │
 └────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.9 (strict) · Rust · GLSL |
| Frontend | React 19 · Vite 7 (rolldown) · Tailwind CSS 4 |
| Rendering | Raw WebGL API (Canvas 2D fallback) |
| Audio | Web Audio API (OGG Vorbis) |
| Performance | Rust → WebAssembly (wasm-bindgen, zero-copy) |
| Backend | NestJS (ESM) · tRPC · Drizzle ORM |
| Database | PostgreSQL 16 · MinIO / S3 |
| Quality | Biome (lint + format) · TypeScript strict mode |
| Monorepo | pnpm workspaces (11 packages) |

---

## Engine Deep Dive

### Renderer — Raw WebGL with Automatic Batching

The renderer is **674 lines** of direct `WebGLRenderingContext` calls — no wrapper library.

- **SpriteBatcher** — accumulates vertex data and flushes per texture change; typical map frame: ~4,800 tiles → 1–5 draw calls
- **RectBatcher** — weather particles and UI rectangles batched into a single draw call
- **GPU texture management** — `ImageData` → `WebGLTexture` with `WeakMap` caching and `FinalizationRegistry` for automatic GPU resource cleanup
- **GLSL color filters** — grayscale (petrification), blue tint (frozen), green tint (poison) applied per-sprite in the fragment shader
- **Screen effects** — fade in/out, color overlays, screen flash, water ripple, all composited in the render loop
- **Canvas 2D fallback** — same `Renderer` interface, full feature parity for devices without WebGL

### Script Engine — 182 Commands

A custom **parser** tokenizes game script files; an **executor** interprets them with blocking/async support. Commands span 9 categories:

| Category | Examples |
|----------|---------|
| Dialog | `Say`, `Talk`, `Choose`, `ChooseMultiple`, `DisplayMessage` |
| Player | `AddLife`, `AddMana`, `SetPlayerPos`, `PlayerGoto`, `Equip` |
| NPC | `AddNpc`, `DelNpc`, `SetNpcRelation`, `NpcAttack`, `MergeNpc` |
| Game State | `LoadMap`, `Assign`, `If/Goto`, `RunScript`, `RunParallelScript` |
| Audio | `PlayMusic`, `StopMusic`, `PlaySound` |
| Effects | `FadeIn`, `FadeOut`, `BeginRain`, `ShowSnow`, `OpenWaterEffect` |
| Objects | `AddObj`, `DelObj`, `OpenObj`, `SetObjScript` |
| Items | `AddGoods`, `DelGoods`, `ClearGoods`, `AddRandGoods` |
| Misc | `Sleep`, `Watch`, `PlayMovie`, `DisableInput`, `ReturnToTitle` |

Scripts drive the entire game narrative — cutscenes, branching dialogs, NPC spawning, map transitions, combat triggers, and weather changes.

### Magic System — 22 Movement Types × 9 Special Effects

Every magic attack follows one of **22 MoveKind** trajectories, each with its own physics and rendering:

| Movement | Behavior |
|----------|----------|
| LineMove | Multi-projectile line — count scales with level |
| CircleMove | Orbital ring pattern |
| SpiralMove | Expanding spiral outward |
| SectorMove | Fan-shaped spread |
| HeartMove | Heart-shaped flight path |
| FollowEnemy | Homing missile tracking |
| Throw | Parabolic arc projectile |
| Transport | Teleportation |
| Summon | Spawn allied NPC |
| TimeStop | Freeze all entities |
| VMove | V-shaped diverging spread |
| *...and 11 more* | |

Combined with **9 SpecialKind** status effects (freeze, poison, petrify, invisibility, heal, transform…), this produces hundreds of unique spell combinations. The system includes 4 specialized sprite factories, a collision handler, and a passive effect manager.

### Pathfinding — Rust WASM, Zero-Copy Memory

The A* pathfinder is **1,144 lines of Rust**, compiled to WebAssembly. It eliminates all FFI overhead through shared linear memory:

1. JavaScript writes obstacle bitmaps directly into WASM linear memory via `Uint8Array` views on `wasm.memory.buffer`
2. WASM executes A* in-place on shared memory
3. JavaScript reads path results via `Int32Array` pointer views — **zero serialization, zero copying**

Five path strategies (from greedy to full A* with configurable max iterations) let the game trade accuracy for speed. Typical pathfind: **~0.2 ms**, roughly **10× faster** than the equivalent TypeScript implementation.

### Binary Format Decoders

The engine parses **8 binary file formats** from the original game — all reverse-engineered and implemented without third-party parsing libraries:

| Format | Description |
|--------|------------|
| **ASF** | Sprite animation frames (RLE-compressed, palette-indexed RGBA) |
| **MPC** | Resource pack container (bundled sprite sheets) |
| **MAP** | Tile map data (multiple layers, obstacle grid, trap zones) |
| **SHD** | Shadow / height map data for terrain |
| **XNB** | XNA Binary format (audio assets from the original game) |
| **MSF** | Miu Sprite Format v2 — custom indexed-palette + zstd compression |
| **MMF** | Miu Map Format — custom zstd-compressed binary map data |
| **INI/OBJ** | Config files in GBK (Chinese legacy encoding) and UTF-8 |

### Weather System — Particle-Driven

**1,491 LOC** of particle physics and rendering:

- **Rain** — wind-affected particles with splash on contact, periodic lightning flash illuminating the scene
- **Screen droplets** — simulated refraction/lens effect of water running down the camera
- **Snow** — individual snowflake physics with wobble, spin, drift, and gradual melt

### Character System — 7-Level Inheritance

A deep, well-structured class hierarchy with clear separation of concerns:

```
Sprite (615 LOC)
 └─ CharacterBase (961) — stats, properties, status flags
     └─ CharacterMovement (1,057) — A* pathfinding, tile walking, bezier curves
         └─ CharacterCombat (780) — attack, damage calc, status effects
             └─ Character (980) — shared NPC/Player logic [abstract]
                 ├─ PlayerBase → PlayerCombat → Player (2,698 combined)
                 └─ Npc (658) — AI behavior, interaction scripts, spatial grid
```

---

## Game Data Editor (Dashboard)

The project includes a **33,201-line** VS Code-style game editor with Activity Bar, Sidebar, and Content panels:

| Module | What it edits |
|--------|---------------|
| Magic Editor | Spell config with live ASF sprite preview |
| NPC Editor | Stats, scripts, AI behavior, sprite preview |
| Scene Editor | Map data, spawn points, traps, triggers |
| Item Editor | Weapons, armor, consumables, drop tables |
| Shop Editor | Store inventories and pricing |
| Dialog Editor | Branching conversation trees + portrait assignment |
| Player Editor | Starting stats, equipment, skill slots |
| Level Editor | Experience curves and stat growth |
| File Manager | Full file tree with drag-and-drop upload |
| Statistics | Data overview dashboard |

---

## Project Structure

11 packages in a pnpm monorepo, **~183,000 lines** total:

| Package | LOC | Role |
|---------|----:|------|
| `@miu2d/engine` | 57,210 | Pure TS game engine (no React dependency) |
| `@miu2d/dashboard` | 33,201 | VS Code-style game data editor |
| `@miu2d/game` | 29,070 | Game runtime with 3 UI themes (classic/modern/mobile) |
| `@miu2d/server` | 12,863 | NestJS + tRPC backend (22 tables, 19 routes) |
| `@miu2d/types` | 5,990 | Shared Zod schemas (18 domain modules) |
| `@miu2d/web` | 4,874 | App shell, routing, landing page |
| `@miu2d/converter` | 3,952 | Rust CLI: ASF/MPC → MSF, MAP → MMF batch conversion |
| `@miu2d/viewer` | 3,104 | Resource viewers (ASF/Map/MPC/Audio) |
| `@miu2d/engine-wasm` | 2,644 | Rust → WASM performance modules |
| `@miu2d/ui` | 1,153 | Generic UI components (no business deps) |
| `@miu2d/shared` | 999 | i18n, tRPC client, React contexts |

Also included: `resources/` (game assets), `docs/` (format specs).

---

## Quick Start

**Requirements:** Node.js 18+, pnpm 9+, modern browser with WebGL

```bash
git clone https://github.com/patchoulib/game-jxqy.git
cd game-jxqy
pnpm install
pnpm dev            # → http://localhost:5173
```

### Full Stack (with backend + database)

```bash
make init           # Docker: PostgreSQL + MinIO, migrate, seed
make dev            # web + server + db studio concurrently
```

### Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Frontend dev server (port 5173) |
| `make dev` | Full-stack dev (web + server + db) |
| `pnpm tsc` | Type check all packages |
| `pnpm lint` | Biome lint |
| `make convert` | Batch convert game resources |
| `make convert-verify` | Pixel-perfect conversion verification |

---

## Controls

| Input | Action |
|-------|--------|
| Arrow keys / Click | Move |
| Shift + Move | Run |
| Space / Enter | Interact / Confirm |
| Esc | Cancel / System menu |
| 1–9 | Quick-bar skills |
| **Mobile**: Virtual joystick | Move |
| **Mobile**: Tap | Interact |

---

## Contributing

1. Fork → feature branch → reference the [dev guide](.github/copilot-instructions.md) → PR
2. Run `make tsc` and `pnpm lint` before submitting

---

## Credits

- **Original Game**: Kingsoft (西山居) — *剑侠情缘外传：月影传说* (2001)

> This is a fan-made learning project. Game assets and IP belong to their original creators.

---

<div align="center">

**⚔️ Sword spirit spans thirty thousand miles ⚔️**

*Recreating classic wuxia with modern web technology*

</div>
