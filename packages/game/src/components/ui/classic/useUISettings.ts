/**
 * React Hook for loading UI Settings
 * Provides async loading of UI_Settings.ini with caching
 */

import {
  type BuySellGuiConfig,
  type DialogGuiConfig,
  type EquipGuiConfig,
  type GoodsGuiConfig,
  type LittleMapGuiConfig,
  loadUISettings,
  type MagicsGuiConfig,
  type MemoGuiConfig,
  type MessageGuiConfig,
  type NpcEquipGuiConfig,
  type NpcInfoShowConfig,
  parseBuySellGuiConfig,
  parseDialogGuiConfig,
  parseEquipGuiConfig,
  parseGoodsGuiConfig,
  parseLittleMapGuiConfig,
  parseMagicsGuiConfig,
  parseMemoGuiConfig,
  parseMessageGuiConfig,
  parseNpcEquipGuiConfig,
  parseNpcInfoShowConfig,
  parseSaveLoadGuiConfig,
  parseStateGuiConfig,
  parseSystemGuiConfig,
  parseXiuLianGuiConfig,
  type SaveLoadGuiConfig,
  type StateGuiConfig,
  type SystemGuiConfig,
  type XiuLianGuiConfig,
} from "@miu2d/engine/gui/ui-settings";
import { useEffect, useState } from "react";

// Cached parsed configs
let cachedConfigs: {
  system?: SystemGuiConfig;
  state?: StateGuiConfig;
  equip?: EquipGuiConfig;
  npcEquip?: NpcEquipGuiConfig;
  xiuLian?: XiuLianGuiConfig;
  goods?: GoodsGuiConfig;
  magics?: MagicsGuiConfig;
  memo?: MemoGuiConfig;
  dialog?: DialogGuiConfig;
  message?: MessageGuiConfig;
  npcInfoShow?: NpcInfoShowConfig;
  littleMap?: LittleMapGuiConfig;
  buySell?: BuySellGuiConfig;
  saveLoad?: SaveLoadGuiConfig;
} = {};

let isLoaded = false;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (isLoaded) return;

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const settings = await loadUISettings();
    cachedConfigs = {
      system: parseSystemGuiConfig(settings),
      state: parseStateGuiConfig(settings),
      equip: parseEquipGuiConfig(settings),
      npcEquip: parseNpcEquipGuiConfig(settings),
      xiuLian: parseXiuLianGuiConfig(settings),
      goods: parseGoodsGuiConfig(settings),
      magics: parseMagicsGuiConfig(settings),
      memo: parseMemoGuiConfig(settings),
      dialog: parseDialogGuiConfig(settings),
      message: parseMessageGuiConfig(settings),
      npcInfoShow: parseNpcInfoShowConfig(settings),
      littleMap: parseLittleMapGuiConfig(settings),
      buySell: parseBuySellGuiConfig(settings),
      saveLoad: parseSaveLoadGuiConfig(settings),
    };
    isLoaded = true;
  })();

  return loadPromise;
}

/**
 * Hook to get System GUI config
 */
