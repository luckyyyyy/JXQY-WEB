import { Module } from "@nestjs/common";
import { GameRouter } from "./game.router";

@Module({
  providers: [GameRouter]
})
export class GameModule {}
