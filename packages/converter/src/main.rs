//! ASF → MSF v2 batch conversion tool
//!
//! Usage:
//!   asf2msf <input_dir> <output_dir>
//!
//! Recursively converts all .asf files to MSF v2 format.
//! MSF v2: Indexed8Alpha8 (2bpp) + zstd compression, no row filters.

use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use walkdir::WalkDir;

mod msf {
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

    /// Convert RGBA pixels to Indexed8Alpha8 (2bpp): [palette_index, alpha] per pixel.
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

    /// Convert a single ASF file to MSF v2 (Indexed8 1bpp + zstd)
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

        // Palette (BGRA → RGBA)
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

        // Frame offsets
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

        // Phase 1: Decode frames → RGBA → tight bbox
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

        // Phase 2: Convert to Indexed8Alpha8 (2bpp)
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

        // Concatenate frame data
        let mut concat_raw = Vec::new();
        for (i, data) in raw_frame_data.iter().enumerate() {
            frame_entries[i].data_offset = concat_raw.len() as u32;
            frame_entries[i].data_length = data.len() as u32;
            concat_raw.extend_from_slice(data);
        }

        let flags: u16 = 1; // bit 0: zstd
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

        // Preamble
        out.extend_from_slice(MSF_MAGIC);
        out.extend_from_slice(&MSF_VERSION.to_le_bytes());
        out.extend_from_slice(&flags.to_le_bytes());

        // Header (16 bytes)
        out.extend_from_slice(&width.to_le_bytes());
        out.extend_from_slice(&height.to_le_bytes());
        out.extend_from_slice(&frame_count.to_le_bytes());
        out.push(directions);
        out.push(fps);
        out.extend_from_slice(&left.to_le_bytes());
        out.extend_from_slice(&bottom.to_le_bytes());
        out.extend_from_slice(&[0u8; 4]);

        // Pixel format: Indexed8Alpha8 (2)
        out.push(2);
        out.extend_from_slice(&(palette.len() as u16).to_le_bytes());
        out.push(0);

        // Palette (RGBA)
        for entry in &palette {
            out.extend_from_slice(entry);
        }

        // Frame table
        for entry in &frame_entries {
            out.extend_from_slice(&entry.offset_x.to_le_bytes());
            out.extend_from_slice(&entry.offset_y.to_le_bytes());
            out.extend_from_slice(&entry.width.to_le_bytes());
            out.extend_from_slice(&entry.height.to_le_bytes());
            out.extend_from_slice(&entry.data_offset.to_le_bytes());
            out.extend_from_slice(&entry.data_length.to_le_bytes());
        }

        // End sentinel
        out.extend_from_slice(CHUNK_END);
        out.extend_from_slice(&0u32.to_le_bytes());

        // Compressed blob
        out.extend_from_slice(&compressed_blob);

        Some(out)
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: asf2msf <input_dir> <output_dir>");
        std::process::exit(1);
    }

    let input_dir = PathBuf::from(&args[1]);
    let output_dir = PathBuf::from(&args[2]);

    if !input_dir.exists() {
        eprintln!("Error: input directory {:?} does not exist", input_dir);
        std::process::exit(1);
    }

    let asf_files: Vec<PathBuf> = WalkDir::new(&input_dir)
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
    println!("Found {} ASF files (MSF v2: Indexed8Alpha8 + zstd)", total);

    let converted = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);
    let total_asf_bytes = AtomicUsize::new(0);
    let total_msf_bytes = AtomicUsize::new(0);

    asf_files.par_iter().for_each(|asf_path| {
        let relative = asf_path.strip_prefix(&input_dir).unwrap_or(asf_path);
        let mut msf_relative = relative.to_path_buf();
        msf_relative.set_extension("msf");
        let msf_path = output_dir.join(&msf_relative);

        if let Some(parent) = msf_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        match std::fs::read(asf_path) {
            Ok(asf_data) => {
                let asf_size = asf_data.len();
                match msf::convert_asf_to_msf(&asf_data) {
                    Some(msf_data) => {
                        let msf_size = msf_data.len();
                        if std::fs::write(&msf_path, &msf_data).is_ok() {
                            let n = converted.fetch_add(1, Ordering::Relaxed) + 1;
                            total_asf_bytes.fetch_add(asf_size, Ordering::Relaxed);
                            total_msf_bytes.fetch_add(msf_size, Ordering::Relaxed);
                            if n % 100 == 0 || n == total {
                                println!("  [{}/{}]", n, total);
                            }
                        } else {
                            failed.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    None => {
                        eprintln!("  CONVERT ERROR {:?}", asf_path);
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", asf_path, e);
                failed.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    let c = converted.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    let asf_mb = total_asf_bytes.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0);
    let msf_mb = total_msf_bytes.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0);
    let ratio = if asf_mb > 0.0 {
        msf_mb / asf_mb * 100.0
    } else {
        0.0
    };

    println!("\n=== Done ===");
    println!("  Converted: {}/{}", c, total);
    println!("  Failed:    {}", f);
    println!(
        "  ASF: {:.1} MB → MSF: {:.1} MB ({:.1}%)",
        asf_mb, msf_mb, ratio
    );
}
