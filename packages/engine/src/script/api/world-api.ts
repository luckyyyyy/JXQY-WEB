/**
 * World APIs - Map, Obj, Camera, Audio, Effects, Timer implementations
 */

import { logger } from "../../core/logger";
import { difficultyFromLevelFile } from "../../character/level/difficulty";
import { tileToPixel } from "../../utils";
import { syncDynamicObstacles } from "../../wasm/wasm-path-finder";
import type { BlockingResolver } from "../blocking-resolver";
import type { AudioAPI, CameraAPI, EffectsAPI, MapAPI, ObjAPI, TimerAPI } from "./game-api";
import type { ScriptCommandContext } from "./types";

export function createMapAPI(ctx: ScriptCommandContext): MapAPI {
  return {
    load: async (mapName) => {
      await ctx.loadMap(mapName);
    },
    loadNpc: async (fileName) => {
      await ctx.loadNpcFile(fileName);
    },
    free: () => {
      /* JS uses garbage collection */
    },
    getCurrentPath: () => ctx.getCurrentMapPath(),
    setTime: (time) => {
      ctx.setMapTime(time);
    },
    setTrap: (trapIndex, trapFileName, mapName?) => {
      ctx.setMapTrap(trapIndex, trapFileName, mapName);
    },
    saveTrap: () => {
      ctx.saveMapTrap();
    },
  };
}

export function createObjAPI(ctx: ScriptCommandContext): ObjAPI {
  const { objManager } = ctx;

  return {
    load: async (fileName) => {
      await objManager.load(fileName);
    },
    add: async (fileName, x, y, direction) => {
      await objManager.addObjByFile(fileName, x, y, direction);
    },
    deleteCurrent: () => {
      /* no-op, handled by delObj with __id__ prefix */
    },
    delete: (nameOrId) => {
      if (nameOrId.startsWith("__id__:")) {
        objManager.deleteObjById(nameOrId.substring(7));
      } else {
        objManager.deleteObj(nameOrId);
      }
      // Re-sync the WASM dynamic obstacle bitmap immediately so same-frame
      // pathfinding (e.g. NpcGotoEx right after DelObj) sees the deletion.
      syncDynamicObstacles(ctx.npcManager, ctx.objManager, ctx.magicSpriteManager, ctx.player);
    },
    openBox: (nameOrId?) => {
      if (nameOrId) {
        objManager.openBox(nameOrId);
      }
    },
    closeBox: (nameOrId?) => {
      if (nameOrId) {
        objManager.closeBox(nameOrId);
      }
    },
    setScript: (nameOrId, scriptFile) => {
      objManager.setObjScript(nameOrId, scriptFile);
    },
    save: async (fileName?) => {
      await objManager.saveObj(fileName);
    },
    clearBody: () => {
      objManager.clearBodies();
    },
    getPosition: (nameOrId) => {
      const obj = objManager.getObj(nameOrId);
      return obj ? obj.tilePosition : null;
    },
    setPosition: (name, x, y) => {
      const obj = objManager.getObj(name) || objManager.getObjById(name);
      if (obj) {
        obj.setTilePosition(x, y);
      } else {
        logger.warn(`[ObjAPI] setPosition: obj not found: ${name}`);
      }
    },
    setOffset: (objName, x, y) => {
      const obj = objManager.getObj(objName) || objManager.getObjById(objName);
      if (obj) {
        obj.setOffset({ x, y });
      }
    },
    setKind: (objName, kind) => {
      const obj = objManager.getObj(objName) || objManager.getObjById(objName);
      if (obj) {
        obj.kind = kind;
        logger.log(`[ObjAPI] SetObjKind: obj=${objName}, kind=${kind}`);
      } else {
        logger.warn(`[ObjAPI] SetObjKind: obj not found: ${objName}`);
      }
    },
  };
}

export function createCameraAPI(ctx: ScriptCommandContext, resolver: BlockingResolver): CameraAPI {
  return {
    move: async (direction, distance, speed) => {
      ctx.cameraMoveTo(direction, distance, speed);
      if (!ctx.isCameraMoving()) return;
      await resolver.waitForCondition(() => !ctx.isCameraMoving());
    },
    moveTo: async (x, y, speed) => {
      const pixelPos = tileToPixel(x, y);
      ctx.cameraMoveToPosition(pixelPos.x, pixelPos.y, speed);
      if (ctx.isCameraMoveToPositionEnd()) return;
      await resolver.waitForCondition(() => ctx.isCameraMoveToPositionEnd());
    },
    setPosition: (x, y) => {
      const pixelPos = tileToPixel(x, y);
      ctx.setCameraPosition(pixelPos.x, pixelPos.y);
    },
    openWaterEffect: () => {
      ctx.screenEffects.openWaterEffect();
    },
    closeWaterEffect: () => {
      ctx.screenEffects.closeWaterEffect();
    },
  };
}

