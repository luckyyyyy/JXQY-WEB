# Character 属性对照文档

本文档列出 TypeScript `Character` 类的所有属性，与 C# `JxqyHD/Engine/Character.cs` 进行对比。

## 对比状态图例

| 符号 | 含义 |
|------|------|
| ✅ | 完全一致 |
| ⚠️ | 有差异（见说明） |
| ❌ | 未实现 |
| 🆕 | TypeScript 新增 |

---

## Identity 属性

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `name` | `Name` | `string` | 角色名称 | ✅ |
| `kind` | `Kind` | `CharacterKind` | 角色类型 (0=Player, 1=Fighter, 2=Eventer, 3=Follower) | ✅ |
| `relation` | `Relation` | `RelationType` | 关系类型 (0=Friend, 1=Enemy, 2=None) | ⚠️ C# 有 `_controledMagicSprite` 和 `_changeToOppositeMilliseconds` 影响 getter |
| `group` | `Group` | `number` | NPC 分组 | ✅ |

---

## 基础属性 (Stats)

### 生命/法力/体力 (有范围限制)

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `life` | `Life` | `number` | 当前生命值，限制在 [0, lifeMax] | ✅ |
| `lifeMax` | `LifeMax` | `number` | 最大生命值 | ✅ |
| `mana` | `Mana` | `number` | 当前法力值，限制在 [0, manaMax] | ✅ |
| `manaMax` | `ManaMax` | `number` | 最大法力值 | ✅ |
| `thew` | `Thew` | `number` | 当前体力值，限制在 [0, thewMax] | ✅ |
| `thewMax` | `ThewMax` | `number` | 最大体力值 | ✅ |

### 攻击/防御

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `attack` | `Attack` | `number` | 基础攻击力 | ⚠️ C# 有 `_weakByMagicSprite` 削弱逻辑 |
| `attack2` | `Attack2` | `number` | 攻击2 (火攻/魔攻) | ✅ |
| `attack3` | `Attack3` | `number` | 攻击3 (毒攻) | ✅ |
| `attackLevel` | `AttackLevel` | `number` | 攻击等级 | ⚠️ C# setter 会更新 FlyIni/FlyIni2 的等级 |
| `defend` | `Defend` | `number` | 基础防御力 | ⚠️ C# 有 `_weakByMagicSprite` 削弱逻辑 |
| `defend2` | `Defend2` | `number` | 防御2 (火防/魔防) | ✅ |
| `defend3` | `Defend3` | `number` | 防御3 (毒防) | ✅ |
| `evade` | `Evade` | `number` | 闪避率 | ✅ |
| — | `RealAttack` | `number` | 实际攻击 (含变身加成) | ❌ |
| — | `RealDefend` | `number` | 实际防御 (含变身加成) | ❌ |
| — | `RealEvade` | `number` | 实际闪避 (含变身加成) | ❌ |

### 经验/等级

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `exp` | `Exp` | `number` | 当前经验值 | ✅ |
| `levelUpExp` | `LevelUpExp` | `number` | 升级所需经验 | ✅ |
| `level` | `Level` | `number` | 等级 | ⚠️ C# getter 返回 `Math.Abs(_level)` |
| `canLevelUp` | `CanLevelUp` | `number` | 是否可升级 (1=是) | ✅ |

---

## 移动属性 (Movement)

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `walkSpeed` | `WalkSpeed` | `number` | 行走速度，最小值为 1 | ✅ |
| `addMoveSpeedPercent` | `AddMoveSpeedPercent` | `number` | 移动速度加成百分比 | ✅ |
| `visionRadius` | `VisionRadius` | `number` | 视野半径，默认 9 | ✅ |
| `attackRadius` | `AttackRadius` | `number` | 攻击半径，默认 1 | ✅ |
| `dialogRadius` | `DialogRadius` | `number` | 对话半径，默认 1 | ✅ |
| `path` | `Path` | `Vector2[]` | 移动路径 | ⚠️ C# 是 `LinkedList<Vector2>` |
| — | `ChangeMoveSpeedPercent` | `number` | 魔法改变的移动速度 | ❌ |
| — | `ChangeMoveSpeedFold` | `number` | 移动速度倍率 | ❌ |

---

