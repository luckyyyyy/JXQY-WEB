#!/usr/bin/env python3
"""
从现有 MSF 文件中解码帧图像，导出为 PNG，用于训练数据集。
同时为每张图自动生成描述文本（caption），供 LoRA 微调使用。
"""

import os
import struct
import sys

import numpy as np
import zstandard as zstd
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "magic", "_training_data")

# 根据文件名推断类型和描述词
CATEGORY_KEYWORDS = {
    "flying": ("flying projectile", "飞行弹道"),
    "vanish": ("explosion burst impact", "爆炸消散"),
    "supermode": ("ultimate full screen attack", "超级必杀"),
    "icon": ("small icon thumbnail", "武功图标"),
    "magic": ("magic spell aura glow", "武功光环"),
}


def decode_msf2(path: str) -> tuple[list[Image.Image], dict] | None:
    """Decode MSF v2 file, return list of RGBA PIL Images + metadata."""
    with open(path, "rb") as f:
        magic = f.read(4)
        if magic != b"MSF2":
            return None

        ver, flags = struct.unpack("<HH", f.read(4))
        cw, ch, nf, nd, fps = struct.unpack("<HHHBB", f.read(8))
        ax, ay = struct.unpack("<hh", f.read(4))
        _reserved = struct.unpack("<I", f.read(4))

        # Pixel format block
        bpp, pal_count, _pf_reserved = struct.unpack("<BHB", f.read(4))

        # Palette
        palette = []
        for _ in range(pal_count):
            r, g, b, a = struct.unpack("<BBBB", f.read(4))
            palette.append((r, g, b, a))
        while len(palette) < 256:
            palette.append((0, 0, 0, 255))

        # Frame table
        frames_meta = []
        for _ in range(nf):
            ox, oy, fw, fh, doff, dlen = struct.unpack("<hhHHII", f.read(16))
            frames_meta.append((ox, oy, fw, fh, doff, dlen))

        # Sentinel
        sentinel = f.read(4)
        _sentinel_reserved = f.read(4)

        # Compressed blob
        compressed = f.read()
        if not compressed:
            return None

        try:
            raw_blob = zstd.ZstdDecompressor().decompress(compressed, max_output_size=100_000_000)
        except Exception:
            return None

    # Decode frames
    images = []
    for ox, oy, fw, fh, doff, dlen in frames_meta:
        if fw == 0 or fh == 0 or dlen == 0:
            img = Image.new("RGBA", (max(cw, 1), max(ch, 1)), (0, 0, 0, 0))
            images.append(img)
            continue

        pixel_data = raw_blob[doff : doff + dlen]
        expected = fw * fh * 2  # Indexed8Alpha8 = 2bpp
        if len(pixel_data) < expected:
            img = Image.new("RGBA", (max(cw, 1), max(ch, 1)), (0, 0, 0, 0))
            images.append(img)
            continue

        # Decode Indexed8Alpha8
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        arr = np.zeros((fh, fw, 4), dtype=np.uint8)

        for y in range(fh):
            for x in range(fw):
                idx = (y * fw + x) * 2
                pal_idx = pixel_data[idx]
                alpha = pixel_data[idx + 1]
                if alpha > 0 and pal_idx < len(palette):
                    r, g, b, _ = palette[pal_idx]
                    arr[y, x] = [r, g, b, alpha]

        frame_img = Image.fromarray(arr)
        canvas.paste(frame_img, (ox, oy), frame_img)
        images.append(canvas)

    meta = {
        "canvas_w": cw, "canvas_h": ch,
        "frames": nf, "directions": nd, "fps": fps,
        "anchor_x": ax, "anchor_y": ay,
    }
    return images, meta


def classify_file(filename: str) -> tuple[str, str]:
    """Classify MSF file by name pattern, return (category, base_name)."""
    name = filename.replace(".msf", "")

    # mag016-3-烈火情天 -> supermode
    # mag016-2-烈火情天 -> vanish
    # mag016-1-烈火情天 -> flying
    # mag016-烈火情天s -> icon
    # mag016-烈火情天 -> magic
    parts = name.split("-")

    if len(parts) >= 3 and parts[1] == "3":
        return "supermode", parts[-1]
    elif len(parts) >= 3 and parts[1] == "2":
        return "vanish", parts[-1]
    elif len(parts) >= 3 and parts[1] == "1":
        return "flying", parts[-1]
    elif name.endswith("s"):
        return "icon", parts[-1][:-1] if parts[-1].endswith("s") else parts[-1]
    else:
        return "magic", parts[-1] if len(parts) >= 2 else name


