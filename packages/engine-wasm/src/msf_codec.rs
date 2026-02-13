//! MSF (Miu Sprite Format) v2 — WASM decoder
//!
//! v2 format: Indexed8 (1bpp) palette-based, zstd-compressed.
//! No row filters — raw palette indices stored directly.
//!
//! Layout:
//! ```text
//! [Magic "MSF2" (4)] [Version u16] [Flags u16]           = 8 bytes
//! [Header: canvas W/H, frameCount, dirs, fps, anchor...] = 16 bytes
//! [PixelFormat u8] [PaletteSize u16] [Reserved u8]       = 4 bytes
//! [Palette: RGBA × paletteSize]                          = paletteSize * 4
//! [Frame Table: frameCount × 16]                         = frameCount * 16
//! [Extension Chunks...]
//! [Sentinel "END\0" (4) + 0u32 (4)]                     = 8 bytes
//! [Zstd-compressed Frame Data Blob]                      = variable
//! ```
//!
//! Frame data (decompressed) = raw palette indices, width×height bytes per frame.
//! Palette entries with alpha=0 represent transparent pixels.

use js_sys::Uint8Array;
use wasm_bindgen::prelude::*;

// ============================================================================
// Zstd decompression (pure Rust via ruzstd, works in WASM)
// ============================================================================

fn zstd_decompress(data: &[u8]) -> Option<Vec<u8>> {
    use ruzstd::StreamingDecoder;
    use std::io::Read;
    let mut decoder = StreamingDecoder::new(data).ok()?;
    let mut buf = Vec::new();
    decoder.read_to_end(&mut buf).ok()?;
    Some(buf)
}

// ============================================================================
// Constants
// ============================================================================

const MSF_MAGIC: &[u8; 4] = b"MSF2";
const CHUNK_END: &[u8; 4] = b"END\0";

/// Pixel format enum
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PixelFormat {
    Rgba8 = 0,
    Indexed8 = 1,
    Indexed8Alpha8 = 2,
}

impl PixelFormat {
    fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::Rgba8),
            1 => Some(Self::Indexed8),
            2 => Some(Self::Indexed8Alpha8),
            _ => None,
        }
    }

    pub fn bytes_per_pixel(self) -> usize {
        match self {
            Self::Rgba8 => 4,
            Self::Indexed8 => 1,
            Self::Indexed8Alpha8 => 2,
        }
    }
}

// ============================================================================
// MSF Header (returned to JS)
// ============================================================================

#[wasm_bindgen(getter_with_clone)]
#[derive(Clone, Debug)]
pub struct MsfHeader {
    pub canvas_width: u16,
    pub canvas_height: u16,
    pub frame_count: u16,
    pub directions: u8,
    pub fps: u8,
    pub anchor_x: i16,
    pub anchor_y: i16,
    pub pixel_format: u8,
    pub palette_size: u16,
    pub frames_per_direction: u16,
    /// Total RGBA bytes for all frames when decoded individually
    pub total_individual_pixel_bytes: u32,
}

// ============================================================================
// Frame entry
// ============================================================================

#[derive(Clone, Debug)]
pub struct MsfFrameEntry {
    pub offset_x: i16,
    pub offset_y: i16,
    pub width: u16,
    pub height: u16,
    pub data_offset: u32,
    pub data_length: u32,
}

const FRAME_ENTRY_SIZE: usize = 16;

// ============================================================================
// Parsing
// ============================================================================

