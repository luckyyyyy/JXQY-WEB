# Copilot Instructions for JxqyHD Web Remake

## 项目概述

这是**西山居 2001 年**推出的经典 RPG《剑侠情缘外传：月影传说》的 Web 复刻项目。

> 🎨 **Vibe Coding Project** - 本项目采用纯 vibe coding 方式开发，借助 AI 辅助编程，享受编码的乐趣！

- **原版游戏**：C++ 开发（2001）
- **C# 复刻**：[JxqyHD](https://github.com/mapic91/JxqyHD) - XNA Framework
- **Web 版本**：TypeScript + React 19 + Canvas API

### 技术栈
- **语言**: TypeScript 5.9
- **框架**: React 19, Vite 7
- **渲染**: HTML5 Canvas 2D
- **样式**: Tailwind CSS 4

---

## 架构说明

### 核心系统（`/src/engine/`）

本项目严格遵循 C# 版本的架构设计：

**GameManager** (`game/gameManager.ts`) - 中央控制器
- 对应 C# 的 `JxqyGame.cs`
- 协调所有子系统
- 管理游戏状态和循环

**Character System** (`character/`)
- `player.ts` ← `Player.cs`
- `npc.ts` ← `Npc.cs`
- `npcManager.ts` ← `NpcManager.cs`
- `character.ts` ← `Character.cs`
- `iniParser.ts` - INI 配置解析

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
- `globalResourceManager.ts` - 全局资源管理
- `mpc.ts` ← `Mpc.cs` - 资源包解析

**Magic System** (`magic/`)
- `magicManager.ts` ← `MagicManager.cs` - 武功逻辑
- `magicSprite.ts` ← `MagicSprite.cs` - 武功精灵
- `magicRenderer.ts` - 武功渲染
- `effects/` - 武功特效（normalAttack, throw, followCharacter 等）
- `passives/` - 被动效果（xiuLianEffect 等）

**Goods System** (`goods/`)
- `good.ts` ← `Good.cs` - 物品
- `goodsListManager.ts` - 物品列表管理

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
- `loader.ts`, `storage.ts` - 存档系统

**其他系统**
- `audio/audioManager.ts` - 音效管理 (Web Audio API)
- `effects/screenEffects.ts` - 屏幕特效
- `obj/` - 物体系统 (obj.ts, objManager.ts, objRenderer.ts)
- `listManager/` - 数据列表管理
- `level/levelManager.ts` - 等级系统
- `debug/debugManager.ts` - 调试系统

### React 组件层（`/src/components/`）

**游戏核心** (`game/`)
- `Game.tsx` - 游戏主组件
- `GameCanvas.tsx` - Canvas 渲染
- `GameUI.tsx` - UI 层
- `LoadingOverlay.tsx` - 加载遮罩

**UI 组件** (`ui/`) - 20+ 组件
- 对话系统: `DialogUI.tsx`, `SelectionUI.tsx`, `MessageGui.tsx`
- 状态界面: `TopGui.tsx`, `BottomGui.tsx`, `StateGui.tsx`, `BottomStateGui.tsx`
- 功能界面: `GoodsGui.tsx`, `EquipGui.tsx`, `MagicGui.tsx`, `MemoGui.tsx`, `XiuLianGui.tsx`
- 系统界面: `SystemMenuModal.tsx`, `SystemGui.tsx`, `TitleGui.tsx`
- 辅助组件: `GameCursor.tsx`, `NpcLifeBar.tsx`, `ItemTooltip.tsx`, `MagicTooltip.tsx`
- 开发工具: `DebugPanel.tsx`, `SidePanel.tsx`

**其他**
- `MapViewer.tsx` - 地图测试工具

---

## 已有系统

> ⚠️ 以下系统均已实现基础功能，但不一定完善，开发时请参考 C# 版本补充细节。

| 系统 | 主要模块 | 说明 |
|------|----------|------|
| 地图系统 | `map/` | 多层渲染、碰撞检测、MPC加载、陷阱 |
| 角色系统 | `character/` | 玩家、NPC、移动、动画、INI解析 |
| 剧本系统 | `script/` | 解析、执行、命令模块化 |
| 界面系统 | `gui/`, `components/ui/` | 20+ UI 组件 |
| 输入系统 | `game/inputHandler.ts` | 键盘/鼠标/交互管理 |
| 音效系统 | `audio/` | 背景音乐、音效 (Web Audio API) |
| 特效系统 | `effects/` | 屏幕特效、淡入淡出 |
| 物体系统 | `obj/` | 加载/渲染/交互 |
| 物品系统 | `goods/` | 物品管理、物品列表 |
| 武功系统 | `magic/` | 主动技能、被动效果、特效系统 |
| 存档系统 | `game/loader.ts`, `storage.ts` | 存档加载和保存 |
| 调试系统 | `debug/` | 调试管理、调试面板 |
| 寻路系统 | `core/pathFinder.ts` | A* 算法 |
| 战斗系统 | `game/magicHandler.ts` | 战斗逻辑处理 |

---

## 开发指南

### 核心原则

1. **严格遵循 C# 架构** - 所有新功能必须先查看 `/JxqyHD/Engine/` 中的对应实现
2. **保持类型安全** - 使用 TypeScript strict mode，避免 `any`
3. **保持不可变性** - React 状态更新使用展开运算符
4. **使用核心类型** - 从 `core/types.ts` 导入 enums 和接口
5. **每次修改后运行 `pnpm tsc`** - 确保 TypeScript 类型检查通过

