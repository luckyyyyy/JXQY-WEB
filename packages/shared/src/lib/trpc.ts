/**
 * tRPC 客户端配置
 *
 * 类型从 server 包的 @generated 目录导入
 */

import type { AppRouter } from "@miu2d/server/trpc";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== "undefined") {
    // 浏览器环境：使用当前 origin，走 Vite 代理
    return window.location.origin;
  }
  return "http://localhost:4000";
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
