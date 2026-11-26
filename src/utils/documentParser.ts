import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { renderPdfFirstPageToImage, isMockDrawingPreview } from './pdfRenderer';

export type ReaderBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'note'; label: string; text: string };

export interface ParsedDocumentPage {
  pageNumber: number;
  kind: 'document' | 'slide' | 'sheet' | 'image';
  title?: string;
  blocks: ReaderBlock[];
  speakerNotes?: string;
}

export interface ParsedDocumentResult {
  format:
    | 'pdf'
    | 'docx'
    | 'doc'
    | 'pptx'
    | 'ppt'
    | 'xlsx'
    | 'csv'
    | 'odt'
    | 'epub'
    | 'rtf'
    | 'text'
    | 'image'
    | 'unsupported';
  pages: ParsedDocumentPage[];
  pdfBytes?: ArrayBuffer;
  imageUrl?: string;
  warning?: string;
}

export function getDocumentExtension(fileName?: string, fileType?: string): string {
  const fromName = (fileName || '').split('.').pop()?.trim().toLowerCase() || '';
  if (fromName && fromName.length <= 10) return fromName;
  const fromType = (fileType || '').trim().toLowerCase().replace(/^\./, '');
  return fromType || '';
}

export function isReadableDocumentFormat(fileName?: string, fileType?: string): boolean {
  const ext = getDocumentExtension(fileName, fileType);
  return [
    'pdf',
    'docx',
    'doc',
    'pptx',
    'ppt',
    'xlsx',
    'xls',
    'csv',
    'tsv',
    'ods',
    'odt',
    'epub',
    'rtf',
    'txt',
    'md',
    'markdown',
    'json',
    'xml',
    'log',
    'yaml',
    'yml',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'gif',
    'svg',
  ].includes(ext);
}

/**
 * Resolve a safe ArrayBuffer from either a data: URI, http(s) URL (with SSRF-safe server proxy fallback), or File/Blob
 */
