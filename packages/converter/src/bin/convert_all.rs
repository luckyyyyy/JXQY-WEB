//! Unified resource converter - one command to convert everything
//!
//! Usage:
//!   convert-all <resources_dir> [--delete-originals]
//!
//! Performs all conversions in order:
//! 1. Text encoding: GBK → UTF-8 (.ini, .txt, .npc, .obj)
//! 2. ASF → MSF v2 (sprite animations, Indexed8Alpha8 2bpp + zstd)
//! 3. MPC → MSF v2 (map tiles, Indexed8 1bpp + zstd)
//! 4. MAP → MMF (map data, with embedded trap table, zstd)
//! 5. Media: WMV → WebM (VP9 + Opus), WMA → OGG (via ffmpeg)
//! 6. Cleanup: delete old .asf, .map, .mpc, .wmv, .wma files (if --delete-originals)
//!
//! XNB files are kept as-is (engine has native XNB parser)

use encoding_rs::GBK;
use rayon::prelude::*;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use walkdir::WalkDir;

// ============= Text Encoding Conversion =============

fn convert_encoding(resources_dir: &Path) -> (usize, usize, usize) {
    println!("\n╔══════════════════════════════════════╗");
    println!("║  Step 1: GBK → UTF-8 Encoding       ║");
    println!("╚══════════════════════════════════════╝");

    let extensions = ["ini", "txt", "npc", "obj"];
    let files: Vec<PathBuf> = WalkDir::new(resources_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| extensions.iter().any(|e2| ext.eq_ignore_ascii_case(e2)))
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect();

    let total = files.len();
    println!("Found {} text files to convert", total);

    let converted = AtomicUsize::new(0);
    let skipped = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);

    files.par_iter().for_each(|file| {
        match std::fs::read(file) {
            Ok(raw) => {
                if raw.is_empty() {
                    skipped.fetch_add(1, Ordering::Relaxed);
                    return;
                }

                // Check if already valid UTF-8
                if std::str::from_utf8(&raw).is_ok() {
                    // Check if it contains any non-ASCII that might be GBK
                    // If it's pure ASCII or already valid UTF-8, skip
                    if !raw.iter().any(|&b| b > 0x7f) {
                        skipped.fetch_add(1, Ordering::Relaxed);
                        return;
                    }
                    // It could be valid UTF-8 already (previously converted)
                    skipped.fetch_add(1, Ordering::Relaxed);
                    return;
                }

                // Decode from GBK
                let (decoded, _, had_errors) = GBK.decode(&raw);
                if had_errors {
                    // Still write it, but note the error
                    eprintln!("  WARNING: encoding errors in {:?}", file);
                }

                match std::fs::write(file, decoded.as_bytes()) {
                    Ok(_) => {
                        converted.fetch_add(1, Ordering::Relaxed);
                    }
                    Err(e) => {
                        eprintln!("  WRITE ERROR {:?}: {}", file, e);
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", file, e);
                failed.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    let c = converted.load(Ordering::Relaxed);
    let s = skipped.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    println!("  Converted: {}, Skipped: {}, Failed: {}", c, s, f);
    (c, s, f)
}

// ============= ASF → MSF Conversion =============

// Re-use the msf module from main.rs
mod asf_msf {
    pub const MSF_MAGIC: &[u8; 4] = b"MSF2";
    pub const MSF_VERSION: u16 = 2;
    pub const CHUNK_END: &[u8; 4] = b"END\0";
    const FRAME_ENTRY_SIZE: usize = 16;

    struct FrameEntry {
        offset_x: i16,
        offset_y: i16,
        width: u16,
        height: u16,
        data_offset: u32,
        data_length: u32,
    }

    fn compute_tight_bbox(pixels: &[u8], width: usize, height: usize) -> (i16, i16, u16, u16) {
        let mut min_x = width;
        let mut min_y = height;
        let mut max_x: usize = 0;
        let mut max_y: usize = 0;
        let mut has_content = false;
        for y in 0..height {
            for x in 0..width {
                let idx = (y * width + x) * 4;
                if idx + 3 < pixels.len() && pixels[idx + 3] > 0 {
                    has_content = true;
                    min_x = min_x.min(x);
                    max_x = max_x.max(x);
                    min_y = min_y.min(y);
                    max_y = max_y.max(y);
                }
            }
        }
        if !has_content {
            return (0, 0, 0, 0);
        }
        (
            min_x as i16,
            min_y as i16,
            (max_x - min_x + 1) as u16,
            (max_y - min_y + 1) as u16,
        )
    }

    fn extract_bbox_pixels(
        pixels: &[u8],
        full_width: usize,
        ox: usize,
        oy: usize,
        w: usize,
        h: usize,
    ) -> Vec<u8> {
        let mut out = Vec::with_capacity(w * h * 4);
        for y in oy..oy + h {
            let start = (y * full_width + ox) * 4;
            let end = start + w * 4;
            if end <= pixels.len() {
                out.extend_from_slice(&pixels[start..end]);
            } else {
                out.resize(out.len() + w * 4, 0);
            }
        }
        out
    }

    fn rgba_to_indexed_alpha(pixels: &[u8], palette: &[[u8; 4]]) -> Vec<u8> {
        let pixel_count = pixels.len() / 4;
        let mut data = Vec::with_capacity(pixel_count * 2);
        for i in 0..pixel_count {
            let a = pixels[i * 4 + 3];
            if a == 0 {
                data.push(0);
                data.push(0);
            } else {
                let r = pixels[i * 4];
                let g = pixels[i * 4 + 1];
                let b = pixels[i * 4 + 2];
                let mut best_idx = 0u8;
                let mut best_dist = u32::MAX;
                for (j, entry) in palette.iter().enumerate() {
                    let dr = (r as i32 - entry[0] as i32).unsigned_abs();
                    let dg = (g as i32 - entry[1] as i32).unsigned_abs();
                    let db = (b as i32 - entry[2] as i32).unsigned_abs();
                    let dist = dr + dg + db;
                    if dist < best_dist {
                        best_dist = dist;
                        best_idx = j as u8;
                        if dist == 0 {
                            break;
                        }
                    }
                }
                data.push(best_idx);
                data.push(a);
            }
        }
        data
    }

    #[inline]
    fn get_i32_le(data: &[u8], offset: usize) -> i32 {
        if offset + 4 > data.len() {
            return 0;
        }
        i32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ])
    }

    fn decode_asf_rle_frame(
        data: &[u8],
        palette: &[[u8; 4]],
        offset: usize,
        length: usize,
        width: usize,
        height: usize,
        pixels: &mut [u8],
    ) {
        let data_end = offset + length;
        let max_pixels = width * height * 4;
        let mut data_offset = offset;
        let mut pixel_idx = 0usize;
        while data_offset < data_end && data_offset + 1 < data.len() && pixel_idx < max_pixels {
            let pixel_count = data[data_offset];
            let pixel_alpha = data[data_offset + 1];
            data_offset += 2;
            for _ in 0..pixel_count {
                if pixel_idx >= max_pixels {
                    break;
                }
                if pixel_alpha == 0 {
                    pixel_idx += 4;
                } else if data_offset < data.len() {
                    let color_index = data[data_offset] as usize;
                    data_offset += 1;
                    if color_index < palette.len() {
                        pixels[pixel_idx] = palette[color_index][0];
                        pixels[pixel_idx + 1] = palette[color_index][1];
                        pixels[pixel_idx + 2] = palette[color_index][2];
                        pixels[pixel_idx + 3] = pixel_alpha;
                    }
                    pixel_idx += 4;
                }
            }
        }
    }

    pub fn convert_asf_to_msf(asf_data: &[u8]) -> Option<Vec<u8>> {
        if asf_data.len() < 80 {
            return None;
        }
        let sig = std::str::from_utf8(&asf_data[0..7]).ok()?;
        if sig != "ASF 1.0" {
            return None;
        }

        let mut offset = 16usize;
        let width = get_i32_le(asf_data, offset) as u16;
        offset += 4;
        let height = get_i32_le(asf_data, offset) as u16;
        offset += 4;
        let frame_count = get_i32_le(asf_data, offset) as u16;
        offset += 4;
        let directions = get_i32_le(asf_data, offset) as u8;
        offset += 4;
        let color_count = get_i32_le(asf_data, offset) as usize;
        offset += 4;
        let interval = get_i32_le(asf_data, offset) as u16;
        offset += 4;
        let left = get_i32_le(asf_data, offset) as i16;
        offset += 4;
        let bottom = get_i32_le(asf_data, offset) as i16;
        offset += 4;
        offset += 16; // reserved

        let fps = if interval > 0 {
            (1000u32 / interval as u32).min(255) as u8
        } else {
            15
        };

        let mut palette: Vec<[u8; 4]> = Vec::with_capacity(color_count);
        for _ in 0..color_count {
            if offset + 4 > asf_data.len() {
                break;
            }
            let b = asf_data[offset];
            let g = asf_data[offset + 1];
            let r = asf_data[offset + 2];
            offset += 4;
            palette.push([r, g, b, 255]);
        }

        let mut frame_offsets = Vec::with_capacity(frame_count as usize);
        let mut frame_lengths = Vec::with_capacity(frame_count as usize);
        for _ in 0..frame_count {
            if offset + 8 > asf_data.len() {
                break;
            }
            frame_offsets.push(get_i32_le(asf_data, offset) as usize);
            offset += 4;
            frame_lengths.push(get_i32_le(asf_data, offset) as usize);
            offset += 4;
        }

        let w = width as usize;
        let h = height as usize;

        let mut frames_rgba: Vec<(Vec<u8>, i16, i16, u16, u16)> =
            Vec::with_capacity(frame_count as usize);
        for i in 0..frame_count as usize {
            let mut pixels = vec![0u8; w * h * 4];
            if i < frame_offsets.len() {
                decode_asf_rle_frame(
                    asf_data,
                    &palette,
                    frame_offsets[i],
                    frame_lengths[i],
                    w,
                    h,
                    &mut pixels,
                );
            }
            let (ox, oy, bw, bh) = compute_tight_bbox(&pixels, w, h);
            if bw == 0 || bh == 0 {
                frames_rgba.push((Vec::new(), 0, 0, 0, 0));
            } else {
                let cropped = extract_bbox_pixels(
                    &pixels,
                    w,
                    ox as usize,
                    oy as usize,
                    bw as usize,
                    bh as usize,
                );
                frames_rgba.push((cropped, ox, oy, bw, bh));
            }
        }

        let mut frame_entries: Vec<FrameEntry> = Vec::with_capacity(frame_count as usize);
        let mut raw_frame_data: Vec<Vec<u8>> = Vec::with_capacity(frame_count as usize);
        for (pixels, ox, oy, bw, bh) in &frames_rgba {
            if *bw == 0 || *bh == 0 {
                frame_entries.push(FrameEntry {
                    offset_x: 0,
                    offset_y: 0,
                    width: 0,
                    height: 0,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(Vec::new());
            } else {
                let indexed = rgba_to_indexed_alpha(pixels, &palette);
                frame_entries.push(FrameEntry {
                    offset_x: *ox,
                    offset_y: *oy,
                    width: *bw,
                    height: *bh,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(indexed);
            }
        }

        let mut concat_raw = Vec::new();
        for (i, data) in raw_frame_data.iter().enumerate() {
            frame_entries[i].data_offset = concat_raw.len() as u32;
            frame_entries[i].data_length = data.len() as u32;
            concat_raw.extend_from_slice(data);
        }

        let flags: u16 = 1;
        let compressed_blob = zstd::bulk::compress(&concat_raw, 3).ok()?;
        let palette_bytes = palette.len() * 4;
        let frame_table_bytes = frame_count as usize * FRAME_ENTRY_SIZE;
        let end_chunk_bytes = 8;
        let total = 8
            + 16
            + 4
            + palette_bytes
            + frame_table_bytes
            + end_chunk_bytes
            + compressed_blob.len();
        let mut out = Vec::with_capacity(total);

        out.extend_from_slice(MSF_MAGIC);
        out.extend_from_slice(&MSF_VERSION.to_le_bytes());
        out.extend_from_slice(&flags.to_le_bytes());
        out.extend_from_slice(&width.to_le_bytes());
        out.extend_from_slice(&height.to_le_bytes());
        out.extend_from_slice(&frame_count.to_le_bytes());
        out.push(directions);
        out.push(fps);
        out.extend_from_slice(&left.to_le_bytes());
        out.extend_from_slice(&bottom.to_le_bytes());
        out.extend_from_slice(&[0u8; 4]);
        out.push(2);
        out.extend_from_slice(&(palette.len() as u16).to_le_bytes());
        out.push(0);
        for entry in &palette {
            out.extend_from_slice(entry);
        }
        for entry in &frame_entries {
            out.extend_from_slice(&entry.offset_x.to_le_bytes());
            out.extend_from_slice(&entry.offset_y.to_le_bytes());
            out.extend_from_slice(&entry.width.to_le_bytes());
            out.extend_from_slice(&entry.height.to_le_bytes());
            out.extend_from_slice(&entry.data_offset.to_le_bytes());
            out.extend_from_slice(&entry.data_length.to_le_bytes());
        }
        out.extend_from_slice(CHUNK_END);
        out.extend_from_slice(&0u32.to_le_bytes());
        out.extend_from_slice(&compressed_blob);
        Some(out)
    }
}

// ============= MPC → MSF Conversion =============

mod mpc_msf {
    pub const MSF_MAGIC: &[u8; 4] = b"MSF2";
    pub const MSF_VERSION: u16 = 2;
    pub const CHUNK_END: &[u8; 4] = b"END\0";
    const FRAME_ENTRY_SIZE: usize = 16;

    struct FrameEntry {
        offset_x: i16,
        offset_y: i16,
        width: u16,
        height: u16,
        data_offset: u32,
        data_length: u32,
    }

    #[inline]
    fn get_i32_le(data: &[u8], offset: usize) -> i32 {
        if offset + 4 > data.len() {
            return 0;
        }
        i32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ])
    }
    #[inline]
    fn get_u32_le(data: &[u8], offset: usize) -> u32 {
        if offset + 4 > data.len() {
            return 0;
        }
        u32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ])
    }

    fn decode_mpc_rle_to_indexed(
        data: &[u8],
        rle_start: usize,
        rle_end: usize,
        width: usize,
        height: usize,
        transparent_idx: u8,
    ) -> Vec<u8> {
        let total = width * height;
        let mut buf = vec![transparent_idx; total];
        let mut data_offset = rle_start;
        let mut pixel_idx = 0usize;
        while data_offset < rle_end && data_offset < data.len() && pixel_idx < total {
            let byte = data[data_offset];
            data_offset += 1;
            if byte > 0x80 {
                pixel_idx += (byte - 0x80) as usize;
            } else {
                let count = byte as usize;
                for _ in 0..count {
                    if pixel_idx >= total || data_offset >= data.len() {
                        break;
                    }
                    buf[pixel_idx] = data[data_offset];
                    data_offset += 1;
                    pixel_idx += 1;
                }
            }
        }
        buf
    }

    fn find_transparent_index_mpc(
        mpc_data: &[u8],
        frame_data_start: usize,
        data_offsets: &[usize],
    ) -> u8 {
        let mut used = [false; 256];
        for &off in data_offsets {
            let ds = frame_data_start + off;
            if ds + 12 > mpc_data.len() {
                continue;
            }
            let data_len = get_u32_le(mpc_data, ds) as usize;
            let width = get_u32_le(mpc_data, ds + 4) as usize;
            let height = get_u32_le(mpc_data, ds + 8) as usize;
            if width == 0 || height == 0 || width > 2048 || height > 2048 {
                continue;
            }
            let rle_start = ds + 20;
            let rle_end = ds + data_len;
            let total = width * height;
            let mut data_offset = rle_start;
            let mut pixel_idx = 0usize;
            while data_offset < rle_end && data_offset < mpc_data.len() && pixel_idx < total {
                let byte = mpc_data[data_offset];
                data_offset += 1;
                if byte > 0x80 {
                    pixel_idx += (byte - 0x80) as usize;
                } else {
                    let count = byte as usize;
                    for _ in 0..count {
                        if pixel_idx >= total || data_offset >= mpc_data.len() {
                            break;
                        }
                        used[mpc_data[data_offset] as usize] = true;
                        data_offset += 1;
                        pixel_idx += 1;
                    }
                }
            }
        }
        for i in 0..256u16 {
            if !used[i as usize] {
                return i as u8;
            }
        }
        0
    }

    pub fn convert_mpc_to_msf(mpc_data: &[u8]) -> Option<Vec<u8>> {
        if mpc_data.len() < 160 {
            return None;
        }
        let sig = std::str::from_utf8(&mpc_data[0..12]).ok()?;
        if !sig.starts_with("MPC File Ver") {
            return None;
        }

        let off = 64;
        let global_width = get_u32_le(mpc_data, off + 4) as u16;
        let global_height = get_u32_le(mpc_data, off + 8) as u16;
        let frame_count = get_u32_le(mpc_data, off + 12) as u16;
        let direction = get_u32_le(mpc_data, off + 16) as u8;
        let color_count = get_u32_le(mpc_data, off + 20) as usize;
        let interval = get_u32_le(mpc_data, off + 24) as u16;
        let raw_bottom = get_i32_le(mpc_data, off + 28);

        let left = (global_width / 2) as i16;
        let bottom = if global_height >= 16 {
            (global_height as i32 - 16 - raw_bottom) as i16
        } else {
            (16 - global_height as i32 - raw_bottom) as i16
        };
        let fps = if interval > 0 {
            (1000u32 / interval as u32).min(255) as u8
        } else {
            15
        };

        let palette_start = 128;
        let mut palette: Vec<[u8; 4]> = Vec::with_capacity(color_count);
        for i in 0..color_count {
            let po = palette_start + i * 4;
            if po + 4 > mpc_data.len() {
                break;
            }
            palette.push([mpc_data[po + 2], mpc_data[po + 1], mpc_data[po], 255]);
        }

        let offsets_start = palette_start + color_count * 4;
        let mut data_offsets: Vec<usize> = Vec::with_capacity(frame_count as usize);
        for i in 0..frame_count as usize {
            let o = offsets_start + i * 4;
            if o + 4 > mpc_data.len() {
                break;
            }
            data_offsets.push(get_u32_le(mpc_data, o) as usize);
        }

        let frame_data_start = offsets_start + frame_count as usize * 4;
        let transparent_idx = find_transparent_index_mpc(mpc_data, frame_data_start, &data_offsets);
        if (transparent_idx as usize) < palette.len() {
            palette[transparent_idx as usize][3] = 0;
        } else {
            while palette.len() <= transparent_idx as usize {
                palette.push([0, 0, 0, 255]);
            }
            palette[transparent_idx as usize] = [0, 0, 0, 0];
        }

        let mut frame_entries: Vec<FrameEntry> = Vec::with_capacity(frame_count as usize);
        let mut raw_frame_data: Vec<Vec<u8>> = Vec::with_capacity(frame_count as usize);
        for i in 0..frame_count as usize {
            if i >= data_offsets.len() {
                frame_entries.push(FrameEntry {
                    offset_x: 0,
                    offset_y: 0,
                    width: 0,
                    height: 0,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(Vec::new());
                continue;
            }
            let ds = frame_data_start + data_offsets[i];
            if ds + 12 > mpc_data.len() {
                frame_entries.push(FrameEntry {
                    offset_x: 0,
                    offset_y: 0,
                    width: 0,
                    height: 0,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(Vec::new());
                continue;
            }
            let data_len = get_u32_le(mpc_data, ds) as usize;
            let width = get_u32_le(mpc_data, ds + 4) as u16;
            let height = get_u32_le(mpc_data, ds + 8) as u16;
            if width == 0 || height == 0 || width > 2048 || height > 2048 {
                frame_entries.push(FrameEntry {
                    offset_x: 0,
                    offset_y: 0,
                    width: 0,
                    height: 0,
                    data_offset: 0,
                    data_length: 0,
                });
                raw_frame_data.push(Vec::new());
                continue;
            }
            let rle_start = ds + 20;
            let rle_end = ds + data_len;
            let indexed = decode_mpc_rle_to_indexed(
                mpc_data,
                rle_start,
                rle_end,
                width as usize,
                height as usize,
                transparent_idx,
            );
            frame_entries.push(FrameEntry {
                offset_x: 0,
                offset_y: 0,
                width,
                height,
                data_offset: 0,
                data_length: 0,
            });
            raw_frame_data.push(indexed);
        }

        let mut concat_raw = Vec::new();
        for (i, data) in raw_frame_data.iter().enumerate() {
            frame_entries[i].data_offset = concat_raw.len() as u32;
            frame_entries[i].data_length = data.len() as u32;
            concat_raw.extend_from_slice(data);
        }

        let flags: u16 = 1;
        let compressed_blob = zstd::bulk::compress(&concat_raw, 3).ok()?;
        let palette_bytes = palette.len() * 4;
        let frame_table_bytes = frame_count as usize * FRAME_ENTRY_SIZE;
        let total = 8 + 16 + 4 + palette_bytes + frame_table_bytes + 8 + compressed_blob.len();
        let mut out = Vec::with_capacity(total);

        out.extend_from_slice(MSF_MAGIC);
        out.extend_from_slice(&MSF_VERSION.to_le_bytes());
        out.extend_from_slice(&flags.to_le_bytes());
        out.extend_from_slice(&global_width.to_le_bytes());
        out.extend_from_slice(&global_height.to_le_bytes());
        out.extend_from_slice(&frame_count.to_le_bytes());
        out.push(direction);
        out.push(fps);
        out.extend_from_slice(&left.to_le_bytes());
        out.extend_from_slice(&bottom.to_le_bytes());
        out.extend_from_slice(&[0u8; 4]);
        out.push(1);
        out.extend_from_slice(&(palette.len() as u16).to_le_bytes());
        out.push(0);
        for entry in &palette {
            out.extend_from_slice(entry);
        }
        for entry in &frame_entries {
            out.extend_from_slice(&entry.offset_x.to_le_bytes());
            out.extend_from_slice(&entry.offset_y.to_le_bytes());
            out.extend_from_slice(&entry.width.to_le_bytes());
            out.extend_from_slice(&entry.height.to_le_bytes());
            out.extend_from_slice(&entry.data_offset.to_le_bytes());
            out.extend_from_slice(&entry.data_length.to_le_bytes());
        }
        out.extend_from_slice(CHUNK_END);
        out.extend_from_slice(&0u32.to_le_bytes());
        out.extend_from_slice(&compressed_blob);
        Some(out)
    }
}

// ============= MAP → MMF Conversion =============

mod map_mmf {
    use super::*;

    struct MapTile {
        l1_frame: u8,
        l1_mpc: u8,
        l2_frame: u8,
        l2_mpc: u8,
        l3_frame: u8,
        l3_mpc: u8,
        barrier: u8,
        trap: u8,
    }

    struct OldMapData {
        columns: u16,
        rows: u16,
        mpc_names: Vec<Option<String>>,
        mpc_looping: Vec<bool>,
        tiles: Vec<MapTile>,
    }

    fn get_i32_le(data: &[u8], offset: usize) -> i32 {
        if offset + 4 > data.len() {
            return 0;
        }
        i32::from_le_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ])
    }

    fn read_gbk_string(data: &[u8], offset: usize, max_len: usize) -> String {
        let end = offset + max_len;
        if end > data.len() {
            return String::new();
        }
        let mut len = 0;
        while len < max_len && data[offset + len] != 0 {
            len += 1;
        }
        if len == 0 {
            return String::new();
        }
        let (decoded, _, _) = GBK.decode(&data[offset..offset + len]);
        decoded.into_owned()
    }

    fn parse_old_map(data: &[u8]) -> Option<OldMapData> {
        if data.len() < 16512 {
            return None;
        }
        let header = std::str::from_utf8(&data[0..12]).ok()?;
        if header != "MAP File Ver" {
            return None;
        }

        let columns = get_i32_le(data, 68) as u16;
        let rows = get_i32_le(data, 72) as u16;

        let mut mpc_names: Vec<Option<String>> = Vec::with_capacity(255);
        let mut mpc_looping: Vec<bool> = Vec::with_capacity(255);
        for k in 0..255 {
            let offset = 192 + k * 64;
            let name = read_gbk_string(data, offset, 32);
            if name.is_empty() {
                mpc_names.push(None);
                mpc_looping.push(false);
            } else {
                mpc_names.push(Some(name));
                mpc_looping.push(data[offset + 36] == 1);
            }
        }

        let total_tiles = columns as usize * rows as usize;
        let mut tiles = Vec::with_capacity(total_tiles);
        let mut offset = 16512;
        for _ in 0..total_tiles {
            if offset + 10 > data.len() {
                break;
            }
            tiles.push(MapTile {
                l1_frame: data[offset],
                l1_mpc: data[offset + 1],
                l2_frame: data[offset + 2],
                l2_mpc: data[offset + 3],
                l3_frame: data[offset + 4],
                l3_mpc: data[offset + 5],
                barrier: data[offset + 6],
                trap: data[offset + 7],
            });
            offset += 10;
        }

        Some(OldMapData {
            columns,
            rows,
            mpc_names,
            mpc_looping,
            tiles,
        })
    }

    pub struct TrapEntry {
        pub trap_index: u8,
        pub script_path: String,
    }

    struct MsfEntry {
        name: String,
        looping: bool,
    }

    fn convert_map_to_mmf(map_data: &OldMapData, trap_entries: &[TrapEntry]) -> Vec<u8> {
        let mut old_to_new: HashMap<u8, u8> = HashMap::new();
        let mut msf_entries: Vec<MsfEntry> = Vec::new();
        let mut new_idx: u8 = 1;

        for (old_idx, name_opt) in map_data.mpc_names.iter().enumerate() {
            if let Some(name) = name_opt {
                old_to_new.insert(old_idx as u8, new_idx);
                let msf_name = if name.to_lowercase().ends_with(".mpc") {
                    format!("{}.msf", &name[..name.len() - 4])
                } else {
                    name.clone()
                };
                msf_entries.push(MsfEntry {
                    name: msf_name,
                    looping: map_data.mpc_looping[old_idx],
                });
                new_idx += 1;
            }
        }

        let msf_count = msf_entries.len() as u16;
        let trap_count = trap_entries.len() as u16;
        let total_tiles = map_data.columns as usize * map_data.rows as usize;

        let mut flags: u16 = 0x01;
        if trap_count > 0 {
            flags |= 0x02;
        }

        let mut out = Vec::with_capacity(64 * 1024);

        // Preamble
        out.extend_from_slice(b"MMF1");
        out.extend_from_slice(&1u16.to_le_bytes());
        out.extend_from_slice(&flags.to_le_bytes());

        // Header
        out.extend_from_slice(&map_data.columns.to_le_bytes());
        out.extend_from_slice(&map_data.rows.to_le_bytes());
        out.extend_from_slice(&msf_count.to_le_bytes());
        out.extend_from_slice(&trap_count.to_le_bytes());
        out.extend_from_slice(&0u32.to_le_bytes());

        // MSF Table
        for entry in &msf_entries {
            let name_bytes = entry.name.as_bytes();
            out.push(name_bytes.len() as u8);
            out.extend_from_slice(name_bytes);
            out.push(if entry.looping { 1 } else { 0 });
        }

        // Trap Table
        if flags & 0x02 != 0 {
            for trap in trap_entries {
                out.push(trap.trap_index);
                let path_bytes = trap.script_path.as_bytes();
                out.extend_from_slice(&(path_bytes.len() as u16).to_le_bytes());
                out.extend_from_slice(path_bytes);
            }
        }

        // End sentinel
        out.extend_from_slice(b"END\0");
        out.extend_from_slice(&0u32.to_le_bytes());

        // Tile blob
        let mut blob = Vec::with_capacity(total_tiles * 8);

        // Layer 1
        for tile in &map_data.tiles {
            let new_msf = if tile.l1_mpc == 0 {
                0
            } else {
                *old_to_new.get(&(tile.l1_mpc - 1)).unwrap_or(&0)
            };
            blob.push(new_msf);
            blob.push(tile.l1_frame);
        }
        // Layer 2
        for tile in &map_data.tiles {
            let new_msf = if tile.l2_mpc == 0 {
                0
            } else {
                *old_to_new.get(&(tile.l2_mpc - 1)).unwrap_or(&0)
            };
            blob.push(new_msf);
            blob.push(tile.l2_frame);
        }
        // Layer 3
        for tile in &map_data.tiles {
            let new_msf = if tile.l3_mpc == 0 {
                0
            } else {
                *old_to_new.get(&(tile.l3_mpc - 1)).unwrap_or(&0)
            };
            blob.push(new_msf);
            blob.push(tile.l3_frame);
        }
        // Barriers
        for tile in &map_data.tiles {
            blob.push(tile.barrier);
        }
        // Traps
        for tile in &map_data.tiles {
            blob.push(tile.trap);
        }

        let compressed = zstd::bulk::compress(&blob, 3).expect("zstd compression failed");
        out.extend_from_slice(&compressed);
        out
    }

    pub fn parse_traps_ini(content: &str) -> HashMap<String, HashMap<u8, String>> {
        let mut result: HashMap<String, HashMap<u8, String>> = HashMap::new();
        let mut current_section: Option<String> = None;
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
                continue;
            }
            if line.starts_with('[') && line.ends_with(']') {
                current_section = Some(line[1..line.len() - 1].to_string());
                continue;
            }
            if let Some(ref section) = current_section {
                if let Some((key, value)) = line.split_once('=') {
                    if let Ok(idx) = key.trim().parse::<u8>() {
                        result
                            .entry(section.clone())
                            .or_default()
                            .insert(idx, value.trim().to_string());
                    }
                }
            }
        }
        result
    }

    pub fn convert_all_maps(
        resources_dir: &Path,
        all_traps: &HashMap<String, HashMap<u8, String>>,
    ) -> (usize, usize) {
        let map_dir = resources_dir.join("map");
        if !map_dir.exists() {
            println!("  No map directory found, skipping");
            return (0, 0);
        }

        let map_files: Vec<PathBuf> = WalkDir::new(&map_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("map"))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect();

        let total = map_files.len();
        println!("Found {} MAP files", total);

        let converted = AtomicUsize::new(0);
        let failed = AtomicUsize::new(0);

        map_files.par_iter().for_each(|map_path| {
            let map_name = map_path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            let trap_entries: Vec<TrapEntry> = all_traps
                .get(map_name)
                .map(|traps| {
                    traps
                        .iter()
                        .map(|(&idx, path)| TrapEntry {
                            trap_index: idx,
                            script_path: path.clone(),
                        })
                        .collect()
                })
                .unwrap_or_default();

            match std::fs::read(map_path) {
                Ok(raw) => match parse_old_map(&raw) {
                    Some(map_data) => {
                        let mmf_data = convert_map_to_mmf(&map_data, &trap_entries);
                        let mut mmf_path = map_path.clone();
                        mmf_path.set_extension("mmf");
                        if std::fs::write(&mmf_path, &mmf_data).is_ok() {
                            converted.fetch_add(1, Ordering::Relaxed);
                        } else {
                            failed.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    None => {
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                },
                Err(_) => {
                    failed.fetch_add(1, Ordering::Relaxed);
                }
            }
        });

        (
            converted.load(Ordering::Relaxed),
            failed.load(Ordering::Relaxed),
        )
    }
}

// ============= ASF/MPC batch conversion helpers =============

fn convert_asf_files(resources_dir: &Path) -> (usize, usize) {
    let asf_dir = resources_dir.join("asf");
    if !asf_dir.exists() {
        println!("  No asf directory found, skipping");
        return (0, 0);
    }

    let asf_files: Vec<PathBuf> = WalkDir::new(&asf_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("asf"))
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect();

    let total = asf_files.len();
    println!("Found {} ASF files", total);

    let converted = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);

    asf_files
        .par_iter()
        .for_each(|asf_path| match std::fs::read(asf_path) {
            Ok(asf_data) => match asf_msf::convert_asf_to_msf(&asf_data) {
                Some(msf_data) => {
                    let mut msf_path = asf_path.clone();
                    msf_path.set_extension("msf");
                    if std::fs::write(&msf_path, &msf_data).is_ok() {
                        let n = converted.fetch_add(1, Ordering::Relaxed) + 1;
                        if n % 200 == 0 || n == total {
                            println!("  [{}/{}]", n, total);
                        }
                    } else {
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                }
                None => {
                    failed.fetch_add(1, Ordering::Relaxed);
                }
            },
            Err(_) => {
                failed.fetch_add(1, Ordering::Relaxed);
            }
        });

    (
        converted.load(Ordering::Relaxed),
        failed.load(Ordering::Relaxed),
    )
}

fn convert_mpc_files(resources_dir: &Path) -> (usize, usize) {
    let mpc_dir = resources_dir.join("mpc");
    if !mpc_dir.exists() {
        println!("  No mpc directory found, skipping");
        return (0, 0);
    }

    let mpc_files: Vec<PathBuf> = WalkDir::new(&mpc_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("mpc"))
                .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect();

    let total = mpc_files.len();
    println!("Found {} MPC files", total);

    let converted = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);

    mpc_files
        .par_iter()
        .for_each(|mpc_path| match std::fs::read(mpc_path) {
            Ok(mpc_data) => match mpc_msf::convert_mpc_to_msf(&mpc_data) {
                Some(msf_data) => {
                    let mut msf_path = mpc_path.clone();
                    msf_path.set_extension("msf");
                    if std::fs::write(&msf_path, &msf_data).is_ok() {
                        let n = converted.fetch_add(1, Ordering::Relaxed) + 1;
                        if n % 100 == 0 || n == total {
                            println!("  [{}/{}]", n, total);
                        }
                    } else {
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                }
                None => {
                    failed.fetch_add(1, Ordering::Relaxed);
                }
            },
            Err(_) => {
                failed.fetch_add(1, Ordering::Relaxed);
            }
        });

    (
        converted.load(Ordering::Relaxed),
        failed.load(Ordering::Relaxed),
    )
}

// ============= Media conversion (ffmpeg) =============

fn convert_media_files(resources_dir: &Path) -> (usize, usize, usize) {
    let mut video_ok = 0usize;
    let mut music_ok = 0usize;
    let mut failed = 0usize;

    // Video: WMV → WebM
    let content_dir = resources_dir.join("Content");
    let video_dir = content_dir.join("video");
    if video_dir.exists() {
        println!("Converting videos (WMV → WebM)...");
        let wmv_files: Vec<PathBuf> = std::fs::read_dir(&video_dir)
            .into_iter()
            .flatten()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("wmv"))
                    .unwrap_or(false)
            })
            .map(|e| e.path())
            .collect();

        for wmv in &wmv_files {
            let webm = wmv.with_extension("webm");
            if webm.exists() {
                println!("  [skip] {:?} already exists", webm.file_name().unwrap());
                continue;
            }
            println!("  Converting {:?}...", wmv.file_name().unwrap());
            let result = std::process::Command::new("ffmpeg")
                .args(["-y", "-i"])
                .arg(wmv)
                .args([
                    "-c:v",
                    "libvpx-vp9",
                    "-crf",
                    "30",
                    "-b:v",
                    "0",
                    "-c:a",
                    "libopus",
                    "-b:a",
                    "128k",
                ])
                .arg(&webm)
                .args(["-loglevel", "warning"])
                .status();
            match result {
                Ok(status) if status.success() => {
                    video_ok += 1;
                    println!("  [done] {:?}", webm.file_name().unwrap());
                }
                _ => {
                    failed += 1;
                    eprintln!("  [fail] {:?}", wmv.file_name().unwrap());
                }
            }
        }
    }

    // Music: WMA → OGG
    let music_dir = content_dir.join("music");
    if music_dir.exists() {
        println!("Converting music (WMA → OGG)...");
        let wma_files: Vec<PathBuf> = std::fs::read_dir(&music_dir)
            .into_iter()
            .flatten()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("wma"))
                    .unwrap_or(false)
            })
            .map(|e| e.path())
            .collect();

        for wma in &wma_files {
            let ogg = wma.with_extension("ogg");
            if ogg.exists() {
                continue;
            }
            println!("  Converting {:?}...", wma.file_name().unwrap());
            let result = std::process::Command::new("ffmpeg")
                .args(["-y", "-i"])
                .arg(wma)
                .args(["-acodec", "libvorbis", "-q:a", "6"])
                .arg(&ogg)
                .args(["-loglevel", "warning"])
                .status();
            match result {
                Ok(status) if status.success() => {
                    music_ok += 1;
                }
                _ => {
                    failed += 1;
                }
            }
        }
    }

    (video_ok, music_ok, failed)
}

