/* tslint:disable */
/* eslint-disable */

/**
 * ASF 文件头信息
 */
export class AsfHeader {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    bottom: number;
    color_count: number;
    directions: number;
    frame_count: number;
    frames_per_direction: number;
    height: number;
    interval: number;
    left: number;
    width: number;
}

/**
 * MPC 文件头信息
 */
export class MpcHeader {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    bottom: number;
    color_count: number;
    direction: number;
    frame_count: number;
    frames_data_length_sum: number;
    global_height: number;
    global_width: number;
    interval: number;
    left: number;
    /**
     * 所有帧解码后的总字节数
     */
    total_pixel_bytes: number;
}

export class MsfHeader {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    anchor_x: number;
    anchor_y: number;
    canvas_height: number;
    canvas_width: number;
    directions: number;
    fps: number;
    frame_count: number;
    frames_per_direction: number;
    palette_size: number;
    pixel_format: number;
    /**
     * Total RGBA bytes for all frames when decoded individually
     */
    total_individual_pixel_bytes: number;
}

/**
 * 寻路器状态（可复用以减少内存分配）
 */
export class PathFinder {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 返回 bitmap 字节大小
     */
    bitmap_byte_size(): number;
    /**
     * 返回 dynamic_bitmap 在 WASM 内存中的指针（用于 JS 零拷贝写入）
     */
    dynamic_bitmap_ptr(): number;
    /**
     * A* 寻路主入口
     * 同时考虑静态障碍物（obstacle_bitmap）和动态障碍物（dynamic_bitmap）
     * 返回路径数组 [x1, y1, x2, y2, ...]，空数组表示无路径
     */
    find_path(start_x: number, start_y: number, end_x: number, end_y: number, path_type: PathType, can_move_direction_count: number): Int32Array;
    /**
     * 返回 hard_obstacle_bitmap 在 WASM 内存中的指针
     */
    hard_obstacle_bitmap_ptr(): number;
    /**
     * 创建新的寻路器
     */
    constructor(map_width: number, map_height: number);
    /**
     * 返回 obstacle_bitmap 在 WASM 内存中的指针
     */
    obstacle_bitmap_ptr(): number;
    /**
     * 设置单个格子的障碍状态（仅测试用，运行时通过共享内存指针写入）
     */
    set_obstacle(x: number, y: number, is_obstacle: boolean, is_hard: boolean): void;
}

/**
 * 寻路类型枚举
 */
export enum PathType {
    PathOneStep = 0,
    SimpleMaxNpcTry = 1,
    PerfectMaxNpcTry = 2,
    PerfectMaxPlayerTry = 3,
    PathStraightLine = 4,
}

/**
 * 空间哈希网格
 */
export class SpatialHash {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * 批量更新实体位置
     * positions: [id1, x1, y1, id2, x2, y2, ...]
     */
    batch_update_positions(positions: Float32Array): void;
    /**
     * 清空所有数据
     */
    clear(): void;
    /**
     * 获取实体数量
     */
    count(): number;
    /**
     * 检测所有碰撞对
     * 返回碰撞对数组 [id1, id2, id3, id4, ...]
     */
    detect_all_collisions(): Uint32Array;
    /**
     * 检测指定实体与其他实体的碰撞
     */
    detect_collisions_for(id: number): Uint32Array;
    /**
     * 创建新的空间哈希
     */
    constructor(cell_size: number);
    /**
     * 查询指定位置的实体（精确匹配网格单元）
     */
    query_at(x: number, y: number): Uint32Array;
    /**
     * 查询指定位置特定阵营的实体
     */
    query_at_by_group(x: number, y: number, group: number): Uint32Array;
    /**
     * 查询指定位置非指定阵营的实体（用于敌我识别）
     */
    query_at_excluding_group(x: number, y: number, exclude_group: number): Uint32Array;
    /**
     * 查询圆形范围内的所有实体
     * 返回实体 ID 数组
     */
    query_radius(x: number, y: number, radius: number): Uint32Array;
    /**
     * 移除实体
     */
    remove(id: number): void;
    /**
     * 添加或更新实体
     */
    upsert(id: number, x: number, y: number, radius: number, group: number): void;
}

/**
 * 矩形碰撞检测（AABB）
 */
