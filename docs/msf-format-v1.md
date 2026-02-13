# MSF (Miu Sprite Format) v1 — 二进制格式规范

MSF 是 Miu2D Engine 设计的精灵动画格式，替代旧的 ASF 和 MPC 格式用于 Web 平台。

> **设计目标**：快解码、可扩展、Web 原生、无损保留 ASF/MPC 的全部视觉信息

---

## 与 ASF/MPC 对比

| 特性 | ASF (旧) | MPC (旧) | MSF v1 (新) |
|------|----------|----------|-------------|
| 用途 | 角色/物体动画 | 地图瓦片图块 | 统一替代两者 |
| 像素存储 | RLE 压缩 | RLE 压缩 | Indexed8Alpha8 per-frame |
| 帧边界 | 固定 canvas 大小 | 每帧独立尺寸 | **Per-frame tight bounding box** |
| Alpha | 隐藏在 RLE 流中 | 透明=跳过 | 显式 per-pixel alpha 字节 |
| 调色板 | BGRA | BGRA | RGBA |
| 可扩展 | 否 | 否 | **Chunk-based 扩展** |
| 解码复杂度 | RLE 状态机 | RLE 状态机 | 简单拷贝 + 查表 |
| zstd 压缩 | 无 | 无 | 支持（flags bit 0） |

### 无损保证

| 源格式 | 文件数 | 像素格式 | 验证像素总数 | 差异像素 |
|--------|--------|------------|------------|--------|
| ASF | 2,086 | Indexed8Alpha8 | 96.25 亿 | **0** |
| MPC | 2,848 | Indexed8Alpha8 | 7.4 亿 | **0** |

---

## 文件结构总览

```
┌──────────────────────────────────────────────────────┐
│ Preamble (8 bytes)                                   │
│   Magic "MSF1" (4) + Version u16 + Flags u16         │
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
│ Frame Data Blob (variable)                           │
│   所有帧的像素数据依次拼接                            │
└──────────────────────────────────────────────────────┘
```

---

## 字段详解

### Preamble (偏移 0x00, 8 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x00 | 4 | char[4] | `magic` | 固定 `"MSF1"` (0x4D 0x53 0x46 0x31) |
| 0x04 | 2 | u16 | `version` | 格式版本，当前 = `1` |
| 0x06 | 2 | u16 | `flags` | 位标志。bit 0: 0 = 未压缩, 1 = zstd 压缩 |

### Header (偏移 0x08, 16 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x08 | 2 | u16 | `canvasWidth` | 画布宽度（像素），对应 ASF 的 `globalWidth` |
| 0x0A | 2 | u16 | `canvasHeight` | 画布高度（像素），对应 ASF 的 `globalHeight` |
| 0x0C | 2 | u16 | `frameCount` | 总帧数 |
| 0x0E | 1 | u8 | `directions` | 方向数（通常 1/4/8） |
| 0x0F | 1 | u8 | `fps` | 帧率，由 ASF 的 `interval` 转换: `fps = 1000 / interval` |
| 0x10 | 2 | i16 | `anchorX` | 水平锚点偏移（对应 ASF 的 `left`） |
| 0x12 | 2 | i16 | `anchorY` | 垂直锚点偏移（对应 ASF 的 `bottom`） |
| 0x14 | 4 | — | reserved | 保留，填 0 |

### Pixel Format Block (偏移 0x18, 4 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x18 | 1 | u8 | `pixelFormat` | 像素格式枚举（见下表） |
| 0x19 | 2 | u16 | `paletteSize` | 调色板颜色数（通常 256） |
| 0x1B | 1 | — | reserved | 保留，填 0 |

**像素格式枚举**:

| 值 | 名称 | 每像素字节 | 说明 |
|----|------|-----------|------|
| 0 | `Rgba8` | 4 | 直接 RGBA 8888 |
| 1 | `Indexed8` | 1 | 调色板索引，无 per-pixel alpha |
| **2** | **`Indexed8Alpha8`** | **2** | **调色板索引 + alpha 字节（推荐，ASF/MPC 转换默认使用）** |

### Palette (偏移 0x1C, `paletteSize × 4` 字节)

每个颜色条目 4 字节，**RGBA** 顺序：

| 字节 | 说明 |
|------|------|
| +0 | Red |
| +1 | Green |
| +2 | Blue |
| +3 | Alpha (通常 255) |

> 注意：ASF 调色板为 BGRA 顺序，转换时已翻转为 RGBA。

### Frame Table (偏移动态, `frameCount × 16` 字节)

