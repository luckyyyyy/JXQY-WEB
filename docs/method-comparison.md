## 成员方法对比分析

### 1. Sprite.ts vs Sprite.cs

#### 方法对比

| C# 方法 | TS 方法 | 状态 | 差异说明 |
|---------|---------|------|----------|
| `Set(position, velocity, texture, direction)` | `set(...)` | ✅ 一致 | 使用属性 setter 触发副作用 |
| `PlayFrames(count, reverse)` | `playFrames(count, reverse)` | ✅ 一致 | |
| `PlayCurrentDirOnce()` | `playCurrentDirOnce()` | ✅ 一致 | |
| `PlayCurrentDirOnceReverse()` | `playCurrentDirOnceReverse()` | ✅ 一致 | |
| `EndPlayCurrentDirOnce()` | `endPlayCurrentDirOnce()` | ✅ 一致 | |
| `IsPlayCurrentDirOnceEnd()` | `isPlayCurrentDirOnceEnd()` | ✅ 一致 | |
| `IsFrameAtBegin()` | `isFrameAtBegin()` | ✅ 一致 | |
| `IsFrameAtEnd()` | `isFrameAtEnd()` | ✅ 一致 | |
| `SetDirectionValue(direction)` | `setDirectionValue(direction)` | ✅ 一致 | |
| `SetDirection(Vector2)` | `setDirection(Vector2)` | ✅ 一致 | 统一为重载方法 |
| `SetDirection(int)` | `setDirection(number)` | ✅ 一致 | 统一为重载方法 |
| `Update(GameTime)` | `update(deltaTime)` | ✅ 一致 | 参数为秒，内部转毫秒 |
| `Update(GameTime, speedFold)` | `update(deltaTime, speedFold)` | ✅ 一致 | |
| `Update(GameTime, direction, speedFold)` | `updateWithMovement(deltaTime, direction, speedFold)` | ✅ 一致 | 命名更清晰 |
| `MoveTo(direction, elapsedSeconds)` | `moveTo(direction, elapsedSeconds)` | ✅ 一致 | |
| `MoveTo(direction, elapsedSeconds, speedRatio)` | `moveTo(direction, elapsedSeconds, speedRatio)` | ✅ 一致 | |
| `MoveToNoNormalizeDirection(...)` | `moveToNoNormalizeDirection(...)` | ✅ 一致 | |
| `GetCurrentTexture()` | `getCurrentTexture()` | ✅ 一致 | 返回 Canvas 而非 Texture2D |
| `Draw(SpriteBatch, offX, offY)` | `draw(ctx, cameraX, cameraY, offX, offY)` | ✅ 一致 | 平台差异，Canvas API |
| `Draw(SpriteBatch, Color)` | `drawWithColor(ctx, cameraX, cameraY, color)` | ✅ 一致 | "black" 触发灰度效果 |
| `Draw(SpriteBatch, texture, Color, offX, offY)` | `drawWithColor(ctx, cameraX, cameraY, color, offX, offY)` | ✅ 一致 | 完整参数版本 |
| `SetTilePosition(x, y)` | `setTilePosition(tileX, tileY)` | ✅ 一致 | |

#### 属性对比