export function check_aabb_collision(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean;

/**
 * 圆形碰撞检测
 */
export function check_circle_collision(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number): boolean;

/**
 * 一次性解码所有帧（无状态，零拷贝输入）
 *
 * 参数:
 * - data: ASF 文件原始数据
 * - output: 预分配的输出 buffer (width * height * 4 * frameCount)
 *
 * 返回: 成功返回帧数，失败返回 0
 */
export function decode_asf_frames(data: Uint8Array, output: Uint8Array): number;

/**
 * 解码 MPC 帧到预分配的 buffer
 *
 * 参数:
 * - data: MPC 文件原始数据
 * - pixel_output: 预分配的像素数据 buffer (header.total_pixel_bytes 字节)
 * - frame_sizes_output: 预分配的帧尺寸 buffer (frame_count * 2 个 u32)
 * - frame_offsets_output: 预分配的帧偏移 buffer (frame_count 个 u32)
 *
 * 返回: 成功返回帧数，失败返回 0
 */
export function decode_mpc_frames(data: Uint8Array, pixel_output: Uint8Array, frame_sizes_output: Uint8Array, frame_offsets_output: Uint8Array): number;

/**
 * Decode all frames into canvas-sized RGBA (for ASF sprites)
 */
export function decode_msf_frames(data: Uint8Array, output: Uint8Array): number;

/**
 * Decode frames as individual images (for MPC per-frame varying sizes)
 */
export function decode_msf_individual_frames(data: Uint8Array, pixel_output: Uint8Array, frame_sizes_output: Uint8Array, frame_offsets_output: Uint8Array): number;

/**
 * 初始化 WASM 模块
 * 设置 panic hook 以便在控制台显示 Rust panic 信息
 */
export function init(): void;

/**
 * 解析 ASF 头信息（不解码帧数据）
 */
export function parse_asf_header(data: Uint8Array): AsfHeader | undefined;

/**
 * 解析 MPC 头信息（包括计算总像素大小）
 */
export function parse_mpc_header(data: Uint8Array): MpcHeader | undefined;

/**
 * Parse MSF v2 header from raw data
 */
export function parse_msf_header(data: Uint8Array): MsfHeader | undefined;

/**
 * 点是否在圆内
 */
export function point_in_circle(px: number, py: number, cx: number, cy: number, radius: number): boolean;

/**
 * 点是否在矩形内
 */
export function point_in_rect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean;

/**
 * 获取 WASM 模块版本
 */
export function version(): string;

/**
 * Zstd 解压（暴露给 JS，用于 MMF 地图格式解压）
 */
export function zstd_decompress(data: Uint8Array): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_asfheader_free: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_width: (a: number) => number;
    readonly __wbg_set_asfheader_width: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_height: (a: number) => number;
    readonly __wbg_set_asfheader_height: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_frame_count: (a: number) => number;
    readonly __wbg_set_asfheader_frame_count: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_directions: (a: number) => number;
    readonly __wbg_set_asfheader_directions: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_color_count: (a: number) => number;
    readonly __wbg_set_asfheader_color_count: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_interval: (a: number) => number;
    readonly __wbg_set_asfheader_interval: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_left: (a: number) => number;
    readonly __wbg_set_asfheader_left: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_bottom: (a: number) => number;
    readonly __wbg_set_asfheader_bottom: (a: number, b: number) => void;
    readonly __wbg_get_asfheader_frames_per_direction: (a: number) => number;
    readonly __wbg_set_asfheader_frames_per_direction: (a: number, b: number) => void;
    readonly parse_asf_header: (a: number, b: number) => number;
    readonly decode_asf_frames: (a: number, b: number, c: any) => number;
    readonly __wbg_spatialhash_free: (a: number, b: number) => void;
    readonly spatialhash_new: (a: number) => number;
    readonly spatialhash_clear: (a: number) => void;
    readonly spatialhash_upsert: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly spatialhash_remove: (a: number, b: number) => void;
    readonly spatialhash_batch_update_positions: (a: number, b: number, c: number) => void;
    readonly spatialhash_query_radius: (a: number, b: number, c: number, d: number) => [number, number];
    readonly spatialhash_query_at: (a: number, b: number, c: number) => [number, number];
    readonly spatialhash_query_at_by_group: (a: number, b: number, c: number, d: number) => [number, number];
    readonly spatialhash_query_at_excluding_group: (a: number, b: number, c: number, d: number) => [number, number];
    readonly spatialhash_detect_all_collisions: (a: number) => [number, number];
    readonly spatialhash_detect_collisions_for: (a: number, b: number) => [number, number];
    readonly spatialhash_count: (a: number) => number;
    readonly check_aabb_collision: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly check_circle_collision: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly point_in_rect: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly point_in_circle: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly __wbg_mpcheader_free: (a: number, b: number) => void;
    readonly __wbg_get_mpcheader_total_pixel_bytes: (a: number) => number;
    readonly __wbg_set_mpcheader_total_pixel_bytes: (a: number, b: number) => void;
    readonly parse_mpc_header: (a: number, b: number) => number;
    readonly decode_mpc_frames: (a: number, b: number, c: any, d: any, e: any) => number;
    readonly __wbg_msfheader_free: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_canvas_width: (a: number) => number;
    readonly __wbg_set_msfheader_canvas_width: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_canvas_height: (a: number) => number;
    readonly __wbg_set_msfheader_canvas_height: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_frame_count: (a: number) => number;
    readonly __wbg_set_msfheader_frame_count: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_directions: (a: number) => number;
    readonly __wbg_set_msfheader_directions: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_fps: (a: number) => number;
    readonly __wbg_set_msfheader_fps: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_anchor_x: (a: number) => number;
    readonly __wbg_set_msfheader_anchor_x: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_anchor_y: (a: number) => number;
    readonly __wbg_set_msfheader_anchor_y: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_pixel_format: (a: number) => number;
    readonly __wbg_set_msfheader_pixel_format: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_palette_size: (a: number) => number;
    readonly __wbg_set_msfheader_palette_size: (a: number, b: number) => void;
    readonly __wbg_get_msfheader_frames_per_direction: (a: number) => number;
    readonly __wbg_set_msfheader_frames_per_direction: (a: number, b: number) => void;
    readonly parse_msf_header: (a: number, b: number) => number;
    readonly decode_msf_frames: (a: number, b: number, c: any) => number;
    readonly decode_msf_individual_frames: (a: number, b: number, c: any, d: any, e: any) => number;
    readonly __wbg_pathfinder_free: (a: number, b: number) => void;
    readonly pathfinder_new: (a: number, b: number) => number;
    readonly pathfinder_set_obstacle: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly pathfinder_dynamic_bitmap_ptr: (a: number) => number;
    readonly pathfinder_obstacle_bitmap_ptr: (a: number) => number;
    readonly pathfinder_hard_obstacle_bitmap_ptr: (a: number) => number;
    readonly pathfinder_bitmap_byte_size: (a: number) => number;
    readonly pathfinder_find_path: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number];
    readonly version: () => [number, number];
    readonly zstd_decompress: (a: number, b: number) => [number, number, number, number];
    readonly init: () => void;
    readonly __wbg_set_mpcheader_frames_data_length_sum: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_global_width: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_global_height: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_frame_count: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_direction: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_color_count: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_interval: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_bottom: (a: number, b: number) => void;
    readonly __wbg_set_mpcheader_left: (a: number, b: number) => void;
    readonly __wbg_set_msfheader_total_individual_pixel_bytes: (a: number, b: number) => void;
    readonly __wbg_get_mpcheader_frames_data_length_sum: (a: number) => number;
    readonly __wbg_get_mpcheader_global_width: (a: number) => number;
    readonly __wbg_get_mpcheader_global_height: (a: number) => number;
    readonly __wbg_get_mpcheader_frame_count: (a: number) => number;
    readonly __wbg_get_mpcheader_direction: (a: number) => number;
    readonly __wbg_get_mpcheader_color_count: (a: number) => number;
    readonly __wbg_get_mpcheader_interval: (a: number) => number;
    readonly __wbg_get_mpcheader_bottom: (a: number) => number;
    readonly __wbg_get_mpcheader_left: (a: number) => number;
    readonly __wbg_get_msfheader_total_individual_pixel_bytes: (a: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
