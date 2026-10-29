import mammoth from 'mammoth';

/**
 * Extracts clean, human-readable body text directly from an uploaded File.
 * Strips away all zip/XML container structures, binary metadata, and docProps.
 */
export async function extractCleanTextFromFile(file: File): Promise<string> {
  const fileName = (file.name || '').toLowerCase();

  // 1. Plain text files (.txt, .md, .csv)
  if (
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv') ||
    file.type.startsWith('text/')
  ) {
    try {
      const text = await file.text();
      return cleanExtractedString(text);
    } catch (e) {
      console.warn('[DocExtractor] Text file read warning:', e);
    }
  }

  // 2. Word documents (.docx)
  if (
    fileName.endsWith('.docx') ||
    fileName.endsWith('.doc') ||
    file.type.includes('wordprocessingml') ||
    file.type.includes('officedocument')
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer });
      if (res && res.value && res.value.trim().length > 0) {
        return cleanExtractedString(res.value);
      }
    } catch (e) {
      console.warn('[DocExtractor] Docx extraction warning:', e);
    }
  }

  return '';
}

/**
 * Extracts clean text from base64 payload (for server-side or fallback handling).
 */
export async function extractCleanTextFromBase64(
  rawBase64: string,
  mimeType: string = '',
  fileName: string = ''
): Promise<string> {
  if (!rawBase64) return '';

  const cleanB64 = rawBase64.replace(/^data:[^;]+;base64,/, '').trim();
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  // Word docx handling
  if (
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    lowerMime.includes('wordprocessingml') ||
    lowerMime.includes('officedocument')
  ) {
    try {
      // Browser or Node environment:
      let arrayBuffer: ArrayBuffer;
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(cleanB64, 'base64');
        const res = await mammoth.extractRawText({ buffer: buf });
        if (res && res.value) {
          return cleanExtractedString(res.value);
        }
      } else {
        const binaryStr = atob(cleanB64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
        const res = await mammoth.extractRawText({ arrayBuffer });
        if (res && res.value) {
          return cleanExtractedString(res.value);
        }
      }
    } catch (docxErr) {
      console.warn('[DocExtractor] base64 docx extraction notice:', docxErr);
    }
  }

  // Plain text handling
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerMime.startsWith('text/')) {
    try {
      if (typeof Buffer !== 'undefined') {
        return cleanExtractedString(Buffer.from(cleanB64, 'base64').toString('utf-8'));
      } else {
        const decoded = atob(cleanB64);
        return cleanExtractedString(decoded);
      }
    } catch (txtErr) {
      console.warn('[DocExtractor] base64 text decoding notice:', txtErr);
    }
  }

  return '';
}

/**
 * Purges all leaked docProps, XML tags, binary zip headers (e.g. [Content_Types], docProps),
 * and compresses whitespace.
 */
export function cleanExtractedString(raw: string): string {
  if (!raw) return '';
  
  // If the string starts with zip or binary header indicators, reject the binary noise
  if (raw.startsWith('PK\x03\x04') || raw.startsWith('PK\x05\x06') || raw.includes('[Content_Types].xml')) {
    // If it contains XML with text nodes, attempt to pull purely inner text
    const textNodeMatches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textNodeMatches && textNodeMatches.length > 0) {
      raw = textNodeMatches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
    } else {
      return '';
    }
  }

  return raw
    // Remove XML tags if any
    .replace(/<[^>]+>/g, ' ')
    // Remove OpenXML namespaces, docProps, and schemas
    .replace(/schemas\.(?:openxmlformats|microsoft)\.org[^\s]*/gi, '')
    .replace(/\[Content_Types\]\.xml[^\s]*/gi, '')
    .replace(/docProps\/(?:app|core|custom)\.xml[^\s]*/gi, '')
    .replace(/word\/(?:document|fontTable|styles|settings|webSettings)\.xml[^\s]*/gi, '')
    .replace(/_rels\/\.rels[^\s]*/gi, '')
    // Normalize line breaks and multiple whitespaces
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