| C# 属性 | TS 属性 | 状态 | 差异说明 |
|---------|---------|------|----------|
| `PositionInWorld` | `positionInWorld` | ✅ 一致 | 有副作用：同步 mapX/mapY |
| `MapX` | `mapX` | ✅ 一致 | 有副作用：同步 positionInWorld |
| `MapY` | `mapY` | ✅ 一致 | 有副作用：同步 positionInWorld |
| `TilePosition` | `tilePosition` | ✅ 一致 | 有副作用：同步 positionInWorld |
| `Velocity` | `velocity` | ✅ 一致 | 直接公共属性 |
| `CurrentDirection` | `currentDirection` | ✅ 一致 | 有副作用：计算 frameBegin/End |
| `CurrentFrameIndex` | `currentFrameIndex` | ✅ 一致 | 有副作用：自动环绕 |
| `Texture` | `texture` | ✅ 一致 | 有副作用：重置动画状态 |
| `IsInPlaying` | `isInPlaying` | ✅ 一致 | 只读 getter |
| `FrameBegin` | `frameBegin` | ✅ 一致 | 只读 getter |
| `FrameEnd` | `frameEnd` | ✅ 一致 | 只读 getter |
| `Interval` | `interval` | ✅ 一致 | 只读 getter |
| `FrameCountsPerDirection` | `frameCountsPerDirection` | ✅ 一致 | 只读 getter |
| `Width` | `width` | ✅ 一致 | 只读 getter |
| `Height` | `height` | ✅ 一致 | 只读 getter |
| `Size` | `size` | ✅ 一致 | 只读 getter |
| `RegionInWorld` | `regionInWorld` | ✅ 一致 | virtual getter |
| `ReginInWorldBeginPosition` | `regionInWorldBeginPosition` | ✅ 一致 | virtual getter |
| `MovedDistance` | `movedDistance` | ✅ 一致 | 直接公共属性 |
| `FrameAdvanceCount` | `frameAdvanceCount` | ✅ 一致 | 直接公共属性 |
| `static DrawColor` | `static drawColor` | ✅ 简化 | 不区分雨天颜色 |

#### TS 扩展功能（C# 没有）

| TS 属性/方法 | 说明 |
|-------------|------|
| `isShow` | 控制是否显示（C# 在子类实现） |
| `spriteSet` | 角色状态精灵集 |
| `basePath`, `baseFileName` | 资源路径信息 |
| `drawHighlight()` | 高亮边缘绘制（对应 C# TextureGenerator.GetOuterEdge） |
| `setCustomActionFile()` | 自定义动作文件 |
| `loadCustomAsf()` | 加载自定义 ASF |
| `static clearCache()` | 清除精灵缓存 |

#### 属性简化（已完成）

以下属性已改为直接公共属性（无需 getter/setter）：
- ✅ `velocity` - 无副作用逻辑
- ✅ `movedDistance` - 无副作用逻辑
- ✅ `frameAdvanceCount` - 无副作用逻辑
- ✅ `isShow` - 无副作用逻辑（TS 扩展）

保留 getter/setter 的属性（有副作用）：
- `positionInWorld` - 同步更新 `_mapX`, `_mapY`
- `mapX`, `mapY` - 同步更新 `_positionInWorld`
- `tilePosition` - 同步更新 `_positionInWorld`
- `currentDirection` - 计算 `_frameBegin`, `_frameEnd`，方向改变时重置帧
- `texture` - 重置动画状态（elapsed, direction, frameIndex）
- `currentFrameIndex` - 自动环绕在 frameBegin/frameEnd 范围内

---

### 2. Obj.ts vs Obj.cs

#### 方法对比

| C# 方法 | TS 方法 | 状态 | 差异说明 |
|---------|---------|------|----------|
| `Load(filePath)` | `loadFromSection(section)` | ✅ 简化 | TS 使用预解析的 section 数据 |
| `Load(lines)` | - | ✅ 内化 | 解析逻辑在 loadFromSection 中 |
| `AssignToValue(nameValue)` | - | ✅ 内化 | 逻辑在 loadFromSection 中 |
| `SetObjFile(fileName)` | `setObjFile(fileName)` | ✅ 一致 | 实际加载由 ObjManager 处理 |
| `SetWaveFile(fileName)` | `setWaveFile(fileName)` | ✅ 一致 | |
| `InitializeFigure()` | `initializeFigure()` | ✅ 一致 | |
| `OpenBox()` | `openBox()` | ✅ 一致 | 返回目标帧索引 |
| `CloseBox()` | `closeBox()` | ✅ 一致 | 返回目标帧索引 |
| `SetOffSet(Vector2)` | `setOffset(Vector2)` | ✅ 一致 | 命名小写化 |
| `Update(GameTime)` | `update(deltaTime)` | ✅ 一致 | 通过    回调处理脚本和陷阱伤害 |
| `Draw(SpriteBatch)` | `draw(ctx, cameraX, cameraY, offX, offY)` | ✅ 一致 | Canvas API 版本 |
| `Save(keyDataCollection)` | `save()` | ✅ 一致 | 返回 ObjSaveData 对象 |
| `StartInteract(isRight)` | `startInteract(isRight, runScript)` | ✅ 一致 | 通过回调注入脚本执行器 |
| `UpdateSound()` | `getSoundPosition()` | ✅ 简化 | 由 ObjManager + AudioManager 处理 |
| `PlaySound()` | `shouldPlayLoopingSound()` | ✅ 简化 | 由 ObjManager + AudioManager 处理 |
| `PlayRandSound()` | `shouldPlayRandomSound()` | ✅ 简化 | 由 ObjManager + AudioManager 处理 |
| `AddKey(...)` | - | ✅ 内化 | 在 save() 中直接构建对象 |

