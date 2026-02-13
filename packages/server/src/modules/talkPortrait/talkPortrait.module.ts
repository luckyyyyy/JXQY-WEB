import { Module } from "@nestjs/common";
import { TalkPortraitRouter } from "./talkPortrait.router";

@Module({
	providers: [TalkPortraitRouter],
	exports: [TalkPortraitRouter]
})
export class TalkPortraitModule {}
