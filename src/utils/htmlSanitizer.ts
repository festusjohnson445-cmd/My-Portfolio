const ALLOWED_TAGS = new Set([
  'p',
  'div',
  'span',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'code',
  'pre',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'a',
  'font',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'text-align',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'margin',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'padding',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-indent',
  'list-style-type',
]);

function sanitizeStyleValue(rawStyle: string): string {
  if (!rawStyle) return '';
  const parts = rawStyle.split(';');
  const safeParts: string[] = [];
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = part.slice(0, colonIdx).trim().toLowerCase();
    const val = part.slice(colonIdx + 1).trim();
    if (!ALLOWED_STYLE_PROPS.has(prop) || !val) continue;
    const lowerVal = val.toLowerCase();
    if (
      lowerVal.includes('url(') ||
      lowerVal.includes('expression(') ||
      lowerVal.includes('javascript:') ||
      lowerVal.includes('vbscript:') ||
      lowerVal.includes('@import')
    ) {
      continue;
    }
    safeParts.push(`${prop}: ${val}`);
  }
  return safeParts.join('; ');
}

export function isRichHtmlContent(content: string): boolean {
  if (!content) return false;
  return /<\s*(p|div|span|font|h[1-6]|ul|ol|li|strong|b|em|i|u|s|blockquote|pre|code|br|hr|table)\b[^>]*>/i.test(
    content
  );
}

export function sanitizeArticleHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return rawHtml
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (
      tag === 'script' ||
      tag === 'style' ||
      tag === 'iframe' ||
      tag === 'object' ||
      tag === 'embed' ||
      tag === 'svg' ||
      tag === 'math' ||
      tag === 'form' ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      tag === 'meta' ||
      tag === 'link'
    ) {
      return null;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      const frag = document.createDocumentFragment();
      el.childNodes.forEach((child) => {
        const cleaned = cleanNode(child);
        if (cleaned) frag.appendChild(cleaned);
      });
      return frag;
    }

    // Upgrade deprecated <font color="..."> to <span> cleanly
    const outEl =
      tag === 'font' ? document.createElement('span') : document.createElement(tag);

    if (tag === 'font') {
      const fontStyles: string[] = [];
      const col = el.getAttribute('color');
      if (col && /^#[0-9a-f]{3,8}$|^rgb\([\d\s,.]+\)$|^[a-z]+$/i.test(col.trim())) {
        fontStyles.push(`color: ${col.trim()}`);
      }
      const face = el.getAttribute('face');
      if (face && !/[<>]/.test(face)) {
        fontStyles.push(`font-family: ${face.trim()}`);
      }
      const sizeAttr = el.getAttribute('size');
      const sizeMap: Record<string, string> = {
        '1': '10px',
        '2': '13px',
        '3': '16px',
        '4': '18px',
        '5': '24px',
        '6': '32px',
        '7': '42px',
      };
      if (sizeAttr && sizeMap[sizeAttr.trim()]) {
        fontStyles.push(`font-size: ${sizeMap[sizeAttr.trim()]}`);
      }
      if (fontStyles.length > 0) {
        outEl.setAttribute('style', fontStyles.join('; '));
      }
    }

    const rawStyle = el.getAttribute('style');
    if (rawStyle) {
      const existingStyle = outEl.getAttribute('style');
      const cleanedStyle = sanitizeStyleValue(rawStyle);
      const combined = [existingStyle, cleanedStyle].filter(Boolean).join('; ');
      if (combined) outEl.setAttribute('style', combined);
    }

    if (tag === 'a') {
      const href = (el.getAttribute('href') || '').trim();
      if (/^(https?:\/\/|mailto:|#)/i.test(href)) {
        outEl.setAttribute('href', href);
        outEl.setAttribute('target', '_blank');
        outEl.setAttribute('rel', 'noopener noreferrer');
      }
    }

    el.childNodes.forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) outEl.appendChild(cleaned);
    });

    return outEl;
  };

  const container = document.createElement('div');
  doc.body.childNodes.forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) container.appendChild(cleaned);
  });

  const headings = container.querySelectorAll('h1, h2, h3');
  headings.forEach((h, idx) => {
    const text = (h.textContent || '').trim();
    if (!text) return;
    const slug =
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'sec';
    h.setAttribute('id', `sec-${idx}-${slug}`);
  });

  return container.innerHTML;
}

export function stripHtmlToPlainText(content: string): string {
  if (!content) return '';
  if (!isRichHtmlContent(content)) return content;
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractHtmlHeadings(
  rawHtml: string
): Array<{ id: string; label: string; level: number }> {
  if (!rawHtml || typeof window === 'undefined' || typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const out: Array<{ id: string; label: string; level: number }> = [];
  const headings = doc.body.querySelectorAll('h1, h2, h3');
  headings.forEach((h, idx) => {
    const text = (h.textContent || '').trim();
    if (!text) return;
    const slug =
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'sec';
    out.push({
      id: `sec-${idx}-${slug}`,
      label: text,
      level: Number(h.tagName.slice(1)) || 2,
    });
  });
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInlineMdToHtml(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return s;
}

export function markdownToBasicHtml(content: string): string {
  if (!content) return '';
  if (isRichHtmlContent(content)) return content;

  const lines = content.split('\n');
  const htmlBlocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++;
      htmlBlocks.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (hMatch) {
      const lvl = hMatch[1].length;
      htmlBlocks.push(`<h${lvl}>${formatInlineMdToHtml(hMatch[2].trim())}</h${lvl}>`);
      i++;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMdToHtml(lines[i].trim().replace(/^[-*•]\s+/, ''))}</li>`);
        i++;
      }
      htmlBlocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${formatInlineMdToHtml(lines[i].trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      htmlBlocks.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    const pLines: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s+|```|[-*•]\s+|\d+\.\s+)/.test(lines[i].trim())
    ) {
      pLines.push(lines[i].trim());
      i++;
    }
    htmlBlocks.push(`<p style="text-align: justify">${formatInlineMdToHtml(pLines.join(' '))}</p>`);
  }

  return htmlBlocks.join('');
}
