# @miu2d/converter

游戏资源转换工具集（Rust CLI）。

将《剑侠情缘外传：月影传说》的资源批量转换为 Web 优化格式（ASF/MPC → MSF，MAP → MMF）。

---

## 特性

- **无损转换** — ASF 使用 Indexed8Alpha8 (2bpp)，MPC 使用 Indexed8 (1bpp)，经 4,934 文件逐像素验证零差异
- **并行处理** — 基于 [rayon](https://crates.io/crates/rayon) 的多线程批量转换
- **Tight Bounding Box** — 裁剪每帧的透明边距，减少数据量
- **内置验证** — `verify` 工具逐像素比对 ASF 与 MSF 的解码结果
- **Alpha 扫描** — `scan_alpha` 工具分析 ASF 文件的半透明使用情况

---

## 前置要求

- [Rust](https://rustup.rs/) 工具链

---

## 使用方式

### 通过 Makefile（推荐）

```bash
# 一键转换资源（ASF/MPC/MAP/编码/视频）
make convert

# 逐像素验证转换结果（ASF + MPC）
make convert-verify
```

### 通过 pnpm

```bash
cd packages/converter

# 转换到单独输出目录
pnpm convert:asf
# → resources/asf → resources/asf_msf

# 转换 + 部署（回写 .msf 到 resources/asf/ 并清理）
pnpm convert:asf:deploy

# MPC 转换到单独输出目录
pnpm convert:mpc

# MPC 转换 + 部署（回写 .msf 到 resources/mpc/ 并清理）
pnpm convert:mpc:deploy

# MAP 转 MMF
pnpm convert:map

# 逐像素验证（对比同目录下的 .asf 和 .msf 文件）
pnpm verify

# 扫描 ASF 文件的半透明 alpha 使用情况
pnpm scan-alpha
```

### 通过 cargo

```bash
cd packages/converter

# 批量转换
cargo run --release --bin asf2msf -- <输入目录> <输出目录>

# 逐像素验证
cargo run --release --bin verify -- <包含 .asf 和 .msf 的目录>

# Alpha 扫描
cargo run --release --bin scan_alpha -- <ASF 目录>
```

---

## 工具说明

### asf2msf（主转换器）

递归扫描输入目录下所有 `.asf` 文件，转换为 `.msf` 并保持目录结构。

```
asf2msf <input_dir> <output_dir>
```

输出示例：

```
[INFO] 找到 2086 个 ASF 文件
[OK]   asf/char/hero/walk.asf → asf_msf/char/hero/walk.msf (12.3KB → 8.7KB)
...
[DONE] 2086/2086 成功, 0 失败
```

### verify（逐像素验证）

将同一目录下的 `.asf` 和 `.msf` 文件分别解码为 RGBA 像素，逐像素比对。

```
verify <directory>
```

输出示例：

```
[PASS] char/hero/walk — 136 帧, 12480 像素, 0 差异
...
ALL 2086 FILES PIXEL-PERFECT — 0 differences
```

### scan_alpha（Alpha 扫描）

分析 ASF 文件中的 per-pixel alpha 使用情况，帮助确认像素格式选择（ASF 需要 Indexed8Alpha8；MPC 无半透明，使用 Indexed8）。

```
scan_alpha <asf_directory>
```

---

## 转换流程

```
ASF 文件                          MSF 文件
┌────────────────┐               ┌────────────────┐
│ BGRA 调色板    │  → 翻转 →     │ RGBA 调色板    │
│ RLE 压缩帧     │  → 解码 →     │ Indexed8Alpha8 │
│ 固定 canvas    │  → 裁剪 →     │ (2bpp) + zstd  │
│ 单帧结构       │  → 拼接 →     │ Frame Table    │
└────────────────┘               └────────────────┘

MPC 文件                          MSF 文件
┌────────────────┐               ┌────────────────┐
│ BGRA 调色板    │  → 翻转 →     │ RGBA 调色板    │
│ RLE 压缩帧     │  → 解码 →     │ Indexed8        │
│ 每帧独立尺寸   │  → 保留 →     │ (1bpp) + zstd  │
│ 单帧结构       │  → 拼接 →     │ Frame Table    │
└────────────────┘               └────────────────┘
```

每帧处理步骤：

1. 解码 ASF RLE 流 → 得到 canvas 大小的 RGBA + 索引数据
2. 计算 tight bounding box（最小非透明矩形）
3. 裁剪帧数据到 bbox 范围
4. ASF：将每像素编码为 2 字节 `[palette_index, alpha]`（Indexed8Alpha8）；MPC：仅 1 字节 `[palette_index]`（Indexed8）
5. zstd 压缩帧数据，记录帧的 offset / size 到 Frame Table

---

## 项目结构

```
packages/converter/
├── Cargo.toml          # Rust 依赖 (walkdir, rayon, zstd, encoding_rs)
├── package.json        # pnpm 脚本
├── README.md
└── src/
    ├── main.rs         # 主转换器
    └── bin/
        ├── mpc2msf.rs     # MPC → MSF
        ├── map2mmf.rs     # MAP → MMF
        ├── convert_all.rs # 一键转换入口
        ├── verify.rs      # ASF 逐像素验证
        ├── verify_mpc.rs  # MPC 逐像素验证
        └── scan_alpha.rs  # Alpha 使用扫描
```

---

## 相关文档

- [MSF 格式规范](../../docs/msf-format.md) — 完整的二进制格式定义
- [二进制格式总览](../../docs/binary-formats.md) — ASF / MPC / SHD / MAP 格式文档
- [WASM 解码器](../engine-wasm/src/msf_codec.rs) — 运行时 MSF 解码实现
