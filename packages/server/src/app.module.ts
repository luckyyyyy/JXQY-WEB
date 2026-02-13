import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { createContext } from "./trpc/context";
import { TrpcModule } from "./trpc/trpc.module";
import { AuthModule } from "./modules/auth";
import { DataModule } from "./modules/data";
import { FileModule } from "./modules/file";
import { GameModule } from "./modules/game";
import { GameConfigModule } from "./modules/gameConfig";
import { GoodsModule } from "./modules/goods/goods.module";
import { LevelModule } from "./modules/level";
import { MagicModule } from "./modules/magic";
import { NpcModule } from "./modules/npc/npc.module";
import { ObjModule } from "./modules/obj/obj.module";
import { PlayerModule } from "./modules/player/player.module";
import { TalkModule } from "./modules/talk/talk.module";
import { TalkPortraitModule } from "./modules/talkPortrait/talkPortrait.module";
import { SceneModule } from "./modules/scene";
import { ShopModule } from "./modules/shop/shop.module";
import { SaveModule } from "./modules/save";
import { UserModule } from "./modules/user";

@Module({
  imports: [
    TrpcModule.forRoot({
      createContext
    }),
    AuthModule,
    DataModule,
    FileModule,
    GameModule,
    GameConfigModule,
    GoodsModule,
    LevelModule,
    MagicModule,
    NpcModule,
    ObjModule,
    PlayerModule,
    SceneModule,
    TalkModule,
    TalkPortraitModule,
    SaveModule,
    ShopModule,
    UserModule
  ],
  controllers: [AppController]
})
export class AppModule {}
