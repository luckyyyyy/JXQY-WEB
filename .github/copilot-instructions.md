# Copilot Instructions for Miu2D Engine

## 项目概述

**Miu2D Engine** - 基于 Web 技术的 2D RPG 游戏引擎，复刻《剑侠情缘外传：月影传说》。

- **本项目**：TypeScript + React 19 + WebGL

### 技术栈
- TypeScript 5.9 (strict mode)
- React 19, Vite 7 (rolldown-vite)
- WebGL 高性能渲染（Canvas 2D 回退）
- Tailwind CSS 4
- Web Audio API (OGG Vorbis)
- Biome (lint + format)
- **pnpm monorepo**
- Rust + WebAssembly (高性能模块)
- NestJS (ESM) + tRPC (服务端)
- PostgreSQL + Drizzle ORM (数据库)
- MinIO / S3 (文件存储)

### 开发端口
- **前端**: http://localhost:5173
- **后端**: http://localhost:4000
- **数据库**: PostgreSQL 默认端口 5432 (Docker)
- **文件系统**: MinIO 通过 `/game/[gameSlug]/resources/*` 路径访问

### 资源路径机制

游戏资源通过 `gameSlug` 参数动态确定前缀：
- **路由格式**: `/game/:gameSlug/*`
- **资源路径**: `/game/[gameSlug]/resources/*`
- **示例**: 用户 `william-chan` 的游戏资源在 `/game/william-chan/resources/`

**前端**：`GameScreen` 组件从 URL 获取 `gameSlug`，调用 `setResourcePaths({ root: '/game/${gameSlug}/resources' })`

**后端**：`FileController` 处理 `/game/:gameSlug/resources/*` 路由，从 MinIO 读取对应的文件

**不要直接运行任何前端和后端，直接使用curl测试，无需重启，自动热更新**

### pnpm Monorepo 结构

本项目使用 pnpm workspace 管理多包：

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

**包间依赖：**
```json
// packages/web/package.json
{
  "dependencies": {
    "@miu2d/engine": "workspace:*",
    "@miu2d/types": "workspace:*",
    "@miu2d/ui": "workspace:*",
    "@miu2d/viewer": "workspace:*",
    "@miu2d/server": "workspace:*"  // 仅用于 tRPC 类型
  }
}

// packages/server/package.json
{
  "dependencies": {
    "@miu2d/i18n": "workspace:*",
    "@miu2d/types": "workspace:*"
  }
}

// packages/viewer/package.json
{
  "dependencies": {
    "@miu2d/engine": "workspace:*"
  }
}
```

**常用操作：**
```bash
pnpm install              # 安装所有包依赖
pnpm -r build             # 递归构建所有包
make dev                  # 同时运行 web + server（自动启动 db + minio）
pnpm --filter @miu2d/web dev   # 只运行 web 包
pnpm --filter @miu2d/server dev # 只运行 server 包
```

---

## 包结构总览

| 包名 | 目录 | 说明 |
|------|------|------|
| `@miu2d/engine` | `packages/engine/` | 纯 TypeScript 游戏引擎，**不依赖 React** |
| `@miu2d/engine-wasm` | `packages/engine-wasm/` | Rust 实现的高性能 WASM 模块 |
| `@miu2d/ui` | `packages/ui/` | **超级通用 UI 组件**，不依赖任何业务包 |
| `@miu2d/viewer` | `packages/viewer/` | 资源查看器（ASF/Map/MPC/XnbAudio）|
| `@miu2d/web` | `packages/web/` | React 前端应用，游戏界面和用户认证 |
| `@miu2d/server` | `packages/server/` | NestJS 后端服务，tRPC API |
| `@miu2d/types` | `packages/types/` | **共享 Zod Schema 和 TypeScript 类型** |
| `@miu2d/i18n` | `packages/i18n/` | 国际化资源包（前后端共用） |
| `@miu2d/converter` | `packages/converter/` | Rust CLI 资源转换工具（ASF/MPC → MSF，MAP → MMF） |
| **C# 参考** | `JxqyHD/Engine/` | 原 C# 实现，功能参考来源 |
| **游戏资源** | `resources/` | 地图、精灵、脚本等资源文件 |

---

## @miu2d/types - 共享类型包

**核心原则**：所有前后端共享的类型都应放在此包中，避免重复定义。

### 包含内容

