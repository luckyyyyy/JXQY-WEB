import { Module } from "@nestjs/common";
import { LevelController } from "./level.controller";
import { LevelRouter } from "./level.router";

@Module({
  controllers: [LevelController],
  providers: [LevelRouter],
  exports: [LevelRouter]
})
export class LevelModule {}
