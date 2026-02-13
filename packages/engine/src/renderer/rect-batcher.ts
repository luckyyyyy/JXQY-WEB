/**
 * RectBatcher - 矩形批量渲染器（per-vertex color 优化版）
 *
 * 将大量 fillRect 调用合并为极少量 draw call。
 * 颜色作为 per-vertex attribute 存储，不同颜色的矩形可在同一批次中，
 * 不再因颜色切换而 flush — 天气粒子等场景 draw call 从 50+ 降到 1-2。
 *
 * 顶点格式：每顶点 6 个 float [x, y, r, g, b, a]
 * 每矩形 = 2 三角形 = 6 顶点 = 36 floats
 */

import type { RectProgram } from "./shaders";
import type { RGBAColor } from "./color-utils";

/** 每矩形顶点数 */
const VERTICES_PER_RECT = 6;
/** 每顶点 float 数 [x, y, r, g, b, a] */
const FLOATS_PER_VERTEX = 6;
/** 每矩形 float 数 */
const FLOATS_PER_RECT = VERTICES_PER_RECT * FLOATS_PER_VERTEX;
/** 单批次最大矩形数 */
const MAX_RECTS_PER_BATCH = 4096;

export class RectBatcher {
  private gl: WebGLRenderingContext;
  private program: RectProgram;

  // GPU buffers（预分配）
  private vbo: WebGLBuffer;
  private vao: WebGLVertexArrayObject | null = null;
  private vertexData: Float32Array;

  // 批次状态
  private rectCount = 0;

  // 统计
  private _drawCalls = 0;
  private _rectCount = 0;

  constructor(gl: WebGLRenderingContext, program: RectProgram) {
    this.gl = gl;
    this.program = program;

    this.vbo = gl.createBuffer()!;
    this.vertexData = new Float32Array(MAX_RECTS_PER_BATCH * FLOATS_PER_RECT);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);

    // 创建 VAO（per-vertex: position + color）
    const gl2 = gl as WebGL2RenderingContext;
    this.vao = gl2.createVertexArray();
    if (this.vao) {
      gl2.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);

      const stride = FLOATS_PER_VERTEX * 4; // 6 floats × 4 bytes = 24
      // a_position: [x, y] at offset 0
      gl.enableVertexAttribArray(program.a_position);
      gl.vertexAttribPointer(program.a_position, 2, gl.FLOAT, false, stride, 0);
      // a_color: [r, g, b, a] at offset 8
      gl.enableVertexAttribArray(program.a_color);
      gl.vertexAttribPointer(program.a_color, 4, gl.FLOAT, false, stride, 8);

      gl2.bindVertexArray(null);
    }
  }

  resetStats(): void {
    this._drawCalls = 0;
    this._rectCount = 0;
  }

  get drawCalls(): number {
    return this._drawCalls;
  }

  get totalRects(): number {
    return this._rectCount;
  }

  /**
   * 提交一个矩形到批次（per-vertex color，不再因颜色不同而 flush）
   * @param globalAlpha 全局透明度，与颜色 alpha 相乘
   */
  draw(x: number, y: number, width: number, height: number, color: RGBAColor, globalAlpha: number = 1): void {
    // 批次满 → flush
    if (this.rectCount >= MAX_RECTS_PER_BATCH) {
      this.flush();
    }

    // 写入顶点 [x, y, r, g, b, a]
    const offset = this.rectCount * FLOATS_PER_RECT;
    const data = this.vertexData;
    const x0 = x;
    const y0 = y;
    const x1 = x + width;
    const y1 = y + height;
    const cr = color.r;
    const cg = color.g;
    const cb = color.b;
    const ca = color.a * globalAlpha;

    // 三角形 1: 左上 → 右上 → 左下
    data[offset] = x0;
    data[offset + 1] = y0;
    data[offset + 2] = cr;
    data[offset + 3] = cg;
    data[offset + 4] = cb;
    data[offset + 5] = ca;

    data[offset + 6] = x1;
    data[offset + 7] = y0;
    data[offset + 8] = cr;
    data[offset + 9] = cg;
    data[offset + 10] = cb;
    data[offset + 11] = ca;

    data[offset + 12] = x0;
    data[offset + 13] = y1;
    data[offset + 14] = cr;
    data[offset + 15] = cg;
    data[offset + 16] = cb;
    data[offset + 17] = ca;

    // 三角形 2: 右上 → 右下 → 左下
    data[offset + 18] = x1;
    data[offset + 19] = y0;
    data[offset + 20] = cr;
    data[offset + 21] = cg;
    data[offset + 22] = cb;
    data[offset + 23] = ca;

    data[offset + 24] = x1;
    data[offset + 25] = y1;
    data[offset + 26] = cr;
    data[offset + 27] = cg;
    data[offset + 28] = cb;
    data[offset + 29] = ca;

    data[offset + 30] = x0;
    data[offset + 31] = y1;
    data[offset + 32] = cr;
    data[offset + 33] = cg;
    data[offset + 34] = cb;
    data[offset + 35] = ca;

    this.rectCount++;
    this._rectCount++;
  }

  /**
   * 刷新当前批次到 GPU
   */
  flush(): void {
    if (this.rectCount === 0) return;

    const gl = this.gl;
    const prog = this.program;

    gl.useProgram(prog.program);

    // 上传顶点数据
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.vertexData.subarray(0, this.rectCount * FLOATS_PER_RECT)
    );

    // 绑定 VAO
    const gl2 = gl as WebGL2RenderingContext;
    if (this.vao) {
      gl2.bindVertexArray(this.vao);
    }

    // 绘制
    gl.drawArrays(gl.TRIANGLES, 0, this.rectCount * VERTICES_PER_RECT);

    if (this.vao) {
      gl2.bindVertexArray(null);
    }

    this._drawCalls++;
    this.rectCount = 0;
  }

  dispose(): void {
    const gl2 = this.gl as WebGL2RenderingContext;
    if (this.vao) {
      gl2.deleteVertexArray(this.vao);
      this.vao = null;
    }
    this.gl.deleteBuffer(this.vbo);
  }
}