#### 属性对比

| C# 属性 | TS 属性 | 状态 | 差异说明 |
|---------|---------|------|----------|
| `FileName` | `fileName` | ✅ 一致 | |
| `IsRemoved` | `isRemoved` | ✅ 一致 | |
| `RegionInWorld` | `regionInWorld` | ✅ 一致 | override，包含 offX/offY |
| `ObjName` | `objName` | ✅ 一致 | |
| `Kind` | `kind` | ✅ 一致 | TS 使用 ObjKind enum |
| `Dir` | `dir` | ✅ 一致 | 同时更新 currentDirection |
| `Damage` | `damage` | ✅ 一致 | |
| `Frame` | `frame` | ✅ 一致 | |
| `Height` | `height` | ✅ 一致 | |
| `Lum` | `lum` | ✅ 一致 | |
| `ObjFile` | `objFile` | ✅ 一致 | StateMapList 类型 |
| `ScriptFile` | `scriptFile` | ✅ 一致 | |
| `ScriptFileRight` | `scriptFileRight` | ✅ 一致 | |
| `CanInteractDirectly` | `canInteractDirectly` | ✅ 一致 | |
| `TimerScriptFile` | `timerScriptFile` | ✅ 一致 | |
| `TimerScriptInterval` | `timerScriptInterval` | ✅ 一致 | |
| `ReviveNpcIni` | `reviveNpcIni` | ✅ 一致 | |
| `ScriptFileJustTouch` | `scriptFileJustTouch` | ✅ 一致 | |
| `WavFile` | `wavFile` | ✅ 简化 | 不再直接创建 SoundEffect |
| `OffX` | `offX` | ✅ 一致 | |
| `OffY` | `offY` | ✅ 一致 | |
| `ReginInWorldBeginPosition` | `regionInWorldBeginPosition` | ✅ 继承 | 父类 Sprite 处理 |
| `IsObstacle` | `isObstacle` | ✅ 一致 | 计算属性 |
| `IsDrop` | `isDrop` | ✅ 一致 | 计算属性 |
| `IsAutoPlay` | `isAutoPlay` | ✅ 一致 | 计算属性 |
| `IsInteractive` | `isInteractive` | ✅ 一致 | 计算属性 |
| `HasInteractScript` | `hasInteractScript` | ✅ 一致 | 计算属性 |
| `HasInteractScriptRight` | `hasInteractScriptRight` | ✅ 一致 | 计算属性 |
| `IsTrap` | `isTrap` | ✅ 一致 | 计算属性 |
| `IsBody` | `isBody` | ✅ 一致 | 计算属性 |
| `MillisecondsToRemove` | `millisecondsToRemove` | ✅ 一致 | |
| - | `_wavFileSoundEffect` | - | C# 音效实例，TS 由 AudioManager 管理 |
| - | `_soundInstance` | - | C# 音效实例，TS 由 AudioManager 管理 |
| - | `_timeScriptParserCache` | - | C# 脚本缓存，TS 由 ScriptExecutor 处理 |

#### TS 扩展功能（C# 没有）

