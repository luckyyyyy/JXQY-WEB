/**
 * Dashboard 路由配置
 */
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { DashboardHome } from "./DashboardHome";
import { DashboardLayout } from "./DashboardLayout";
import { GameGuard } from "./GameGuard";
import { GameListPage } from "./GameListPage";

// 游戏编辑
import { GameGlobalConfigPage } from "./modules/gameConfig";
// 物品编辑
import { GoodsDetailPage, GoodsListPage } from "./modules/goods/GoodsPages";

// NPC 编辑
import { NpcDetailPage, NpcListPage, NpcResourceDetailPage } from "./modules/npc";

// Object 编辑
import { ObjDetailPage, ObjListPage, ObjResourceDetailPage } from "./modules/obj";
// 玩家角色编辑
import { PlayerDetailPage, PlayerListPage } from "./modules/player";

// 商店编辑
import { ShopDetailPage, ShopsListPage } from "./modules/ShopsPages";

/** 商店详情页 key wrapper —— shopId 变化时完全重新挂载 */
function ShopDetailPageKeyed() {
  const { shopId } = useParams();
  return <ShopDetailPage key={shopId} />;
}

// 等级与强度
import { LevelDetailPage, LevelListPage } from "./modules/level";
// 武功编辑
import { MagicDetailPage, MagicListPage } from "./modules/magic";
// 资源管理
import {
  AsfResourcesPage,
  ImagesPage,
  MusicPage,
  ResourcesHomePage,
  SoundsPage,
} from "./modules/ResourcesPages";
// 数据统计
import { PlayerDataPage, PlayerSavesPage, StatisticsHomePage } from "./modules/StatisticsPages";
// 场景编辑
import { SceneDetailPage, ScenesHomePage } from "./modules/scenes";
// 对话系统
import { TalkListPage, TalkPortraitPage } from "./modules/talk";

/**
 * Dashboard 应用路由
 * 在 /dashboard/* 路径下渲染
 */
export function DashboardApp() {
  return (
    <Routes>
      {/* 游戏空间列表页面 */}
      <Route index element={<GameListPage />} />

      {/* 带游戏空间ID的路由 - 先验证游戏空间是否存在 */}
      <Route path=":gameId" element={<GameGuard />}>
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />

          {/* 游戏编辑 */}
          <Route path="game">
            <Route index element={<Navigate to="basic" replace />} />
            <Route path=":configTab" element={<GameGlobalConfigPage />} />
          </Route>

          {/* 角色编辑 */}
          <Route path="player">
            <Route index element={<PlayerListPage />} />
            <Route path=":playerId" element={<Navigate to="basic" replace />} />
            <Route path=":playerId/:tab" element={<PlayerDetailPage />} />
          </Route>

          {/* NPC 编辑 */}
          <Route path="npcs">
            <Route index element={<NpcListPage />} />
            <Route path="resource/:resourceId" element={<NpcResourceDetailPage />} />
            <Route path=":npcId" element={<Navigate to="basic" replace />} />
            <Route path=":npcId/:tab" element={<NpcDetailPage />} />
          </Route>

          {/* Object 编辑 */}
          <Route path="objs">
            <Route index element={<ObjListPage />} />
            <Route path="resource/:resourceId" element={<ObjResourceDetailPage />} />
            <Route path=":objId" element={<Navigate to="basic" replace />} />
            <Route path=":objId/:tab" element={<ObjDetailPage />} />
          </Route>

          {/* 游戏模块入口 - 默认跳转到NPC编辑 */}
          <Route path="game-modules" element={<Navigate to="../npcs" replace />} />

          {/* 物品编辑 */}
          <Route path="goods">
            <Route index element={<GoodsListPage />} />
            <Route path=":goodsId" element={<GoodsDetailPage />} />
          </Route>

          {/* 商店编辑 */}
          <Route path="shops">
            <Route index element={<ShopsListPage />} />
            <Route path=":shopId" element={<ShopDetailPageKeyed />} />
          </Route>

          {/* 等级与强度 */}
          <Route path="levels">
            <Route index element={<LevelListPage />} />
            <Route path=":levelConfigId" element={<Navigate to="basic" replace />} />
            <Route path=":levelConfigId/:tab" element={<LevelDetailPage />} />
          </Route>

          {/* 武功编辑 */}
          <Route path="magic">
            <Route index element={<MagicListPage />} />
            <Route path=":magicId" element={<Navigate to="basic" replace />} />
            <Route path=":magicId/:tab" element={<MagicDetailPage />} />
          </Route>

          {/* 对话系统 */}
          <Route path="talks">
            <Route index element={<Navigate to="list" replace />} />
            <Route path="list" element={<TalkListPage />} />
            <Route path="portrait" element={<TalkPortraitPage />} />
          </Route>

          {/* 场景编辑 */}
          <Route path="scenes">
            <Route index element={<ScenesHomePage />} />
            <Route path=":sceneId" element={<SceneDetailPage />} />
          </Route>

          {/* 资源管理 */}
          <Route path="resources">
            <Route index element={<ResourcesHomePage />} />
            <Route path="images" element={<ImagesPage />} />
            <Route path="music" element={<MusicPage />} />
            <Route path="sounds" element={<SoundsPage />} />
            <Route path="asf" element={<AsfResourcesPage />} />
          </Route>

          {/* 数据统计 */}
          <Route path="statistics">
            <Route index element={<StatisticsHomePage />} />
            <Route path="player-data" element={<PlayerDataPage />} />
            <Route path="player-saves" element={<PlayerSavesPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
