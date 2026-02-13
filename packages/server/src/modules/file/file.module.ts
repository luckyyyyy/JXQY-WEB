import { Module } from "@nestjs/common";
import { FileController } from "./file.controller";
import { FileRouter } from "./file.router";

@Module({
	controllers: [FileController],
	providers: [FileRouter]
})
export class FileModule {}
