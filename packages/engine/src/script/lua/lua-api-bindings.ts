/**
 * Lua API Bindings - Maps GameAPI to PascalCase Lua global functions
 *
 * All functions use PascalCase naming convention for Lua scripts.
 * Blocking operations (movement, dialogs, fades) are async JS functions
 * that wasmoon automatically bridges via coroutine yield/resume.
 */

import {
  LUA_API_FUNCTIONS,
  type LuaAPIFunction,
} from "@miu2d/shared/lib/monaco/gameApiDefinitions";
import type { GameAPI } from "../api/game-api";

export type { LuaAPIFunction };
export { LUA_API_FUNCTIONS };

// LuaAPIFunction interface and LUA_API_FUNCTIONS array live in
// @miu2d/shared/lib/monaco/gameApiDefinitions — that is the single source of truth.

/**
 * Register all GameAPI methods as PascalCase Lua global functions
 */
export function registerLuaAPIBindings(
  setGlobal: (name: string, value: unknown) => void,
  api: GameAPI
): void {
  // ===== Player =====
  setGlobal("SetPlayerPos", (x: number, y: number, name?: string) =>
    api.player.setPosition(x, y, name)
  );
  setGlobal("SetPlayerDir", (dir: number) => api.player.setDirection(dir));
  setGlobal("SetPlayerState", (state: number) => api.player.setState(state));
  setGlobal("PlayerWalkTo", (x: number, y: number) => api.player.walkTo(x, y));
  setGlobal("PlayerWalkToDir", (dir: number, steps: number) => api.player.walkToDir(dir, steps));
  setGlobal("PlayerRunTo", (x: number, y: number) => api.player.runTo(x, y));
  setGlobal("PlayerJumpTo", (x: number, y: number) => api.player.jumpTo(x, y));
  setGlobal("PlayerWalkToNonBlocking", (x: number, y: number) =>
    api.player.walkToNonBlocking(x, y)
  );
  setGlobal("PlayerRunToNonBlocking", (x: number, y: number) => api.player.runToNonBlocking(x, y));
  setGlobal("CenterCamera", () => api.player.centerCamera());
  setGlobal("SetWalkIsRun", (value: number) => api.player.setWalkIsRun(value));
  setGlobal("ToNonFightingState", () => api.player.toNonFightingState());
  setGlobal("PlayerChange", (index: number) => api.player.change(index));
  setGlobal("GetMoney", () => api.player.getMoney());
  setGlobal("SetMoney", (amount: number) => api.player.setMoney(amount));
  setGlobal("AddMoney", (amount: number) => api.player.addMoney(amount));
  setGlobal("GetExp", () => api.player.getExp());
  setGlobal("AddExp", (amount: number) => api.player.addExp(amount));
  setGlobal("GetPlayerStat", (name: string) => api.player.getStat(name));
  setGlobal("FullLife", () => api.player.fullLife());
  setGlobal("FullMana", () => api.player.fullMana());
  setGlobal("FullThew", () => api.player.fullThew());
  setGlobal("AddLife", (amount: number) => api.player.addLife(amount));
  setGlobal("AddMana", (amount: number) => api.player.addMana(amount));
  setGlobal("AddThew", (amount: number) => api.player.addThew(amount));
  setGlobal("AddLifeMax", (value: number) => api.player.addLifeMax(value));
  setGlobal("AddManaMax", (value: number) => api.player.addManaMax(value));
  setGlobal("AddThewMax", (value: number) => api.player.addThewMax(value));
  setGlobal("AddAttack", (value: number, type?: number) => api.player.addAttack(value, type));
  setGlobal("AddDefend", (value: number, type?: number) => api.player.addDefend(value, type));
  setGlobal("AddEvade", (value: number) => api.player.addEvade(value));
  setGlobal("LimitMana", (limit: boolean) => api.player.limitMana(limit));
  setGlobal("AddMoveSpeedPercent", (percent: number) => api.player.addMoveSpeedPercent(percent));
  setGlobal("IsEquipWeapon", () => api.player.isEquipWeapon());
  setGlobal("GetPlayerLevel", () => api.player.getLevel());
  setGlobal("SetPlayerLevel", (level: number) => api.player.setLevel(level));
  setGlobal("SetFightEnabled", (enabled: boolean) => api.player.setFightEnabled(enabled));
  setGlobal("SetJumpEnabled", (enabled: boolean) => api.player.setJumpEnabled(enabled));
  setGlobal("SetRunEnabled", (enabled: boolean) => api.player.setRunEnabled(enabled));
  setGlobal("SetPlayerMagicWhenAttacked", (magicFile: string, dir: number) =>
    api.player.setMagicWhenAttacked(magicFile, dir)
  );
  setGlobal("SavePlayerSnapshot", (key: string) => api.player.saveSnapshot(key));
  setGlobal("LoadPlayerSnapshot", (key: string) => api.player.loadSnapshot(key));

  // ===== NPC =====
  setGlobal("AddNpc", (npcFile: string, x: number, y: number, dir?: number) =>
    api.npc.add(npcFile, x, y, dir)
  );
  setGlobal("DeleteNpc", (name: string) => api.npc.delete(name));
  setGlobal("GetNpcPos", (name: string) => api.npc.getPosition(name));
  setGlobal("SetNpcPos", (name: string, x: number, y: number) => api.npc.setPosition(name, x, y));
  setGlobal("NpcWalkTo", (name: string, x: number, y: number) => api.npc.walkTo(name, x, y));
  setGlobal("NpcWalkToDir", (name: string, dir: number, steps: number) =>
    api.npc.walkToDir(name, dir, steps)
  );
  setGlobal("SetNpcActionFile", (name: string, stateType: number, asfFile: string) =>
    api.npc.setActionFile(name, stateType, asfFile)
  );
  setGlobal("NpcSpecialAction", (name: string, asfFile: string) =>
    api.npc.specialAction(name, asfFile)
  );
  setGlobal("NpcSpecialActionNonBlocking", (name: string, asfFile: string) =>
    api.npc.specialActionNonBlocking(name, asfFile)
  );
  setGlobal("NpcWalkToNonBlocking", (name: string, x: number, y: number) =>
    api.npc.walkToNonBlocking(name, x, y)
  );
  setGlobal("SetNpcLevel", (name: string, level: number) => api.npc.setLevel(name, level));
  setGlobal("SetNpcDir", (name: string, dir: number) => api.npc.setDirection(name, dir));
  setGlobal("SetNpcState", (name: string, state: number) => api.npc.setState(name, state));
  setGlobal("SetNpcRelation", (name: string, relation: number) =>
    api.npc.setRelation(name, relation)
  );
  setGlobal("SetNpcDeathScript", (name: string, scriptFile: string) =>
    api.npc.setDeathScript(name, scriptFile)
  );
  setGlobal("SetNpcScript", (name: string, scriptFile: string) =>
    api.npc.setScript(name, scriptFile)
  );
  setGlobal("ShowNpc", (name: string, visible: boolean) => api.npc.show(name, visible));
  setGlobal("MergeNpc", (npcFile: string) => api.npc.merge(npcFile));
  setGlobal("SaveNpc", (fileName?: string) => api.npc.save(fileName));
  setGlobal("NpcWatch", (char1: string, char2: string, watchType: number) =>
    api.npc.watch(char1, char2, watchType)
  );
  setGlobal("SetNpcAIEnabled", (enabled: boolean) => api.npc.setAIEnabled(enabled));
  setGlobal("SetNpcKind", (name: string, kind: number) => api.npc.setKind(name, kind));
  setGlobal("SetNpcMagicFile", (name: string, magicFile: string) =>
    api.npc.setMagicFile(name, magicFile)
  );
  setGlobal("SetNpcResource", (name: string, resFile: string) =>
    api.npc.setResource(name, resFile)
  );
  setGlobal("SetNpcAction", (name: string, action: number, x?: number, y?: number) =>
    api.npc.setAction(name, action, x, y)
  );
  setGlobal("SetNpcActionType", (name: string, actionType: number) =>
    api.npc.setActionType(name, actionType)
  );
  setGlobal("SetAllNpcScript", (name: string, scriptFile: string) =>
    api.npc.setAllScript(name, scriptFile)
  );
  setGlobal("SetAllNpcDeathScript", (name: string, scriptFile: string) =>
    api.npc.setAllDeathScript(name, scriptFile)
  );
  setGlobal("NpcAttack", (name: string, x: number, y: number) => api.npc.attack(name, x, y));
  setGlobal("NpcFollow", (follower: string, target: string) => api.npc.follow(follower, target));
  setGlobal("SetNpcMagicWhenAttacked", (name: string, magicFile: string, dir: number) =>
    api.npc.setMagicWhenAttacked(name, magicFile, dir)
  );
  setGlobal("AddNpcProperty", (name: string, property: string, value: number) =>
    api.npc.addProperty(name, property, value)
  );
  setGlobal("AddNpcMagic", (name: string, magicFile: string) => api.npc.addMagic(name, magicFile));
  setGlobal("SetNpcMagicLevel", (name: string, magicFile: string, level: number) =>
    api.npc.setMagicLevel(name, magicFile, level)
  );
  // DISABLED — see setNpcClickScriptCommand
  setGlobal("SetNpcClickScript", (_name: string, _scriptFile: string) => {
    // api.npc.setClickScript(name, scriptFile);
  });
  setGlobal("ChangeNpcLife", (name: string, amount: number) => api.npc.changeLife(name, amount));
  setGlobal("ChangeNpcMana", (name: string, amount: number) => api.npc.changeMana(name, amount));
  setGlobal("ChangeNpcThew", (name: string, amount: number) => api.npc.changeThew(name, amount));
  setGlobal("ChangeNpcFlyIni", (name: string, magicFile: string) =>
    api.npc.changeFlyIni(name, magicFile)
  );
  setGlobal("ChangeNpcFlyIni2", (name: string, magicFile: string) =>
    api.npc.changeFlyIni2(name, magicFile)
  );
  setGlobal("AddNpcFlyInis", (name: string, magicFile: string, distance: number) =>
    api.npc.addFlyInis(name, magicFile, distance)
  );
  setGlobal("SetNpcDestination", (name: string, x: number, y: number) =>
    api.npc.setDestination(name, x, y)
  );
  setGlobal("GetNpcCount", (kind: number, relation: number) => api.npc.getCount(kind, relation));
  setGlobal("SetNpcKeepAttack", (name: string, x: number, y: number) =>
    api.npc.setKeepAttack(name, x, y)
  );
  setGlobal("NpcFollowPlayer", (name: string) => api.npc.followPlayer(name));

  // ===== Goods =====
  setGlobal("AddGoods", (goodsName: string, count: number) => api.goods.add(goodsName, count));
  setGlobal("RemoveGoods", (goodsName: string, count: number) =>
    api.goods.remove(goodsName, count)
  );
  setGlobal("EquipGoods", (goodListIndex: number) => api.goods.equip(goodListIndex));
  setGlobal("GetGoodsCountByFile", (goodsFile: string) => api.goods.getCountByFile(goodsFile));
  setGlobal("GetGoodsCountByName", (goodsName: string) => api.goods.getCountByName(goodsName));
  setGlobal("ClearGoods", () => api.goods.clear());
  setGlobal("DeleteGoodsByName", (name: string, count?: number) =>
    api.goods.deleteByName(name, count)
  );
  setGlobal("HasGoodsFreeSpace", () => api.goods.hasFreeSpace());
  setGlobal("AddRandomGoods", (buyFileName: string) => api.goods.addRandom(buyFileName));
  setGlobal("BuyGoods", (buyFile: string, canSellSelfGoods: boolean) =>
    api.goods.buy(buyFile, canSellSelfGoods)
  );
  setGlobal("SetDropIni", (name: string, dropFile: string) => api.goods.setDropIni(name, dropFile));
  setGlobal("SetDropEnabled", (enabled: boolean) => api.goods.setDropEnabled(enabled));
  setGlobal("SaveGoodsSnapshot", (key: string) => api.goods.saveSnapshot(key));
  setGlobal("LoadGoodsSnapshot", (key: string) => api.goods.loadSnapshot(key));

  // ===== Magic =====
  setGlobal("AddMagic", (magicFile: string) => api.magic.add(magicFile));
  setGlobal("DeleteMagic", (magicFile: string) => api.magic.delete(magicFile));
  setGlobal("SetMagicLevel", (magicFile: string, level: number) =>
    api.magic.setLevel(magicFile, level)
  );
  setGlobal("GetMagicLevel", (magicFile: string) => api.magic.getLevel(magicFile));
  setGlobal("AddMagicExp", (magicFile: string, amount: number) =>
    api.magic.addExp(magicFile, amount)
  );
  setGlobal("ClearMagic", () => api.magic.clear());
  setGlobal("HasMagicFreeSpace", () => api.magic.hasFreeSpace());
  setGlobal("UseMagic", (magicFile: string, x?: number, y?: number) =>
    api.magic.use(magicFile, x, y)
  );

  // ===== Memo =====
  setGlobal("AddMemo", (text: string) => api.memo.add(text));
  setGlobal("DeleteMemo", (text: string) => api.memo.delete(text));
  setGlobal("AddMemoById", (id: number) => api.memo.addById(id));
  setGlobal("DeleteMemoById", (id: number) => api.memo.deleteById(id));
  setGlobal("ClearMemo", () => api.memo.clear());

  // ===== Map =====
  setGlobal("LoadMap", (mapName: string) => api.map.load(mapName));
  setGlobal("LoadMapNpc", (fileName: string) => api.map.loadNpc(fileName));
  setGlobal("FreeMap", () => api.map.free());
  setGlobal("GetCurrentMapPath", () => api.map.getCurrentPath());
  setGlobal("SetMapTime", (time: number) => api.map.setTime(time));
  setGlobal("SetTrap", (trapIndex: number, trapFileName: string, mapName?: string) =>
    api.map.setTrap(trapIndex, trapFileName, mapName)
  );
  setGlobal("SaveTrap", () => api.map.saveTrap());

  // ===== Obj =====
  setGlobal("LoadObj", (fileName: string) => api.obj.load(fileName));
  setGlobal("AddObj", (fileName: string, x: number, y: number, dir: number) =>
    api.obj.add(fileName, x, y, dir)
  );
  setGlobal("DeleteCurrentObj", () => api.obj.deleteCurrent());
  setGlobal("DeleteObj", (nameOrId: string) => api.obj.delete(nameOrId));
  setGlobal("OpenBox", (nameOrId?: string) => api.obj.openBox(nameOrId));
  setGlobal("CloseBox", (nameOrId?: string) => api.obj.closeBox(nameOrId));
  setGlobal("SetObjScript", (nameOrId: string, scriptFile: string) =>
    api.obj.setScript(nameOrId, scriptFile)
  );
  setGlobal("SaveObj", (fileName?: string) => api.obj.save(fileName));
  setGlobal("ClearBody", () => api.obj.clearBody());
  setGlobal("GetObjPos", (nameOrId: string) => api.obj.getPosition(nameOrId));
  setGlobal("SetObjOffset", (objName: string, x: number, y: number) =>
    api.obj.setOffset(objName, x, y)
  );
  setGlobal("SetObjPos", (name: string, x: number, y: number) => api.obj.setPosition(name, x, y));
  setGlobal("SetObjKind", (objName: string, kind: number) => api.obj.setKind(objName, kind));

  // ===== Camera =====
  setGlobal("CameraMove", (dir: number, distance: number, speed: number) =>
    api.camera.move(dir, distance, speed)
  );
  setGlobal("CameraMoveTo", (x: number, y: number, speed: number) =>
    api.camera.moveTo(x, y, speed)
  );
  setGlobal("SetCameraPos", (x: number, y: number) => api.camera.setPosition(x, y));
  setGlobal("OpenWaterEffect", () => api.camera.openWaterEffect());
  setGlobal("CloseWaterEffect", () => api.camera.closeWaterEffect());

  // ===== Audio =====
  setGlobal("PlayMusic", (file: string) => api.audio.playMusic(file));
  setGlobal("StopMusic", () => api.audio.stopMusic());
  setGlobal("PlaySound", (file: string) => api.audio.playSound(file));
  setGlobal("StopSound", () => api.audio.stopSound());
  setGlobal("PlayMovie", (file: string) => api.audio.playMovie(file));
  setGlobal("StopMovie", () => api.audio.stopMovie());

  // ===== Effects =====
  setGlobal("FadeIn", () => api.effects.fadeIn());
  setGlobal("FadeOut", () => api.effects.fadeOut());
  setGlobal("ChangeMapColor", (r: number, g: number, b: number) =>
    api.effects.changeMapColor(r, g, b)
  );
  setGlobal("ChangeSpriteColor", (r: number, g: number, b: number) =>
    api.effects.changeSpriteColor(r, g, b)
  );
  setGlobal("BeginRain", (fileName: string) => api.effects.beginRain(fileName));
  setGlobal("EndRain", () => api.effects.endRain());
  setGlobal("ShowRain", (level: number) => api.effects.showRain(level));
  setGlobal("ShowSnow", (show: boolean) => api.effects.showSnow(show));
  setGlobal("ShowRandomSnow", () => api.effects.showRandomSnow());
  setGlobal("SetMainLum", (level: number) => api.effects.setMainLum(level));
  setGlobal("SetPlayerLum", (level: number) => api.effects.setPlayerLum(level));
  setGlobal("SetFadeLum", (level: number) => api.effects.setFadeLum(level));
  setGlobal("Petrify", (ms: number) => api.effects.petrify(ms));
  setGlobal("Poison", (ms: number) => api.effects.poison(ms));
  setGlobal("Frozen", (ms: number) => api.effects.frozen(ms));
  setGlobal("ClearEffect", () => api.effects.clearEffect());
  setGlobal("MoveMagic", (magicFile: string, slotIndex: number) =>
    api.magic.moveToBottomSlot(magicFile, slotIndex)
  );
  setGlobal("SetLevelFile", (file: string) => api.effects.setLevelFile(file));

  // ===== Dialog =====
  // Say(text, portrait?) — text first, portrait optional (same order as DSL sayCommand)
  // Talk(text, portrait?) — same as Say for Lua convenience; consistent text-first convention
  setGlobal("Say", async (text: string, portraitIndex?: number) => {
    api.player.toNonFightingState();
    return api.dialog.show(text, portraitIndex ?? 0);
  });
  setGlobal("Talk", async (text: string, portraitIndex?: number) => {
    api.player.toNonFightingState();
    return api.dialog.show(text, portraitIndex ?? 0);
  });
  setGlobal("ShowTalk", (startId: number, endId: number) => {
    api.player.toNonFightingState();
    return api.dialog.showTalk(startId, endId);
  });
  setGlobal("ShowMessage", (text: string) => api.dialog.showMessage(text));
  setGlobal("Choose", (message: string, selectA: string, selectB: string) =>
    api.dialog.showSelection(message, selectA, selectB)
  );
  setGlobal("ShowSystemMessage", (msg: string, stayTime?: number) =>
    api.dialog.showSystemMessage(msg, stayTime)
  );

  // ===== Timer =====
  setGlobal("OpenTimer", (seconds: number) => api.timer.open(seconds));
  setGlobal("CloseTimer", () => api.timer.close());
  setGlobal("HideTimer", () => api.timer.hide());
  setGlobal("SetTimerScript", (triggerSeconds: number, scriptFile: string) =>
    api.timer.setScript(triggerSeconds, scriptFile)
  );

  // ===== Variables =====
  setGlobal("GetVar", (name: string) => api.variables.get(name));
  setGlobal("SetVar", (name: string, value: number) => api.variables.set(name, value));
  setGlobal("ClearAllVars", () => api.variables.clearAll());
  setGlobal("GetPartnerIndex", () => api.variables.getPartnerIndex());

  // ===== Input =====
  setGlobal("SetInputEnabled", (enabled: boolean) => api.input.setEnabled(enabled));

  // ===== Save =====
  setGlobal("SetSaveEnabled", (enabled: boolean) => api.save.setEnabled(enabled));
  setGlobal("ClearAllSaves", () => api.save.clearAll());

  // ===== Script Runner =====
  setGlobal("RunScript", (scriptFile: string) => api.script.run(scriptFile));
  setGlobal("RunParallelScript", (scriptFile: string, delay?: number) =>
    api.script.runParallel(scriptFile, delay)
  );
  setGlobal("ReturnToTitle", () => api.script.returnToTitle());
  setGlobal("Sleep", (ms: number) => api.script.sleep(ms));
  setGlobal("LoadGame", (index: number) => api.script.loadGame(index));
  setGlobal("SetInterfaceVisible", (visible: boolean) => api.script.setInterfaceVisible(visible));
  setGlobal("SaveGame", () => api.script.saveGame());
  setGlobal("UpdateState", () => api.script.updateState());
  setGlobal("ShowGamble", (cost: number, npcType: number) => api.script.showGamble(cost, npcType));
  setGlobal("SetShowMapPos", (show: boolean) => api.script.setShowMapPos(show));
  setGlobal("ShowMouseCursor", () => api.script.showMouseCursor());
  setGlobal("HideMouseCursor", () => api.script.hideMouseCursor());
  setGlobal("CheckYear", (varName: string) => {
    api.variables.checkYear(varName);
    return api.variables.get(varName);
  });

  // ===== Dialog Extended =====
  setGlobal("ChooseEx", async (message: string, ...options: string[]) => {
    const optionObjects = options.map((text) => ({ text }));
    return api.dialog.chooseEx(message, optionObjects, "");
  });
  setGlobal(
    "ChooseMultiple",
    async (
      columns: number,
      rows: number,
      varPrefix: string,
      message: string,
      ...options: string[]
    ) => {
      const optionObjects = options.map((text) => ({ text }));
      const results = await api.dialog.chooseMultiple(
        columns,
        rows,
        varPrefix,
        message,
        optionObjects
      );
      return results;
    }
  );
  setGlobal("Select", (messageId: number, optionAId: number, optionBId: number) =>
    api.dialog.selectByIds(messageId, optionAId, optionBId)
  );

  // ===== DSL-compatible aliases =====
  // These match original DSL command names so scripts can use either convention.

  // --- Player aliases ---
  setGlobal("GetPlayerState", (name: string) => api.player.getStat(name));
  setGlobal("GetMoneyNum", () => api.player.getMoney());
  setGlobal("SetMoneyNum", (amount: number) => api.player.setMoney(amount));
  setGlobal("GetPlayerExp", () => api.player.getExp());
  setGlobal("GetPlayerMagicLevel", (magicFile: string) => api.magic.getLevel(magicFile));
  setGlobal("PlayerGoto", (x: number, y: number) => api.player.walkTo(x, y));
  setGlobal("PlayerGotoEx", (x: number, y: number) => api.player.walkToNonBlocking(x, y));
  setGlobal("PlayerGotoDir", (dir: number, steps: number) => api.player.walkToDir(dir, steps));
  setGlobal("PlayerRunToEx", (x: number, y: number) => api.player.runToNonBlocking(x, y));
  setGlobal("SetPlayerScn", () => api.player.centerCamera());
  setGlobal("SetPlayrDir", (dir: number) => api.player.setDirection(dir)); // typo alias
  setGlobal("SetPlayerMagicToUseWhenBeAttacked", (magicFile: string, dir: number) =>
    api.player.setMagicWhenAttacked(magicFile, dir)
  );
  setGlobal("DisableFight", () => api.player.setFightEnabled(false));
  setGlobal("EnableFight", () => api.player.setFightEnabled(true));
  setGlobal("DisableJump", () => api.player.setJumpEnabled(false));
  setGlobal("EnableJump", () => api.player.setJumpEnabled(true));
  setGlobal("DisableRun", () => api.player.setRunEnabled(false));
  setGlobal("EnableRun", () => api.player.setRunEnabled(true));
  setGlobal("AddRandMoney", (min: number, max: number) => api.player.addRandMoney(min, max));
  setGlobal("SavePlayer", (key: string) => api.player.saveSnapshot(key ?? "default"));
  setGlobal("LoadPlayer", (index: number) => api.player.change(index ?? 0));
  setGlobal("PlayerAddEmotion", (_amount: number) => undefined); // stub – no engine support yet
  setGlobal("PlayerAddJustice", (_amount: number) => undefined); // stub – no engine support yet

  // --- NPC aliases ---
  setGlobal("LoadOneNpc", (file: string, x: number, y: number) => api.npc.add(file, x, y));
  setGlobal("LoadNpc", (file: string) => api.map.loadNpc(file));
  setGlobal("DelNpc", (name: string) => api.npc.delete(name));
  setGlobal("FollowNpc", (follower: string, target: string) => api.npc.follow(follower, target));
  setGlobal("Watch", (char1: string, char2: string, watchType: number) =>
    api.npc.watch(char1, char2, watchType)
  );
  setGlobal("SetNpcMagicToUseWhenBeAttacked", (name: string, magicFile: string, dir: number) =>
    api.npc.setMagicWhenAttacked(name, magicFile, dir)
  );
  setGlobal("SetNpcRes", (name: string, resFile: string) => api.npc.setResource(name, resFile));
  setGlobal("ChangeFlyIni", (name: string, magicFile: string) =>
    api.npc.changeFlyIni(name, magicFile)
  );
  setGlobal("ChangeFlyIni2", (name: string, magicFile: string) =>
    api.npc.changeFlyIni2(name, magicFile)
  );
  setGlobal("AddFlyInis", (name: string, magicFile: string, distance: number) =>
    api.npc.addFlyInis(name, magicFile, distance)
  );
  setGlobal("SetKeepAttack", (name: string, x: number, y: number) =>
    api.npc.setKeepAttack(name, x, y)
  );
  setGlobal("AddOneMagic", (name: string, magicFile: string) => api.npc.addMagic(name, magicFile));
  setGlobal("AddOneMogic", (name: string, magicFile: string) => api.npc.addMagic(name, magicFile)); // typo alias
  setGlobal("ChangeLife", (name: string, amount: number) => api.npc.changeLife(name, amount));
  setGlobal("ChangeMana", (name: string, amount: number) => api.npc.changeMana(name, amount));
  setGlobal("ChangeThew", (name: string, amount: number) => api.npc.changeThew(name, amount));
  setGlobal("SetPartnerLevel", (name: string, level: number) => api.npc.setLevel(name, level));
  setGlobal("NpcGoto", (name: string, x: number, y: number) => api.npc.walkTo(name, x, y));
  setGlobal("NpcGotoEx", (name: string, x: number, y: number) =>
    api.npc.walkToNonBlocking(name, x, y)
  );
  setGlobal("NpcGotoDir", (name: string, dir: number, steps: number) =>
    api.npc.walkToDir(name, dir, steps)
  );
  setGlobal("NpcSpecialActionEx", (name: string, asfFile: string) =>
    api.npc.specialAction(name, asfFile)
  );
  setGlobal("DisableNpcAI", () => api.npc.setAIEnabled(false));
  setGlobal("EnableNpcAI", () => api.npc.setAIEnabled(true));

  // --- Goods aliases ---
  setGlobal("DelGoods", (goodsName: string, count?: number) =>
    api.goods.remove(goodsName, count ?? 1)
  );
  setGlobal("DelGoodByName", (name: string, count?: number) => api.goods.deleteByName(name, count));
  setGlobal("AddRandGoods", (buyFileName: string) => api.goods.addRandom(buyFileName));
  setGlobal("GetGoodsNum", (goodsFile: string) => api.goods.getCountByFile(goodsFile));
  setGlobal("GetGoodsNumByName", (goodsName: string) => api.goods.getCountByName(goodsName));
  setGlobal("CheckFreeGoodsSpace", () => (api.goods.hasFreeSpace() ? 1 : 0));
  setGlobal("SellGoods", (buyFile: string) => api.goods.buy(buyFile, true));
  setGlobal("BuyGoodsOnly", (buyFile: string) => api.goods.buy(buyFile, false));
  setGlobal("EnableDrop", () => api.goods.setDropEnabled(true));
  setGlobal("EnabelDrop", () => api.goods.setDropEnabled(true)); // typo alias in original game
  setGlobal("DisableDrop", () => api.goods.setDropEnabled(false));
  setGlobal("SaveGoods", (key: string) => api.goods.saveSnapshot(key ?? "default"));
  setGlobal("LoadGoods", (key: string) => api.goods.loadSnapshot(key ?? "default"));

  // --- Magic aliases ---
  setGlobal("DelMagic", (magicFile: string) => api.magic.delete(magicFile));
  setGlobal("CheckFreeMagicSpace", () => (api.magic.hasFreeSpace() ? 1 : 0));

  // --- Obj aliases ---
  setGlobal("DelObj", (nameOrId: string) => api.obj.delete(nameOrId));
  setGlobal("DelCurObj", () => api.obj.deleteCurrent());
  setGlobal("OpenObj", (nameOrId?: string) => api.obj.openBox(nameOrId));
  setGlobal("SetObjOfs", (objName: string, x: number, y: number) =>
    api.obj.setOffset(objName, x, y)
  );
  setGlobal("SaveMapTrap", () => api.map.saveTrap());
  setGlobal("SetMapTrap", (idx: number, file: string) => api.map.setTrap(idx, file));

  // --- Camera/Effect aliases ---
  setGlobal("MoveScreen", (dir: number, distance: number, speed: number) =>
    api.camera.move(dir, distance, speed)
  );
  setGlobal("MoveScreenEx", (x: number, y: number, speed: number) =>
    api.camera.moveTo(x, y, speed)
  );
  setGlobal("ChangeAsfColor", (r: number, g: number, b: number) =>
    api.effects.changeSpriteColor(r, g, b)
  );
  setGlobal("SetMapPos", (x: number, y: number) => api.camera.setPosition(x, y));
  setGlobal("PetrifyMillisecond", (ms: number) => api.effects.petrify(ms));
  setGlobal("PoisonMillisecond", (ms: number) => api.effects.poison(ms));
  setGlobal("FrozenMillisecond", (ms: number) => api.effects.frozen(ms));

  // --- Timer aliases ---
  setGlobal("OpenTimeLimit", (seconds: number) => api.timer.open(seconds));
  setGlobal("CloseTimeLimit", () => api.timer.close());
  setGlobal("HideTimerWnd", () => api.timer.hide());
  setGlobal("SetTimeScript", (triggerSeconds: number, scriptFile: string) =>
    api.timer.setScript(triggerSeconds, scriptFile)
  );

  // --- Dialog aliases ---
  setGlobal("Message", (text: string) => api.dialog.showMessage(text));
  setGlobal("DisplayMessage", (text: string) => api.dialog.showMessage(text));
  setGlobal("MessageBox", (text: string) => api.dialog.showMessage(text));
  setGlobal("ShowSystemMsg", (msg: string, stayTime?: number) =>
    api.dialog.showSystemMessage(msg, stayTime)
  );

  // --- Memo aliases ---
  setGlobal("Memo", (text: string) => api.memo.add(text));
  setGlobal("AddToMemo", (textOrId: string | number) => api.memo.addFlexible(textOrId));
  setGlobal("DelMemo", (textOrId: string | number) => api.memo.deleteFlexible(textOrId));

  // --- Variable aliases ---
  setGlobal("GetPartnerIdx", () => api.variables.getPartnerIndex());
  setGlobal("ClearAllVar", (...keepVars: string[]) => api.variables.clearAll(keepVars));

  // --- Input aliases ---
  setGlobal("DisableInput", () => api.input.setEnabled(false));
  setGlobal("EnableInput", () => api.input.setEnabled(true));

  // --- Save aliases ---
  setGlobal("DisableSave", () => api.save.setEnabled(false));
  setGlobal("EnableSave", () => api.save.setEnabled(true));
  setGlobal("ClearAllSave", () => api.save.clearAll());

  // --- Script aliases ---
  setGlobal("HideInterface", () => api.script.setInterfaceVisible(false));
  setGlobal("ShowInterface", () => api.script.setInterfaceVisible(true));
  setGlobal("HideBottomWnd", () => api.script.setInterfaceVisible(false));
  setGlobal("ShowBottomWnd", () => api.script.setInterfaceVisible(true));
  setGlobal("RunScirpt", (scriptFile: string) => api.script.run(scriptFile)); // typo alias
  setGlobal("RandRun", async (probability: number, script1: string, script2: string) => {
    const rand = Math.floor(Math.random() * 100);
    return api.script.run(rand <= probability ? script1 : script2);
  });
  setGlobal("Gamble", (cost: number, npcType: number) => api.script.showGamble(cost, npcType));
}
