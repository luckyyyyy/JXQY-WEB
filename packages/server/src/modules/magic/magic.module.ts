import { Module } from "@nestjs/common";
import { MagicRouter } from "./magic.router";

@Module({
	providers: [MagicRouter],
	exports: [MagicRouter]
})
export class MagicModule {}
