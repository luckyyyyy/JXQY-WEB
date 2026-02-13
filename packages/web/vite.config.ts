import * as fs from "node:fs";
import * as path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-oxc";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Custom plugin to return 404 for missing resources
 * This prevents Vite from returning 200 OK with index.html for missing files
 */
function resources404Plugin(): Plugin {
  return {
    name: "resources-404",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Only check paths under /resources/
        if (req.url?.startsWith("/resources/")) {
          // Decode the URL to handle Chinese characters
          const decodedUrl = decodeURIComponent(req.url);
          // Remove query string if present
          const urlPath = decodedUrl.split("?")[0];
          // Resolve to actual file path (resources are served from public folder)
          const filePath = path.join(process.cwd(), "./", urlPath);

          // Check if file exists
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Resource not found", path: urlPath }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [resources404Plugin(), tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      // tRPC API 代理到后端 4000 端口
      "/trpc": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // MinIO presigned URL 代理：/s3/* → MinIO 9000
      // changeOrigin 确保 Host 头匹配 presigned URL 签名
      "/s3": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/s3/, ""),
      },
      // 代理后端 API 路径到后端 4000 端口
      // 注意：/game/:gameSlug 是前端路由，不代理
      // 只代理 /game/*/api/* 和 /game/*/resources/* 到后端
      "/game": {
        target: "http://localhost:4000",
        changeOrigin: true,
        bypass: (req) => {
          const url = req.url || "";
          // 匹配 /game/{gameSlug}/api/* 或 /game/{gameSlug}/resources/*
          const isBackendPath = /^\/game\/[^/]+\/(api|resources)(\/|$)/.test(url);
          if (!isBackendPath) {
            // 返回前端路由，让 Vite 处理（返回 index.html）
            return "/index.html";
          }
          // 返回 undefined 表示代理到后端
          return undefined;
        },
      },
    },
  },
});
