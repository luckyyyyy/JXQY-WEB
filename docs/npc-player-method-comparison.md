## NPC 和 Player 方法对照分析

### 📊 **NPC (Npc.cs vs npc.ts)**

| C# 方法/属性 | TS 实现状态 | 备注 |
|-------------|------------|------|
| **属性** | | |
| `PathType` (override) | ✅ 已实现 | `getPathType()` |
| `BlindMilliseconds` | ✅ 已实现 | |
| `IsAIDisabled` (static) | ✅ 已实现 | 使用全局函数 `isGlobalAIDisabled()` |
| `ActionPathTilePositionList` | ✅ 已实现 | `actionPathTilePositions` |
| **构造函数** | | |
| `Npc()` | ✅ 已实现 | |
| `Npc(string filePath)` | ✅ 已实现 | `fromFile()` 静态方法 |
| `Npc(KeyDataCollection)` | ✅ 已实现 | `fromConfig()` 静态方法 |
| `Initialize()` | ⚠️ 简化 | 未实现 C# 中 `if (_level < 0) SetPropToLevel(Player.Level + Level)` |
| **公共方法** | | |
| `DisableAI()` (static) | ✅ 已实现 | `disableGlobalAI()` |
| `EnableAI()` (static) | ✅ 已实现 | `enableGlobalAI()` |
| `HasObstacle(tilePosition)` | ✅ 已实现 | |
| `Update(GameTime)` | ✅ 已实现 | `update(deltaTime)` |
| `KeepDistanceWhenLifeLow()` | ✅ 已实现 | `keepDistanceWhenLifeLow()` |
| `CheckKeepDistanceWhenFriendDeath()` | ✅ 已实现 | `checkKeepDistanceWhenFriendDeath()` |
| **保护方法** | | |
| `PlaySoundEffect()` | ⚠️ 简化 | 3D 音效未实现，使用普通音效 |
| `FollowTargetFound()` | ✅ 已实现 | `followTargetFound()` |
| `FollowTargetLost()` | ✅ 已实现 | `followTargetLost()` |
| **私有方法** | | |
| `MoveToPlayer()` | ✅ 已实现 | `moveToPlayer()` |

---

### 📊 **Player (Player.cs vs player.ts)**

