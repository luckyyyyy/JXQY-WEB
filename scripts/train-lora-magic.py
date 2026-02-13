#!/usr/bin/env python3
"""
用游戏现有武功素材 LoRA 微调 SDXL，然后用微调后的模型生成新武功。

用法:
  # Step 1. 训练 LoRA (约 30-60 分钟, RTX 4080)
  python3 scripts/train-lora-magic.py train

  # Step 2. 用微调模型生成新武功
  python3 scripts/train-lora-magic.py generate --name 烈焰风暴
  python3 scripts/train-lora-magic.py generate --all

  # 查看训练进度
  python3 scripts/train-lora-magic.py status
"""

import argparse
import gc
import math
import os
import random
import struct
import sys
import time
from pathlib import Path

# Force unbuffered output (critical for log capture)
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)
os.environ["PYTHONUNBUFFERED"] = "1"

import numpy as np
import torch
import zstandard as zstd
from PIL import Image

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent
TRAINING_DIR = PROJECT_ROOT / "magic" / "_training_data"
LORA_OUTPUT = PROJECT_ROOT / "magic" / "_lora_model"
MAGIC_OUTPUT = PROJECT_ROOT / "magic"

# Trigger word for the LoRA
TRIGGER_WORD = "jxqy_magic_vfx"

# ============================================================
# Training
# ============================================================

def prepare_metadata():
    """Create metadata.jsonl for the training dataset."""
    import json
    entries = []

    for category in ["flying", "vanish", "supermode", "magic", "icon"]:
        cat_dir = TRAINING_DIR / category
        if not cat_dir.exists():
            continue
        for png in sorted(cat_dir.glob("*.png")):
            txt = png.with_suffix(".txt")
            if txt.exists():
                caption = txt.read_text().strip()
            else:
                caption = f"{TRIGGER_WORD}, 2D RPG game magic effect sprite"

            # Prepend trigger word
            full_caption = f"{TRIGGER_WORD}, {caption}"
            entries.append({
                "file_name": f"{category}/{png.name}",
                "text": full_caption,
            })

    metadata_path = TRAINING_DIR / "metadata.jsonl"
    with open(metadata_path, "w") as f:
        for entry in entries:
            f.write(json.dumps(entry) + "\n")

    print(f"创建 metadata.jsonl: {len(entries)} 条记录")
    return len(entries)


