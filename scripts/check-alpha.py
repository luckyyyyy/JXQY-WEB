#!/usr/bin/env python3
"""Check alpha quality across all generated magic sets."""
from PIL import Image
import numpy as np, os

sets = sorted([d for d in os.listdir('magic') if not d.startswith('_') and os.path.isdir(f'magic/{d}/preview')])
files = ['magic.png', 'icon.png', 'flying-f0.png', 'vanish-f00.png', 'super-f00.png']

print(f"{'Set':12s} | {'magic':15s} | {'icon':15s} | {'flying':15s} | {'vanish':15s} | {'super':15s}")
print("-" * 100)

for s in sets:
    row = [f"{s:12s}"]
    for f in files:
        path = f'magic/{s}/preview/{f}'
        if not os.path.exists(path):
            row.append(f"{'MISSING':15s}")
            continue
        img = Image.open(path)
        arr = np.array(img)
        if arr.shape[2] == 4:
            a = arr[:, :, 3]
            t = (a == 0).sum() * 100 / a.size
            row.append(f"t={t:4.0f}% [{a.min():3d}-{a.max():3d}]")
        else:
            row.append(f"{'NO ALPHA':15s}")
    print(" | ".join(row))