| C# 方法/属性 | TS 实现状态 | 备注 |
|-------------|------------|------|
| **属性** | | |
| `PathType` (override) | ✅ 已实现 | `getPathType()` |
| `Money` | ✅ 已实现 | |
| `Doing, DesX, DesY, Belong, Fight` | ✅ 已实现 | |
| `ControledCharacter` | ❌ 未实现 | 控制 NPC 角色功能（如控制召唤兽） |
| `WalkIsRun` | ✅ 已实现 | |
| `IsNotUseThewWhenRun` | ✅ 已实现 | |
| `IsManaRestore` | ✅ 已实现 | |
| `AddLifeRestorePercent` | ✅ 已实现 | |
| `AddManaRestorePercent` | ✅ 已实现 | |
| `AddThewRestorePercent` | ✅ 已实现 | |
| `ManaLimit` | ✅ 已实现 | |
| `CanInput` | ⚠️ 简化 | 在 `handleInput()` 中处理，`MouseInBound()` 未实现 |
| `CurrentMagicInUse` | ✅ 已实现 | 通过 `MagicListManager` |
| `XiuLianMagic` | ✅ 已实现 | 通过 `MagicListManager` |
| `NpcIniIndex` | ❌ 未实现 | 用于解析 NpcIni 文件名中的数字索引 |
| `SpecialAttackTexture` | ❌ 未实现 | 修炼武功的特殊攻击贴图 |
| `AutoAttackTarget` | ✅ 已实现 | |
| `_replacedMagic` | ❌ 未实现 | 装备替换武功系统 |
| **构造函数** | | |
| `Player()` | ✅ 已实现 | |
| `Player(string filePath)` | ✅ 已实现 | `loadFromFile()` |
| **公共方法** | | |
| `LoadMagicEffect()` | ❌ 未实现 | 加载武功被动效果（FlyIni/MagicToUseWhenBeAttacked） |
| `MouseInBound()` | ⚠️ 不需要 | Web 中通过 Canvas 事件隐式处理 |
| `HandleKeyboardInput()` | ✅ 已实现 | 物品快捷键 Z/X/C 和武功快捷键 A/S/D/F/G 在 `InputHandler` 中处理 |
| `HandleMoveKeyboardInput()` | ✅ 已实现 | `getKeyboardMoveDirection()` |
| `MoveToDirection()` | ✅ 已实现 | `moveInDirection()` |
| `HasObstacle()` | ⚠️ 简化 | 使用 `CollisionChecker`（检查 NPC/Obj，但缺少 `MagicManager` 检查） |
| `CanPerformeAttack()` | ✅ 已实现 | `canAttack()` |
| `CanUseMagic()` | ✅ 已实现 | |
| `MagicUsedHook()` | ✅ 已实现 | `MagicListManager.onMagicUsed()` + `updateCooldowns()` |
| `CanRunning()` | ✅ 已实现 | `consumeRunningThew()` |
| `CanRun()` | ✅ 已实现 | `canRunCheck()` |
| `CanJump()` | ✅ 已实现 | |
| `CheckMapTrap()` | ✅ 已实现 | 通过 `MapTrapManager` 处理 |
| `CheckMapTrapByPath()` | ❌ 未实现 | 路径陷阱检测（阻止寻路穿过陷阱） |
| `AssignToValue()` | ✅ 已实现 | `applyConfigToPlayer()` |
| `OnPerformeAttack()` | ❌ 未实现 | 切换 `SpecialAttackTexture` |
| `OnAttacking()` | ✅ 已实现 | `onAttacking()` - 使用 XiuLianMagic.AttackFile |
| `OnSitDown()` | ✅ 已实现 | `sitdown()` |
| `OnReplaceMagicList()` | ❌ 未实现 | 武功列表替换功能 |
| `OnRecoverFromReplaceMagicList()` | ❌ 未实现 | 恢复武功列表 |
| `Save()` | ⚠️ 简化 | 使用 JSON 存档 |
| `SetMagicFile()` | ✅ 已实现 | `Character.setFlyIni()` + `ScriptContext.setNpcMagicFile()` |
| `WalkTo()` (override) | ⚠️ 简化 | 未调用 `PartnersMoveTo` |
| `RunTo()` (override) | ⚠️ 简化 | 未调用 `PartnersMoveTo` |
| `ResetPartnerPosition()` | ✅ 已实现 | |
| `Equiping()` | ⚠️ 简化 | 缺少 `SetMagicHide` 和 `_replacedMagic` 逻辑 |
| `UnEquiping()` | ⚠️ 简化 | 缺少 `SetMagicHide` 和 `_replacedMagic` 逻辑 |
| `OnDeleteMagic()` | ✅ 已实现 | 在 `MagicListManager.deleteMagic()` 中处理 |
| `UseDrug()` | ⚠️ 简化 | 缺少队友药效传递（FighterFriendHasDrugEffect） |
| `AddMoney()` | ✅ 已实现 | |
| `AddMoneyValue()` | ✅ 已实现 | |
| `SetMoney()` | ✅ 已实现 | |
| `GetMoneyAmount()` | ✅ 已实现 | `getMoney()` |
| `AddMagic()` | ✅ 已实现 | |
| `AddExp()` | ✅ 已实现 | |
| `AddMagicExp()` | ✅ 已实现 | |
| `LevelUp()` | ✅ 已实现 | |
| `SetNpcIni()` (override) | ⚠️ 简化 | 未解析 `NpcIniIndex`，未更新 XiuLianMagic 贴图 |
| `Death()` (override) | ✅ 已实现 | `onDeath()` |
| `FullLife()` | ✅ 已实现 | |
| `LevelUpTo()` | ✅ 已实现 | |
| `UseMagic()` (override) | ⚠️ 简化 | 未处理 `_replacedMagic` 替换 |
| `EndControlCharacter()` | ❌ 未实现 | 结束控制角色 |
| `canRun()` | ✅ 已实现 | |
| `UpdateAutoAttack()` | ✅ 已实现 | |
| `UpdateTouchObj()` | ❌ 未实现 | 触碰物体脚本触发器 |
| `Update()` | ⚠️ 简化 | 缺少 ControledCharacter 支持等逻辑 |
| `AttackClosedAnemy()` | ❌ 未实现 | Ctrl 攻击最近敌人 |
| `Draw()` (override) | ⚠️ 简化 | 遮挡渲染（Stencil Buffer）在 Web Canvas 中难以实现 |
| `BuyGood()` | ✅ 已实现 | BuyManager + BuyGui 已完成 |

