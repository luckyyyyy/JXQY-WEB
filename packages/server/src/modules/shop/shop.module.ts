import { Module } from "@nestjs/common";
import { ShopRouter } from "./shop.router";

@Module({
	providers: [ShopRouter],
	exports: [ShopRouter]
})
export class ShopModule {}
