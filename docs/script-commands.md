# 脚本命令参考手册

本文档详细介绍《月影传说》游戏引擎的所有脚本命令。

---

## 命令总表

### NPC 命令 (36个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| AddNpc | `AddNpc(npcFile, x, y, direction)` | 在指定位置添加 NPC | |
| LoadNpc | `LoadNpc(npcFile)` | 加载 NPC 配置文件 | |
| LoadOneNpc | `LoadOneNpc(npcFile, x, y)` | 加载单个 NPC 到位置 | |
| DeleteNpc | `DeleteNpc(name)` | 删除指定 NPC | |
| DelNpc | `DelNpc(name)` | 删除指定 NPC (别名) | |
| MergeNpc | `MergeNpc(npcFile)` | 合并加载 NPC 文件 | |
| SetNpcPos | `SetNpcPos(name, x, y)` | 设置 NPC 位置（瞬移） | |
| SetNpcDir | `SetNpcDir(name, direction)` | 设置 NPC 朝向 (0-7) | |
| SetNpcState | `SetNpcState(name, state)` | 设置 NPC 状态 | |
| SetNpcLevel | `SetNpcLevel(name, level)` | 设置 NPC 等级 | |
| NpcGoto | `NpcGoto(name, x, y)` | NPC 走到指定位置 | ✓ |
| NpcGotoEx | `NpcGotoEx(name, x, y)` | NPC 走到位置（非阻塞） | |
| NpcGotoDir | `NpcGotoDir(name, direction, steps)` | NPC 向方向走若干步 | ✓ |
| SetNpcActionFile | `SetNpcActionFile(name, state, asfFile)` | 设置 NPC 动画文件 | |
| NpcSpecialAction | `NpcSpecialAction(name, asfFile)` | 播放 NPC 特殊动画 | |
| NpcSpecialActionEx | `NpcSpecialActionEx(name, asfFile)` | 播放特殊动画（阻塞） | ✓ |
| ShowNpc | `ShowNpc(name, show)` | 显示/隐藏 NPC (1/0) | |
| SetNpcScript | `SetNpcScript(name, scriptFile)` | 设置 NPC 交互脚本 | |
| SetNpcDeathScript | `SetNpcDeathScript(name, scriptFile)` | 设置 NPC 死亡脚本 | |
| SaveNpc | `SaveNpc(fileName?)` | 保存 NPC 状态 | |
| DisableNpcAI | `DisableNpcAI()` | 禁用全局 NPC AI | |
| EnableNpcAI | `EnableNpcAI()` | 启用全局 NPC AI | |
| SetNpcRelation | `SetNpcRelation(name, relation)` | 设置 NPC 关系 (0友/1敌/2中立/3无) | |
| Watch | `Watch(char1, char2, type)` | 让角色面向另一角色 | |
| SetNpcKind | `SetNpcKind(name, kind)` | 设置 NPC 类型 (0-7) | |
| SetNpcMagicFile | `SetNpcMagicFile(name, magicFile)` | 设置 NPC 武功文件 | |
| SetNpcRes | `SetNpcRes(name, resFile)` | 设置 NPC 资源文件 | |
| SetNpcAction | `SetNpcAction(name, action, x?, y?)` | 设置 NPC 动作 | |
| SetNpcActionType | `SetNpcActionType(name, actionType)` | 设置 NPC 动作类型 | |
| SetAllNpcScript | `SetAllNpcScript(name, scriptFile)` | 设置所有同名 NPC 脚本 | |
| SetAllNpcDeathScript | `SetAllNpcDeathScript(name, scriptFile)` | 设置所有同名 NPC 死亡脚本 | |
| NpcAttack | `NpcAttack(name, x, y)` | 让 NPC 攻击位置 | |
| FollowNpc | `FollowNpc(follower, target)` | 让角色跟随另一角色 | |
| SetNpcMagicToUseWhenBeAttacked | `SetNpcMagicToUseWhenBeAttacked(name, magic, dir)` | 设置 NPC 反击武功 | |
| AddNpcProperty | `AddNpcProperty(name, property, value)` | 增加 NPC 属性值 | |
| ChangeFlyIni | `ChangeFlyIni(name, magicFile)` | 改变 NPC 飞行武功 | |
| ChangeFlyIni2 | `ChangeFlyIni2(name, magicFile)` | 改变 NPC 副飞行武功 | |
| AddFlyInis | `AddFlyInis(name, magicFile, distance)` | 添加距离触发飞行武功 | |
| SetNpcDestination | `SetNpcDestination(name, x, y)` | 设置 NPC 目的地 | |
| GetNpcCount | `GetNpcCount(kind1, kind2)` | 获取指定类型 NPC 数量→$NpcCount | |
| SetKeepAttack | `SetKeepAttack(name, x, y)` | 设置 NPC 持续攻击位置 | |

