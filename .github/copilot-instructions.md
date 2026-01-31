# Copilot Instructions for Vibe2D Engine

## 项目概述

**Vibe2D Engine** - 基于 Web 技术的现代 2D RPG 游戏引擎，源自《剑侠情缘外传：月影传说》复刻项目。

> 🎨 **Vibe Coding Project** - 本项目采用纯 vibe coding 方式开发，借助 AI 辅助编程，享受编码的乐趣！

- **原版游戏**：西山居 C++ 开发（2001）
- **C# 复刻**：[JxqyHD](https://github.com/mapic91/JxqyHD) - XNA Framework
- **Web 版本**：TypeScript + React 19 + Canvas API
- **主角**：杨影枫

### 技术栈
- **语言**: TypeScript 5.9 (strict mode)
- **框架**: React 19, Vite 7
- **渲染**: HTML5 Canvas 2D
- **样式**: Tailwind CSS 4
- **代码质量**: Biome (lint + format)

### 项目组成

本项目包含两个主要部分，开发时请注意区分：

| 部分 | 目录 | 说明 |
|------|------|------|
| **游戏引擎** | `src/engine/` | 纯 TypeScript 实现的 2D RPG 引擎，**不依赖 React**，可独立使用 |
| **网站应用** | `src/components/`, `src/pages/` | React 应用，提供 UI 界面、页面路由和用户交互 |

> ⚠️ **重要**：`src/engine/` 下的代码禁止导入 React 相关模块，保持引擎的独立性

---

## 架构说明

### 核心系统（`/src/engine/`）

本项目严格遵循 C# 版本的架构设计：

**Core** (`core/`)
- `engine.ts`, `engineContext.ts` - 引擎核心接口（IEngineContext，避免循环依赖）
- `types.ts`, `mapTypes.ts` - 核心类型定义
- `pathFinder.ts` - A* 寻路算法
- `eventEmitter.ts`, `gameEvents.ts` - 事件系统
- `logger.ts` - 日志系统
- `utils.ts`, `binaryUtils.ts` - 工具函数

**GameManager** (`game/gameManager.ts`) - 中央控制器
- 对应 C# 的 `JxqyGame.cs`
- 协调所有子系统
- 管理游戏状态和循环

**Character System** (`character/`)
- `character.ts` ← `Character.cs` - 角色基类
- `npc.ts` ← `Npc.cs`
- `npcManager.ts` ← `NpcManager.cs`
- `iniParser.ts` - INI 配置解析
- `resFile.ts` - 资源文件解析
- `level/` - 等级系统

**Script System** (`script/`)
- `parser.ts` - 剧本解析
- `executor.ts` - 剧本执行
- `commands/` - 命令处理器（模块化）
  - `dialogCommands.ts`, `npcCommands.ts`, `playerCommands.ts`, `gameStateCommands.ts`, `miscCommands.ts`

**Map & Rendering** (`map/`)
- `map.ts` ← `MapBase.cs`, `JxqyMap.cs`
- `renderer.ts` - 地图渲染
- `mapTrapManager.ts` - 地图陷阱

**Sprite System** (`sprite/`)
- `sprite.ts` ← `Sprite.cs`
- `asf.ts` ← `Asf.cs` - 精灵加载

**Resource System** (`resource/`)
- `resourceLoader.ts` - 统一资源加载器（缓存+去重）
- `mpc.ts` ← `Mpc.cs` - 资源包解析

**Magic System** (`magic/`)
- `magicManager.ts` ← `MagicManager.cs` - 武功逻辑
- `magicSprite.ts` ← `MagicSprite.cs` - 武功精灵
- `magicRenderer.ts` - 武功渲染
- `magicLoader.ts` - 武功配置加载
- `magicUtils.ts` - 工具函数
- `types.ts` - 类型定义
- `effects/` - 武功特效（normalAttack, throw, followCharacter, followEnemy, fixedPosition, regionBased, specialMoveKinds, superMode 等）
- `passives/` - 被动效果（xiuLianEffect 等）

