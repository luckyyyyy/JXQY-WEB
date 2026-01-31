import * as fs from "node:fs";
import * as path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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
});
