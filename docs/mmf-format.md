# MMF (Miu Map Format) — 二进制格式规范

MMF 是 Miu2D Engine 设计的地图格式，替代旧的 `.map` (MAP File Ver) 格式。

> **设计目标**：紧凑、UTF-8、可扩展、与 MSF v2 配套、Web 原生

---

## 目录

1. [与旧 MAP 格式对比](#与旧-map-格式对比)
2. [文件结构总览](#文件结构总览)
3. [字段详解](#字段详解)
4. [解码伪代码](#解码伪代码)
5. [陷阱系统详解](#陷阱系统详解)
6. [Tile 扩展策略](#tile-扩展策略)
7. [MAP → MMF 转换](#map--mmf-转换)
8. [引擎解析输出类型](#引擎解析输出类型)
9. [实现参考](#实现参考)

---

## 与旧 MAP 格式对比

| 特性 | MAP (旧) | MMF (新) |
|------|----------|----------|
| 文件头 | `"MAP File Ver"` 12 字节 | `"MMF1"` 4 字节 |
| 文本编码 | **GBK** | **UTF-8** |
| 贴图引用 | MPC 文件名 (GBK, 32 字节固定) | MSF 文件名 (UTF-8, 变长) |
| MPC 目录路径 | 固定 32 字节 (GBK) | 去掉，由引擎根据地图名推导 |
| 最大 MSF 数 | 255 (16KB 固定区域，大量浪费) | 可变 (只存实际使用的) |
| 每 tile 存储 | 10 字节 (含 2 字节废数据¹) | **5 字节** (紧凑无浪费) |
| 层数据 | 交错存 3 层+属性 | **分层存储** + zstd 压缩 |
| 陷阱 | 仅 trapIndex，脚本在外部 INI | MMF 自包含 trap 表² |
| 压缩 | 无 | **zstd** |
| 可扩展 | 否 | **Chunk-based 扩展** |

> ¹ 旧 MAP 每 tile 10 字节中有 2 字节废数据（恒为 `0x00 0x1F`），C# 原版 `offset += 2` 直接跳过，所有地图文件中该值完全一致，属地图编辑器遗留的无意义字段。
>
> ² 旧格式陷阱脚本存储在外部 `traps.ini` 文件中，按地图名分 `[section]`。MMF 将**当前地图的初始陷阱映射**内嵌到 Trap Table 中，但 tile 中的 `trapIndex` 不强制要求 Trap Table 有对应条目——没有映射的编号在运行时可通过 `SetMapTrap` 脚本命令动态激活。详见 [陷阱系统详解](#陷阱系统详解)。

### 大小对比估算

以 `map_012_惠安镇.map`（最大地图, 304 KB）为例：

| 格式 | 大小 | 说明 |
|------|------|------|
| 旧 MAP | 304 KB | 未压缩，大量浪费空间 |
| MMF (未压缩) | ~160 KB | 去掉 padding + 变长 MSF 表 |
| MMF (zstd) | **~30-50 KB** | tile 数据高度可压缩 |

---

## 文件结构总览

```
┌──────────────────────────────────────────────────────┐
│ Preamble (8 bytes)                                   │
│   Magic "MMF1" (4) + Version u16 + Flags u16         │
├──────────────────────────────────────────────────────┤
│ Map Header (12 bytes)                                │
│   columns u16, rows u16, msfCount u16,               │
│   trapCount u16, reserved u32                        │
├──────────────────────────────────────────────────────┤
│ MSF Table (msfCount × entry)                         │
│   Per entry: nameLen u8 + name UTF-8 + flags u8      │
├──────────────────────────────────────────────────────┤
│ Trap Table (trapCount × entry)                       │
│   Per entry: trapIndex u8 + pathLen u16              │
│              + scriptPath UTF-8                      │
├──────────────────────────────────────────────────────┤
│ Extension Chunks (variable)                          │
│   [ChunkID(4) + Length(4) + Data(Length)] ...         │
├──────────────────────────────────────────────────────┤
│ End Sentinel (8 bytes)                               │
│   "END\0" (4) + 0u32 (4)                            │
├──────────────────────────────────────────────────────┤
│ Tile Data Blob (zstd-compressed)                     │
│   Layer1 + Layer2 + Layer3 + TileInfos               │
└──────────────────────────────────────────────────────┘
```

---

## 字段详解

### Preamble (偏移 0x00, 8 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x00 | 4 | char[4] | `magic` | 固定 `"MMF1"` (0x4D 0x4D 0x46 0x31) |
| 0x04 | 2 | u16 | `version` | 格式版本 = `1` |
| 0x06 | 2 | u16 | `flags` | 位标志 (见下表) |

**Flags 位定义**:

| Bit | 名称 | 说明 |
|-----|------|------|
| 0 | `ZSTD` | Tile Data Blob 使用 zstd 压缩 (v1 始终为 1) |
| 1 | `HAS_TRAPS` | 包含 Trap Table |
| 2-15 | reserved | 保留，填 0 |

### Map Header (偏移 0x08, 12 字节)

| 偏移 | 大小 | 类型 | 字段 | 说明 |
|------|------|------|------|------|
| 0x08 | 2 | u16 | `columns` | 地图列数 (tile) |
| 0x0A | 2 | u16 | `rows` | 地图行数 (tile) |
| 0x0C | 2 | u16 | `msfCount` | MSF 文件数量 (实际使用的) |
| 0x0E | 2 | u16 | `trapCount` | 陷阱条目数 |
| 0x10 | 4 | u32 | `reserved` | 保留，填 0 |

**像素尺寸由引擎计算**（与旧格式相同）：
```typescript
const pixelWidth = (columns - 1) * 64;
const pixelHeight = (Math.floor((rows - 3) / 2) + 1) * 32;
```

### MSF Table (偏移 0x14, 变长)

`msfCount` 条目，每条目变长：

| 字段 | 大小 | 类型 | 说明 |
|------|------|------|------|
| `nameLen` | 1 | u8 | MSF 文件名长度 (UTF-8 字节数) |
| `name` | nameLen | UTF-8 | MSF 文件名 (不含目录前缀，如 `"map003-1-1.msf"`) |
| `flags` | 1 | u8 | bit 0: looping (动画循环) |

**设计说明**：
- 旧格式固定 255 个 slot，每个 64 字节 = 16 KB。实际地图平均只用 ~20 个 MPC。
- MMF 只存实际使用的 MSF 文件，变长名+1字节flag，~20 个文件约 400 字节。
- **MSF 索引**：tile 中的 `msfIndex` 值 1~N 对应 MSF Table 中的条目 0~N-1（与旧格式一致，0=空）。
- **目录路径**已去掉——引擎按约定推导：`msf/map/{mapNameWithoutExt}/`

### Trap Table (偏移动态, 变长)

当 `flags & HAS_TRAPS` 时存在，`trapCount` 条目：

| 字段 | 大小 | 类型 | 说明 |
|------|------|------|------|
| `trapIndex` | 1 | u8 | 陷阱索引 (tile 中用此值引用) |
| `pathLen` | 2 | u16 | 脚本路径长度 (UTF-8 字节数) |
| `scriptPath` | pathLen | UTF-8 | 脚本路径 (如 `"script/map/map003/trap1.txt"`) |

**设计说明**：
- 旧格式的 trap 路径存在**外部 INI 配置文件** (`traps.ini`) 中，按地图名分 section，管理复杂。
- MMF 将 trap 定义**内嵌到地图文件**中，自包含。
- 运行时：遇到 `trapIndex != 0` 时，直接查 Trap Table 得到脚本路径。

> 详细陷阱系统说明见下文 [陷阱系统详解](#陷阱系统详解)。

### Extension Chunks (变长)

与 MSF v2 相同的扩展机制，预留未来使用：

```
[ChunkID: char[4]] [Length: u32] [Data: Length bytes]
```

潜在扩展：

| ChunkID | 说明 |
|---------|------|
| `"LGHT"` | 光照/昼夜数据 |
| `"WEAT"` | 天气配置 |
| `"AMBR"` | 环境音效路径 |
| `"META"` | 地图元数据 (显示名称、描述) |

序列以 **End Sentinel** 结束：`"END\0"` (4 bytes) + `0u32` (4 bytes)。

### Tile Data Blob (zstd 压缩)

**未压缩结构**：分层连续存储，总大小 = `totalTiles × 5` 字节

```
┌─────────────────────────────────────────┐
│ Layer 1 (totalTiles × 2 bytes)          │  地面层
│   [msfIndex u8, frame u8] × totalTiles  │
├─────────────────────────────────────────┤
│ Layer 2 (totalTiles × 2 bytes)          │  装饰层 (与角色交错渲染)
│   [msfIndex u8, frame u8] × totalTiles  │
├─────────────────────────────────────────┤
│ Layer 3 (totalTiles × 2 bytes)          │  顶层 (遮挡层)
│   [msfIndex u8, frame u8] × totalTiles  │
├─────────────────────────────────────────┤
│ Barrier (totalTiles × 1 byte)           │  障碍类型
│   [barrierType u8] × totalTiles         │
├─────────────────────────────────────────┤
│ Traps (totalTiles × 1 byte)             │  陷阱索引
│   [trapIndex u8] × totalTiles           │
└─────────────────────────────────────────┘
```

**为什么分层而非交错？**
- **更好的压缩比**：同层相邻 tile 数据相似度极高（地面大量相同材质），分层后 zstd 可以高效利用 LZ77 匹配
- **旧格式交错**：`[L1 L2 L3 info pad] × tiles` = 每 tile 10 字节，数据跳跃，压缩效率差
- **按层**：barrier 层大部分是 `0x00`，trap 层更是几乎全 `0x00`，压缩后几乎不占空间

**Tile 字节顺序**：`msfIndex` 在前、`frame` 在后（与渲染查找顺序一致：先定位 MSF，再取帧）。`msfIndex = 0` 表示空 tile。

### Barrier Type 值 (与旧格式完全兼容)

| 值 | 常量名 | 说明 |
|----|--------|------|
| `0x00` | `None` | 无障碍 |
| `0x20` | `CanOver` | 可跳跃越过 |
| `0x40` | `Trans` | 透明障碍 (武功穿透) |
| `0x60` | `CanOverTrans` | 可跳跃 + 透明 |
| `0x80` | `Obstacle` | 完全障碍 |
| `0xA0` | `CanOverObstacle` | 可跳跃障碍 |

---

## 解码伪代码

```typescript
function parseMMF(buffer: ArrayBuffer): MiuMapData {
  const view = new DataView(buffer);
  const data = new Uint8Array(buffer);
  let offset = 0;

  // 1. Preamble
  const magic = String.fromCharCode(...data.slice(0, 4)); // "MMF1"
  const version = view.getUint16(4, true);
  const flags = view.getUint16(6, true);
  offset = 8;

  // 2. Header
  const columns = view.getUint16(offset, true); offset += 2;
  const rows = view.getUint16(offset, true); offset += 2;
  const msfCount = view.getUint16(offset, true); offset += 2;
  const trapCount = view.getUint16(offset, true); offset += 2;
  offset += 4; // reserved

  // 3. MSF Table
  const decoder = new TextDecoder("utf-8");
  const msfEntries: MsfEntry[] = [];
  for (let i = 0; i < msfCount; i++) {
    const nameLen = data[offset++];
    const name = decoder.decode(data.slice(offset, offset + nameLen));
    offset += nameLen;
    const entryFlags = data[offset++];
    msfEntries.push({ name, looping: (entryFlags & 1) !== 0 });
  }

  // 4. Trap Table
  const trapTable: TrapEntry[] = [];
  if (flags & 0x02) {
    for (let i = 0; i < trapCount; i++) {
      const trapIndex = data[offset++];
      const pathLen = view.getUint16(offset, true); offset += 2;
      const scriptPath = decoder.decode(data.slice(offset, offset + pathLen));
      offset += pathLen;
      trapTable.push({ trapIndex, scriptPath });
    }
  }

  // 5. Skip extension chunks until END sentinel
  while (offset + 8 <= data.length) {
    const chunkId = String.fromCharCode(...data.slice(offset, offset + 4));
    const chunkLen = view.getUint32(offset + 4, true);
    offset += 8;
    if (chunkId === "END\0") break;
    offset += chunkLen; // skip unknown chunks
  }

  // 6. Decompress tile blob
  const compressed = data.slice(offset);
  const blob = (flags & 1) ? zstdDecompress(compressed) : compressed;

  // 7. Parse layers (分层连续存储)
  const totalTiles = columns * rows;
  let blobOffset = 0;
  const layer1 = parseTileLayer(blob, blobOffset, totalTiles); blobOffset += totalTiles * 2;
  const layer2 = parseTileLayer(blob, blobOffset, totalTiles); blobOffset += totalTiles * 2;
  const layer3 = parseTileLayer(blob, blobOffset, totalTiles); blobOffset += totalTiles * 2;
  const barriers = blob.slice(blobOffset, blobOffset + totalTiles); blobOffset += totalTiles;
  const traps = blob.slice(blobOffset, blobOffset + totalTiles);

  return { columns, rows, msfEntries, trapTable, layer1, layer2, layer3, barriers, traps };
}
```

---

## 偏移量计算速查

```
preambleEnd      = 8
headerEnd        = 20 (0x14)
msfTableEnd      = 20 + Σ(2 + nameLen_i)  for i in 0..msfCount
trapTableEnd     = msfTableEnd + Σ(3 + pathLen_i)  for i in 0..trapCount
extensionsEnd    = trapTableEnd + extensions_size + 8 (END sentinel)
blobStart        = extensionsEnd
blobSize(raw)    = totalTiles × 8   (3 layers × 2 + barrier 1 + trap 1)
```

---

## MAP → MMF 转换

### 转换流程

```
1. 读取旧 .map 文件 (二进制)
2. GBK → UTF-8 转换所有字符串
3. .mpc → .msf 文件名替换
4. 去掉 mpcDirPath (由引擎推导)
5. 只保留实际使用的 MSF 条目 (msfIndex != 0 的)
6. 重新映射 tile 中的 msfIndex (旧索引 → 新紧凑索引)
7. 从外部 trap INI 文件读取 trap 配置，内嵌到 MMF
8. 分层排列 tile 数据
9. zstd 压缩 tile blob
10. 写入 MMF 文件
```

### 索引重映射

旧格式 255 个 slot 大部分为空，需要紧凑化：

```typescript
// 旧: mpcFileNames[0] = "a.mpc", [1] = null, [2] = "b.mpc", ...
// 新: msfEntries[0] = "a.msf", msfEntries[1] = "b.msf"
// 映射: oldIndex 0 → newIndex 1, oldIndex 2 → newIndex 2
//       (newIndex 0 保留为空 tile)

const oldToNew = new Map<number, number>();
let newIdx = 1; // 0 = empty
for (let old = 0; old < 255; old++) {
  if (mpcFileNames[old] != null) {
    oldToNew.set(old, newIdx++);
  }
}

// 重映射 tile 数据
for (const tile of allTiles) {
  tile.msfIndex = tile.mpcIndex === 0 ? 0 : oldToNew.get(tile.mpcIndex - 1)!;
}
```

---

## 引擎解析输出类型

```typescript
interface MiuMapData {
  columns: number;
  rows: number;
  pixelWidth: number;          // 引擎计算: (columns - 1) * 64
  pixelHeight: number;         // 引擎计算: ((rows - 3) / 2 + 1) * 32
  msfEntries: MsfEntry[];      // MSF 文件列表 (紧凑, 0-based)
  trapTable: TrapEntry[];      // 陷阱定义表
  layer1: Uint8Array;          // totalTiles × 2 bytes [msfIndex, frame]
  layer2: Uint8Array;
  layer3: Uint8Array;
  barriers: Uint8Array;        // totalTiles × 1 byte
  traps: Uint8Array;           // totalTiles × 1 byte
}

interface MsfEntry {
  name: string;     // MSF 文件名 (UTF-8)
  looping: boolean; // 是否动画循环
}

interface TrapEntry {
  trapIndex: number;    // 1-255
  scriptPath: string;   // 脚本路径 (UTF-8)
}
```

**与旧 `JxqyMapData` 的区别**：
- `mpcDirPath` → 去掉，引擎推导
- `mpcFileNames: (string|null)[]` → `msfEntries: MsfEntry[]`（紧凑，无 null）
- `loopingMpcIndices: number[]` → 内嵌在 `MsfEntry.looping`
- `layer1/2/3: MapMpcIndex[]` → `Uint8Array`（零拷贝，直接从 blob 切片）
- `tileInfos: MapTileInfo[]` → 拆成 `barriers` + `traps` 两个 `Uint8Array`

**Tile 访问方式**：
```typescript
// 旧格式（对象数组，内存占用大）
const tile = mapData.layer1[col + row * columns];
const mpcIdx = tile.mpcIndex;
const frame = tile.frame;

// MMF 新格式（TypedArray，零拷贝）
const offset = (col + row * columns) * 2;
const msfIdx = mapData.layer1[offset];      // 直接字节访问
const frame = mapData.layer1[offset + 1];
```

---

## 陷阱系统详解

### 三层结构

陷阱系统由三层协作完成：

```
                  ┌─────────────────────┐
       第 1 层    │   Tile 数据          │  地图文件里每个格子的 trapIndex (0~255)
       (静态)     │   trapIndex = 3      │  ← 只是一个编号，本身不含任何脚本信息
                  └──────────┬──────────┘
                             │ 查表
                  ┌──────────▼──────────┐
       第 2 层    │   陷阱映射表          │  trapIndex → 脚本路径
       (可变)     │   3 = "Trap03.txt"   │  ← 初始来自 Trap Table，运行时可动态修改
                  └──────────┬──────────┘
                             │ 检查
                  ┌──────────▼──────────┐
       第 3 层    │   忽略列表            │  已触发过的 trapIndex 集合
       (运行时)   │   {1, 3, 5}          │  ← 防止重复触发，存档时保存
                  └─────────────────────┘
```

- **第 1 层 (Tile Data)**：每个 tile 的 `trapIndex` 写死在地图文件中，`0` 表示无陷阱。地图编辑器在制作地图时预先标记哪些格子是陷阱点。
- **第 2 层 (映射表)**：`trapIndex` → 脚本路径的映射表。MMF 中的 Trap Table 提供**初始静态映射**；运行时可通过 `SetMapTrap` 脚本命令动态增删改。
- **第 3 层 (忽略列表)**：运行时维护的 `Set<number>`，记录已触发过的 trapIndex，防止玩家重复踩到同一个陷阱反复触发。存档时保存，读档时恢复。

### 触发流程

```
玩家走到 tile (10, 20)
  → 读 trapIndex = 3                    // 从地图 tile 数据 (第 1 层)
  → trapIndex == 0? 否, 继续
  → 3 在忽略列表里吗? 否, 继续           // 第 3 层检查
  → 查映射表: 3 → "Trap03.txt"           // 第 2 层查表
  → 找到脚本? 是, 继续
  → 玩家立刻站住 (StandingImmediately)
  → 将 3 加入忽略列表                     // 防止反复触发
  → 执行 script/map/map_003/Trap03.txt
```

### 三种使用场景

| 场景 | tile.trapIndex | Trap Table | 运行时操作 | 效果 |
|------|---------------|------------|-----------|------|
| **静态陷阱** | `3` | 有 `3=Trap03.txt` | 无 | 玩家踩到立即触发 |
| **预留编号** | `7` | **无** 7 的条目 | 脚本调用 `SetMapTrap(7, "boss.txt")` | 设置前踩到不触发，设置后才激活 |
| **动态清除** | `5` | 有 `5=Trap05.txt` | 脚本调用 `SetMapTrap(5, "")` | 清除后不再触发 |

**关键设计**：tile 中的 `trapIndex` 只是一个编号标记，**不要求** Trap Table 中必须有对应条目。Trap Table 是可选的"初始值"，查不到就是"未激活的陷阱"，等游戏脚本在运行时通过 `SetMapTrap` 动态设置即可。

### 旧格式对比

```ini
;; 旧格式: 外部 traps.ini 文件，按地图名分 section
[map_003_武当山下]
1=Trap01.txt
2=Trap02.txt
3=Trap03.txt
7=支线1.txt

[map_008_野树林]
1=Trap01.txt
2=Trap02.txt
```

```
;; MMF: Trap Table 内嵌在地图文件中（只含当前地图的映射）
Trap Table (4 entries):
  trapIndex=1  scriptPath="Trap01.txt"
  trapIndex=2  scriptPath="Trap02.txt"
  trapIndex=3  scriptPath="Trap03.txt"
  trapIndex=7  scriptPath="支线1.txt"
```

好处：
- 不需要额外加载和解析 INI 文件
- 地图文件自包含，便于独立分发
- 旧的全局 `traps.ini` 在转换时按 section 拆分到各自的 MMF 中

### 存档兼容

运行时动态修改的陷阱映射和忽略列表仍然保存在**存档 JSON** 中，与地图文件分离：

```json
{
  "traps": {
    "map_003_武当山下": { "1": "Trap01.txt", "2": "Trap02.txt" },
    "map_008_野树林": { "1": "Trap01.txt", "7": "newTrap.txt" }
  },
  "trapIgnoreList": [1, 3, 5]
}
```

读档时，存档中的映射表**覆盖** MMF 中的 Trap Table（因为运行时可能已经修改过）。

---

## Tile 扩展策略

### 问题

当前每 tile 只有 5 字节数据（3 层 × 2B + barrier 1B + trap 1B）。未来可能需要扩展 tile 属性，例如：

- 地面高度 (height)
- 光照区域 (lighting zone)
- 音效区域 (ambient zone)
- 自定义标记 (custom flags)

### 方案：Extension Chunk 扩展 tile 属性（推荐）

新增的 tile 属性放在 Extension Chunk 中，**不修改主 Tile Data Blob 结构**：

```
Extension Chunk "HGHT":     地面高度
  totalTiles × 1 byte       每 tile 1 字节，高度 0~255

Extension Chunk "ZONE":     区域编号
  totalTiles × 1 byte       每 tile 1 字节，区域 0~255

Extension Chunk "FLAG":     自定义标记位
  totalTiles × 1 byte       每 tile 1 字节，8 个 flag bit
```

**优点**：
- **完全向后兼容**：旧版解析器遇到不认识的 ChunkID 直接跳过（`offset += chunkLen`）
- **按需加载**：不需要高度数据的地图不占任何空间
- **独立压缩**：每个 Chunk 可以选择是否单独压缩，或直接存原始数据（因为 Extension Chunk 在 zstd blob 之前）

**访问方式**：

```typescript
// 解析时把 Extension Chunk 存入 Map
const extensions = new Map<string, Uint8Array>();

// 读取高度（如果存在）
const heights = extensions.get("HGHT");
if (heights) {
  const h = heights[col + row * columns];  // 该 tile 的高度
}
```

### 为什么不直接改 Tile Data Blob？

在 blob 中增加字段（比如每 tile 从 5 字节变 6 字节）会：
1. **破坏向后兼容** — 旧解析器无法正确切分层数据
2. **膨胀所有地图** — 即使某些地图不需要高度数据
3. **需要版本升级** — 每次加字段都要改 version

Extension Chunk 方案避免了这些问题，与 MSF v2 的扩展理念一致。

---

## 实现参考

| 模块 | 文件 | 说明 |
|------|------|------|
| 格式规范 | `docs/mmf-format.md` | 本文档 |
| TS 解析器 | `packages/engine/src/resource/mmf.ts` | MMF 解析 + 加载 |
| Rust 转换器 | `packages/converter/src/bin/map2mmf.rs` | MAP → MMF 批量转换 |
| 旧格式解析 | `packages/engine/src/resource/map.ts` | 旧 MAP 解析（保留兼容） |
