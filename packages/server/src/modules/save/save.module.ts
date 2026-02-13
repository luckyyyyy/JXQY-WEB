import { Module } from "@nestjs/common";
import { SaveRouter } from "./save.router";

@Module({
	providers: [SaveRouter],
	exports: [SaveRouter],
})
export class SaveModule {}