**Player System** (`player/`)
- `player.ts` ← `Player.cs` - 玩家
- `goods/` - 物品系统
  - `good.ts` ← `Good.cs` - 物品
  - `goodsListManager.ts` - 物品列表管理
- `magic/magicListManager.ts` - 玩家武功列表

**GUI System** (`gui/`)
- `guiManager.ts` ← `GuiManager.cs`
- `uiSettings.ts`, `uiConfig.ts` - UI 配置
- 对应 C# 的 `DialogGui.cs`, `TopGui.cs` 等

**Game System** (`game/`)
- `gameEngine.ts` - 引擎单例入口
- `gameManager.ts` ← `JxqyGame.cs`
- `inputHandler.ts`, `interactionManager.ts` - 输入处理
- `magicHandler.ts`, `specialActionHandler.ts` - 战斗处理
- `cameraController.ts`, `collisionChecker.ts` - 镜头和碰撞
- `mapTrapManager.ts` - 地图陷阱管理
- `scriptContextFactory.ts` - 剧本上下文工厂
- `loader.ts`, `storage.ts` - 存档系统

**其他系统**
- `audio/` - 音效管理 (Web Audio API)
- `effects/` - 屏幕特效
- `obj/` - 物体系统
- `timer/` - 游戏计时器
- `weather/` - 天气系统
- `listManager/` - 数据列表管理（memoListManager, talkTextList, partnerList）
- `debug/` - 调试系统
- `utils/` - 通用工具函数

### React 组件层（`/src/components/`）

**通用组件** (`common/`)
- `GridBackground.tsx` - 网格背景

**游戏核心** (`game/`)
- `Game.tsx` - 游戏主组件
- `GameCanvas.tsx` - Canvas 渲染
- `GameUI.tsx` - UI 层
- `LoadingOverlay.tsx` - 加载遮罩
- `MapViewer.tsx` - 地图查看器（开发工具）

**UI 组件** (`game/ui/`)
- 对话: `DialogUI.tsx`, `SelectionUI.tsx`, `SelectionMultipleUI.tsx`, `MessageGui.tsx`
- 状态: `TopGui.tsx`, `BottomGui.tsx`, `StateGui.tsx`, `BottomStateGui.tsx`
- 功能: `GoodsGui.tsx`, `EquipGui.tsx`, `NpcEquipGui.tsx`, `MagicGui.tsx`, `MemoGui.tsx`, `XiuLianGui.tsx`, `BuyGui.tsx`, `LittleMapGui.tsx`
- 系统: `SystemGui.tsx`, `TitleGui.tsx`, `TitleSettingsModal.tsx`, `TimerGui.tsx`, `SaveLoadGui.tsx`
- 辅助: `GameCursor.tsx`, `NpcLifeBar.tsx`, `ItemTooltip.tsx`, `MagicTooltip.tsx`, `ScrollBar.tsx`, `AsfAnimatedSprite.tsx`, `SidePanel.tsx`
- 调试: `DebugPanel/`（DebugPanel.tsx, Section.tsx, DataRow.tsx, ScriptCodeView.tsx, sections/）

---

## 已有系统

> ⚠️ 以下系统均已实现基础功能，但不一定完善，开发时请参考 C# 版本补充细节。

