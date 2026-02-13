import { Module } from "@nestjs/common";
import { DataController } from "./data.controller";
import { DataRouter } from "./data.router";

@Module({
	controllers: [DataController],
	providers: [DataRouter],
})
export class DataModule {}
