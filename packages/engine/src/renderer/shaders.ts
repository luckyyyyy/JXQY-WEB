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
  attribute float a_texIndex;

  uniform vec2 u_resolution;

  varying vec2 v_texcoord;
  varying float v_alpha;
  varying float v_filterType;
  varying float v_texIndex;

  void main() {
    // 像素坐标 → clip space (-1 ~ 1)
    vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
    // Y 轴翻转（屏幕坐标 Y 向下，WebGL Y 向上）
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);

    v_texcoord = a_texcoord;
    v_alpha = a_alpha;
    v_filterType = a_filterType;
    v_texIndex = a_texIndex;
  }
`;

/** 多纹理批处理：单次 draw call 内同时绑定多个纹理槽位（典型 8 槽） */
export const MAX_TEXTURE_SLOTS = 8;

/** 精灵片段着色器 - 采样纹理 + 应用颜色滤镜 + alpha */
export const SPRITE_FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_textures[8];

  varying vec2 v_texcoord;
  varying float v_alpha;
  varying float v_filterType;
  varying float v_texIndex;

  // 灰度转换系数（Rec. 709）
  const vec3 GRAYSCALE_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);

  // WebGL1 GLSL 不允许 sampler 数组的动态索引，必须用常量索引；
  // 这里用 if/else 链按 v_texIndex 分发到 8 个槽位。
  vec4 sampleSlot(vec2 uv, float idx) {
    if (idx < 0.5) return texture2D(u_textures[0], uv);
    else if (idx < 1.5) return texture2D(u_textures[1], uv);
    else if (idx < 2.5) return texture2D(u_textures[2], uv);
    else if (idx < 3.5) return texture2D(u_textures[3], uv);
    else if (idx < 4.5) return texture2D(u_textures[4], uv);
    else if (idx < 5.5) return texture2D(u_textures[5], uv);
    else if (idx < 6.5) return texture2D(u_textures[6], uv);
    else return texture2D(u_textures[7], uv);
  }

  void main() {
    vec4 color = sampleSlot(v_texcoord, v_texIndex);

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
        vec3 sepia = clamp(vec3(gray * 1.2, gray * 1.0, gray * 0.8), 0.0, 1.0);
        // Saturate × 3
        vec3 mid = vec3(0.5);
        sepia = clamp(mid + (sepia - mid) * 3.0, 0.0, 1.0);
        // Hue rotate 180deg - 标准色相旋转矩阵 (cos=-1, sin=0)
        // R' = -1/3*R + 2/3*G + 2/3*B
        // G' =  2/3*R - 1/3*G + 2/3*B
        // B' =  2/3*R + 2/3*G - 1/3*B
        color.rgb = clamp(vec3(
          (-1.0/3.0)*sepia.r + (2.0/3.0)*sepia.g + (2.0/3.0)*sepia.b,
          ( 2.0/3.0)*sepia.r + (-1.0/3.0)*sepia.g + (2.0/3.0)*sepia.b,
          ( 2.0/3.0)*sepia.r + (2.0/3.0)*sepia.g + (-1.0/3.0)*sepia.b
        ), 0.0, 1.0);
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
  a_texIndex: number;
  // Uniforms
  u_resolution: WebGLUniformLocation;
  /** sampler 数组（长度 = MAX_TEXTURE_SLOTS） */
  u_textures: WebGLUniformLocation[];
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

  const u_textures: WebGLUniformLocation[] = [];
  for (let i = 0; i < MAX_TEXTURE_SLOTS; i++) {
    const loc = gl.getUniformLocation(program, `u_textures[${i}]`);
    if (!loc) {
      logger.error(`[WebGL] Failed to get u_textures[${i}] uniform location`);
      return null;
    }
    u_textures.push(loc);
  }

  return {
    program,
    a_position: gl.getAttribLocation(program, "a_position"),
    a_texcoord: gl.getAttribLocation(program, "a_texcoord"),
    a_alpha: gl.getAttribLocation(program, "a_alpha"),
    a_filterType: gl.getAttribLocation(program, "a_filterType"),
    a_texIndex: gl.getAttribLocation(program, "a_texIndex"),
    u_resolution: gl.getUniformLocation(program, "u_resolution")!,
    u_textures,
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

// ============= Water Effect Shader =============

/** 水波纹后处理顶点着色器 — 全屏 quad，传递 UV 坐标 */
export const WATER_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texcoord;

  varying vec2 v_texCoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texcoord;
  }
`;

/**
 * 水波纹后处理片段着色器
 * 三种波浪叠加：方向波 + 固定涟漪 + 光照 alpha 调制
 */
