/**
 * WebGL SpriteBatcher - 精灵批量渲染器
 *
 * 核心性能优化组件：将成百上千次 drawImage 调用合并为少量 WebGL draw call。
 *
 * 原理：
 * 1. 每个精灵 = 1 个四边形 = 2 个三角形 = 6 个顶点
 * 2. 将所有精灵的顶点数据写入同一个 VBO
 * 3. 同一纹理的精灵打包在一个批次中
 * 4. 纹理切换时 flush 当前批次
 *
 * 顶点格式 (每顶点 6 个 float):
 * [posX, posY, texU, texV, alpha, filterType]
 *
 * 批量大小：最多 MAX_SPRITES_PER_BATCH 个精灵可以在一次 draw call 中绘制
 */

import { logger } from "../core/logger";
import type { ColorFilter, TextureId } from "./types";
import type { SpriteProgram } from "./shaders";

/** 每个精灵的顶点数（2 个三角形 = 6 个顶点） */
const VERTICES_PER_SPRITE = 6;

/** 每个顶点的 float 数量 [x, y, u, v, alpha, filterType] */
const FLOATS_PER_VERTEX = 6;

/** 每个精灵的 float 数量 */
const FLOATS_PER_SPRITE = VERTICES_PER_SPRITE * FLOATS_PER_VERTEX;

/** 单批次最大精灵数（8192 = 约 1.2MB buffer，覆盖绝大多数场景） */
const MAX_SPRITES_PER_BATCH = 8192;

/** ColorFilter → float ID 映射（传入 shader 的 a_filterType） */
const FILTER_TYPE_MAP: Record<ColorFilter, number> = {
  none: 0,
  grayscale: 1,
  frozen: 2,
  poison: 3,
};

export class SpriteBatcher {
  private gl: WebGLRenderingContext;
  private program: SpriteProgram;

  // GPU buffers
  private vbo: WebGLBuffer;
  private vao: WebGLVertexArrayObject | null = null;
  private vertexData: Float32Array;

  // 批次状态
  private spriteCount = 0;
  private currentTextureId: TextureId = -1;
  private currentGlTexture: WebGLTexture | null = null;

  // 统计
  private _drawCalls = 0;
  private _spriteCount = 0;
  private _textureSwaps = 0;

