# MSF (Miu Sprite Format) v2 — 二进制格式规范

MSF 是 Miu2D Engine 设计的精灵动画格式，替代旧的 ASF 和 MPC 格式用于 Web 平台。

> **设计目标**：快解码、可扩展、Web 原生、无损保留 ASF/MPC 的全部视觉信息

---

## 与 ASF/MPC 对比

| 特性 | ASF (旧) | MPC (旧) | MSF v2 |
|------|----------|----------|--------|
| 用途 | 角色/物体动画 | 地图瓦片图块 | 统一替代两者 |
| 像素存储 | RLE 压缩 | RLE 压缩 | 原始调色板索引 + zstd |
| 帧边界 | 固定 canvas 大小 | 每帧独立尺寸 | **Per-frame tight bounding box** |
| Alpha | 隐藏在 RLE 流中 | 透明=跳过 | 显式 per-pixel alpha 或 palette alpha |
| 调色板 | BGRA | BGRA | RGBA |
| 可扩展 | 否 | 否 | **Chunk-based 扩展** |
| 解码复杂度 | RLE 状态机 | RLE 状态机 | 查表（极简） |
| 压缩 | 无 | 无 | **zstd** |

### 无损保证

| 源格式 | 文件数 | 像素格式 | 验证结果 |
|--------|--------|----------|----------|
| ASF | 2,086 | Indexed8Alpha8 (2bpp) | **0 差异** |
| MPC | 2,848 | Indexed8 (1bpp) | **0 差异** |

---

## 文件结构总览

```
┌──────────────────────────────────────────────────────┐
│ Preamble (8 bytes)                                   │
│   Magic "MSF2" (4) + Version u16 + Flags u16         │
├──────────────────────────────────────────────────────┤
│ Header (16 bytes)                                    │
│   canvas W/H, frameCount, dirs, fps, anchor, ...     │
├──────────────────────────────────────────────────────┤
│ Pixel Format Block (4 bytes)                         │
│   PixelFormat u8 + PaletteSize u16 + Reserved u8     │
├──────────────────────────────────────────────────────┤
│ Palette (paletteSize × 4 bytes)                      │
│   RGBA 各 1 字节                                     │
├──────────────────────────────────────────────────────┤
│ Frame Table (frameCount × 16 bytes)                  │
│   per-frame: offsetX, offsetY, width, height,        │
│              dataOffset, dataLength                   │
├──────────────────────────────────────────────────────┤
│ Extension Chunks (variable)                          │
│   [ChunkID(4) + Length(4) + Data(Length)] ...         │
├──────────────────────────────────────────────────────┤
│ End Sentinel (8 bytes)                               │
│   "END\0" (4) + 0u32 (4)                            │
├──────────────────────────────────────────────────────┤
│ Frame Data Blob (zstd-compressed)                    │
│   所有帧的原始像素数据依次拼接                        │
└──────────────────────────────────────────────────────┘
```

---

## 字段详解

### Preamble (偏移 0x00, 8 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x00 | 4 | char[4] | `magic` | 固定 `"MSF2"` (0x4D 0x53 0x46 0x32) |
| 0x04 | 2 | u16 | `version` | 格式版本 = `2` |
| 0x06 | 2 | u16 | `flags` | 位标志。bit 0: zstd 压缩 (v2 始终为 1) |

### Header (偏移 0x08, 16 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x08 | 2 | u16 | `canvasWidth` | 画布宽度（像素） |
| 0x0A | 2 | u16 | `canvasHeight` | 画布高度（像素） |
| 0x0C | 2 | u16 | `frameCount` | 总帧数 |
| 0x0E | 1 | u8 | `directions` | 方向数（通常 1/4/8） |
| 0x0F | 1 | u8 | `fps` | 帧率，由原格式的 `interval` 转换: `fps = 1000 / interval` |
| 0x10 | 2 | i16 | `anchorX` | 水平锚点偏移 |
| 0x12 | 2 | i16 | `anchorY` | 垂直锚点偏移 |
| 0x14 | 4 | — | reserved | 保留，填 0 |

### Pixel Format Block (偏移 0x18, 4 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x18 | 1 | u8 | `pixelFormat` | 像素格式枚举 |
| 0x19 | 2 | u16 | `paletteSize` | 调色板颜色数（通常 256） |
| 0x1B | 1 | — | reserved | 保留，填 0 |

**像素格式枚举**:

| 值 | 名称 | bpp | 说明 | 用途 |
|----|------|-----|------|------|
| 0 | `Rgba8` | 4 | 直接 RGBA 8888 | 预留 |
| 1 | `Indexed8` | 1 | 调色板索引，透明由 palette alpha 控制 | **MPC → MSF** |
| 2 | `Indexed8Alpha8` | 2 | 调色板索引 + per-pixel alpha 字节 | **ASF → MSF** |

### Palette (偏移 0x1C, `paletteSize × 4` 字节)

每个颜色条目 4 字节，**RGBA** 顺序。

- **Indexed8Alpha8**：palette alpha 通常为 255（alpha 由 per-pixel 字节控制）
- **Indexed8**：palette alpha=0 的条目代表透明像素

### Frame Table (偏移动态, `frameCount × 16` 字节)

每帧 16 字节：

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| +0 | 2 | i16 | `offsetX` | 帧在 canvas 中的 X 偏移 |
| +2 | 2 | i16 | `offsetY` | 帧在 canvas 中的 Y 偏移 |
| +4 | 2 | u16 | `width` | tight bbox 宽度（0 = 空帧） |
| +6 | 2 | u16 | `height` | tight bbox 高度（0 = 空帧） |
| +8 | 4 | u32 | `dataOffset` | 在解压后 blob 中的偏移 |
| +12 | 4 | u32 | `dataLength` | 帧数据字节数 = `width × height × bpp` |

