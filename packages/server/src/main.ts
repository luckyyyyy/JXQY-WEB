import "reflect-metadata";
import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { seedDemoData } from "./utils/demo";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: { origin: true, credentials: true }
  });

  // 增加请求体大小限制（默认 100kb 太小，NPC 批量导入可能很大）
  app.useBodyParser('json', { limit: '50mb' });

  // 开发模式：seed demo 用户 + 游戏 + 成员，使 "demo" 空间无需登录即可操作
  await seedDemoData();

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}

bootstrap();
