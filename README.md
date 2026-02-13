# Miu2D Engine

A 2D RPG game engine built with modern Web technologies.

[🇨🇳 中文文档](README_CN.md)

## 📖 About

**Miu2D** is a 2D RPG game engine built with **TypeScript + React + WebGL**, designed for the Web platform.

> 🔧 **Zero Engine Dependencies, Pure Native Implementation** — No Unity, no Godot, no Phaser, no PixiJS. The entire rendering pipeline is built from scratch with **raw WebGL API**, delivering native-level performance directly in the browser.

> ⚡ **WebGL High-Performance Rendering** — Custom WebGL renderer with sprite batching, texture atlasing, and GPU-accelerated compositing. Canvas 2D fallback for maximum compatibility.

### 🎮 Demo: Legend of Yue Ying (月影传说) Web Remake

🌐 **Live Demo**: [https://miu2d.com](https://miu2d.com)

As a showcase for the engine, we remade the classic RPG "Moonlight Legend" (剑侠情缘外传：月影传说) originally released by **Kingsoft (西山居) in 2001**.

The original game was developed in C++, later remade by fans using C# + XNA framework ([JxqyHD](https://github.com/mapic91/JxqyHD)). This project ports the game to the Web platform, allowing the classic game to run in browsers.

> 🎨 **Vibe Coding Project** - This project is developed using pure vibe coding with AI-assisted programming!

> 📱 **Native Mobile Support** - Fully adapted for phones and tablets with virtual joystick and touch controls!

### 🖥️ Desktop

![Game Screenshot](packages/web/public/screenshot/screenshot.png)

### 📱 Mobile

![Mobile Screenshot](packages/web/public/screenshot/mobile.png)

### 🛠️ Built-in Editors

**Map Editor** - Visual tilemap editing, layer management, collision zones

![Map Editor](packages/web/public/screenshot/map-editor.png)

**ASF Editor** - Sprite animation frame viewer and debugger

![ASF Editor](packages/web/public/screenshot/asf-editor.png)

### 🎮 Game Features

- 🗺️ **Wuxia World Exploration** - Classic scenes like Lingjue Peak, Wudang Mountain, Hui'an Town
- ⚔️ **Real-time Combat** - Combination of sword techniques, internal skills, and light skills
- 🧙 **Martial Arts** - Rich variety of martial arts moves and internal techniques
- 💬 **Story Quests** - Follow protagonist Yang Yingfeng on a wuxia adventure
- 🎒 **Equipment System** - Collect equipment and items to boost power
- 🎵 **Original Music** - Classic soundtrack and sound effects preserved

---

## ✨ Demo Progress

### Overall Completion: ~92%

| System | Progress | Status | Main Modules |
|--------|----------|--------|--------------|
| Map Rendering | 95% | 🟢 Ready | map.ts, renderer.ts, mapTrapManager.ts |
| Character System | 90% | 🟢 Ready | character.ts, player.ts, npc.ts |
| Sprite Animation | 95% | 🟢 Ready | sprite.ts, asf.ts |
| Script System | 98% | 🟢 Ready | parser.ts, executor.ts, **180+ commands** |
| UI System | 95% | 🟢 Ready | guiManager.ts, **29 UI components** |
| Audio System | 95% | 🟢 Ready | audioManager.ts (Web Audio API) |
| Magic System | 90% | 🟢 Ready | magicManager.ts, **12 MoveKind effects** |
| Combat System | 70% | 🟡 Partial | magicHandler.ts |
| Save System | 90% | 🟢 Ready | loader.ts, storage.ts |
| Weather System | 85% | 🟢 Ready | rain.ts, snow.ts |
| Mobile Adaptation | 95% | 🟢 Ready | Virtual joystick, touch controls |

**Legend**: 🟢 Ready | 🟡 Partial/In Progress | 🔴 Not Started

### Codebase Size
- **Engine Code**: ~47,000 lines TypeScript
- **Component Code**: ~12,000 lines TSX
- **Script Commands**: 180+ command handlers

---

## 🏗️ Architecture

### Tech Stack

- **Language**: TypeScript 5.9 (strict mode)
- **Framework**: React 19, Vite 7
- **Rendering**: WebGL (with Canvas 2D fallback)
- **Styling**: Tailwind CSS 4
- **Audio**: Web Audio API (OGG Vorbis)
- **Code Quality**: Biome (lint + format)
- **Package Manager**: pnpm monorepo

### Project Structure

This project uses **pnpm monorepo** architecture:

| Package | Directory | Description |
|---------|-----------|-------------|
| **@miu2d/engine** | `packages/engine/` | Pure TypeScript 2D RPG engine, **no React dependency** |
| **@miu2d/engine-wasm** | `packages/engine-wasm/` | Rust + WebAssembly high-performance modules |
| **@miu2d/ui** | `packages/ui/` | Generic UI components (no business logic) |
| **@miu2d/viewer** | `packages/viewer/` | Resource viewers (ASF/Map/MPC/XnbAudio) |
| **@miu2d/web** | `packages/web/` | React application with UI and user interaction |
| **@miu2d/server** | `packages/server/` | NestJS backend with tRPC API |
| **@miu2d/types** | `packages/types/` | Shared Zod schemas and TypeScript types |
| **@miu2d/i18n** | `packages/i18n/` | Internationalization resources |
| **@miu2d/converter** | `packages/converter/` | Rust CLI toolkit: ASF/MPC → MSF, MAP → MMF |

**Import engine modules:**
```typescript
// From main entry
import { GameEngine, Direction } from "@miu2d/engine";

// From submodules
import { logger } from "@miu2d/engine/core/logger";
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";
```

---

## 🚀 Quick Start

### Requirements

- **Node.js** 18+
- **pnpm** 9+ (required)
- Modern browser with WebGL and Web Audio API support

### Installation

```bash
# Clone the repository
git clone https://github.com/patchoulib/game-jxqy.git
cd game-jxqy

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open browser at http://localhost:5173
```

### Commands

```bash
pnpm dev        # Start development server
pnpm build      # Build for production
pnpm tsc        # TypeScript type check
pnpm lint       # Code linting
pnpm format     # Code formatting
make convert    # One-shot resource conversion (ASF/MPC/MAP/etc.)
make convert-verify  # Pixel-perfect verification for ASF/MPC
```

---

## 🎮 Controls

### Keyboard

| Key | Action |
|-----|--------|
| `Arrow Keys` / Click ground | Move |
| `Shift` + Move | Run |
| `Space` / `Enter` | Interact / Confirm |
| `Esc` | Cancel / System menu |
| `1` - `9` | Use quick bar skills |

### 📱 Mobile Touch

| Action | Function |
|--------|----------|
| Virtual joystick (bottom-left) | Control movement |
| Tap screen | Interact with NPC/Object |
| Bottom quick bar | Use skills |
| Right side buttons | Open menus |

---

## 💻 Development

### Principles

1. **Follow C# Architecture** - Reference `/JxqyHD/Engine/` implementation
2. **Access via Engine** - All subsystems accessed through `GameEngine`
3. **Type Safety** - Use TypeScript strict mode, avoid `any`
4. **Event-Driven** - Engine and UI communicate via events

For detailed development guide, see [.github/copilot-instructions.md](.github/copilot-instructions.md)

---

## 🤝 Contributing

Bug fixes, new features, and documentation improvements are welcome!

1. Fork this repository
2. Create a feature branch
3. Reference the [Development Guide](.github/copilot-instructions.md)
4. Submit a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

**Note**: This is a fan-made learning project. Game assets belong to original creators.

---

## 🙏 Credits

- **Original Game**: Kingsoft (西山居) - Legend of Yue Ying (2001)
- **C# Remake**: [mapic91/JxqyHD](https://github.com/mapic91/JxqyHD)
- **Tech Stack**: TypeScript, React 19, Vite 7, WebGL, Web Audio API

---

<div align="center">

**⚔️ Sword spirit spans thirty thousand miles ⚔️**

*Recreating classic wuxia with modern Web technology*

</div>
