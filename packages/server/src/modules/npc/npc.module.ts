import { Module } from "@nestjs/common";
import { NpcRouter } from "./npc.router";
import { NpcResourceRouter } from "./npcResource.router";

@Module({
	providers: [NpcRouter, NpcResourceRouter],
	exports: [NpcRouter, NpcResourceRouter]
})
export class NpcModule {}
