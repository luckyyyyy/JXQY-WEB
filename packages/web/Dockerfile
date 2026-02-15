# 构建阶段
FROM node:22-alpine AS builder

# 启用 corepack 以使用 pnpm
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

WORKDIR /app

# 复制 workspace 配置文件
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./

# 复制 types 包（web 间接依赖，需要构建）
COPY packages/types/package.json ./packages/types/
COPY packages/types/tsconfig.json ./packages/types/
COPY packages/types/src ./packages/types/src

# 复制 shared 包（i18n、tRPC 客户端、contexts、hooks）
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src ./packages/shared/src

# 复制 engine 包（直接使用 src，无需构建）
COPY packages/engine/package.json ./packages/engine/
COPY packages/engine/tsconfig.json ./packages/engine/
COPY packages/engine/src ./packages/engine/src

# 复制 engine-wasm 包（预构建的 pkg）
COPY packages/engine-wasm/package.json ./packages/engine-wasm/
COPY packages/engine-wasm/pkg ./packages/engine-wasm/pkg

# 复制 ui 包（直接使用 src，无需构建）
COPY packages/ui/package.json ./packages/ui/
COPY packages/ui/tsconfig.json ./packages/ui/
COPY packages/ui/src ./packages/ui/src

# 复制 viewer 包（直接使用 src，无需构建）
COPY packages/viewer/package.json ./packages/viewer/
COPY packages/viewer/tsconfig.json ./packages/viewer/
COPY packages/viewer/src ./packages/viewer/src

# 复制 game 包（直接使用 src，无需构建）
COPY packages/game/package.json ./packages/game/
COPY packages/game/tsconfig.json ./packages/game/
COPY packages/game/src ./packages/game/src

# 复制 dashboard 包（直接使用 src，无需构建）
COPY packages/dashboard/package.json ./packages/dashboard/
COPY packages/dashboard/tsconfig.json ./packages/dashboard/
COPY packages/dashboard/src ./packages/dashboard/src

# 复制 server 包（只用于 tRPC 类型导出）
COPY packages/server/package.json ./packages/server/
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src ./packages/server/src
COPY packages/server/scripts ./packages/server/scripts

# 复制 web 包配置
COPY packages/web/package.json ./packages/web/
COPY packages/web/tsconfig.json ./packages/web/
COPY packages/web/vite.config.ts ./packages/web/
COPY packages/web/index.html ./packages/web/

# 安装所有依赖
RUN pnpm install --frozen-lockfile

# 构建依赖包
RUN pnpm --filter @miu2d/types build
# 生成 server 的 tRPC 类型（web 依赖）
RUN pnpm --filter @miu2d/server gen:trpc

# 复制 web 源代码和静态资源
COPY packages/web/src ./packages/web/src
COPY packages/web/public ./packages/web/public

# 构建 web 应用
WORKDIR /app/packages/web
RUN pnpm build

# 生产阶段 - 使用 nginx 静态服务
FROM nginx:alpine AS runner

# 复制 nginx 配置
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制构建产物
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
