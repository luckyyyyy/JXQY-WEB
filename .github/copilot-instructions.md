# Copilot Instructions for JxqyHD Web Remake

## 项目概述

这是**西山居 2001 年**推出的经典 RPG《剑侠情缘外传：月影传说》的 Web 复刻项目。

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
- `playerController.ts` ← `Player.cs`
- `npcManager.ts` ← `NpcManager.cs`
- `character.ts` ← `Character.cs`

**Script System** (`script/`)
- `parser.ts` - 剧本解析
- `executor.ts` - 剧本执行
- 对应 C# 的 `ScriptParser.cs`, `ScriptExecutor.cs`

**Map & Rendering**
- `map.ts` ← `MapBase.cs`, `JxqyMap.cs`
- `renderer.ts` - 地图渲染
- `asf.ts` ← `Asf.cs` - 精灵加载
- `mpc.ts` ← `Mpc.cs` - 资源包

**GUI System** (`gui/`)
- `guiManager.ts` ← `GuiManager.cs`
- 对应 C# 的 `DialogGui.cs`, `TopGui.cs` 等

**其他系统**
- `audio/audioManager.ts` - 音效管理
- `effects/screenEffects.ts` - 屏幕特效
- `obj/` - 物体系统
- `listManager/` - 数据列表管理

### React 组件层（`/src/components/`）

- `Game.tsx` - 游戏主组件，游戏循环
- `MapViewer.tsx` - 地图测试工具
- `ui/` - UI 组件（对话框、HUD等）
- `App.tsx` - 模式管理（标题、游戏、查看器）

---

## 实现状态

### ✅ 已实现 (~60%)

| 系统 | 完成度 | 说明 |
|------|--------|------|
| 地图系统 | 80% | 多层渲染、碰撞检测、MPC加载 ✅ |
| 角色系统 | 70% | 移动、动画、NPC管理 ✅ |
| 剧本系统 | 85% | 解析、执行、变量、对话 ✅ |
| 界面系统 | 40% | 对话框、选项 ✅，背包/装备 ❌ |
| 输入系统 | 90% | 键盘/鼠标控制 ✅ |
| 音效系统 | 60% | 背景音乐 ✅，音效 ❌ |
| 特效系统 | 30% | 淡入淡出 ✅，天气/战斗特效 ⚠️ |
| 物体系统 | 50% | 加载/渲染 ✅，交互 ⚠️ |

### ❌ 未实现

- **战斗系统** (0%) - Magic.cs, MagicManager.cs
- **背包系统** (0%) - Good.cs, GoodsGui.cs, EquipGui.cs
- **商店/任务** (0%)
- **高级寻路** (0%) - PathFinder.cs (A* 算法)

---

## 开发指南

### 核心原则

1. **严格遵循 C# 架构** - 所有新功能必须先查看 `/JxqyHD/Engine/` 中的对应实现
2. **保持类型安全** - 使用 TypeScript strict mode，避免 `any`
3. **保持不可变性** - React 状态更新使用展开运算符
4. **使用核心类型** - 从 `core/types.ts` 导入 enums 和接口

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

| 格式 | 用途 | 位置 |
|------|------|------|
| `.map` | 地图数据（瓦片、碰撞） | `/resources/map/` |
| `.asf` | 精灵动画帧 | `/resources/asf/` |
| `.mpc` | 压缩资源包 | `/resources/mpc/` |
| `.ini` | 配置（NPC、物体、物品） | `/resources/ini/` |
| `.txt` | 游戏剧本 | `/resources/script/` |

## 开发优先级

### 高优先级（核心玩法）
1. 战斗系统 - `Magic.cs` → `magic/`
2. 背包系统 - `Good.cs` → `inventory/`
3. 完善 GUI - 背包、装备、武功界面

### 中优先级（功能）
1. 高级寻路 - `PathFinder.cs` (A* 算法)
2. 存档系统 - 完整的存档界面
3. 任务系统

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
// 异步加载
const mapData = await loadMap('/resources/map/xxx.map');

// 资源缓存
// ASF sprites 在 asf.ts 中自动缓存

// 加载状态
const [isLoading, setIsLoading] = useState(true);
```

### 调试技巧

1. **对比 C# 版本** - 运行原版查看预期行为
2. **使用 MapViewer** - 独立测试地图，无游戏逻辑干扰
3. **查看日志** - `console.log('[SystemName] message')`
4. **React DevTools** - 检查组件状态

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