紧跟 Palette 之后。每帧 16 字节：

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| +0 | 2 | i16 | `offsetX` | 帧内容在 canvas 中的 X 偏移 |
| +2 | 2 | i16 | `offsetY` | 帧内容在 canvas 中的 Y 偏移 |
| +4 | 2 | u16 | `width` | tight bbox 的宽度（0 = 空帧） |
| +6 | 2 | u16 | `height` | tight bbox 的高度（0 = 空帧） |
| +8 | 4 | u32 | `dataOffset` | 在 Frame Data Blob 中的偏移 |
| +12 | 4 | u32 | `dataLength` | 帧数据字节数 |

**Tight Bounding Box** 原理：

```
┌─────────────────────────┐ canvasWidth × canvasHeight
│                         │
│    ┌───────┐            │
│    │ █████ │ ← tight bbox (offsetX, offsetY, width, height)
│    │ █████ │            │
│    └───────┘            │
│                         │
└─────────────────────────┘
```

只存储非透明像素的最小矩形区域，空帧 `width=0, height=0`。

### Extension Chunks (可变长度)

Frame Table 之后为扩展块序列，每块格式：

| 偏移 | 大小 | 类型 | 说明 |
|------|------|------|------|
| +0 | 4 | char[4] | Chunk ID (如 `"HITB"`, `"META"` 等) |
| +4 | 4 | u32 | 数据长度 (bytes) |
| +8 | N | — | Chunk 数据 |

以 **End Sentinel** 结束：

| 偏移 | 大小 | 说明 |
|------|------|------|
| +0 | 4 | `"END\0"` (0x45 0x4E 0x44 0x00) |
| +4 | 4 | `0x00000000` |

v1 尚未定义标准扩展块，但格式支持未来添加（如碰撞框、事件标记、LOD 等）。

### Frame Data Blob

End Sentinel 之后，所有帧的像素数据依次拼接。

**Indexed8Alpha8 格式**（pixelFormat = 2）：

每像素 2 字节：

| 字节 | 说明 |
|------|------|
| +0 | 调色板索引 (0-255) |
| +1 | Alpha 值 (0 = 透明, 255 = 不透明) |

帧数据大小 = `width × height × 2` 字节。

**解码伪代码**：

```
for y in 0..frame.height:
  for x in 0..frame.width:
    idx = blob[frame.dataOffset + (y * frame.width + x) * 2]
    alpha = blob[frame.dataOffset + (y * frame.width + x) * 2 + 1]
    if alpha == 0:
      output[frame.offsetY + y][frame.offsetX + x] = transparent
    else:
      color = palette[idx]
      output[frame.offsetY + y][frame.offsetX + x] = RGBA(color.r, color.g, color.b, alpha)
```

---

## 偏移量计算速查

```
paletteStart     = 0x1C (28)
frameTableStart  = paletteStart + paletteSize × 4
extensionStart   = frameTableStart + frameCount × 16
blobStart        = extensionStart + (所有 chunk 大小之和) + 8 (END sentinel)
```

---

## 实现参考

| 模块 | 文件 | 说明 |
|------|------|------|
| Rust 编解码 | `packages/engine-wasm/src/msf_codec.rs` | 编码器 + WASM 解码器 |
| Rust CLI (ASF) | `packages/converter/src/main.rs` | 批量 ASF → MSF |
| Rust CLI (MPC) | `packages/converter/src/bin/mpc2msf.rs` | 批量 MPC → MSF |
| Rust 验证 (ASF) | `packages/converter/src/bin/verify.rs` | ASF ↔ MSF 逐像素比对 |
| Rust 验证 (MPC) | `packages/converter/src/bin/verify_mpc.rs` | MPC ↔ MSF 逐像素比对 |
| TS ASF 解码 | `packages/engine/src/wasm/wasm-asf-decoder.ts` | 自动检测 MSF/ASF |
| TS MPC 解码 | `packages/engine/src/wasm/wasm-mpc-decoder.ts` | 自动检测 MSF/MPC |
| TS ASF URL 重写 | `packages/engine/src/resource/asf.ts` | `.asf` → `.msf` 透明替换 |
| TS MPC URL 重写 | `packages/engine/src/resource/mpc.ts` | `.mpc` → `.msf` 透明替换 |

---

## ASF → MSF 转换

ASF 帧使用全局 canvas（所有帧相同尺寸），转换时提取 tight bounding box 并保存 `offsetX/offsetY` 偏移。

**WASM 解码模式**：`decode_msf_frames` — 将 tight bbox 合成回全局 canvas。

