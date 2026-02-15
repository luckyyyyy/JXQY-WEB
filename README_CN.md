<p align="center">
  <img src="packages/web/public/favicon.svg" width="80" alt="Miu2D Logo" />
</p>

<h1 align="center">Miu2D Engine</h1>

<p align="center">
  <b>从零构建的 2D RPG 引擎 — 原生 WebGL 渲染，零游戏框架依赖</b>
</p>

<p align="center">
  <a href="https://miu2d.com">在线演示</a> · <a href="README.md">English</a>
</p>

---

Miu2D 是一个 **183,000 行**的 2D RPG 引擎，使用 TypeScript 和 Rust 编写，通过**原生 WebGL** 渲染——不依赖 Unity、Godot、Phaser、PixiJS 或任何其他游戏框架。所有子系统——精灵批量渲染、A* 寻路、二进制格式解码、脚本虚拟机、天气粒子、屏幕特效——全部从零实现。

作为引擎的验证项目，我们用 Miu2D 完整复刻了**《剑侠情缘外传：月影传说》**——西山居于 2001 年推出的经典武侠 RPG，让这款游戏可以在任何现代浏览器中运行。

> **Vibe Coding** — 本项目从第一天起就采用 AI 辅助编程方式开发。

![桌面端游戏画面](packages/web/public/screenshot/screenshot.png)

<details>
<summary><b>移动端 & 编辑器截图</b></summary>

**移动端 — 虚拟摇杆 + 触控操作：**

![移动端](packages/web/public/screenshot/mobile.png)

**地图编辑器 — 可视化瓦片编辑、碰撞区域：**

![地图编辑器](packages/web/public/screenshot/map-editor.png)

**ASF 编辑器 — 精灵动画帧查看与调试：**

![ASF 编辑器](packages/web/public/screenshot/asf-editor.png)

</details>

---

## 为什么从零造引擎？

绝大多数 Web 游戏项目会选择 PixiJS、Phaser，或编译 Unity/Godot 到 WASM。Miu2D 走了一条不同的路：整个渲染管线直接与 `WebGLRenderingContext` 对话，寻路器用 Rust 编译到 WASM 并通过零拷贝共享内存传输数据，脚本引擎通过自研解析器/执行器解释 182 条游戏指令。最终得到的是一个每一层都可见、可调试、专为 2D RPG 机制定制的系统。

**这带来了什么：**

- **完全掌控渲染循环** — `SpriteBatcher` 将约 4,800 张地图瓦片合并为 1–5 次 WebGL 绘制调用；`RectBatcher` 将约 300 个天气粒子归为 1 次调用
- **零抽象税** — 没有用不到的场景图，没有 3D 数学开销，没有需要绕开的框架事件模型
- **关键路径用 Rust 加速** — A* 寻路通过 WASM 运行，障碍物数据直接写入线性内存（零序列化、零 FFI 拷贝），单次寻路约 **0.2ms**，比同等 TypeScript 实现快约 **10 倍**
- **可学习的干净架构** — 7 层类继承体系（Sprite → CharacterBase → Movement → Combat → Character → PlayerBase → PlayerCombat → Player）职责分明，是学习完整 2D RPG 引擎底层原理的理想参考

---

## 架构全景