| 模块 | 说明 |
|------|------|
| `user.ts` | 用户相关类型（UserSchema, UserSettings） |
| `game.ts` | 游戏/项目相关类型（GameSchema, CRUD 输入） |
| `file.ts` | 文件系统类型（FileNode, 上传/下载/重命名等） |
| `magic.ts` | 武功系统类型（MagicSchema, 枚举, 等级配置） |
| `goods.ts` | 物品系统类型（GoodsSchema, GoodsKindEnum, 批量导入） |
| `level.ts` | 等级系统类型（LevelConfigSchema, CRUD + 导入） |
| `gameConfig.ts` | 游戏全局配置（DropConfigSchema, PlayerConfigSchema） |
| `npc.ts` | NPC 类型（NpcSchema, NpcResourceSchema, 资源路径） |
| `obj.ts` | 物体类型（ObjSchema, ObjResourceSchema, ObjKindEnum） |
| `player.ts` | 玩家类型（PlayerSchema, CRUD + 批量导入） |
| `shop.ts` | 商店类型（ShopSchema, ShopItemSchema, CRUD） |
| `talk.ts` | 对话类型（TalkDataSchema, 解析/导出 talk.txt） |
| `talkPortrait.ts` | 对话头像（PortraitEntrySchema, 解析/导出 portrait.ini） |
| `save.ts` | 存档类型（SaveSlotSchema, 管理接口） |
| `scene.ts` | 场景类型（SceneSchema, SceneItemKindEnum, 地图解析） |

### 使用方式

```typescript
// 导入 Schema（用于运行时验证）
import { UserSchema, GameSchema, FileNodeSchema } from "@miu2d/types";

// 导入类型（用于 TypeScript 类型标注）
import type { User, Game, FileNode, Magic } from "@miu2d/types";

// 导入枚举和工具函数
import {
  MagicMoveKindEnum,
  MagicMoveKindValues,
  createDefaultMagic
} from "@miu2d/types";
```

### 武功类型定义

```typescript
// 移动类型枚举
MagicMoveKindEnum: "NoMove" | "LineMove" | "CircleMove" | "SectorMove" | ...

// 特殊类型枚举
MagicSpecialKindEnum: "None" | "Damage" | "Heal" | "Buff" | ...

// 归属类型
MagicBelongEnum: "Player" | "Npc" | "All"

// 工具函数
getVisibleFieldsByMoveKind(kind: MagicMoveKind): string[]  // 根据类型返回可编辑字段
createDefaultMagic(): Magic                                  // 创建默认武功配置
createDefaultLevels(count: number): MagicLevel[]            // 创建等级数组
```

---

## @miu2d/ui - 超级通用 UI 组件包

**核心原则**：不依赖任何业务包（@miu2d/engine、@miu2d/types 等），可在任何 React 项目中使用。

### 特点

- 仅依赖 React 和通用 UI 库（如 framer-motion）
- 高度可复用的视觉组件
- 与业务逻辑完全解耦

### 组件

| 分类 | 组件 | 说明 |
|------|------|------|
| **Avatar** | `Avatar` | 头像组件 |
| **Icons** | `GitHubIcon`, `TwitterIcon`, `DiscordIcon`, `SunIcon`, `MoonIcon`, `GlobeIcon`, `BookIcon`, `CloseIcon`, `MenuIcon`, `ChevronDownIcon`, `ChevronRightIcon`, `SearchIcon`, `LoadingIcon`, `CheckIcon`, `PlayIcon`, `PauseIcon` | 通用 SVG 图标 |
| **Animations** | `FadeIn`, `FadeInView`, `ScaleIn`, `Stagger`, `StaggerItem`, `HoverScale`, `Pulse`, `Slide` | 动画封装（landing/） |
| **Background** | `GridBackground`, `GridPattern`, `FloatingOrb`, `GridLine`, `GridNode` | 背景效果（landing/） |

### 使用方式

```typescript
import {
  Avatar, FadeIn, GridBackground, GitHubIcon, LoadingIcon
} from "@miu2d/ui";

function MyPage() {
  return (
    <GridBackground className="min-h-screen">
      <FadeIn>
        <Avatar name="user" />
        <GitHubIcon size={16} />
      </FadeIn>
    </GridBackground>
  );
}
```

### 什么应该放在 @miu2d/ui

✅ **应该放入**：
- 不依赖任何业务逻辑的纯视觉组件
- 可在任何 React 项目复用的通用组件
- 仅依赖 React、framer-motion 等通用库的组件

