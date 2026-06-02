/* ====================================================================
 * Image helpers for the admin photo upload.
 *
 * Sede/school photos are stored as data URLs inside localStorage (no
 * backend yet). To keep storage small and fast, every uploaded image is
 * downscaled client-side to a sane longest-edge and re-encoded as JPEG
 * before it is persisted. Returns a base64 data URL.
 * ==================================================================== */

const MAX_EDGE = 800;
const JPEG_QUALITY = 0.82;
/** Hard ceiling on the original file we will even try to read (8 MB). */
const MAX_BYTES = 8 * 1024 * 1024;

export async function fileToResizedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("La imagen es demasiado grande (máx. 8 MB).");
  }

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl; // fall back to the original if canvas is unavailable
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
    img.src = src;
  });
}