### Extension Chunks & End Sentinel

扩展块序列以 `"END\0" + 0u32` (8 字节) 结束。

---

## 帧数据格式

### Indexed8 (bpp=1) — 用于 MPC

每帧数据 = `width × height` 字节，每字节是调色板索引。

```
data[y * width + x] = palette_index
→ RGBA = palette[palette_index]
```

透明通过 palette alpha 实现：编码时扫描所有帧，找到一个未被不透明像素使用的调色板索引作为透明索引，将该 palette 条目的 alpha 设为 0。

### Indexed8Alpha8 (bpp=2) — 用于 ASF

每帧数据 = `width × height × 2` 字节，每像素 2 字节：`[palette_index, alpha]`。

```
offset = (y * width + x) * 2
palette_index = data[offset]
alpha = data[offset + 1]
→ RGBA = (palette[palette_index].rgb, alpha)
```

ASF 需要此格式因为其 RLE 流包含 per-run alpha 值（可能是 0-255 任意值），不仅仅是全透明/全不透明。

---

## 解码伪代码

```python
# 1. 读取 header
magic, version, flags = read_preamble()
header = read_header()
pixel_format, palette_size = read_pixel_format_block()
palette = read_palette(palette_size)
frame_table = read_frame_table(header.frame_count)
skip_extension_chunks_until_end_sentinel()

# 2. 解压 blob
blob = zstd_decompress(remaining_data)

# 3. 逐帧解码
for frame in frame_table:
    raw = blob[frame.data_offset : frame.data_offset + frame.data_length]
    if pixel_format == Indexed8:
        for i in range(frame.width * frame.height):
            rgba[i] = palette[raw[i]]
    elif pixel_format == Indexed8Alpha8:
        for i in range(frame.width * frame.height):
            idx, alpha = raw[i*2], raw[i*2+1]
            rgba[i] = (*palette[idx].rgb, alpha)
```

---

## 偏移量计算速查

```
paletteStart     = 0x1C (28)
frameTableStart  = paletteStart + paletteSize × 4
extensionStart   = frameTableStart + frameCount × 16
blobStart        = extensionStart + extensions_size + 8 (END sentinel)
```

---

## 为什么不用行滤波器？

早期 v2 版本曾使用 PNG-style 行滤波器（Sub/Up/Average/Paeth），但经基准测试发现：

- **滤波器对调色板索引数据有害**：调色板索引是离散的（视觉相似的像素可能有完全不同的索引值），滤波反而增加了熵
- **直接 zstd** 压缩调色板索引效果最佳

测试数据（单文件基准）：

| 方案 | 大小 (ASF) | 比例 | 大小 (MPC) | 比例 |
|------|-----------|------|-----------|------|
| 原始 RLE | 335 KB | 100% | 470 KB | 100% |
| Indexed8Alpha8 + 滤波 + zstd | 142 KB | 42% | 557 KB | **118%** |
| Indexed8Alpha8 + zstd (无滤波) | 138 KB | 41% | 545 KB | 115% |
| **Indexed8 + zstd** | **62 KB** | **18%** | **442 KB** | **94%** |

MPC 使用 Indexed8 (1bpp) 因为 MPC RLE 只有二值 alpha (0/255)，节省 50% 原始数据量。
ASF 使用 Indexed8Alpha8 (2bpp) 因为需要保留 per-pixel 变化 alpha 值。

---

## 实现参考

| 模块 | 文件 | 说明 |
|------|------|------|
| Rust WASM 解码 | `packages/engine-wasm/src/msf_codec.rs` | WASM 解码器 |
| Rust CLI (ASF) | `packages/converter/src/main.rs` | ASF → MSF v2 批量转换 |
| Rust CLI (MPC) | `packages/converter/src/bin/mpc2msf.rs` | MPC → MSF v2 批量转换 |
| Rust 验证 (ASF) | `packages/converter/src/bin/verify.rs` | ASF ↔ MSF v2 逐像素验证 |
| Rust 验证 (MPC) | `packages/converter/src/bin/verify_mpc.rs` | MPC ↔ MSF v2 逐像素验证 |
| TS ASF 解码 | `packages/engine/src/wasm/wasm-asf-decoder.ts` | MSF v2 / ASF → AsfData |
| TS MPC 解码 | `packages/engine/src/wasm/wasm-mpc-decoder.ts` | MSF v2 / MPC → Mpc |

---

## ASF → MSF v2 转换

| 项目 | 数据 |
|------|------|
| 源格式 | ASF（精灵动画） |
| 目标像素格式 | `Indexed8Alpha8` (2bpp) |
| 文件数 | 2,086 |
| 原始 ASF 大小 | 459 MB |
| MSF v2 大小 | **235 MB（51.1%）** |
| 验证 | **0 差异** |

## MPC → MSF v2 转换

| 项目 | 数据 |
|------|------|
| 源格式 | MPC（地图瓦片） |
| 目标像素格式 | `Indexed8` (1bpp) |
| 文件数 | 2,848 |
| 原始 MPC 大小 | 563 MB |
| MSF v2 大小 | **388 MB（69.1%）** |
| 验证 | **0 差异** |

**合计：ASF + MPC 原始 1,022 MB → MSF v2 623 MB (61.0%)**

### 命令

```bash
make convert          # ASF/MPC/MAP 一键转换
make convert-verify   # 验证 ASF↔MSF 与 MPC↔MSF 无损
```