## 状态属性 (State)

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `state` | `State` | `CharacterState` | 角色状态 (Stand, Walk, Attack...) | ✅ setter 有动画/音效更新 |
| `isDeath` | `IsDeath` | `boolean` | 是否死亡 | ✅ |
| `isDeathInvoked` | `IsDeathInvoked` | `boolean` | Death() 是否已调用 | ✅ |
| `isSitted` | `IsSitted` (field) | `boolean` | 是否坐下 | ✅ |
| `isFightDisabled` | `IsFightDisabled` | `boolean` | 是否禁用战斗 | ✅ |
| `isJumpDisabled` | `IsJumpDisabled` | `boolean` | 是否禁用跳跃 | ✅ |
| `isVisible` | `IsVisible` | `boolean` | 是否可见 | ⚠️ C# 基于 `InvisibleByMagicTime` |
| — | `IsRunDisabled` | `boolean` | 是否禁用奔跑 | ❌ |
| — | `IsHide` | `boolean` | 是否隐藏 | ❌ |
| — | `IsDraw` | `boolean` | 是否绘制 | ❌ |
| — | `IsInTransport` | `boolean` | 是否传送中 | ❌ |

---

## AI 属性

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `idle` | `Idle` | `number` | 攻击间隔（帧数） | ✅ |
| `aiType` | `AIType` | `number` | AI 类型 (0=正常, 1=随机移动+攻击, 2=随机移动不战斗) | ✅ |
| `stopFindingTarget` | `StopFindingTarget` | `number` | 停止寻找目标 | ✅ |
| `keepRadiusWhenLifeLow` | `KeepRadiusWhenLifeLow` | `number` | 生命低时保持半径 | ✅ |
| `lifeLowPercent` | `LifeLowPercent` | `number` | 生命低阈值百分比 (默认 20) | ✅ |
| `keepRadiusWhenFriendDeath` | `KeepRadiusWhenFriendDeath` | `number` | 友方死亡时保持半径 | ✅ |
| — | `IsRandMoveRandAttack` | `boolean` | AIType == 1 或 2 | ❌ (可用 getter 实现) |
| — | `IsNotFightBackWhenBeHit` | `boolean` | AIType == 2 | ❌ (可用 getter 实现) |

---

## 配置文件属性 (Configuration)

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `npcIni` | `NpcIniFileName` | `string` | NPC INI 文件名 | ⚠️ C# 有 `NpcIni` (StateMapList) |
| `bodyIni` | `BodyIni` | `string` | 尸体 INI | ⚠️ C# 是 `Obj` 对象 |
| `flyIni` | `FlyIni` | `string` | 主攻击武功 | ⚠️ C# 是 `Magic` 对象 |
| `flyIni2` | `FlyIni2` | `string` | 副攻击武功 | ⚠️ C# 是 `Magic` 对象 |
| `flyInis` | `FlyInis` | `string` | 武功列表 (格式: "名称:距离;...") | ✅ |
| `scriptFile` | `ScriptFile` | `string` | 交互剧本（左键） | ✅ |
| `scriptFileRight` | `ScriptFileRight` | `string` | 交互剧本（右键） | ✅ |
| `deathScript` | `DeathScript` | `string` | 死亡剧本 | ✅ |
| `timerScript` | `TimerScriptFile` | `string` | 定时剧本 | ✅ |
| `timerInterval` | `TimerScriptInterval` | `number` | 定时剧本间隔 (ms) | ✅ |
| `pathFinder` | `PathFinder` | `number` | 寻路类型 | ✅ |
| `noAutoAttackPlayer` | `NoAutoAttackPlayer` | `number` | 不自动攻击玩家 | ✅ |
| `canInteractDirectly` | `CanInteractDirectly` | `number` | 可直接交互 | ✅ |
| `dropIni` | `DropIni` | `string` | 掉落物 INI | ✅ |
| `expBonus` | `ExpBonus` | `number` | 经验奖励 (>0 表示 Boss) | ✅ |
| `buyIniFile` | `BuyIniFile` | `string` | 商店 INI | ✅ |
| `invincible` | `Invincible` | `number` | 无敌 | ✅ |
| `reviveMilliseconds` | `ReviveMilliseconds` | `number` | 复活时间 (ms) | ✅ |
| `leftMillisecondsToRevive` | `LeftMillisecondsToRevive` | `number` | 剩余复活时间 | ✅ |

---

## 其他属性