| TS 属性/方法 | 说明 |
|-------------|------|
| `id` | 唯一实例 ID（用于追踪） |
| `hasSound` | 检查是否有音效文件 |
| `isLoopingSound` | 检查是否为循环音效对象 |
| `isRandSound` | 检查是否为随机音效对象 |
| `soundId` | 获取音效唯一 ID（用于 AudioManager 3D 音效） |
| `setAsfTexture(asf)` | 从 ASF 数据设置纹理 |
| `static createFromFile(fileName)` | 异步从文件创建对象（用于 BodyIni） |
| `canInteract(isRight)` | 检查是否可交互（封装判断逻辑） |
| `getSoundFile()` | 获取音效文件路径 |

#### 枚举类型对比

| C# 枚举 | TS 枚举 | 状态 |
|---------|---------|------|
| `ObjKind.Dynamic = 0` | `ObjKind.Dynamic = 0` | ✅ 一致 |
| `ObjKind.Static = 1` | `ObjKind.Static = 1` | ✅ 一致 |
| `ObjKind.Body = 2` | `ObjKind.Body = 2` | ✅ 一致 |
| `ObjKind.LoopingSound = 3` | `ObjKind.LoopingSound = 3` | ✅ 一致 |
| `ObjKind.RandSound = 4` | `ObjKind.RandSound = 4` | ✅ 一致 |
| `ObjKind.Door = 5` | `ObjKind.Door = 5` | ✅ 一致 |
| `ObjKind.Trap = 6` | `ObjKind.Trap = 6` | ✅ 一致 |
| `ObjKind.Drop = 7` | `ObjKind.Drop = 7` | ✅ 一致 |
| `ObjState` (嵌套在使用处) | `ObjState` | ✅ 一致 | Common=0, Open=1, Opened=2, Closed=3 |

#### 架构说明：IEngineContext 模式

**TS 版本采用 `IEngineContext` 全局上下文模式**，让 Sprite 及其子类能够直接访问引擎服务：

```typescript
// Sprite 基类提供 engine 访问器
protected get engine(): IEngineContext | null {
  return getEngineContext();
}

// 子类可以直接使用
this.engine?.runScript(scriptPath);
this.engine?.getPlayer();
this.engine?.getNpcManager();
```

**优点**：
- 避免复杂的回调注入和依赖传递
- 与 C# 的全局访问模式（`Globals.ThePlayer`、`NpcManager`）概念一致
- 使用接口而非具体类，避免循环依赖

#### 架构差异说明

1. **音效管理**：
   - C#：Obj 内部持有 `SoundEffectInstance`，直接调用 `UpdateSound()` / `PlaySound()`
   - TS：音效由 `ObjManager` + `AudioManager` 协作处理，Obj 只保存 `wavFileName`

2. **资源加载**：
   - C#：同步加载，`Load(filePath)` 直接读取文件
   - TS：异步加载，`loadFromSection()` 接收预解析数据，实际加载由 `ObjManager` 处理

3. **脚本执行**：
   - C#：`StartInteract()` 直接调用 `ScriptManager.RunScript()`
   - TS：通过 `this.engine?.runScript()` 访问脚本执行器（IEngineContext 模式）

4. **陷阱伤害**：
   - C#：在 `Update()` 中直接访问 `NpcManager` 和 `Globals.ThePlayer`
   - TS：通过 `this.engine?.getNpcManager()` 和 `this.engine?.getPlayer()` 访问

5. **定时脚本**：
   - C#：`_timeScriptParserCache` 缓存解析后的脚本，直接调用 `ScriptManager.RunScript`
   - TS：通过 `this.engine?.runScript()` 执行

6. **跳跃障碍检测**：
   - C#：直接调用 `MapBase.Instance.IsObstacleForCharacterJump()` 和 `NpcManager.GetEventer()`
   - TS：通过 `this.engine?.getCollisionChecker()?.isMapObstacleForJump()` 和 `this.engine?.getNpcManager()?.getEventer()` 访问

#### IEngineContext 架构说明

TS 版本使用 `IEngineContext` 接口实现依赖注入，避免循环引用：

```typescript
// Sprite 基类通过 this.engine 访问引擎服务
protected get engine(): IEngineContext | null {
  return getEngineContext();
}

// 使用示例
const npcManager = this.engine?.getNpcManager();
const player = this.engine?.getPlayer();
await this.engine?.runScript(scriptPath);
```

