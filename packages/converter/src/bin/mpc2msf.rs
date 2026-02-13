//! MPC → MSF v2 batch conversion tool
//!
//! Usage:
//!   mpc2msf <input_dir> <output_dir>
//!
//! Recursively converts all .mpc files to MSF v2 format.
//! MSF v2: Indexed8 (1bpp) + zstd compression, no row filters.

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

    /// Decode MPC RLE to Indexed8 (1bpp).
    /// transparent_idx is used for skipped (transparent) pixels.
    fn decode_mpc_rle_to_indexed(
        data: &[u8],
        rle_start: usize,
        rle_end: usize,
        width: usize,
        height: usize,
        transparent_idx: u8,
    ) -> Vec<u8> {
        let total = width * height;
        let mut buf = vec![transparent_idx; total]; // fill with transparent
        let mut data_offset = rle_start;
        let mut pixel_idx = 0usize;

        while data_offset < rle_end && data_offset < data.len() && pixel_idx < total {
            let byte = data[data_offset];
            data_offset += 1;

            if byte > 0x80 {
                // Skip (transparent) — already filled with transparent_idx
                let count = (byte - 0x80) as usize;
                pixel_idx += count;
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

    /// Scan MPC frames to find which palette indices are used by opaque pixels.
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
        0 // fallback
    }

    /// Convert a single MPC file to MSF v2 (Indexed8 1bpp + zstd)
    pub fn convert_mpc_to_msf(mpc_data: &[u8]) -> Option<Vec<u8>> {
        if mpc_data.len() < 160 {
            return None;
        }

        let sig = std::str::from_utf8(&mpc_data[0..12]).ok()?;
        if !sig.starts_with("MPC File Ver") {
            return None;
        }

        let off = 64;
        let _frames_data_length_sum = get_u32_le(mpc_data, off);
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

        // Read palette (BGRA → RGBA)
        let palette_start = 128;
        let mut palette: Vec<[u8; 4]> = Vec::with_capacity(color_count);
        for i in 0..color_count {
            let po = palette_start + i * 4;
            if po + 4 > mpc_data.len() {
                break;
            }
            let b = mpc_data[po];
            let g = mpc_data[po + 1];
            let r = mpc_data[po + 2];
            palette.push([r, g, b, 255]);
        }

        // Read frame data offsets
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

        // Find transparent index
        let transparent_idx = find_transparent_index_mpc(mpc_data, frame_data_start, &data_offsets);
        if (transparent_idx as usize) < palette.len() {
            palette[transparent_idx as usize][3] = 0;
        } else {
            while palette.len() <= transparent_idx as usize {
                palette.push([0, 0, 0, 255]);
            }
            palette[transparent_idx as usize] = [0, 0, 0, 0];
        }

        // Process frames
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

        // Concatenate frame data
        let mut concat_raw = Vec::new();
        for (i, data) in raw_frame_data.iter().enumerate() {
            frame_entries[i].data_offset = concat_raw.len() as u32;
            frame_entries[i].data_length = data.len() as u32;
            concat_raw.extend_from_slice(data);
        }

        let flags: u16 = 1; // zstd
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

        // Header
        out.extend_from_slice(&global_width.to_le_bytes());
        out.extend_from_slice(&global_height.to_le_bytes());
        out.extend_from_slice(&frame_count.to_le_bytes());
        out.push(direction);
        out.push(fps);
        out.extend_from_slice(&left.to_le_bytes());
        out.extend_from_slice(&bottom.to_le_bytes());
        out.extend_from_slice(&[0u8; 4]);

        // Pixel format: Indexed8 (1)
        out.push(1);
        out.extend_from_slice(&(palette.len() as u16).to_le_bytes());
        out.push(0);

        // Palette
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
        eprintln!("Usage: mpc2msf <input_dir> <output_dir>");
        std::process::exit(1);
    }

    let input_dir = PathBuf::from(&args[1]);
    let output_dir = PathBuf::from(&args[2]);

    if !input_dir.exists() {
        eprintln!("Error: input directory {:?} does not exist", input_dir);
        std::process::exit(1);
    }

    let mpc_files: Vec<PathBuf> = WalkDir::new(&input_dir)
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
    println!("Found {} MPC files (MSF v2: Indexed8 + zstd)", total);

    let converted = AtomicUsize::new(0);
    let failed = AtomicUsize::new(0);
    let total_mpc_bytes = AtomicUsize::new(0);
    let total_msf_bytes = AtomicUsize::new(0);

    mpc_files.par_iter().for_each(|mpc_path| {
        let relative = mpc_path.strip_prefix(&input_dir).unwrap_or(mpc_path);
        let mut msf_relative = relative.to_path_buf();
        msf_relative.set_extension("msf");
        let msf_path = output_dir.join(&msf_relative);

        if let Some(parent) = msf_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        match std::fs::read(mpc_path) {
            Ok(mpc_data) => {
                let mpc_size = mpc_data.len();
                match msf::convert_mpc_to_msf(&mpc_data) {
                    Some(msf_data) => {
                        let msf_size = msf_data.len();
                        if std::fs::write(&msf_path, &msf_data).is_ok() {
                            let n = converted.fetch_add(1, Ordering::Relaxed) + 1;
                            total_mpc_bytes.fetch_add(mpc_size, Ordering::Relaxed);
                            total_msf_bytes.fetch_add(msf_size, Ordering::Relaxed);
                            if n % 100 == 0 || n == total {
                                println!("  [{}/{}]", n, total);
                            }
                        } else {
                            failed.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    None => {
                        eprintln!("  CONVERT ERROR {:?}", mpc_path);
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", mpc_path, e);
                failed.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    let c = converted.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    let mpc_mb = total_mpc_bytes.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0);
    let msf_mb = total_msf_bytes.load(Ordering::Relaxed) as f64 / (1024.0 * 1024.0);
    let ratio = if mpc_mb > 0.0 {
        msf_mb / mpc_mb * 100.0
    } else {
        0.0
    };

    println!("\n=== Done ===");
    println!("  Converted: {}/{}", c, total);
    println!("  Failed:    {}", f);
    println!(
        "  MPC: {:.1} MB → MSF: {:.1} MB ({:.1}%)",
        mpc_mb, msf_mb, ratio
    );
}
