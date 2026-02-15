import "reflect-metadata";
import "dotenv/config";

import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Import all module routers to register them (side-effect imports)
import "./modules";

import { dataRoutes } from "./routes/data.routes";
import { fileRoutes } from "./routes/file.routes";
import { gameConfigRoutes } from "./routes/gameConfig.routes";
import { levelRoutes } from "./routes/level.routes";
import { sceneRoutes } from "./routes/scene.routes";
import { createContext, setPendingRes } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { seedDemoData } from "./utils/demo";

const app = new Hono();

// CORS
app.use("*", cors({ origin: (origin) => origin || "*", credentials: true }));

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// REST routes
app.route("/game", fileRoutes);
app.route("/game", gameConfigRoutes);
app.route("/game", dataRoutes);
app.route("/game", sceneRoutes);
app.route("/game", levelRoutes);

// tRPC
app.use("/trpc/*", async (c, next) => {
  // 注入一个用于设置/删除 Cookie 的辅助对象
  // auth 模块需要它来设置 session cookie
  const pendingCookies: string[] = [];
  setPendingRes({
    setCookie: (name: string, value: string, options: Record<string, unknown>) => {
      const parts = [`${name}=${encodeURIComponent(value)}`];
      if (options.path) parts.push(`Path=${options.path}`);
      if (options.maxAge) parts.push(`Max-Age=${Math.floor((options.maxAge as number) / 1000)}`);
      if (options.httpOnly) parts.push("HttpOnly");
      if (options.secure) parts.push("Secure");
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
      pendingCookies.push(parts.join("; "));
    },
    deleteCookie: (name: string, options: Record<string, unknown>) => {
      const parts = [`${name}=`, "Max-Age=0"];
      if (options.path) parts.push(`Path=${options.path}`);
      if (options.httpOnly) parts.push("HttpOnly");
      if (options.secure) parts.push("Secure");
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
      pendingCookies.push(parts.join("; "));
    },
  });

  await next();

  // 将 tRPC handler 中产生的 Set-Cookie 添加到响应中
  for (const cookie of pendingCookies) {
    c.header("Set-Cookie", cookie, { append: true });
  }
  setPendingRes(undefined);
});

app.use("/trpc/*", trpcServer({ router: appRouter, createContext }));

async function bootstrap() {
  // 开发模式：seed demo 用户 + 游戏 + 成员，使 "demo" 空间无需登录即可操作
  await seedDemoData();

  const port = Number(process.env.PORT || 4000);
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Application is running on: http://0.0.0.0:${port}`);
  });
}

bootstrap();
