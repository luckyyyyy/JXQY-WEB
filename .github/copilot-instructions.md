# Copilot Instructions for Vibe2D Engine

## 项目概述

**Vibe2D Engine** - 基于 Web 技术的 2D RPG 游戏引擎，复刻《剑侠情缘外传：月影传说》。

- **原版**：西山居 C++ (2001)
- **C# 复刻**：[JxqyHD](https://github.com/mapic91/JxqyHD)
- **本项目**：TypeScript + React 19 + Canvas API

### 技术栈
- TypeScript 5.9 (strict mode)
- React 19, Vite 7
- HTML5 Canvas 2D
- Biome (lint + format)

### 项目结构

| 部分 | 目录 | 说明 |
|------|------|------|
| **游戏引擎** | `src/engine/` | 纯 TypeScript，**不依赖 React** |
| **React 应用** | `src/components/` | UI 界面和用户交互 |

---

## IEngineContext 接口

Sprite 及其子类通过 `this.engine` 访问引擎服务：

```typescript
interface IEngineContext {
  // ===== 核心服务（只读属性）=====
  readonly player: IPlayer;           // 玩家实例
  readonly npcManager: INpcManager;   // NPC 管理器
  readonly map: MapBase;              // 地图（障碍检测、陷阱、坐标转换）
  readonly audio: AudioManager;       // 音频管理器

  // ===== 便捷方法 =====
  runScript(path: string): Promise<void>;  // 运行脚本
  queueScript(path: string): void;         // 脚本入队
  getScriptBasePath(): string;             // 脚本基础路径
  getMapName(): string;                    // 当前地图名

  // ===== 低频管理器 =====
  getManager<T>(type: ManagerType): T;
}

// ManagerType: "magic" | "obj" | "gui" | "debug" | "weather" | "buy" | "interaction" | "magicHandler" | "mapRenderer" | "script"
```

**使用示例：**

```typescript
class Obj extends Sprite {
  async interact() {
    // 核心服务直接访问
    const player = this.engine.player;
    const isBlocked = this.engine.map.isObstacleForCharacter(x, y);
    this.engine.audio.playSound("click.wav");

    // 低频管理器通过 getManager
    const gui = this.engine.getManager("gui");
    gui.showDialog("Hello");
  }
}
```

---

## 核心规范

### 必须遵守

1. **禁止 `any`** - 使用 `unknown` + 类型守卫
2. **参考 C# 实现** - 功能实现前先阅读 `/JxqyHD/Engine/` 对应代码
3. **每次修改后运行 `pnpm tsc`** - 不提交有类型错误的代码
4. **使用 `resourceLoader`** - 不直接使用 `fetch()`
5. **使用 `logger`** - 不直接使用 `console.log`

### 禁止事项

```typescript
// ❌ any
function process(data: any) { ... }

// ❌ 保留废弃代码
/** @deprecated */ oldMethod() { ... }

// ❌ 无意义的 getter/setter
private _name = "";
get name() { return this._name; }

// ❌ 静默忽略错误
try { ... } catch { }

// ✅ 正确
function process(data: unknown) { if (isValid(data)) { ... } }
name = "";  // 直接公共属性
try { ... } catch (e) { logger.error(e); throw e; }
```

---

## 资源加载

```typescript
import { resourceLoader } from "../resource/resourceLoader";

// UTF-8 文本
const text = await resourceLoader.loadText("/resources/script/xxx.txt");

// 二进制
const buffer = await resourceLoader.loadBinary("/resources/map/xxx.map");

// GBK 编码文件
const buffer = await resourceLoader.loadBinary(path);
const content = new TextDecoder("gbk").decode(buffer);
```

| 格式 | 用途 | 编码 |
|------|------|------|
| `.map` | 地图数据 | 二进制 |
| `.asf` | 精灵动画 | 二进制 |
| `.mpc` | 资源包 | 二进制 |
| `.obj` | 物体存档 | GBK |
| `.ini`, `.npc`, `.txt` | 配置/脚本 | UTF-8 |

---

## 日志系统

```typescript
import { logger } from "../core/logger";

logger.debug("[Module] 调试信息");
logger.info("[Module] 一般信息");
logger.warn("[Module] 警告");
logger.error("[Module] 错误");
```

⚠️ 避免在 update loop 中打印日志

---

## 命名约定

- 类: `PascalCase`
- 函数/变量: `camelCase`
- 常量: `UPPER_SNAKE_CASE`
- 文件: TS `camelCase.ts`, React `PascalCase.tsx`

---
