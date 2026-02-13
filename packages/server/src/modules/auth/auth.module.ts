import { Module } from "@nestjs/common";
import { AuthRouter } from "./auth.router";
import { AuthService } from "./auth.service";

@Module({
	providers: [AuthService, AuthRouter],
	exports: [AuthService, AuthRouter]
})
export class AuthModule {}