---

### 玩家命令 (35个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| SetPlayerPos | `SetPlayerPos(x, y)` | 设置玩家位置 | |
| SetPlayerDir | `SetPlayerDir(direction)` | 设置玩家朝向 (0-7) | |
| SetPlayerState | `SetPlayerState(state)` | 设置玩家状态 | |
| PlayerGoto | `PlayerGoto(x, y)` | 玩家走到位置 | ✓ |
| PlayerRunTo | `PlayerRunTo(x, y)` | 玩家跑到位置 | ✓ |
| PlayerGotoDir | `PlayerGotoDir(direction, steps)` | 玩家向方向走若干步 | ✓ |
| PlayerGotoEx | `PlayerGotoEx(x, y)` | 玩家走到位置（非阻塞） | |
| PlayerJumpTo | `PlayerJumpTo(x, y)` | 玩家跳到位置 | ✓ |
| PlayerRunToEx | `PlayerRunToEx(x, y)` | 玩家跑到位置（非阻塞） | |
| SetPlayerScn | `SetPlayerScn()` | 将摄像机居中到玩家 | |
| AddGoods | `AddGoods(goodsName, count)` | 添加物品 | |
| AddRandGoods | `AddRandGoods(buyFileName)` | 从商店文件随机添加物品 | |
| DelGoods | `DelGoods(goodsName, count)` | 删除物品 | |
| EquipGoods | `EquipGoods(equipType, goodsId)` | 装备物品 | |
| AddMoney | `AddMoney(amount)` | 添加金钱 | |
| AddRandMoney | `AddRandMoney(min, max)` | 添加随机金钱 | |
| AddExp | `AddExp(amount)` | 添加经验 | |
| FullLife | `FullLife()` | 完全恢复生命 | |
| FullMana | `FullMana()` | 完全恢复内力 | |
| FullThew | `FullThew()` | 完全恢复体力 | |
| AddLife | `AddLife(amount)` | 增减生命（可负） | |
| AddMana | `AddMana(amount)` | 增减内力（可负） | |
| AddThew | `AddThew(amount)` | 增减体力（可负） | |
| AddMagic | `AddMagic(magicFile)` | 添加武功 | |
| SetMagicLevel | `SetMagicLevel(magicFile, level)` | 设置武功等级 | |
| DelMagic | `DelMagic(magicFile)` | 删除武功 | |
| GetMoneyNum | `GetMoneyNum($var?)` | 获取金钱→$MoneyNum | |
| SetMoneyNum | `SetMoneyNum(amount)` | 设置金钱数量 | |
| GetPlayerExp | `GetPlayerExp($var)` / `GetExp($var)` | 获取经验值 | |
| GetPlayerState | `GetPlayerState(stateName, $var)` | 获取玩家属性值 | |
| GetPlayerMagicLevel | `GetPlayerMagicLevel(magicFile, $var)` | 获取武功等级 | |
| LimitMana | `LimitMana(enabled)` | 限制内力使用 (1/0) | |
| AddMoveSpeedPercent | `AddMoveSpeedPercent(percent)` | 增加移动速度百分比 | |
| AddAttack | `AddAttack(value, type?)` | 增加攻击力 | |
| AddDefend | `AddDefend(value, type?)` | 增加防御力 | |
| AddEvade | `AddEvade(value)` | 增加闪避 | |
| AddLifeMax | `AddLifeMax(value)` | 增加生命上限 | |
| AddManaMax | `AddManaMax(value)` | 增加内力上限 | |
| AddThewMax | `AddThewMax(value)` | 增加体力上限 | |
| UseMagic | `UseMagic(magicFile, x?, y?)` | 使用武功 | |
| IsEquipWeapon | `IsEquipWeapon($var)` | 检查是否装备武器→1/0 | |
| SetPlayerMagicToUseWhenBeAttacked | `SetPlayerMagicToUseWhenBeAttacked(magic, dir)` | 设置玩家反击武功 | |
| SetWalkIsRun | `SetWalkIsRun(value)` | 设置行走即奔跑 | |
| PlayerChange | `PlayerChange(index)` | 切换玩家角色 | |

