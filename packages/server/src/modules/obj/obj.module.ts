import { Module } from "@nestjs/common";
import { ObjRouter } from "./obj.router";
import { ObjResourceRouter } from "./objResource.router";

@Module({
	providers: [ObjRouter, ObjResourceRouter],
	exports: [ObjRouter, ObjResourceRouter]
})
export class ObjModule {}
