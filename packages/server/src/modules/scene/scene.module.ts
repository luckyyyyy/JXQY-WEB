import { Module } from "@nestjs/common";
import { SceneController } from "./scene.controller";
import { SceneRouter } from "./scene.router";

@Module({
	controllers: [SceneController],
	providers: [SceneRouter],
	exports: [SceneRouter]
})
export class SceneModule {}