```
 ┌────────────────────────────────────────────────────────────────┐
 │  React 19 UI 层（3 套主题：经典 / 现代 / 移动端）               │
 │  29,070 行 · 29 经典 + 24 现代 + 7 移动端组件                   │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/engine — 纯 TypeScript，不依赖 React                   │
 │  57,210 行 · 213 个源文件                                       │
 │  ┌──────────┬────────────┬───────────┬──────────────────────┐ │
 │  │ 渲染器   │  脚本 VM   │ 角色系统  │ 武功（22 种轨迹）     │ │
 │  │ WebGL +  │  182 条指令│ 7 层继承  │ 飞弹、范围、追踪、   │ │
 │  │ Canvas2D │  解析器 +  │ + NPC AI  │ 召唤、传送、时停     │ │
 │  │ 回退     │  执行器    │           │                      │ │
 │  └──────────┴────────────┴───────────┴──────────────────────┘ │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/engine-wasm — Rust → WebAssembly（2,644 行）          │
 │  A* 寻路 · ASF/MPC/MSF 解码 · 空间哈希碰撞                    │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/server — NestJS + tRPC + Drizzle ORM（12,863 行）     │
 │  22 张 PostgreSQL 表 · 19 条类型安全 API 路由                   │
 ├────────────────────────────────────────────────────────────────┤
 │  @miu2d/dashboard — 完整游戏数据编辑器（33,201 行）             │
 │  VS Code 风格布局 · 12+ 个编辑模块                              │
 └────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| 语言 | TypeScript 5.9 (strict) · Rust · GLSL |
| 前端 | React 19 · Vite 7 (rolldown) · Tailwind CSS 4 |
| 渲染 | 原生 WebGL API（Canvas 2D 回退） |
| 音频 | Web Audio API (OGG Vorbis) |
| 性能 | Rust → WebAssembly（wasm-bindgen，零拷贝） |
| 后端 | NestJS (ESM) · tRPC · Drizzle ORM |
| 数据库 | PostgreSQL 16 · MinIO / S3 |
| 代码质量 | Biome (lint + format) · TypeScript strict 模式 |
| 项目管理 | pnpm workspaces（11 个包） |

---

## 引擎深度解析

### 渲染器 — 原生 WebGL + 自动批处理

渲染器是 **674 行**直接操作 `WebGLRenderingContext` 的代码——没有任何封装库。

- **SpriteBatcher** — 累积顶点数据，按纹理切换时 flush；典型地图帧：约 4,800 张瓦片 → 1–5 次绘制调用
- **RectBatcher** — 天气粒子和 UI 矩形合并为单次绘制调用
- **GPU 纹理管理** — `ImageData` → `WebGLTexture`，使用 `WeakMap` 缓存 + `FinalizationRegistry` 自动回收 GPU 资源
- **GLSL 着色滤镜** — 灰度（石化）、蓝色调（冰冻）、绿色调（中毒），在片段着色器中逐精灵应用
- **屏幕特效** — 淡入淡出、颜色叠加、屏幕闪烁、水波纹效果，全部在渲染循环中合成
- **Canvas 2D 回退** — 实现相同的 `Renderer` 接口，在无 WebGL 的设备上功能完全对等

### 脚本引擎 — 182 条指令

自研**解析器**将游戏脚本文件词法分析；**执行器**支持阻塞/异步执行。指令涵盖 9 大类：

| 类别 | 示例 |
|------|------|
| 对话 | `Say`、`Talk`、`Choose`、`ChooseMultiple`、`DisplayMessage` |
| 玩家 | `AddLife`、`AddMana`、`SetPlayerPos`、`PlayerGoto`、`Equip` |
| NPC | `AddNpc`、`DelNpc`、`SetNpcRelation`、`NpcAttack`、`MergeNpc` |
| 游戏状态 | `LoadMap`、`Assign`、`If/Goto`、`RunScript`、`RunParallelScript` |
| 音频 | `PlayMusic`、`StopMusic`、`PlaySound` |
| 特效 | `FadeIn`、`FadeOut`、`BeginRain`、`ShowSnow`、`OpenWaterEffect` |
| 物体 | `AddObj`、`DelObj`、`OpenObj`、`SetObjScript` |
| 物品 | `AddGoods`、`DelGoods`、`ClearGoods`、`AddRandGoods` |
| 杂项 | `Sleep`、`Watch`、`PlayMovie`、`DisableInput`、`ReturnToTitle` |

脚本驱动着整个游戏叙事——过场动画、分支对话、NPC 生成、地图切换、战斗触发、天气变化……

### 武功系统 — 22 种轨迹 × 9 种特殊效果

每个武功攻击遵循 **22 种 MoveKind** 轨迹之一，各有独立的物理和渲染逻辑：

| 轨迹类型 | 行为表现 |
|----------|---------|
| LineMove | 多飞弹直线发射——数量随等级递增 |
| CircleMove | 环绕轨道模式 |
| SpiralMove | 向外扩展的螺旋 |
| SectorMove | 扇形扩散 |
| HeartMove | 心形飞行路径 |
| FollowEnemy | 追踪目标的导弹 |
| Throw | 抛物线弧形投射 |
| Transport | 瞬间传送 |
| Summon | 召唤 NPC 助战 |
| TimeStop | 冻结全场实体 |
| VMove | V 字形分散发射 |
| *……另有 11 种* | |

搭配 **9 种 SpecialKind** 状态效果（冰冻、中毒、石化、隐身、治疗、变身……），可组合出数百种独特法术。系统包含 4 个专用精灵工厂、碰撞处理器和被动效果管理器。

### 寻路 — Rust WASM 零拷贝

A* 寻路器是 **1,144 行 Rust**，编译为 WebAssembly，通过共享线性内存消除所有 FFI 开销：

1. JavaScript 通过 `wasm.memory.buffer` 上的 `Uint8Array` 视图**直接写入**障碍物位图到 WASM 线性内存
2. WASM 在共享内存上就地执行 A* 算法
3. JavaScript 通过 `Int32Array` 指针视图**直接读取**路径结果——**零序列化、零拷贝**

5 种路径策略（从贪心到完整 A* + 可配置最大迭代数）让游戏可以在精度和速度间灵活权衡。典型寻路耗时：**约 0.2ms**，比等价 TypeScript 实现快约 **10 倍**。

### 二进制格式解码

引擎解析来自原版游戏的 **8 种二进制文件格式**——全部逆向工程实现，不依赖第三方解析库：

| 格式 | 说明 |
|------|------|
| **ASF** | 精灵动画帧（RLE 压缩，调色板索引 RGBA） |
| **MPC** | 资源包容器（打包的精灵表） |
| **MAP** | 瓦片地图数据（多图层、障碍网格、陷阱区域） |
| **SHD** | 地形阴影/高度图数据 |
| **XNB** | XNA 二进制格式（来自原版游戏的音频资源） |
| **MSF** | Miu Sprite Format v2 — 自研索引调色板 + zstd 压缩格式 |
| **MMF** | Miu Map Format — 自研 zstd 压缩二进制地图格式 |
| **INI/OBJ** | 配置文件（GBK 中文遗留编码 + UTF-8） |

### 天气系统 — 粒子驱动

**1,491 行**粒子物理与渲染代码：

- **雨天** — 受风力影响的粒子，落地溅射，周期性闪电照亮场景
- **屏幕水滴** — 模拟水珠沿镜头流淌的折射/透镜效果
- **雪天** — 独立雪花物理：摇摆、旋转、飘移、逐渐融化

### 角色系统 — 7 层继承体系

深层次、结构清晰的类继承体系，职责分明：

```
Sprite (615 行)
 └─ CharacterBase (961) — 属性、数值、状态标记
     └─ CharacterMovement (1,057) — A* 寻路、格子行走、贝塞尔曲线
         └─ CharacterCombat (780) — 攻击、伤害计算、状态效果
             └─ Character (980) — NPC/玩家共享逻辑 [抽象类]
                 ├─ PlayerBase → PlayerCombat → Player (合计 2,698 行)
                 └─ Npc (658) — AI 行为、交互脚本、空间网格
