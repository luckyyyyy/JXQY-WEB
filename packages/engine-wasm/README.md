# @miu2d/engine-wasm

Rust + WebAssembly 高性能模块，为 Miu2D 游戏引擎提供计算密集型功能，相比纯 JS 实现约 **10x** 性能提升。

## 模块总览

| 模块 | Rust 源码 | TS 桥接层 | 调用方 | 状态 |
|------|-----------|-----------|--------|------|
| **PathFinder** | `pathfinder.rs` | `wasm-path-finder.ts` | `character-movement.ts`, `game-engine.ts` | ✅ 唯一实现（已删除 TS A*） |
| **AsfDecoder** | `asf_decoder.rs` | `wasm-asf-decoder.ts` | `asf.ts`（资源加载） | ✅ 生产使用 |
| **MpcDecoder** | `mpc_decoder.rs` | `wasm-mpc-decoder.ts` | `mpc.ts`（资源加载） | ✅ 生产使用 |
| **MsfCodec** | `msf_codec.rs` | 通过 ASF/MPC 桥接层调用 | `asf.ts`, `mpc.ts`（MSF v2 格式） | ✅ 生产使用 |
| **SpatialHash** | `collision.rs` | `wasm-collision.ts` | （已导出，尚未接入游戏循环） | ⏳ 预留 |
| **zstd_decompress** | `lib.rs` | `wasm-manager.ts` | MMF 地图格式解码 | ✅ 生产使用 |

## 初始化流程

```
main.tsx → initWasm()
              ↓
         wasm-manager.ts（加载 WASM 模块，存储 module + memory 引用）
              ↓
    ┌─────────┼──────────────┬──────────────────┐
    ↓         ↓              ↓                  ↓
  asf.ts   mpc.ts    game-engine.ts      MMF 地图加载器
    ↓         ↓         ↓                      ↓
decodeAsf  decodeMpc  initWasmPathfinder  zstd_decompress
 Wasm()    Wasm()          ↓
                    character-movement.ts
                           ↓
                      findPathWasm()
```

应用启动时 `initWasm()` 只调用一次，内部去重。后续所有 WASM 调用通过 `getWasmModule()` 获取模块引用。

## 各模块详解

### 🧭 PathFinder — A* 寻路（唯一实现）

游戏中**全部寻路**均由 Rust 执行，TS 端仅保留 `PathType` 枚举和方向工具函数。

**5 种寻路算法：**

| PathType | 算法 | maxTry | 用途 |
|----------|------|--------|------|
| `PathOneStep` | Greedy Best-First | 10 | 单步寻路，敌人/循环巡逻 |
| `SimpleMaxNpcTry` | Greedy Best-First | 100 | NPC 简单寻路 |
| `PerfectMaxNpcTry` | A* | 100 | NPC 完美寻路（伙伴等） |
| `PerfectMaxPlayerTry` | A* | 500 | 玩家完美寻路 |
| `PathStraightLine` | 直线 | — | 飞行单位 |

**零拷贝共享内存：**

TS 端通过 `wasm.memory.buffer` 直接操作 WASM 线性内存，无需序列化/反序列化：

```typescript
// 获取 WASM 内存指针，创建 Uint8Array 视图直接写入障碍物位图
const ptr = pathfinder.obstacle_bitmap_ptr();
const view = new Uint8Array(wasmMemory.buffer, ptr, pathfinder.bitmap_byte_size());
view.set(obstacleData); // 零拷贝写入

// 路径结果也通过指针 + Int32Array 零拷贝读取
const resultPtr = pathfinder.path_result_ptr();
const result = new Int32Array(wasmMemory.buffer, resultPtr, len);
```

| 位图 | 指针 API | 同步时机 |
|------|----------|----------|
| 静态障碍物 | `obstacle_bitmap_ptr()` | 地图加载时一次 |
| 不可逾越障碍 | `hard_obstacle_bitmap_ptr()` | 地图加载时一次 |
| 动态障碍物 | `dynamic_bitmap_ptr()` | 每帧刷新（NPC/OBJ/武功精灵位置） |

**性能：** ~0.2–0.4ms / 次（PerfectMaxPlayerTry 500 上限）

### 🎨 AsfDecoder — 精灵帧解码

解码 ASF（legacy）和 MSF v2 格式的精灵动画帧。

- RLE 压缩数据解压（legacy ASF）
- Indexed8 调色板 + zstd 解压（MSF v2，通过 `msf_codec.rs`）
- 调色板颜色转换 (BGRA → RGBA)
- JS 预分配输出缓冲区，WASM 直接填充

```typescript
const asfData = decodeAsfWasm(buffer); // 自动检测 ASF / MSF v2 格式
// asfData.frames[i].pixels → Uint8Array (RGBA)
```

### 📦 MpcDecoder — MPC 地图瓦片解码

解码 MPC（legacy）和 MSF v2 格式的地图瓦片包。

- 与 AsfDecoder 相同的双格式检测机制
- JS 预分配 3 个输出数组（像素、帧尺寸、帧偏移），WASM 批量填充
- 支持每帧不同尺寸

```typescript
const mpcData = decodeMpcWasm(buffer); // 自动检测 MPC / MSF v2 格式
```

### 🗜️ MsfCodec — MSF v2 编解码

新一代精灵格式，体积更小、解码更快：
- Indexed8 调色板（256 色，每像素 1 字节 + 1 字节 Alpha）
- zstd 压缩（via `ruzstd`）
- 被 AsfDecoder 和 MpcDecoder 内部调用，无独立 TS 桥接层

### 🗜️ zstd_decompress — Zstd 解压

`lib.rs` 中的独立函数，在 `initWasm()` 时注册为 MMF（Miu Map Format）地图格式的解压回调。

### 💥 SpatialHash — 空间碰撞检测（预留）

基于空间哈希网格的碰撞检测，已实现但尚未接入游戏循环：
- 空间哈希网格快速查询
- 圆形碰撞检测
- 阵营分组过滤
- `Float32Array` 批量位置更新

## Debug 日志

dev 构建下，PathFinder 每次寻路自动输出耗时到 `console.debug`：

```
[WASM PathFinder] PerfectMaxPlayerTry (53,163)→(46,166) 34pts 0.200ms
```

Release 构建通过 `cfg(debug_assertions)` 完全编译移除，零开销。

## 构建

```bash
# 环境准备
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install wasm-pack
rustup target add wasm32-unknown-unknown

# 构建命令
pnpm build            # 开发构建（含 debug 日志）
pnpm build:release    # 生产构建（日志移除，wasm-opt 优化）
pnpm test             # 运行 Rust 测试（29 个用例）
pnpm clean            # 清理构建产物
```

## 目录结构

```
packages/engine-wasm/
├── Cargo.toml              # Rust 依赖：wasm-bindgen, js-sys, web-sys, hashbrown, ruzstd
├── src/
│   ├── lib.rs              # 入口 + zstd_decompress
│   ├── pathfinder.rs       # A* 寻路（1186 行，最大模块）
│   ├── asf_decoder.rs      # ASF 精灵帧解码
│   ├── mpc_decoder.rs      # MPC 地图瓦片解码
│   ├── msf_codec.rs        # MSF v2 编解码
│   └── collision.rs        # 空间碰撞检测
└── pkg/                    # wasm-pack 输出
    ├── miu2d_engine_wasm.js
    ├── miu2d_engine_wasm.d.ts
    └── miu2d_engine_wasm_bg.wasm
```

## License

MIT