---

### 对话命令 (9个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| Say | `Say(text, portraitIndex)` | 显示对话框 | ✓ |
| Talk | `Talk(startId, endId)` | 显示连续对话（从TalkIndex） | ✓ |
| Choose | `Choose(msg, optA, optB, $var)` | 显示二选一 | ✓ |
| Select | `Select(msgId, optAId, optBId, $var)` | 选择（使用TalkIndex文本） | ✓ |
| Message | `Message(text)` | 显示系统消息 | |
| DisplayMessage | `DisplayMessage(text)` | 显示系统消息（别名） | |
| ShowMessage | `ShowMessage(textId)` | 显示TalkIndex消息 | |
| ChooseEx | `ChooseEx(msg, opt1, opt2, ..., $var)` | 多选项选择（支持条件） | ✓ |
| ChooseMultiple | `ChooseMultiple(...)` | 多选项选择 | ✓ |

---

### 游戏状态命令 (20个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| LoadMap | `LoadMap(mapFile)` | 加载地图 | |
| LoadGame | `LoadGame(index)` | 加载存档 | |
| FreeMap | `FreeMap()` | 释放地图资源 | |
| If | `If($var op value) label` | 条件跳转 | |
| Goto | `Goto label` | 无条件跳转 | |
| Return | `Return` | 返回/结束脚本 | |
| Sleep | `Sleep(milliseconds)` | 暂停执行 | ✓ |
| RunScript | `RunScript(scriptFile)` | 运行脚本 | |
| Assign | `Assign($var, value)` | 设置变量 | |
| Add | `Add($var, value)` | 变量加法 | |
| Sub | `Sub($var, value)` | 变量减法 | |
| GetRandNum | `GetRandNum($var, min, max)` | 生成随机数 | |
| DisableInput | `DisableInput()` | 禁用玩家输入 | |
| EnableInput | `EnableInput()` | 启用玩家输入 | |
| DisableFight | `DisableFight()` | 禁用战斗 | |
| EnableFight | `EnableFight()` | 启用战斗 | |
| DisableJump | `DisableJump()` | 禁用跳跃 | |
| EnableJump | `EnableJump()` | 启用跳跃 | |
| DisableRun | `DisableRun()` | 禁用奔跑 | |
| EnableRun | `EnableRun()` | 启用奔跑 | |
| SetLevelFile | `SetLevelFile(file)` | 设置等级配置文件 | |
| ReturnToTitle | `ReturnToTitle()` | 返回标题画面 | |
| SetMapTime | `SetMapTime(time)` | 设置地图时间 | |
| RunParallelScript | `RunParallelScript(scriptFile, delay?)` | 并行运行脚本 | |

---

### 音频命令 (5个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| PlayMusic | `PlayMusic(musicFile)` | 播放背景音乐 | |
| StopMusic | `StopMusic()` | 停止背景音乐 | |
| PlaySound | `PlaySound(soundFile)` | 播放音效 | |
| PlayMovie | `PlayMovie(movieFile)` | 播放视频 | ✓ |
| StopSound | `StopSound()` | 停止所有音效 | |

---

### 屏幕效果命令 (7个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| FadeIn | `FadeIn()` | 淡入效果 | ✓ |
| FadeOut | `FadeOut()` | 淡出效果 | ✓ |
| MoveScreen | `MoveScreen(direction, distance, speed)` | 移动摄像机 | ✓ |
| MoveScreenEx | `MoveScreenEx(x, y, speed)` | 移动摄像机到位置 | ✓ |
| ChangeMapColor | `ChangeMapColor(r, g, b)` | 改变地图颜色 | |
| ChangeAsfColor | `ChangeAsfColor(r, g, b)` | 改变精灵颜色 | |
| SetMapPos | `SetMapPos(x, y)` | 设置摄像机位置 | |

---

### 天气命令 (3个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| BeginRain | `BeginRain(rainIniFile)` | 开始下雨 | |
| EndRain | `EndRain()` | 停止下雨 | |
| ShowSnow | `ShowSnow(show)` | 显示/隐藏下雪 (1/0) | |