| 项目 | 数据 |
|------|------|
| 源格式 | ASF（精灵动画） |
| 目标像素格式 | `Indexed8Alpha8`（2字节/像素） |
| 文件数 | 2,086 |
| 原始大小 | 459 MB |
| MSF 大小 | 235 MB（51.1%） |
| 验证 | 96.25 亿像素，0 差异 |

---

## MPC → MSF 转换

MPC（地图瓦片资源包）每帧有独立的宽高和 RLE 数据。转换到 MSF 时保留每帧独立尺寸，`offsetX=0, offsetY=0`（MPC 无 canvas 合成概念）。

### 字段映射

| MPC 字段 | MSF 字段 | 说明 |
|----------|----------|------|
| `globalWidth` | `canvasWidth` | 全局宽度 |
| `globalHeight` | `canvasHeight` | 全局高度 |
| `frameCounts` | `frameCount` | 帧数 |
| `direction` | `directions` | 方向数（MPC 通常 = 1） |
| `interval` (ms) | `fps` | `fps = 1000 / interval` |
| `globalWidth / 2` | `anchorX` | 水平锚点 |
| 经公式转换 | `anchorY` | `globalHeight >= 16 ? globalHeight - 16 - bottom : 16 - globalHeight - bottom` |

### 透明度处理

MPC RLE 使用 `byte > 0x80` 表示透明像素跳过，有色像素隐含 `alpha = 255`。MSF 使用 `Indexed8Alpha8`（2 字节/像素），将 MPC 语义精确映射为：

| MPC RLE | MSF Indexed8Alpha8 |
|---------|-------------------|
| 透明像素（跳过） | `[index=0, alpha=0]` |
| 有色像素 `idx` | `[index=idx, alpha=255]` |

> 最初尝试使用 `Indexed8`（1 字节/像素），但无法区分"透明"和"调色板索引 0 的有色像素"，导致 2524/2848 文件验证失败。改用 `Indexed8Alpha8` 后全部通过。

### WASM 解码模式

MPC 转换后的 MSF 使用专用解码函数 `decode_msf_individual_frames`（区别于 ASF 的 `decode_msf_frames`）：

| 函数 | 用途 | 输出方式 |
|------|------|----------|
| `decode_msf_frames` | ASF → 合成到全局 canvas | 每帧 = canvasWidth × canvasHeight |
| `decode_msf_individual_frames` | MPC → 每帧独立尺寸 | 每帧 = frame.width × frame.height |

`decode_msf_individual_frames` 的输出缓冲区：

```
pixel_output:         所有帧 RGBA 像素依次拼接
frame_sizes_output:   [width₀, height₀, width₁, height₁, ...] (u32 pairs)
frame_offsets_output: [offset₀, offset₁, ...] (u32, pixel_output 中的字节偏移)
```

### TS 自动检测

[wasm-mpc-decoder.ts](../packages/engine/src/wasm/wasm-mpc-decoder.ts) 检查前 4 字节 magic：

- `"MSF1"` → 使用 `parse_msf_header` + `decode_msf_individual_frames`
- 否则 → 使用原有 `parse_mpc_header` + `decode_mpc_frames`

[mpc.ts](../packages/engine/src/resource/mpc.ts) 将 `.mpc` URL 重写为 `.msf`（同 ASF 的透明替换模式）。

### 转换统计

| 项目 | 数据 |
|------|------|
| 源格式 | MPC（地图瓦片） |
| 目标像素格式 | `Indexed8Alpha8`（2字节/像素） |
| 文件数 | 2,848 |
| 原始大小 | 562.5 MB |
| MSF 大小 | 444.2 MB（79.0%） |
| zstd 压缩级别 | 3 |
| 验证 | 7.4 亿像素，0 差异 |

### 命令

```bash
# 转换（包含 ASF/MPC/MAP）
make convert

# 验证（ASF/MPC）
make convert-verify
```

---

## Hex Dump 示例

```
00000000: 4d53 4631 0100 0000  MSF1....        magic="MSF1" ver=1 flags=0
00000008: 9900 8d00 8800 0816  ........        canvas=153×141 frames=136 dirs=8 fps=22
00000010: 3d00 6e00 0000 0000  =.n.....        anchor=(61,110) reserved
00000018: 0200 0100 0000 00ff  ........        pixelFormat=2(Indexed8Alpha8) palette=256
00000020: 0c13 07ff 140b 02ff  ........        palette[0]=(12,19,7,255)  palette[1]=(20,11,2,255)
```
