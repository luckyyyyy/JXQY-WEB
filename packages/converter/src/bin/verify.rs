//! ASF ↔ MSF v2 pixel-perfect verification tool
//!
//! Usage: cargo run --release --bin verify <asf_dir>
//!
//! For each .asf file, finds the corresponding .msf file and verifies
//! that decoding both produces identical RGBA pixel data.

use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use walkdir::WalkDir;



// ============================================================================
// ASF decoder
// ============================================================================

#[inline]
fn get_i32_le(data: &[u8], offset: usize) -> i32 {
    if offset + 4 > data.len() {
        return 0;
    }
    i32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
}

struct AsfInfo {
    width: usize,
    height: usize,
    frame_count: usize,
    palette: Vec<[u8; 4]>,
    frame_offsets: Vec<usize>,
    frame_lengths: Vec<usize>,
}

fn parse_asf(data: &[u8]) -> Option<AsfInfo> {
    if data.len() < 80 {
        return None;
    }
    let sig = std::str::from_utf8(&data[0..7]).ok()?;
    if sig != "ASF 1.0" {
        return None;
    }

    let mut offset = 16usize;
    let width = get_i32_le(data, offset) as u16 as usize;
    offset += 4;
    let height = get_i32_le(data, offset) as u16 as usize;
    offset += 4;
    let frame_count = get_i32_le(data, offset) as u16 as usize;
    offset += 4;
    let _directions = get_i32_le(data, offset);
    offset += 4;
    let color_count = get_i32_le(data, offset) as usize;
    offset += 4;
    offset += 4; // interval
    offset += 4; // left
    offset += 4; // bottom
    offset += 16; // reserved

    let mut palette = Vec::with_capacity(color_count);
    for _ in 0..color_count {
        if offset + 4 > data.len() {
            break;
        }
        let b = data[offset];
        let g = data[offset + 1];
        let r = data[offset + 2];
        offset += 4;
        palette.push([r, g, b, 255]);
    }

    let mut frame_offsets = Vec::with_capacity(frame_count);
    let mut frame_lengths = Vec::with_capacity(frame_count);
    for _ in 0..frame_count {
        if offset + 8 > data.len() {
            break;
        }
        frame_offsets.push(get_i32_le(data, offset) as usize);
        offset += 4;
        frame_lengths.push(get_i32_le(data, offset) as usize);
        offset += 4;
    }

    Some(AsfInfo {
        width,
        height,
        frame_count,
        palette,
        frame_offsets,
        frame_lengths,
    })
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

/// Decode all ASF frames to canvas-size RGBA
fn decode_asf_to_rgba(data: &[u8]) -> Option<(usize, usize, usize, Vec<Vec<u8>>)> {
    let info = parse_asf(data)?;
    let w = info.width;
    let h = info.height;
    let mut frames = Vec::with_capacity(info.frame_count);

    for i in 0..info.frame_count {
        let mut pixels = vec![0u8; w * h * 4];
        decode_asf_rle_frame(
            data,
            &info.palette,
            info.frame_offsets[i],
            info.frame_lengths[i],
            w,
            h,
            &mut pixels,
        );
        frames.push(pixels);
    }

    Some((w, h, info.frame_count, frames))
}

// ============================================================================
// MSF v2 decoder
// ============================================================================

struct MsfFrame {
    offset_x: i16,
    offset_y: i16,
    width: u16,
    height: u16,
    data_offset: u32,
    data_length: u32,
}

fn decode_msf_to_rgba(data: &[u8]) -> Option<(usize, usize, usize, Vec<Vec<u8>>)> {
    if data.len() < 28 || &data[0..4] != b"MSF2" {
        return None;
    }

    let flags = u16::from_le_bytes([data[6], data[7]]);
    let off = 8;
    let canvas_w = u16::from_le_bytes([data[off], data[off + 1]]) as usize;
    let canvas_h = u16::from_le_bytes([data[off + 2], data[off + 3]]) as usize;
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]) as usize;

    let pf_off = 24;
    let pixel_format = data[pf_off];
    let palette_size = u16::from_le_bytes([data[pf_off + 1], data[pf_off + 2]]) as usize;

    if pixel_format != 2 {
        // Only Indexed8Alpha8 expected for ASF
        return None;
    }
    let bpp = 2usize;

    // Read palette
    let mut palette = [[0u8; 4]; 256];
    let palette_start = 28;
    for i in 0..palette_size.min(256) {
        let po = palette_start + i * 4;
        if po + 4 > data.len() {
            break;
        }
        palette[i] = [data[po], data[po + 1], data[po + 2], data[po + 3]];
    }

    // Frame table
    let frame_table_start = palette_start + palette_size * 4;
    if frame_table_start + frame_count * 16 > data.len() {
        return None;
    }

    let mut frame_entries = Vec::with_capacity(frame_count);
    let mut ft_off = frame_table_start;
    for _ in 0..frame_count {
        frame_entries.push(MsfFrame {
            offset_x: i16::from_le_bytes([data[ft_off], data[ft_off + 1]]),
            offset_y: i16::from_le_bytes([data[ft_off + 2], data[ft_off + 3]]),
            width: u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]),
            height: u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]),
            data_offset: u32::from_le_bytes([data[ft_off + 8], data[ft_off + 9], data[ft_off + 10], data[ft_off + 11]]),
            data_length: u32::from_le_bytes([data[ft_off + 12], data[ft_off + 13], data[ft_off + 14], data[ft_off + 15]]),
        });
        ft_off += 16;
    }

    // Skip extension chunks
    let mut ext_off = ft_off;
    loop {
        if ext_off + 8 > data.len() {
            return None;
        }
        let chunk_id = &data[ext_off..ext_off + 4];
        let chunk_len = u32::from_le_bytes([data[ext_off + 4], data[ext_off + 5], data[ext_off + 6], data[ext_off + 7]]) as usize;
        ext_off += 8;
        if chunk_id == b"END\0" {
            break;
        }
        ext_off += chunk_len;
    }

    // Decompress blob
    let is_compressed = (flags & 1) != 0;
    let decompressed: Vec<u8>;
    let blob: &[u8] = if is_compressed {
        decompressed = zstd::bulk::decompress(&data[ext_off..], 256 * 1024 * 1024).ok()?;
        &decompressed
    } else {
        &data[ext_off..]
    };

    // Decode each frame to canvas-size RGBA
    let mut frames = Vec::with_capacity(frame_count);
    for entry in &frame_entries {
        let mut pixels = vec![0u8; canvas_w * canvas_h * 4];
        let fw = entry.width as usize;
        let fh = entry.height as usize;
        let ox = entry.offset_x as usize;
        let oy = entry.offset_y as usize;

        if fw > 0 && fh > 0 {
            let blob_off = entry.data_offset as usize;
            let blob_len = entry.data_length as usize;
            if blob_off + blob_len <= blob.len() {
                let raw = &blob[blob_off..blob_off + blob_len];

                for y in 0..fh {
                    for x in 0..fw {
                        let src = (y * fw + x) * bpp;
                        if src + 1 >= raw.len() {
                            continue;
                        }
                        let color_idx = raw[src] as usize;
                        let alpha = raw[src + 1];
                        if alpha == 0 {
                            continue;
                        }
                        let dst = ((oy + y) * canvas_w + ox + x) * 4;
                        if dst + 4 <= pixels.len() && color_idx < 256 {
                            pixels[dst] = palette[color_idx][0];
                            pixels[dst + 1] = palette[color_idx][1];
                            pixels[dst + 2] = palette[color_idx][2];
                            pixels[dst + 3] = alpha;
                        }
                    }
                }
            }
        }

        frames.push(pixels);
    }

    Some((canvas_w, canvas_h, frame_count, frames))
}

