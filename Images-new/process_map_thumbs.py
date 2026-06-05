#!/usr/bin/env python3
"""
process_map_thumbs.py — build small, high-quality WORLD-MAP thumbnails.

The world map (/mundos) reuses big island art (147-282 KB, ~1254px) as tiny
thumbnails rendered at ~280-340px. This generates purpose-built thumbnails at a
640px longest edge, q92 (visually identical at display size, ~80% smaller) into
a SEPARATE folder so the original art is never touched. Transparency preserved.

Run:  python Images-new/process_map_thumbs.py
"""
from __future__ import annotations

import glob
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
OUT = os.path.join(PUBLIC, "typely_islands_thumb_webp")
MAX_EDGE = 768
QUALITY = 92

# Source map-thumbnail files (relative to public/).
SOURCES = [
    "assets/processed/worlds-island1-transparent.webp",
    "assets/processed/worlds-island2-transparent.webp",
    "assets/processed/worlds-island3-transparent.webp",
    "assets/processed/worlds-island4-transparent.webp",
    "assets/edutic-art/world-island5.webp",
]
SOURCES += [f"typely_islands_webp/background-island{i}.webp" for i in range(1, 11)]


def human(n: int) -> str:
    return f"{n / 1024:.1f} KB"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    total_old = total_new = 0
    for rel in SOURCES:
        src = os.path.join(PUBLIC, rel)
        matches = glob.glob(src)
        if not matches:
            print(f"! missing {rel}")
            continue
        src = matches[0]
        old = os.path.getsize(src)
        with Image.open(src) as im:
            im.load()
            has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
            im = im.convert("RGBA" if has_alpha else "RGB")
            w, h = im.size
            longest = max(w, h)
            if longest > MAX_EDGE:
                scale = MAX_EDGE / longest
                im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
            dst = os.path.join(OUT, os.path.basename(src))
            im.save(dst, "WEBP", quality=QUALITY, method=6)
        new = os.path.getsize(dst)
        total_old += old
        total_new += new
        print(f"- {os.path.basename(src):<40} {human(old):>10} => {human(new):>10}")
    if total_old:
        saved = total_old - total_new
        print(f"\nTotal: {human(total_old)} => {human(total_new)} (saved {human(saved)}, {100*saved/total_old:.0f}%)")


if __name__ == "__main__":
    main()
