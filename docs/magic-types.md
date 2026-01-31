# 武功系统类型分析

基于 C# 版本 `JxqyHD/Engine/Magic.cs` 和 `MagicManager.cs` 的分析。

## 概述

武功系统有两个核心分类维度：
- **MoveKind** - 武功的移动/发射方式
- **SpecialKind** - 武功的特殊效果类型

资源文件位于 `/resources/ini/magic/`，共 58 个武功配置文件。

---

## MoveKind（移动类型）

共 24 种移动类型，决定武功精灵的运动轨迹和生成方式。

| MoveKind | 名称 | 说明 | 示例武功 |
|----------|------|------|----------|
| **1** | FixedPosition | 固定位置，在目标位置生成静止武功 | |
| **2** | Move | 直线飞行，从施法者飞向目标 | 长剑、烈火情天 |
| **3** | LineMove | 多段直线，连续发射多个弹道 | |
| **4** | CircleMove | 360° 圆形散射，向所有方向发射 | 烈火情天(高级)、漫天花雨(高级) |
| **5** | HeartMove | 心形轨迹发射 | |
| **6** | SpiralMove | 螺旋形发射 | |
| **7** | SectorMove | 扇形发射，向前方扇形区域 | 漫天花雨 |
| **8** | RandomSectorMove | 随机扇形发射（带延迟） | |
| **9** | FixedWall | 固定墙形，垂直于攻击方向 | |
| **10** | WallMove | 移动墙形，多道并行飞行 | |
| **11** | Region | 区域武功，根据 Region 参数细分形状 | |
| **13** | FollowCharacter | 跟随角色的 BUFF 类武功 | 金钟罩 |
| **15** | SuperMode | 超级模式，全屏攻击所有敌人 | 烈火情天(10级) |
| **16** | FollowEnemy | 追踪敌人的武功 | 错骨分身 |
| **17** | Throw | 抛物线轨迹武功 | |
| **18** | Empty | 空（占位，无实际效果） | |
| **19** | Kind19 | 持续时间武功（使用 KeepMilliseconds） | |
| **20** | Transport | 传送武功 | |
| **21** | ControlCharacter | 控制角色武功 | |
| **22** | Summon | 召唤 NPC | |
| **23** | TimeStop | 时间停止效果（跟随角色） | |
| **24** | VMove | V 形发射，多道 V 字排列 | |

### MoveKind 详细说明

#### MoveKind = 2（直线飞行）
最基础的攻击型武功，从施法者位置向目标方向飞行。
```ini
[Init]
MoveKind=2
Speed=8
```

#### MoveKind = 4（圆形散射）
向 32 个方向同时发射，覆盖 360° 范围。
```ini
[Level10]
MoveKind=4
```

#### MoveKind = 7（扇形发射）
向前方扇形区域发射，数量随等级增加。
```ini
[Init]
MoveKind=7
```

#### MoveKind = 11（区域武功）
需要配合 Region 参数使用，决定区域形状。

#### MoveKind = 13（跟随角色）
BUFF 类武功，效果取决于 SpecialKind：
- SpecialKind=1: 回复生命
- SpecialKind=2: 回复体力
- SpecialKind=3: 护盾保护
- SpecialKind=4/5: 隐身
- SpecialKind=7: 变身
- SpecialKind=8: 解除异常状态
- SpecialKind=9: 改变飞行姿态

#### MoveKind = 15（超级模式）
全屏攻击，自动命中视野内所有敌人。

#### MoveKind = 16（追踪敌人）
武功精灵会自动追踪最近的敌人。

---

## SpecialKind（特殊效果类型）

共 10 种特殊效果类型。

| SpecialKind | 名称 | 攻击效果 | BUFF效果(MoveKind=13) |
|-------------|------|----------|----------------------|
| **0** | None | 无特殊效果 | - |
| **1** | Freeze | 冰冻敌人 | 回复生命 |
| **2** | Poison | 中毒敌人 | 回复体力 |
| **3** | Petrify | 石化敌人 | 护盾保护（减少伤害） |
| **4** | InvisibleAttackVisible | - | 隐身（攻击时不现形） |
| **5** | InvisibleAttackShow | - | 隐身（攻击时现形） |
| **6** | Protection | 保护效果 | - |
| **7** | ChangeCharacter | - | 变身效果 |
| **8** | RemoveAbnormalState | - | 解除异常状态 |
| **9** | FlyIniChange | - | 改变飞行姿态 |

### SpecialKind 相关属性

