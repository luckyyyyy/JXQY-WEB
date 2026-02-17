# Miu2D Engine - Makefile

.PHONY: init dev dev-web dev-server build install db-migrate db-seed db-studio db-up db-down docker tsc test lint format help convert convert-verify

# 读取环境变量（如果存在）
-include .env

# 默认目标
.DEFAULT_GOAL := help

# 颜色输出
GREEN  := \033[0;32m
YELLOW := \033[0;33m
BLUE   := \033[0;34m
NC     := \033[0m

help: ## 显示帮助信息
	@printf "$(BLUE)═══════════════════════════════════════$(NC)\n"
	@printf "$(GREEN)  Miu2D Engine - 可用命令$(NC)\n"
	@printf "$(BLUE)═══════════════════════════════════════$(NC)\n"
	@printf "  $(YELLOW)make init$(NC)       - 首次初始化项目\n"
	@printf "  $(YELLOW)make dev$(NC)        - 启动开发环境\n"
	@printf "  $(YELLOW)make dev-web$(NC)    - 只启动 web\n"
	@printf "  $(YELLOW)make dev-server$(NC) - 只启动 server\n"
	@printf "  $(YELLOW)make build$(NC)      - 编译生产版本\n"
	@printf "  $(YELLOW)make docker$(NC)     - 构建 Docker 镜像\n"
	@printf "  $(YELLOW)make test$(NC)       - 运行引擎测试\n"
	@printf "  $(YELLOW)make tsc$(NC)        - 类型检查\n"
	@printf "  $(YELLOW)make db-studio$(NC) - 数据库可视化 (Web)\n"
	@printf "  $(YELLOW)make convert$(NC)    - 一键转换所有资源\n"
	@printf "  $(YELLOW)make convert-verify$(NC) - 验证无损转换\n"
	@printf "$(BLUE)═══════════════════════════════════════$(NC)\n"

init: ## 首次初始化项目（清理+安装+迁移+种子）
	@printf "$(BLUE)═══════════════════════════════════════$(NC)\n"
	@printf "$(GREEN)  🚀 项目初始化$(NC)\n"
	@printf "$(BLUE)═══════════════════════════════════════$(NC)\n"
	@printf "\n"
	@printf "$(YELLOW)⚠️  警告：此操作将执行以下内容：$(NC)\n"
	@printf "  • 停止并删除现有数据库容器\n"
	@printf "  • 删除现有数据库数据（.data/）\n"
	@printf "  • 重新安装依赖、迁移并注入种子数据\n"
	@printf "\n"
	@printf "$(YELLOW)确认继续？[y/N]: $(NC)"; \
	read confirm; \
	if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
		printf "$(GREEN)已取消初始化$(NC)\n"; \
		exit 0; \
	fi
	@printf "\n$(YELLOW)📝 [1/8] 检查环境变量文件...$(NC)\n"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		printf "$(GREEN)✓ 已从 .env.example 创建 .env 文件$(NC)\n"; \
	else \
		printf "$(GREEN)✓ .env 文件已存在$(NC)\n"; \
	fi
	@printf "\n$(YELLOW)🛑 [2/8] 停止现有容器...$(NC)\n"
	@docker-compose down -v 2>/dev/null || true
	@printf "$(GREEN)✓ 容器已停止$(NC)\n"
	@printf "\n$(YELLOW)🗑️  [3/8] 清理数据目录...$(NC)\n"
	@sudo rm -rf .data/postgres .data/minio
	@printf "$(GREEN)✓ 数据目录已清理$(NC)\n"
	@printf "\n$(YELLOW)📁 [4/8] 创建数据目录...$(NC)\n"
	@mkdir -p .data/postgres .data/minio
	@printf "$(GREEN)✓ 数据目录已创建$(NC)\n"
	@printf "\n$(YELLOW)📦 [5/8] 安装依赖...$(NC)\n"
	@pnpm install
	@printf "$(GREEN)✓ 依赖安装完成$(NC)\n"
	@printf "\n$(YELLOW)🐳 [6/8] 启动数据库和存储容器...$(NC)\n"
	@docker-compose up -d db minio
	@printf "$(GREEN)✓ 容器已启动$(NC)\n"
	@printf "\n$(YELLOW)⏳ [7/8] 等待数据库就绪...$(NC)\n"
	@sleep 5
	@docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1 || sleep 3
	@printf "$(GREEN)✓ 数据库就绪$(NC)\n"
	@printf "\n$(YELLOW)🗃️  [8/8] 执行数据库迁移...$(NC)\n"
	@pnpm db:migrate
	@printf "$(GREEN)✓ 数据库迁移完成$(NC)\n"
	@printf "\n$(BLUE)═══════════════════════════════════════$(NC)\n"
	@printf "$(GREEN)  ✨ 初始化完成！$(NC)\n"
	@printf "$(BLUE)═══════════════════════════════════════$(NC)\n"
	@printf "\n$(YELLOW)👉 运行 'make dev' 启动开发服务器$(NC)\n"
	@printf "$(YELLOW)👉 MinIO 控制台: http://localhost:9001$(NC)\n\n"

# 安装依赖
install:
	pnpm install

# 启动数据库和存储
db-up:
	docker-compose up -d db minio
	@echo "等待 MinIO 启动..."
	@sleep 3
	@docker exec miu2d-minio mc alias set local http://localhost:9000 minio minio123 2>/dev/null || true
	@docker exec miu2d-minio mc mb local/miu2d --ignore-existing 2>/dev/null || true

# 停止数据库和存储
db-down:
	docker-compose down

# 同时运行 web 和 server
dev: db-up
	@printf "$(GREEN)🚀 启动开发环境...$(NC)\n"
	pnpm dev

# 只运行 web
dev-web:
	pnpm dev:web

# 只运行 server
dev-server: db-up
	pnpm dev:server

# 构建所有包
build:
	pnpm build

# 数据库种子数据
db-seed:
	pnpm db:seed

# 运行引擎测试
test:
	pnpm --filter @miu2d/engine test

# 类型检查
tsc:
	pnpm tsc

# 代码检查
lint:
	pnpm lint

# 格式化代码
format:
	pnpm format

# 一键转换所有资源（编码 + ASF + MPC + MAP + 视频 + 音乐）
convert: ## 一键转换所有资源并删除旧文件
	@printf "$(GREEN)🔄 一键转换所有资源...$(NC)\n"
	cd packages/converter && cargo run --release --bin convert-all -- ../../resources --delete-originals
	@printf "$(GREEN)✓ 全部转换完成$(NC)\n"

convert-verify: ## 验证 ASF/MPC → MSF 无损转换
	@printf "$(GREEN)🔍 验证 ASF/MSF 无损...$(NC)\n"
	cd packages/converter && cargo run --release --bin verify -- ../../resources/asf
	@printf "$(GREEN)🔍 验证 MPC/MSF 无损...$(NC)\n"
	cd packages/converter && cargo run --release --bin verify_mpc -- ../../resources/mpc

# 构建 Docker 镜像
docker:
	@printf "$(GREEN)🐳 构建 Docker 镜像...$(NC)\n"
	docker build -f packages/server-rs/Dockerfile -t miu2d-server:latest .
	docker build -f packages/web/Dockerfile -t miu2d-web:latest .
	@printf "$(GREEN)✓ 镜像构建完成$(NC)\n"
