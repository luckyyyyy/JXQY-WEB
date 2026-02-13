//! MPC ↔ MSF v2 pixel-perfect verification tool
//!
//! Usage: cargo run --release --bin verify_mpc <mpc_dir> <msf_dir>
//!
//! For each .mpc file, finds the corresponding .msf file and verifies
//! that decoding both produces identical RGBA pixel data.

use rayon::prelude::*;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use walkdir::WalkDir;



// ============================================================================
// MPC decoder
// ============================================================================

#[inline]
fn get_u32_le(data: &[u8], offset: usize) -> u32 {
    if offset + 4 > data.len() {
        return 0;
    }
    u32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
}

struct MpcFrame {
    width: usize,
    height: usize,
    rgba: Vec<u8>,
}

fn decode_mpc(data: &[u8]) -> Option<(usize, Vec<[u8; 4]>, Vec<MpcFrame>)> {
    if data.len() < 160 {
        return None;
    }

    let sig = std::str::from_utf8(&data[0..12]).ok()?;
    if !sig.starts_with("MPC File Ver") {
        return None;
    }

    let off = 64;
    let _frames_data_length_sum = get_u32_le(data, off);
    let _global_width = get_u32_le(data, off + 4);
    let _global_height = get_u32_le(data, off + 8);
    let frame_count = get_u32_le(data, off + 12) as usize;
    let _direction = get_u32_le(data, off + 16);
    let color_count = get_u32_le(data, off + 20) as usize;

    // Palette (BGRA → RGBA) at offset 128
    let palette_start = 128;
    let mut palette = Vec::with_capacity(color_count);
    for i in 0..color_count {
        let po = palette_start + i * 4;
        if po + 4 > data.len() {
            break;
        }
        let b = data[po];
        let g = data[po + 1];
        let r = data[po + 2];
        palette.push([r, g, b, 255u8]);
    }

    // Frame data offsets
    let offsets_start = palette_start + color_count * 4;
    let mut data_offsets = Vec::with_capacity(frame_count);
    for i in 0..frame_count {
        let o = offsets_start + i * 4;
        if o + 4 > data.len() {
            break;
        }
        data_offsets.push(get_u32_le(data, o) as usize);
    }

    let frame_data_start = offsets_start + frame_count * 4;

    let mut frames = Vec::with_capacity(frame_count);

    for i in 0..frame_count {
        if i >= data_offsets.len() {
            frames.push(MpcFrame { width: 0, height: 0, rgba: Vec::new() });
            continue;
        }

        let ds = frame_data_start + data_offsets[i];
        if ds + 12 > data.len() {
            frames.push(MpcFrame { width: 0, height: 0, rgba: Vec::new() });
            continue;
        }

        let data_len = get_u32_le(data, ds) as usize;
        let fw = get_u32_le(data, ds + 4) as usize;
        let fh = get_u32_le(data, ds + 8) as usize;

        if fw == 0 || fh == 0 || fw > 2048 || fh > 2048 {
            frames.push(MpcFrame { width: 0, height: 0, rgba: Vec::new() });
            continue;
        }

        let rle_start = ds + 20;
        let rle_end = ds + data_len;

        let mut pixels = vec![0u8; fw * fh * 4];
        let mut data_offset = rle_start;
        let mut pixel_idx = 0usize;
        let max_pixels = fw * fh;

        while pixel_idx < max_pixels && data_offset < rle_end && data_offset < data.len() {
            let byte = data[data_offset];
            data_offset += 1;

            if byte > 0x80 {
                // Transparent pixels
                let count = (byte - 0x80) as usize;
                pixel_idx += count;
            } else if byte > 0x00 {
                // Colored pixels
                let count = byte as usize;
                for _ in 0..count {
                    if pixel_idx >= max_pixels || data_offset >= data.len() {
                        break;
                    }
                    let color_idx = data[data_offset] as usize;
                    data_offset += 1;
                    if color_idx < palette.len() {
                        let pi = pixel_idx * 4;
                        pixels[pi] = palette[color_idx][0];
                        pixels[pi + 1] = palette[color_idx][1];
                        pixels[pi + 2] = palette[color_idx][2];
                        pixels[pi + 3] = 255;
                    }
                    pixel_idx += 1;
                }
            } else {
                break;
            }
        }

        frames.push(MpcFrame { width: fw, height: fh, rgba: pixels });
    }

    Some((frame_count, palette, frames))
}

// ============================================================================
// MSF v2 decoder (individual frames mode, for MPC)
// ============================================================================

struct MsfIndFrame {
    width: usize,
    height: usize,
    rgba: Vec<u8>,
}

