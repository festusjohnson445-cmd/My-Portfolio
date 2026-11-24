import * as pdfjsLib from 'pdfjs-dist';

// Set up the PDF.js worker using CDN matching installed version
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('PDF.js worker initialization warning:', e);
  }
}

/**
 * Checks if a preview URL is a legacy embedded mock/generated CAD SVG drawing
 * so that unwanted placeholder vector drawings are completely removed.
 */
export function isMockDrawingPreview(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    (url.startsWith('data:image/svg+xml') &&
      (lower.includes('asme') ||
        lower.includes('festus%20cad') ||
        lower.includes('festus cad') ||
        lower.includes('laser%20engraver') ||
        lower.includes('laser engraver') ||
        lower.includes('zone%201a') ||
        lower.includes('zone 1a') ||
        lower.includes('honeycomb') ||
        lower.includes('amber%20shield') ||
        lower.includes('first%20angle%20projection'))) ||
    lower.includes('cad/ai scanner')
  );
}

const pdfFirstPageCache = new Map<string, string>();

/**
 * Render the first page of a PDF data URL or ArrayBuffer to a crisp image data URL (JPEG)
 * Returns null if rendering fails so the UI displays the clean, professional document badge & metadata.
 */
export async function renderPdfFirstPageToImage(
  pdfDataUrlOrBuffer: string | ArrayBuffer,
  targetWidth = 1400,
  outputMime: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/jpeg',
  quality = 0.95
): Promise<string | null> {
  const baseKey = typeof pdfDataUrlOrBuffer === 'string'
    ? (pdfDataUrlOrBuffer.length > 200 ? pdfDataUrlOrBuffer.slice(0, 100) + '_' + pdfDataUrlOrBuffer.length : pdfDataUrlOrBuffer)
    : null;
  const cacheKey = baseKey ? `${baseKey}__w${targetWidth}_${outputMime}` : null;

  if (cacheKey && pdfFirstPageCache.has(cacheKey)) {
    return pdfFirstPageCache.get(cacheKey)!;
  }
  const renderTask = async (): Promise<string | null> => {
    let loadingTask;
    if (typeof pdfDataUrlOrBuffer === 'string') {
      if (pdfDataUrlOrBuffer.startsWith('data:')) {
        const base64Data = pdfDataUrlOrBuffer.split(',')[1];
        if (!base64Data) return null;
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        loadingTask = pdfjsLib.getDocument({ data: bytes.buffer });
      } else {
        loadingTask = pdfjsLib.getDocument({
          url: pdfDataUrlOrBuffer,
          rangeChunkSize: 65536,
        });
      }
    } else {
      loadingTask = pdfjsLib.getDocument({ data: pdfDataUrlOrBuffer });
    }

    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const dprBoost = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const desiredPixels = Math.max(targetWidth, Math.round(targetWidth * (dprBoost > 1 ? 1.15 : 1)));
    const scale = Math.max(1.5, Math.min(4.5, desiredPixels / unscaledViewport.width));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      return null;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext: any = {
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
    if (outputMime === 'image/png') {
      return canvas.toDataURL('image/png');
    }
    const encoded = canvas.toDataURL(outputMime, quality);
    if (outputMime === 'image/webp' && !encoded.startsWith('data:image/webp')) {
      return canvas.toDataURL('image/jpeg', quality);
    }
    return encoded;
  };

  const timeoutTask = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 12000)
  );

  try {
    const res = await Promise.race([renderTask(), timeoutTask]);
    if (res && cacheKey) {
      pdfFirstPageCache.set(cacheKey, res);
    }
    return res;
  } catch (err) {
    console.warn('PDF.js render note:', err);
    return null;
  }
}
