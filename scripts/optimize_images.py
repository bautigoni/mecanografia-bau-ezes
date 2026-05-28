"""
Generate WebP siblings of every PNG under public/assets/ without touching
the originals. Run once after dropping new art.

Rules:
- Backgrounds (>= 1920px wide) are downscaled to 1920px max width.
- Opaque images use quality 82 (default).
- Transparent images use quality 85 + method 6 + alpha quality 90 so the
  cut-outs (robots, ships, island5 props, transparent island layers) stay
  crisp.
- Originals are *never* modified or deleted.

Usage:
    py scripts/optimize_images.py
"""
from __future__ import annotations

import os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"
MAX_BG_WIDTH = 1920

# Treat these stems as "fullscreen backgrounds" → resize to <= 1920px wide.
BG_HINTS = (
    "login-sky-islands-bg",
    "sky-soft-bg",
    "gameplay-bg",
    "island1",
    "island2",
    "island3",
    "island4",
    "island5",
)


def is_background(rel: Path) -> bool:
    name = rel.stem
    # Only the top-level island PNGs are backgrounds; props under island5/
    # (which live in subdirectories like edutic-art/island5/) are not.
    parent = rel.parent.name
    if parent in {"island5", "spaceships", "processed"}:
        return False
    return any(name == h or name.endswith(h) for h in BG_HINTS)


def convert(src: Path) -> tuple[int, int, str]:
    rel = src.relative_to(ROOT)
    dest = src.with_suffix(".webp")
    if dest.exists() and dest.stat().st_mtime >= src.stat().st_mtime:
        # Already up to date.
        return (src.stat().st_size, dest.stat().st_size, "skipped")

    with Image.open(src) as im:
        has_alpha = im.mode in ("RGBA", "LA") or (
            im.mode == "P" and "transparency" in im.info
        )
        im = im.convert("RGBA" if has_alpha else "RGB")

        if is_background(rel) and im.width > MAX_BG_WIDTH:
            ratio = MAX_BG_WIDTH / im.width
            new_size = (MAX_BG_WIDTH, int(round(im.height * ratio)))
            im = im.resize(new_size, Image.LANCZOS)

        if has_alpha:
            im.save(
                dest,
                format="WEBP",
                quality=85,
                method=6,
                alpha_quality=90,
            )
        else:
            im.save(
                dest,
                format="WEBP",
                quality=82,
                method=6,
            )

    return (src.stat().st_size, dest.stat().st_size, "ok")


def main() -> None:
    total_src = 0
    total_dst = 0
    converted = 0
    skipped = 0
    for src in sorted(ROOT.rglob("*.png")):
        # Skip favicons or anything that ships separately.
        src_size, dst_size, status = convert(src)
        total_src += src_size
        total_dst += dst_size
        if status == "ok":
            converted += 1
            ratio = (1 - dst_size / src_size) * 100
            print(f"  {src.relative_to(ROOT)} {src_size/1024:.0f}KB -> {dst_size/1024:.0f}KB ({ratio:+.0f}%)")
        else:
            skipped += 1

    print()
    print(f"Converted {converted} file(s), skipped {skipped}.")
    if total_src:
        print(
            f"Total: {total_src/1024/1024:.1f} MB PNG -> "
            f"{total_dst/1024/1024:.1f} MB WebP "
            f"({(1 - total_dst/total_src) * 100:.0f}% smaller)"
        )


if __name__ == "__main__":
    main()