// ============= Cleanup =============

fn delete_old_files(resources_dir: &Path) -> (usize, usize, usize) {
    let mut asf_deleted = 0usize;
    let mut mpc_deleted = 0usize;
    let mut map_deleted = 0usize;

    // Delete .asf files (replaced by .msf)
    let asf_dir = resources_dir.join("asf");
    if asf_dir.exists() {
        let asf_files: Vec<PathBuf> = WalkDir::new(&asf_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("asf"))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect();
        for f in &asf_files {
            // Only delete if corresponding .msf exists
            let msf = f.with_extension("msf");
            if msf.exists() {
                if std::fs::remove_file(f).is_ok() {
                    asf_deleted += 1;
                }
            }
        }
    }

    // Delete .mpc files (replaced by .msf)
    let mpc_dir = resources_dir.join("mpc");
    if mpc_dir.exists() {
        let mpc_files: Vec<PathBuf> = WalkDir::new(&mpc_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("mpc"))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect();
        for f in &mpc_files {
            let msf = f.with_extension("msf");
            if msf.exists() {
                if std::fs::remove_file(f).is_ok() {
                    mpc_deleted += 1;
                }
            }
        }
    }

    // Delete .map files (replaced by .mmf)
    let map_dir = resources_dir.join("map");
    if map_dir.exists() {
        let map_files: Vec<PathBuf> = WalkDir::new(&map_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("map"))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect();
        for f in &map_files {
            let mmf = f.with_extension("mmf");
            if mmf.exists() {
                if std::fs::remove_file(f).is_ok() {
                    map_deleted += 1;
                }
            }
        }
    }

    // Delete .wmv files (replaced by .webm)
    let video_dir = resources_dir.join("content/video");
    if video_dir.exists() {
        let wmv_files: Vec<PathBuf> = std::fs::read_dir(&video_dir)
            .into_iter()
            .flatten()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("wmv"))
                    .unwrap_or(false)
            })
            .map(|e| e.path())
            .collect();
        for f in &wmv_files {
            let webm = f.with_extension("webm");
            if webm.exists() {
                let _ = std::fs::remove_file(f);
            }
        }
    }

    // Delete .wma files (replaced by .ogg)
    let music_dir = resources_dir.join("content/music");
    if music_dir.exists() {
        let wma_files: Vec<PathBuf> = std::fs::read_dir(&music_dir)
            .into_iter()
            .flatten()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("wma"))
                    .unwrap_or(false)
            })
            .map(|e| e.path())
            .collect();
        for f in &wma_files {
            let ogg = f.with_extension("ogg");
            if ogg.exists() {
                let _ = std::fs::remove_file(f);
            }
        }
    }

    (asf_deleted, mpc_deleted, map_deleted)
}

