//! AI 目标搜索 - 共享内存 SoA 最近目标查询
//!
//! 复刻 TS 侧 npc-query-helpers.findClosestCharacter + NpcSpatialGrid 的最近目标搜索，
//! 但以零拷贝共享内存 SoA（Structure of Arrays）方式运行：
//!
//! - JS 每帧将所有 NPC 的 {x, y, flags, group} 写入 WASM 线性内存中的 SoA 数组
//!   （通过 *_ptr() 暴露的指针，零 FFI / 零拷贝）。
//! - Rust 按 cell_size 重建空间网格，随后对每次查询在视野半径内做网格邻域扫描，
//!   返回最近匹配 NPC 的 slot 索引（JS 用 slot→Npc 映射还原对象）。
//!
//! 仅替换「NPC 群体最近目标搜索」这一纯数值热核；玩家比较、ignoreList、followTarget
//! 写回等逻辑仍保留在 JS。为将来把整套实体数据迁入共享内存 ECS 铺路。

use hashbrown::HashMap;
use wasm_bindgen::prelude::*;

// === 谓词类型（与 TS npc-ai-queries 的过滤器一一对应）===
/// group != param && isVisible && isEnemy（getLiveClosestOtherGropEnemy）
pub const PRED_OTHER_GROUP_ENEMY: u32 = 0;
/// (withInvis||visible) && (isFighterFriend || (withNeutral && isNoneFighter))
pub const PRED_PLAYER_OR_FIGHTER_FRIEND: u32 = 1;
/// (withInvis||visible) && (isEnemy || (withNeutral && isNoneFighter))
pub const PRED_ENEMY_TYPE: u32 = 2;
/// isFighter && relation != None（getLiveClosestNonneturalFighter）
pub const PRED_NONNEUTRAL_FIGHTER: u32 = 3;

// === flags 位布局（JS 写入）===
const FLAG_VISIBLE: u32 = 1; // bit0: isVisible
const FLAG_DEATH: u32 = 1 << 1; // bit1: isDeathInvoked
// bits 2..4: relation (RelationType: Friend=0, Enemy=1, Neutral=2, None=3)
// bits 4..8: kind (CharacterKind: Normal=0, Fighter=1, Player=2, Follower=3, ...)

/// AI 目标搜索器：持有共享 SoA 与内部空间网格
#[wasm_bindgen]
pub struct AiSearch {
    capacity: usize,
    count: usize,
    pos_x: Vec<f32>,
    pos_y: Vec<f32>,
    flags: Vec<u32>,
    group: Vec<i32>,
    inv_cell: f32,
    cells: HashMap<i64, Vec<u32>>,
}

#[inline]
fn cell_key(cx: i32, cy: i32) -> i64 {
    // 世界坐标为正，cell 索引远小于 1e6，简单配对即可保证唯一
    (cx as i64) * 4_000_000 + (cy as i64)
}

