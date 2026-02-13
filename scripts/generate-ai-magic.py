#!/usr/bin/env python3
"""
AI 生成武功特效 + 自动转 MSF v2
================================

用法:
  python3 scripts/generate-ai-magic.py                    # 生成全部 10 套
  python3 scripts/generate-ai-magic.py --name 烈焰风暴     # 只生成一套
  python3 scripts/generate-ai-magic.py --list              # 列出所有武功

需要: pip install diffusers accelerate transformers safetensors Pillow numpy zstandard torch

RTX 4080 约 5-8 秒/张图, 每套武功约 1-2 分钟
"""

import argparse
import math
import os
import random
import struct
import sys
import time
from dataclasses import dataclass

import numpy as np
import torch
import zstandard as zstd
from PIL import Image, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUTPUT_ROOT = os.path.join(PROJECT_ROOT, "magic")


# ============================================================
# MSF v2 Writer (same as before)
# ============================================================

@dataclass
class MsfFrame:
    offset_x: int
    offset_y: int
    width: int
    height: int
    pixels: bytes


def write_msf2(
    path: str, canvas_w: int, canvas_h: int,
    directions: int, fps: int, anchor_x: int, anchor_y: int,
    palette: list[tuple[int, int, int, int]], frames: list[MsfFrame],
) -> None:
    blob_parts = []
    data_offset = 0
    frame_entries = []
    for f in frames:
        blob_parts.append(f.pixels)
        data_len = len(f.pixels)
        frame_entries.append((f.offset_x, f.offset_y, f.width, f.height, data_offset, data_len))
        data_offset += data_len
    raw_blob = b"".join(blob_parts)
    compressed_blob = zstd.ZstdCompressor(level=3).compress(raw_blob)
    with open(path, "wb") as out:
        out.write(b"MSF2")
        out.write(struct.pack("<HH", 2, 0x0001))
        out.write(struct.pack("<HHHBB", canvas_w, canvas_h, len(frames), directions, fps))
        out.write(struct.pack("<hh", anchor_x, anchor_y))
        out.write(struct.pack("<I", 0))
        out.write(struct.pack("<BHB", 2, len(palette), 0))
        for r, g, b, a in palette:
            out.write(struct.pack("<BBBB", r, g, b, a))
        for ox, oy, w, h, doff, dlen in frame_entries:
            out.write(struct.pack("<hhHHII", ox, oy, w, h, doff, dlen))
        out.write(b"END\x00")
        out.write(struct.pack("<I", 0))
        out.write(compressed_blob)


# ============================================================
# Image -> MSF Conversion
# ============================================================

def extract_palette(images: list[Image.Image], max_colors: int = 255) -> list[tuple[int, int, int, int]]:
    """Extract dominant colors from images using PIL quantize."""
    # Merge all images into one for global palette
    total_w = sum(img.width for img in images)
    max_h = max(img.height for img in images)
    merged = Image.new("RGBA", (total_w, max_h), (0, 0, 0, 0))
    x = 0
    for img in images:
        merged.paste(img, (x, 0))
        x += img.width

    # Quantize to get palette
    rgb = merged.convert("RGB")
    quantized = rgb.quantize(colors=max_colors, method=Image.Quantize.MEDIANCUT)
    pal_data = quantized.getpalette()

    palette = [(0, 0, 0, 255)]  # index 0 reserved
    if pal_data:
        for i in range(0, min(len(pal_data), max_colors * 3), 3):
            palette.append((pal_data[i], pal_data[i + 1], pal_data[i + 2], 255))

    while len(palette) < 256:
        palette.append((0, 0, 0, 255))
    return palette[:256]


