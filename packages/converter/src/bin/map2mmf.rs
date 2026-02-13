//! MAP → MMF batch conversion tool
//!
//! Usage:
//!   map2mmf <resources_dir> [--traps <traps_ini_path>]
//!
//! Converts all .map files in `<resources_dir>/map/` to MMF format in-place,
//! embedding trap definitions from Traps.ini.
//!
//! The converter:
//! 1. Reads old .map files (GBK encoded)
//! 2. Converts to MMF format (UTF-8, zstd compressed)
//! 3. Remaps MPC indices to compact MSF indices
//! 4. Embeds trap table from Traps.ini
//! 5. Writes .mmf files alongside .map files

use encoding_rs::GBK;
use rayon::prelude::*;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

// ============= MAP Parser =============

struct MapTile {
    /// Layer 1: frame, mpc_index
    l1_frame: u8,
    l1_mpc: u8,
    /// Layer 2
    l2_frame: u8,
    l2_mpc: u8,
    /// Layer 3
    l3_frame: u8,
    l3_mpc: u8,
    /// Barrier type
    barrier: u8,
    /// Trap index
    trap: u8,
}

struct OldMapData {
    columns: u16,
    rows: u16,
    /// 255 MPC file names (GBK decoded), None for empty slots
    mpc_names: Vec<Option<String>>,
    /// Looping flags per MPC slot
    mpc_looping: Vec<bool>,
    /// All tiles in row-major order
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
    // Find null terminator
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

    // Check header: "MAP File Ver"
    let header = std::str::from_utf8(&data[0..12]).ok()?;
    if header != "MAP File Ver" {
        return None;
    }

    // Read dimensions at offset 68
    let columns = get_i32_le(data, 68) as u16;
    let rows = get_i32_le(data, 72) as u16;

    // Read MPC file list: 255 entries, each 64 bytes, starting at offset 192
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
            // Looping flag at offset + 36
            mpc_looping.push(data[offset + 36] == 1);
        }
    }

    // Tile data starts at offset 16512
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
        offset += 10; // 8 bytes data + 2 bytes padding
    }

    Some(OldMapData {
        columns,
        rows,
        mpc_names,
        mpc_looping,
        tiles,
    })
}

// ============= Traps.ini Parser =============

/// Parse a Traps.ini file (already UTF-8 or GBK) into map_name -> (trap_index -> script_path)
fn parse_traps_ini(content: &str) -> HashMap<String, HashMap<u8, String>> {
    let mut result: HashMap<String, HashMap<u8, String>> = HashMap::new();
    let mut current_section: Option<String> = None;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        if line.starts_with('[') && line.ends_with(']') {
            let section = line[1..line.len() - 1].to_string();
            current_section = Some(section);
            continue;
        }
        if let Some(ref section) = current_section {
            if let Some((key, value)) = line.split_once('=') {
                if let Ok(trap_index) = key.trim().parse::<u8>() {
                    let script_path = value.trim().to_string();
                    result
                        .entry(section.clone())
                        .or_default()
                        .insert(trap_index, script_path);
                }
            }
        }
    }

    result
}

// ============= MMF Writer =============

struct MsfEntry {
    name: String,
    looping: bool,
}

struct TrapEntry {
    trap_index: u8,
    script_path: String,
}

