import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { detectDocumentSections, DetectedSection } from './documentStructureDetector';

export interface ExtractionResult {
  text: string;
  characterCount: number;
  wordCount: number;
  sections: DetectedSection[];
  error?: string;
}

// Client-side extraction cache by file signature
const clientExtractionCache = new Map<string, ExtractionResult>();

/**
 * Extracts clean, human-readable body text directly from an uploaded File.
 * Strips away all zip/XML container structures, binary metadata, and docProps.
 * Supports PDF, Scanned PDF, DOCX, DOC, XLSX, XLS, CSV, TXT, PPTX, and Images.
 */
export async function extractCleanTextFromFile(file: File): Promise<string> {
  const result = await extractDocumentWithStructure(file);
  return result.text;
}

/**
 * Comprehensive extraction returning text, metrics, and detected document sections.
 */
export async function extractDocumentWithStructure(file: File): Promise<ExtractionResult> {
  const fileSig = `${file.name}_${file.size}_${file.lastModified}`;
  if (clientExtractionCache.has(fileSig)) {
    return clientExtractionCache.get(fileSig)!;
  }

  const fileName = (file.name || '').toLowerCase();
  let rawText = '';
  let serverReportedError = '';

  // 1. Plain text files (.txt, .md, .csv, .tsv)
  if (
    fileName.endsWith('.txt') ||
    fileName.endsWith('.md') ||
    fileName.endsWith('.csv') ||
    fileName.endsWith('.tsv') ||
    file.type.startsWith('text/')
  ) {
    try {
      rawText = await file.text();
    } catch (e) {
      console.warn('[DocExtractor] Text file read warning:', e);
    }
  }

  // 2. Word documents (.docx, .doc)
  else if (
    fileName.endsWith('.docx') ||
    fileName.endsWith('.doc') ||
    file.type.includes('wordprocessingml') ||
    file.type.includes('officedocument')
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await mammoth.extractRawText({ arrayBuffer });
      if (res && res.value && res.value.trim().length > 0) {
        rawText = res.value;
      }
    } catch (e) {
      console.warn('[DocExtractor] Docx extraction warning:', e);
    }
  }

  // 3. PowerPoint presentations (.pptx)
  else if (fileName.endsWith('.pptx') || file.type.includes('presentation') || file.type.includes('powerpoint')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      const slideFiles = Object.keys(zip.files).filter((name) =>
        /^ppt\/slides\/slide\d+\.xml$/i.test(name)
      );
      slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
      });

      const slideTexts: string[] = [];
      for (let i = 0; i < slideFiles.length; i++) {
        const slideXml = await zip.files[slideFiles[i]].async('text');
        const matches = slideXml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
        if (matches && matches.length > 0) {
          const text = matches
            .map((m) => m.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean)
            .join(' ');
          if (text) {
            slideTexts.push(`--- Slide ${i + 1} ---\n${text}`);
          }
        }
      }
      if (slideTexts.length > 0) {
        rawText = slideTexts.join('\n\n');
      }
    } catch (e) {
      console.warn('[DocExtractor] PPTX extraction warning:', e);
    }
  }

  // 4. Spreadsheet documents (.xlsx, .xls)
  else if (
    fileName.endsWith('.xlsx') ||
    fileName.endsWith('.xls') ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel')
  ) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetTexts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv && csv.trim()) {
            sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
          }
        }
      }
      rawText = sheetTexts.join('\n\n');
    } catch (e) {
      console.warn('[DocExtractor] Excel extraction warning:', e);
    }
  }

  // 5. PDF, Scanned PDF, PPT, or Images (.png, .jpg, .jpeg, .webp)
  // For these formats, call server-side extraction engine powered by pdfjs-dist & Gemini 2.5 Flash OCR
  if (
    !rawText ||
    rawText.trim().length < 50 ||
    fileName.endsWith('.pdf') ||
    fileName.endsWith('.ppt') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.webp')
  ) {
    try {
      const base64Data = await readFileAsBase64(file);
      const serverExtraction = await callServerSideExtraction(base64Data, file.type, file.name);
      if (serverExtraction && serverExtraction.text && serverExtraction.text.trim().length >= 50) {
        rawText = serverExtraction.text;
      } else if (serverExtraction && serverExtraction.error) {
        serverReportedError = serverExtraction.error;
      }
    } catch (serverErr) {
      console.warn('[DocExtractor] Server-side OCR / PDF extraction notice:', serverErr);
    }
  }

  const cleaned = cleanExtractedString(rawText);
  const characterCount = cleaned.length;
  const wordCount = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;

  if (characterCount < 50) {
    return {
      text: '',
      characterCount: 0,
      wordCount: 0,
      sections: [],
      error: serverReportedError || 'The uploaded document contains no readable text or could not be extracted (0 characters). Please provide a valid, readable PDF, DOCX, spreadsheet, or text document.',
    };
  }

  const sections = detectDocumentSections(cleaned);

  const finalResult: ExtractionResult = {
    text: cleaned,
    characterCount,
    wordCount,
    sections,
  };

  clientExtractionCache.set(fileSig, finalResult);
  return finalResult;
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

  // Excel handling
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerMime.includes('spreadsheet')) {
    try {
      let arrayBuffer: ArrayBuffer;
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(cleanB64, 'base64');
        arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      } else {
        const binaryStr = atob(cleanB64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      }
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetTexts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (csv && csv.trim()) {
            sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
          }
        }
      }
      return cleanExtractedString(sheetTexts.join('\n\n'));
    } catch (e) {
      console.warn('[DocExtractor] base64 Excel extraction notice:', e);
    }
  }

  // Plain text handling
  if (lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.csv') || lowerMime.startsWith('text/')) {
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

  // Call server extraction endpoint for PDF, PPTX, or Images
  try {
    const serverExtraction = await callServerSideExtraction(cleanB64, mimeType, fileName);
    if (serverExtraction && serverExtraction.text) {
      return cleanExtractedString(serverExtraction.text);
    }
  } catch (err) {
    console.warn('[DocExtractor] Server fallback extraction error:', err);
  }

  return '';
}