fn decode_msf_individual(data: &[u8]) -> Option<Vec<MsfIndFrame>> {
    if data.len() < 28 || &data[0..4] != b"MSF2" {
        return None;
    }

    let flags = u16::from_le_bytes([data[6], data[7]]);
    let off = 8;
    let _canvas_w = u16::from_le_bytes([data[off], data[off + 1]]) as usize;
    let _canvas_h = u16::from_le_bytes([data[off + 2], data[off + 3]]) as usize;
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]) as usize;

    let pf_off = 24;
    let pixel_format = data[pf_off];
    let palette_size = u16::from_le_bytes([data[pf_off + 1], data[pf_off + 2]]) as usize;

    if pixel_format != 1 {
        return None;
    }

    let mut palette = [[0u8; 4]; 256];
    let palette_start = 28;
    for i in 0..palette_size.min(256) {
        let po = palette_start + i * 4;
        if po + 4 > data.len() {
            break;
        }
        palette[i] = [data[po], data[po + 1], data[po + 2], data[po + 3]];
    }

    let frame_table_start = palette_start + palette_size * 4;
    if frame_table_start + frame_count * 16 > data.len() {
        return None;
    }

    struct FE {
        width: u16,
        height: u16,
        data_offset: u32,
        data_length: u32,
    }

    let mut frame_entries = Vec::with_capacity(frame_count);
    let mut ft_off = frame_table_start;
    for _ in 0..frame_count {
        let _ox = i16::from_le_bytes([data[ft_off], data[ft_off + 1]]);
        let _oy = i16::from_le_bytes([data[ft_off + 2], data[ft_off + 3]]);
        let w = u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]);
        let h = u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]);
        let doff = u32::from_le_bytes([data[ft_off + 8], data[ft_off + 9], data[ft_off + 10], data[ft_off + 11]]);
        let dlen = u32::from_le_bytes([data[ft_off + 12], data[ft_off + 13], data[ft_off + 14], data[ft_off + 15]]);
        ft_off += 16;
        frame_entries.push(FE { width: w, height: h, data_offset: doff, data_length: dlen });
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

    let is_compressed = (flags & 1) != 0;
    let decompressed: Vec<u8>;
    let blob: &[u8] = if is_compressed {
        decompressed = zstd::bulk::decompress(&data[ext_off..], 256 * 1024 * 1024).ok()?;
        &decompressed
    } else {
        &data[ext_off..]
    };

    let mut result = Vec::with_capacity(frame_count);
    for entry in &frame_entries {
        let fw = entry.width as usize;
        let fh = entry.height as usize;

        if fw == 0 || fh == 0 {
            result.push(MsfIndFrame {
                width: 0,
                height: 0,
                rgba: Vec::new(),
            });
            continue;
        }

        let blob_off = entry.data_offset as usize;
        let blob_len = entry.data_length as usize;
        let mut pixels = vec![0u8; fw * fh * 4];

        if blob_off + blob_len <= blob.len() {
            let raw = &blob[blob_off..blob_off + blob_len];

            for p in 0..fw * fh {
                if p >= raw.len() {
                    break;
                }
                let color_idx = raw[p] as usize;
                let c = &palette[color_idx];
                if c[3] == 0 {
                    continue;
                }
                let dst = p * 4;
                pixels[dst] = c[0];
                pixels[dst + 1] = c[1];
                pixels[dst + 2] = c[2];
                pixels[dst + 3] = c[3];
            }
        }

        result.push(MsfIndFrame {
            width: fw,
            height: fh,
            rgba: pixels,
        });
    }

    Some(result)
}

// ============================================================================
// Main
// ============================================================================

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: verify_mpc <mpc_dir>");
        eprintln!("  Verifies MSF v2 files match original MPC pixel data");
        eprintln!("  Looks for .msf files alongside .mpc files in the same directory");
        std::process::exit(1);
    }

    let mpc_dir = PathBuf::from(&args[1]);

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
    println!("Verifying {} MPC ↔ MSF v2 file pairs...", total);

    let passed = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);
    let skipped = AtomicUsize::new(0);

    mpc_files.par_iter().for_each(|mpc_path| {
        let mut msf_path = mpc_path.clone();
        msf_path.set_extension("msf");

        if !msf_path.exists() {
            skipped.fetch_add(1, Ordering::Relaxed);
            return;
        }

        let mpc_data = match std::fs::read(mpc_path) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", mpc_path, e);
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

        let mpc_result = decode_mpc(&mpc_data);
        let msf_result = decode_msf_individual(&msf_data);

        match (mpc_result, msf_result) {
            (Some((frame_count, _palette, mpc_frames)), Some(msf_frames)) => {
                if frame_count != msf_frames.len() {
                    eprintln!(
                        "  MISMATCH {:?}: frame count MPC={} MSF={}",
                        mpc_path, frame_count, msf_frames.len()
                    );
                    failed.fetch_add(1, Ordering::Relaxed);
                    return;
                }

                for f in 0..frame_count {
                    let mpc_f = &mpc_frames[f];
                    let msf_f = &msf_frames[f];

                    if mpc_f.width != msf_f.width || mpc_f.height != msf_f.height {
                        eprintln!(
                            "  MISMATCH {:?} frame {}: size MPC={}x{} MSF={}x{}",
                            mpc_path, f, mpc_f.width, mpc_f.height, msf_f.width, msf_f.height
                        );
                        failed.fetch_add(1, Ordering::Relaxed);
                        return;
                    }

                    if mpc_f.rgba != msf_f.rgba {
                        let mut diff_count = 0;
                        let mut first_diff = None;
                        for p in 0..mpc_f.rgba.len() {
                            if mpc_f.rgba[p] != msf_f.rgba[p] {
                                diff_count += 1;
                                if first_diff.is_none() {
                                    first_diff = Some(p);
                                }
                            }
                        }
                        eprintln!(
                            "  PIXEL MISMATCH {:?} frame {}: {} bytes differ (first at byte {})",
                            mpc_path, f, diff_count, first_diff.unwrap_or(0)
                        );
                        failed.fetch_add(1, Ordering::Relaxed);
                        return;
                    }
                }

                let n = passed.fetch_add(1, Ordering::Relaxed) + 1;
                if n % 50 == 0 || n == total {
                    println!("  [{}/{}] verified OK", n, total);
                }
            }
            (None, _) => {
                eprintln!("  DECODE ERROR {:?}: failed to decode MPC", mpc_path);
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