def rgba_to_indexed(img: Image.Image, palette: list[tuple[int, int, int, int]]) -> bytes:
    """Convert RGBA image to Indexed8Alpha8 bytes."""
    arr = np.array(img)
    h, w = arr.shape[:2]
    pal_rgb = np.array([(r, g, b) for r, g, b, _ in palette], dtype=np.float32)
    result = bytearray(w * h * 2)

    # Vectorized nearest-color matching
    pixels = arr.reshape(-1, 4)
    rgb = pixels[:, :3].astype(np.float32)
    alpha = pixels[:, 3]

    # Process in chunks to avoid OOM
    chunk_size = 10000
    indices = np.zeros(len(rgb), dtype=np.uint8)
    for start in range(0, len(rgb), chunk_size):
        end = min(start + chunk_size, len(rgb))
        chunk = rgb[start:end]
        dists = np.sum((chunk[:, np.newaxis, :] - pal_rgb[np.newaxis, :, :]) ** 2, axis=2)
        indices[start:end] = np.argmin(dists, axis=1).astype(np.uint8)

    for i in range(len(pixels)):
        off = i * 2
        if alpha[i] == 0:
            result[off] = 0
            result[off + 1] = 0
        else:
            result[off] = indices[i]
            result[off + 1] = alpha[i]

    return bytes(result)


def images_to_msf(
    images: list[Image.Image],
    palette: list[tuple[int, int, int, int]],
    canvas_w: int, canvas_h: int,
    directions: int, fps: int,
    anchor_x: int, anchor_y: int,
    path: str,
) -> None:
    """Convert a list of RGBA images to MSF file."""
    frames = []
    for img in images:
        # Resize if needed
        if img.size != (canvas_w, canvas_h):
            img = img.resize((canvas_w, canvas_h), Image.LANCZOS)
        pixels = rgba_to_indexed(img, palette)
        frames.append(MsfFrame(0, 0, canvas_w, canvas_h, pixels))

    write_msf2(path, canvas_w, canvas_h, directions, fps, anchor_x, anchor_y, palette, frames)


# ============================================================
# AI Image Generation
# ============================================================

_pipe = None


def get_pipeline():
    """Lazy-load the Stable Diffusion pipeline."""
    global _pipe
    if _pipe is not None:
        return _pipe

    from diffusers import StableDiffusionXLPipeline

    print("[AI] 加载 SDXL 模型... (首次需要下载 ~6.5GB)")
    _pipe = StableDiffusionXLPipeline.from_pretrained(
        "stabilityai/stable-diffusion-xl-base-1.0",
        torch_dtype=torch.float16,
        variant="fp16",
        use_safetensors=True,
    )
    _pipe.to("cuda")

    # Enable memory optimizations
    _pipe.enable_attention_slicing()
    try:
        _pipe.enable_xformers_memory_efficient_attention()
    except Exception:
        pass  # xformers not installed, fine

    print("[AI] 模型加载完成")
    return _pipe


def generate_vfx_image(
    prompt: str,
    negative_prompt: str = "",
    width: int = 512,
    height: int = 512,
    steps: int = 25,
    guidance: float = 7.5,
    seed: int = -1,
) -> Image.Image:
    """Generate a single VFX image using SDXL."""
    pipe = get_pipeline()

    if seed < 0:
        seed = random.randint(0, 2**32 - 1)
    generator = torch.Generator(device="cuda").manual_seed(seed)

    # Common VFX prompt suffixes
    full_prompt = f"{prompt}, 2D game visual effect, sprite art, transparent background, magic spell effect, top-down RPG, clean edges, centered composition, dark background"
    full_negative = f"text, watermark, logo, UI elements, realistic photo, 3D render, blurry, low quality, {negative_prompt}"

    result = pipe(
        prompt=full_prompt,
        negative_prompt=full_negative,
        width=width,
        height=height,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    )
    return result.images[0]


def remove_background(img: Image.Image, threshold: int = 30) -> Image.Image:
    """Remove dark background, making it transparent (for VFX on dark bg)."""
    arr = np.array(img.convert("RGBA"))
    # Calculate brightness
    brightness = arr[:, :, :3].astype(float).sum(axis=2) / 3
    # Dark pixels become transparent
    alpha = np.clip((brightness - threshold) * (255 / max(255 - threshold, 1)), 0, 255).astype(np.uint8)
    arr[:, :, 3] = alpha
    return Image.fromarray(arr)