❌ **不应该放入**：
- 依赖 @miu2d/engine 的组件 → 放 @miu2d/viewer 或 @miu2d/web
- 游戏专属 UI（存档面板、调试面板）→ 放 @miu2d/web
- 资源查看器/编辑器 → 放 @miu2d/viewer

---

## @miu2d/engine - 游戏引擎

纯 TypeScript 实现，**不依赖 React**，可在 Web Worker 中运行。

### 模块结构

```
packages/engine/src/
├── audio/          # 音频管理（Web Audio API）
├── character/      # 角色系统（base/ 继承链, modules/, level/）
├── data/           # 数据与配置模型
├── core/           # 核心类型和工具（types.ts, logger.ts, engine-context.ts, game-api.ts）
├── gui/            # GUI 管理器（gui-manager, buy-manager, ui-bridge）
├── magic/          # 武功系统（effects/, manager/, passives/）
├── map/            # 地图系统（map-base, map-renderer）
├── npc/            # NPC 系统（modules/npc-ai, npc-magic-cache）
├── obj/            # 物体系统（obj-manager, obj-renderer）
├── player/         # 玩家系统（base/, goods/, magic/）
├── renderer/       # 渲染器（WebGL + Canvas2D, sprite-batcher, screen-effects）
├── resource/       # 资源加载器（format/, resource-loader, resource-paths）
├── runtime/        # 运行时（GameEngine, GameManager, InputHandler, CameraController）
├── script/         # 脚本系统（commands/, api/, parser.ts, executor.ts）
├── sprite/         # 精灵基类（sprite.ts, edge-detection.ts）
├── storage/        # 存档与持久化
├── utils/          # 工具函数（direction, distance, collision, ini-parser）
├── wasm/           # WASM 集成
└── weather/        # 天气系统（rain, snow, screen-droplet）
```

### 导入方式

```typescript
// 从主入口导入
import { GameEngine, Direction, CharacterState } from "@miu2d/engine";

// 从子模块导入
import { logger } from "@miu2d/engine/core/logger";
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";
import type { MagicData } from "@miu2d/engine/magic";
```

---

## @miu2d/engine-wasm - 高性能 WASM 模块

Rust 实现的计算密集型功能，性能比 JS 提升约 **10x**。

### 功能模块

| 模块 | 说明 | 性能提升 |
|------|------|----------|
| `PathFinder` | A* 寻路算法 | ~10x |
| `AsfDecoder` | 精灵帧 RLE 解码 | ~10x |
| `SpatialHash` | 空间碰撞检测 | ~10x |
| `MpcDecoder` | MPC 资源包解析 | ~10x |

### 使用方式

```typescript
import init, { PathFinder, AsfDecoder, SpatialHash } from '@miu2d/engine-wasm';

// 必须先初始化
await init();

// 寻路
const pathfinder = new PathFinder(100, 100);
const path = pathfinder.find_path(0, 0, 10, 10, PathType.PerfectMaxPlayerTry, 8);

// ASF 解码
const decoder = AsfDecoder.parse(new Uint8Array(asfData));
const pixels = decoder.decode_frame(0);  // RGBA 数据
```

---

## @miu2d/viewer - 资源查看器与编辑器

独立的 React 组件库，提供各类资源查看器和编辑器。

**依赖 `@miu2d/engine`**，用于解析和渲染游戏资源。

### 查看器组件

```typescript
import { AsfViewer, MapViewer, MpcViewer, XnbAudioViewer } from "@miu2d/viewer/components";
```

| 组件 | 说明 |
|------|------|
| `AsfViewer` | 精灵动画查看器 |
| `MapViewer` | 地图查看器（导出 MapMarker, MapViewerHandle, MapInfo, SidePanelTab 类型） |
| `MpcViewer` | MPC 资源包查看器 |
| `XnbAudioViewer` | XNB 音频查看器 |

---

## @miu2d/web - 前端应用

React 19 前端应用，整合游戏引擎和编辑器。

### 目录结构

