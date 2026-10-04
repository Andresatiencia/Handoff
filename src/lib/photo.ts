const MAX_PHOTO_BYTES = 750_000;

function base64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the photo."));
    reader.readAsDataURL(file);
  });
}

function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    result => result ? resolve(result) : reject(new Error("Could not process the photo.")), "image/jpeg", quality,
  ));
}

export async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP photo.");
  if (file.size > 10_000_000) throw new Error("Choose a photo smaller than 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process the photo.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.55]) {
      const photo = await jpeg(canvas, quality);
      if (photo.size <= MAX_PHOTO_BYTES) return { mime: "image/jpeg", data: await base64(photo) };
    }
    throw new Error("This photo is too detailed to upload. Try a smaller image.");
  } finally {
    bitmap.close();
  }
}