---

### 物体命令 (11个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| LoadObj | `LoadObj(objFile)` | 加载物体配置文件 | |
| AddObj | `AddObj(objFile, x, y, direction)` | 添加物体 | |
| DelObj | `DelObj(objName)` | 删除物体 | |
| DelCurObj | `DelCurObj()` | 删除当前触发脚本的物体 | |
| OpenBox | `OpenBox(objName?)` | 打开箱子动画 | |
| OpenObj | `OpenObj(objName?)` | 打开物体动画（别名） | |
| CloseBox | `CloseBox(objName?)` | 关闭箱子动画 | |
| SetObjScript | `SetObjScript(objName, scriptFile)` | 设置物体脚本 | |
| SaveObj | `SaveObj(fileName?)` | 保存物体状态 | |
| SetObjOfs | `SetObjOfs(objName, x, y)` | 设置物体偏移 | |

---

### 陷阱命令 (3个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| SetTrap | `SetTrap(mapName, trapIndex, trapFile)` | 设置地图陷阱（指定地图） | |
| SetMapTrap | `SetMapTrap(trapIndex, trapFile)` | 设置当前地图陷阱 | |
| SaveMapTrap | `SaveMapTrap()` | 保存地图陷阱状态 | |

---

### 记事本命令 (3个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| Memo | `Memo(text)` | 添加记事（直接文本） | |
| AddToMemo | `AddToMemo(memoId)` | 添加记事（从TalkIndex） | |
| DelMemo | `DelMemo(textOrId)` | 删除记事 | |

---

### 计时器命令 (4个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| OpenTimeLimit | `OpenTimeLimit(seconds)` | 开始倒计时 | |
| CloseTimeLimit | `CloseTimeLimit()` | 关闭倒计时 | |
| HideTimerWnd | `HideTimerWnd()` | 隐藏计时器窗口 | |
| SetTimeScript | `SetTimeScript(seconds, scriptFile)` | 设置计时器触发脚本 | |

---

### 商店/物品扩展命令 (14个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| BuyGoods | `BuyGoods(buyFile, canSell?)` | 打开购买界面 | ✓ |
| SellGoods | `SellGoods(buyFile)` | 打开出售界面 | ✓ |
| BuyGoodsOnly | `BuyGoodsOnly(buyFile)` | 打开纯购买界面 | ✓ |
| GetGoodsNum | `GetGoodsNum(goodsFile)` | 获取物品数量→$GoodsNum | |
| GetGoodsNumByName | `GetGoodsNumByName(goodsName)` | 按名称获取物品数量 | |
| ClearGoods | `ClearGoods()` | 清空所有物品 | |
| ClearMagic | `ClearMagic()` | 清空所有武功 | |
| DelGoodByName | `DelGoodByName(name, count?)` | 按名称删除物品 | |
| CheckFreeGoodsSpace | `CheckFreeGoodsSpace($var)` | 检查物品栏空间→1/0 | |
| CheckFreeMagicSpace | `CheckFreeMagicSpace($var)` | 检查武功栏空间→1/0 | |
| SetDropIni | `SetDropIni(name, dropFile)` | 设置掉落配置 | |
| EnableDrop | `EnableDrop()` | 启用掉落 | |
| EnabelDrop | `EnabelDrop()` | 启用掉落（原版拼写错误别名） | |
| DisableDrop | `DisableDrop()` | 禁用掉落 | |

---

### 水效果命令 (2个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| OpenWaterEffect | `OpenWaterEffect()` | 开启水波效果 | |
| CloseWaterEffect | `CloseWaterEffect()` | 关闭水波效果 | |

---

### 存档命令 (4个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| ClearAllSave | `ClearAllSave()` | 删除所有存档 | |
| EnableSave | `EnableSave()` | 启用存档 | |
| DisableSave | `DisableSave()` | 禁用存档 | |

---

### 变量扩展命令 (2个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| ClearAllVar | `ClearAllVar(keep1, keep2, ...)` | 清空变量（保留指定） | |
| GetPartnerIdx | `GetPartnerIdx($var)` | 获取同伴索引 | |

---