主要接口方法：
- `getPlayer()` - 获取玩家实例
- `getNpcManager()` - 获取 NPC 管理器
- `getCollisionChecker()` - 获取碰撞检测器
- `getTrapManager()` - 获取陷阱管理器
- `runScript(path)` - 运行脚本
- `getScriptBasePath()` - 获取脚本基础路径
- `getCurrentMapName()` - 获取当前地图名称
- `hasTrapScript(tile)` - 检查瓦片是否有陷阱脚本

#### 实现状态

所有 C# Obj.cs 的核心功能已在 TS 中实现：
- ✅ `Update()` - 通过 `IEngineContext` 访问 NPC、Player 和脚本执行器
- ✅ `Save()` - 返回 `ObjSaveData` 对象用于存档
- ✅ `StartInteract()` - 通过 `IEngineContext` 运行脚本（不再需要回调）
- ✅ 音效方法 - 提供数据访问方法，实际播放由 `AudioManager` 处理

---

### 3. Character.ts vs Character.cs

| C# 方法 | TS 方法 | 状态 | 差异说明 |
|---------|---------|------|----------|
| `WalkTo(destination, pathType)` | `walkTo(destTile, pathTypeOverride)` | ✅ 一致 | |
| `RunTo(destination, pathType)` | `runTo(destTile, pathTypeOverride)` | ✅ 一致 | |
| `JumpTo(destination)` | `jumpTo(destTile)` | ✅ 一致 | |
| `PartnerMoveTo(destination)` | `partnerMoveTo(destination)` | ✅ 一致 | |
| `PerformActionOk()` | `canPerformAction()` / `performActionOk()` | ✅ 有别名 | |
| `StateInitialize(...)` | `stateInitialize(...)` | ✅ 一致 | |
| `HasObstacle(tilePosition)` | `hasObstacle(tilePosition)` | ✅ 一致 | |
| `IsStateImageOk(state)` | `isStateImageOk(state)` | ✅ 一致 | |
| `IsStanding()` | `isStanding()` | ✅ 一致 | |
| `IsWalking()` | `isWalking()` | ✅ 一致 | |
| `IsRuning()` | `isRunning()` | ✅ 一致 | |
| `IsSitting()` | `isSitting()` | ✅ 一致 | |
| `ClearFollowTarget()` | `clearFollowTarget()` | ✅ 一致 | |
| `GetRandTilePath(...)` | `getRandTilePath(...)` | ✅ 一致 | |
| `RandWalk(...)` | `randWalk(...)` | ✅ 一致 | |
| `LoopWalk(...)` | `loopWalk(...)` | ✅ 一致 | |
| `GetClosedAttackRadius(...)` | `getClosedAttackRadius(...)` | ✅ 一致 | |
| `GetRamdomMagicWithUseDistance(...)` | `getRandomMagicWithUseDistance(...)` | ✅ 一致 | |
| `MoveAlongPath(...)` | `moveAlongPath(...)` | ✅ 一致 | |
| **缺失方法** | | |
| `Attacking(destination, isRun)` | ✅ 在 Player 中实现 | NPC 也需要 |
| `PerformeAttack(destination, magic)` | ✅ 在 Player 中实现 | NPC 简化版 |
| `AttackingIsOk(out magic)` | `attackingIsOk()` | ✅ 在 Player/Npc 中有 | |
| `Sitdown()` | ✅ 在 Player 中实现 | 应放到 Character |
| `StandingImmediately()` | `standingImmediately()` | ✅ 一致 | |
| `Death()` | ❌ 在 Character 基类缺失 | 需要添加 |
| `FullLife()` | ❌ 缺失 | 需要添加 |
| `AddLife(amount)` | ❌ 缺失 | 需要添加 |
| `UseDrug(drug)` | ❌ 缺失 | 需要添加 |
| `Equiping(equip, current, justEffectType)` | ❌ 缺失 | 需要添加 |
| `UnEquiping(equip, justEffectType)` | ❌ 缺失 | 需要添加 |
| `AddMagic(fileName)` | ✅ 在 Player 中实现 | |
| `SetMagicFile(fileName)` | ❌ 缺失 | 需要添加 |
| `SetNpcIni(fileName)` | ❌ 缺失 | 需要添加 |
| `LevelUpTo(level)` | ✅ 在 Player 中实现 | |
| `Save(keyDataCollection)` | ❌ 缺失 | 存档用 |
| `WalkToDirection(direction, steps)` | `walkToDirection(direction, steps)` | ✅ 一致 | |
| `CanJump()` | `canJump()` | ✅ Player 重写 | |
| `CheckMapTrap()` | ❌ 缺失 | 陷阱系统 |
| `InteractWith(target, isRun, isRight)` | ❌ 缺失 | 交互系统 |
| `KeepMinTileDistance(target, minDistance)` | ✅ 在 Npc 中 | 应放到 Character |
| `MoveAwayTarget(...)` | ❌ 缺失 | 逃跑逻辑 |