```
packages/web/src/
├── components/
│   ├── common/         # 通用组件（SidePanel, DebugPanel, ResourceFilePicker）
│   ├── game/           # 游戏组件（adapters/, hooks/, mobile/, ui/classic|mobile|modern）
│   └── ui/             # UI 组件
├── contexts/           # React Context
├── hooks/              # 自定义 Hooks
├── i18n/               # 前端 i18n 配置
├── lib/                # 工具库（trpc 客户端, monaco 配置）
├── pages/              # 页面组件
│   ├── dashboard/      # 仪表盘（编辑器）
│   │   ├── components/ # 仪表盘通用组件
│   │   ├── modules/   # 模块编辑页（magic, npc, obj, goods, player, talk, level, shop, scene）
│   │   ├── sidebar/   # 侧边栏列表面板
│   │   └── utils/     # 工具函数
│   ├── landing/        # 首页
│   ├── GameScreen.tsx  # 游戏界面
│   ├── GamePlaying.tsx # 游戏进行中
│   ├── LoginPage.tsx   # 登录页
│   └── RegisterPage.tsx # 注册页
└── styles/             # 样式文件
```

---

## @miu2d/server - 后端服务

NestJS + tRPC 后端，端口 4000。

### 技术栈
- **NestJS** - ESM 模式
- **tRPC** - 类型安全的 API
- **Drizzle ORM** - PostgreSQL 数据库
- **MinIO/S3** - 文件存储
- **Zod** - 输入验证（使用 @miu2d/types）

### 数据库表结构

```typescript
// packages/server/src/db/schema.ts
- users           // 用户表
- sessions        // 会话表
- emailTokens     // 邮件验证令牌
- games           // 游戏/项目表
- gameMembers     // 游戏成员表
- files           // 文件系统表（元数据存 PG，内容存 S3，支持软删除）
- gameConfigs     // 游戏全局配置（JSONB，每游戏一条）
- magics          // 武功表（JSONB data）
- levelConfigs    // 等级配置表（JSONB data）
- goods           // 物品表（JSONB data）
- shops           // 商店表（JSONB data）
- npcs            // NPC 表（JSONB data）
- npcResources    // NPC 资源表（JSONB data）
- objs            // 物体表（JSONB data）
- objResources    // 物体资源表（JSONB data）
- players         // 玩家表（JSONB data）
- talkPortraits   // 对话头像表（JSONB data）
- talks           // 对话表（JSONB data）
- saves           // 存档表（JSONB data，支持分享）
- scenes          // 场景表
- sceneItems      // 场景元素表（script/trap/npc/obj）
```

### tRPC 路由结构

```
modules/
├── auth/           # 认证模块
├── user/           # 用户模块
├── game/           # 游戏/项目模块
├── file/           # 文件系统模块
├── data/           # 数据导入导出
├── magic/          # 武功编辑模块
├── goods/          # 物品编辑模块
├── level/          # 等级配置模块
├── gameConfig/     # 游戏全局配置模块
├── npc/            # NPC 模块（+ npcResource 子路由）
├── obj/            # 物体模块（+ objResource 子路由）
├── player/         # 玩家模块
├── shop/           # 商店模块
├── talk/           # 对话模块
├── talkPortrait/   # 对话头像模块
├── save/           # 存档模块
└── scene/          # 场景模块
```

### 添加新的 tRPC 路由

```typescript
// 1. 在 @miu2d/types 中定义 Schema
// packages/types/src/example.ts
export const ExampleSchema = z.object({ id: z.string(), name: z.string() });
export type Example = z.infer<typeof ExampleSchema>;

// 2. 创建 Router 类
// packages/server/src/modules/example/example.router.ts
import { Router, Query, Mutation, Ctx, UseMiddlewares } from "../../trpc/decorators";
import { requireUser } from "../../trpc/middlewares";
import { ExampleSchema } from "@miu2d/types";

@Router({ alias: "example" })
export class ExampleRouter {
  @UseMiddlewares(requireUser)
  @Query({ input: z.object({ id: z.string() }), output: ExampleSchema })
  async getById(input: { id: string }, @Ctx() ctx: Context) {
    // 实现
  }
}

// 3. 在 modules/index.ts 中导入
import "./example";
```

---

## @miu2d/i18n - 国际化资源包

前后端共用的多语言资源。

### 结构

```
packages/i18n/src/
├── index.ts
└── locales/
    ├── zh.ts    # 中文
    └── en.ts    # 英文
```

### 服务端使用

```typescript
import { zh, en } from "@miu2d/i18n";

// 根据语言获取翻译
const messages = ctx.language === "zh" ? zh : en;
const error = messages.translation.errors.auth.invalidCredentials;
```

### 前端使用（react-i18next）

```typescript
import { useTranslation } from "react-i18next";

function Component() {
  const { t } = useTranslation();
  return <h1>{t("auth.login.title")}</h1>;
}
```

