"""Process the 5 new robot PNGs into Mecanografia's public assets and
generate a favicon. Originals in Images/ and Images-new/ stay untouched."""
import os
from PIL import Image

SRC = r"C:\Users\gonib\Downloads\a\Mecanografia\Images-new"
DST = r"C:\Users\gonib\Downloads\a\Mecanografia\public\assets\edutic-art"
FAVICON_DIR = r"C:\Users\gonib\Downloads\a\Mecanografia\public"

mapping = {
    "robot-salta.png":   "mascot-jump.png",
    "robot-default.png": "mascot-proud.png",
    "robot-compu.png":   "mascot-laptop.png",
    "robot-saluda.png":  "mascot-wave.png",
    "robot-caja.png":    "mascot-natural.png",
}

def trim(img: Image.Image) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.split()[-1]
    lo, hi = alpha.getextrema()
    if lo == 255 and hi == 255:
        rgba = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r, g, b, a = rgba[x, y]
                if r > 240 and g > 240 and b > 240:
                    rgba[x, y] = (r, g, b, 0)
        alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img

os.makedirs(DST, exist_ok=True)

for src_name, dst_name in mapping.items():
    src_path = os.path.join(SRC, src_name)
    dst_path = os.path.join(DST, dst_name)
    with Image.open(src_path) as img:
        out = trim(img)
        w, h = out.size
        scale = 1024 / max(w, h)
        if scale < 1:
            out = out.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        out.save(dst_path, "PNG", optimize=True)
    print(f"  {src_name:24s} -> {dst_name} ({out.size[0]}x{out.size[1]})")

# Favicon
with Image.open(os.path.join(SRC, "robot-default.png")) as img:
    img = trim(img)
    w, h = img.size
    head_h = int(h * 0.55)
    side = head_h
    cx = w // 2
    left = max(0, cx - side // 2)
    upper = 0
    right = left + side
    lower = upper + side
    head = img.crop((left, upper, right, lower))
    pad = int(side * 0.05)
    canvas = Image.new("RGBA", (side + pad * 2, side + pad * 2), (0, 0, 0, 0))
    canvas.paste(head, (pad, pad), head)
    fav_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    canvas.resize((256, 256), Image.LANCZOS).save(os.path.join(FAVICON_DIR, "favicon-256.png"), "PNG", optimize=True)
    canvas.save(os.path.join(FAVICON_DIR, "favicon.ico"), sizes=fav_sizes)
    print(f"  favicon.ico + favicon-256.png generated")

print("Done.")
