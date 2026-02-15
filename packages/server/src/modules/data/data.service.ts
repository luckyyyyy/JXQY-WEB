/**
 * Data Service
 *
 * 聚合所有游戏配置数据，供 REST controller 和 tRPC router 共用
 */

import { goodsService } from "../goods/goods.service";
import { magicService } from "../magic/magic.service";
import { npcResourceService, npcService } from "../npc";
import { objResourceService, objService } from "../obj";
import { playerService } from "../player";
import { shopService } from "../shop/shop.service";
import { talkService } from "../talk";
import { talkPortraitService } from "../talkPortrait";

/**
 * 聚合游戏所有配置数据（武功、物品、商店、NPC、物体、玩家、头像、对话）
 *
 * 复用各模块 service，返回统一结构
 */
export async function buildGameData(gameSlug: string) {
  const [
    magics,
    goods,
    shops,
    npcs,
    npcResources,
    objs,
    objResources,
    playersList,
    portraitEntries,
    talkEntries,
  ] = await Promise.all([
    magicService.listPublicBySlug(gameSlug),
    goodsService.listPublicBySlug(gameSlug),
    shopService.listPublicBySlug(gameSlug),
    npcService.listPublicBySlug(gameSlug),
    npcResourceService.listPublicBySlug(gameSlug),
    objService.listPublicBySlug(gameSlug),
    objResourceService.listPublicBySlug(gameSlug),
    playerService.listPublicBySlug(gameSlug),
    talkPortraitService.getPublicBySlug(gameSlug),
    talkService.getPublicBySlug(gameSlug),
  ]);

  // 构建 objResources 的 id -> { resources, key } 映射
  const objResourceMap = new Map(
    objResources.map((r) => [r.id, { resources: r.resources, key: r.key }])
  );

  // 为每个 obj 合并 resources 数据，并附带 objFile（objres 文件名）
  const objsWithResources = objs.map((obj) => {
    const resEntry = obj.resourceId ? objResourceMap.get(obj.resourceId) : null;
    return {
      ...obj,
      resources: resEntry?.resources ?? {},
      objFile: resEntry?.key ?? null,
    };
  });

  // 构建 npcResources 的 id -> { resources, key } 映射
  const npcResourceMap = new Map(
    npcResources.map((r) => [r.id, { resources: r.resources, key: r.key }])
  );

  // 为每个 npc 合并 resources 数据，并附带 npcIni（npcres 文件名）
  const npcsWithResources = npcs.map((npc) => {
    const resEntry = npc.resourceId ? npcResourceMap.get(npc.resourceId) : null;
    return {
      ...npc,
      resources: npc.resources ?? resEntry?.resources ?? {},
      npcIni: resEntry?.key ?? null,
    };
  });

  return {
    magics: {
      player: magics.filter((m) => m.userType === "player"),
      npc: magics.filter((m) => m.userType === "npc"),
    },
    goods,
    shops,
    npcs: {
      npcs: npcsWithResources,
      resources: npcResources,
    },
    objs: {
      objs: objsWithResources,
      resources: objResources,
    },
    players: playersList,
    portraits: portraitEntries.map((e) => ({ index: e.idx, asfFile: e.file })),
    talks: talkEntries,
  };
}