export function useSystemGuiConfig(): SystemGuiConfig | null {
  const [config, setConfig] = useState<SystemGuiConfig | null>(cachedConfigs.system || null);

  useEffect(() => {
    if (cachedConfigs.system) {
      setConfig(cachedConfigs.system);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.system || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get State GUI config
 */
export function useStateGuiConfig(): StateGuiConfig | null {
  const [config, setConfig] = useState<StateGuiConfig | null>(cachedConfigs.state || null);

  useEffect(() => {
    if (cachedConfigs.state) {
      setConfig(cachedConfigs.state);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.state || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Equip GUI config
 */
export function useEquipGuiConfig(): EquipGuiConfig | null {
  const [config, setConfig] = useState<EquipGuiConfig | null>(cachedConfigs.equip || null);

  useEffect(() => {
    if (cachedConfigs.equip) {
      setConfig(cachedConfigs.equip);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.equip || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get NPC Equip GUI config
 * Used for displaying NPC equipment slots
 */
export function useNpcEquipGuiConfig(): NpcEquipGuiConfig | null {
  const [config, setConfig] = useState<NpcEquipGuiConfig | null>(cachedConfigs.npcEquip || null);

  useEffect(() => {
    if (cachedConfigs.npcEquip) {
      setConfig(cachedConfigs.npcEquip);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.npcEquip || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get XiuLian GUI config
 */
export function useXiuLianGuiConfig(): XiuLianGuiConfig | null {
  const [config, setConfig] = useState<XiuLianGuiConfig | null>(cachedConfigs.xiuLian || null);

  useEffect(() => {
    if (cachedConfigs.xiuLian) {
      setConfig(cachedConfigs.xiuLian);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.xiuLian || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Good GUI config
 */
export function useGoodsGuiConfig(): GoodsGuiConfig | null {
  const [config, setConfig] = useState<GoodsGuiConfig | null>(cachedConfigs.goods || null);

  useEffect(() => {
    if (cachedConfigs.goods) {
      setConfig(cachedConfigs.goods);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.goods || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Magics GUI config
 */
export function useMagicsGuiConfig(): MagicsGuiConfig | null {
  const [config, setConfig] = useState<MagicsGuiConfig | null>(cachedConfigs.magics || null);

  useEffect(() => {
    if (cachedConfigs.magics) {
      setConfig(cachedConfigs.magics);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.magics || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Memo GUI config
 */
export function useMemoGuiConfig(): MemoGuiConfig | null {
  const [config, setConfig] = useState<MemoGuiConfig | null>(cachedConfigs.memo || null);

  useEffect(() => {
    if (cachedConfigs.memo) {
      setConfig(cachedConfigs.memo);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.memo || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Dialog GUI config
 */
export function useDialogGuiConfig(): DialogGuiConfig | null {
  const [config, setConfig] = useState<DialogGuiConfig | null>(cachedConfigs.dialog || null);

  useEffect(() => {
    if (cachedConfigs.dialog) {
      setConfig(cachedConfigs.dialog);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.dialog || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get Message GUI config
 */
export function useMessageGuiConfig(): MessageGuiConfig | null {
  const [config, setConfig] = useState<MessageGuiConfig | null>(cachedConfigs.message || null);

  useEffect(() => {
    if (cachedConfigs.message) {
      setConfig(cachedConfigs.message);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.message || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get NPC Info Show config
 * Used for NPC life bar display at top of screen
 */
export function useNpcInfoShowConfig(): NpcInfoShowConfig | null {
  const [config, setConfig] = useState<NpcInfoShowConfig | null>(cachedConfigs.npcInfoShow || null);

  useEffect(() => {
    if (cachedConfigs.npcInfoShow) {
      setConfig(cachedConfigs.npcInfoShow);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.npcInfoShow || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get LittleMap (小地图) GUI config
 * Used for minimap display
 */
export function useLittleMapGuiConfig(): LittleMapGuiConfig | null {
  const [config, setConfig] = useState<LittleMapGuiConfig | null>(cachedConfigs.littleMap || null);

  useEffect(() => {
    if (cachedConfigs.littleMap) {
      setConfig(cachedConfigs.littleMap);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.littleMap || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get all UI configs at once
 */
export function useAllUIConfigs(): typeof cachedConfigs | null {
  const [configs, setConfigs] = useState<typeof cachedConfigs | null>(
    isLoaded ? cachedConfigs : null
  );

  useEffect(() => {
    if (isLoaded) {
      setConfigs(cachedConfigs);
      return;
    }
    ensureLoaded().then(() => {
      setConfigs({ ...cachedConfigs });
    });
  }, []);

  return configs;
}

/**
 * Hook to get BuySell (商店) GUI config
 * Used for shop/buy interface display
 */
export function useBuySellGuiConfig(): BuySellGuiConfig | null {
  const [config, setConfig] = useState<BuySellGuiConfig | null>(cachedConfigs.buySell || null);

  useEffect(() => {
    if (cachedConfigs.buySell) {
      setConfig(cachedConfigs.buySell);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.buySell || null);
    });
  }, []);

  return config;
}

/**
 * Hook to get SaveLoad (存档/读档) GUI config
 * Used for save/load interface display
 */
export function useSaveLoadGuiConfig(): SaveLoadGuiConfig | null {
  const [config, setConfig] = useState<SaveLoadGuiConfig | null>(cachedConfigs.saveLoad || null);

  useEffect(() => {
    if (cachedConfigs.saveLoad) {
      setConfig(cachedConfigs.saveLoad);
      return;
    }
    ensureLoaded().then(() => {
      setConfig(cachedConfigs.saveLoad || null);
    });
  }, []);

  return config;
}