  constructor(gl: WebGLRenderingContext, program: SpriteProgram) {
    this.gl = gl;
    this.program = program;

    // 创建顶点缓冲区
    this.vbo = gl.createBuffer()!;
    this.vertexData = new Float32Array(MAX_SPRITES_PER_BATCH * FLOATS_PER_SPRITE);

    // 设置缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);

    // 创建 VAO（WebGL2 原生支持），将顶点属性指针绑定到 VAO 避免每次 flush 重复设置
    const gl2 = gl as WebGL2RenderingContext;
    this.vao = gl2.createVertexArray();
    if (this.vao) {
      gl2.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

      const stride = FLOATS_PER_VERTEX * 4;
      gl.enableVertexAttribArray(program.a_position);
      gl.vertexAttribPointer(program.a_position, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(program.a_texcoord);
      gl.vertexAttribPointer(program.a_texcoord, 2, gl.FLOAT, false, stride, 8);
      gl.enableVertexAttribArray(program.a_alpha);
      gl.vertexAttribPointer(program.a_alpha, 1, gl.FLOAT, false, stride, 16);
      gl.enableVertexAttribArray(program.a_filterType);
      gl.vertexAttribPointer(program.a_filterType, 1, gl.FLOAT, false, stride, 20);

      gl2.bindVertexArray(null);
    }

    logger.info(
      `[SpriteBatcher] Initialized: maxSprites=${MAX_SPRITES_PER_BATCH}, ` +
        `bufferSize=${(this.vertexData.byteLength / 1024).toFixed(1)}KB`
    );
  }

  /** 重置每帧统计 */
  resetStats(): void {
    this._drawCalls = 0;
    this._spriteCount = 0;
    this._textureSwaps = 0;
  }

  get drawCalls(): number {
    return this._drawCalls;
  }

  get totalSprites(): number {
    return this._spriteCount;
  }

  get textureSwaps(): number {
    return this._textureSwaps;
  }

  /**
   * 提交一个精灵到批次
   *
   * @param glTexture WebGL 纹理对象
   * @param textureId 纹理唯一 ID（用于判断是否需要切换纹理）
   * @param dx 目标 X
   * @param dy 目标 Y
   * @param dw 目标宽度
   * @param dh 目标高度
   * @param sx 源 U 起点（0-1 归一化）
   * @param sy 源 V 起点（0-1 归一化）
   * @param sw 源 U 范围（0-1）
   * @param sh 源 V 范围（0-1）
   * @param alpha 透明度
   * @param filter 颜色滤镜
   */
  draw(
    glTexture: WebGLTexture,
    textureId: TextureId,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    alpha: number,
    filter: ColorFilter
  ): void {
    // 纹理切换 → flush 当前批次
    if (textureId !== this.currentTextureId) {
      if (this.spriteCount > 0) {
        this.flush();
      }
      this.currentTextureId = textureId;
      this.currentGlTexture = glTexture;
      this._textureSwaps++;
    }

    // 批次满 → flush
    if (this.spriteCount >= MAX_SPRITES_PER_BATCH) {
      this.flush();
    }

    // 写入顶点数据（2 个三角形 = 6 个顶点）
    const offset = this.spriteCount * FLOATS_PER_SPRITE;
    const data = this.vertexData;
    const a = alpha;
    const ft = FILTER_TYPE_MAP[filter];

    // 四个角的坐标
    const x0 = dx;
    const y0 = dy;
    const x1 = dx + dw;
    const y1 = dy + dh;
    const u0 = sx;
    const v0 = sy;
    const u1 = sx + sw;
    const v1 = sy + sh;

    // 三角形 1: 左上 → 右上 → 左下
    // 左上
    data[offset] = x0;
    data[offset + 1] = y0;
    data[offset + 2] = u0;
    data[offset + 3] = v0;
    data[offset + 4] = a;
    data[offset + 5] = ft;
    // 右上
    data[offset + 6] = x1;
    data[offset + 7] = y0;
    data[offset + 8] = u1;
    data[offset + 9] = v0;
    data[offset + 10] = a;
    data[offset + 11] = ft;
    // 左下
    data[offset + 12] = x0;
    data[offset + 13] = y1;
    data[offset + 14] = u0;
    data[offset + 15] = v1;
    data[offset + 16] = a;
    data[offset + 17] = ft;

    // 三角形 2: 右上 → 右下 → 左下
    // 右上
    data[offset + 18] = x1;
    data[offset + 19] = y0;
    data[offset + 20] = u1;
    data[offset + 21] = v0;
    data[offset + 22] = a;
    data[offset + 23] = ft;
    // 右下
    data[offset + 24] = x1;
    data[offset + 25] = y1;
    data[offset + 26] = u1;
    data[offset + 27] = v1;
    data[offset + 28] = a;
    data[offset + 29] = ft;
    // 左下
    data[offset + 30] = x0;
    data[offset + 31] = y1;
    data[offset + 32] = u0;
    data[offset + 33] = v1;
    data[offset + 34] = a;
    data[offset + 35] = ft;

    this.spriteCount++;
    this._spriteCount++;
  }

  /**
   * 刷新当前批次 → 提交到 GPU 绘制
   */
  flush(): void {
    if (this.spriteCount === 0) return;

    const gl = this.gl;
    const prog = this.program;

    // 使用精灵着色器
    gl.useProgram(prog.program);

    // 绑定纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentGlTexture);
    gl.uniform1i(prog.u_texture, 0);

    // 上传顶点数据（只上传实际使用的部分）
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData.subarray(0, this.spriteCount * FLOATS_PER_SPRITE));

    // 绑定 VAO（已预设顶点属性指针）
    const gl2 = gl as WebGL2RenderingContext;
    if (this.vao) {
      gl2.bindVertexArray(this.vao);
    }

    // 绘制
    gl.drawArrays(gl.TRIANGLES, 0, this.spriteCount * VERTICES_PER_SPRITE);

    if (this.vao) {
      gl2.bindVertexArray(null);
    }

    this._drawCalls++;
    this.spriteCount = 0;
  }

  /**
   * 释放 GPU 资源
   */
  dispose(): void {
    const gl2 = this.gl as WebGL2RenderingContext;
    if (this.vao) {
      gl2.deleteVertexArray(this.vao);
      this.vao = null;
    }
    this.gl.deleteBuffer(this.vbo);
  }
}
