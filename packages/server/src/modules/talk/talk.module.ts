import { Module } from "@nestjs/common";
import { TalkRouter } from "./talk.router";

@Module({
	providers: [TalkRouter],
	exports: [TalkRouter],
})
export class TalkModule {}