def generate_variant_frames(
    base_prompt: str,
    count: int,
    width: int = 512,
    height: int = 512,
    seed_base: int = 42,
    steps: int = 20,
) -> list[Image.Image]:
    """Generate multiple variant frames with slightly different seeds."""
    frames = []
    for i in range(count):
        print(f"    帧 {i + 1}/{count}...", end=" ", flush=True)
        t0 = time.time()
        img = generate_vfx_image(
            base_prompt,
            width=width, height=height,
            seed=seed_base + i,
            steps=steps,
        )
        img = remove_background(img)
        frames.append(img)
        print(f"{time.time() - t0:.1f}s")
    return frames


def duplicate_for_directions(frames: list[Image.Image], directions: int) -> list[Image.Image]:
    """Duplicate frames for multiple directions with rotation."""
    if directions <= 1:
        return frames

    all_frames = []
    for d in range(directions):
        angle = -d * (360 / directions)  # Rotate for each direction
        for frame in frames:
            rotated = frame.rotate(angle, resample=Image.BICUBIC, expand=False)
            all_frames.append(rotated)
    return all_frames


# ============================================================
# Magic Definitions
# ============================================================

@dataclass
class MagicDef:
    name: str
    seed: int
    magic_prompt: str      # 武功图像 prompt
    icon_prompt: str       # 图标 prompt
    flying_prompt: str     # 飞行特效 prompt
    vanish_prompt: str     # 爆炸特效 prompt
    super_prompt: str      # 大招特效 prompt


