import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@miu2d/engine": "/home/william/me/miu2d/packages/engine/src",
    },
  },
});