| 系统 | 主要模块 | 说明 |
|------|----------|------|
| 地图系统 | `map/` | 多层渲染、碰撞检测、MPC加载、陷阱 |
| 角色系统 | `character/` | 玩家、NPC、移动、动画、INI解析 |
| 剧本系统 | `script/` | 解析、执行、命令模块化 |
| 界面系统 | `gui/`, `components/game/ui/` | 28+ UI 组件 |
| 输入系统 | `game/inputHandler.ts` | 键盘/鼠标/交互管理 |
| 音效系统 | `audio/` | 背景音乐、音效 (Web Audio API) |
| 特效系统 | `effects/` | 屏幕特效、淡入淡出 |
| 物体系统 | `obj/` | 加载/渲染/交互 |
| 物品系统 | `player/goods/` | 物品管理、物品列表 |
| 武功系统 | `magic/` | 主动技能、被动效果、特效系统 |
| 存档系统 | `game/loader.ts`, `storage.ts` | 存档加载和保存 |
| 调试系统 | `debug/` | 调试管理、调试面板 |
| 寻路系统 | `core/pathFinder.ts` | A* 算法 |
| 战斗系统 | `game/magicHandler.ts` | 战斗逻辑处理 |
| 等级系统 | `character/level/` | 经验值、等级计算 |
| 日志系统 | `core/logger.ts` | 美化日志输出 |
| 商店系统 | `gui/buyManager.ts` | 商店购买/出售 |
| 伙伴系统 | `listManager/partnerList.ts` | 伙伴名单管理 |

---

## 开发指南

### 核心原则

1. **参考 C# 实现** - 功能实现前，先阅读 `/JxqyHD/Engine/` 中的对应 C# 代码，确保核心逻辑一致
2. **类型安全优先** - 使用 TypeScript strict mode，**禁止使用 `any`**，使用 `unknown` + 类型守卫
3. **不可变数据** - React 状态更新使用展开运算符或 immer
4. **统一类型定义** - 从 `core/types.ts` 导入 enums 和接口
5. **持续类型检查** - 每次修改后运行 `pnpm tsc` 确保无错误
6. **使用 IEngineContext** - Sprite 子类通过 `this.engine` 访问引擎服务
7. **禁止兼容层代码** - 不保留废弃 API、不写 polyfill、不做向后兼容

### 禁止事项（零容忍）

```typescript
// ❌ 禁止：使用 any
function process(data: any) { ... }

// ✅ 正确：使用 unknown + 类型守卫
function process(data: unknown) {
  if (isValidData(data)) { ... }
}

// ❌ 禁止：保留废弃代码
/** @deprecated 使用 newMethod */
oldMethod() { return this.newMethod(); }

// ✅ 正确：直接删除废弃代码，只保留最新实现

// ❌ 禁止：兼容层/适配器模式（除非有充分理由）
class LegacyAdapter { ... }

// ❌ 禁止：可选链滥用隐藏 null 问题
const name = obj?.prop?.value ?? "default";

// ✅ 正确：明确处理 null 情况
if (!obj || !obj.prop) {
  throw new Error("Missing required property");
}
const name = obj.prop.value;
```

### IEngineContext 架构模式

Sprite 及其子类通过统一的 `IEngineContext` 接口访问引擎服务：

```typescript
// ✅ 正确：使用 IEngineContext
class Obj extends Sprite {
  async startInteract(isRight: boolean) {
    if (!this.engine) {
      throw new Error("Engine context not initialized");
    }
    const scriptPath = this.engine.getScriptBasePath() + "/" + this.scriptFile;
    await this.engine.runScript(scriptPath);
  }
}
```

**主要接口方法**：
- `getPlayer()` - 获取玩家实例
- `getNpcManager()` - 获取 NPC 管理器
- `getCollisionChecker()` - 获取碰撞检测器
- `runScript(path)` - 运行脚本
- `getScriptBasePath()` - 获取脚本基础路径
- `hasTrapScript(tile)` - 检查瓦片是否有陷阱脚本

### TypeScript 类型检查（必须）

**每次修改代码后必须运行：**

```bash
pnpm tsc
```

**不要提交有 TypeScript 错误的代码！**

### 添加新功能的标准流程

