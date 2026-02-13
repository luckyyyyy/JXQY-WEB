import { Module } from "@nestjs/common";
import { PlayerRouter } from "./player.router";

@Module({
	providers: [PlayerRouter],
	exports: [PlayerRouter]
})
export class PlayerModule {}