MAGICS = [
    MagicDef(
        name="烈焰风暴",
        seed=100,
        magic_prompt="intense fire aura surrounding a character, red and orange flames swirling upward, ember particles",
        icon_prompt="small fire icon, burning flame symbol, red orange glow, miniature",
        flying_prompt="blazing fireball projectile with trailing flames, orange red fire comet, motion blur trail",
        vanish_prompt="massive fire explosion burst, red orange expanding shockwave, sparks flying outward, debris",
        super_prompt="enormous fire storm filling entire screen, pillars of flame erupting from ground, apocalyptic inferno, epic scale",
    ),
    MagicDef(
        name="冰霜寒光",
        seed=200,
        magic_prompt="ice crystal aura around character, frost particles floating, blue white cold mist, frozen energy",
        icon_prompt="small ice crystal icon, snowflake symbol, blue white frost glow, miniature",
        flying_prompt="ice shard projectile with frost trail, frozen crystal spear flying, blue white cold energy",
        vanish_prompt="ice explosion shattering outward, frozen shards bursting, blue white frost shockwave, crystal fragments",
        super_prompt="massive blizzard storm filling screen, ice pillars erupting, frozen landscape, blue white epic scale winter",
    ),
    MagicDef(
        name="雷霆万钧",
        seed=300,
        magic_prompt="electric lightning aura crackling around body, purple yellow thunderbolts, static energy field",
        icon_prompt="small lightning bolt icon, thunder symbol, electric purple yellow glow, miniature",
        flying_prompt="ball lightning projectile with electric arcs, purple thunder bolt flying, crackling energy trail",
        vanish_prompt="lightning strike explosion, electric discharge burst outward, purple yellow thunderbolts radiating, plasma",
        super_prompt="massive thunderstorm with multiple lightning strikes, electric field across entire screen, purple yellow apocalyptic storm",
    ),
    MagicDef(
        name="毒雾迷障",
        seed=400,
        magic_prompt="poisonous green mist aura, toxic smoke swirling around body, purple green miasma bubbles",
        icon_prompt="small poison skull icon, toxic green glow symbol, miniature venom drop",
        flying_prompt="poison gas cloud projectile, green toxic orb with dripping acid trail, venomous energy ball",
        vanish_prompt="toxic gas explosion expanding, green purple poison cloud burst, acid splash, corrosive mist",
        super_prompt="massive poison fog covering entire screen, toxic swamp gas eruption, green purple miasma, desolate atmosphere",
    ),
    MagicDef(
        name="圣光护体",
        seed=500,
        magic_prompt="holy golden light shield aura, divine radiance surrounding body, sacred halo, warm glow particles",
        icon_prompt="small holy cross icon, golden divine light symbol, sacred glow, miniature",
        flying_prompt="golden holy light beam projectile, divine energy orb with radiant trail, sacred bolt",
        vanish_prompt="holy light explosion, golden radiance burst expanding, divine energy shockwave, purifying flash",
        super_prompt="massive divine revelation filling screen, pillars of holy light descending from heaven, golden sacred energy, epic angelic",
    ),
    MagicDef(
        name="暗影噬魂",
        seed=600,
        magic_prompt="dark shadow energy aura, purple black soul-consuming darkness, ghostly wisps, void energy",
        icon_prompt="small dark skull icon, shadow void symbol, purple black glow, miniature sinister",
        flying_prompt="dark shadow projectile with ghost trail, purple black soul orb flying, ethereal shadow energy",
        vanish_prompt="shadow explosion imploding then expanding, dark void burst, purple black energy tendrils, soul fragments",
        super_prompt="massive shadow realm consuming entire screen, dark void portal, purple black ethereal souls, gothic apocalypse",
    ),
    MagicDef(
        name="风刃旋涡",
        seed=700,
        magic_prompt="wind blade energy swirling, cyan white tornado aura, air current slashes, breeze particles",
        icon_prompt="small wind spiral icon, tornado symbol, cyan white glow, miniature swirl",
        flying_prompt="wind blade crescent projectile, cyan white air slash flying, sharp wind energy with speed lines",
        vanish_prompt="wind explosion dispersing outward, cyan air shockwave burst, scattered wind blades, dust debris",
        super_prompt="massive tornado cyclone filling screen, wind blades everywhere, cyan white hurricane, devastating windstorm",
    ),
    MagicDef(
        name="血焰狂舞",
        seed=800,
        magic_prompt="blood red flame aura, dark crimson fire dancing wildly, sinister red energy, blood mist",
        icon_prompt="small blood drop icon, crimson fire symbol, dark red glow, miniature",
        flying_prompt="blood fire projectile with crimson trail, dark red flame sphere flying, sinister energy",
        vanish_prompt="blood explosion burst, dark crimson fire expanding violently, red mist shockwave, burning debris",
        super_prompt="massive blood fire inferno covering screen, dark crimson flames consuming everything, hellish atmosphere, epic destruction",
    ),
    MagicDef(
        name="星陨天降",
        seed=900,
        magic_prompt="meteor golden energy aura, cosmic star particles orbiting body, celestial amber glow, stardust",
        icon_prompt="small falling star icon, meteor golden symbol, cosmic glow, miniature",
        flying_prompt="blazing meteor projectile with stardust trail, golden cosmic fireball flying, celestial energy",
        vanish_prompt="meteor impact explosion, golden stardust burst expanding, cosmic shockwave, crater debris",
        super_prompt="massive meteor shower filling screen, multiple celestial bodies falling, golden cosmic apocalypse, epic scale destruction",
    ),
    MagicDef(
        name="碧波浮光",
        seed=1000,
        magic_prompt="water wave energy aura, teal cyan flowing water around body, aquatic bubble particles, ocean energy",
        icon_prompt="small water drop icon, wave symbol, teal cyan glow, miniature",
        flying_prompt="water sphere projectile with flowing trail, teal cyan water orb flying, aquatic energy stream",
        vanish_prompt="water explosion splashing outward, teal cyan wave burst, water drops scattering, foam mist",
        super_prompt="massive tidal wave flooding entire screen, water pillars erupting, teal cyan ocean storm, epic deluge",
    ),
]


# ============================================================
# Main
# ============================================================