/// Parse MSF v2 header from raw data
#[wasm_bindgen]
pub fn parse_msf_header(data: &[u8]) -> Option<MsfHeader> {
    if data.len() < 28 || &data[0..4] != MSF_MAGIC {
        return None;
    }

    let off = 8;
    let canvas_width = u16::from_le_bytes([data[off], data[off + 1]]);
    let canvas_height = u16::from_le_bytes([data[off + 2], data[off + 3]]);
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]);
    let directions = data[off + 6];
    let fps = data[off + 7];
    let anchor_x = i16::from_le_bytes([data[off + 8], data[off + 9]]);
    let anchor_y = i16::from_le_bytes([data[off + 10], data[off + 11]]);

    let pf_off = 24;
    if data.len() < pf_off + 4 {
        return None;
    }
    let pixel_format = data[pf_off];
    let palette_size = u16::from_le_bytes([data[pf_off + 1], data[pf_off + 2]]);

    let frames_per_direction = if directions > 0 {
        (frame_count / directions as u16).max(1)
    } else {
        frame_count.max(1)
    };

    // Compute total individual pixel bytes
    let palette_start = 28;
    let frame_table_start = palette_start + palette_size as usize * 4;
    let fc = frame_count as usize;
    let mut total_individual_pixel_bytes = 0u32;
    if frame_table_start + fc * FRAME_ENTRY_SIZE <= data.len() {
        for i in 0..fc {
            let ft_off = frame_table_start + i * FRAME_ENTRY_SIZE;
            let w = u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]) as u32;
            let h = u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]) as u32;
            if w > 0 && h > 0 {
                total_individual_pixel_bytes += w * h * 4;
            } else {
                total_individual_pixel_bytes += 4;
            }
        }
    }

    Some(MsfHeader {
        canvas_width,
        canvas_height,
        frame_count,
        directions,
        fps,
        anchor_x,
        anchor_y,
        pixel_format,
        palette_size,
        frames_per_direction,
        total_individual_pixel_bytes,
    })
}

/// Internal: parse full MSF structure
fn parse_msf_structure(
    data: &[u8],
) -> Option<(
    u16,           // canvas_width
    u16,           // canvas_height
    usize,         // frame_count
    u8,            // pixel_format_byte
    u16,           // palette_size
    [[u8; 4]; 256],// palette
    Vec<MsfFrameEntry>,
    usize,         // blob_start
    u16,           // flags
)> {
    if data.len() < 28 || &data[0..4] != MSF_MAGIC {
        return None;
    }

    let flags = u16::from_le_bytes([data[6], data[7]]);
    let off = 8;
    let canvas_width = u16::from_le_bytes([data[off], data[off + 1]]);
    let canvas_height = u16::from_le_bytes([data[off + 2], data[off + 3]]);
    let frame_count = u16::from_le_bytes([data[off + 4], data[off + 5]]) as usize;

    let pf_off = 24;
    let pixel_format_byte = data[pf_off];
    let palette_size = u16::from_le_bytes([data[pf_off + 1], data[pf_off + 2]]) as usize;

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
    if frame_table_start + frame_count * FRAME_ENTRY_SIZE > data.len() {
        return None;
    }

    let mut frame_entries = Vec::with_capacity(frame_count);
    let mut ft_off = frame_table_start;
    for _ in 0..frame_count {
        frame_entries.push(MsfFrameEntry {
            offset_x: i16::from_le_bytes([data[ft_off], data[ft_off + 1]]),
            offset_y: i16::from_le_bytes([data[ft_off + 2], data[ft_off + 3]]),
            width: u16::from_le_bytes([data[ft_off + 4], data[ft_off + 5]]),
            height: u16::from_le_bytes([data[ft_off + 6], data[ft_off + 7]]),
            data_offset: u32::from_le_bytes([data[ft_off + 8], data[ft_off + 9], data[ft_off + 10], data[ft_off + 11]]),
            data_length: u32::from_le_bytes([data[ft_off + 12], data[ft_off + 13], data[ft_off + 14], data[ft_off + 15]]),
        });
        ft_off += FRAME_ENTRY_SIZE;
    }

    // Skip extension chunks until END sentinel
    let mut ext_off = ft_off;
    loop {
        if ext_off + 8 > data.len() {
            return None;
        }
        let chunk_id = &data[ext_off..ext_off + 4];
        let chunk_len = u32::from_le_bytes([data[ext_off + 4], data[ext_off + 5], data[ext_off + 6], data[ext_off + 7]]) as usize;
        ext_off += 8;
        if chunk_id == CHUNK_END {
            break;
        }
        ext_off += chunk_len;
    }

    Some((canvas_width, canvas_height, frame_count, pixel_format_byte, palette_size as u16, palette, frame_entries, ext_off, flags))
}