---

### 3. Player.ts vs Player.cs

| C# 方法 | TS 方法 | 状态 | 差异说明 |
|---------|---------|------|----------|
| `HandleKeyboardInput()` | `handleInput(...)` | ✅ 简化版 | |
| `HandleMoveKeyboardInput()` | `getKeyboardMoveDirection(...)` | ✅ 简化版 | |
| `Update(GameTime)` | `update(deltaTime)` | ✅ 一致 | |
| `UpdateAutoAttack(gameTime)` | `updateAutoAttack(deltaTime)` | ✅ 一致 | |
| `Attacking(destination, isRun)` | `attacking(destination, isRun)` | ✅ 一致 | |
| `PerformeAttack(destination, magic)` | `performeAttack(destination)` | ✅ 简化 | |
| `AttackingIsOk(out magic)` | `attackingIsOk()` | ✅ 在父类 | |
| `Sitdown()` | `sitdown()` | ✅ 一致 | |
| `StandingImmediately()` | `standingImmediately()` | ✅ 重写 | |
| `AddExp(amount, addMagicExp)` | `addExp(amount, addMagicExp)` | ✅ 一致 | |
| `LevelUp()` | `levelUp()` | ✅ 一致 | |
| `LevelUpTo(level)` | `levelUpTo(level)` | ✅ 一致 | |
| `AddMoney(money)` | ❌ 缺失 | 需要添加 |
| `SetMoney(amount)` | ❌ 缺失 | 用 `money` setter |
| `GetMoneyAmount()` | ❌ 缺失 | 用 `money` getter |
| `AddMagic(magicFileName)` | `addMagic(magicFile, level)` | ✅ 异步版 | |
| `AddMagicExp(info, amount)` | 通过 MagicListManager | ✅ | |
| `BuyGood(good)` | ❌ 缺失 | 商店系统 |
| `UseMagic(magic, destination, target)` | ❌ 缺失 | 需要添加 |
| `ResetPartnerPosition()` | `resetPartnerPosition()` | ✅ 一致 | |
| `EndControlCharacter()` | ❌ 缺失 | 控制系统 |
| `Death()` | ❌ 缺失 | 需要添加 |
| `FullLife()` | ❌ 缺失 | 需要添加 |
| `SetNpcIni(fileName)` | ❌ 缺失 | 换装系统 |
| `Equiping(...)` / `UnEquiping(...)` | ❌ 缺失 | 装备系统 |
| `canRun(keyboardState)` | `canRun(isShiftDown)` | ✅ 简化 | |
| **C# Player 特有 Hook 方法** | | |
| `OnPerformeAttack()` | ❌ 缺失 | XiuLian 特殊攻击纹理 |
| `OnAttacking(destination)` | `onAttacking()` | ✅ 重写 | |
| `OnSitDown()` | ❌ 缺失 | |
| `CanPerformeAttack()` | `canAttack()` | ✅ Player 版 | |
| `CanUseMagic()` | ❌ 缺失 | 需要添加 |
| `CanRunning()` | `consumeRunningThew()` | ✅ 简化 | |

