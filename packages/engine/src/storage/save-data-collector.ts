import { extractFlatDataFromCharacter } from "../character/character-config";
import {
  BOTTOM_INDEX_BEGIN,
  BOTTOM_INDEX_END,
  EQUIP_INDEX_BEGIN,
  EQUIP_INDEX_END,
  type GoodsListManager,
  STORE_INDEX_BEGIN,
  STORE_INDEX_END,
} from "../player/goods";
import type { PlayerMagicInventory } from "../player/magic/player-magic-inventory";
import type { Player } from "../player/player";
import type { GoodsItemData, MagicItemData, PlayerSaveData } from "./save-types";

export class SaveDataCollector {
  static collectPlayerData(player: Player): PlayerSaveData {
    const base = extractFlatDataFromCharacter(player, true);
    base.dir = player.currentDirection;
    return base as unknown as PlayerSaveData;
  }

  static collectGoodsData(goodsListManager: GoodsListManager): GoodsItemData[] {
    const items: GoodsItemData[] = [];

    for (let i = STORE_INDEX_BEGIN; i <= STORE_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        items.push({
          fileName: info.good.fileName,
          count: info.count,
        });
      }
    }

    for (let i = BOTTOM_INDEX_BEGIN; i <= BOTTOM_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        items.push({
          fileName: info.good.fileName,
          count: info.count,
          index: i,
        });
      }
    }

    return items;
  }

  static collectEquipsData(goodsListManager: GoodsListManager): (GoodsItemData | null)[] {
    const equips: (GoodsItemData | null)[] = [];

    for (let i = EQUIP_INDEX_BEGIN; i <= EQUIP_INDEX_END; i++) {
      const info = goodsListManager.getItemInfo(i);
      if (info?.good) {
        equips.push({
          fileName: info.good.fileName,
          count: 1,
        });
      } else {
        equips.push(null);
      }
    }

    return equips;
  }

  static collectMagicsData(magicInventory: PlayerMagicInventory): MagicItemData[] {
    const items: MagicItemData[] = [];
    const maxMagic = 49;

    for (let i = 1; i <= maxMagic; i++) {
      const info = magicInventory.getItemInfo(i);
      if (info?.magic) {
        const item: MagicItemData = {
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          index: i,
        };
        if (info.hideCount !== 1) {
          item.hideCount = info.hideCount;
        }
        items.push(item);
      }
    }

    for (let i = 1; i <= maxMagic; i++) {
      const info = magicInventory.getHiddenItemInfo(i);
      if (info?.magic) {
        items.push({
          fileName: info.magic.fileName,
          level: info.level,
          exp: info.exp,
          index: i,
          hideCount: info.hideCount,
          lastIndexWhenHide: info.lastIndexWhenHide,
          isHidden: true,
        });
      }
    }

    return items;
  }
}
