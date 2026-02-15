/**
 * Demo 开发模式工具
 *
 * 在本地开发模式下（NODE_ENV !== "production"），自动 seed demo 用户 + 游戏 + 成员关系。
 * context.ts 为未登录请求注入 DEMO_DEV_USER_ID，所有现有 requireUser / verifyGameAccess
 * 自然通过，无需在每个 service 里做特殊 bypass。
 */
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { gameMembers, games, users } from "../db/schema";

/** Demo 游戏空间的 slug */
export const DEMO_SLUG = "demo";

/** 开发模式下未登录用户的虚拟 userId */
export const DEMO_DEV_USER_ID = "00000000-0000-0000-0000-000000000000";

/** 是否为非生产环境 */
export function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * 开发模式启动时调用：确保 demo 用户、游戏、成员关系存在。
 * 这样所有 requireUser / verifyGameAccess 中间件自然通过，
 * 不需要在每个 service 中做 bypass。
 */
export async function seedDemoData(): Promise<void> {
  if (!isDev()) return;

  // 1. 确保 demo 用户存在
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, DEMO_DEV_USER_ID))
    .limit(1);

  if (!existingUser) {
    await db.insert(users).values({
      id: DEMO_DEV_USER_ID,
      name: "Demo Developer",
      email: "demo@dev.local",
      passwordHash: "not-a-real-hash",
      emailVerified: true,
      role: "user",
    });
    console.log("[Demo] Created demo user");
  }

  // 2. 确保 demo 游戏存在
  let [demoGame] = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.slug, DEMO_SLUG))
    .limit(1);

  if (!demoGame) {
    [demoGame] = await db
      .insert(games)
      .values({
        slug: DEMO_SLUG,
        name: "Demo Game",
        description: "Local development demo workspace",
        ownerId: DEMO_DEV_USER_ID,
      })
      .returning({ id: games.id });
    console.log("[Demo] Created demo game");
  }

  // 3. 确保 demo 用户是 demo 游戏的成员
  const [existingMember] = await db
    .select({ id: gameMembers.id })
    .from(gameMembers)
    .where(and(eq(gameMembers.gameId, demoGame.id), eq(gameMembers.userId, DEMO_DEV_USER_ID)))
    .limit(1);

  if (!existingMember) {
    await db.insert(gameMembers).values({
      gameId: demoGame.id,
      userId: DEMO_DEV_USER_ID,
      role: "owner",
    });
    console.log("[Demo] Added demo user as game member");
  }

  console.log("[Demo] Dev mode ready — slug 'demo' accessible without login");
}