// ============= Main =============

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: convert-all <resources_dir> [--delete-originals]");
        eprintln!();
        eprintln!("All-in-one resource converter for Miu2D Engine.");
        eprintln!("Converts ASF/MPC→MSF, MAP→MMF, GBK→UTF-8, WMV→WebM, WMA→OGG.");
        eprintln!();
        eprintln!("Options:");
        eprintln!(
            "  --delete-originals  Delete old .asf, .mpc, .map, .wmv, .wma files after conversion"
        );
        std::process::exit(1);
    }

    let resources_dir = PathBuf::from(&args[1]);
    let delete_originals = args.iter().any(|a| a == "--delete-originals");

    if !resources_dir.exists() {
        eprintln!("Error: directory {:?} does not exist", resources_dir);
        std::process::exit(1);
    }

    println!("╔══════════════════════════════════════════╗");
    println!("║  Miu2D All-in-One Resource Converter     ║");
    println!("╠══════════════════════════════════════════╣");
    println!("║  Resources: {:?}", resources_dir);
    println!("║  Delete originals: {}", delete_originals);
    println!("╚══════════════════════════════════════════╝");

    // Step 1: Encoding conversion
    let (enc_ok, enc_skip, enc_fail) = convert_encoding(&resources_dir);

    // Step 2: ASF → MSF
    println!("\n╔══════════════════════════════════════╗");
    println!("║  Step 2: ASF → MSF v2                ║");
    println!("╚══════════════════════════════════════╝");
    let (asf_ok, asf_fail) = convert_asf_files(&resources_dir);
    println!("  Converted: {}, Failed: {}", asf_ok, asf_fail);

    // Step 3: MPC → MSF
    println!("\n╔══════════════════════════════════════╗");
    println!("║  Step 3: MPC → MSF v2                ║");
    println!("╚══════════════════════════════════════╝");
    let (mpc_ok, mpc_fail) = convert_mpc_files(&resources_dir);
    println!("  Converted: {}, Failed: {}", mpc_ok, mpc_fail);

    // Step 4: MAP → MMF
    println!("\n╔══════════════════════════════════════╗");
    println!("║  Step 4: MAP → MMF                    ║");
    println!("╚══════════════════════════════════════╝");

    // Load traps.ini
    let traps_path = resources_dir.join("save/game/Traps.ini");
    let all_traps = if traps_path.exists() {
        let raw = std::fs::read(&traps_path).expect("Failed to read Traps.ini");
        let content = match std::str::from_utf8(&raw) {
            Ok(s) => s.to_string(),
            Err(_) => {
                let (decoded, _, _) = GBK.decode(&raw);
                decoded.into_owned()
            }
        };
        map_mmf::parse_traps_ini(&content)
    } else {
        println!("  Warning: Traps.ini not found at {:?}", traps_path);
        HashMap::new()
    };
    println!("  Loaded trap definitions for {} maps", all_traps.len());

    let (map_ok, map_fail) = map_mmf::convert_all_maps(&resources_dir, &all_traps);
    println!("  Converted: {}, Failed: {}", map_ok, map_fail);

    // Step 5: Media conversion
    println!("\n╔══════════════════════════════════════╗");
    println!("║  Step 5: Media (WMV→WebM, WMA→OGG)  ║");
    println!("╚══════════════════════════════════════╝");
    let (vid_ok, mus_ok, media_fail) = convert_media_files(&resources_dir);
    println!(
        "  Videos: {}, Music: {}, Failed: {}",
        vid_ok, mus_ok, media_fail
    );

    // Step 6: Cleanup
    if delete_originals {
        println!("\n╔══════════════════════════════════════╗");
        println!("║  Step 6: Cleanup (delete originals)  ║");
        println!("╚══════════════════════════════════════╝");
        let (asf_del, mpc_del, map_del) = delete_old_files(&resources_dir);
        println!(
            "  Deleted: {} ASF, {} MPC, {} MAP files",
            asf_del, mpc_del, map_del
        );
    }

    // Summary
    let total_fail = enc_fail + asf_fail + mpc_fail + map_fail + media_fail;
    println!("\n╔══════════════════════════════════════════╗");
    println!("║  Summary                                ║");
    println!("╠══════════════════════════════════════════╣");
    println!(
        "║  Encoding: {} converted, {} skipped      ",
        enc_ok, enc_skip
    );
    println!("║  ASF→MSF:  {} converted                  ", asf_ok);
    println!("║  MPC→MSF:  {} converted                  ", mpc_ok);
    println!("║  MAP→MMF:  {} converted                  ", map_ok);
    println!("║  Video:    {} converted                  ", vid_ok);
    println!("║  Music:    {} converted                  ", mus_ok);
    println!("║  Total failures: {}                      ", total_fail);
    println!("╚══════════════════════════════════════════╝");

    if total_fail > 0 {
        std::process::exit(1);
    }
}