def generate_one_magic(magic: MagicDef) -> None:
    """Generate one complete magic set."""
    magic_dir = os.path.join(OUTPUT_ROOT, magic.name)
    preview_dir = os.path.join(magic_dir, "preview")
    os.makedirs(preview_dir, exist_ok=True)

    all_images = []
    t_start = time.time()

    # 1. 武功图像 (1 frame, resize to 64x80, 8 dirs)
    print(f"\n  [1/5] 武功图像 magic.msf")
    magic_imgs = generate_variant_frames(magic.magic_prompt, 1, seed_base=magic.seed, steps=25)
    all_images.extend(magic_imgs)
    for i, img in enumerate(magic_imgs):
        img.save(os.path.join(preview_dir, f"magic-f{i}.png"))

    # 2. 图标 (1 frame, 32x40, 8 dirs)
    print(f"  [2/5] 武功图标 magic-icon.msf")
    icon_imgs = generate_variant_frames(magic.icon_prompt, 1, seed_base=magic.seed + 50, steps=20)
    all_images.extend(icon_imgs)
    for i, img in enumerate(icon_imgs):
        img.save(os.path.join(preview_dir, f"icon-f{i}.png"))

    # 3. 飞行特效 (6 frames per direction, 16 dirs -> generate 6 base frames)
    print(f"  [3/5] 飞行图像 flying.msf")
    fly_imgs = generate_variant_frames(magic.flying_prompt, 6, seed_base=magic.seed + 100, steps=20)
    all_images.extend(fly_imgs)
    for i, img in enumerate(fly_imgs):
        img.save(os.path.join(preview_dir, f"flying-f{i}.png"))

    # 4. 消失特效 (8 frames, 1 dir)
    print(f"  [4/5] 消失图像 vanish.msf")
    vanish_prompts = [
        f"{magic.vanish_prompt}, initial flash, energy gathering",
        f"{magic.vanish_prompt}, expanding bright core, early stage",
        f"{magic.vanish_prompt}, peak explosion, maximum intensity",
        f"{magic.vanish_prompt}, large explosion ring expanding",
        f"{magic.vanish_prompt}, shockwave spreading, debris flying",
        f"{magic.vanish_prompt}, fading explosion, scattered particles",
        f"{magic.vanish_prompt}, dissipating smoke and embers",
        f"{magic.vanish_prompt}, final fading wisps, nearly gone",
    ]
    vanish_imgs = []
    for vi, vp in enumerate(vanish_prompts):
        print(f"    帧 {vi + 1}/{len(vanish_prompts)}...", end=" ", flush=True)
        t0 = time.time()
        img = generate_vfx_image(vp, seed=magic.seed + 200 + vi, steps=20)
        img = remove_background(img)
        vanish_imgs.append(img)
        print(f"{time.time() - t0:.1f}s")
    all_images.extend(vanish_imgs)
    for i, img in enumerate(vanish_imgs):
        img.save(os.path.join(preview_dir, f"vanish-f{i:02d}.png"))

    # 5. 超级模式 (6 key frames, 1 dir)
    print(f"  [5/5] 超级模式 supermode.msf")
    super_prompts = [
        f"{magic.super_prompt}, energy gathering, buildup phase, dark before storm",
        f"{magic.super_prompt}, eruption beginning, energy breaking out",
        f"{magic.super_prompt}, full power, maximum intensity, devastating",
        f"{magic.super_prompt}, peak destruction, screen filled with energy",
        f"{magic.super_prompt}, energy subsiding, aftermath",
        f"{magic.super_prompt}, final fade, remnant energy wisps",
    ]
    super_imgs = []
    for si, sp in enumerate(super_prompts):
        print(f"    帧 {si + 1}/{len(super_prompts)}...", end=" ", flush=True)
        t0 = time.time()
        img = generate_vfx_image(sp, width=768, height=512, seed=magic.seed + 300 + si, steps=25)
        img = remove_background(img)
        super_imgs.append(img)
        print(f"{time.time() - t0:.1f}s")
    all_images.extend(super_imgs)
    for i, img in enumerate(super_imgs):
        img.save(os.path.join(preview_dir, f"super-f{i:02d}.png"))

    # Extract global palette from all generated images
    print(f"  [转换] 提取调色板 & 写入 MSF...")
    palette = extract_palette(all_images)

    # Write MSF files
    # 1. magic.msf: 64x80, 8 dirs, 1 frame (same frame for all dirs)
    resized = [img.resize((64, 80), Image.LANCZOS) for img in magic_imgs]
    all_dir_frames = resized * 8  # same frame for 8 directions
    images_to_msf(all_dir_frames, palette, 64, 80, 8, 16, 0, 0,
                  os.path.join(magic_dir, "magic.msf"))

    # 2. icon.msf: 32x40, 8 dirs
    resized = [img.resize((32, 40), Image.LANCZOS) for img in icon_imgs]
    all_dir_frames = resized * 8
    images_to_msf(all_dir_frames, palette, 32, 40, 8, 16, 0, 0,
                  os.path.join(magic_dir, "magic-icon.msf"))

    # 3. flying.msf: 100x100, 16 dirs, 6 frames/dir
    resized = [img.resize((100, 100), Image.LANCZOS) for img in fly_imgs]
    all_fly = duplicate_for_directions(resized, 16)
    images_to_msf(all_fly, palette, 100, 100, 16, 16, 50, 70,
                  os.path.join(magic_dir, "flying.msf"))

    # 4. vanish.msf: 96x96, 1 dir
    resized = [img.resize((96, 96), Image.LANCZOS) for img in vanish_imgs]
    images_to_msf(resized, palette, 96, 96, 1, 30, 48, 76,
                  os.path.join(magic_dir, "vanish.msf"))

    # 5. supermode.msf: 280x160, 1 dir
    resized = [img.resize((280, 160), Image.LANCZOS) for img in super_imgs]
    images_to_msf(resized, palette, 280, 160, 1, 16, 140, 104,
                  os.path.join(magic_dir, "supermode.msf"))

    elapsed = time.time() - t_start
    msf_files = [f for f in os.listdir(magic_dir) if f.endswith('.msf')]
    total_bytes = sum(os.path.getsize(os.path.join(magic_dir, f)) for f in msf_files)
    print(f"\n  完成! {len(msf_files)} MSF, {total_bytes:,} bytes, 耗时 {elapsed:.0f}s")