def train_lora():
    """Train LoRA on the extracted magic VFX dataset.

    Memory optimization strategy:
    1. Pre-compute ALL latents + text embeddings, store in RAM
    2. Delete VAE + text encoders to free ~3GB VRAM
    3. Train UNet with LoRA only → fits in 16GB VRAM with gradient checkpointing
    """
    from diffusers import AutoencoderKL, DDPMScheduler, UNet2DConditionModel
    from peft import LoraConfig, get_peft_model
    from torch.utils.data import Dataset, DataLoader
    from torchvision import transforms
    from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer

    print("=" * 60)
    print("LoRA 微调 SDXL - 游戏武功特效")
    print("=" * 60)

    # Prepare dataset metadata
    n_samples = prepare_metadata()

    # Training hyperparameters
    BATCH_SIZE = 1
    GRADIENT_ACCUMULATION = 4
    LEARNING_RATE = 1e-4
    NUM_EPOCHS = 15
    LORA_RANK = 16
    LORA_ALPHA = 16
    MAX_TRAIN_STEPS = min(n_samples * NUM_EPOCHS // (BATCH_SIZE * GRADIENT_ACCUMULATION), 3000)
    SAVE_EVERY = 500

    print(f"样本数: {n_samples}")
    print(f"LoRA Rank: {LORA_RANK}")
    print(f"学习率: {LEARNING_RATE}")
    print(f"Batch Size: {BATCH_SIZE} x {GRADIENT_ACCUMULATION} grad accum")
    print(f"总训练步数: {MAX_TRAIN_STEPS}")
    print(f"触发词: {TRIGGER_WORD}")

    model_id = "stabilityai/stable-diffusion-xl-base-1.0"
    device = torch.device("cuda")

    # ── Phase 1: Pre-compute latents (VAE encode) ──────────────────
    print("\n[Phase 1/3] 预计算 VAE latents...")

    transform = transforms.Compose([
        transforms.Resize((512, 512)),
        transforms.RandomHorizontalFlip(0.5),
        transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.5], [0.5]),
    ])

    # Load metadata
    import json
    entries = []
    metadata_path = TRAINING_DIR / "metadata.jsonl"
    with open(metadata_path) as f:
        for line in f:
            entry = json.loads(line.strip())
            img_path = TRAINING_DIR / entry["file_name"]
            if img_path.exists():
                entries.append((str(img_path), entry["text"]))
    print(f"  有效样本: {len(entries)}")

    vae = AutoencoderKL.from_pretrained(model_id, subfolder="vae", torch_dtype=torch.bfloat16)
    vae.to(device)
    vae.eval()

    all_latents = []
    all_captions = []
    t0 = time.time()
    for i, (img_path, caption) in enumerate(entries):
        img = Image.open(img_path).convert("RGB")
        tensor = transform(img).unsqueeze(0).to(device, dtype=torch.bfloat16)
        with torch.no_grad():
            latent = vae.encode(tensor).latent_dist.sample() * vae.config.scaling_factor
        all_latents.append(latent.squeeze(0).cpu())  # Store in CPU RAM
        all_captions.append(caption)
        if (i + 1) % 200 == 0:
            print(f"  编码: {i+1}/{len(entries)}")

    del vae
    gc.collect()
    torch.cuda.empty_cache()
    print(f"  完成 VAE 编码: {len(all_latents)} latents ({time.time()-t0:.1f}s)")

    # ── Phase 2: Pre-compute text embeddings ───────────────────────
    print("\n[Phase 2/3] 预计算文本 embeddings...")

    tokenizer_one = CLIPTokenizer.from_pretrained(model_id, subfolder="tokenizer")
    tokenizer_two = CLIPTokenizer.from_pretrained(model_id, subfolder="tokenizer_2")
    text_encoder_one = CLIPTextModel.from_pretrained(model_id, subfolder="text_encoder", torch_dtype=torch.bfloat16).to(device)
    text_encoder_two = CLIPTextModelWithProjection.from_pretrained(model_id, subfolder="text_encoder_2", torch_dtype=torch.bfloat16).to(device)
    text_encoder_one.eval()
    text_encoder_two.eval()

    all_prompt_embeds = []
    all_pooled_embeds = []
    t0 = time.time()
    for i, caption in enumerate(all_captions):
        with torch.no_grad():
            tokens_one = tokenizer_one(
                [caption], padding="max_length", max_length=tokenizer_one.model_max_length,
                truncation=True, return_tensors="pt"
            ).input_ids.to(device)
            tokens_two = tokenizer_two(
                [caption], padding="max_length", max_length=tokenizer_two.model_max_length,
                truncation=True, return_tensors="pt"
            ).input_ids.to(device)

            enc_out_one = text_encoder_one(tokens_one, output_hidden_states=True)
            enc_out_two = text_encoder_two(tokens_two, output_hidden_states=True)

            text_embeds_one = enc_out_one.hidden_states[-2]
            text_embeds_two = enc_out_two.hidden_states[-2]
            pooled = enc_out_two[0]

            prompt_embeds = torch.cat([text_embeds_one, text_embeds_two], dim=-1)
            all_prompt_embeds.append(prompt_embeds.squeeze(0).cpu())
            all_pooled_embeds.append(pooled.squeeze(0).cpu())

        if (i + 1) % 200 == 0:
            print(f"  编码: {i+1}/{len(all_captions)}")

    del text_encoder_one, text_encoder_two, tokenizer_one, tokenizer_two
    gc.collect()
    torch.cuda.empty_cache()
    print(f"  完成文本编码: {len(all_prompt_embeds)} embeddings ({time.time()-t0:.1f}s)")

    # Print GPU memory after cleanup
    mem_alloc = torch.cuda.memory_allocated() / 1024**3
    mem_reserved = torch.cuda.memory_reserved() / 1024**3
    print(f"  GPU 显存: {mem_alloc:.1f}GB allocated, {mem_reserved:.1f}GB reserved")

    # ── Phase 3: Train UNet LoRA ───────────────────────────────────
    print("\n[Phase 3/3] 训练 UNet LoRA...")

    unet = UNet2DConditionModel.from_pretrained(model_id, subfolder="unet", torch_dtype=torch.bfloat16)

    # Enable gradient checkpointing BEFORE LoRA to save memory
    unet.enable_gradient_checkpointing()

    lora_config = LoraConfig(
        r=LORA_RANK,
        lora_alpha=LORA_ALPHA,
        init_lora_weights="gaussian",
        target_modules=["to_k", "to_q", "to_v", "to_out.0"],
    )
    unet = get_peft_model(unet, lora_config)
    unet.print_trainable_parameters()
    unet.to(device)
    unet.train()

    mem_alloc = torch.cuda.memory_allocated() / 1024**3
    print(f"  UNet 加载后 GPU 显存: {mem_alloc:.1f}GB")

    # Noise scheduler
    noise_scheduler = DDPMScheduler.from_pretrained(model_id, subfolder="scheduler")

    # Optimizer (only LoRA params)
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, unet.parameters()),
        lr=LEARNING_RATE,
        weight_decay=1e-2,
    )
    lr_scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=MAX_TRAIN_STEPS)

    # Pre-computed dataset for training
    class PrecomputedDataset(Dataset):
        def __init__(self, latents, prompt_embeds, pooled_embeds):
            self.latents = latents
            self.prompt_embeds = prompt_embeds
            self.pooled_embeds = pooled_embeds

        def __len__(self):
            return len(self.latents)

        def __getitem__(self, idx):
            return self.latents[idx], self.prompt_embeds[idx], self.pooled_embeds[idx]

    dataset = PrecomputedDataset(all_latents, all_prompt_embeds, all_pooled_embeds)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, drop_last=True)
    print(f"  数据集: {len(dataset)} 样本, DataLoader 准备完毕")

    # Training loop
    os.makedirs(LORA_OUTPUT, exist_ok=True)
    global_step = 0
    best_loss = float("inf")
    loss_history = []
    running_loss = 0.0
    running_steps = 0

    print(f"\n  开始训练循环 (max {MAX_TRAIN_STEPS} steps)...")
    t_start = time.time()

    add_time_ids = torch.tensor([[512, 512, 0, 0, 512, 512]], device=device, dtype=torch.bfloat16)

    for epoch in range(NUM_EPOCHS):
        epoch_loss = 0.0
        epoch_steps = 0

        for batch_idx, (latents, prompt_embeds, pooled_embeds) in enumerate(dataloader):
            if global_step >= MAX_TRAIN_STEPS:
                break

            latents = latents.to(device)
            prompt_embeds = prompt_embeds.to(device)
            pooled_embeds = pooled_embeds.to(device)

            # Add noise in bf16 (bf16 has fp32-equivalent exponent range, no NaN risk)
            noise = torch.randn_like(latents)  # bf16 like latents
            bsz = latents.shape[0]
            timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (bsz,), device=device).long()
            noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

            # SDXL added condition
            time_ids = add_time_ids.repeat(bsz, 1)

            # Forward (everything in bf16, no autocast needed)
            noise_pred = unet(
                noisy_latents,
                timesteps,
                encoder_hidden_states=prompt_embeds,
                added_cond_kwargs={"text_embeds": pooled_embeds, "time_ids": time_ids},
            ).sample

            # Loss in fp32 for precision
            loss = torch.nn.functional.mse_loss(noise_pred.float(), noise.float())
            loss = loss / GRADIENT_ACCUMULATION
            loss.backward()

            epoch_loss += loss.item() * GRADIENT_ACCUMULATION
            epoch_steps += 1
            running_loss += loss.item() * GRADIENT_ACCUMULATION
            running_steps += 1

            if (batch_idx + 1) % GRADIENT_ACCUMULATION == 0:
                torch.nn.utils.clip_grad_norm_(unet.parameters(), 1.0)
                optimizer.step()
                lr_scheduler.step()
                optimizer.zero_grad()
                global_step += 1

                if global_step % 10 == 0:
                    avg = running_loss / max(running_steps, 1)
                    elapsed = time.time() - t_start
                    eta = elapsed / global_step * (MAX_TRAIN_STEPS - global_step) if global_step > 0 else 0
                    mem = torch.cuda.memory_allocated() / 1024**3
                    print(f"  Step {global_step:4d}/{MAX_TRAIN_STEPS} | Loss: {avg:.4f} | LR: {lr_scheduler.get_last_lr()[0]:.2e} | {elapsed:.0f}s | ETA: {eta:.0f}s | VRAM: {mem:.1f}GB")
                    running_loss = 0.0
                    running_steps = 0

                if global_step % SAVE_EVERY == 0:
                    save_path = LORA_OUTPUT / f"checkpoint-{global_step}"
                    unet.save_pretrained(str(save_path))
                    print(f"  ★ 保存 checkpoint: {save_path}")

        if global_step >= MAX_TRAIN_STEPS:
            break

        avg_epoch_loss = epoch_loss / max(epoch_steps, 1)
        loss_history.append(avg_epoch_loss)
        elapsed = time.time() - t_start
        print(f"  Epoch {epoch + 1}/{NUM_EPOCHS} 完成 | Avg Loss: {avg_epoch_loss:.4f} | {elapsed:.0f}s")

    # Save final model
    final_path = LORA_OUTPUT / "final"
    unet.save_pretrained(str(final_path))

    elapsed = time.time() - t_start
    print(f"\n{'=' * 60}")
    print(f"训练完成! 耗时 {elapsed / 60:.1f} 分钟")
    print(f"总步数: {global_step}")
    print(f"模型保存: {final_path}")
    print(f"Loss 历史: {[f'{l:.4f}' for l in loss_history]}")
    print(f"{'=' * 60}")

    # Save training info
    info_path = LORA_OUTPUT / "training_info.txt"
    with open(info_path, "w") as f:
        f.write(f"trigger_word: {TRIGGER_WORD}\n")
        f.write(f"lora_rank: {LORA_RANK}\n")
        f.write(f"lora_alpha: {LORA_ALPHA}\n")
        f.write(f"learning_rate: {LEARNING_RATE}\n")
        f.write(f"train_steps: {global_step}\n")
        f.write(f"samples: {n_samples}\n")
        f.write(f"training_time: {elapsed:.0f}s\n")
        f.write(f"loss_history: {loss_history}\n")

    # Cleanup
    del unet
    gc.collect()
    torch.cuda.empty_cache()


