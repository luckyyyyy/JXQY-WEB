# PathFinder 寻路系统

基于 C# `JxqyHD/Engine/PathFinder.cs` 实现，**完全由 Rust WASM 执行**（TS 端不保留 A* 实现）。

## 架构

- **实现**：`packages/engine-wasm/src/pathfinder.rs`（Rust）
- **桥接**：`packages/engine/src/wasm/wasm-path-finder.ts`（零拷贝共享内存）
- **性能**：~0.2–0.4ms / 次（PerfectMaxPlayerTry 500 上限），相比 JS 约 **10x** 提升
- **零 FFI 开销**：障碍物位图通过 `Uint8Array` 视图直接写入 WASM 线性内存；路径结果通过指针 + `Int32Array` 零拷贝读取
- **Debug 日志**：dev 构建下自动输出寻路耗时到 `console.debug`，release 构建通过 `cfg(debug_assertions)` 完全移除

## PathType 枚举

| PathType | 算法 | maxTry | 用途 |
|----------|------|--------|------|
| `PathOneStep` | Greedy Best-First | 10 | 单步寻路，敌人/循环巡逻 |
| `SimpleMaxNpcTry` | Greedy Best-First | 100 | NPC简单寻路 |
| `PerfectMaxNpcTry` | A* | 100 | NPC完美寻路（伙伴等） |
| `PerfectMaxPlayerTry` | A* | 500 | 玩家/普通NPC完美寻路 |
| `PathStraightLine` | 直线 | - | 飞行单位，忽略障碍 |
| `End` | - | - | 标记，使用角色默认PathType |

## 角色 PathType 映射

### Player

| 条件 | PathType |
|------|----------|
| `_pathFinder === 1` | `PerfectMaxPlayerTry` |
| 其他 | `PathOneStep` |

### Npc

| 优先级 | 条件 | PathType |
|--------|------|----------|
| 1 | `Kind === Flyer` | `PathStraightLine` |
| 2 | `_pathFinder === 1 \|\| isPartner` | `PerfectMaxNpcTry` |
| 3 | `Kind === Normal \|\| Kind === Eventer` | `PerfectMaxPlayerTry` |
| 4 | `_pathFinder === 0 \|\| isInLoopWalk \|\| isEnemy` | `PathOneStep` |
| 5 | 默认 | `PerfectMaxNpcTry` |

## 调用点 PathType 使用情况

| 调用场景 | PathType | 说明 |
|----------|----------|------|
| 鼠标点击走路 | 角色默认 | Player: PathOneStep |
| 脚本 PlayerGoto | 角色默认 | Player: PathOneStep |
| 脚本 PlayerRunTo | 角色默认 | Player: PathOneStep |
| NPC 跟随目标 | 角色默认 | 根据NPC类型决定 |
| NPC destinationMapPos | `PerfectMaxPlayerTry` | 脚本指定目的地，强制使用 |
| NPC 随机/循环走路 | 角色默认 | 根据NPC类型决定 |

## 文件对应关系

| C# 文件 | 实现文件 | 说明 |
|---------|----------|------|
| `Engine/PathFinder.cs` | `packages/engine-wasm/src/pathfinder.rs` | Rust A* 实现（唯一） |
| — | `packages/engine/src/wasm/wasm-path-finder.ts` | 零拷贝共享内存桥接层 |
| — | `packages/engine/src/utils/path-finder.ts` | 仅保留 PathType 枚举和方向工具函数（无 A*） |
| `Engine/Character.cs` (WalkTo/RunTo) | `packages/engine/src/character/base/character-movement.ts` | 直接调用 `findPathWasm()` |
| `Engine/Player.cs` (PathType) | `packages/engine/src/player/player.ts` | |
| `Engine/Npc.cs` (PathType) | `packages/engine/src/npc/npc.ts` | |

## 障碍物同步

| 位图 | 时机 | 说明 |
|------|------|------|
| 静态障碍物 | 地图加载时 | `syncStaticObstacles(map)` 一次性写入 |
| 动态障碍物 | 每帧 | `syncDynamicObstacles(npcMgr, objMgr, magicMgr)` 零拷贝刷新 NPC/OBJ/武功精灵位置 |

## Debug 日志

dev 构建输出格式：
```
[WASM PathFinder] PerfectMaxPlayerTry (53,163)→(46,166) 34pts 0.200ms
```
release 构建中通过 `cfg(debug_assertions)` 完全编译移除，零运行时开销。
