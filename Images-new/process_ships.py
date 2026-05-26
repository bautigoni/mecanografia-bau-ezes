"""Process the nave-*.png originals from Mecanografia/Images into the
EDUTIC public spaceships folder. Tight-crops transparent padding and
verifies alpha. Originals are NOT modified."""
import os
from PIL import Image

SRC = r"C:\Users\gonib\Downloads\a\Mecanografia\Images"
DST = r"C:\Users\gonib\Downloads\a\EDUTIC\edutic\public\assets\edutic-art\spaceships"

# Map nave source -> ship destination name used by eduticAssets.shipXxx
mapping = {
    "nave-frente.png":                    "ship-front.png",
    "nave-espaldas.png":                  "ship-back.png",
    "nave-izquierda.png":                 "ship-left.png",
    "nave-mirando-derecha.png":           "ship-right.png",
    "nave-diagonal-izquierda.png":        "ship-diagonal-left.png",
    "nave-diagonal-derecha.png":          "ship-diagonal-right.png",
}

def trim(img: Image.Image) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.split()[-1]
    min_a, max_a = alpha.getextrema()
    if min_a == 255 and max_a == 255:
        # No alpha info — knock out near-white background.
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
    if not os.path.exists(src_path):
        print(f"  MISSING: {src_name}")
        continue
    dst_path = os.path.join(DST, dst_name)
    with Image.open(src_path) as img:
        out = trim(img)
        w, h = out.size
        scale = 700 / max(w, h)
        if scale < 1:
            out = out.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        out.save(dst_path, "PNG", optimize=True)
    print(f"  {src_name:36s} -> {dst_name} ({out.size[0]}x{out.size[1]})")

print("Done.")
