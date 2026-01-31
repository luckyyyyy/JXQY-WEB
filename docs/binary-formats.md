# 二进制文件格式解析文档

本文档详细说明《剑侠情缘外传：月影传说》游戏中使用的二进制文件格式，包括 MAP、ASF、MPC、SHD 等格式的完整结构。

> 📖 本文档基于 C# 版本 JxqyHD 的实现和 TypeScript Web 版本的代码分析整理。

---

## 目录

1. [通用约定](#通用约定)
2. [ASF 格式 - 精灵动画](#asf-格式---精灵动画)
3. [MPC 格式 - 地图瓦片资源包](#mpc-格式---地图瓦片资源包)
4. [SHD 格式 - 阴影数据](#shd-格式---阴影数据)
5. [MAP 格式 - 地图数据](#map-格式---地图数据)
6. [附录：工具命令](#附录工具命令)

---

## 通用约定

### 字节序

所有多字节整数均使用 **小端序 (Little-Endian)**。

```typescript
// TypeScript 读取小端 32 位整数
function getLittleEndianInt(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  );
}
```

### 文本编码

- 文件路径、名称：**GBK/GB2312** 编码
- 字符串以 **null (0x00)** 结尾

### 调色板格式

调色板使用 **BGRA** 顺序存储（每色 4 字节），读取时需转换为 RGBA：

```typescript
// BGRA -> RGBA
const b = data[offset++];
const g = data[offset++];
const r = data[offset++];
offset++; // Alpha (通常为 0xFF 或忽略)
// 结果: [r, g, b, 255]
```

---

## ASF 格式 - 精灵动画

ASF (Animation Sprite File) 是角色、NPC、特效等精灵动画的存储格式。

### 文件结构总览

```
┌────────────────────────────────────────┐
│ File Signature (16 bytes)              │ 偏移: 0
├────────────────────────────────────────┤
│ Metadata Header (48 bytes)             │ 偏移: 16
├────────────────────────────────────────┤
│ Palette (colorCount × 4 bytes)         │ 偏移: 64
├────────────────────────────────────────┤
│ Frame Offset Table (frameCount × 8)    │ 动态偏移
├────────────────────────────────────────┤
│ RLE Compressed Frame Data              │ 动态偏移
└────────────────────────────────────────┘
```

### 文件签名 (0x00 - 0x0F)

| 偏移 | 大小 | 类型 | 说明 |
|------|------|------|------|
| 0x00 | 7 | string | 签名 `"ASF 1.0"` |
| 0x07 | 9 | - | 保留字节 |

### 元数据头 (0x10 - 0x3F)

| 偏移 | 大小 | 类型 | 字段名 | 说明 |
|------|------|------|--------|------|
| 0x10 | 4 | int32 | `globleWidth` | 全局帧宽度（像素） |
| 0x14 | 4 | int32 | `globleHeight` | 全局帧高度（像素） |
| 0x18 | 4 | int32 | `frameCounts` | 总帧数 |
| 0x1C | 4 | int32 | `direction` | 方向数量（通常 1/4/8） |
| 0x20 | 4 | int32 | `colourCounts` | 调色板颜色数（通常 256） |
| 0x24 | 4 | int32 | `interval` | 帧间隔（毫秒） |
| 0x28 | 4 | int32 | `left` | 水平锚点偏移 |
| 0x2C | 4 | int32 | `bottom` | 垂直锚点偏移（从底部） |
| 0x30 | 16 | - | - | 保留字节 |

### 调色板 (0x40 起)

从偏移 `0x40` 开始，共 `colourCounts` 个颜色条目，每条目 4 字节：

| 偏移 | 大小 | 说明 |
|------|------|------|
| +0 | 1 | Blue |
| +1 | 1 | Green |
| +2 | 1 | Red |
| +3 | 1 | 保留（Alpha/Padding） |

### 帧偏移表

紧随调色板之后，共 `frameCounts` 个条目，每条目 8 字节：

| 偏移 | 大小 | 类型 | 说明 |
|------|------|------|------|
| +0 | 4 | int32 | `dataOffset` - 帧数据偏移（相对文件起始） |
| +4 | 4 | int32 | `dataLength` - 帧数据长度（字节） |

### RLE 压缩帧数据

每帧使用 **行程编码 (RLE)** 压缩，解压算法：

```typescript
function decodeFrame(
  bytes: Uint8Array,
  offset: number,
  length: number,
  width: number,
  height: number,
  palette: Color[]
): ImageData {
  const data = new Uint8Array(width * height * 4);
  let pixelIdx = 0;
  const dataEnd = offset + length;

  while (offset < dataEnd && pixelIdx < width * height * 4) {
    const pixelCount = bytes[offset++];  // 像素数量
    const pixelAlpha = bytes[offset++];  // Alpha 值

    for (let k = 0; k < pixelCount; k++) {
      if (pixelAlpha === 0) {
        // 透明像素
        data[pixelIdx++] = 0;
        data[pixelIdx++] = 0;
        data[pixelIdx++] = 0;
        data[pixelIdx++] = 0;
      } else {
        // 有色像素
        const colorIndex = bytes[offset++];
        const color = palette[colorIndex];
        data[pixelIdx++] = color.r;
        data[pixelIdx++] = color.g;
        data[pixelIdx++] = color.b;
        data[pixelIdx++] = pixelAlpha;  // 使用实际 Alpha
      }
    }
  }

  return new ImageData(data, width, height);
}
```

**RLE 编码规则**：
- 每组以 2 字节开头：`[像素数量, Alpha值]`
- 若 `Alpha = 0`：后续为透明像素，无调色板索引
- 若 `Alpha > 0`：后续跟 `像素数量` 个调色板索引字节

### 方向与帧索引计算

```typescript
// 计算每个方向的帧数
const framesPerDirection = frameCounts / directions;

// 获取指定方向、指定动画帧的全局帧索引
function getFrameIndex(direction: number, animFrame: number): number {
  return direction * framesPerDirection + (animFrame % framesPerDirection);
}
```

---

## MPC 格式 - 地图瓦片资源包

MPC (Map Picture Container) 存储地图瓦片图片，每个 MPC 文件包含多帧图片（通常用于地图动画）。

### 文件结构总览

```
┌────────────────────────────────────────┐
│ File Signature (64 bytes)              │ 偏移: 0
├────────────────────────────────────────┤
│ Metadata Header (32 bytes)             │ 偏移: 64
├────────────────────────────────────────┤
│ Reserved (32 bytes)                    │ 偏移: 96
├────────────────────────────────────────┤
│ Palette (colourCounts × 4 bytes)       │ 偏移: 128
├────────────────────────────────────────┤
│ Frame Offset Table (frameCounts × 4)   │ 动态偏移
├────────────────────────────────────────┤
│ Frame Data Blocks                      │ 动态偏移
└────────────────────────────────────────┘
```

### 文件签名 (0x00 - 0x3F)

| 偏移 | 大小 | 类型 | 说明 |
|------|------|------|------|
| 0x00 | 12 | string | 签名 `"MPC File Ver"` 或 `"SHD File Ver"` |
| 0x0C | 52 | - | 保留字节 |

### 元数据头 (0x40 - 0x5F)

| 偏移 | 大小 | 类型 | 字段名 | 说明 |
|------|------|------|--------|------|
| 0x40 | 4 | int32 | `framesDataLengthSum` | 所有帧数据总长度 |
| 0x44 | 4 | int32 | `globleWidth` | 全局帧宽度 |
| 0x48 | 4 | int32 | `globleHeight` | 全局帧高度 |
| 0x4C | 4 | int32 | `frameCounts` | 帧数量 |
| 0x50 | 4 | int32 | `direction` | 方向数（MPC 通常为 1） |
| 0x54 | 4 | int32 | `colourCounts` | 调色板颜色数 |
| 0x58 | 4 | int32 | `interval` | 动画间隔（毫秒） |
| 0x5C | 4 | int32 | `bottom` | 底部偏移（原始值） |

### 锚点偏移转换

MPC 的 `left` 和 `bottom` 需要转换为 ASF 兼容格式：

```typescript
head.left = Math.floor(head.globleWidth / 2);

if (head.globleHeight >= 16) {
  head.bottom = head.globleHeight - 16 - head.bottom;
} else {
  head.bottom = 16 - head.globleHeight - head.bottom;
}
```

### 调色板 (0x80 起)

偏移 `0x80 (128)` 开始，格式同 ASF（BGRA，每色 4 字节）。

### 帧偏移表

紧随调色板，共 `frameCounts` 个偏移值（每个 4 字节 int32）：

| 偏移 | 类型 | 说明 |
|------|------|------|
| +0 | int32 | 帧数据相对偏移（相对帧数据起始位置） |

### 帧数据块

每帧数据结构：

```
┌────────────────────────────────────┐
│ dataLen   (4 bytes, int32)         │ 帧数据总长度
├────────────────────────────────────┤
│ width     (4 bytes, int32)         │ 帧宽度
├────────────────────────────────────┤
│ height    (4 bytes, int32)         │ 帧高度
├────────────────────────────────────┤
│ reserved  (8 bytes)                │ 保留字节
├────────────────────────────────────┤
│ RLE Data  (dataLen - 20 bytes)     │ 压缩像素数据
└────────────────────────────────────┘
```

### MPC RLE 解压

MPC 使用不同于 ASF 的 RLE 编码：

```typescript
function decodeMpcFrame(
  data: Uint8Array,
  dataStart: number,
  dataLen: number,
  width: number,
  height: number,
  palette: Color[]
): ImageData {
  const pixels = new Uint8Array(width * height * 4);
  let pixelIdx = 0;
  const dataEnd = dataStart + dataLen - 20; // 减去帧头 20 字节

  while (dataStart < dataEnd && pixelIdx < width * height) {
    const byte = data[dataStart];

    if (byte > 0x80) {
      // 透明像素块
      // byte - 0x80 = 透明像素数量
      const transparentCount = byte - 0x80;
      for (let i = 0; i < transparentCount; i++) {
        const idx = pixelIdx * 4;
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
        pixelIdx++;
      }
      dataStart++;
    } else {
      // 有色像素块
      // byte = 后续颜色索引的数量
      const colorCount = byte;
      dataStart++;
      for (let i = 0; i < colorCount; i++) {
        const paletteIdx = data[dataStart++];
        const idx = pixelIdx * 4;
        const color = palette[paletteIdx];
        pixels[idx] = color.r;
        pixels[idx + 1] = color.g;
        pixels[idx + 2] = color.b;
        pixels[idx + 3] = 255;
        pixelIdx++;
      }
    }
  }

  return new ImageData(pixels, width, height);
}
```

**MPC RLE 规则**：
- 若 `byte > 0x80`：表示 `(byte - 0x80)` 个透明像素，无后续数据
- 若 `byte <= 0x80`：表示后续有 `byte` 个调色板索引

---

## SHD 格式 - 阴影数据

SHD (Shadow) 格式与 MPC 结构相似，但用于存储阴影遮罩。

### 与 MPC 的区别

1. **文件签名**：`"SHD File Ver"`
2. **无调色板**：SHD 不包含调色板数据
3. **像素处理**：所有有色像素均渲染为半透明黑色

```typescript
// SHD RLE 解压
if (byte > 0x80) {
  // 透明像素
  const transparentCount = byte - 0x80;
  for (let i = 0; i < transparentCount; i++) {
    data[pixelIdx++] = Color.Transparent;
  }
  dataStart++;
} else {
  // 阴影像素（黑色 60% 透明度）
  const colorCount = byte;
  dataStart++;
  for (let i = 0; i < colorCount; i++) {
    data[pixelIdx++] = { r: 0, g: 0, b: 0, a: 153 }; // 0.6 × 255 ≈ 153
  }
}
```

### 使用方式

SHD 通常与 MPC 配对使用，作为阴影叠加层：

```typescript
// C# 示例
const mpc = new Mpc(mpcPath, shdFileName);
```

---

## MAP 格式 - 地图数据

MAP 文件存储地图的完整数据，包括尺寸、MPC 引用列表、三层瓦片数据和障碍/陷阱信息。

### 文件结构总览

```
┌────────────────────────────────────────┐
│ File Signature (32 bytes)              │ 偏移: 0
├────────────────────────────────────────┤
│ MPC Directory Path (36 bytes)          │ 偏移: 32
├────────────────────────────────────────┤
│ Map Dimensions (8 bytes)               │ 偏移: 68
├────────────────────────────────────────┤
│ Reserved (116 bytes)                   │ 偏移: 76
├────────────────────────────────────────┤
│ MPC File List (255 × 64 bytes)         │ 偏移: 192
├────────────────────────────────────────┤
│ Tile Data (cols × rows × 10 bytes)     │ 偏移: 16512
└────────────────────────────────────────┘
```

### 文件签名 (0x00 - 0x1F)

| 偏移 | 大小 | 类型 | 说明 |
|------|------|------|------|
| 0x00 | 12 | string | 签名 `"MAP File Ver"` |
| 0x0C | 20 | - | 保留字节 |

### MPC 目录路径 (0x20 - 0x43)

| 偏移 | 大小 | 说明 |
|------|------|------|
| 0x20 | 1 | 跳过首字节 |
| 0x21 | 31 | MPC 文件目录路径（GBK 编码，null 结尾） |

> 若路径为空，默认使用 `mpc/map/{地图文件名}/`

### 地图尺寸 (0x44 - 0x4B)

| 偏移 | 大小 | 类型 | 字段名 | 说明 |
|------|------|------|--------|------|
| 0x44 | 4 | int32 | `mapColumnCounts` | 地图列数 |
| 0x48 | 4 | int32 | `mapRowCounts` | 地图行数 |

**像素尺寸计算**：

```typescript
const mapPixelWidth = (mapColumnCounts - 1) * 64;
const mapPixelHeight = ((mapRowCounts - 3) / 2 + 1) * 32;
```

### MPC 文件列表 (0xC0 - 0x407F)

从偏移 `192 (0xC0)` 开始，共 255 个条目，每条目 64 字节：

| 条目偏移 | 大小 | 说明 |
|----------|------|------|
| +0 | 32 | MPC 文件名（GBK 编码，null 结尾） |
| +32 | 4 | 保留 |
| +36 | 1 | 循环标志（1 = 动画循环） |
| +37 | 27 | 保留 |

**解析示例**：

```typescript
const mpcFileNames: (string | null)[] = [];
const loopingMpcIndices: number[] = [];

for (let k = 0; k < 255; k++) {
  const entryOffset = 192 + k * 64;
  const fileName = readNullTerminatedString(data, entryOffset, 32);

  if (fileName.length === 0) {
    mpcFileNames.push(null);
  } else {
    mpcFileNames.push(fileName);
    // 检查循环标志
    if (data[entryOffset + 36] === 1) {
      loopingMpcIndices.push(k);
    }
  }
}
```

### 瓦片数据 (0x4080 起)

从偏移 `16512 (0x4080)` 开始，共 `mapColumnCounts × mapRowCounts` 个瓦片，每瓦片 10 字节：

| 瓦片偏移 | 大小 | 类型 | 字段名 | 说明 |
|----------|------|------|--------|------|
| +0 | 1 | byte | `layer1.frame` | 图层1 帧索引 |
| +1 | 1 | byte | `layer1.mpcIndex` | 图层1 MPC 索引（1-255，0=无） |
| +2 | 1 | byte | `layer2.frame` | 图层2 帧索引 |
| +3 | 1 | byte | `layer2.mpcIndex` | 图层2 MPC 索引 |
| +4 | 1 | byte | `layer3.frame` | 图层3 帧索引 |
| +5 | 1 | byte | `layer3.mpcIndex` | 图层3 MPC 索引 |
| +6 | 1 | byte | `barrierType` | 障碍类型 |
| +7 | 1 | byte | `trapIndex` | 陷阱脚本索引（0=无陷阱） |
| +8 | 2 | - | - | 保留字节 |

### 障碍类型 (BarrierType)

| 值 | 常量名 | 说明 |
|----|--------|------|
| 0x00 | `None` | 无障碍 |
| 0x20 | `CanOver` | 可跳跃越过 |
| 0x40 | `Trans` | 透明障碍（武功可穿透，人物不可） |
| 0x60 | `CanOverTrans` | 可跳跃 + 透明 |
| 0x80 | `Obstacle` | 完全障碍 |
| 0xA0 | `CanOverObstacle` | 可跳跃障碍 |

**障碍检测逻辑**：

```typescript
// 是否为障碍物（武功视角）
function isObstacle(barrierType: number): boolean {
  return (barrierType & 0x80) !== 0;
}

// 是否为角色障碍物（行走视角）
function isObstacleForCharacter(barrierType: number): boolean {
  return (barrierType & (0x80 | 0x40)) !== 0;
}

// 是否为跳跃障碍
function isObstacleForJump(barrierType: number): boolean {
  if (barrierType === 0x00) return false;
  return (barrierType & 0x20) === 0;
}

// 是否为武功障碍
function isObstacleForMagic(barrierType: number): boolean {
  if (barrierType === 0x00) return false;
  return (barrierType & 0x40) === 0;
}
```

### 坐标系统

地图使用 **菱形等角投影 (Isometric)** 坐标：

```typescript
const TILE_WIDTH = 64;  // 瓦片宽度
const TILE_HEIGHT = 32; // 瓦片高度

// 瓦片坐标 → 像素坐标
function tileToPixel(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_WIDTH / 2,
    y: row * TILE_HEIGHT / 2
  };
}

// 像素坐标 → 瓦片坐标
function pixelToTile(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x / (TILE_WIDTH / 2)),
    row: Math.floor(y / (TILE_HEIGHT / 2))
  };
}
```

### 瓦片渲染位置

```typescript
// 获取瓦片在世界坐标系中的渲染位置
function getTileRenderPosition(
  col: number,
  row: number,
  texture: { width: number; height: number }
): { x: number; y: number } {
  const basePos = tileToPixel(col, row);
  return {
    x: basePos.x - texture.width / 2,
    y: basePos.y - (texture.height - 16)
  };
}
```

---

## 附录：工具命令

### 查看二进制文件头

```bash
# 使用 xxd 查看前 128 字节
xxd -l 128 file.map

# 使用 hexdump 查看
hexdump -C -n 128 file.asf

# 使用 od 命令
od -A x -t x1z -v file.mpc | head -20
```

### 验证文件签名

```bash
# 检查 ASF 签名
head -c 7 file.asf | xxd

# 检查 MPC 签名
head -c 12 file.mpc | xxd

# 检查 MAP 签名
head -c 12 file.map | xxd
```

### 分析文件结构

```bash
# 查看 MAP 文件 MPC 列表区域
xxd -s 192 -l 320 file.map

# 查看 ASF 元数据
xxd -s 16 -l 48 file.asf
```

---

## 数据类型总结

| 类型 | 大小 | 说明 |
|------|------|------|
| int32 | 4 字节 | 有符号 32 位整数，小端序 |
| byte | 1 字节 | 无符号 8 位整数 |
| string | 可变 | GBK 编码，null 结尾 |
| Color | 4 字节 | BGRA 顺序 |

---

## 相关代码文件

| 格式 | TypeScript | C# |
|------|------------|-----|
| ASF | [src/engine/sprite/asf.ts](../src/engine/sprite/asf.ts) | [JxqyHD/Engine/Asf.cs](../JxqyHD/Engine/Asf.cs) |
| MPC | [src/engine/resource/mpc.ts](../src/engine/resource/mpc.ts) | [JxqyHD/Engine/Mpc.cs](../JxqyHD/Engine/Mpc.cs) |
| SHD | - | [JxqyHD/Engine/Shd.cs](../JxqyHD/Engine/Shd.cs) |
| MAP | [src/engine/map/map.ts](../src/engine/map/map.ts) | [JxqyHD/Engine/Map/JxqyMap.cs](../JxqyHD/Engine/Map/JxqyMap.cs) |
| 二进制工具 | [src/engine/core/binaryUtils.ts](../src/engine/core/binaryUtils.ts) | [JxqyHD/Engine/Utils.cs](../JxqyHD/Engine/Utils.cs) |