fn convert_map_to_mmf(
    map_data: &OldMapData,
    trap_entries: &[TrapEntry],
) -> Vec<u8> {
    // Step 1: Compact MSF table - only include used MPC entries
    // Build old_index -> new_index mapping (new index is 1-based, 0 = empty)
    let mut old_to_new: HashMap<u8, u8> = HashMap::new();
    let mut msf_entries: Vec<MsfEntry> = Vec::new();
    let mut new_idx: u8 = 1;

    for (old_idx, name_opt) in map_data.mpc_names.iter().enumerate() {
        if let Some(name) = name_opt {
            old_to_new.insert(old_idx as u8, new_idx);
            // Convert .mpc -> .msf file extension
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

    // Step 2: Build flags
    let mut flags: u16 = 0x01; // bit 0: ZSTD
    if trap_count > 0 {
        flags |= 0x02; // bit 1: HAS_TRAPS
    }

    // Step 3: Calculate buffer size and write
    let mut out = Vec::with_capacity(64 * 1024); // Start with 64KB

    // --- Preamble (8 bytes) ---
    out.extend_from_slice(b"MMF1");
    out.extend_from_slice(&1u16.to_le_bytes()); // version
    out.extend_from_slice(&flags.to_le_bytes());

    // --- Map Header (12 bytes) ---
    out.extend_from_slice(&map_data.columns.to_le_bytes());
    out.extend_from_slice(&map_data.rows.to_le_bytes());
    out.extend_from_slice(&msf_count.to_le_bytes());
    out.extend_from_slice(&trap_count.to_le_bytes());
    out.extend_from_slice(&0u32.to_le_bytes()); // reserved

    // --- MSF Table ---
    for entry in &msf_entries {
        let name_bytes = entry.name.as_bytes();
        out.push(name_bytes.len() as u8);
        out.extend_from_slice(name_bytes);
        let entry_flags: u8 = if entry.looping { 1 } else { 0 };
        out.push(entry_flags);
    }

    // --- Trap Table ---
    if flags & 0x02 != 0 {
        for trap in trap_entries {
            out.push(trap.trap_index);
            let path_bytes = trap.script_path.as_bytes();
            out.extend_from_slice(&(path_bytes.len() as u16).to_le_bytes());
            out.extend_from_slice(path_bytes);
        }
    }

    // --- Extension Chunks (none for v1, just end sentinel) ---
    out.extend_from_slice(b"END\0");
    out.extend_from_slice(&0u32.to_le_bytes());

    // --- Tile Data Blob (to be zstd compressed) ---
    // Layout: Layer1 + Layer2 + Layer3 + Barriers + Traps
    // Each layer: totalTiles × 2 bytes [msfIndex, frame]
    // Barriers: totalTiles × 1 byte
    // Traps: totalTiles × 1 byte
    let blob_size = total_tiles * 2 * 3 + total_tiles * 2; // 3 layers × 2 + barrier + trap
    let mut blob = Vec::with_capacity(blob_size);

    // Layer 1
    for tile in &map_data.tiles {
        let new_msf = if tile.l1_mpc == 0 {
            0
        } else {
            // Old format: mpcIndex is 1-based into the 255-slot array
            // So tile.l1_mpc - 1 = slot index
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

    // Compress with zstd
    let compressed = zstd::bulk::compress(&blob, 3).expect("zstd compression failed");
    out.extend_from_slice(&compressed);

    out
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: map2mmf <resources_dir> [--traps <traps_ini_path>]");
        eprintln!();
        eprintln!("Converts all .map files to .mmf format.");
        eprintln!("Default traps path: <resources_dir>/save/game/Traps.ini");
        std::process::exit(1);
    }

    let resources_dir = PathBuf::from(&args[1]);
    let map_dir = resources_dir.join("map");

    if !map_dir.exists() {
        eprintln!("Error: map directory {:?} does not exist", map_dir);
        std::process::exit(1);
    }

    // Find traps.ini path
    let traps_path = if let Some(pos) = args.iter().position(|a| a == "--traps") {
        PathBuf::from(&args[pos + 1])
    } else {
        resources_dir.join("save/game/Traps.ini")
    };

    // Load traps.ini
    let all_traps = if traps_path.exists() {
        println!("Loading traps from: {:?}", traps_path);
        let raw = std::fs::read(&traps_path).expect("Failed to read Traps.ini");
        // Try UTF-8 first, fall back to GBK
        let content = match std::str::from_utf8(&raw) {
            Ok(s) => s.to_string(),
            Err(_) => {
                let (decoded, _, _) = GBK.decode(&raw);
                decoded.into_owned()
            }
        };
        parse_traps_ini(&content)
    } else {
        println!("Warning: Traps.ini not found at {:?}, continuing without traps", traps_path);
        HashMap::new()
    };

    println!("Loaded trap definitions for {} maps", all_traps.len());

    // Find all .map files
    let map_files: Vec<PathBuf> = walkdir::WalkDir::new(&map_dir)
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
    let total_map_bytes = AtomicUsize::new(0);
    let total_mmf_bytes = AtomicUsize::new(0);

    map_files.par_iter().for_each(|map_path| {
        // Extract map name without extension for trap lookup
        let map_name = map_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        // Try to match trap section by map name
        // The Traps.ini sections use the map file name without extension
        // E.g., "map_003_武当山下" matches section [map_003_武当山下]
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
            Ok(map_data_raw) => {
                let map_size = map_data_raw.len();
                match parse_old_map(&map_data_raw) {
                    Some(map_data) => {
                        let mmf_data = convert_map_to_mmf(&map_data, &trap_entries);
                        let mmf_size = mmf_data.len();

                        let mut mmf_path = map_path.clone();
                        mmf_path.set_extension("mmf");

                        if std::fs::write(&mmf_path, &mmf_data).is_ok() {
                            let n = converted.fetch_add(1, Ordering::Relaxed) + 1;
                            total_map_bytes.fetch_add(map_size, Ordering::Relaxed);
                            total_mmf_bytes.fetch_add(mmf_size, Ordering::Relaxed);

                            let trap_info = if !trap_entries.is_empty() {
                                format!(" ({} traps)", trap_entries.len())
                            } else {
                                String::new()
                            };

                            if n % 10 == 0 || n == total {
                                println!(
                                    "  [{}/{}] {} → {} bytes{}",
                                    n, total, map_size, mmf_size, trap_info
                                );
                            }
                        } else {
                            eprintln!("  WRITE ERROR {:?}", mmf_path);
                            failed.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    None => {
                        eprintln!("  PARSE ERROR {:?}", map_path);
                        failed.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            Err(e) => {
                eprintln!("  READ ERROR {:?}: {}", map_path, e);
                failed.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    let c = converted.load(Ordering::Relaxed);
    let f = failed.load(Ordering::Relaxed);
    let map_kb = total_map_bytes.load(Ordering::Relaxed) as f64 / 1024.0;
    let mmf_kb = total_mmf_bytes.load(Ordering::Relaxed) as f64 / 1024.0;
    let ratio = if map_kb > 0.0 {
        mmf_kb / map_kb * 100.0
    } else {
        0.0
    };

    println!("\n=== MAP → MMF Done ===");
    println!("  Converted: {}/{}", c, total);
    println!("  Failed:    {}", f);
    println!(
        "  MAP: {:.1} KB → MMF: {:.1} KB ({:.1}%)",
        map_kb, mmf_kb, ratio
    );
}