### ⚠️ 必须执行：TypeScript 类型检查

**每次修改代码后，必须运行以下命令确保没有类型错误：**

```bash
pnpm tsc
```

这会：
- 检查所有 TypeScript 文件的类型错误
- 确保接口定义正确
- 验证函数参数和返回值类型
- 发现潜在的 null/undefined 问题

**不要提交有 TypeScript 错误的代码！**

### 添加新功能的标准流程

```typescript
// 1. 找到 C# 对应文件
// 例如：实现战斗系统 → 查看 Magic.cs, MagicManager.cs

// 2. 在 core/types.ts 定义接口
export interface MagicData {
  name: string;
  level: number;
  manaCost: number;
  // ... 基于 C# 属性
}

// 3. 实现管理器类
// src/engine/magic/magicManager.ts
export class MagicManager {
  // 翻译 C# 方法到 TypeScript
}

// 4. 集成到 GameManager
// src/engine/game/gameManager.ts
private magicManager: MagicManager;

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

## Testing Strategy

### Current Testing Approach

1. **Map Viewer Mode**
   - Select map from dropdown
   - Visual inspection
   - No game logic

2. **Game Mode**
   - Starts at 凌绝峰峰顶 (map_002)
   - Runs Begin.txt initialization script
   - Full game system integration

3. **Manual Testing**
   - Test character movement
   - Test NPC interactions
   - Test script execution
   - Test UI interactions

### Future Testing (Recommended)

1. **Unit Tests**
   - Test individual systems (parser, renderer, etc.)
   - Mock dependencies

2. **Integration Tests**
   - Test system interactions
   - Test script execution

3. **Visual Regression Tests**
   - Compare rendering with C# version
   - Screenshot comparison

---

## Common Tasks

### Adding a New Map

1. Place `.map` file in `/resources/map/`
2. Place MPC files in `/resources/mpc/`
3. Add to map list in `App.tsx`

### Adding a New NPC

1. Create `.ini` file in `/resources/ini/npc/`
2. Follow existing NPC format (reference C# `Npc.cs`)
3. Place in map or load via script

### Adding a New Script Command

1. Add to `ScriptExecutor` in `executor.ts`
2. Add handler to `ScriptContext` in `gameManager.ts`
3. Test with script file

### Adding a New GUI Component

1. Create React component in `/src/components/ui/`
2. Add to `GuiManager` state
3. Wire up show/hide logic

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

## 开发优先级

### 高优先级（核心玩法）
1. 战斗系统 - `magicHandler.ts`, `specialActionHandler.ts`
2. 背包系统 - `good.ts`, `goodsListManager.ts`, `GoodsGui.tsx`
3. 完善 GUI - 20+ UI 组件

### 中优先级（功能）
1. 寻路系统 - `pathFinder.ts` (A* 算法)
2. 存档系统 - `loader.ts`, `storage.ts`
3. NPC AI 增强

### 低优先级（优化）
1. 性能优化 - Canvas 优化、资源缓存
2. 移动端支持 - 触控操作
3. 额外功能 - 手柄支持、设置菜单

---

## 重要提示

**这是一个忠实复刻项目**。目标是保持与原版相同的玩法、机制和手感。

- ✅ 遇到问题时，**优先查看 C# 实现**作为标准答案
- ✅ 保持架构与 C# 版本**一致性**，便于理解、移植和调试
- ✅ 使用现代 Web 技术，但**不改变游戏本质**

参考：[mapic91/JxqyHD](https://github.com/mapic91/JxqyHD)
### Canvas 渲染规范

**渲染顺序**（在 Game.tsx 游戏循环中）：
```typescript
1. 清空画布
2. 地图地面层
3. 地图物体层
4. NPCs
5. 玩家
6. 物体
7. 特效
8. UI
```

**坐标系统**：
- **瓦片坐标** - 游戏逻辑 (x: 10, y: 15)
- **像素坐标** - 渲染 (tileToPixel)
- **屏幕坐标** - 相对镜头 (screenX = pixelX - camera.x)

### 资源加载

```typescript
import { resourceLoader } from "../resource/resourceLoader";

// 文本资源（UTF-8）
const content = await resourceLoader.loadText("/resources/script/xxx.txt");

// 二进制资源
const buffer = await resourceLoader.loadBinary("/resources/map/xxx.map");

// GBK 编码的 .obj 文件
const buffer = await resourceLoader.loadBinary("/resources/ini/save/xxx.obj");
const decoder = new TextDecoder("gbk");
const content = decoder.decode(buffer);
```

### 遇到疑难问题时

当你遇到难以分析或解决的问题时，可以添加 `console.log` 打印日志来辅助调试：
- ⚠️ **注意**：避免在 update loop 中打印日志，会产生大量输出影响性能
- 建议在初始化、事件触发、状态变化时打印

---

## 代码规范

### 命名约定
- 类: `PascalCase` (GameManager)
- 函数: `camelCase` (loadMap)
- 常量: `UPPER_SNAKE_CASE` (TILE_WIDTH)
- 接口: `PascalCase` (CharacterData)
- 文件: TS用 `camelCase.ts`, React用 `PascalCase.tsx`

### 注释规范
- 标注对应的 C# 文件
- 解释复杂的游戏逻辑
- 说明与 C# 版本的差异

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