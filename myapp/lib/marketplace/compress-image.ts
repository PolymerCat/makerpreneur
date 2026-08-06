const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;

export function isAllowedImageType(file: File): boolean {
  return ALLOWED_TYPES.has(file.type);
}

/**
 * Resize image so the longest edge is at most maxEdge; returns a JPEG/WebP/PNG File.
 * Falls back to the original file if compression fails or isn't needed.
 */
export async function compressImageFile(
  file: File,
  maxEdge = MAX_IMAGE_EDGE
): Promise<File> {
  if (!isAllowedImageType(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size <= MAX_IMAGE_BYTES) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = outputType === 'image/jpeg' ? 0.85 : undefined;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, quality)
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    const ext = outputType === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `${baseName}.${ext}`, { type: outputType });
  } catch {
    return file;
  }
}