/**
 * Helper to read a File as pure base64 string.
 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = (e.target?.result as string) || '';
      const base64Clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64Clean);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Calls `/api/easestudy/extract-text` for server-side parsing and Gemini 2.5 Flash OCR.
 */
async function callServerSideExtraction(
  base64: string,
  mimeType: string,
  fileName: string
): Promise<{ text: string; sections?: DetectedSection[]; error?: string } | null> {
  try {
    const response = await fetch('/api/easestudy/extract-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType, fileName }),
    });

    const data = await response.json();
    if (response.ok && data && data.success && data.extractedText) {
      return {
        text: data.extractedText,
        sections: data.sections || [],
      };
    } else if (data && data.error) {
      return {
        text: '',
        error: data.error,
      };
    }
  } catch (e) {
    console.warn('[DocExtractor] Server API call failed:', e);
  }
  return null;
}

/**
 * Sanitizes extracted document text before it reaches model parameters or prompt contexts.
 * Strips out internal file wrapper string injections, system header tags, MIME type labels,
 * and storage path strings (e.g., [Multimodal Document: ...], [application/pdf], storage/v1/object/public/...).
 */
export function sanitizeDocumentText(raw: string): string {
  if (!raw) return '';

  let sanitized = String(raw);

  // If the string starts with zip or binary header indicators, reject binary noise
  if (sanitized.startsWith('PK\x03\x04') || sanitized.startsWith('PK\x05\x06') || sanitized.includes('[Content_Types].xml')) {
    const textNodeMatches = sanitized.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textNodeMatches && textNodeMatches.length > 0) {
      sanitized = textNodeMatches.map((m) => m.replace(/<[^>]+>/g, '')).join(' ');
    } else {
      return '';
    }
  }

  // 1. Strip raw multimodal wrapper string injections, system header tags, and chunk labels
  sanitized = sanitized
    .replace(/\[Multimodal Document:[^\]]*\]/gi, '')
    .replace(/Multimodal Document:[^\n]*/gi, '')
    .replace(/\[Uploaded File:[^\]]*\]/gi, '')
    .replace(/Uploaded File:[^\n]*/gi, '')
    .replace(/\[Uploaded Document Content[^\]]*\]:?/gi, '')
    .replace(/Uploaded Document Content[^\n]*:?/gi, '')
    .replace(/User Provided Text\/Notes:?/gi, '')
    .replace(/\[AUTHORITATIVE_CHUNK_\d+\]:?/gi, '')
    .replace(/=== AUTHORITATIVE_SOURCE_DOCUMENT_(?:START|END) ===/gi, '')
    .replace(/--- (?:BEGIN|END) VERIFIED DOCUMENT SEGMENTS ---/gi, '')
    .replace(/\[STRICT GROUNDING DIRECTIVE[^\]]*\]/gi, '');

  // 2. Strip MIME type labels (e.g. [application/pdf], [image/png], application/pdf, etc.)
  sanitized = sanitized
    .replace(/\[(?:application|image|audio|video|text)\/[a-zA-Z0-9_.+-]+\]/gi, '')
    .replace(/\b(?:application\/(?:pdf|vnd\.[a-zA-Z0-9_.+-]+|msword|octet-stream|zip|json)|image\/(?:png|jpeg|jpg|webp|gif)|text\/(?:plain|csv|markdown))\b/gi, '');

  // 3. Strip Cloud / Supabase / local storage path strings and URLs
  sanitized = sanitized
    .replace(/https?:\/\/[^\s"'<>]+\/storage\/v1\/object\/public\/[^\s"'<>]+/gi, '')
    .replace(/storage\/v1\/object\/public\/[^\s"'<>]+/gi, '')
    .replace(/https?:\/\/[^\s"'<>]+\/api\/documents\/files\/[^\s"'<>]+/gi, '')
    .replace(/\/api\/documents\/files\/[^\s"'<>]+/gi, '')
    .replace(/(?:data\/uploads|\/app\/applet\/data)\/[^\s"'<>]+/gi, '')
    .replace(/\b(?:file:\/\/|uploads\/)[^\s"'<>]+/gi, '');

  // 4. Strip XML / OpenXML / HTML / DOCX container tags and artifacts
  sanitized = sanitized
    .replace(/<[^>]+>/g, ' ')
    .replace(/schemas\.(?:openxmlformats|microsoft)\.org[^\s]*/gi, '')
    .replace(/\[Content_Types\]\.xml[^\s]*/gi, '')
    .replace(/docProps\/(?:app|core|custom)\.xml[^\s]*/gi, '')
    .replace(/word\/(?:document|fontTable|styles|settings|webSettings)\.xml[^\s]*/gi, '')
    .replace(/_rels\/\.rels[^\s]*/gi, '');

  // 5. Clean slide, sheet, and page markers into clean natural section breaks
  sanitized = sanitized
    .replace(/--- Slide \d+ ---\n?/gi, '\n\n')
    .replace(/--- Sheet: [^\n]+ ---\n?/gi, '\n\n')
    .replace(/--- Page \d+ ---\n?/gi, '\n\n');

  // 6. Normalize whitespace and newlines
  sanitized = sanitized
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return sanitized;
}

/**
 * Purges all leaked docProps, XML tags, binary zip headers (e.g. [Content_Types], docProps),
 * internal file wrappers, and compresses whitespace.
 */
export function cleanExtractedString(raw: string): string {
  return sanitizeDocumentText(raw);
}