// ============================================================================
// Main
// ============================================================================

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: verify <asf_dir>");
        eprintln!("  Verifies MSF v2 files match original ASF pixel data");
        std::process::exit(1);
    }

    let asf_dir = PathBuf::from(&args[1]);

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
    println!("Verifying {} ASF ↔ MSF v2 file pairs...", total);

    let passed = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);
    let skipped = AtomicUsize::new(0);

    asf_files.par_iter().for_each(|asf_path| {
        let mut msf_path = asf_path.clone();
        msf_path.set_extension("msf");

        if !msf_path.exists() {
            skipped.fetch_add(1, Ordering::Relaxed);
            return;
        }

        let asf_data = match std::fs::read(asf_path) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", asf_path, e);
                failed.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };
        let msf_data = match std::fs::read(&msf_path) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", msf_path, e);
                failed.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };

        let asf_result = decode_asf_to_rgba(&asf_data);
        let msf_result = decode_msf_to_rgba(&msf_data);

        match (asf_result, msf_result) {
            (Some((aw, ah, ac, asf_frames)), Some((mw, mh, mc, msf_frames))) => {
                if aw != mw || ah != mh || ac != mc {
                    eprintln!(
                        "  MISMATCH {:?}: dimensions differ ASF={}x{}x{} MSF={}x{}x{}",
                        asf_path, aw, ah, ac, mw, mh, mc
                    );
                    failed.fetch_add(1, Ordering::Relaxed);
                    return;
                }

                for f in 0..ac {
                    if asf_frames[f] != msf_frames[f] {
                        // Find first differing pixel
                        let mut diff_count = 0;
                        let mut first_diff = None;
                        for p in 0..asf_frames[f].len() {
                            if asf_frames[f][p] != msf_frames[f][p] {
                                diff_count += 1;
                                if first_diff.is_none() {
                                    first_diff = Some(p);
                                }
                            }
                        }
                        eprintln!(
                            "  PIXEL MISMATCH {:?} frame {}: {} bytes differ (first at byte {})",
                            asf_path,
                            f,
                            diff_count,
                            first_diff.unwrap_or(0)
                        );
                        failed.fetch_add(1, Ordering::Relaxed);
                        return;
                    }
                }

                let n = passed.fetch_add(1, Ordering::Relaxed) + 1;
                if n % 200 == 0 || n == total {
                    println!("  [{}/{}] verified OK", n, total);
                }
            }
            (None, _) => {
                eprintln!("  DECODE ERROR {:?}: failed to decode ASF", asf_path);
                failed.fetch_add(1, Ordering::Relaxed);
            }
            (_, None) => {
                eprintln!("  DECODE ERROR {:?}: failed to decode MSF", msf_path);
                failed.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    let p = passed.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    let s = skipped.load(Ordering::Relaxed);

    println!();
    println!("=== Verification Complete ===");
    println!("  Passed:  {}", p);
    println!("  Failed:  {}", f);
    println!("  Skipped: {} (no .msf found)", s);

    if f > 0 {
        std::process::exit(1);
    }
}
