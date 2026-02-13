/**
 * WebGL Shader 系统
 *
 * 提供 shader 编译、链接和管理功能。
 * 包含两套 shader：
 * 1. Sprite Shader - 用于精灵/纹理绘制（drawImage 替代）
 * 2. Rect Shader - 用于矩形填充（fillRect 替代）
 */

import { logger } from "../core/logger";

// ============= Shader 源码 =============

/** 精灵顶点着色器 - 接收 position + texcoord，输出 UV */
export const SPRITE_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texcoord;
  attribute float a_alpha;
  attribute float a_filterType;

  uniform vec2 u_resolution;

  varying vec2 v_texcoord;
  varying float v_alpha;
  varying float v_filterType;

  void main() {
    // 像素坐标 → clip space (-1 ~ 1)
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
    // Y 轴翻转（屏幕坐标 Y 向下，WebGL Y 向上）
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

    v_texcoord = a_texcoord;
    v_alpha = a_alpha;
    v_filterType = a_filterType;
  }
`;

/** 精灵片段着色器 - 采样纹理 + 应用颜色滤镜 + alpha */
export const SPRITE_FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_texture;

  varying vec2 v_texcoord;
  varying float v_alpha;
  varying float v_filterType;

  // 灰度转换系数（Rec. 709）
  const vec3 GRAYSCALE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

  void main() {
    vec4 color = texture2D(u_texture, v_texcoord);

    // filterType: 0=none, 1=grayscale, 2=frozen, 3=poison
    if (v_filterType > 0.5) {
      if (v_filterType < 1.5) {
        // Grayscale (石化)
        float gray = dot(color.rgb, GRAYSCALE_WEIGHTS);
        color.rgb = vec3(gray);
      } else if (v_filterType < 2.5) {
        // Frozen (冰冻蓝) - 模拟 sepia(100%) saturate(300%) hue-rotate(180deg)
        float gray = dot(color.rgb, GRAYSCALE_WEIGHTS);
        // Sepia tone
        vec3 sepia = vec3(gray * 1.2, gray * 1.0, gray * 0.8);
        // Saturate × 3
        vec3 mid = vec3(0.5);
        sepia = mid + (sepia - mid) * 3.0;
        // Hue rotate 180deg (invert RG, boost B for ice blue look)
        color.rgb = vec3(
          clamp(1.0 - sepia.r, 0.0, 1.0),
          clamp(1.0 - sepia.g + 0.2, 0.0, 1.0),
          clamp(sepia.b + 0.3, 0.0, 1.0)
        );
      } else {
        // Poison (中毒绿) - 模拟 sepia(100%) saturate(300%) hue-rotate(60deg)
        float gray = dot(color.rgb, GRAYSCALE_WEIGHTS);
        vec3 sepia = vec3(gray * 1.2, gray * 1.0, gray * 0.8);
        vec3 mid = vec3(0.5);
        sepia = mid + (sepia - mid) * 3.0;
        // Hue rotate 60deg (shift toward green)
        color.rgb = vec3(
          clamp(sepia.r * 0.5, 0.0, 1.0),
          clamp(sepia.g * 1.2 + 0.1, 0.0, 1.0),
          clamp(sepia.b * 0.3, 0.0, 1.0)
        );
      }
    }

    color.a *= v_alpha;

    // 预乘 alpha（WebGL 标准做法）
    // 注意：源纹理可能已经是预乘的（来自 Canvas2D），这里确保一致性
    gl_FragColor = color;
  }
`;

/** 矩形填充顶点着色器（per-vertex color，所有颜色矩形可在一个 draw call 中完成） */
export const RECT_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec4 a_color;

  uniform vec2 u_resolution;

  varying vec4 v_color;

  void main() {
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    v_color = a_color;
  }
`;

/** 矩形填充片段着色器（per-vertex color） */
export const RECT_FRAGMENT_SHADER = `
  precision mediump float;

  varying vec4 v_color;

  void main() {
    gl_FragColor = v_color;
  }
`;

// ============= Shader 工具函数 =============

/**
 * 编译单个 shader
 */
export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    logger.error("[WebGL] Failed to create shader");
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    logger.error(`[WebGL] Shader compile error: ${info}`);
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * 链接 shader program
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  if (!vertexShader) return null;

  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!fragmentShader) {
    gl.deleteShader(vertexShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    logger.error(`[WebGL] Program link error: ${info}`);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  // Shader 对象 linked 后可以释放
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

// ============= Shader Program 封装 =============

/** 精灵着色器程序 - 缓存 attribute/uniform 位置 */
export interface SpriteProgram {
  program: WebGLProgram;
  // Attributes
  a_position: number;
  a_texcoord: number;
  a_alpha: number;
  a_filterType: number;
  // Uniforms
  u_resolution: WebGLUniformLocation;
  u_texture: WebGLUniformLocation;
}

/** 矩形着色器程序（per-vertex color） */
export interface RectProgram {
  program: WebGLProgram;
  a_position: number;
  a_color: number;
  u_resolution: WebGLUniformLocation;
}

/**
 * 创建并初始化精灵着色器程序
 */
export function createSpriteProgram(gl: WebGLRenderingContext): SpriteProgram | null {
  const program = createProgram(gl, SPRITE_VERTEX_SHADER, SPRITE_FRAGMENT_SHADER);
  if (!program) return null;

  return {
    program,
    a_position: gl.getAttribLocation(program, "a_position"),
    a_texcoord: gl.getAttribLocation(program, "a_texcoord"),
    a_alpha: gl.getAttribLocation(program, "a_alpha"),
    a_filterType: gl.getAttribLocation(program, "a_filterType"),
    u_resolution: gl.getUniformLocation(program, "u_resolution")!,
    u_texture: gl.getUniformLocation(program, "u_texture")!,
  };
}

/**
 * 创建并初始化矩形着色器程序
 */
export function createRectProgram(gl: WebGLRenderingContext): RectProgram | null {
  const program = createProgram(gl, RECT_VERTEX_SHADER, RECT_FRAGMENT_SHADER);
  if (!program) return null;

  return {
    program,
    a_position: gl.getAttribLocation(program, "a_position"),
    a_color: gl.getAttribLocation(program, "a_color"),
    u_resolution: gl.getUniformLocation(program, "u_resolution")!,
  };
}
