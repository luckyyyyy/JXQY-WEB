/* @ts-self-types="./miu2d_engine_wasm.d.ts" */

/**
 * ASF 文件头信息
 */
export class AsfHeader {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(AsfHeader.prototype);
        obj.__wbg_ptr = ptr;
        AsfHeaderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        AsfHeaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_asfheader_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get bottom() {
        const ret = wasm.__wbg_get_asfheader_bottom(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get color_count() {
        const ret = wasm.__wbg_get_asfheader_color_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get directions() {
        const ret = wasm.__wbg_get_asfheader_directions(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get frame_count() {
        const ret = wasm.__wbg_get_asfheader_frame_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get frames_per_direction() {
        const ret = wasm.__wbg_get_asfheader_frames_per_direction(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_asfheader_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get interval() {
        const ret = wasm.__wbg_get_asfheader_interval(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get left() {
        const ret = wasm.__wbg_get_asfheader_left(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_asfheader_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set bottom(arg0) {
        wasm.__wbg_set_asfheader_bottom(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set color_count(arg0) {
        wasm.__wbg_set_asfheader_color_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set directions(arg0) {
        wasm.__wbg_set_asfheader_directions(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set frame_count(arg0) {
        wasm.__wbg_set_asfheader_frame_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set frames_per_direction(arg0) {
        wasm.__wbg_set_asfheader_frames_per_direction(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_asfheader_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set interval(arg0) {
        wasm.__wbg_set_asfheader_interval(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set left(arg0) {
        wasm.__wbg_set_asfheader_left(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_asfheader_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) AsfHeader.prototype[Symbol.dispose] = AsfHeader.prototype.free;

/**
 * MPC 文件头信息
 */
export class MpcHeader {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(MpcHeader.prototype);
        obj.__wbg_ptr = ptr;
        MpcHeaderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MpcHeaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_mpcheader_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get bottom() {
        const ret = wasm.__wbg_get_asfheader_bottom(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get color_count() {
        const ret = wasm.__wbg_get_asfheader_interval(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get direction() {
        const ret = wasm.__wbg_get_asfheader_color_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get frame_count() {
        const ret = wasm.__wbg_get_asfheader_directions(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get frames_data_length_sum() {
        const ret = wasm.__wbg_get_asfheader_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get global_height() {
        const ret = wasm.__wbg_get_asfheader_frame_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get global_width() {
        const ret = wasm.__wbg_get_asfheader_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get interval() {
        const ret = wasm.__wbg_get_asfheader_left(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get left() {
        const ret = wasm.__wbg_get_asfheader_frames_per_direction(this.__wbg_ptr);
        return ret;
    }
    /**
     * 所有帧解码后的总字节数
     * @returns {number}
     */
    get total_pixel_bytes() {
        const ret = wasm.__wbg_get_mpcheader_total_pixel_bytes(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set bottom(arg0) {
        wasm.__wbg_set_asfheader_bottom(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set color_count(arg0) {
        wasm.__wbg_set_asfheader_interval(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set direction(arg0) {
        wasm.__wbg_set_asfheader_color_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set frame_count(arg0) {
        wasm.__wbg_set_asfheader_directions(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set frames_data_length_sum(arg0) {
        wasm.__wbg_set_asfheader_width(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set global_height(arg0) {
        wasm.__wbg_set_asfheader_frame_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set global_width(arg0) {
        wasm.__wbg_set_asfheader_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set interval(arg0) {
        wasm.__wbg_set_asfheader_left(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set left(arg0) {
        wasm.__wbg_set_asfheader_frames_per_direction(this.__wbg_ptr, arg0);
    }
    /**
     * 所有帧解码后的总字节数
     * @param {number} arg0
     */
    set total_pixel_bytes(arg0) {
        wasm.__wbg_set_mpcheader_total_pixel_bytes(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) MpcHeader.prototype[Symbol.dispose] = MpcHeader.prototype.free;

export class MsfHeader {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(MsfHeader.prototype);
        obj.__wbg_ptr = ptr;
        MsfHeaderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        MsfHeaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_msfheader_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get anchor_x() {
        const ret = wasm.__wbg_get_msfheader_anchor_x(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get anchor_y() {
        const ret = wasm.__wbg_get_msfheader_anchor_y(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get canvas_height() {
        const ret = wasm.__wbg_get_msfheader_canvas_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get canvas_width() {
        const ret = wasm.__wbg_get_msfheader_canvas_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get directions() {
        const ret = wasm.__wbg_get_msfheader_directions(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get fps() {
        const ret = wasm.__wbg_get_msfheader_fps(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get frame_count() {
        const ret = wasm.__wbg_get_msfheader_frame_count(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get frames_per_direction() {
        const ret = wasm.__wbg_get_msfheader_frames_per_direction(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get palette_size() {
        const ret = wasm.__wbg_get_msfheader_palette_size(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get pixel_format() {
        const ret = wasm.__wbg_get_msfheader_pixel_format(this.__wbg_ptr);
        return ret;
    }
    /**
     * Total RGBA bytes for all frames when decoded individually
     * @returns {number}
     */
    get total_individual_pixel_bytes() {
        const ret = wasm.__wbg_get_asfheader_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set anchor_x(arg0) {
        wasm.__wbg_set_msfheader_anchor_x(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set anchor_y(arg0) {
        wasm.__wbg_set_msfheader_anchor_y(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set canvas_height(arg0) {
        wasm.__wbg_set_msfheader_canvas_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set canvas_width(arg0) {
        wasm.__wbg_set_msfheader_canvas_width(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set directions(arg0) {
        wasm.__wbg_set_msfheader_directions(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set fps(arg0) {
        wasm.__wbg_set_msfheader_fps(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set frame_count(arg0) {
        wasm.__wbg_set_msfheader_frame_count(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set frames_per_direction(arg0) {
        wasm.__wbg_set_msfheader_frames_per_direction(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set palette_size(arg0) {
        wasm.__wbg_set_msfheader_palette_size(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set pixel_format(arg0) {
        wasm.__wbg_set_msfheader_pixel_format(this.__wbg_ptr, arg0);
    }
    /**
     * Total RGBA bytes for all frames when decoded individually
     * @param {number} arg0
     */
    set total_individual_pixel_bytes(arg0) {
        wasm.__wbg_set_asfheader_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) MsfHeader.prototype[Symbol.dispose] = MsfHeader.prototype.free;

/**
 * 寻路器状态（可复用以减少内存分配）
 */
export class PathFinder {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PathFinderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_pathfinder_free(ptr, 0);
    }
    /**
     * 返回 bitmap 字节大小
     * @returns {number}
     */
    bitmap_byte_size() {
        const ret = wasm.pathfinder_bitmap_byte_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 返回 dynamic_bitmap 在 WASM 内存中的指针（用于 JS 零拷贝写入）
     * @returns {number}
     */
    dynamic_bitmap_ptr() {
        const ret = wasm.pathfinder_dynamic_bitmap_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * A* 寻路主入口
     * 同时考虑静态障碍物（obstacle_bitmap）和动态障碍物（dynamic_bitmap）
     * 返回路径数组 [x1, y1, x2, y2, ...]，空数组表示无路径
     * @param {number} start_x
     * @param {number} start_y
     * @param {number} end_x
     * @param {number} end_y
     * @param {PathType} path_type
     * @param {number} can_move_direction_count
     * @returns {Int32Array}
     */
    find_path(start_x, start_y, end_x, end_y, path_type, can_move_direction_count) {
        const ret = wasm.pathfinder_find_path(this.__wbg_ptr, start_x, start_y, end_x, end_y, path_type, can_move_direction_count);
        var v1 = getArrayI32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 返回 hard_obstacle_bitmap 在 WASM 内存中的指针
     * @returns {number}
     */
    hard_obstacle_bitmap_ptr() {
        const ret = wasm.pathfinder_hard_obstacle_bitmap_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 创建新的寻路器
     * @param {number} map_width
     * @param {number} map_height
     */
    constructor(map_width, map_height) {
        const ret = wasm.pathfinder_new(map_width, map_height);
        this.__wbg_ptr = ret >>> 0;
        PathFinderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 返回 obstacle_bitmap 在 WASM 内存中的指针
     * @returns {number}
     */
    obstacle_bitmap_ptr() {
        const ret = wasm.pathfinder_obstacle_bitmap_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 设置单个格子的障碍状态（仅测试用，运行时通过共享内存指针写入）
     * @param {number} x
     * @param {number} y
     * @param {boolean} is_obstacle
     * @param {boolean} is_hard
     */
    set_obstacle(x, y, is_obstacle, is_hard) {
        wasm.pathfinder_set_obstacle(this.__wbg_ptr, x, y, is_obstacle, is_hard);
    }
}
if (Symbol.dispose) PathFinder.prototype[Symbol.dispose] = PathFinder.prototype.free;

/**
 * 寻路类型枚举
 * @enum {0 | 1 | 2 | 3 | 4}
 */
export const PathType = Object.freeze({
    PathOneStep: 0, "0": "PathOneStep",
    SimpleMaxNpcTry: 1, "1": "SimpleMaxNpcTry",
    PerfectMaxNpcTry: 2, "2": "PerfectMaxNpcTry",
    PerfectMaxPlayerTry: 3, "3": "PerfectMaxPlayerTry",
    PathStraightLine: 4, "4": "PathStraightLine",
});

/**
 * 空间哈希网格
 */
export class SpatialHash {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SpatialHashFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_spatialhash_free(ptr, 0);
    }
    /**
     * 批量更新实体位置
     * positions: [id1, x1, y1, id2, x2, y2, ...]
     * @param {Float32Array} positions
     */
    batch_update_positions(positions) {
        const ptr0 = passArrayF32ToWasm0(positions, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.spatialhash_batch_update_positions(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * 清空所有数据
     */
    clear() {
        wasm.spatialhash_clear(this.__wbg_ptr);
    }
    /**
     * 获取实体数量
     * @returns {number}
     */
    count() {
        const ret = wasm.spatialhash_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 检测所有碰撞对
     * 返回碰撞对数组 [id1, id2, id3, id4, ...]
     * @returns {Uint32Array}
     */
    detect_all_collisions() {
        const ret = wasm.spatialhash_detect_all_collisions(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 检测指定实体与其他实体的碰撞
     * @param {number} id
     * @returns {Uint32Array}
     */
    detect_collisions_for(id) {
        const ret = wasm.spatialhash_detect_collisions_for(this.__wbg_ptr, id);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 创建新的空间哈希
     * @param {number} cell_size
     */
    constructor(cell_size) {
        const ret = wasm.spatialhash_new(cell_size);
        this.__wbg_ptr = ret >>> 0;
        SpatialHashFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * 查询指定位置的实体（精确匹配网格单元）
     * @param {number} x
     * @param {number} y
     * @returns {Uint32Array}
     */
    query_at(x, y) {
        const ret = wasm.spatialhash_query_at(this.__wbg_ptr, x, y);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 查询指定位置特定阵营的实体
     * @param {number} x
     * @param {number} y
     * @param {number} group
     * @returns {Uint32Array}
     */
    query_at_by_group(x, y, group) {
        const ret = wasm.spatialhash_query_at_by_group(this.__wbg_ptr, x, y, group);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 查询指定位置非指定阵营的实体（用于敌我识别）
     * @param {number} x
     * @param {number} y
     * @param {number} exclude_group
     * @returns {Uint32Array}
     */
    query_at_excluding_group(x, y, exclude_group) {
        const ret = wasm.spatialhash_query_at_excluding_group(this.__wbg_ptr, x, y, exclude_group);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 查询圆形范围内的所有实体
     * 返回实体 ID 数组
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @returns {Uint32Array}
     */
    query_radius(x, y, radius) {
        const ret = wasm.spatialhash_query_radius(this.__wbg_ptr, x, y, radius);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * 移除实体
     * @param {number} id
     */
    remove(id) {
        wasm.spatialhash_remove(this.__wbg_ptr, id);
    }
    /**
     * 添加或更新实体
     * @param {number} id
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {number} group
     */
    upsert(id, x, y, radius, group) {
        wasm.spatialhash_upsert(this.__wbg_ptr, id, x, y, radius, group);
    }
}
if (Symbol.dispose) SpatialHash.prototype[Symbol.dispose] = SpatialHash.prototype.free;

/**
 * 矩形碰撞检测（AABB）
 * @param {number} x1
 * @param {number} y1
 * @param {number} w1
 * @param {number} h1
 * @param {number} x2
 * @param {number} y2
 * @param {number} w2
 * @param {number} h2
 * @returns {boolean}
 */
export function check_aabb_collision(x1, y1, w1, h1, x2, y2, w2, h2) {
    const ret = wasm.check_aabb_collision(x1, y1, w1, h1, x2, y2, w2, h2);
    return ret !== 0;
}

/**
 * 圆形碰撞检测
 * @param {number} x1
 * @param {number} y1
 * @param {number} r1
 * @param {number} x2
 * @param {number} y2
 * @param {number} r2
 * @returns {boolean}
 */
export function check_circle_collision(x1, y1, r1, x2, y2, r2) {
    const ret = wasm.check_circle_collision(x1, y1, r1, x2, y2, r2);
    return ret !== 0;
}

/**
 * 一次性解码所有帧（无状态，零拷贝输入）
 *
 * 参数:
 * - data: ASF 文件原始数据
 * - output: 预分配的输出 buffer (width * height * 4 * frameCount)
 *
 * 返回: 成功返回帧数，失败返回 0
 * @param {Uint8Array} data
 * @param {Uint8Array} output
 * @returns {number}
 */
export function decode_asf_frames(data, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_asf_frames(ptr0, len0, output);
    return ret >>> 0;
}

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
 * @param {Uint8Array} data
 * @param {Uint8Array} pixel_output
 * @param {Uint8Array} frame_sizes_output
 * @param {Uint8Array} frame_offsets_output
 * @returns {number}
 */
export function decode_mpc_frames(data, pixel_output, frame_sizes_output, frame_offsets_output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_mpc_frames(ptr0, len0, pixel_output, frame_sizes_output, frame_offsets_output);
    return ret >>> 0;
}

/**
 * Decode all frames into canvas-sized RGBA (for ASF sprites)
 * @param {Uint8Array} data
 * @param {Uint8Array} output
 * @returns {number}
 */
export function decode_msf_frames(data, output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_msf_frames(ptr0, len0, output);
    return ret >>> 0;
}

/**
 * Decode frames as individual images (for MPC per-frame varying sizes)
 * @param {Uint8Array} data
 * @param {Uint8Array} pixel_output
 * @param {Uint8Array} frame_sizes_output
 * @param {Uint8Array} frame_offsets_output
 * @returns {number}
 */
export function decode_msf_individual_frames(data, pixel_output, frame_sizes_output, frame_offsets_output) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decode_msf_individual_frames(ptr0, len0, pixel_output, frame_sizes_output, frame_offsets_output);
    return ret >>> 0;
}

/**
 * 初始化 WASM 模块
 * 设置 panic hook 以便在控制台显示 Rust panic 信息
 */
export function init() {
    wasm.init();
}

/**
 * 解析 ASF 头信息（不解码帧数据）
 * @param {Uint8Array} data
 * @returns {AsfHeader | undefined}
 */
export function parse_asf_header(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_asf_header(ptr0, len0);
    return ret === 0 ? undefined : AsfHeader.__wrap(ret);
}

/**
 * 解析 MPC 头信息（包括计算总像素大小）
 * @param {Uint8Array} data
 * @returns {MpcHeader | undefined}
 */
export function parse_mpc_header(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_mpc_header(ptr0, len0);
    return ret === 0 ? undefined : MpcHeader.__wrap(ret);
}

/**
 * Parse MSF v2 header from raw data
 * @param {Uint8Array} data
 * @returns {MsfHeader | undefined}
 */
export function parse_msf_header(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parse_msf_header(ptr0, len0);
    return ret === 0 ? undefined : MsfHeader.__wrap(ret);
}

/**
 * 点是否在圆内
 * @param {number} px
 * @param {number} py
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {boolean}
 */
export function point_in_circle(px, py, cx, cy, radius) {
    const ret = wasm.point_in_circle(px, py, cx, cy, radius);
    return ret !== 0;
}

/**
 * 点是否在矩形内
 * @param {number} px
 * @param {number} py
 * @param {number} rx
 * @param {number} ry
 * @param {number} rw
 * @param {number} rh
 * @returns {boolean}
 */
export function point_in_rect(px, py, rx, ry, rw, rh) {
    const ret = wasm.point_in_rect(px, py, rx, ry, rw, rh);
    return ret !== 0;
}

/**
 * 获取 WASM 模块版本
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Zstd 解压（暴露给 JS，用于 MMF 地图格式解压）
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
export function zstd_decompress(data) {
    const ptr0 = passArray8ToWasm0(data, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.zstd_decompress(ptr0, len0);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_8c4e43fe74559d73: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_throw_be289d5034ed271b: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_error_7534b8e9a36f1ab4: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_length_32ed9a279acd054c: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_8a6f238a6ece86ea: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_set_cc56eefd2dd91957: function(arg0, arg1, arg2) {
            arg0.set(getArrayU8FromWasm0(arg1, arg2));
        },
        __wbg_stack_0ed75d68575b0f3c: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./miu2d_engine_wasm_bg.js": import0,
    };
}

const AsfHeaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_asfheader_free(ptr >>> 0, 1));
const MpcHeaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_mpcheader_free(ptr >>> 0, 1));
const MsfHeaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_msfheader_free(ptr >>> 0, 1));
const PathFinderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_pathfinder_free(ptr >>> 0, 1));
const SpatialHashFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_spatialhash_free(ptr >>> 0, 1));

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('miu2d_engine_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