```

---

## 游戏数据编辑器（Dashboard）

项目内置 **33,201 行**的 VS Code 风格游戏编辑器，包含活动栏、侧边栏和内容面板：

| 编辑模块 | 编辑内容 |
|----------|---------|
| 武功编辑器 | 法术配置 + ASF 精灵实时预览 |
| NPC 编辑器 | 属性、脚本、AI 行为、精灵预览 |
| 场景编辑器 | 地图数据、出生点、陷阱、触发器 |
| 物品编辑器 | 武器、防具、消耗品、掉落表 |
| 商店编辑器 | 商店库存和定价 |
| 对话编辑器 | 分支对话树 + 头像指定 |
| 玩家编辑器 | 初始属性、装备、技能槽 |
| 等级编辑器 | 经验曲线和属性成长 |
| 文件管理器 | 完整文件树 + 拖放上传 |
| 数据统计 | 数据总览仪表盘 |

---

## 项目结构

pnpm monorepo 中的 11 个包，总计约 **183,000 行**代码：

| 包名 | 代码量 | 职责 |
|------|------:|------|
| `@miu2d/engine` | 57,210 | 纯 TS 游戏引擎（不依赖 React） |
| `@miu2d/dashboard` | 33,201 | VS Code 风格游戏数据编辑器 |
| `@miu2d/game` | 29,070 | 游戏运行时 + 3 套 UI 主题（经典/现代/移动端） |
| `@miu2d/server` | 12,863 | NestJS + tRPC 后端（22 表、19 路由） |
| `@miu2d/types` | 5,990 | 共享 Zod Schema（18 个领域模块） |
| `@miu2d/web` | 4,874 | 应用壳、路由、落地页 |
| `@miu2d/converter` | 3,952 | Rust CLI：ASF/MPC → MSF、MAP → MMF 批量转换 |
| `@miu2d/viewer` | 3,104 | 资源查看器（ASF/地图/MPC/音频） |
| `@miu2d/engine-wasm` | 2,644 | Rust → WASM 性能模块 |
| `@miu2d/ui` | 1,153 | 通用 UI 组件（无业务依赖） |
| `@miu2d/shared` | 999 | i18n、tRPC 客户端、React Context |

还包括：`resources/`（游戏资源）、`docs/`（格式规范文档）。

---

## 快速开始

**环境要求：** Node.js 18+、pnpm 9+、支持 WebGL 的现代浏览器

```bash
git clone https://github.com/patchoulib/game-jxqy.git
cd game-jxqy
pnpm install
pnpm dev            # → http://localhost:5173
```

### 全栈启动（含后端 + 数据库）

```bash
make init           # Docker: PostgreSQL + MinIO, 迁移, 种子数据
make dev            # 同时启动 web + server + db studio
```

### 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 前端开发服务器（端口 5173） |
| `make dev` | 全栈开发（web + server + db） |
| `pnpm tsc` | 全包类型检查 |
| `pnpm lint` | Biome 代码检查 |
| `make convert` | 批量转换游戏资源 |
| `make convert-verify` | 像素级转换验证 |

---

## 操作方式

| 输入方式 | 操作 |
|----------|------|
| 方向键 / 点击地面 | 移动 |
| Shift + 移动 | 奔跑 |
| Space / Enter | 交互 / 确认 |
| Esc | 取消 / 系统菜单 |
| 1–9 | 快捷栏技能 |
| **移动端**：虚拟摇杆 | 移动 |
| **移动端**：轻触 | 交互 |

---

## 参与贡献

1. Fork → 功能分支 → 参考[开发指南](.github/copilot-instructions.md) → PR
2. 提交前运行 `make tsc` 和 `pnpm lint`

---

## 致谢

- **原作游戏**：西山居 (Kingsoft) —《剑侠情缘外传：月影传说》(2001)
> 这是一个粉丝制作的学习项目。游戏素材和知识产权归原始创作者所有。

---

<div align="center">

**⚔️ 剑气纵横三万里，一剑光寒十九洲 ⚔️**

*用现代 Web 技术重现经典武侠*

</div>
