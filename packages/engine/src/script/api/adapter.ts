/**
 * GameAPI → ScriptContext Adapter
 *
 * Flattens the structured GameAPI into the flat ScriptContext interface
 * required by the existing custom script engine (script/commands + executor).
 *
 * New script engines (JS, Lua) should use GameAPI directly.
 */

import type { GameAPI } from "./game-api";
import type { ScriptContext } from "../commands/types";

export interface ScriptContextExtras {
  scriptBasePath: string;
  onScriptStart?: (filePath: string, totalLines: number, allCodes: string[]) => void;
  onLineExecuted?: (filePath: string, lineNumber: number) => void;
}

export function gameAPIToScriptContext(api: GameAPI, extras: ScriptContextExtras): ScriptContext {
  return {
    // System
    talkTextList: api.dialog.talkTextList,

    // Variables
    getVariable: api.variables.get,
    setVariable: api.variables.set,

    // Dialog (blocking → Promise)
    showDialog: api.dialog.show,
    showTalk: api.dialog.showTalk,
    showMessage: api.dialog.showMessage,
    showDialogSelection: api.dialog.showSelection,
    showSelection: api.dialog.showSelectionList,

    // Map
    loadMap: api.map.load,
    loadNpc: api.map.loadNpc,
    loadGame: api.script.loadGame,

    // Player position & movement (blocking → Promise)
    setPlayerPosition: api.player.setPosition,
    setPlayerDirection: api.player.setDirection,
    setPlayerState: api.player.setState,
    playerGoto: api.player.walkTo,
    playerGotoDir: api.player.walkToDir,
    playerRunTo: api.player.runTo,
    playerJumpTo: api.player.jumpTo,
    playerGotoEx: api.player.walkToNonBlocking,
    playerRunToEx: api.player.runToNonBlocking,

    // NPC
    addNpc: api.npc.add,
    deleteNpc: api.npc.delete,
    getNpcPosition: api.npc.getPosition,
    setNpcPosition: api.npc.setPosition,
    npcGoto: api.npc.walkTo,
    npcGotoNonBlocking: api.npc.walkToNonBlocking,
    npcGotoDir: api.npc.walkToDir,
    setNpcActionFile: api.npc.setActionFile,
    npcSpecialAction: api.npc.specialAction,
    npcSpecialActionNonBlocking: api.npc.specialActionNonBlocking,
    setNpcLevel: api.npc.setLevel,
    setNpcDirection: api.npc.setDirection,
    setNpcState: api.npc.setState,
    setNpcRelation: api.npc.setRelation,
    setNpcDeathScript: api.npc.setDeathScript,
    setNpcScript: api.npc.setScript,
    showNpc: api.npc.show,
    mergeNpc: api.npc.merge,
    saveNpc: api.npc.save,
    watch: api.npc.watch,
    enableNpcAI: () => api.npc.setAIEnabled(true),
    disableNpcAI: () => api.npc.setAIEnabled(false),

    // Camera (blocking → Promise)
    moveScreen: api.camera.move,
    moveScreenEx: api.camera.moveTo,
    setMapPos: api.camera.setPosition,
    openWaterEffect: api.camera.openWaterEffect,
    closeWaterEffect: api.camera.closeWaterEffect,

    // Goods
    addGoods: api.goods.add,
    removeGoods: api.goods.remove,
    equipGoods: api.goods.equip,
    addMoney: api.player.addMoney,
    addExp: api.player.addExp,

    // Player stats
    fullLife: api.player.fullLife,
    fullMana: api.player.fullMana,
    fullThew: api.player.fullThew,
    addLife: api.player.addLife,
    addMana: api.player.addMana,
    addThew: api.player.addThew,

    // Magic
    addMagic: api.magic.add,
    setMagicLevel: api.magic.setLevel,

    // Memo
    addMemo: api.memo.add,
    delMemo: api.memo.delete,
    addToMemo: api.memo.addById,
    delMemoById: api.memo.deleteById,

    // Obj
    loadObj: api.obj.load,
    addObj: api.obj.add,
    delCurObj: api.obj.deleteCurrent,
    delObj: api.obj.delete,
    openBox: api.obj.openBox,
    closeBox: api.obj.closeBox,
    addRandGoods: api.goods.addRandom,
    setObjScript: api.obj.setScript,
    saveObj: api.obj.save,
    clearBody: api.obj.clearBody,
    getObjPosition: api.obj.getPosition,

    // Trap
    setMapTrap: api.map.setTrap,

    // Game flow (blocking → Promise)
    sleep: api.script.sleep,
    playMusic: api.audio.playMusic,
    stopMusic: api.audio.stopMusic,
    playSound: api.audio.playSound,
    playMovie: api.audio.playMovie,
    fadeIn: api.effects.fadeIn,
    fadeOut: api.effects.fadeOut,
    changeMapColor: api.effects.changeMapColor,
    changeAsfColor: api.effects.changeSpriteColor,
    beginRain: api.effects.beginRain,
    endRain: api.effects.endRain,
    showSnow: api.effects.showSnow,
    freeMap: api.map.free,
    setLevelFile: api.effects.setLevelFile,

    // Timer
    openTimeLimit: api.timer.open,
    closeTimeLimit: api.timer.close,
    hideTimerWnd: api.timer.hide,
    setTimeScript: api.timer.setScript,

    // Input/ability control
    disableInput: () => api.input.setEnabled(false),
    enableInput: () => api.input.setEnabled(true),
    disableFight: () => api.player.setFightEnabled(false),
    enableFight: () => api.player.setFightEnabled(true),
    disableJump: () => api.player.setJumpEnabled(false),
    enableJump: () => api.player.setJumpEnabled(true),
    disableRun: () => api.player.setRunEnabled(false),
    enableRun: () => api.player.setRunEnabled(true),

    // Player extended
    setPlayerScn: api.player.centerCamera,
    getMoneyNum: api.player.getMoney,
    setMoneyNum: api.player.setMoney,
    getPlayerExp: api.player.getExp,
    getPlayerState: api.player.getStat,
    getPlayerMagicLevel: api.magic.getLevel,
    limitMana: api.player.limitMana,
    addMoveSpeedPercent: api.player.addMoveSpeedPercent,
    useMagic: api.magic.use,
    isEquipWeapon: api.player.isEquipWeapon,
    addAttack: api.player.addAttack,
    addDefend: api.player.addDefend,
    addEvade: api.player.addEvade,
    addLifeMax: api.player.addLifeMax,
    addManaMax: api.player.addManaMax,
    addThewMax: api.player.addThewMax,
    delMagic: api.magic.delete,
    setPlayerMagicToUseWhenBeAttacked: api.player.setMagicWhenAttacked,
    setWalkIsRun: api.player.setWalkIsRun,

    // NPC extended
    setNpcKind: api.npc.setKind,
    setNpcMagicFile: api.npc.setMagicFile,
    setNpcRes: api.npc.setResource,
    setNpcAction: api.npc.setAction,
    setNpcActionType: api.npc.setActionType,
    setAllNpcScript: api.npc.setAllScript,
    setAllNpcDeathScript: api.npc.setAllDeathScript,
    npcAttack: api.npc.attack,
    followNpc: api.npc.follow,
    setNpcMagicToUseWhenBeAttacked: api.npc.setMagicWhenAttacked,
    addNpcProperty: api.npc.addProperty,
    changeFlyIni: api.npc.changeFlyIni,
    changeFlyIni2: api.npc.changeFlyIni2,
    addFlyInis: api.npc.addFlyInis,
    setNpcDestination: api.npc.setDestination,
    getNpcCount: api.npc.getCount,
    setKeepAttack: api.npc.setKeepAttack,

    // Goods extended (blocking → Promise)
    buyGoods: api.goods.buy,
    getGoodsNum: api.goods.getCountByFile,
    getGoodsNumByName: api.goods.getCountByName,
    clearGoods: api.goods.clear,
    clearMagic: api.magic.clear,
    delGoodByName: api.goods.deleteByName,
    checkFreeGoodsSpace: api.goods.hasFreeSpace,
    checkFreeMagicSpace: api.magic.hasFreeSpace,
    setDropIni: api.goods.setDropIni,
    enableDrop: () => api.goods.setDropEnabled(true),
    disableDrop: () => api.goods.setDropEnabled(false),

    // Save
    saveMapTrap: api.map.saveTrap,
    clearAllSave: api.save.clearAll,
    enableSave: () => api.save.setEnabled(true),
    disableSave: () => api.save.setEnabled(false),

    // Variables
    clearAllVar: api.variables.clearAll,
    getPartnerIdx: api.variables.getPartnerIndex,

    // Effects
    petrifyMillisecond: api.effects.petrify,
    poisonMillisecond: api.effects.poison,
    frozenMillisecond: api.effects.frozen,

    // Misc
    runParallelScript: (scriptFile, delay) => api.script.runParallel(scriptFile, delay),
    setObjOfs: api.obj.setOffset,
    setShowMapPos: api.script.setShowMapPos,
    showSystemMsg: api.dialog.showSystemMessage,
    randRun: api.script.randRun,
    stopSound: api.audio.stopSound,

    // Dialog extended (blocking → Promise)
    chooseEx: api.dialog.chooseEx,
    chooseMultiple: api.dialog.chooseMultiple,

    // Character state
    toNonFightingState: api.player.toNonFightingState,

    // Script
    runScript: api.script.run,
    getCurrentMapPath: api.map.getCurrentPath,
    returnToTitle: api.script.returnToTitle,

    // Map time
    setMapTime: api.map.setTime,

    // Player change
    playerChange: api.player.change,

    // Debug hooks
    onScriptStart: extras.onScriptStart,
    onLineExecuted: extras.onLineExecuted,
  };
}
