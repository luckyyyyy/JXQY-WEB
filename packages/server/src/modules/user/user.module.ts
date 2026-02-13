import { Module } from "@nestjs/common";
import { UserRouter } from "./user.router";
import { UserService } from "./user.service";

@Module({
	providers: [UserService, UserRouter],
	exports: [UserService, UserRouter]
})
export class UserModule {}
