import { getEngineContext, type IEngineContext } from "./engine-context";

/**
 * Base class to access the global engine context with typed manager helpers.
 * Centralizes common boilerplate used across managers/handlers.
 */
export abstract class EngineAccess {
  protected get engine(): IEngineContext {
    return getEngineContext();
  }

  // Frequently used managers (reduce repeated getManager + casts)
  protected get gui() {
    return this.engine.guiManager;
  }

  protected get obj() {
    return this.engine.objManager;
  }

  protected get script() {
    return this.engine.scriptExecutor;
  }

  protected get debug() {
    return this.engine.debugManager;
  }

  protected get magicManager() {
    return this.engine.magicManager;
  }

  protected get interaction() {
    return this.engine.interactionManager;
  }

  protected get magicHandler() {
    return this.engine.magicHandler;
  }

  protected get mapRenderer() {
    return this.engine.mapRenderer;
  }

  protected get buy() {
    return this.engine.buyManager;
  }

  protected get weather() {
    return this.engine.weatherManager;
  }
}
