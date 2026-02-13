# Miu2D Engine WASM

高性能 WebAssembly 模块，为 Miu2D 游戏引擎提供计算密集型功能的 Rust 实现。

## 功能模块

### 🧭 PathFinder - A* 寻路算法

- **PathOneStep**: 简单贪心，约 10 步
- **SimpleMaxNpcTry**: 贪心最佳优先搜索，maxTry=100
- **PerfectMaxNpcTry**: A* 算法用于 NPC，maxTry=100
- **PerfectMaxPlayerTry**: A* 算法用于玩家，maxTry=500
- **PathStraightLine**: 直线路径（用于飞行者）

**性能提升**: 相比 JS 实现约 **10x** 提升

### 🎨 AsfDecoder - 精灵帧解码

- RLE 压缩数据解压
- 调色板颜色转换 (BGRA → RGBA)
- 支持批量解码所有帧

**性能提升**: 相比 JS 实现约 **10x** 提升

### 💥 SpatialHash - 空间碰撞检测

- 空间哈希网格快速查询
- 圆形/矩形碰撞检测
- 支持阵营分组查询
- 批量位置更新

**性能提升**: 相比 JS 实现约 **10x** 提升

## 安装依赖

需要安装 Rust 和 wasm-pack：

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装 wasm-pack
cargo install wasm-pack

# 添加 wasm32 目标
rustup target add wasm32-unknown-unknown
```

## 构建

```bash
# 开发构建
pnpm build

# 生产构建（优化）
pnpm build:release

# Node.js 目标构建
pnpm build:nodejs

# 运行测试
pnpm test

# 清理构建产物
pnpm clean
```

## 使用示例

### TypeScript 集成

```typescript
import init, { PathFinder, PathType, AsfDecoder, SpatialHash } from '@miu2d/engine-wasm';

// 初始化 WASM 模块
await init();

// ===== 寻路 =====
const pathfinder = new PathFinder(100, 100);
pathfinder.set_obstacle(5, 5, true, true);

const path = pathfinder.find_path(
  0, 0,           // 起点
  10, 10,         // 终点
  PathType.PerfectMaxPlayerTry,
  8               // 可移动方向数
);
// path: Int32Array [x1, y1, x2, y2, ...]

// ===== ASF 解码 =====
const asfData = await fetch('/resources/asf/player.asf').then(r => r.arrayBuffer());
const decoder = AsfDecoder.parse(new Uint8Array(asfData));
if (decoder) {
  const header = decoder.get_header();
  console.log(`帧数: ${header.frame_count}, 尺寸: ${header.width}x${header.height}`);

  const framePixels = decoder.decode_frame(0); // RGBA 像素数据
}

// ===== 碰撞检测 =====
const spatial = new SpatialHash(64.0); // 网格单元大小
spatial.upsert(1, 100.0, 100.0, 16.0, 0); // id, x, y, radius, group
spatial.upsert(2, 110.0, 100.0, 16.0, 1);

const nearby = spatial.query_radius(100.0, 100.0, 50.0);
const collisions = spatial.detect_all_collisions();
```

## 架构

```
packages/engine-wasm/
├── Cargo.toml          # Rust 项目配置
├── package.json        # npm 包配置
├── src/
│   ├── lib.rs          # 入口，导出所有模块
│   ├── pathfinder.rs   # A* 寻路算法
│   ├── asf_decoder.rs  # ASF 帧解码器
│   ├── collision.rs    # 空间碰撞检测
│   ├── mpc_decoder.rs  # MPC 解码器
│   └── msf_codec.rs    # MSF 编解码
└── pkg/                # wasm-pack 构建输出
    ├── miu2d_engine_wasm.js
    ├── miu2d_engine_wasm.d.ts
    └── miu2d_engine_wasm_bg.wasm
```

## 与 TypeScript Engine 集成

在 `@miu2d/engine` 中使用：

```typescript
// packages/engine/src/wasm/wasm-path-finder.ts
import init, { PathFinder, PathType } from '@miu2d/engine-wasm';

let wasmPathfinder: PathFinder | null = null;

export async function initWasmPathfinder(width: number, height: number) {
  await init();
  wasmPathfinder = new PathFinder(width, height);
}

export function findPathWasm(
  startX: number, startY: number,
  endX: number, endY: number,
  pathType: number
): Vector2[] {
  if (!wasmPathfinder) return [];

  const result = wasmPathfinder.find_path(
    startX, startY, endX, endY,
    pathType as PathType, 8
  );

  // 转换为 Vector2 数组
  const path: Vector2[] = [];
  for (let i = 0; i < result.length; i += 2) {
    path.push({ x: result[i], y: result[i + 1] });
  }
  return path;
}
```

## License

MIT