export function createAudioAPI(ctx: ScriptCommandContext, resolver: BlockingResolver): AudioAPI {
  const { audioManager, guiManager } = ctx;

  return {
    playMusic: (file) => {
      audioManager.playMusic(file);
    },
    stopMusic: () => {
      audioManager.stopMusic();
    },
    playSound: (file, emitterPosition?) => {
      if (emitterPosition) {
        audioManager.play3DSoundOnce(file, emitterPosition);
      } else {
        audioManager.playSound(file);
      }
    },
    stopSound: () => {
      audioManager.stopAllSounds();
    },
    playMovie: async (file) => {
      guiManager.playMovie(file);
      if (guiManager.isMovieEnd()) return;
      // Safety timeout: if UI never picks up the movie event (e.g. component
      // not mounted or event lost), don't block the script forever.
      const MOVIE_TIMEOUT_MS = 30_000;
      const startTime = performance.now();
      await resolver.waitForCondition(() => {
        if (guiManager.isMovieEnd()) return true;
        // Timeout fallback — force end if UI never responded
        if (performance.now() - startTime > MOVIE_TIMEOUT_MS) {
          logger.warn(`[WorldAPI] PlayMovie timeout after ${MOVIE_TIMEOUT_MS}ms, forcing end`);
          guiManager.forceEndMovie();
          return true;
        }
        return false;
      });
    },
    stopMovie: () => {
      guiManager.forceEndMovie();
    },
  };
}

export function createEffectsAPI(
  ctx: ScriptCommandContext,
  resolver: BlockingResolver
): EffectsAPI {
  const { player, screenEffects, weatherManager, levelManager } = ctx;

  return {
    fadeIn: async () => {
      screenEffects.fadeIn();
      if (screenEffects.isFadeInEnd()) return;
      await resolver.waitForCondition(() => screenEffects.isFadeInEnd());
    },
    fadeOut: async () => {
      screenEffects.fadeOut();
      if (screenEffects.isFadeOutEnd()) return;
      await resolver.waitForCondition(() => screenEffects.isFadeOutEnd());
    },
    changeMapColor: (r, g, b) => {
      screenEffects.setMapColor(r, g, b);
    },
    changeSpriteColor: (r, g, b) => {
      screenEffects.setSpriteColor(r, g, b);
    },
    beginRain: (fileName) => {
      weatherManager.beginRain(fileName);
    },
    endRain: () => {
      weatherManager.stopRain();
      screenEffects.setMapColor(255, 255, 255);
      screenEffects.setSpriteColor(255, 255, 255);
    },
    showRain: (level) => {
      if (level !== 0) {
        weatherManager.beginRain("");
      } else {
        weatherManager.stopRain();
      }
    },
    showSnow: (show) => {
      weatherManager.showSnow(show);
    },
    showRandomSnow: () => {
      // ShowRandomSnow() — same as ShowSnow(true) with randomized particles
      weatherManager.showSnow(true);
    },
    setMainLum: (level) => {
      // SetMainLum: dark overlay alpha = (255 - lum) / 255, lum = l>=31 ? 255 : (l+1)*7+32
      screenEffects.setMainLum(level);
      logger.log(`[EffectsAPI] SetMainLum: level=${level}`);
    },
    setPlayerLum: (level) => {
      // Value stored only; no visual effect.
      screenEffects.setPlayerLum(level);
    },
    setFadeLum: (level) => {
      screenEffects.setFadeLum(level);
    },
    petrify: (ms) => {
      let seconds = ms / 1000;
      seconds = player.petrifiedSeconds < seconds ? seconds : player.petrifiedSeconds;
      player.statusEffects.setPetrifySeconds(seconds, true);
    },
    poison: (ms) => {
      let seconds = ms / 1000;
      seconds = player.poisonSeconds < seconds ? seconds : player.poisonSeconds;
      player.statusEffects.setPoisonSeconds(seconds, true);
    },
    frozen: (ms) => {
      let seconds = ms / 1000;
      seconds = player.frozenSeconds < seconds ? seconds : player.frozenSeconds;
      player.statusEffects.setFrozenSeconds(seconds, true);
    },
    clearEffect: () => {
      player.statusEffects.toNormalState();
    },
    setLevelFile: async (file) => {
      // 路由到全局难度：能识别的文件名走 setDifficulty（玩家+伙伴一起重算）
      // 其他文件名只对 player.levelManager 起作用（兼容老脚本）
      const d = difficultyFromLevelFile(file);
      if (d) {
        await ctx.setDifficulty(d);
        return;
      }
      await levelManager.setLevelFile(file);
      player.recalculateBaseStats();
    },
  };
}

export function createTimerAPI(ctx: ScriptCommandContext): TimerAPI {
  const { timerManager } = ctx;

  return {
    open: (seconds) => {
      timerManager.openTimeLimit(seconds);
    },
    close: () => {
      timerManager.closeTimeLimit();
    },
    hide: () => {
      timerManager.hideTimerWnd();
    },
    setScript: (triggerSeconds, scriptFileName) => {
      timerManager.setTimeScript(triggerSeconds, scriptFileName);
    },
  };
}