#[wasm_bindgen]
impl AiSearch {
    /// 创建搜索器。capacity 为最大 NPC 数；cell_size 为网格单元像素大小。
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize, cell_size: f32) -> Self {
        let cs = if cell_size > 0.0 { cell_size } else { 640.0 };
        Self {
            capacity,
            count: 0,
            pos_x: vec![0.0; capacity],
            pos_y: vec![0.0; capacity],
            flags: vec![0; capacity],
            group: vec![0; capacity],
            inv_cell: 1.0 / cs,
            cells: HashMap::new(),
        }
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// 设置本帧有效 NPC 数量（不超过 capacity）
    pub fn set_count(&mut self, count: usize) {
        self.count = count.min(self.capacity);
    }

    // === 共享内存指针（JS 零拷贝写入 SoA）===
    pub fn pos_x_ptr(&self) -> *const f32 {
        self.pos_x.as_ptr()
    }
    pub fn pos_y_ptr(&self) -> *const f32 {
        self.pos_y.as_ptr()
    }
    pub fn flags_ptr(&self) -> *const u32 {
        self.flags.as_ptr()
    }
    pub fn group_ptr(&self) -> *const i32 {
        self.group.as_ptr()
    }

    /// 重建空间网格（每帧 SoA 写入后调用一次）
    pub fn rebuild(&mut self) {
        for v in self.cells.values_mut() {
            v.clear();
        }
        for i in 0..self.count {
            let cx = (self.pos_x[i] * self.inv_cell).floor() as i32;
            let cy = (self.pos_y[i] * self.inv_cell).floor() as i32;
            self.cells.entry(cell_key(cx, cy)).or_default().push(i as u32);
        }
    }

    /// 在 (qx, qy) 周围 radius 像素内查找满足谓词的最近 NPC，返回 slot 索引或 -1。
    pub fn find_nearest(
        &self,
        qx: f32,
        qy: f32,
        radius: f32,
        pred: u32,
        param_group: i32,
        with_neutral: bool,
        with_invisible: bool,
    ) -> i32 {
        let r2 = radius * radius;
        let min_cx = ((qx - radius) * self.inv_cell).floor() as i32;
        let max_cx = ((qx + radius) * self.inv_cell).floor() as i32;
        let min_cy = ((qy - radius) * self.inv_cell).floor() as i32;
        let max_cy = ((qy + radius) * self.inv_cell).floor() as i32;

        let mut best_idx: i32 = -1;
        let mut best_d2 = r2;

        let mut cx = min_cx;
        while cx <= max_cx {
            let mut cy = min_cy;
            while cy <= max_cy {
                if let Some(arr) = self.cells.get(&cell_key(cx, cy)) {
                    for &i in arr.iter() {
                        let idx = i as usize;
                        if !self.matches(idx, pred, param_group, with_neutral, with_invisible) {
                            continue;
                        }
                        let dx = self.pos_x[idx] - qx;
                        let dy = self.pos_y[idx] - qy;
                        let d2 = dx * dx + dy * dy;
                        if d2 < best_d2 {
                            best_d2 = d2;
                            best_idx = i as i32;
                        }
                    }
                }
                cy += 1;
            }
            cx += 1;
        }

        best_idx
    }

    #[inline]
    fn matches(
        &self,
        idx: usize,
        pred: u32,
        param_group: i32,
        with_neutral: bool,
        with_invisible: bool,
    ) -> bool {
        let f = self.flags[idx];
        // combinedFilter: 排除 isDeathInvoked
        if f & FLAG_DEATH != 0 {
            return false;
        }
        let visible = f & FLAG_VISIBLE != 0;
        let relation = (f >> 2) & 0x3;
        let kind = (f >> 4) & 0xf;
        let is_enemy = relation == 1;
        let is_fighter_friend = (kind == 1 || kind == 3) && relation == 0;
        let is_none_fighter = relation == 3 && kind == 1;
        let is_fighter = kind == 1 || kind == 3;

        match pred {
            PRED_OTHER_GROUP_ENEMY => self.group[idx] != param_group && visible && is_enemy,
            PRED_PLAYER_OR_FIGHTER_FRIEND => {
                (with_invisible || visible)
                    && (is_fighter_friend || (with_neutral && is_none_fighter))
            }
            PRED_ENEMY_TYPE => {
                (with_invisible || visible) && (is_enemy || (with_neutral && is_none_fighter))
            }
            PRED_NONNEUTRAL_FIGHTER => is_fighter && relation != 3,
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flag(visible: bool, death: bool, relation: u32, kind: u32) -> u32 {
        let mut f = 0u32;
        if visible {
            f |= FLAG_VISIBLE;
        }
        if death {
            f |= FLAG_DEATH;
        }
        f |= relation << 2;
        f |= kind << 4;
        f
    }

    #[test]
    fn test_other_group_enemy_nearest() {
        let mut s = AiSearch::new(16, 640.0);
        // slot0: enemy group1 at (100,100); slot1: enemy group1 at (300,100); slot2: enemy group2
        s.pos_x[0] = 100.0;
        s.pos_y[0] = 100.0;
        s.flags[0] = flag(true, false, 1, 1);
        s.group[0] = 1;
        s.pos_x[1] = 300.0;
        s.pos_y[1] = 100.0;
        s.flags[1] = flag(true, false, 1, 1);
        s.group[1] = 1;
        s.pos_x[2] = 500.0;
        s.pos_y[2] = 100.0;
        s.flags[2] = flag(true, false, 1, 1);
        s.group[2] = 2;
        s.set_count(3);
        s.rebuild();
        // searcher group 1 at (90,100): nearest other-group enemy is slot2 (group2)
        let r = s.find_nearest(90.0, 100.0, 2000.0, PRED_OTHER_GROUP_ENEMY, 1, false, false);
        assert_eq!(r, 2);
    }

    #[test]
    fn test_death_excluded_and_radius() {
        let mut s = AiSearch::new(16, 640.0);
        s.pos_x[0] = 100.0;
        s.pos_y[0] = 100.0;
        s.flags[0] = flag(true, true, 1, 1); // dead enemy → excluded
        s.group[0] = 5;
        s.set_count(1);
        s.rebuild();
        let r = s.find_nearest(100.0, 100.0, 2000.0, PRED_OTHER_GROUP_ENEMY, 1, false, false);
        assert_eq!(r, -1);
    }
}