### 状态效果命令 (3个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| PetrifyMillisecond | `PetrifyMillisecond(ms)` | 石化效果 | |
| PoisonMillisecond | `PoisonMillisecond(ms)` | 中毒效果 | |
| FrozenMillisecond | `FrozenMillisecond(ms)` | 冰冻效果 | |

---

### 其他命令 (5个)

| 命令 | 语法 | 说明 | 阻塞 |
|------|------|------|:----:|
| ClearBody | `ClearBody()` | 清除尸体 | |
| SetShowMapPos | `SetShowMapPos(show)` | 显示/隐藏地图坐标 | |
| ShowSystemMsg | `ShowSystemMsg(msg, stayTime?)` | 显示系统消息 | |
| RandRun | `RandRun($prob, script1, script2)` | 随机运行脚本 | |

---

## 枚举值参考

### CharacterKind (NPC类型)

| 值 | 类型 | 说明 |
|---|---|---|
| 0 | Normal | 普通 NPC，站在原地 |
| 1 | Fighter | 战斗型，启用 AI |
| 2 | Player | 玩家控制角色 |
| 3 | Follower | 跟随者/同伴 |
| 4 | GroundAnimal | 地面动物 |
| 5 | Eventer | 事件触发器 |
| 6 | AfraidPlayerAnimal | 怕玩家的动物 |
| 7 | Flyer | 飞行敌人 |

### RelationType (关系类型)

| 值 | 类型 | 说明 |
|---|---|---|
| 0 | Friend | 友方 |
| 1 | Enemy | 敌方 |
| 2 | Neutral | 中立 |
| 3 | None | 无关系（攻击所有） |

### CharacterState (角色状态)

| 值 | 状态 | 说明 |
|---|---|---|
| 0 | Stand | 站立 |
| 1 | Stand1 | 站立变体 |
| 2 | Walk | 行走 |
| 3 | Run | 奔跑 |
| 4 | Jump | 跳跃 |
| 5 | FightStand | 战斗站立 |
| 6 | FightWalk | 战斗行走 |
| 7 | FightRun | 战斗奔跑 |
| 8 | FightJump | 战斗跳跃 |
| 9 | Attack | 攻击 |
| 10 | Attack1 | 攻击1 |
| 11 | Attack2 | 攻击2 |
| 12 | Magic | 施法 |
| 13 | Hurt | 受伤 |
| 14 | Death | 死亡 |
| 15 | Sit | 坐下 |
| 16 | Special | 特殊 |

### Direction (方向)

```
    0(北)
  7   1
6       2
  5   3
    4(南)
```

---

## 条件运算符

If 命令支持的条件运算符：

| 运算符 | 说明 |
|--------|------|
| `==` | 等于 |
| `!=` 或 `<>` | 不等于 |
| `>` 或 `>>` | 大于 |
| `<` 或 `<<` | 小于 |
| `>=` | 大于等于 |
| `<=` | 小于等于 |

---

## 典型用法示例

### SetNpcKind 使用场景

```
// 让 NPC 走到指定位置的标准模式
SetNpcKind("纳兰真", 1);      // 设为 Fighter，启用 AI
NpcGoto("纳兰真", 13, 39);    // 阻塞式移动
SetNpcKind("纳兰真", 2);      // 设为 Player，停止 AI
```

### 场景切换

```
LimitMana(1);
PlayerChange(1);
LoadMap("map_051_海边.map");
ChangeMapColor(255, 255, 255);
ChangeAsfColor(255, 255, 255);
SetPlayerPos(19, 38);
SetPlayerDir(3);
SetMapPos(8, 23);
LoadNpc("seashore.npc");
LoadObj("map051_obj.obj");
FadeIn();
```

### 对话

```
Say("蓝衣少女：你醒啦！", 9);
Say("杨影枫：这里是什么地方？", 2);
Say("纳兰真：这是<color=Red>忘忧岛<color=Black>。", 9);
```

### 条件分支

```
If($Event == 100) label_100
If($Event > 200) label_200
Goto default_label

@label_100
Say("事件100", 0);
Return;

@label_200
Say("事件大于200", 0);
Return;

@default_label
Say("默认", 0);
Return;
```

---

## 参考资料

- 原版 C# 实现: `JxqyHD/Engine/Script/ScriptExecuter.cs`
- TypeScript 实现: `packages/engine/src/script/commands/`
- 类型定义: `packages/engine/src/core/types.ts`
