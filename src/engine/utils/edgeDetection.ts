/**
 * Edge Detection Utility - based on JxqyHD Engine/TextureGenerator.cs GetOuterEdge
 *
 * C# 实现:
 * 1. 遍历所有像素，找到透明像素旁边有不透明像素的位置
 * 2. 这些位置就是边缘像素
 * 3. 将边缘像素绘制为指定颜色
 */

// 缓存边缘纹理，避免重复计算
const edgeCache = new Map<string, OffscreenCanvas>();

/**
 * 检查颜色是否透明（用于NPC/Obj碰撞）
 * C#: IsColorTransparentForNpcObj - alpha < 200
 */
function isColorTransparent(alpha: number): boolean {
  return alpha < 200;
}

/**
 * 解析颜色字符串为RGBA值
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  // Handle rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }
  // Default yellow
  return { r: 255, g: 255, b: 0, a: 0.6 };
}

/**
 * 生成边缘纹理
 * C#: TextureGenerator.GetOuterEdge
 *
 * 算法：
 * 1. 遍历每个透明像素
 * 2. 检查其8个邻居是否有不透明像素
 * 3. 如果有，则该透明像素是边缘的一部分
 * 4. 同时检查图像边界上的不透明像素
 *
 * @param sourceCanvas 源图像
 * @param color 边缘颜色（RGBA字符串）
 * @returns 只有边缘像素的新 Canvas
 */
export function getOuterEdge(
  sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
  color: string
): OffscreenCanvas {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // 生成缓存键
  const cacheKey = `${(sourceCanvas as any)._cacheId || Math.random()}_${color}`;

  // 检查缓存
  const cached = edgeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 获取源图像数据
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!sourceCtx) {
    // 返回空画布
    const emptyCanvas = new OffscreenCanvas(width, height);
    return emptyCanvas;
  }

  const imageData = sourceCtx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;

  // 存储边缘像素索引
  const edgePixels: number[] = [];

  // 邻居偏移量（8方向）
  const neighborOffsets = [
    -width,     // 上
    -width + 1, // 右上
    1,          // 右
    width + 1,  // 右下
    width,      // 下
    width - 1,  // 左下
    -1,         // 左
    -width - 1, // 左上
  ];

  // 遍历所有像素，找透明像素旁边有不透明像素的位置
  for (let i = 0; i < total; i++) {
    const alpha = data[i * 4 + 3];

    // 只检查透明像素
    if (!isColorTransparent(alpha)) continue;

    // 获取当前像素的行列
    const x = i % width;
    const y = Math.floor(i / width);

    // 检查8个邻居
    for (const offset of neighborOffsets) {
      const neighbor = i + offset;

      // 边界检查
      if (neighbor < 0 || neighbor >= total) continue;

      // 检查是否跨行（左右邻居需要特殊处理）
      const nx = neighbor % width;
      const dx = Math.abs(nx - x);
      if (dx > 1) continue; // 跨行了

      // 检查邻居是否不透明
      const neighborAlpha = data[neighbor * 4 + 3];
      if (!isColorTransparent(neighborAlpha)) {
        edgePixels.push(i);
        break; // 找到一个就够了
      }
    }
  }

  // 检查图像边界上的不透明像素
  // 顶边和底边
  const beginBottom = (height - 1) * width;
  for (let w = 0; w < width; w++) {
    // 顶边
    const topAlpha = data[w * 4 + 3];
    if (!isColorTransparent(topAlpha)) {
      edgePixels.push(w);
    }
    // 底边
    const bottomAlpha = data[(beginBottom + w) * 4 + 3];
    if (!isColorTransparent(bottomAlpha)) {
      edgePixels.push(beginBottom + w);
    }
  }

  // 左边和右边
  for (let h = 0; h < height; h++) {
    const leftIdx = h * width;
    const rightIdx = h * width + width - 1;
    // 左边
    const leftAlpha = data[leftIdx * 4 + 3];
    if (!isColorTransparent(leftAlpha)) {
      edgePixels.push(leftIdx);
    }
    // 右边
    const rightAlpha = data[rightIdx * 4 + 3];
    if (!isColorTransparent(rightAlpha)) {
      edgePixels.push(rightIdx);
    }
  }

  // 创建新的画布绘制边缘
  const edgeCanvas = new OffscreenCanvas(width, height);
  const edgeCtx = edgeCanvas.getContext("2d", { willReadFrequently: true });
  if (!edgeCtx) {
    return edgeCanvas;
  }

  // 解析颜色
  const { r, g, b, a } = parseColor(color);

  // 创建边缘图像数据
  const edgeImageData = edgeCtx.createImageData(width, height);
  const edgeData = edgeImageData.data;

  // 去重并填充边缘像素
  const uniqueEdges = new Set(edgePixels);
  for (const pixelIdx of uniqueEdges) {
    const idx = pixelIdx * 4;
    edgeData[idx] = r;
    edgeData[idx + 1] = g;
    edgeData[idx + 2] = b;
    edgeData[idx + 3] = Math.round(a * 255);
  }

  edgeCtx.putImageData(edgeImageData, 0, 0);

  // 缓存结果（限制缓存大小）
  if (edgeCache.size > 500) {
    // 清除一半的缓存
    const keys = Array.from(edgeCache.keys());
    for (let i = 0; i < keys.length / 2; i++) {
      edgeCache.delete(keys[i]);
    }
  }
  edgeCache.set(cacheKey, edgeCanvas);

  return edgeCanvas;
}

/**
 * 清除边缘缓存
 */
export function clearEdgeCache(): void {
  edgeCache.clear();
}