/// Get decompressed blob from MSF data
fn get_blob<'a>(data: &'a [u8], blob_start: usize, flags: u16, buf: &'a mut Vec<u8>) -> Option<&'a [u8]> {
    if (flags & 1) != 0 {
        *buf = zstd_decompress(&data[blob_start..])?;
        Some(buf.as_slice())
    } else {
        Some(&data[blob_start..])
    }
}

// ============================================================================
// Indexed8 pixel lookup: palette index → RGBA
// ============================================================================

#[inline]
fn lookup_indexed8(palette: &[[u8; 4]; 256], idx: u8, dst: &mut [u8]) {
    let c = &palette[idx as usize];
    dst[0] = c[0];
    dst[1] = c[1];
    dst[2] = c[2];
    dst[3] = c[3];
}

// ============================================================================
// Decoding — exported to WASM
// ============================================================================

/// Decode all frames into canvas-sized RGBA (for ASF sprites)
#[wasm_bindgen]
pub fn decode_msf_frames(data: &[u8], output: &Uint8Array) -> u32 {
    let (canvas_width, canvas_height, frame_count, pf_byte, _, palette, entries, blob_start, flags) =
        match parse_msf_structure(data) {
            Some(v) => v,
            None => return 0,
        };

    let pixel_format = match PixelFormat::from_u8(pf_byte) {
        Some(pf) => pf,
        None => return 0,
    };
    let mut decomp_buf = Vec::new();
    let blob = match get_blob(data, blob_start, flags, &mut decomp_buf) {
        Some(b) => b,
        None => return 0,
    };

    let cw = canvas_width as usize;
    let ch = canvas_height as usize;
    let frame_size = cw * ch * 4;
    let mut all_pixels = vec![0u8; frame_size * frame_count];

    for (i, entry) in entries.iter().enumerate() {
        if entry.width == 0 || entry.height == 0 {
            continue;
        }

        let fw = entry.width as usize;
        let fh = entry.height as usize;
        let ox = entry.offset_x as usize;
        let oy = entry.offset_y as usize;
        let blob_off = entry.data_offset as usize;
        let blob_len = entry.data_length as usize;

        if blob_off + blob_len > blob.len() {
            continue;
        }

        let raw = &blob[blob_off..blob_off + blob_len];
        let frame_start = i * frame_size;

        match pixel_format {
            PixelFormat::Indexed8 => {
                for y in 0..fh {
                    for x in 0..fw {
                        let src = y * fw + x;
                        if src >= raw.len() { continue; }
                        let dst = frame_start + ((oy + y) * cw + ox + x) * 4;
                        if dst + 4 <= all_pixels.len() {
                            lookup_indexed8(&palette, raw[src], &mut all_pixels[dst..dst + 4]);
                        }
                    }
                }
            }
            PixelFormat::Indexed8Alpha8 => {
                for y in 0..fh {
                    for x in 0..fw {
                        let src = (y * fw + x) * 2;
                        if src + 1 >= raw.len() { continue; }
                        let alpha = raw[src + 1];
                        if alpha == 0 { continue; }
                        let dst = frame_start + ((oy + y) * cw + ox + x) * 4;
                        if dst + 4 <= all_pixels.len() {
                            let c = &palette[raw[src] as usize];
                            all_pixels[dst] = c[0];
                            all_pixels[dst + 1] = c[1];
                            all_pixels[dst + 2] = c[2];
                            all_pixels[dst + 3] = alpha;
                        }
                    }
                }
            }
            PixelFormat::Rgba8 => {
                for y in 0..fh {
                    let src_start = y * fw * 4;
                    let dst_start = frame_start + ((oy + y) * cw + ox) * 4;
                    let row_bytes = fw * 4;
                    if src_start + row_bytes <= raw.len() && dst_start + row_bytes <= all_pixels.len() {
                        all_pixels[dst_start..dst_start + row_bytes]
                            .copy_from_slice(&raw[src_start..src_start + row_bytes]);
                    }
                }
            }
        }
    }

    output.copy_from(&all_pixels);
    frame_count as u32
}

