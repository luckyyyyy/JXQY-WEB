//! Miu2D Engine WASM - 高性能 WebAssembly 模块
//!
//! 为 Miu2D 游戏引擎提供计算密集型功能的 Rust 实现：
//! - A* 寻路算法
//! - ASF 精灵帧解码 (RLE 解压)
//! - MPC 精灵帧解码 (RLE 解压)
//! - 空间碰撞检测

use wasm_bindgen::prelude::*;

pub mod asf_decoder;
pub mod collision;
pub mod mpc_decoder;
pub mod msf_codec;
pub mod pathfinder;

/// 初始化 WASM 模块
/// 设置 panic hook 以便在控制台显示 Rust panic 信息
#[wasm_bindgen(start)]
pub fn init() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// 获取 WASM 模块版本
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Zstd 解压（暴露给 JS，用于 MMF 地图格式解压）
#[wasm_bindgen]
pub fn zstd_decompress(data: &[u8]) -> Result<Vec<u8>, JsError> {
    use ruzstd::StreamingDecoder;
    use std::io::Read;

    let mut decoder =
        StreamingDecoder::new(data).map_err(|e| JsError::new(&format!("zstd init error: {e}")))?;
    let mut result = Vec::new();
    decoder
        .read_to_end(&mut result)
        .map_err(|e| JsError::new(&format!("zstd decompress error: {e}")))?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!version().is_empty());
    }
}