---

### 4. Npc.ts vs Npc.cs

| C# 方法 | TS 方法 | 状态 | 差异说明 |
|---------|---------|------|----------|
| `Update(GameTime)` | `update(deltaTime)` | ✅ 一致 | AI 逻辑完整 |
| `HasObstacle(tilePosition)` | `hasObstacle(tilePosition)` | ✅ 重写 | |
| `FollowTargetFound(attackCanReach)` | `followTargetFound(attackCanReach)` | ✅ 一致 | |
| `FollowTargetLost()` | `followTargetLost()` | ✅ 一致 | |
| `KeepDistanceWhenLifeLow()` | `keepDistanceWhenLifeLow()` | ✅ 一致 | |
| `CheckKeepDistanceWhenFriendDeath()` | `checkKeepDistanceWhenFriendDeath()` | ✅ 一致 | |
| `Attacking(destination)` | `attacking(destination)` | ✅ 一致 | |
| `static DisableAI()` | `disableGlobalAI()` | ✅ 模块函数 | |
| `static EnableAI()` | `enableGlobalAI()` | ✅ 模块函数 | |
| **缺失方法** | | |
| `MoveToPlayer()` | `moveToPlayer()` | ✅ private | |
| `Death()` | 通过 `onDeath(killer)` | ✅ 重写 | |
| `PlaySoundEffect(sound)` | 通过 `playStateSound(state)` | ✅ 简化 | |

---

## Getter/Setter 简化状态

### Sprite.ts（✅ 已完成简化）

**已简化为直接公共属性：**
- ✅ `velocity: number = 0`
- ✅ `movedDistance: number = 0`
- ✅ `frameAdvanceCount: number = 0`
- ✅ `isShow: boolean = true`

**保留 getter/setter（有副作用）：**
- `positionInWorld` - 同步更新 `_mapX`, `_mapY`
- `mapX`, `mapY` - 同步更新 `_positionInWorld`
- `tilePosition` - 同步更新 `_positionInWorld`
- `currentDirection` - 计算 `_frameBegin`, `_frameEnd`，方向改变时重置帧
- `texture` - 重置动画状态
- `currentFrameIndex` - 自动环绕

### Character.ts 中应简化的属性：
可改为直接公共属性的（目前已改）：
- `name`, `kind`, `relation`, `group`
- `attack`, `defend`, `evade`, `exp`, `level` 等
- 大量 config 字段

**需要保留特殊处理的：**
- `life`, `mana`, `thew` - 需要范围限制，但可用 setXxx 方法
- `walkSpeed` - 最小值限制
- `visionRadius`, `attackRadius`, `dialogRadius` - 默认值逻辑
- `state` - 触发纹理更新和音效
- `isVisible` - 同步 `isShow`
- `flyIni`, `flyIni2`, `flyInis` - 触发 `buildFlyIniInfos()`

---

## 主要差距总结

### 1. 缺失的重要方法

**Character 基类：**
- `Death()` - 死亡处理
- `FullLife()` - 满血复活
- `AddLife(amount)` - 生命变化
- `MoveAwayTarget(...)` - 逃跑逻辑
- `InteractWith(target, isRun, isRight)` - 交互系统
- `CheckMapTrap()` - 陷阱检测

**Player：**
- `AddMoney(money)` - 金钱变化提示
- `BuyGood(good)` - 商店购买
- `UseMagic(magic, destination, target)` - 主动使用武功
- `Equiping()` / `UnEquiping()` - 装备系统
- `OnPerformeAttack()` - 修炼武功特殊攻击纹理
- `CanUseMagic()` - 武功使用检查

### 2. 已实现但可能需要完善的方法
- `attackingIsOk()` - 需要完整的距离管理逻辑
- `onAttacking()` - 需要集成 FlyIni 武功发射
- `onMagicCast()` - 需要冷却时间处理

### 3. Sprite.ts 对标完成
Sprite.ts 已全面对标 C# Sprite.cs，所有核心方法和属性均已实现，属性简化已完成。