---

## 类继承体系

### Sprite 继承链

```
Sprite (packages/engine/src/sprite/sprite.ts)
└── CharacterBase (character/base/character-base.ts)
    └── CharacterMovement (character/base/character-movement.ts)
        └── CharacterCombat (character/base/character-combat.ts)
            └── Character (character/character.ts) [abstract]
                ├── PlayerBase (player/base/player-base.ts)
                │   └── PlayerInput (player/base/player-input.ts)
                │       └── PlayerCombat (player/base/player-combat.ts)
                │           └── Player (player/player.ts)
                └── Npc (npc/npc.ts)
```

---

## IEngineContext 接口

Sprite 及其子类通过 `this.engine` 访问引擎服务：

```typescript
interface IEngineContext {
  // ===== 核心服务（只读属性）=====
  readonly player: IPlayer;               // 玩家实例
  readonly npcManager: INpcManager;       // NPC 管理器
  readonly map: MapBase;                  // 地图（障碍检测、陷阱、坐标转换）
  readonly audio: AudioManager;           // 音频管理器
  readonly objManager: ObjManager;        // 物体管理器
  readonly guiManager: GuiManager;        // GUI 管理器
  readonly debugManager: DebugManager;    // 调试管理器
  readonly weatherManager: WeatherManager; // 天气管理器
  readonly buyManager: BuyManager;        // 购买管理器
  readonly interactionManager: InteractionManager; // 交互管理器
  readonly magicHandler: MagicHandler;    // 武功处理器
  readonly magicManager: MagicManager;    // 武功管理器
  readonly mapRenderer: MapRenderer;      // 地图渲染器
  readonly scriptExecutor: IScriptExecutor; // 脚本执行器

  // ===== 便捷方法（高频操作）=====
  runScript(path: string, belongObject?: { type: string; id: string }): Promise<void>;
  queueScript(path: string): void;
  getCurrentMapName(): string;
  getScriptBasePath(): string;
  isDropEnabled(): boolean;
  getScriptVariable(name: string): number;
  notifyPlayerStateChanged(): void;   // 通知 UI 刷新
}
```

**使用示例：**

```typescript
class Obj extends Sprite {
  async interact() {
    // 所有管理器都是直接属性，无需 getManager
    const player = this.engine.player;
    const isBlocked = this.engine.map.isObstacleForCharacter(x, y);
    this.engine.audio.playSound("click.wav");
    this.engine.guiManager.showDialog("Hello");
  }
}
```

---

## 核心规范

### 必须遵守

1. **禁止 `any`** - 使用 `unknown` + 类型守卫
2. **参考 C# 实现** - 修改引擎功能先参考 `/JxqyHD/Engine/` 的实现
3. **参考 TS 实现** - 网页用到引擎相关功能先参考 `/packages/engine` 的实现
4. **每次修改后运行 `make tsc`** - 不提交有类型错误的代码
5. **每次修改后运行 `make lint`** - 不提交有 lint 错误的代码（`pnpm biome lint packages/`）
6. **使用 `resourceLoader`** - 不直接使用 `fetch()`
7. **使用 `logger`** - 不直接使用 `console.log`

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
import { resourceLoader } from "@miu2d/engine/resource/resourceLoader";

// UTF-8 文本
const text = await resourceLoader.loadText("/resources/script/xxx.txt");

// 二进制
const buffer = await resourceLoader.loadBinary("/resources/map/xxx.map");

// GBK 编码文件（如 .obj 存档）
const buffer = await resourceLoader.loadBinary(path);
const content = new TextDecoder("gbk").decode(buffer);

// 音频文件
const audioBuffer = await resourceLoader.loadAudio("/resources/sound/xxx.ogg");
```

| 格式 | 用途 | 编码 |
|------|------|------|
| `.map` | 地图数据 | 二进制 |
| `.asf` | 精灵动画 | 二进制 |
| `.mpc` | 资源包 | 二进制 |
| `.shd` | 阴影数据 | 二进制 |
| `.obj` | 物体存档 | GBK |
| `.ini`, `.npc`, `.txt` | 配置/脚本 | UTF-8 |
| `.ogg`, `.mp3`, `.wav` | 音频文件 | Web Audio API |

---

## 日志系统

```typescript
import { logger } from "@miu2d/engine/core/logger";

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
- 文件: TS `kebab-case.ts`, React `PascalCase.tsx`

---