# ============================================================
# MSF Writer (compact version)
# ============================================================

def write_msf2(path, canvas_w, canvas_h, directions, fps, anchor_x, anchor_y, palette, frames):
    blob_parts, data_offset, frame_entries = [], 0, []
    for f in frames:
        blob_parts.append(f["pixels"])
        dl = len(f["pixels"])
        frame_entries.append((f["ox"], f["oy"], f["w"], f["h"], data_offset, dl))
        data_offset += dl
    raw = b"".join(blob_parts)
    compressed = zstd.ZstdCompressor(level=3).compress(raw)
    with open(path, "wb") as out:
        out.write(b"MSF2")
        out.write(struct.pack("<HH", 2, 0x0001))
        out.write(struct.pack("<HHHBB", canvas_w, canvas_h, len(frame_entries), directions, fps))
        out.write(struct.pack("<hh", anchor_x, anchor_y))
        out.write(struct.pack("<I", 0))
        out.write(struct.pack("<BHB", 2, len(palette), 0))
        for r, g, b, a in palette:
            out.write(struct.pack("<BBBB", r, g, b, a))
        for ox, oy, w, h, doff, dl in frame_entries:
            out.write(struct.pack("<hhHHII", ox, oy, w, h, doff, dl))
        out.write(b"END\x00")
        out.write(struct.pack("<I", 0))
        out.write(compressed)