export async function loadDocumentArrayBuffer(source: string | File | Blob): Promise<ArrayBuffer> {
  if (typeof source !== 'string') {
    return await source.arrayBuffer();
  }
  const clean = source.trim();
  if (clean.startsWith('data:')) {
    const commaIdx = clean.indexOf(',');
    if (commaIdx === -1) throw new Error('Invalid data URI');
    const meta = clean.slice(0, commaIdx);
    const payload = clean.slice(commaIdx + 1);
    if (/;base64/i.test(meta)) {
      const bin = atob(payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    }
    const decoded = decodeURIComponent(payload);
    return new TextEncoder().encode(decoded).buffer;
  }

  // Try direct fetch first; fall back to same-origin /api/documents/proxy on CORS failure
  try {
    const res = await fetch(clean, { mode: 'cors' });
    if (res.ok) {
      return await res.arrayBuffer();
    }
  } catch {
    // Fall through to proxy
  }

  if (/^https?:\/\//i.test(clean)) {
    const proxyRes = await fetch(`/api/documents/proxy?url=${encodeURIComponent(clean)}`);
    if (!proxyRes.ok) {
      throw new Error(`Unable to load document (${proxyRes.status})`);
    }
    return await proxyRes.arrayBuffer();
  }

  const localRes = await fetch(clean);
  if (!localRes.ok) {
    throw new Error(`Unable to load document (${localRes.status})`);
  }
  return await localRes.arrayBuffer();
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function isSafeReaderImageSrc(raw: string): boolean {
  const s = (raw || '').trim();
  if (!s) return false;
  if (/^https:\/\//i.test(s)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(s)) return true;
  return false;
}

/**
 * Convert HTML (from mammoth / epub) into sanitized ReaderBlock[] via DOMParser without raw HTML injection.
 */
function htmlToReaderBlocks(html: string, imageResolver?: (src: string) => string | null): ReaderBlock[] {
  if (typeof DOMParser === 'undefined') {
    const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped ? [{ type: 'paragraph', text: stripped }] : [];
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: ReaderBlock[] = [];

  const extractInlineText = (el: Node): string => {
    if (el.nodeType === Node.TEXT_NODE) return el.textContent || '';
    if (el.nodeType !== Node.ELEMENT_NODE) return '';
    const node = el as Element;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';
    let out = '';
    node.childNodes.forEach((child) => {
      out += extractInlineText(child);
    });
    return out;
  };

  const walk = (container: Element) => {
    Array.from(container.children).forEach((el) => {
      const tag = el.tagName.toLowerCase();

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const lvl = Number(tag.slice(1)) as 1 | 2 | 3 | 4;
        const txt = normalizeWhitespace(extractInlineText(el));
        if (txt) blocks.push({ type: 'heading', level: lvl, text: txt });
        return;
      }

      if (tag === 'p') {
        const imgs = Array.from(el.querySelectorAll('img'));
        imgs.forEach((imgEl) => {
          const rawSrc = imgEl.getAttribute('src') || '';
          const resolved = imageResolver ? imageResolver(rawSrc) : rawSrc;
          if (resolved && isSafeReaderImageSrc(resolved)) {
            blocks.push({ type: 'image', src: resolved, alt: imgEl.getAttribute('alt') || 'Figure' });
          }
        });
        const txt = normalizeWhitespace(extractInlineText(el));
        if (txt) blocks.push({ type: 'paragraph', text: txt });
        return;
      }

      if (tag === 'blockquote') {
        const txt = normalizeWhitespace(extractInlineText(el));
        if (txt) blocks.push({ type: 'quote', text: txt });
        return;
      }

      if (tag === 'pre' || tag === 'code') {
        const txt = (el.textContent || '').trim();
        if (txt) blocks.push({ type: 'code', text: txt });
        return;
      }

      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(el.children)
          .filter((li) => li.tagName.toLowerCase() === 'li')
          .map((li) => normalizeWhitespace(extractInlineText(li)))
          .filter(Boolean);
        if (items.length > 0) {
          blocks.push({ type: 'list', ordered: tag === 'ol', items });
        }
        return;
      }

      if (tag === 'table') {
        const allRows = Array.from(el.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('th, td')).map((cell) =>
            normalizeWhitespace(extractInlineText(cell))
          )
        );
        const nonEmpty = allRows.filter((r) => r.some((c) => c.length > 0));
        if (nonEmpty.length > 0) {
          const [first, ...rest] = nonEmpty;
          blocks.push({
            type: 'table',
            headers: first,
            rows: rest,
          });
        }
        return;
      }

      if (tag === 'img') {
        const rawSrc = el.getAttribute('src') || '';
        const resolved = imageResolver ? imageResolver(rawSrc) : rawSrc;
        if (resolved && isSafeReaderImageSrc(resolved)) {
          blocks.push({ type: 'image', src: resolved, alt: el.getAttribute('alt') || 'Figure' });
        }
        return;
      }

      if (el.children.length > 0) {
        walk(el);
      } else {
        const txt = normalizeWhitespace(extractInlineText(el));
        if (txt) blocks.push({ type: 'paragraph', text: txt });
      }
    });
  };

  walk(doc.body);
  if (blocks.length === 0) {
    const fallbackText = normalizeWhitespace(doc.body.textContent || '');
    if (fallbackText) blocks.push({ type: 'paragraph', text: fallbackText });
  }
  return blocks;
}

/**
 * Paginate structured blocks into balanced reading pages (~2200 visual weight units per page)
 */
function paginateBlocks(
  blocks: ReaderBlock[],
  kind: ParsedDocumentPage['kind'] = 'document',
  defaultTitle?: string
): ParsedDocumentPage[] {
  if (blocks.length === 0) {
    return [{ pageNumber: 1, kind, title: defaultTitle, blocks: [] }];
  }

  const MAX_PAGE_WEIGHT = 2300;
  const pages: ParsedDocumentPage[] = [];
  let currentBlocks: ReaderBlock[] = [];
  let currentWeight = 0;

  const estimateWeight = (b: ReaderBlock): number => {
    switch (b.type) {
      case 'heading':
        return 140 + b.text.length * 1.4;
      case 'paragraph':
        return 90 + b.text.length;
      case 'quote':
        return 110 + b.text.length * 1.1;
      case 'code':
        return 120 + b.text.length * 1.3;
      case 'list':
        return 80 + b.items.reduce((s, i) => s + 48 + i.length, 0);
      case 'table':
        return 140 + b.rows.length * 65;
      case 'image':
        return 520;
      case 'note':
        return 100 + b.text.length;
    }
  };

  const pushPage = () => {
    if (currentBlocks.length > 0) {
      pages.push({
        pageNumber: pages.length + 1,
        kind,
        title: defaultTitle,
        blocks: currentBlocks,
      });
      currentBlocks = [];
      currentWeight = 0;
    }
  };

  for (const block of blocks) {
    // Split oversized tables across pages cleanly
    if (block.type === 'table' && block.rows.length > 26) {
      const chunkSize = 24;
      for (let i = 0; i < block.rows.length; i += chunkSize) {
        const subTable: ReaderBlock = {
          type: 'table',
          headers: block.headers,
          rows: block.rows.slice(i, i + chunkSize),
        };
        const w = estimateWeight(subTable);
        if (currentBlocks.length > 0 && currentWeight + w > MAX_PAGE_WEIGHT) {
          pushPage();
        }
        currentBlocks.push(subTable);
        currentWeight += w;
        if (i + chunkSize < block.rows.length) pushPage();
      }
      continue;
    }

    // Split huge paragraphs cleanly at sentence boundaries
    if (block.type === 'paragraph' && block.text.length > 1800) {
      const chunks = block.text.match(/.{1,1200}(?:\s+|$)/gs) || [block.text];
      for (const ch of chunks) {
        const trimmed = ch.trim();
        if (!trimmed) continue;
        const sub: ReaderBlock = { type: 'paragraph', text: trimmed };
        const w = estimateWeight(sub);
        if (currentBlocks.length > 0 && currentWeight + w > MAX_PAGE_WEIGHT) {
          pushPage();
        }
        currentBlocks.push(sub);
        currentWeight += w;
      }
      continue;
    }

    const weight = estimateWeight(block);
    // Keep major headings with following content where possible
    const isMajorHeading = block.type === 'heading' && block.level <= 2;
    if (
      currentBlocks.length > 0 &&
      (currentWeight + weight > MAX_PAGE_WEIGHT ||
        (isMajorHeading && currentWeight > MAX_PAGE_WEIGHT * 0.72))
    ) {
      pushPage();
    }
    currentBlocks.push(block);
    currentWeight += weight;
  }

  pushPage();
  return pages.length > 0 ? pages : [{ pageNumber: 1, kind, title: defaultTitle, blocks: [] }];
}

function parsePlainTextOrMarkdown(rawText: string): ReaderBlock[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReaderBlock[] = [];
  let paraLines: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let inCode = false;
  let codeLines: string[] = [];

  const flushPara = () => {
    if (paraLines.length > 0) {
      const text = paraLines.join(' ').replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ type: 'paragraph', text });
      paraLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: 'list', ordered: listOrdered, items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^```/.test(line.trim())) {
      flushPara();
      flushList();
      if (inCode) {
        blocks.push({ type: 'code', text: codeLines.join('\n') });
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      flushPara();
      flushList();
      blocks.push({
        type: 'heading',
        level: Math.min(4, hMatch[1].length) as 1 | 2 | 3 | 4,
        text: hMatch[2].trim(),
      });
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      flushPara();
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(ulMatch[1].trim());
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      flushPara();
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(olMatch[1].trim());
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushPara();
      flushList();
      blocks.push({ type: 'quote', text: trimmed.replace(/^>\s*/, '') });
      continue;
    }

    flushList();
    paraLines.push(trimmed);
  }

  if (inCode && codeLines.length > 0) {
    blocks.push({ type: 'code', text: codeLines.join('\n') });
  }
  flushPara();
  flushList();
  return blocks;
}

function parseRtfToText(rtf: string): string {
  // Clean RTF control-word stripper skipping binary/destination groups
  let out = '';
  let depth = 0;
  let skipDepth: number | null = null;
  const skipDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'header',
    'footer',
    'themedata',
    'colorschememapping',
    'datastore',
    'latentstyles',
    'xmlnstbl',
  ]);

  let i = 0;
  while (i < rtf.length) {
    const ch = rtf[i];
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      if (skipDepth === depth) skipDepth = null;
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (skipDepth !== null) {
      i++;
      continue;
    }
    if (ch === '\\') {
      const next = rtf[i + 1];
      if (!next) break;
      if (next === '\\' || next === '{' || next === '}') {
        out += next;
        i += 2;
        continue;
      }
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        const code = parseInt(hex, 16);
        if (!Number.isNaN(code)) out += String.fromCharCode(code);
        i += 4;
        continue;
      }
      if (next === '*' && rtf[i + 2] === '\\') {
        skipDepth = depth;
        i += 3;
        continue;
      }
      const m = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (m) {
        const word = m[1].toLowerCase();
        if (skipDestinations.has(word)) {
          skipDepth = depth;
        } else if (word === 'par' || word === 'line') {
          out += '\n\n';
        } else if (word === 'tab') {
          out += '  ';
        } else if (word === 'u' && m[2]) {
          const code = Number(m[2]);
          if (code > 0) out += String.fromCharCode(code);
        }
        i += 1 + m[0].length;
        continue;
      }
      i += 2;
      continue;
    }
    if (ch !== '\r' && ch !== '\n') {
      out += ch;
    }
    i++;
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

async function parsePptxBuffer(buffer: ArrayBuffer): Promise<ParsedDocumentPage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  // Order slides using slide file numeric suffix (ppt/slides/slide1.xml, slide2.xml, ...)
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  // Preload media files as data URLs
  const mediaDataUrls = new Map<string, string>();
  const mediaFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/media\/.+\.(png|jpe?g|gif|webp|svg)$/i.test(name)
  );
  for (const mf of mediaFiles) {
    try {
      const ext = mf.split('.').pop()?.toLowerCase() || 'png';
      const mime =
        ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'svg'
          ? 'image/svg+xml'
          : `image/${ext}`;
      const b64 = await zip.file(mf)!.async('base64');
      mediaDataUrls.set(mf, `data:${mime};base64,${b64}`);
    } catch {}
  }

  const pages: ParsedDocumentPage[] = [];

  for (let idx = 0; idx < slideEntries.length; idx++) {
    const slidePath = slideEntries[idx];
    const slideFileName = slidePath.split('/').pop()!;
    const xmlStr = await zip.file(slidePath)!.async('string');
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

    const blocks: ReaderBlock[] = [];
    let slideTitle = '';

    // Parse slide relationships for images & notes
    const relsPath = `ppt/slides/_rels/${slideFileName}.rels`;
    const relTargets = new Map<string, string>();
    let notesPath: string | null = null;
    if (zip.file(relsPath)) {
      const relsXml = await zip.file(relsPath)!.async('string');
      const relsDoc = parser.parseFromString(relsXml, 'application/xml');
      Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((rel) => {
        const id = rel.getAttribute('Id') || '';
        const target = rel.getAttribute('Target') || '';
        const normalizedTarget = target.replace(/^(\.\.\/)+/, 'ppt/');
        if (id && target) relTargets.set(id, normalizedTarget);
        if (normalizedTarget.includes('notesSlides/')) {
          notesPath = normalizedTarget;
        }
      });
    }

    // Extract shapes (p:sp)
    const shapes = Array.from(xmlDoc.getElementsByTagNameNS('*', 'sp'));
    for (const sp of shapes) {
      const nvSpPr = sp.getElementsByTagNameNS('*', 'nvSpPr')[0];
      const ph = nvSpPr?.getElementsByTagNameNS('*', 'ph')[0];
      const phType = ph?.getAttribute('type') || '';

      const paras = Array.from(sp.getElementsByTagNameNS('*', 'p'));
      const shapeLines: string[] = [];
      for (const p of paras) {
        const runs = Array.from(p.getElementsByTagNameNS('*', 't'))
          .map((t) => t.textContent || '')
          .join('');
        const cleaned = normalizeWhitespace(runs);
        if (cleaned) shapeLines.push(cleaned);
      }

      if (shapeLines.length === 0) continue;

      if ((phType === 'title' || phType === 'ctrTitle') && !slideTitle) {
        slideTitle = shapeLines.join(' ');
        blocks.push({ type: 'heading', level: 1, text: slideTitle });
      } else if (phType === 'subTitle') {
        blocks.push({ type: 'heading', level: 3, text: shapeLines.join(' ') });
      } else if (shapeLines.length > 1) {
        blocks.push({ type: 'list', ordered: false, items: shapeLines });
      } else {
        blocks.push({ type: 'paragraph', text: shapeLines[0] });
      }
    }

    // Extract tables (a:tbl)
    const tables = Array.from(xmlDoc.getElementsByTagNameNS('*', 'tbl'));
    for (const tbl of tables) {
      const rows = Array.from(tbl.getElementsByTagNameNS('*', 'tr')).map((tr) =>
        Array.from(tr.getElementsByTagNameNS('*', 'tc')).map((tc) => {
          const texts = Array.from(tc.getElementsByTagNameNS('*', 't'))
            .map((t) => t.textContent || '')
            .join(' ');
          return normalizeWhitespace(texts);
        })
      );
      if (rows.length > 0) {
        blocks.push({ type: 'table', headers: rows[0], rows: rows.slice(1) });
      }
    }

    // Extract embedded pictures (p:pic -> a:blip r:embed)
    const blips = Array.from(xmlDoc.getElementsByTagNameNS('*', 'blip'));
    for (const blip of blips) {
      const rId =
        blip.getAttribute('r:embed') ||
        blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ||
        '';
      const target = relTargets.get(rId);
      if (target && mediaDataUrls.has(target)) {
        blocks.push({
          type: 'image',
          src: mediaDataUrls.get(target)!,
          alt: slideTitle || `Slide ${idx + 1} visual`,
        });
      }
    }

    // Speaker notes
    let speakerNotes = '';
    if (notesPath && zip.file(notesPath)) {
      try {
        const notesXml = await zip.file(notesPath)!.async('string');
        const notesDoc = parser.parseFromString(notesXml, 'application/xml');
        speakerNotes = Array.from(notesDoc.getElementsByTagNameNS('*', 't'))
          .map((t) => t.textContent || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      } catch {}
    }

    pages.push({
      pageNumber: idx + 1,
      kind: 'slide',
      title: slideTitle || `Slide ${idx + 1}`,
      blocks:
        blocks.length > 0
          ? blocks
          : [{ type: 'paragraph', text: `Slide ${idx + 1}` }],
      ...(speakerNotes ? { speakerNotes } : {}),
    });
  }

  return pages.length > 0
    ? pages
    : [{ pageNumber: 1, kind: 'slide', title: 'Presentation', blocks: [] }];
}

async function parseOdtBuffer(buffer: ArrayBuffer): Promise<ParsedDocumentPage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file('content.xml');
  if (!contentFile) return [{ pageNumber: 1, kind: 'document', blocks: [] }];
  const xmlStr = await contentFile.async('string');
  const xmlDoc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  const blocks: ReaderBlock[] = [];

  const bodyText = xmlDoc.getElementsByTagNameNS('*', 'text')[0];
  const root = bodyText || xmlDoc.documentElement;
  Array.from(root.children).forEach((el) => {
    const local = el.localName;
    if (local === 'h') {
      const lvl = Math.min(4, Math.max(1, Number(el.getAttribute('text:outline-level') || 2))) as 1 | 2 | 3 | 4;
      const txt = normalizeWhitespace(el.textContent || '');
      if (txt) blocks.push({ type: 'heading', level: lvl, text: txt });
    } else if (local === 'p') {
      const txt = normalizeWhitespace(el.textContent || '');
      if (txt) blocks.push({ type: 'paragraph', text: txt });
    } else if (local === 'list') {
      const items = Array.from(el.getElementsByTagNameNS('*', 'list-item'))
        .map((li) => normalizeWhitespace(li.textContent || ''))
        .filter(Boolean);
      if (items.length > 0) blocks.push({ type: 'list', ordered: false, items });
    } else if (local === 'table') {
      const rows = Array.from(el.getElementsByTagNameNS('*', 'table-row')).map((tr) =>
        Array.from(tr.getElementsByTagNameNS('*', 'table-cell')).map((tc) =>
          normalizeWhitespace(tc.textContent || '')
        )
      );
      if (rows.length > 0) {
        blocks.push({ type: 'table', headers: rows[0], rows: rows.slice(1) });
      }
    }
  });

  return paginateBlocks(blocks, 'document');
}

async function parseEpubBuffer(buffer: ArrayBuffer): Promise<ParsedDocumentPage[]> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new DOMParser();

  let opfPath = '';
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (containerXml) {
    const cDoc = parser.parseFromString(containerXml, 'application/xml');
    const rootfile = cDoc.getElementsByTagName('rootfile')[0];
    opfPath = rootfile?.getAttribute('full-path') || '';
  }

  let orderedHrefs: string[] = [];
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  if (opfPath && zip.file(opfPath)) {
    const opfXml = await zip.file(opfPath)!.async('string');
    const opfDoc = parser.parseFromString(opfXml, 'application/xml');
    const idToHref = new Map<string, string>();
    Array.from(opfDoc.getElementsByTagName('item')).forEach((item) => {
      const id = item.getAttribute('id') || '';
      const href = item.getAttribute('href') || '';
      if (id && href) idToHref.set(id, opfDir + href);
    });
    Array.from(opfDoc.getElementsByTagName('itemref')).forEach((ref) => {
      const idref = ref.getAttribute('idref') || '';
      const resolved = idToHref.get(idref);
      if (resolved) orderedHrefs.push(resolved);
    });
  }

  if (orderedHrefs.length === 0) {
    orderedHrefs = Object.keys(zip.files)
      .filter((n) => /\.(x?html?|xml)$/i.test(n) && !n.includes('container.xml'))
      .sort();
  }

  const allBlocks: ReaderBlock[] = [];
  for (const href of orderedHrefs) {
    const file = zip.file(href) || zip.file(decodeURIComponent(href));
    if (!file) continue;
    const html = await file.async('string');
    const chapterBlocks = htmlToReaderBlocks(html);
    allBlocks.push(...chapterBlocks);
  }

  return paginateBlocks(allBlocks, 'document');
}

function parseSpreadsheetBuffer(buffer: ArrayBuffer, isCsv = false): ParsedDocumentPage[] {
  const wb = isCsv
    ? XLSX.read(new TextDecoder().decode(new Uint8Array(buffer)), { type: 'string' })
    : XLSX.read(buffer, { type: 'array' });

  const pages: ParsedDocumentPage[] = [];
  const ROWS_PER_PAGE = 28;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    const cleanRows = matrix
      .map((r) => r.map((c) => String(c ?? '').trim()))
      .filter((r) => r.some((c) => c.length > 0));

    if (cleanRows.length === 0) {
      pages.push({
        pageNumber: pages.length + 1,
        kind: 'sheet',
        title: sheetName,
        blocks: [{ type: 'paragraph', text: `Empty sheet "${sheetName}"` }],
      });
      continue;
    }

    const headers = cleanRows[0];
    const dataRows = cleanRows.slice(1);
    if (dataRows.length === 0) {
      pages.push({
        pageNumber: pages.length + 1,
        kind: 'sheet',
        title: sheetName,
        blocks: [{ type: 'table', headers, rows: [] }],
      });
      continue;
    }

    for (let i = 0; i < dataRows.length; i += ROWS_PER_PAGE) {
      pages.push({
        pageNumber: pages.length + 1,
        kind: 'sheet',
        title: dataRows.length > ROWS_PER_PAGE ? `${sheetName} (Rows ${i + 1}–${Math.min(dataRows.length, i + ROWS_PER_PAGE)})` : sheetName,
        blocks: [{ type: 'table', headers, rows: dataRows.slice(i, i + ROWS_PER_PAGE) }],
      });
    }
  }

  return pages.length > 0
    ? pages
    : [{ pageNumber: 1, kind: 'sheet', title: 'Spreadsheet', blocks: [] }];
}

/**
 * Parse any supported document into structured reader pages.
 */
export async function parseDocumentForReader(
  source: string | File | Blob,
  fileName: string,
  fileType?: string
): Promise<ParsedDocumentResult> {
  const ext = getDocumentExtension(fileName, fileType);

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    let imageUrl = typeof source === 'string' ? source : '';
    if (!imageUrl && typeof source !== 'string') {
      imageUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.readAsDataURL(source);
      });
    }
    return {
      format: 'image',
      imageUrl,
      pages: [
        {
          pageNumber: 1,
          kind: 'image',
          title: fileName,
          blocks: imageUrl ? [{ type: 'image', src: imageUrl, alt: fileName }] : [],
        },
      ],
    };
  }

  const buffer = await loadDocumentArrayBuffer(source);

  if (ext === 'pdf') {
    return { format: 'pdf', pages: [], pdfBytes: buffer };
  }

  if (ext === 'docx') {
    const res = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      {
        convertImage: mammoth.images.imgElement((image) =>
          image.read('base64').then((imageBuffer) => ({
            src: `data:${image.contentType || 'image/png'};base64,${imageBuffer}`,
          }))
        ),
      }
    );
    const blocks = htmlToReaderBlocks(res.value || '');
    return { format: 'docx', pages: paginateBlocks(blocks, 'document') };
  }

  if (ext === 'pptx') {
    const pages = await parsePptxBuffer(buffer);
    return { format: 'pptx', pages };
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const pages = parseSpreadsheetBuffer(buffer, false);
    return { format: 'xlsx', pages };
  }

  if (ext === 'csv' || ext === 'tsv') {
    const pages = parseSpreadsheetBuffer(buffer, true);
    return { format: 'csv', pages };
  }

  if (ext === 'odt') {
    const pages = await parseOdtBuffer(buffer);
    return { format: 'odt', pages };
  }

  if (ext === 'epub') {
    const pages = await parseEpubBuffer(buffer);
    return { format: 'epub', pages };
  }

  if (ext === 'rtf') {
    const raw = new TextDecoder().decode(new Uint8Array(buffer));
    const text = parseRtfToText(raw);
    const blocks = parsePlainTextOrMarkdown(text);
    return { format: 'rtf', pages: paginateBlocks(blocks, 'document') };
  }

  if (['txt', 'md', 'markdown', 'json', 'xml', 'log', 'yaml', 'yml'].includes(ext)) {
    const raw = new TextDecoder().decode(new Uint8Array(buffer));
    if (ext === 'json') {
      try {
        const pretty = JSON.stringify(JSON.parse(raw), null, 2);
        return {
          format: 'text',
          pages: paginateBlocks([{ type: 'code', text: pretty }], 'document'),
        };
      } catch {}
    }
    const blocks = parsePlainTextOrMarkdown(raw);
    return { format: 'text', pages: paginateBlocks(blocks, 'document') };
  }

  if (ext === 'doc' || ext === 'ppt') {
    // Call server-side binary converter endpoint cleanly
    try {
      const base64 = await new Promise<string>((resolve) => {
        const blob = new Blob([buffer]);
        const reader = new FileReader();
        reader.onload = () => {
          const resStr = String(reader.result || '');
          resolve(resStr.split(',')[1] || '');
        };
        reader.readAsDataURL(blob);
      });
      const convRes = await fetch('/api/documents/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, ext, base64 }),
      });
      if (convRes.ok) {
        const payload = await convRes.json();
        if (Array.isArray(payload?.pages) && payload.pages.length > 0) {
          return {
            format: ext as 'doc' | 'ppt',
            pages: payload.pages,
          };
        }
      }
    } catch {}
    return {
      format: ext as 'doc' | 'ppt',
      pages: [
        {
          pageNumber: 1,
          kind: ext === 'ppt' ? 'slide' : 'document',
          title: fileName,
          blocks: [
            {
              type: 'paragraph',
              text: 'Legacy binary document could not be parsed cleanly. Please save as DOCX, PPTX, or PDF for full high-fidelity rendering.',
            },
          ],
        },
      ],
      warning: 'Legacy binary format rendered with limited fidelity.',
    };
  }

  return {
    format: 'unsupported',
    pages: [
      {
        pageNumber: 1,
        kind: 'document',
        title: fileName,
        blocks: [
          {
            type: 'paragraph',
            text: `Preview and paginated reading for ".${ext || 'file'}" files are not directly supported in the browser reader.`,
          },
        ],
      },
    ],
  };
}

/**
 * Draw a crisp, legible Page-1 thumbnail raster PNG onto canvas from parsed non-PDF pages
 */
function paintPageThumbnailCanvas(
  page: ParsedDocumentPage,
  formatLabel: string,
  title: string,
  width = 800
): string | null {
  if (typeof document === 'undefined') return null;
  const height = Math.round(width * 1.15);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;

  const isSlide = page.kind === 'slide';
  const isSheet = page.kind === 'sheet';

  // Background paper mount
  ctx.fillStyle = isSlide ? '#0f172a' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (isSlide) {
    // Clean widescreen slide card framed inside thumbnail
    const slideMarginX = Math.round(width * 0.06);
    const slideH = Math.round((width - slideMarginX * 2) * 0.62);
    const slideY = Math.round((height - slideH) * 0.42);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(slideMarginX, slideY, width - slideMarginX * 2, slideH);

    // Top accent rule
    ctx.fillStyle = '#164e63';
    ctx.fillRect(slideMarginX, slideY, width - slideMarginX * 2, Math.round(width * 0.015));

    let curY = slideY + Math.round(width * 0.075);
    const leftX = slideMarginX + Math.round(width * 0.055);
    const maxW = width - slideMarginX * 2 - Math.round(width * 0.11);

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(width * 0.042)}px Georgia, "Times New Roman", serif`;
    const slideHeading = page.title || title;
    const words = slideHeading.split(/\s+/);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, leftX, curY);
        curY += Math.round(width * 0.052);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, leftX, curY);
      curY += Math.round(width * 0.06);
    }

    ctx.fillStyle = '#334155';
    ctx.font = `${Math.round(width * 0.028)}px Georgia, "Times New Roman", serif`;
    for (const blk of page.blocks) {
      if (curY > slideY + slideH - 30) break;
      const linesToDraw =
        blk.type === 'list'
          ? blk.items.map((it) => `• ${it}`)
          : blk.type === 'paragraph' || blk.type === 'quote'
          ? [blk.text]
          : [];
      for (const itemText of linesToDraw) {
        if (curY > slideY + slideH - 24) break;
        const truncated = itemText.length > 78 ? `${itemText.slice(0, 75)}...` : itemText;
        ctx.fillText(truncated, leftX, curY);
        curY += Math.round(width * 0.04);
      }
    }
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  // Editorial Document / Spreadsheet Thumbnail
  const padX = Math.round(width * 0.09);
  const maxW = width - padX * 2;
  let y = Math.round(width * 0.1);

  // Header accent line
  ctx.fillStyle = '#164e63';
  ctx.fillRect(padX, y - Math.round(width * 0.03), Math.round(width * 0.14), 4);

  ctx.fillStyle = '#64748b';
  ctx.font = `bold ${Math.round(width * 0.022)}px ui-monospace, monospace`;
  ctx.fillText(formatLabel.toUpperCase(), padX, y);
  y += Math.round(width * 0.055);

  const drawWrapped = (text: string, font: string, color: string, lineH: number, maxLines = 12) => {
    ctx.font = font;
    ctx.fillStyle = color;
    const words = text.split(/\s+/);
    let line = '';
    let drawn = 0;
    for (const word of words) {
      if (y > height - Math.round(width * 0.08) || drawn >= maxLines) break;
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, padX, y);
        y += lineH;
        line = word;
        drawn++;
      } else {
        line = test;
      }
    }
    if (line && y <= height - Math.round(width * 0.06) && drawn < maxLines) {
      ctx.fillText(line, padX, y);
      y += lineH;
    }
  };

  if (isSheet) {
    const tbl = page.blocks.find((b): b is Extract<ReaderBlock, { type: 'table' }> => b.type === 'table');
    drawWrapped(page.title || title || 'Spreadsheet', `bold ${Math.round(width * 0.038)}px Georgia, serif`, '#0f172a', Math.round(width * 0.048), 2);
    y += 12;
    if (tbl) {
      const cols = Math.min(4, Math.max(1, tbl.headers.length));
      const colW = Math.floor(maxW / cols);
      const rowH = Math.round(width * 0.056);

      // Header row
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(padX, y, maxW, rowH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(padX, y, maxW, rowH);
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${Math.round(width * 0.024)}px ui-monospace, monospace`;
      for (let c = 0; c < cols; c++) {
        const cellText = (tbl.headers[c] || `Col ${c + 1}`).slice(0, 14);
        ctx.fillText(cellText, padX + c * colW + 8, y + Math.round(rowH * 0.65));
      }
      y += rowH;

      // Data rows
      ctx.font = `${Math.round(width * 0.022)}px ui-monospace, monospace`;
      for (const row of tbl.rows.slice(0, 11)) {
        if (y + rowH > height - 40) break;
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(padX, y, maxW, rowH);
        ctx.fillStyle = '#334155';
        for (let c = 0; c < cols; c++) {
          const cellText = (row[c] || '').slice(0, 14);
          ctx.fillText(cellText, padX + c * colW + 8, y + Math.round(rowH * 0.65));
        }
        y += rowH;
      }
    }
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  for (const blk of page.blocks) {
    if (y > height - Math.round(width * 0.09)) break;
    if (blk.type === 'heading') {
      const size = blk.level === 1 ? Math.round(width * 0.044) : Math.round(width * 0.034);
      drawWrapped(blk.text, `bold ${size}px Georgia, "Times New Roman", serif`, '#0f172a', Math.round(size * 1.28), 3);
      y += 10;
    } else if (blk.type === 'paragraph' || blk.type === 'quote') {
      const size = Math.round(width * 0.028);
      drawWrapped(blk.text, `${blk.type === 'quote' ? 'italic ' : ''}${size}px Georgia, "Times New Roman", serif`, '#334155', Math.round(size * 1.48), 8);
      y += 12;
    } else if (blk.type === 'list') {
      const size = Math.round(width * 0.027);
      for (const item of blk.items.slice(0, 6)) {
        if (y > height - Math.round(width * 0.08)) break;
        drawWrapped(`• ${item}`, `${size}px Georgia, "Times New Roman", serif`, '#334155', Math.round(size * 1.44), 2);
      }
      y += 8;
    } else if (blk.type === 'code') {
      const size = Math.round(width * 0.024);
      drawWrapped(blk.text.slice(0, 320), `${size}px ui-monospace, monospace`, '#1e293b', Math.round(size * 1.42), 7);
      y += 10;
    }
  }

  // Subtle bottom rule
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(padX, height - Math.round(width * 0.06), maxW, 1);

  return canvas.toDataURL('image/jpeg', 0.92);
}

/**
 * Generate a crisp Page-1 preview thumbnail image (PNG/JPEG data URL) for PDF, DOCX, PPTX, XLSX, CSV, ODT, EPUB, RTF, TXT, or Image.
 */
export async function generateCrispDocumentThumbnail(
  source: string | File | Blob,
  fileName: string,
  fileType?: string,
  targetWidth = 900
): Promise<string | null> {
  const ext = getDocumentExtension(fileName, fileType);
  try {
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
      if (typeof source === 'string' && !isMockDrawingPreview(source)) {
        return source;
      }
      if (typeof source !== 'string') {
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(source);
        });
      }
      return null;
    }

    if (ext === 'pdf') {
      if (typeof source !== 'string') {
        const buf = await source.arrayBuffer();
        return await renderPdfFirstPageToImage(buf, targetWidth, 'image/jpeg', 0.94);
      }
      const direct = await renderPdfFirstPageToImage(source, targetWidth, 'image/jpeg', 0.94);
      if (direct) return direct;
      // Fallback via CORS-safe proxy buffer if remote direct URL failed CORS
      if (/^https?:\/\//i.test(source)) {
        try {
          const buf = await loadDocumentArrayBuffer(source);
          return await renderPdfFirstPageToImage(buf, targetWidth, 'image/jpeg', 0.94);
        } catch {
          return null;
        }
      }
      return null;
    }

    if (isReadableDocumentFormat(fileName, fileType)) {
      const parsed = await parseDocumentForReader(source, fileName, fileType);
      const firstPage = parsed.pages[0];
      if (!firstPage) return null;
      return paintPageThumbnailCanvas(firstPage, ext || fileType || 'DOC', fileName, targetWidth);
    }
  } catch (err) {
    console.warn('[Document Thumbnail Note]:', err);
  }
  return null;
}
