# PathFinder 寻路系统

基于 C# `JxqyHD/Engine/PathFinder.cs` 实现

## PathType 枚举

| PathType | 算法 | maxTry | 用途 |
|----------|------|--------|------|
| `PathOneStep` | Greedy Best-First | 1 | 单步寻路，敌人/循环巡逻 |
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

| C# 文件 | TS 文件 |
|---------|---------|
| `Engine/PathFinder.cs` | `src/engine/core/pathFinder.ts` |
| `Engine/Character.cs` (WalkTo/RunTo) | `src/engine/character/character.ts` |
| `Engine/Player.cs` (PathType) | `src/engine/character/player.ts` |
| `Engine/Npc.cs` (PathType) | `src/engine/character/npc.ts` |
