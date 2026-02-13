//! Scan ASF files for semi-transparent alpha usage (0 < alpha < 255)
//! Usage: cargo run --release --bin scan_alpha <asf_dir>

use std::path::PathBuf;
use walkdir::WalkDir;

fn get_i32_le(data: &[u8], offset: usize) -> i32 {
    if offset + 4 > data.len() { return 0; }
    i32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]])
}

fn scan_asf(asf_data: &[u8]) -> (usize, usize, Vec<u8>) {
    // Returns (total_opaque_pixels, semi_transparent_pixels, unique_alpha_values)
    if asf_data.len() < 80 { return (0, 0, vec![]); }
    let sig = match std::str::from_utf8(&asf_data[0..7]) {
        Ok(s) if s == "ASF 1.0" => s,
        _ => return (0, 0, vec![]),
    };
    let _ = sig;

    let mut offset = 16;
    let _width = get_i32_le(asf_data, offset) as usize; offset += 4;
    let _height = get_i32_le(asf_data, offset) as usize; offset += 4;
    let frame_count = get_i32_le(asf_data, offset) as usize; offset += 4;
    offset += 4; // directions
    let color_count = get_i32_le(asf_data, offset) as usize; offset += 4;
    offset += 4 + 4 + 4 + 16; // interval, left, bottom, reserved

    // Skip palette
    offset += color_count * 4;

    // Frame offsets + lengths
    let mut frame_offsets = Vec::with_capacity(frame_count);
    let mut frame_lengths = Vec::with_capacity(frame_count);
    for _ in 0..frame_count {
        if offset + 8 > asf_data.len() { break; }
        frame_offsets.push(get_i32_le(asf_data, offset) as usize); offset += 4;
        frame_lengths.push(get_i32_le(asf_data, offset) as usize); offset += 4;
    }

    let mut total_opaque = 0usize;
    let mut total_semi = 0usize;
    let mut alpha_set = [false; 256];

    for i in 0..frame_count {
        if i >= frame_offsets.len() { break; }
        let mut data_offset = frame_offsets[i];
        let data_end = data_offset + frame_lengths[i];

        while data_offset < data_end && data_offset + 1 < asf_data.len() {
            let pixel_count = asf_data[data_offset] as usize;
            let pixel_alpha = asf_data[data_offset + 1];
            data_offset += 2;

            if pixel_alpha == 0 {
                // transparent, no color data follows
            } else {
                alpha_set[pixel_alpha as usize] = true;
                if pixel_alpha == 255 {
                    total_opaque += pixel_count;
                } else {
                    total_semi += pixel_count;
                }
                data_offset += pixel_count; // skip color indices
            }
        }
    }

    let unique_alphas: Vec<u8> = alpha_set.iter().enumerate()
        .filter(|(i, &v)| v && *i != 0 && *i != 255)
        .map(|(i, _)| i as u8)
        .collect();

    (total_opaque, total_semi, unique_alphas)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: scan_alpha <asf_dir>");
        std::process::exit(1);
    }

    let input_dir = PathBuf::from(&args[1]);
    let asf_files: Vec<PathBuf> = WalkDir::new(&input_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|ext| ext.eq_ignore_ascii_case("asf")).unwrap_or(false))
        .map(|e| e.into_path())
        .collect();

    println!("Scanning {} ASF files for semi-transparent alpha...\n", asf_files.len());

    let mut files_with_semi = 0;
    let mut total_opaque_all = 0usize;
    let mut total_semi_all = 0usize;

    for path in &asf_files {
        match std::fs::read(path) {
            Ok(data) => {
                let (opaque, semi, alphas) = scan_asf(&data);
                total_opaque_all += opaque;
                total_semi_all += semi;
                if semi > 0 {
                    files_with_semi += 1;
                    let rel = path.strip_prefix(&input_dir).unwrap_or(path);
                    println!("  {:60} opaque={:8} semi={:8} alphas={:?}",
                        rel.display(), opaque, semi, alphas);
                }
            }
            Err(_) => {}
        }
    }

    println!("\n=== Summary ===");
    println!("  Total files:            {}", asf_files.len());
    println!("  Files with semi-alpha:  {}", files_with_semi);
    println!("  Total opaque pixels:    {}", total_opaque_all);
    println!("  Total semi-trans pixels: {}", total_semi_all);
    if total_opaque_all + total_semi_all > 0 {
        let pct = total_semi_all as f64 / (total_opaque_all + total_semi_all) as f64 * 100.0;
        println!("  Semi-trans ratio:       {:.4}%", pct);
    }
}
