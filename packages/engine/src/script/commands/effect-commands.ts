/**
 * Effect Commands - Screen effects, weather, camera, status effects
 * Based on JxqyHD Engine/Script/ScriptExecuter.cs
 */
import type { CommandHandler, CommandRegistry } from "./types";

// ============= Screen Effects =============

/**
 * FadeIn - Fade in effect (BLOCKING)
 */
const fadeInCommand: CommandHandler = async (_params, _result, helpers) => {
  await helpers.api.effects.fadeIn();
  return true;
};

/**
 * FadeOut - Fade out effect (BLOCKING)
 */
const fadeOutCommand: CommandHandler = async (_params, _result, helpers) => {
  await helpers.api.effects.fadeOut();
  return true;
};

/**
 * MoveScreen - Move camera (BLOCKING)
 */
const moveScreenCommand: CommandHandler = async (params, _result, helpers) => {
  const direction = helpers.resolveNumber(params[0] || "0");
  const distance = helpers.resolveNumber(params[1] || "100");
  const speed = helpers.resolveNumber(params[2] || "1");
  await helpers.api.camera.move(direction, distance, speed);
  return true;
};

/**
 * ChangeMapColor - Change map tint color
 */
const changeMapColorCommand: CommandHandler = (params, _result, helpers) => {
  const r = helpers.resolveNumber(params[0] || "255");
  const g = helpers.resolveNumber(params[1] || "255");
  const b = helpers.resolveNumber(params[2] || "255");
  helpers.api.effects.changeMapColor(r, g, b);
  return true;
};

/**
 * ChangeAsfColor - Change sprite tint color
 */
const changeAsfColorCommand: CommandHandler = (params, _result, helpers) => {
  const r = helpers.resolveNumber(params[0] || "255");
  const g = helpers.resolveNumber(params[1] || "255");
  const b = helpers.resolveNumber(params[2] || "255");
  helpers.api.effects.changeSpriteColor(r, g, b);
  return true;
};

// ============= Weather =============

/**
 * BeginRain - Start rain effect
 * WeatherManager.BeginRain(string fileName)
 */
const beginRainCommand: CommandHandler = (params, _result, helpers) => {
  const fileName = helpers.resolveString(params[0] || "");
  helpers.api.effects.beginRain(fileName);
  return true;
};

/**
 * EndRain - Stop rain effect
 */
const endRainCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.effects.endRain();
  return true;
};

/**
 * ShowSnow - Show snow effect
 */
const showSnowCommand: CommandHandler = (params, _result, helpers) => {
  const show = helpers.resolveNumber(params[0] || "1") !== 0;
  helpers.api.effects.showSnow(show);
  return true;
};

// ============= Camera Extended =============

/**
 * MoveScreenEx - Move screen to position (BLOCKING)
 * MoveScreenEx(x, y, speed)
 */
const moveScreenExCommand: CommandHandler = async (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  const speed = helpers.resolveNumber(params[2] || "1");
  await helpers.api.camera.moveTo(x, y, speed);
  return true;
};

/**
 * SetMapPos - Set camera/map position
 * SetMapPos(x, y)
 */
const setMapPosCommand: CommandHandler = (params, _result, helpers) => {
  const x = helpers.resolveNumber(params[0] || "0");
  const y = helpers.resolveNumber(params[1] || "0");
  helpers.api.camera.setPosition(x, y);
  return true;
};

/**
 * OpenWaterEffect - Enable water ripple effect
 */
const openWaterEffectCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.camera.openWaterEffect();
  return true;
};

/**
 * CloseWaterEffect - Disable water ripple effect
 */
const closeWaterEffectCommand: CommandHandler = (_params, _result, helpers) => {
  helpers.api.camera.closeWaterEffect();
  return true;
};

// ============= Status Effects =============

/**
 * PetrifyMillisecond - Apply petrify effect
 */
const petrifyMillisecondCommand: CommandHandler = (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  helpers.api.effects.petrify(ms);
  return true;
};

/**
 * PoisonMillisecond - Apply poison effect
 */
const poisonMillisecondCommand: CommandHandler = (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  helpers.api.effects.poison(ms);
  return true;
};

/**
 * FrozenMillisecond - Apply frozen effect
 */
const frozenMillisecondCommand: CommandHandler = (params, _result, helpers) => {
  const ms = helpers.resolveNumber(params[0] || "0");
  helpers.api.effects.frozen(ms);
  return true;
};

/**
 * SetShowMapPos - Set whether to show map position
 */
const setShowMapPosCommand: CommandHandler = (params, _result, helpers) => {
  const show = helpers.resolveNumber(params[0] || "0") > 0;
  helpers.api.script.setShowMapPos(show);
  return true;
};

export function registerEffectCommands(registry: CommandRegistry): void {
  // Screen effects
  registry.set("fadein", fadeInCommand);
  registry.set("fadeout", fadeOutCommand);
  registry.set("movescreen", moveScreenCommand);
  registry.set("changemapcolor", changeMapColorCommand);
  registry.set("changeasfcolor", changeAsfColorCommand);

  // Weather
  registry.set("beginrain", beginRainCommand);
  registry.set("endrain", endRainCommand);
  registry.set("showsnow", showSnowCommand);

  // Camera extended
  registry.set("movescreenex", moveScreenExCommand);
  registry.set("setmappos", setMapPosCommand);
  registry.set("openwatereffect", openWaterEffectCommand);
  registry.set("closewatereffect", closeWaterEffectCommand);

  // Status effects
  registry.set("petrifymillisecond", petrifyMillisecondCommand);
  registry.set("poisonmillisecond", poisonMillisecondCommand);
  registry.set("frozenmillisecond", frozenMillisecondCommand);

  // Display
  registry.set("setshowmappos", setShowMapPosCommand);
}