/// Decode frames as individual images (for MPC per-frame varying sizes)
#[wasm_bindgen]
pub fn decode_msf_individual_frames(
    data: &[u8],
    pixel_output: &Uint8Array,
    frame_sizes_output: &Uint8Array,
    frame_offsets_output: &Uint8Array,
) -> u32 {
    let (_cw, _ch, frame_count, pf_byte, _, palette, entries, blob_start, flags) =
        match parse_msf_structure(data) {
            Some(v) => v,
            None => return 0,
        };

    let pixel_format = match PixelFormat::from_u8(pf_byte) {
        Some(pf) => pf,
        None => return 0,
    };
    let mut decomp_buf = Vec::new();
    let blob = match get_blob(data, blob_start, flags, &mut decomp_buf) {
        Some(b) => b,
        None => return 0,
    };

    // Calculate total output size
    let mut total_pixel_bytes = 0usize;
    for entry in &entries {
        if entry.width > 0 && entry.height > 0 {
            total_pixel_bytes += (entry.width as usize) * (entry.height as usize) * 4;
        } else {
            total_pixel_bytes += 4;
        }
    }

    let mut all_pixels = vec![0u8; total_pixel_bytes];
    let mut frame_sizes = vec![0u32; frame_count * 2];
    let mut frame_offsets = vec![0u32; frame_count];
    let mut out_offset = 0usize;

    for (i, entry) in entries.iter().enumerate() {
        let fw = entry.width as usize;
        let fh = entry.height as usize;

        if fw == 0 || fh == 0 {
            frame_sizes[i * 2] = 1;
            frame_sizes[i * 2 + 1] = 1;
            frame_offsets[i] = out_offset as u32;
            out_offset += 4;
            continue;
        }

        frame_sizes[i * 2] = fw as u32;
        frame_sizes[i * 2 + 1] = fh as u32;
        frame_offsets[i] = out_offset as u32;

        let blob_off = entry.data_offset as usize;
        let blob_len = entry.data_length as usize;

        if blob_off + blob_len > blob.len() {
            out_offset += fw * fh * 4;
            continue;
        }

        let raw = &blob[blob_off..blob_off + blob_len];
        let npixels = fw * fh;

        match pixel_format {
            PixelFormat::Indexed8 => {
                for p in 0..npixels {
                    if p >= raw.len() { break; }
                    let dst = out_offset + p * 4;
                    lookup_indexed8(&palette, raw[p], &mut all_pixels[dst..dst + 4]);
                }
            }
            PixelFormat::Indexed8Alpha8 => {
                for p in 0..npixels {
                    let src = p * 2;
                    if src + 1 >= raw.len() { break; }
                    let alpha = raw[src + 1];
                    if alpha == 0 { continue; }
                    let dst = out_offset + p * 4;
                    let c = &palette[raw[src] as usize];
                    all_pixels[dst] = c[0];
                    all_pixels[dst + 1] = c[1];
                    all_pixels[dst + 2] = c[2];
                    all_pixels[dst + 3] = alpha;
                }
            }
            PixelFormat::Rgba8 => {
                let bytes = npixels * 4;
                if bytes <= raw.len() {
                    all_pixels[out_offset..out_offset + bytes].copy_from_slice(&raw[..bytes]);
                }
            }
        }

        out_offset += npixels * 4;
    }

    pixel_output.copy_from(&all_pixels);

    let sizes_bytes: Vec<u8> = frame_sizes.iter().flat_map(|v| v.to_le_bytes()).collect();
    frame_sizes_output.copy_from(&sizes_bytes);

    let offsets_bytes: Vec<u8> = frame_offsets.iter().flat_map(|v| v.to_le_bytes()).collect();
    frame_offsets_output.copy_from(&offsets_bytes);

    frame_count as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pixel_format() {
        assert_eq!(PixelFormat::from_u8(0), Some(PixelFormat::Rgba8));
        assert_eq!(PixelFormat::from_u8(1), Some(PixelFormat::Indexed8));
        assert_eq!(PixelFormat::from_u8(2), Some(PixelFormat::Indexed8Alpha8));
        assert_eq!(PixelFormat::from_u8(99), None);
    }
}