```ini
SpecialKind=1           ; 特殊效果类型
SpecialKindValue=100    ; 效果数值
SpecialKindMilliSeconds=3000  ; 效果持续时间（毫秒）
NoSpecialKindEffect=0   ; 是否禁用特效动画
```

---

## Region（区域类型）

当 MoveKind=11 时，使用 Region 参数决定区域形状。

| Region | 名称 | 说明 |
|--------|------|------|
| **1** | Square | 方形区域 |
| **2** | Cross | 十字区域 |
| **3** | Rectangle | 矩形区域 |
| **4** | IsoscelesTriangle | 等腰三角形 |
| **5** | VType | V 形区域 |
| **6** | RegionFile | 使用外部区域文件定义 |

---

## AddonEffect（装备附加效果）

装备可以为武功附加额外效果。

| 值 | 名称 | 说明 |
|----|------|------|
| 0 | None | 无附加效果 |
| 1 | Frozen | 附加冰冻 |
| 2 | Poison | 附加中毒 |
| 3 | Petrified | 附加石化 |

---

## 武功配置文件结构

### 基础结构

```ini
[Init]
Name=武功名称
Intro=武功介绍
MoveKind=2              ; 移动类型
SpecialKind=0           ; 特殊效果
Speed=8                 ; 飞行速度
Region=0                ; 区域类型（MoveKind=11时使用）
AlphaBlend=1            ; 透明度混合
FlyingLum=15            ; 飞行亮度
VanishLum=15            ; 消失亮度
Image=xxx.asf           ; 施法图像
Icon=xxxs.asf           ; 图标
WaitFrame=4             ; 等待帧数
LifeFrame=50            ; 生命帧数
FlyingImage=xxx.asf     ; 飞行图像
FlyingSound=xxx.wav     ; 飞行音效
VanishImage=xxx.asf     ; 消失图像
VanishSound=xxx.wav     ; 消失音效
SuperModeImage=xxx.asf  ; 超级模式图像
Belong=0                ; 所属
ActionFile=xxx          ; 动作文件
AttackFile=xxx.ini      ; 攻击武功文件

[Level1]
Effect=270              ; 效果值（伤害/回复量）
ManaCost=10             ; 内力消耗
LevelupExp=500          ; 升级经验
MoveKind=2              ; 可覆盖移动类型
Speed=8                 ; 可覆盖速度

[Level2]
...

[Level10]
Effect=3500
ManaCost=500
MoveKind=15             ; 10级可能变为超级模式
Speed=16
```

### 玩家武功示例

**烈火情天** - 随等级提升移动类型
```ini
[Level1-2]  MoveKind=2   ; 直线飞行
[Level3-5]  MoveKind=7   ; 扇形发射
[Level6-9]  MoveKind=4   ; 圆形散射
[Level10]   MoveKind=15  ; 超级模式
```

**金钟罩** - BUFF 类武功
```ini
[Init]
MoveKind=13       ; 跟随角色
SpecialKind=3     ; 护盾保护
LifeFrame=80      ; 基础持续时间

[Level10]
Effect=30         ; 减少30点伤害
LifeFrame=6000    ; 持续6000帧
```

---

## Web 版实现对照

### 已实现

| 功能 | 文件 | 状态 |
|------|------|------|
| Magic 数据结构 | `src/engine/magic/magic.ts` | ✅ |
| MagicSprite 精灵 | `src/engine/magic/magicSprite.ts` | ✅ |
| MagicManager 管理器 | `src/engine/magic/magicManager.ts` | ✅ |
| 基础移动类型 | `src/engine/magic/effects/` | 部分 |

### 待实现的 MoveKind

- [ ] MoveKind=5 (HeartMove)
- [ ] MoveKind=6 (SpiralMove)
- [ ] MoveKind=11 (Region) 全部子类型
- [ ] MoveKind=19 (Kind19)
- [ ] MoveKind=20 (Transport)
- [ ] MoveKind=21 (ControlCharacter)
- [ ] MoveKind=22 (Summon)
- [ ] MoveKind=23 (TimeStop)
- [ ] MoveKind=24 (VMove)

### 待实现的 SpecialKind

- [ ] SpecialKind=4/5 (隐身)
- [ ] SpecialKind=7 (变身)
- [ ] SpecialKind=9 (改变飞行姿态)

---

## 参考文件

- C# 源码: `JxqyHD/Engine/Magic.cs`, `MagicManager.cs`, `MagicSprite.cs`
- 武功配置: `resources/ini/magic/*.ini`
- 武功精灵图: `resources/asf/magic/`, `resources/asf/effect/`