def extract_palette(images, max_colors=255):
    total_w = sum(img.width for img in images)
    max_h = max(img.height for img in images)
    merged = Image.new("RGBA", (total_w, max_h), (0, 0, 0, 0))
    x = 0
    for img in images:
        merged.paste(img, (x, 0))
        x += img.width
    rgb = merged.convert("RGB")
    q = rgb.quantize(colors=max_colors, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()
    palette = [(0, 0, 0, 255)]
    if pal:
        for i in range(0, min(len(pal), max_colors * 3), 3):
            palette.append((pal[i], pal[i + 1], pal[i + 2], 255))
    while len(palette) < 256:
        palette.append((0, 0, 0, 255))
    return palette[:256]


def rgba_to_indexed(img, palette):
    arr = np.array(img)
    h, w = arr.shape[:2]
    pal_rgb = np.array([(r, g, b) for r, g, b, _ in palette], dtype=np.float32)
    pixels = arr.reshape(-1, 4)
    rgb = pixels[:, :3].astype(np.float32)
    alpha = pixels[:, 3]
    indices = np.zeros(len(rgb), dtype=np.uint8)
    for start in range(0, len(rgb), 10000):
        end = min(start + 10000, len(rgb))
        dists = np.sum((rgb[start:end, np.newaxis, :] - pal_rgb[np.newaxis, :, :]) ** 2, axis=2)
        indices[start:end] = np.argmin(dists, axis=1).astype(np.uint8)
    result = bytearray(len(pixels) * 2)
    for i in range(len(pixels)):
        off = i * 2
        if alpha[i] == 0:
            result[off] = 0
            result[off + 1] = 0
        else:
            result[off] = indices[i]
            result[off + 1] = alpha[i]
    return bytes(result)


# ============================================================
# Animation frame generation from a single base image
# ============================================================

def _transform_frame(img, angle=0, scale=1.0, alpha_mult=1.0, blur_sigma=0):
    """Apply rotation, scale, alpha, and optional blur to an RGBA image."""
    w, h = img.size

    # Scale
    if abs(scale - 1.0) > 0.01:
        nw, nh = int(w * scale), int(h * scale)
        scaled = img.resize((nw, nh), Image.LANCZOS)
        result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        result.paste(scaled, ((w - nw) // 2, (h - nh) // 2))
        img = result

    # Rotate around center
    if abs(angle) > 0.1:
        img = img.rotate(angle, resample=Image.BICUBIC, expand=False)

    # Gaussian blur for motion feel
    if blur_sigma > 0:
        from PIL import ImageFilter
        # Split alpha, blur RGB only, recombine
        r, g, b, a = img.split()
        rgb = Image.merge("RGB", (r, g, b))
        rgb = rgb.filter(ImageFilter.GaussianBlur(radius=blur_sigma))
        r2, g2, b2 = rgb.split()
        img = Image.merge("RGBA", (r2, g2, b2, a))

    # Alpha multiply
    if alpha_mult < 0.999:
        arr = np.array(img)
        arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * alpha_mult).clip(0, 255).astype(np.uint8)
        img = Image.fromarray(arr)

    return img


def make_loop_frames(base_img, n_frames):
    """Create looping animation: subtle pulse + wobble rotation.

    Used for flying projectiles and supermode auras.
    Each frame is a slight transform of the same base image.
    """
    frames = []
    for i in range(n_frames):
        t = i / n_frames  # 0..1 over one cycle
        phase = t * 2 * math.pi
        angle = math.sin(phase) * 6            # ±6° wobble
        scale = 1.0 + 0.06 * math.sin(phase)   # ±6% pulse
        alpha = 0.88 + 0.12 * math.sin(phase + 0.5)  # slight alpha shimmer
        blur = 0.3 + 0.3 * abs(math.sin(phase))       # subtle motion blur
        frames.append(_transform_frame(base_img, angle, scale, alpha, blur))
    return frames


def make_burst_frames(base_img, n_frames):
    """Create one-shot burst animation: appear → peak → fade away.

    Used for vanish/explosion effects.
    Grows from small+dim to full, then fades to nothing.
    """
    frames = []
    for i in range(n_frames):
        t = i / (n_frames - 1)  # 0..1 linear

        if t < 0.30:
            # Phase 1: Gather / grow (frames 0-2)
            p = t / 0.30
            scale = 0.35 + 0.65 * p     # 35% → 100%
            alpha = 0.50 + 0.50 * p      # 50% → 100%
            blur = 1.5 * (1 - p)         # blur fades as it forms
        elif t < 0.50:
            # Phase 2: Peak (frames 3-4)
            p = (t - 0.30) / 0.20
            scale = 1.0 + 0.05 * math.sin(p * math.pi)  # tiny pulse at peak
            alpha = 1.0
            blur = 0
        else:
            # Phase 3: Dissipate (frames 5-7)
            p = (t - 0.50) / 0.50
            scale = 1.0 + 0.15 * p       # slightly expand as it fades
            alpha = 1.0 - 0.90 * p        # fade to 10%
            blur = 2.0 * p               # increasing blur as it dissipates

        angle = (i - n_frames // 2) * 2  # slight rotation spread
        frames.append(_transform_frame(base_img, angle, scale, alpha, blur))
    return frames


def extract_vfx_alpha(img_black):
    """Extract alpha from VFX rendered on black background.

    For game VFX (fire, lightning, etc.):
    - Generate on pure black bg → bright pixels = the effect
    - Alpha = max(R, G, B) with threshold + gamma
    - SDXL backgrounds are noisy (~20-50 brightness), threshold kills them
    """
    arr = np.array(img_black.convert("RGB")).astype(np.float32)

    # Background noise threshold — SDXL background areas have max(R,G,B) up to ~50
    BG_THRESH = 35  # Pixels below this are definitely background
    GAMMA = 0.85    # < 1.0 boosts VFX brightness, kills faint remnants

    # Single-pass: use max channel as alpha (works for glowing additive VFX)
    lum = np.max(arr, axis=2)  # max channel brightness
    # Hard threshold: kill background noise, then remap to 0-255
    raw = np.clip((lum - BG_THRESH) / (255.0 - BG_THRESH), 0, 1)
    # Gamma correction: boost bright VFX, suppress faint noise
    raw = raw ** GAMMA
    alpha = (raw * 255).astype(np.uint8)
    # RGB: keep original colors where visible, zero where transparent
    rgb = arr.astype(np.uint8)
    rgb[alpha == 0] = 0

    result = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    result[:, :, :3] = rgb
    result[:, :, 3] = alpha
    return Image.fromarray(result)


# ============================================================
# Generation with LoRA
# ============================================================

MAGIC_DEFS = [
    {"name": "烈焰风暴", "element": "fire", "desc": "blazing fire storm, red orange flames, burning ember particles, intense heat waves"},
    {"name": "冰霜寒光", "element": "ice", "desc": "ice crystal frost, blue white frozen shards, cold mist, snowflake particles, glacial energy"},
    {"name": "雷霆万钧", "element": "lightning", "desc": "electric lightning bolts, purple yellow thunder, crackling plasma, static discharge"},
    {"name": "毒雾迷障", "element": "poison", "desc": "green toxic poison cloud, purple miasma, acid dripping, venomous bubbles"},
    {"name": "圣光护体", "element": "holy", "desc": "golden holy divine light, sacred halo, warm radiance, angelic glow particles"},
    {"name": "暗影噬魂", "element": "shadow", "desc": "dark shadow void energy, purple black ghostly wisps, soul consuming darkness"},
    {"name": "风刃旋涡", "element": "wind", "desc": "cyan wind blade tornado, air current slashes, swirling breeze, speed lines"},
    {"name": "血焰狂舞", "element": "blood", "desc": "crimson blood flame, dark red fire, sinister energy, blood mist splatter"},
    {"name": "星陨天降", "element": "cosmic", "desc": "golden meteor cosmic stardust, celestial amber glow, falling star trail"},
    {"name": "碧波浮光", "element": "water", "desc": "teal cyan water waves, aquatic bubbles, ocean energy flow, water splash"},
]


def generate_with_lora(magic_def, lora_path=None, pipe=None):
    """Generate a complete magic set using LoRA-finetuned SDXL."""
    from diffusers import StableDiffusionXLPipeline
    from peft import PeftModel

    name = magic_def["name"]
    desc = magic_def["desc"]

    print(f"\n{'━' * 50}")
    print(f"生成武功: {name}")
    print(f"{'━' * 50}")

    own_pipe = pipe is None
    if pipe is None:
        # Load pipeline
        print("  加载模型...")
        pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16,
            variant="fp16",
            use_safetensors=True,
        )

        # Load LoRA weights using PEFT directly
        if lora_path is None:
            lora_path = LORA_OUTPUT / "final"
        if lora_path.exists():
            print(f"  加载 LoRA (PEFT): {lora_path}")
            pipe.unet = PeftModel.from_pretrained(pipe.unet, str(lora_path))
            pipe.unet.merge_adapter()  # Merge LoRA into base for fast inference
            print("  LoRA 已融合到 UNet")
        else:
            print("  ⚠️ 未找到 LoRA 模型，使用原始 SDXL")

        pipe.to("cuda")
        pipe.enable_attention_slicing()

    out_dir = MAGIC_OUTPUT / name
    preview_dir = out_dir / "preview"
    os.makedirs(preview_dir, exist_ok=True)

    seed = hash(name) & 0xFFFFFFFF
    all_images = []

    neg_prompt = "white background, gray background, light background, text, watermark, logo, UI, realistic photo, 3D render, blurry, low quality, ugly, deformed, frame, border"

    def gen(prompt, w=512, h=512, s=42, steps=25):
        """Generate VFX image on black background, extract alpha via brightness."""
        g = torch.Generator(device="cuda").manual_seed(s)
        full = f"{TRIGGER_WORD}, {prompt}"
        img_black = pipe(prompt=full, negative_prompt=neg_prompt, width=w, height=h,
                         num_inference_steps=steps, guidance_scale=7.5, generator=g).images[0]
        return extract_vfx_alpha(img_black)

    # Common VFX prompt suffix
    BG = "solid black background, dark void, isolated on black"

    # 1. Magic image (60x75 final -> gen at 512, resize)
    print("  [1/5] 武功图像...")
    t0 = time.time()
    img = gen(f"{desc}, magic spell aura glow, 2D RPG game sprite, centered, {BG}", s=seed)
    img.save(preview_dir / "magic.png")
    all_images.append(img)
    print(f"    {time.time() - t0:.1f}s")

    # 2. Icon (30x40 final)
    print("  [2/5] 武功图标...")
    t0 = time.time()
    img = gen(f"{desc}, small magic icon thumbnail, centered symbol, clean simple, 2D RPG, {BG}", s=seed + 50, steps=20)
    img.save(preview_dir / "icon.png")
    all_images.append(img)
    print(f"    {time.time() - t0:.1f}s")

    # 3. Flying projectile — generate 1 base, animate via transforms (6 loop frames)
    print("  [3/5] 飞行弹道 (1 base → 6帧)...")
    t0 = time.time()
    fly_base = gen(f"{desc}, flying magic projectile with energy trail, 2D RPG sprite, motion blur, {BG}",
                   s=seed + 100, steps=25)
    fly_base.save(preview_dir / "flying-base.png")
    fly_imgs = make_loop_frames(fly_base, 6)
    for i, f in enumerate(fly_imgs):
        f.save(preview_dir / f"flying-f{i}.png")
    all_images.extend(fly_imgs)
    print(f"    生成+变换: {time.time() - t0:.1f}s")

    # 4. Vanish/explosion — generate 1 base, animate via burst transforms (8 frames)
    print("  [4/5] 爆炸消散 (1 base → 8帧)...")
    t0 = time.time()
    vanish_base = gen(f"{desc}, magic explosion impact burst, peak energy, 2D RPG sprite, {BG}",
                      s=seed + 200, steps=25)
    vanish_base.save(preview_dir / "vanish-base.png")
    vanish_imgs = make_burst_frames(vanish_base, 8)
    for i, f in enumerate(vanish_imgs):
        f.save(preview_dir / f"vanish-f{i:02d}.png")
    all_images.extend(vanish_imgs)
    print(f"    生成+变换: {time.time() - t0:.1f}s")

    # 5. Supermode — generate 1 base, animate via loop transforms (6 frames)
    print("  [5/5] 超级模式 (1 base → 6帧)...")
    t0 = time.time()
    super_base = gen(f"{desc}, ultimate screen-filling attack aura, full power, 2D RPG sprite, epic scale, {BG}",
                     w=768, h=512, s=seed + 300, steps=25)
    super_base.save(preview_dir / "super-base.png")
    super_imgs = make_loop_frames(super_base, 6)
    for i, f in enumerate(super_imgs):
        f.save(preview_dir / f"super-f{i:02d}.png")
    all_images.extend(super_imgs)
    print(f"    生成+变换: {time.time() - t0:.1f}s")

    # Convert to MSF
    print("  [转换] 生成 MSF 文件...")
    palette = extract_palette(all_images)

    # magic.msf: 60x75, 8 dirs, 1 frame
    magic_resized = [all_images[0].resize((60, 75), Image.LANCZOS)]
    _write_images_to_msf(magic_resized * 8, palette, 60, 75, 8, 16, 0, 0, out_dir / "magic.msf")

    # icon.msf: 30x40, 8 dirs, 1 frame
    icon_resized = [all_images[1].resize((30, 40), Image.LANCZOS)]
    _write_images_to_msf(icon_resized * 8, palette, 30, 40, 8, 16, 0, 0, out_dir / "magic-icon.msf")

    # flying.msf: like real ones ~ 100x100, 16 dirs
    fly_resized = [img.resize((100, 100), Image.LANCZOS) for img in fly_imgs]
    all_fly = []
    for d in range(16):
        angle = -d * (360 / 16)
        for f in fly_resized:
            all_fly.append(f.rotate(angle, resample=Image.BICUBIC, expand=False))
    _write_images_to_msf(all_fly, palette, 100, 100, 16, 16, 50, 70, out_dir / "flying.msf")

    # vanish.msf: 96x96, 1 dir
    van_resized = [img.resize((96, 96), Image.LANCZOS) for img in vanish_imgs]
    _write_images_to_msf(van_resized, palette, 96, 96, 1, 30, 48, 76, out_dir / "vanish.msf")

    # supermode.msf: 280x160, 1 dir
    sup_resized = [img.resize((280, 160), Image.LANCZOS) for img in super_imgs]
    _write_images_to_msf(sup_resized, palette, 280, 160, 1, 16, 140, 104, out_dir / "supermode.msf")

    # Generate INI file
    _generate_ini(magic_def, out_dir)

    # Cleanup (only if we own the pipeline)
    if own_pipe:
        del pipe
        gc.collect()
        torch.cuda.empty_cache()

    msf_files = list(out_dir.glob("*.msf"))
    total_bytes = sum(f.stat().st_size for f in msf_files)
    print(f"\n  完成! {len(msf_files)} MSF + INI, {total_bytes:,} bytes")
    print(f"  预览: {preview_dir}")


def _write_images_to_msf(images, palette, cw, ch, dirs, fps, ax, ay, path):
    frames = []
    for img in images:
        if img.size != (cw, ch):
            img = img.resize((cw, ch), Image.LANCZOS)
        pixels = rgba_to_indexed(img, palette)
        frames.append({"ox": 0, "oy": 0, "w": cw, "h": ch, "pixels": pixels})
    write_msf2(str(path), cw, ch, dirs, fps, ax, ay, palette, frames)


def _generate_ini(magic_def, out_dir):
    """Generate INI file matching game format."""
    name = magic_def["name"]
    ini_content = f"""[Init]
Name={name}
Intro=  AI生成的武功特效。
Speed=8
Region=0
MoveKind=7
AlphaBlend=1
FlyingLum=15
VanishLum=15
Image=magic.msf
Icon=magic-icon.msf
WaitFrame=4
LifeFrame=50
FlyingImage=flying.msf
FlyingSound=魔-漫天花雨手法.wav
VanishImage=vanish.msf
VanishSound=魔-爆05.wav
SuperModeImage=supermode.msf
Belong=

[Level1]
Effect=270
ManaCost=10
LevelupExp=500
MoveKind=7
Speed=8

[Level2]
Effect=540
ManaCost=15
LevelupExp=1500
MoveKind=7
Speed=9

[Level3]
Effect=765
ManaCost=25
LevelupExp=3000
MoveKind=7
Speed=10

[Level4]
Effect=945
ManaCost=40
LevelupExp=6000
MoveKind=4
Speed=10

[Level5]
Effect=1215
ManaCost=50
LevelupExp=10000
MoveKind=4
Speed=11

[Level6]
Effect=1440
ManaCost=70
LevelupExp=16000
MoveKind=4
Speed=12

[Level7]
Effect=1710
ManaCost=90
LevelupExp=30000
MoveKind=4
Speed=13

[Level8]
Effect=1980
ManaCost=120
LevelupExp=50000
MoveKind=4
Speed=14

[Level9]
Effect=2250
ManaCost=150
LevelupExp=100000
MoveKind=4
Speed=15

[Level10]
Effect=3500
ManaCost=500
LevelupExp=
MoveKind=15
Speed=16
"""
    ini_path = out_dir / f"player-magic-{name}.ini"
    with open(ini_path, "w", encoding="utf-8") as f:
        f.write(ini_content)
    print(f"  生成 INI: {ini_path.name}")


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="LoRA 微调 + 武功生成")
    parser.add_argument("action", choices=["train", "generate", "status"], help="操作")
    parser.add_argument("--name", type=str, help="只生成指定武功")
    parser.add_argument("--all", action="store_true", help="生成全部 10 套")
    parser.add_argument("--index", type=int, help="生成第 N 套 (1-10)")
    args = parser.parse_args()

    if args.action == "train":
        if not TRAINING_DIR.exists():
            print("训练数据不存在！先运行: python3 scripts/export-training-data.py")
            return
        train_lora()

    elif args.action == "generate":
        targets = MAGIC_DEFS
        if args.name:
            targets = [m for m in MAGIC_DEFS if m["name"] == args.name]
            if not targets:
                print(f"未找到: {args.name}")
                return
        elif args.index:
            if 1 <= args.index <= len(MAGIC_DEFS):
                targets = [MAGIC_DEFS[args.index - 1]]
            else:
                print(f"索引超出范围 (1-{len(MAGIC_DEFS)})")
                return
        elif not args.all:
            targets = [MAGIC_DEFS[0]]  # Default: first one

        print("=" * 60)
        print(f"AI 武功生成 (LoRA 微调)")
        print(f"目标: {len(targets)} 套")
        print("=" * 60)

        # Load pipeline once and share across all generations
        if len(targets) > 1:
            from diffusers import StableDiffusionXLPipeline
            from peft import PeftModel

            print("\n加载共享 Pipeline...")
            pipe = StableDiffusionXLPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch.float16,
                variant="fp16",
                use_safetensors=True,
            )
            lora_path = LORA_OUTPUT / "final"
            if lora_path.exists():
                print(f"  加载 LoRA (PEFT): {lora_path}")
                pipe.unet = PeftModel.from_pretrained(pipe.unet, str(lora_path))
                pipe.unet.merge_adapter()
                print("  LoRA 已融合")
            pipe.to("cuda")
            pipe.enable_attention_slicing()

            for i, m in enumerate(targets):
                print(f"\n[{i + 1}/{len(targets)}]")
                generate_with_lora(m, pipe=pipe)

            del pipe
            gc.collect()
            torch.cuda.empty_cache()
        else:
            generate_with_lora(targets[0])

    elif args.action == "status":
        print(f"训练数据: {TRAINING_DIR}")
        if TRAINING_DIR.exists():
            for cat in sorted(TRAINING_DIR.iterdir()):
                if cat.is_dir():
                    pngs = list(cat.glob("*.png"))
                    print(f"  {cat.name}/: {len(pngs)} 张")
        else:
            print("  (不存在)")

        print(f"\nLoRA 模型: {LORA_OUTPUT}")
        if (LORA_OUTPUT / "final").exists():
            print("  ✅ 已训练完成")
            info = LORA_OUTPUT / "training_info.txt"
            if info.exists():
                print(info.read_text())
        elif list(LORA_OUTPUT.glob("checkpoint-*")):
            checkpoints = sorted(LORA_OUTPUT.glob("checkpoint-*"))
            print(f"  ⏳ 训练中... 最新 checkpoint: {checkpoints[-1].name}")
        else:
            print("  ❌ 未训练")


if __name__ == "__main__":
    main()
