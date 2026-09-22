"use client";

/** Resize large phone evidence before sending it to server storage. */
export async function compressEvidenceImage(
  file: File,
  maxDimension = 1600,
  quality = 0.78
): Promise<{ dataUrl: string; name: string }> {
  if (file.size <= 900_000 && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return {
      dataUrl: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }),
      name: file.name,
    };
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = sourceUrl;
    });
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", quality),
      name: file.name.replace(/\.[^.]+$/, "") + "-compressed.jpg",
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
