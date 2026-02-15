import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "../db/client";
import type { games } from "../db/schema";
import { normalizeLanguage } from "../i18n";
import { getCookieValue, resolveUserId, SESSION_COOKIE_NAME } from "../utils/session";

type Game = InferSelectModel<typeof games>;

/**
 * Hono 注入的 Response 对象引用
 * 用于 auth 等模块需要设置 cookie 的场景
 */
let _pendingRes:
  | {
      setCookie: (name: string, value: string, options: Record<string, unknown>) => void;
      deleteCookie: (name: string, options: Record<string, unknown>) => void;
    }
  | undefined;

export function setPendingRes(res: typeof _pendingRes) {
  _pendingRes = res;
}

export function getPendingRes() {
  return _pendingRes;
}

export const createContext = async ({ req }: FetchCreateContextFnOptions) => {
  const cookieHeader = req.headers.get("cookie") ?? undefined;
  const userId = await resolveUserId(cookieHeader);
  const sessionId = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);

  const gameKey = req.headers.get("x-game-id");
  const languageHeader = req.headers.get("x-lang") ?? req.headers.get("accept-language");
  const language = normalizeLanguage(
    typeof languageHeader === "string" ? languageHeader : undefined
  );

  // 获取客户端 IP（支持反向代理）
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "unknown";

  return {
    db,
    userId,
    sessionId,
    gameKey: typeof gameKey === "string" ? gameKey : undefined,
    game: undefined as Game | undefined,
    language,
    ip,
    res: _pendingRes,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
