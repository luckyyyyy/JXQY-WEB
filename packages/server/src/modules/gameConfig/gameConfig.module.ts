import { Module } from "@nestjs/common";
import { GameConfigController } from "./gameConfig.controller";
import { GameConfigRouter } from "./gameConfig.router";

@Module({
	controllers: [GameConfigController],
	providers: [GameConfigRouter],
	exports: [GameConfigRouter]
})
export class GameConfigModule {}
