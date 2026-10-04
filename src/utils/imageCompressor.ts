/**
 * Client-Side Image Processor & Compressor for Profile Pictures
 * Converts raw uploaded image Files or Blob URLs into compressed, 1:1 square JPEG Data URLs (~25KB-45KB)
 * for fast database storage and instant cross-device rendering.
 */

export async function processAndCompressProfileImage(
  fileOrUrl: File | Blob | string,
  targetSize = 360,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof fileOrUrl === 'string') {
      if (!fileOrUrl || !fileOrUrl.trim()) {
        return resolve('');
      }
      // If already data URL or valid URL, load it into Image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const compressed = renderSquareCanvas(img, targetSize, quality);
          resolve(compressed);
        } catch (err) {
          // If cross-origin or canvas export fails, fallback to original string
          resolve(fileOrUrl);
        }
      };
      img.onerror = () => resolve(fileOrUrl);
      img.src = fileOrUrl;
      return;
    }

    // Process File / Blob input
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        return reject(new Error('Failed to read image file'));
      }

      const img = new Image();
      img.onload = () => {
        try {
          const compressed = renderSquareCanvas(img, targetSize, quality);
          resolve(compressed);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Invalid image file format'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Error reading uploaded image file'));
    reader.readAsDataURL(fileOrUrl);
  });
}

function renderSquareCanvas(img: HTMLImageElement, size: number, quality: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context unavailable');
  }

  // Smooth dark background fallback
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);

  // Calculate center crop maintaining aspect ratio
  const aspect = img.naturalWidth / img.naturalHeight || img.width / img.height || 1;
  let drawW = size;
  let drawH = size;
  let offsetX = 0;
  let offsetY = 0;

  if (aspect > 1) {
    drawW = size * aspect;
    drawH = size;
    offsetX = -(drawW - size) / 2;
  } else {
    drawW = size;
    drawH = size / aspect;
    offsetY = -(drawH - size) / 2;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  return canvas.toDataURL('image/jpeg', quality);
}