| TS 属性 | C# 属性 | 类型 | 说明 | 状态 |
|---------|---------|------|------|------|
| `lum` | `Lum` | `number` | 亮度 | ✅ |
| `action` | `Action` | `number` | 动作 | ✅ |
| `followTarget` | `FollowTarget` | `Character \| null` | 跟随目标 | ✅ |
| `isFollowTargetFound` | `IsFollowTargetFound` | `boolean` | 是否找到跟随目标 | ✅ |
| `isInSpecialAction` | `IsInSpecialAction` | `boolean` | 是否在特殊动作中 | ✅ |
| `specialActionLastDirection` | `_specialActionLastDirection` | `number` | 特殊动作前的方向 | ✅ |
| `specialActionFrame` | — | `number` | 特殊动作帧 | 🆕 |
| `specialActionAsf` | — | `string` | 特殊动作 ASF | 🆕 |
| `customActionFiles` | — | `Map<number, string>` | 自定义动作文件 | 🆕 |

---

## C# 有但 TS 未实现的属性

### 状态效果

| C# 属性 | 类型 | 说明 |
|---------|------|------|
| `FrozenSeconds` | `float` | 冰冻时间 |
| `PoisonSeconds` | `float` | 中毒时间 |
| `PetrifiedSeconds` | `float` | 石化时间 |
| `IsFrozened` | `bool` | 是否冰冻 |
| `IsPoisoned` | `bool` | 是否中毒 |
| `IsPetrified` | `bool` | 是否石化 |

### 魔法相关

| C# 属性 | 类型 | 说明 |
|---------|------|------|
| `MagicToUseWhenLifeLow` | `Magic` | 生命低时使用的武功 |
| `MagicToUseWhenBeAttacked` | `Magic` | 被攻击时使用的武功 |
| `MagicToUseWhenDeath` | `Magic` | 死亡时使用的武功 |
| `MagicToUseWhenAttack` | `Magic` | 攻击时使用的武功 |
| `ControledMagicSprite` | `MagicSprite` | 控制的魔法精灵 |
| `MovedByMagicSprite` | `MagicSprite` | 被魔法移动 |

### 装备系统

| C# 属性 | 类型 | 说明 |
|---------|------|------|
| `CanEquip` | `int` | 可装备 |
| `HeadEquip` | `string` | 头部装备 |
| `BodyEquip` | `string` | 身体装备 |
| `HandEquip` | `string` | 手部装备 |
| `FootEquip` | `string` | 脚部装备 |
| ... | ... | 更多装备槽位 |

### 召唤系统

| C# 属性 | 类型 | 说明 |
|---------|------|------|
| `SummonedByMagicSprite` | `MagicSprite` | 被召唤的魔法精灵 |
| `SummonedNpcsCount()` | `int` | 召唤的 NPC 数量 |

### 其他

| C# 属性 | 类型 | 说明 |
|---------|------|------|
| `FixedPos` | `string` | 固定路径 |
| `CurrentFixedPosIndex` | `int` | 当前固定路径索引 |
| `LevelIni` | `Dictionary` | 等级配置 |
| `BouncedVelocity` | `float` | 弹开速度 |
| `BouncedDirection` | `Vector2` | 弹开方向 |
| `VisibleVariableName` | `string` | 可见性变量名 |
| `VisibleVariableValue` | `int` | 可见性变量值 |
| `NoDropWhenDie` | `int` | 死亡不掉落 |

---

## 实现优先级

### 高优先级（战斗系统必需）

1. ❌ `FrozenSeconds` / `PoisonSeconds` / `PetrifiedSeconds` - 状态效果
2. ❌ `MagicToUseWhen*` - 触发式武功
3. ❌ `RealAttack` / `RealDefend` - 实际战斗数值
4. ❌ `ChangeMoveSpeedPercent` - 魔法速度调整

### 中优先级（功能完善）

1. ❌ 装备系统属性
2. ❌ 召唤系统属性
3. ❌ `MovedByMagicSprite` / `BouncedVelocity` - 魔法位移

### 低优先级

1. ❌ `FixedPos` / 固定路径系统
2. ❌ `VisibleVariableName` / 变量可见性
3. ❌ Bezier 移动相关属性

---

## 类型差异说明

### C# 使用对象，TS 使用字符串

| 属性 | C# 类型 | TS 类型 | 说明 |
|------|---------|---------|------|
| `FlyIni` | `Magic` | `string` | TS 存储文件路径，使用时加载 |
| `FlyIni2` | `Magic` | `string` | 同上 |
| `BodyIni` | `Obj` | `string` | 同上 |
| `NpcIni` | `StateMapList` | `string` | TS 存储文件路径 |

这是设计选择：Web 版采用懒加载策略，只在需要时加载资源。

### C# LinkedList vs TS Array

| 属性 | C# 类型 | TS 类型 |
|------|---------|---------|
| `Path` | `LinkedList<Vector2>` | `Vector2[]` |

TS 使用数组更简洁，性能对于游戏路径长度来说足够。