```typescript
// 1. 参考 C# 对应文件
// 例如：实现武功系统 → 查看 Magic.cs, MagicManager.cs

// 2. 在 core/types.ts 定义接口（使用 readonly 保护数据）
export interface MagicData {
  readonly name: string;
  readonly level: number;
  readonly manaCost: number;
}

// 3. 实现管理器类（使用私有字段 + 只读访问）
export class MagicManager {
  private readonly magicList = new Map<string, MagicData>();

  getMagic(name: string): MagicData | undefined {
    return this.magicList.get(name);
  }
}

// 4. 集成到 GameManager
private readonly magicManager: MagicManager;

// 5. 添加 React UI（如需要）
// src/components/ui/MagicUI.tsx
```

### 剧本系统集成

剧本是游戏逻辑的核心。添加新剧本命令：

```typescript
// 1. 在 executor.ts 添加命令
case 'NewCommand': {
  const [param1, param2] = this.parseParams(params);
  this.context.newCommandHandler(param1, param2);
  break;
}

// 2. 在 gameManager.ts 添加处理器
private createScriptContext(): ScriptContext {
  return {
    newCommandHandler: (p1, p2) => {
      // 实现逻辑
    },
  };
}
```

---

## 资源文件说明

| 格式 | 用途 | 编码 | 位置 |
|------|------|------|------|
| `.map` | 地图数据（瓦片、碰撞） | 二进制 | `/resources/map/` |
| `.asf` | 精灵动画帧 | 二进制 | `/resources/asf/` |
| `.mpc` | 压缩资源包 | 二进制 | `/resources/mpc/` |
| `.obj` | 物体存档文件 | GBK | `/resources/ini/save/` |
| `.npc` | NPC 存档文件 | UTF-8 | `/resources/ini/save/` |
| `.ini` | 配置（NPC、物体、物品） | UTF-8 | `/resources/ini/` |
| `.txt` | 游戏剧本 | UTF-8 | `/resources/script/` |

> 💡 **提示**：二进制格式（`.map`, `.asf`, `.mpc`）结构都很简单，可以用命令行工具分析：
> ```bash
> # 查看文件头部 hex
> xxd -l 128 resources/map/xxx.map
> hexdump -C -n 128 resources/asf/xxx.asf
>
> # 或使用 od 命令
> od -A x -t x1z -v resources/mpc/xxx.mpc | head -20
> ```

---

## 资源加载规范

**所有资源加载都必须通过 `resourceLoader` 统一管理**，不要直接使用 `fetch()`。

```typescript
import { resourceLoader } from "../resource/resourceLoader";

// ✅ 正确：使用 resourceLoader
const content = await resourceLoader.loadText("/resources/script/xxx.txt");
const buffer = await resourceLoader.loadBinary("/resources/map/xxx.map");

// ❌ 错误：直接使用 fetch
const response = await fetch("/resources/script/xxx.txt");
```

### 加载方法选择

| 方法 | 用途 | 返回类型 |
|------|------|----------|
| `loadText(path)` | UTF-8 文本文件 (.txt, .ini, .npc) | `string \| null` |
| `loadBinary(path)` | 二进制文件 (.map, .asf, .mpc, .obj, 音频) | `ArrayBuffer \| null` |

### GBK 编码处理

`.obj` 文件仍然是 GBK 编码，需要手动解码：

```typescript
// .obj 文件加载示例
const buffer = await resourceLoader.loadBinary(filePath);
if (buffer) {
  const decoder = new TextDecoder("gbk");
  const content = decoder.decode(buffer);
  // 解析 content...
}
```

### 缓存和去重

resourceLoader 自动处理：
- **缓存**：每个资源只加载一次
- **去重**：并发请求同一资源时，只发起一次网络请求
- **统计**：调试面板显示加载统计（命中率、失败次数等）

### Canvas 渲染

**渲染顺序**：地图地面层 → 地图物体层 → NPCs → 玩家 → 物体 → 特效 → UI