def main():
    parser = argparse.ArgumentParser(description="AI 生成武功特效 MSF")
    parser.add_argument("--name", type=str, help="只生成指定名字的武功")
    parser.add_argument("--list", action="store_true", help="列出全部武功")
    parser.add_argument("--index", type=int, help="只生成第 N 套 (1-10)")
    args = parser.parse_args()

    if args.list:
        for i, m in enumerate(MAGICS):
            print(f"  {i + 1}. {m.name}")
        return

    targets = MAGICS
    if args.name:
        targets = [m for m in MAGICS if m.name == args.name]
        if not targets:
            print(f"未找到武功: {args.name}")
            print("可用:", ", ".join(m.name for m in MAGICS))
            return
    elif args.index:
        if 1 <= args.index <= len(MAGICS):
            targets = [MAGICS[args.index - 1]]
        else:
            print(f"索引超出范围: {args.index} (1-{len(MAGICS)})")
            return

    print("=" * 60)
    print(f"AI 武功特效生成器 (SDXL)")
    print(f"目标: {len(targets)} 套武功")
    print("=" * 60)

    for i, magic in enumerate(targets):
        print(f"\n{'━' * 50}")
        print(f"[{i + 1}/{len(targets)}] {magic.name}")
        print(f"{'━' * 50}")
        generate_one_magic(magic)

    print(f"\n{'=' * 60}")
    print("全部完成! 输出目录:")
    for m in targets:
        d = os.path.join(OUTPUT_ROOT, m.name)
        if os.path.exists(d):
            msf = [f for f in os.listdir(d) if f.endswith('.msf')]
            total = sum(os.path.getsize(os.path.join(d, f)) for f in msf)
            print(f"  magic/{m.name}/  ({len(msf)} MSF, {total:,} bytes)")
            print(f"    preview/ 下有 PNG 预览")
    print("=" * 60)


if __name__ == "__main__":
    main()