---

### 📋 **总结**

#### ❌ **完全未实现的功能（11个）**

1. **`ControledCharacter`** - 控制 NPC 角色（如控制召唤兽）
2. **`NpcIniIndex`** - 从 NpcIni 文件名解析数字索引（如 `z-杨影枫2.ini` → 2）
3. **`SpecialAttackTexture`** - 修炼武功的特殊攻击贴图
4. **`_replacedMagic`** - 装备替换武功系统（装备可替换武功的使用效果）
5. **`LoadMagicEffect()`** - 加载武功被动效果（FlyIni/MagicToUseWhenBeAttacked 到 Player）
6. **`OnReplaceMagicList()` / `OnRecoverFromReplaceMagicList()`** - 武功列表替换和恢复
7. **`OnPerformeAttack()`** - 攻击时切换 SpecialAttackTexture
8. **`CheckMapTrapByPath()`** - 路径陷阱检测（阻止寻路穿过陷阱）
9. **`EndControlCharacter()`** - 结束控制角色
10. **`UpdateTouchObj()`** - 触碰物体脚本触发器
11. **`AttackClosedAnemy()`** - Ctrl+右键 攻击最近敌人

#### ⚠️ **简化实现（11个）**

1. **NPC `Initialize()`** - 未实现 `if (_level < 0) SetPropToLevel(Player.Level + Level)`
2. **`PlaySoundEffect()`** - 未实现 3D 空间音效
3. **`Save()`** - 使用 JSON 存档而非 INI 格式
4. **`HasObstacle()`** - 检查 NPC/Obj 但缺少 `MagicManager.IsObstacle` 检查
5. **`WalkTo()` / `RunTo()` override** - 未调用 `PartnersMoveTo`（队友跟随）
6. **`Equiping()` / `UnEquiping()`** - 缺少 `SetMagicHide` 和 `_replacedMagic` 逻辑
7. **`UseDrug()`** - 缺少 `FighterFriendHasDrugEffect` 和 `FollowPartnerHasDrugEffect`
8. **`SetNpcIni()` override** - 未解析 `NpcIniIndex`，未更新 `XiuLianMagic` 贴图
9. **`UseMagic()` override** - 未处理 `_replacedMagic` 替换
10. **`Update()`** - 缺少 ControledCharacter 支持等逻辑
11. **`Draw()` override** - 遮挡渲染（Stencil Buffer）在 Web Canvas 中难以实现

#### ✅ **已完整实现的核心功能**

- 基本移动系统 (Walk/Run/Jump)
- 攻击系统（普攻、自动攻击、OnAttacking）
- 武功系统（使用、冷却、经验、OnDeleteMagic）
- 等级系统 (LevelUp/LevelUpTo)
- 金钱系统
- 属性恢复系统（站立/坐下）
- NPC AI 系统（寻路、追踪、攻击）
- 存档/读档
- 死亡处理
- Partner 跟随（NpcManager.partnersMoveTo 已实现）
- 地图陷阱检测 (CheckMapTrap)
- **快捷键系统** (Z/X/C 使用物品, A/S/D/F/G 使用武功)
- **商店系统** (BuyManager + BuyGui)

---

### 🔧 **建议优先实现**

1. **`UpdateTouchObj()`** - 触碰物体脚本触发器，对剧情推进很重要
2. **`CheckMapTrapByPath()`** - 路径陷阱检测，避免玩家走进陷阱
3. **`ControledCharacter`** - 如果游戏中有控制召唤兽的玩法
