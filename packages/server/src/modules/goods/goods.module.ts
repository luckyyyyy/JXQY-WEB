import { Module } from "@nestjs/common";
import { GoodsRouter } from "./goods.router";

@Module({
	providers: [GoodsRouter],
	exports: [GoodsRouter]
})
export class GoodsModule {}