export const WATER_FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D u_sceneTexture;
  uniform vec2 u_resolution;
  uniform float u_time;

  // 方向波（2 条）
  uniform float u_waveAmp[2];
  uniform float u_waveFreq[2];
  uniform float u_waveDensity[2];
  uniform float u_waveA[2];
  uniform float u_waveB[2];
  uniform float u_wavePhi[2];

  // 固定涟漪（1 个）
  uniform float u_rippleAmp;
  uniform float u_rippleFreq;
  uniform float u_rippleDensity;
  uniform vec2 u_ripplePos;

  // 光照参数
  uniform float u_lightDefaultAlpha;
  uniform float u_lightMinAlpha;

  varying vec2 v_texCoord;

  void main() {
    vec2 pos = v_texCoord * u_resolution;
    vec2 offset = vec2(0.0);
    float t = u_time;

    // 方向波叠加
    for (int i = 0; i < 2; i++) {
      float dist_to_line = u_waveA[i] * pos.x + u_waveB[i] * pos.y + u_wavePhi[i];
      float line_offset = u_waveAmp[i] * sin(u_waveFreq[i] * t - u_waveDensity[i] * dist_to_line);
      offset.x += line_offset * u_waveA[i];
      offset.y += line_offset * u_waveB[i];
    }

    // 固定涟漪
    float dx = pos.x - u_ripplePos.x;
    float dy = pos.y - u_ripplePos.y;
    float angle = atan(-dy, dx);
    float dist = sqrt(dx * dx + dy * dy);
    float ripple = u_rippleAmp * cos(u_rippleFreq * t - u_rippleDensity * dist);
    offset.x += ripple * cos(angle);
    offset.y += ripple * -sin(angle);

    // 光照 alpha：基于位移幅度近似
    float disp = length(offset);
    float alpha = u_lightDefaultAlpha;
    if (disp > 0.5) {
      alpha = clamp(disp * 0.01 + u_lightDefaultAlpha, u_lightMinAlpha, 1.0);
    }

    // UV 位移采样（反向：位移 +d 像素 → 采样 UV - d/resolution）
    vec2 uv = v_texCoord - offset / u_resolution;
    uv = clamp(uv, 0.0, 1.0);

    vec4 color = texture2D(u_sceneTexture, uv);
    color.a *= alpha;
    gl_FragColor = color;
  }
`;

/** 水波纹着色器程序 */
export interface WaterProgram {
  program: WebGLProgram;
  // Attributes
  a_position: number;
  a_texcoord: number;
  // Uniforms
  u_sceneTexture: WebGLUniformLocation;
  u_resolution: WebGLUniformLocation;
  u_time: WebGLUniformLocation;
  // Wave uniforms
  u_waveAmp: WebGLUniformLocation[];
  u_waveFreq: WebGLUniformLocation[];
  u_waveDensity: WebGLUniformLocation[];
  u_waveA: WebGLUniformLocation[];
  u_waveB: WebGLUniformLocation[];
  u_wavePhi: WebGLUniformLocation[];
  // Ripple uniforms
  u_rippleAmp: WebGLUniformLocation;
  u_rippleFreq: WebGLUniformLocation;
  u_rippleDensity: WebGLUniformLocation;
  u_ripplePos: WebGLUniformLocation;
  // Light uniforms
  u_lightDefaultAlpha: WebGLUniformLocation;
  u_lightMinAlpha: WebGLUniformLocation;
}

/**
 * 创建并初始化水波纹后处理着色器程序
 */
export function createWaterProgram(gl: WebGLRenderingContext): WaterProgram | null {
  const program = createProgram(gl, WATER_VERTEX_SHADER, WATER_FRAGMENT_SHADER);
  if (!program) return null;

  const getU = (name: string): WebGLUniformLocation => {
    return gl.getUniformLocation(program, name)!;
  };

  const waveAmp: WebGLUniformLocation[] = [];
  const waveFreq: WebGLUniformLocation[] = [];
  const waveDensity: WebGLUniformLocation[] = [];
  const waveA: WebGLUniformLocation[] = [];
  const waveB: WebGLUniformLocation[] = [];
  const wavePhi: WebGLUniformLocation[] = [];
  for (let i = 0; i < 2; i++) {
    waveAmp.push(getU(`u_waveAmp[${i}]`));
    waveFreq.push(getU(`u_waveFreq[${i}]`));
    waveDensity.push(getU(`u_waveDensity[${i}]`));
    waveA.push(getU(`u_waveA[${i}]`));
    waveB.push(getU(`u_waveB[${i}]`));
    wavePhi.push(getU(`u_wavePhi[${i}]`));
  }

  return {
    program,
    a_position: gl.getAttribLocation(program, "a_position"),
    a_texcoord: gl.getAttribLocation(program, "a_texcoord"),
    u_sceneTexture: getU("u_sceneTexture"),
    u_resolution: getU("u_resolution"),
    u_time: getU("u_time"),
    u_waveAmp: waveAmp,
    u_waveFreq: waveFreq,
    u_waveDensity: waveDensity,
    u_waveA: waveA,
    u_waveB: waveB,
    u_wavePhi: wavePhi,
    u_rippleAmp: getU("u_rippleAmp"),
    u_rippleFreq: getU("u_rippleFreq"),
    u_rippleDensity: getU("u_rippleDensity"),
    u_ripplePos: getU("u_ripplePos"),
    u_lightDefaultAlpha: getU("u_lightDefaultAlpha"),
    u_lightMinAlpha: getU("u_lightMinAlpha"),
  };
}