def generate_caption(category: str, name: str, meta: dict, frame_idx: int) -> str:
    """Generate training caption for an image."""
    en_desc, zh_desc = CATEGORY_KEYWORDS.get(category, ("magic effect", "魔法效果"))

    w, h = meta["canvas_w"], meta["canvas_h"]
    dirs = meta["directions"]
    total_frames = meta["frames"]

    # Base description
    parts = [
        f"2D RPG game {en_desc} sprite",
        f"magic spell visual effect",
        f"transparent background",
        f"pixel art style",
        f"top-down view",
        f"clean edges",
    ]

    if category == "flying":
        fpd = total_frames // max(dirs, 1)
        progress = frame_idx % max(fpd, 1) / max(fpd - 1, 1)
        if dirs > 1:
            dir_idx = frame_idx // max(fpd, 1)
            parts.append(f"direction {dir_idx} of {dirs}")
        parts.append(f"animation frame {frame_idx % max(fpd,1) + 1} of {fpd}")
    elif category == "vanish":
        progress = frame_idx / max(total_frames - 1, 1)
        if progress < 0.3:
            parts.append("explosion initial burst")
        elif progress < 0.7:
            parts.append("explosion peak expanding")
        else:
            parts.append("explosion fading dispersing")
    elif category == "supermode":
        progress = frame_idx / max(total_frames - 1, 1)
        if progress < 0.3:
            parts.append("ultimate attack buildup")
        elif progress < 0.7:
            parts.append("ultimate attack peak power")
        else:
            parts.append("ultimate attack fading aftermath")
    elif category == "icon":
        parts = ["2D RPG game magic spell icon", "small thumbnail", "clean edges", "centered"]
    elif category == "magic":
        parts.append("character aura effect")

    return ", ".join(parts)


def export_training_data():
    """Export all magic MSF files as PNG + caption pairs."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    magic_dir = os.path.join(PROJECT_ROOT, "resources", "asf", "magic")
    effect_dir = os.path.join(PROJECT_ROOT, "resources", "asf", "effect")

    total_images = 0
    total_files = 0

    for src_dir in [magic_dir, effect_dir]:
        if not os.path.exists(src_dir):
            continue

        for fn in sorted(os.listdir(src_dir)):
            if not fn.endswith(".msf") or fn.startswith("demo"):
                continue

            path = os.path.join(src_dir, fn)
            result = decode_msf2(path)
            if result is None:
                print(f"  跳过 (解码失败): {fn}")
                continue

            images, meta = result
            category, base_name = classify_file(fn)

            # Create category subdirectory
            cat_dir = os.path.join(OUTPUT_DIR, category)
            os.makedirs(cat_dir, exist_ok=True)

            # For multi-direction assets, sample key frames (not all 256+)
            total_f = len(images)
            dirs = meta["directions"]
            fpd = total_f // max(dirs, 1)

            # Sample strategy:
            #   - icon/magic: export all (usually 1-5 frames)
            #   - flying: sample 1 per direction (first dir only if >8 dirs), max 16 frames
            #   - vanish: all frames (usually <30)
            #   - supermode: all frames
            if category in ("icon", "magic"):
                sample_indices = list(range(min(total_f, 8)))
            elif category == "flying":
                if fpd <= 1:
                    sample_indices = list(range(min(total_f, 16)))
                else:
                    # Sample all frames from direction 0, plus frame 0 from a few other directions
                    sample_indices = list(range(fpd))  # all frames dir 0
                    for d in range(1, min(dirs, 4)):
                        sample_indices.append(d * fpd)  # frame 0 of other dirs
            elif category == "vanish":
                sample_indices = list(range(min(total_f, 30)))
            elif category == "supermode":
                sample_indices = list(range(min(total_f, 65)))
            else:
                sample_indices = list(range(min(total_f, 20)))

            exported = 0
            for fi in sample_indices:
                if fi >= len(images):
                    continue

                img = images[fi]

                # Skip completely empty frames
                arr = np.array(img)
                if arr[:, :, 3].sum() == 0:
                    continue

                # Resize to 512x512 for SDXL training (pad to square, then resize)
                w, h = img.size
                max_dim = max(w, h)
                square = Image.new("RGBA", (max_dim, max_dim), (0, 0, 0, 0))
                square.paste(img, ((max_dim - w) // 2, (max_dim - h) // 2))
                resized = square.resize((512, 512), Image.LANCZOS)

                # Save image
                safe_name = base_name.replace("/", "_")
                img_name = f"{safe_name}_{category}_f{fi:03d}"
                img_path = os.path.join(cat_dir, f"{img_name}.png")
                resized.save(img_path)

                # Save caption
                caption = generate_caption(category, base_name, meta, fi)
                txt_path = os.path.join(cat_dir, f"{img_name}.txt")
                with open(txt_path, "w") as f:
                    f.write(caption)

                exported += 1

            if exported > 0:
                total_images += exported
                total_files += 1
                print(f"  {fn}: {exported} 张 ({category})")

    print(f"\n导出完成: {total_images} 张图片, 来自 {total_files} 个 MSF 文件")
    print(f"输出目录: {OUTPUT_DIR}")

    # Print stats
    for cat in os.listdir(OUTPUT_DIR):
        cat_path = os.path.join(OUTPUT_DIR, cat)
        if os.path.isdir(cat_path):
            pngs = [f for f in os.listdir(cat_path) if f.endswith(".png")]
            print(f"  {cat}/: {len(pngs)} 张")


if __name__ == "__main__":
    export_training_data()
