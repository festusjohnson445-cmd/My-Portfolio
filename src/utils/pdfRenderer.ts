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

/**
 * Render the first page of a PDF data URL or ArrayBuffer to a crisp image data URL (JPEG)
 * Returns null if rendering fails so the UI displays the clean, professional document badge & metadata.
 */
export async function renderPdfFirstPageToImage(
  pdfDataUrlOrBuffer: string | ArrayBuffer,
  targetWidth = 900
): Promise<string | null> {
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
        loadingTask = pdfjsLib.getDocument({ url: pdfDataUrlOrBuffer });
      }
    } else {
      loadingTask = pdfjsLib.getDocument({ data: pdfDataUrlOrBuffer });
    }

    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.max(1.0, targetWidth / unscaledViewport.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext: any = {
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    };

    await page.render(renderContext).promise;
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const timeoutTask = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 4000)
  );

  try {
    return await Promise.race([renderTask(), timeoutTask]);
  } catch (err) {
    console.warn('PDF.js render note:', err);
    return null;
  }
}