**坐标系统**：
- **瓦片坐标** - 游戏逻辑 (x: 10, y: 15)
- **像素坐标** - 渲染 (tileToPixel)
- **屏幕坐标** - 相对镜头 (screenX = pixelX - camera.x)

### 日志系统

**使用统一的日志系统**，不要直接使用 `console.log`：

```typescript
import { logger } from "../core/logger";

// ✅ 正确：使用 logger
logger.debug("[Map] 加载地图", mapName);
logger.info("[Player] 初始化完成");
logger.warn("[Script] 未知命令", command);
logger.error("[Resource] 加载失败", path);

// ❌ 错误：直接使用 console
console.log("加载地图", mapName);
```

**日志级别**：
- `debug` - 调试信息（灰色）
- `info` / `log` - 一般信息（蓝色）
- `warn` - 警告（橙色）
- `error` - 错误（红色）

⚠️ **注意**：避免在 update loop 中打印日志，会影响性能

---

## 代码规范

### 命名约定
- 类: `PascalCase` (GameManager)
- 函数: `camelCase` (loadMap)
- 常量: `UPPER_SNAKE_CASE` (TILE_WIDTH)
- 接口: `PascalCase` (CharacterData)
- 文件: TS用 `camelCase.ts`, React用 `PascalCase.tsx`
- **禁止**：属性名使用 `_` 下划线前缀（除非是必须隐藏的私有字段且有对应的 getter/setter 逻辑）

### 类属性规范
- **禁止无意义的 getter/setter**：如果只是简单返回或设置值，直接使用公共属性
- **只在需要时使用 getter**：
  - ✅ 计算属性（如 `get isBodyIniOk()` 需要检查多个条件）
  - ✅ 有副作用的 setter（如设置值时需要触发其他逻辑）
  - ❌ 简单的值存取（直接用 `public` 属性）

```typescript
// ❌ 错误：无意义的 getter/setter
protected _name: string = "";
get name(): string { return this._name; }
set name(value: string) { this._name = value; }

// ✅ 正确：直接使用公共属性
name: string = "";

// ✅ 正确：有逻辑的计算属性
get isBodyIniOk(): boolean {
  return this.bodyIniObj !== null && this.bodyIniObj.objFile.size > 0;
}
```

### 错误处理规范

```typescript
// ❌ 错误：静默忽略错误
try {
  await loadResource();
} catch {
  // 什么都不做
}

// ✅ 正确：明确处理或向上抛出
try {
  await loadResource();
} catch (error) {
  logger.error("[Resource] 加载失败", error);
  throw error; // 或返回明确的错误状态
}

// ❌ 错误：返回 null 隐藏问题
function getPlayer(): Player | null {
  return this._player; // 调用方容易忘记检查
}

// ✅ 正确：明确的错误或断言
function getPlayer(): Player {
  if (!this._player) {
    throw new Error("Player not initialized");
  }
  return this._player;
}
```

### 注释规范
- **禁止**：`// C#: xxx` 这类照搬 C# 的注释
- **推荐**：用中文解释复杂的游戏逻辑
- **推荐**：说明与 C# 版本的重要差异（用自然语言，不是 C# 代码）

---

## 常见任务

### 添加新地图
1. 放置 `.map` 文件到 `/resources/map/`
2. 放置 MPC 文件到 `/resources/mpc/`
3. 在 `App.tsx` 添加到地图列表

### 添加 NPC
1. 创建 `.ini` 文件在 `/resources/ini/npc/`
2. 参考现有 NPC 格式
3. 通过地图或剧本加载

### 添加剧本命令
1. 在 `executor.ts` 添加 case
2. 在 `gameManager.ts` 添加处理器
3. 用现有剧本测试

### 添加 GUI 组件
1. 创建 React 组件在 `/src/components/ui/`
2. 在 `GuiManager` 中管理状态
3. 连接显示/隐藏逻辑

---

## 参考资料

- C# 版本：[mapic91/JxqyHD](https://github.com/mapic91/JxqyHD)