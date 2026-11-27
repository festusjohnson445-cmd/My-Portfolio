import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { CareerStudioTemplateId, DocumentFormPayload } from '../types/documentWorkspace';
import {
  SinglePageDocumentModel,
  TemplateSection,
  TwoPageDocumentModel,
  buildSinglePageDocumentModel,
  buildTwoPageDocumentModel,
} from './careerStudioTemplates';

// ============================================================================
// SHARED PDF / CANVAS COLOR PALETTES
// ============================================================================

const NAVY_SIDEBAR_BG: [number, number, number] = [27, 48, 71]; // #1B3047
const NAVY_SIDEBAR_LINE: [number, number, number] = [74, 101, 131]; // #4A6583
const NAVY_SIDEBAR_MUTED: [number, number, number] = [220, 228, 238]; // #DCE4EE
const NAVY_DARK_INK: [number, number, number] = [34, 38, 42]; // #22262A
const NAVY_BODY_INK: [number, number, number] = [51, 65, 85]; // #334155

const WARM_PAPER_BG: [number, number, number] = [244, 242, 237]; // #F4F2ED
const WARM_TERRACOTTA: [number, number, number] = [185, 115, 91]; // #B9735B
const WARM_HEADING: [number, number, number] = [74, 70, 64]; // #4A4640
const WARM_RULE: [number, number, number] = [159, 154, 146]; // #9F9A92
const WARM_BODY: [number, number, number] = [61, 58, 53]; // #3D3A35
const WARM_DARK: [number, number, number] = [43, 42, 40]; // #2B2A28

const SWISS_BLACK: [number, number, number] = [17, 24, 39]; // #111827
const SWISS_BODY: [number, number, number] = [55, 65, 81]; // #374151
const SWISS_RULE: [number, number, number] = [75, 85, 99]; // #4B5563

const SLATE_BLUE: [number, number, number] = [91, 135, 172]; // #5B87AC
const SLATE_CORNER: [number, number, number] = [156, 184, 208]; // #9CB8D0
const SLATE_INK: [number, number, number] = [45, 55, 72]; // #2D3748
const SLATE_MUTED: [number, number, number] = [148, 163, 184]; // #94A3B8

const ROYAL_NAVY: [number, number, number] = [11, 45, 77]; // #0B2D4D
const ROYAL_CERULEAN: [number, number, number] = [29, 112, 184]; // #1D70B8
const ROYAL_SKY: [number, number, number] = [46, 150, 216]; // #2E96D8
const ROYAL_PANEL_BG: [number, number, number] = [234, 239, 245]; // #EAEFF5
const ROYAL_BODY: [number, number, number] = [30, 41, 59]; // #1E293B

// ============================================================================
// IMAGE LOADING / CIRCULAR & RECTANGULAR RASTER HELPERS (BROWSER ONLY)
// ============================================================================

export const loadPassportImageElement = async (
  src?: string
): Promise<HTMLImageElement | null> => {
  if (!src || typeof document === 'undefined' || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

const imageElementToPdfDataUrl = (
  img: HTMLImageElement,
  circular: boolean
): string | null => {
  if (typeof document === 'undefined') return null;
  try {
    const size = 320;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = circular ? size : Math.round(size * 1.2);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (circular) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Object-cover math centered slightly upward for portrait head framing
    const iw = img.naturalWidth || img.width || size;
    const ih = img.naturalHeight || img.height || size;
    const scale = Math.max(canvas.width / iw, canvas.height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) * 0.25;
    ctx.drawImage(img, dx, dy, dw, dh);

    if (circular) {
      ctx.restore();
      return canvas.toDataURL('image/png');
    }
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
};

// ============================================================================
// 1. VECTOR SELECTABLE-TEXT PDF GENERATORS (jsPDF)
// ============================================================================

const pdfScaleForDensity = (density: SinglePageDocumentModel['density']) => {
  if (density === 'ultra') {
    return { bodyPt: 7.8, headingPt: 8.8, subPt: 8.1, namePt: 16.5, rolePt: 8.5, lineMm: 3.35, gapMm: 2.2 };
  }
  if (density === 'compact') {
    return { bodyPt: 8.4, headingPt: 9.4, subPt: 8.7, namePt: 18, rolePt: 9.2, lineMm: 3.7, gapMm: 2.8 };
  }
  return { bodyPt: 9.1, headingPt: 10.2, subPt: 9.4, namePt: 19.5, rolePt: 10, lineMm: 4.1, gapMm: 3.4 };
};

const drawPdfColumnSections = (
  doc: jsPDF,
  sections: TemplateSection[],
  opts: {
    x: number;
    w: number;
    startY: number;
    maxY: number;
    font: 'helvetica' | 'times';
    headingFont?: 'helvetica' | 'times';
    bodyColor: [number, number, number];
    headingColor: [number, number, number];
    subColor: [number, number, number];
    accentColor: [number, number, number];
    ruleMode: 'none' | 'full' | 'terracotta-bar' | 'royal-pill' | 'royal-underline';
    scale: ReturnType<typeof pdfScaleForDensity>;
  }
): number => {
  let y = opts.startY;
  const hFont = opts.headingFont || opts.font;
  const { bodyPt, headingPt, subPt, lineMm, gapMm } = opts.scale;

  const canDraw = (need = lineMm) => y + need <= opts.maxY;

  for (const sec of sections) {
    if (!canDraw(headingPt * 0.45 + 5)) break;

    if (opts.ruleMode === 'royal-pill') {
      const pillW = Math.min(opts.w, Math.max(38, doc.getTextWidth(sec.heading) + 12));
      doc.setFillColor(...ROYAL_NAVY);
      doc.roundedRect(opts.x, y - 3.6, pillW, 5.2, 1.3, 1.3, 'F');
      doc.setFont(hFont, 'bold');
      doc.setFontSize(headingPt - 0.8);
      doc.setTextColor(255, 255, 255);
      doc.text(sec.heading, opts.x + 3.2, y);
      if (pillW + 3 < opts.w) {
        doc.setDrawColor(...ROYAL_CERULEAN);
        doc.setLineWidth(0.32);
        doc.line(opts.x + pillW + 2.5, y - 1, opts.x + opts.w, y - 1);
      }
      y += 4.2;
    } else if (opts.ruleMode === 'royal-underline') {
      doc.setFont(hFont, 'bold');
      doc.setFontSize(headingPt - 0.5);
      doc.setTextColor(...ROYAL_NAVY);
      doc.text(sec.heading, opts.x, y);
      y += 1.4;
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.28);
      doc.line(opts.x, y, opts.x + opts.w, y);
      y += 3.5;
    } else {
      doc.setFont(hFont, 'bold');
      doc.setFontSize(headingPt);
      doc.setTextColor(...opts.headingColor);
      doc.text(sec.heading, opts.x, y);
      y += 1.5;

      if (opts.ruleMode === 'full') {
        doc.setDrawColor(...opts.accentColor);
        doc.setLineWidth(0.38);
        doc.line(opts.x, y, opts.x + opts.w, y);
        y += 3.6;
      } else if (opts.ruleMode === 'terracotta-bar') {
        doc.setDrawColor(...WARM_RULE);
        doc.setLineWidth(0.25);
        doc.line(opts.x, y, opts.x + opts.w, y);
        doc.setFillColor(...WARM_TERRACOTTA);
        doc.rect(opts.x, y - 0.55, 10, 0.9, 'F');
        y += 3.6;
      } else {
        y += 2.2;
      }
    }

    if (sec.kind === 'contacts' && sec.contacts) {
      doc.setFont(opts.font, 'normal');
      doc.setFontSize(bodyPt);
      doc.setTextColor(...opts.bodyColor);
      for (const c of sec.contacts) {
        const lines = doc.splitTextToSize(`•  ${c.value}`, opts.w) as string[];
        for (const ln of lines) {
          if (!canDraw()) break;
          doc.text(ln, opts.x, y);
          y += lineMm;
        }
      }
    } else if (sec.kind === 'paragraph' && sec.text) {
      doc.setFont(opts.font, 'normal');
      doc.setFontSize(bodyPt);
      doc.setTextColor(...opts.bodyColor);
      const lines = doc.splitTextToSize(sec.text, opts.w) as string[];
      lines.forEach((ln, idx) => {
        if (!canDraw()) return;
        const isLast = idx === lines.length - 1;
        if (!isLast && ln.includes(' ')) {
          doc.text(ln, opts.x, y, { align: 'justify', maxWidth: opts.w });
        } else {
          doc.text(ln, opts.x, y);
        }
        y += lineMm;
      });
    } else if (sec.kind === 'paragraphs' && sec.paragraphs) {
      doc.setFont(opts.font, 'normal');
      doc.setFontSize(bodyPt);
      doc.setTextColor(...opts.bodyColor);
      for (const p of sec.paragraphs) {
        const lines = doc.splitTextToSize(p, opts.w) as string[];
        lines.forEach((ln, idx) => {
          if (!canDraw()) return;
          const isLast = idx === lines.length - 1;
          if (!isLast && ln.includes(' ')) {
            doc.text(ln, opts.x, y, { align: 'justify', maxWidth: opts.w });
          } else {
            doc.text(ln, opts.x, y);
          }
          y += lineMm;
        });
        y += 1.2;
      }
    } else if (sec.kind === 'bullets' && sec.bullets) {
      doc.setFont(opts.font, 'normal');
      doc.setFontSize(bodyPt);
      doc.setTextColor(...opts.bodyColor);
      for (const b of sec.bullets) {
        const isCit = /^\[\d+\]\s/.test(b);
        const indent = isCit ? 0 : 3.2;
        const lines = doc.splitTextToSize(b, Math.max(20, opts.w - indent)) as string[];
        for (let i = 0; i < lines.length; i++) {
          if (!canDraw()) break;
          if (!isCit && i === 0) doc.text('•', opts.x, y);
          doc.text(lines[i], opts.x + indent, y);
          y += lineMm;
        }
      }
    } else if (sec.kind === 'subgroups' && sec.subgroups) {
      for (const sg of sec.subgroups) {
        if (sg.subtitle && canDraw()) {
          doc.setFont(opts.font, 'bold');
          doc.setFontSize(bodyPt);
          doc.setTextColor(...opts.subColor);
          doc.text(sg.subtitle, opts.x, y);
          y += lineMm;
        }
        doc.setFont(opts.font, 'normal');
        doc.setFontSize(bodyPt);
        doc.setTextColor(...opts.bodyColor);
        for (const item of sg.items) {
          const lines = doc.splitTextToSize(item, Math.max(20, opts.w - 3.2)) as string[];
          for (let i = 0; i < lines.length; i++) {
            if (!canDraw()) break;
            if (i === 0) doc.text('•', opts.x, y);
            doc.text(lines[i], opts.x + 3.2, y);
            y += lineMm;
          }
        }
        y += 1.2;
      }
    } else if (sec.kind === 'entries' && sec.entries) {
      for (const entry of sec.entries) {
        if (!canDraw(lineMm * 2)) break;
        doc.setFont(opts.font, 'bold');
        doc.setFontSize(subPt);
        doc.setTextColor(...opts.subColor);
        const dateReserve = entry.dateRange ? 28 : 0;
        const pLines = doc.splitTextToSize(entry.primary, Math.max(25, opts.w - dateReserve)) as string[];
        pLines.forEach((ln, idx) => {
          if (!canDraw()) return;
          doc.text(ln, opts.x, y);
          if (idx === 0 && entry.dateRange) {
            doc.setFont(opts.font, 'normal');
            doc.setFontSize(bodyPt - 0.5);
            doc.setTextColor(...WARM_HEADING);
            doc.text(entry.dateRange, opts.x + opts.w, y, { align: 'right' });
            doc.setFont(opts.font, 'bold');
            doc.setFontSize(subPt);
            doc.setTextColor(...opts.subColor);
          }
          y += lineMm;
        });

        if (entry.secondary && canDraw()) {
          doc.setFont(opts.font, 'italic');
          doc.setFontSize(bodyPt);
          doc.setTextColor(...opts.bodyColor);
          const sLines = doc.splitTextToSize(entry.secondary, opts.w) as string[];
          for (const sl of sLines) {
            if (!canDraw()) break;
            doc.text(sl, opts.x, y);
            y += lineMm;
          }
        }

        if (entry.bodyText && canDraw()) {
          doc.setFont(opts.font, 'normal');
          doc.setFontSize(bodyPt);
          doc.setTextColor(...opts.bodyColor);
          const bLines = doc.splitTextToSize(entry.bodyText, opts.w) as string[];
          for (const bl of bLines) {
            if (!canDraw()) break;
            doc.text(bl, opts.x, y);
            y += lineMm;
          }
        }

        if (entry.bullets && entry.bullets.length > 0) {
          doc.setFont(opts.font, 'normal');
          doc.setFontSize(bodyPt);
          doc.setTextColor(...opts.bodyColor);
          for (const b of entry.bullets) {
            const bLines = doc.splitTextToSize(b, Math.max(20, opts.w - 3.5)) as string[];
            for (let i = 0; i < bLines.length; i++) {
              if (!canDraw()) break;
              if (i === 0) doc.text('•', opts.x + 0.5, y);
              doc.text(bLines[i], opts.x + 3.5, y);
              y += lineMm;
            }
          }
        }
        y += 1.4;
      }
    } else if (sec.kind === 'signature' && sec.signature && canDraw(lineMm * 3)) {
      doc.setFont(opts.font, 'normal');
      doc.setFontSize(bodyPt);
      doc.setTextColor(...opts.bodyColor);
      doc.text(sec.signature.signOff, opts.x, y);
      y += lineMm * 1.4;
      doc.setFont(opts.font, 'bold');
      doc.setTextColor(...opts.subColor);
      doc.text(sec.signature.name, opts.x, y);
      y += lineMm;
      if (sec.signature.subline && canDraw()) {
        doc.setFont(opts.font, 'normal');
        doc.setFontSize(bodyPt - 0.6);
        doc.text(sec.signature.subline, opts.x, y);
        y += lineMm;
      }
    }

    y += gapMm;
  }

  return y;
};

const renderSlateTwoPagePdf = (
  doc: jsPDF,
  model: TwoPageDocumentModel,
  passportDataUrl: string | null
): Blob => {
  const pageW = 210;
  const pageH = 297;
  const marginX = 16;
  const scale = pdfScaleForDensity(model.density);

  // Page 1 Header: Portrait Box + Steel Blue Name + Rule
  const photoW = 25;
  const photoH = 30;
  if (passportDataUrl) {
    doc.addImage(passportDataUrl, 'JPEG', marginX, 14, photoW, photoH);
  } else {
    doc.setFillColor(...NAVY_SIDEBAR_BG);
    doc.rect(marginX, 14, photoW, photoH, 'F');
    const initials = model.displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text(initials || 'CV', marginX + photoW / 2, 31, { align: 'center' });
  }

  const nameX = marginX + photoW + 7;
  const nameW = pageW - nameX - marginX;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(...SLATE_BLUE);
  doc.text(model.displayName, nameX, 25, { maxWidth: nameW });

  if (model.displayRole) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...SLATE_INK);
    doc.text(model.displayRole, nameX, 31.5, { maxWidth: nameW });
  }

  doc.setDrawColor(...SLATE_BLUE);
  doc.setLineWidth(0.7);
  doc.line(nameX, 37, pageW - marginX, 37);

  // Page 1 Body Two-Column + Continuous Vertical Spine
  const leftX = marginX;
  const leftW = 54;
  const spineX = leftX + leftW + 4;
  const rightX = spineX + 5;
  const rightW = pageW - rightX - marginX;

  const p1EndLeft = drawPdfColumnSections(doc, model.page1Left, {
    x: leftX,
    w: leftW,
    startY: 51,
    maxY: pageH - 22,
    font: 'helvetica',
    bodyColor: SLATE_INK,
    headingColor: SLATE_BLUE,
    subColor: SLATE_INK,
    accentColor: SLATE_BLUE,
    ruleMode: 'none',
    scale,
  });

  const p1EndRight = drawPdfColumnSections(doc, model.page1Right, {
    x: rightX,
    w: rightW,
    startY: 51,
    maxY: pageH - 22,
    font: 'helvetica',
    bodyColor: SLATE_INK,
    headingColor: SLATE_BLUE,
    subColor: SLATE_INK,
    accentColor: SLATE_BLUE,
    ruleMode: 'none',
    scale,
  });

  const p1SpineEnd = Math.max(120, Math.min(pageH - 20, Math.max(p1EndLeft, p1EndRight)));
  doc.setDrawColor(...SLATE_BLUE);
  doc.setLineWidth(0.55);
  doc.line(spineX, 47, spineX, p1SpineEnd);

  // Page 1 Bottom Corner Accent & Subtle Name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(model.footerName, marginX, pageH - 10);
  doc.setFillColor(...SLATE_CORNER);
  doc.triangle(pageW - 34, pageH, pageW, pageH, pageW, pageH - 34, 'F');

  // PAGE 2
  doc.addPage();
  const p2LeftEnd = drawPdfColumnSections(doc, model.page2Left, {
    x: leftX,
    w: leftW,
    startY: 20,
    maxY: pageH - 95,
    font: 'helvetica',
    bodyColor: SLATE_INK,
    headingColor: SLATE_BLUE,
    subColor: SLATE_INK,
    accentColor: SLATE_BLUE,
    ruleMode: 'none',
    scale,
  });
  const p2RightEnd = drawPdfColumnSections(doc, model.page2Right, {
    x: rightX,
    w: rightW,
    startY: 20,
    maxY: pageH - 95,
    font: 'helvetica',
    bodyColor: SLATE_INK,
    headingColor: SLATE_BLUE,
    subColor: SLATE_INK,
    accentColor: SLATE_BLUE,
    ruleMode: 'none',
    scale,
  });

  const p2SpineEnd = Math.max(58, Math.max(p2LeftEnd, p2RightEnd));
  doc.setDrawColor(...SLATE_BLUE);
  doc.setLineWidth(0.55);
  doc.line(spineX, 17, spineX, p2SpineEnd);

  if (model.page2FullWidth.length > 0) {
    drawPdfColumnSections(doc, model.page2FullWidth, {
      x: marginX,
      w: pageW - marginX * 2,
      startY: p2SpineEnd + 8,
      maxY: pageH - 18,
      font: 'helvetica',
      bodyColor: SLATE_INK,
      headingColor: SLATE_BLUE,
      subColor: SLATE_INK,
      accentColor: SLATE_BLUE,
      ruleMode: 'none',
      scale,
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(model.footerName, marginX, pageH - 10);
  doc.setFillColor(...SLATE_CORNER);
  doc.triangle(pageW - 34, pageH, pageW, pageH, pageW, pageH - 34, 'F');

  return doc.output('blob');
};

const renderRoyalPassportPdf = (
  doc: jsPDF,
  model: SinglePageDocumentModel,
  circularPassportDataUrl: string | null
): Blob => {
  const pageW = 210;
  const pageH = 297;
  const scale = pdfScaleForDensity(model.density);

  // Top-left geometric blue ribbons matching Template 3
  doc.setFillColor(...ROYAL_NAVY);
  doc.triangle(0, 0, 56, 0, 0, 56, 'F');
  doc.setFillColor(...ROYAL_CERULEAN);
  doc.triangle(32, 0, 68, 0, 0, 68, 'F');
  doc.setFillColor(...ROYAL_SKY);
  doc.triangle(54, 0, 80, 0, 0, 80, 'F');

  // Circular Passport Frame
  const cx = 36;
  const cy = 31;
  const r = 20;
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r + 2.2, 'F');
  doc.setDrawColor(...ROYAL_NAVY);
  doc.setLineWidth(1.1);
  doc.circle(cx, cy, r + 0.6, 'S');
  if (circularPassportDataUrl) {
    doc.addImage(circularPassportDataUrl, 'PNG', cx - r, cy - r, r * 2, r * 2);
  } else {
    doc.setFillColor(...ROYAL_PANEL_BG);
    doc.circle(cx, cy, r, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...ROYAL_NAVY);
    doc.text('PHOTO', cx, cy + 1.5, { align: 'center' });
  }

  // Top-Right Header Name + Role + Rule + 2-Col Contact Grid
  const rx = 74;
  const rw = pageW - rx - 12;
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...ROYAL_NAVY);
  doc.text(model.displayName, rx, 20, { maxWidth: rw });

  if (model.displayRole) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...ROYAL_NAVY);
    doc.text(model.displayRole.toUpperCase(), rx, 27.5, { maxWidth: rw });
  }

  doc.setDrawColor(...ROYAL_CERULEAN);
  doc.setLineWidth(0.55);
  doc.line(rx, 31, pageW - 12, 31);

  if (model.contacts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(...ROYAL_BODY);
    let cyPos = 37;
    const halfW = rw / 2 - 2;
    for (let i = 0; i < model.contacts.length; i += 2) {
      const c1 = model.contacts[i];
      const c2 = model.contacts[i + 1];
      if (c1) doc.text(`• ${c1.value}`, rx, cyPos, { maxWidth: halfW });
      if (c2) doc.text(`• ${c2.value}`, rx + halfW + 4, cyPos, { maxWidth: halfW });
      cyPos += 5.2;
    }
  }

  // Left Ice-Blue Rounded Sidebar Card
  const panelX = 8;
  const panelY = 58;
  const panelW = 63;
  const panelH = pageH - panelY - 19;
  doc.setFillColor(...ROYAL_PANEL_BG);
  doc.roundedRect(panelX, panelY, panelW, panelH, 3, 3, 'F');

  const nonContactSidebar = model.sidebarSections.filter((sec) => sec.kind !== 'contacts');
  // First sidebar section gets royal pill badge, rest get clean royal underline
  let sy = panelY + 8;
  nonContactSidebar.forEach((sec, idx) => {
    sy = drawPdfColumnSections(doc, [sec], {
      x: panelX + 4.5,
      w: panelW - 9,
      startY: sy,
      maxY: pageH - 22,
      font: 'helvetica',
      bodyColor: ROYAL_BODY,
      headingColor: ROYAL_NAVY,
      subColor: ROYAL_NAVY,
      accentColor: ROYAL_CERULEAN,
      ruleMode: idx === 0 ? 'royal-pill' : 'royal-underline',
      scale,
    });
  });

  // Right Main Column Sections with Royal Pill Badges + Cerulean Lines
  const mainSectionsAll = [...model.mainSections, ...model.trailingSections];
  drawPdfColumnSections(doc, mainSectionsAll, {
    x: rx,
    w: rw,
    startY: 63,
    maxY: pageH - 22,
    font: 'helvetica',
    bodyColor: ROYAL_BODY,
    headingColor: ROYAL_NAVY,
    subColor: ROYAL_NAVY,
    accentColor: ROYAL_CERULEAN,
    ruleMode: 'royal-pill',
    scale,
  });

  // Bottom Full-Width Navy Motto Banner
  const footH = 14;
  doc.setFillColor(...ROYAL_NAVY);
  doc.rect(0, pageH - footH, pageW, footH, 'F');
  doc.setFillColor(...ROYAL_SKY);
  doc.triangle(pageW - 36, pageH, pageW, pageH, pageW, pageH - footH - 8, 'F');
  doc.setFillColor(...ROYAL_CERULEAN);
  doc.triangle(pageW - 22, pageH, pageW, pageH, pageW, pageH - footH - 3, 'F');

  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    model.footerMotto || model.displayRole || 'Excellence in Engineering & Leadership',
    pageW / 2,
    pageH - 5.5,
    { align: 'center', maxWidth: pageW - 50 }
  );

  return doc.output('blob');
};

export const exportSinglePageTemplateToPdfBlob = (
  payload: DocumentFormPayload,
  templateId: Exclude<CareerStudioTemplateId, 'default'>,
  embeddedPassportDataUrl?: string | null
): Blob => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  if (templateId === 'slate_two_page') {
    const tpModel = buildTwoPageDocumentModel(payload);
    return renderSlateTwoPagePdf(doc, tpModel, embeddedPassportDataUrl || null);
  }

  if (templateId === 'royal_passport') {
    const rpModel = buildSinglePageDocumentModel(payload);
    return renderRoyalPassportPdf(doc, rpModel, embeddedPassportDataUrl || null);
  }

  const model = buildSinglePageDocumentModel(payload);
  const scale = pdfScaleForDensity(model.density);
  const pageW = 210;
  const pageH = 297;

  if (templateId === 'navy_sidebar') {
    const sideW = 69;
    doc.setFillColor(...NAVY_SIDEBAR_BG);
    doc.rect(0, 0, sideW, pageH, 'F');

    doc.setDrawColor(...NAVY_SIDEBAR_LINE);
    doc.setLineWidth(0.25);
    doc.line(0, 30, 30, 0);
    doc.line(0, 38, 38, 0);
    doc.line(42, 29, sideW, 29);
    doc.line(48, 33, sideW, 33);
    doc.line(52, 85, sideW, 68);
    doc.line(0, 260, 28, 232);
    doc.line(0, 250, 34, 250);
    doc.line(22, pageH, sideW, 250);
    doc.line(31, pageH, sideW, 259);

    drawPdfColumnSections(doc, model.sidebarSections, {
      x: 9,
      w: sideW - 16,
      startY: 26,
      maxY: pageH - 12,
      font: 'helvetica',
      bodyColor: NAVY_SIDEBAR_MUTED,
      headingColor: [255, 255, 255],
      subColor: [147, 197, 253],
      accentColor: [255, 255, 255],
      ruleMode: 'none',
      scale,
    });

    const mainX = sideW + 10;
    const mainW = pageW - mainX - 11;
    let my = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(scale.namePt);
    doc.setTextColor(...NAVY_DARK_INK);
    const nameLines = doc.splitTextToSize(model.displayName.toUpperCase(), mainW) as string[];
    nameLines.forEach((ln) => {
      doc.text(ln, mainX, my);
      my += 6.5;
    });

    if (model.displayRole) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(scale.rolePt);
      doc.setTextColor(...NAVY_BODY_INK);
      const roleLines = doc.splitTextToSize(model.displayRole.toUpperCase(), mainW) as string[];
      roleLines.forEach((ln) => {
        doc.text(ln, mainX, my);
        my += 4.3;
      });
    }
    my += 3.5;

    my = drawPdfColumnSections(doc, [...model.mainSections, ...model.trailingSections], {
      x: mainX,
      w: mainW,
      startY: my,
      maxY: pageH - (model.skillsGridItems.length > 0 ? 34 : 12),
      font: 'helvetica',
      bodyColor: NAVY_BODY_INK,
      headingColor: NAVY_DARK_INK,
      subColor: NAVY_DARK_INK,
      accentColor: NAVY_BODY_INK,
      ruleMode: 'full',
      scale,
    });

    if (model.skillsGridItems.length > 0 && my < pageH - 16) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(scale.headingPt);
      doc.setTextColor(...NAVY_DARK_INK);
      doc.text(model.skillsGridTitle, mainX, my);
      my += 1.5;
      doc.setDrawColor(...NAVY_BODY_INK);
      doc.setLineWidth(0.38);
      doc.line(mainX, my, mainX + mainW, my);
      my += 3.8;

      const colW = mainW / 2 - 2;
      const half = Math.ceil(model.skillsGridItems.length / 2);
      const leftList = model.skillsGridItems.slice(0, half);
      const rightList = model.skillsGridItems.slice(half);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(scale.bodyPt);
      doc.setTextColor(...NAVY_BODY_INK);
      let ly = my;
      leftList.forEach((it) => {
        if (ly < pageH - 8) {
          const lines = doc.splitTextToSize(`•  ${it}`, colW) as string[];
          lines.forEach((ln) => {
            doc.text(ln, mainX, ly);
            ly += scale.lineMm;
          });
        }
      });
      let ry = my;
      rightList.forEach((it) => {
        if (ry < pageH - 8) {
          const lines = doc.splitTextToSize(`•  ${it}`, colW) as string[];
          lines.forEach((ln) => {
            doc.text(ln, mainX + colW + 4, ry);
            ry += scale.lineMm;
          });
        }
      });
    }

    return doc.output('blob');
  }

  if (templateId === 'warm_editorial') {
    doc.setFillColor(...WARM_PAPER_BG);
    doc.rect(0, 0, pageW, pageH, 'F');

    const marginX = 14;
    const boxW = pageW - marginX * 2;
    const boxY = 12;
    const boxH = 26;

    doc.setDrawColor(...WARM_RULE);
    doc.setLineWidth(0.35);
    doc.rect(marginX, boxY, boxW, boxH, 'S');
    doc.setFillColor(...WARM_TERRACOTTA);
    doc.rect(marginX, boxY + boxH - 1.1, boxW, 1.1, 'F');

    doc.setFont('times', 'normal');
    doc.setFontSize(scale.namePt + 2);
    doc.setTextColor(...WARM_HEADING);
    doc.text(model.displayName.toUpperCase(), pageW / 2, boxY + 11.5, {
      align: 'center',
      maxWidth: boxW - 10,
    });

    if (model.displayRole) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(scale.rolePt - 0.5);
      doc.setTextColor(...WARM_DARK);
      doc.text(model.displayRole.toUpperCase(), pageW / 2, boxY + 19.5, {
        align: 'center',
        maxWidth: boxW - 10,
      });
    }

    const startY = boxY + boxH + 10;
    const leftW = 57;
    const gap = 8;
    const rightX = marginX + leftW + gap;
    const rightW = boxW - leftW - gap;

    drawPdfColumnSections(doc, model.sidebarSections, {
      x: marginX,
      w: leftW,
      startY,
      maxY: pageH - 12,
      font: 'helvetica',
      headingFont: 'times',
      bodyColor: WARM_BODY,
      headingColor: WARM_HEADING,
      subColor: WARM_DARK,
      accentColor: WARM_TERRACOTTA,
      ruleMode: 'terracotta-bar',
      scale,
    });

    drawPdfColumnSections(doc, [...model.mainSections, ...model.trailingSections], {
      x: rightX,
      w: rightW,
      startY,
      maxY: pageH - 12,
      font: 'helvetica',
      headingFont: 'times',
      bodyColor: WARM_BODY,
      headingColor: WARM_HEADING,
      subColor: WARM_DARK,
      accentColor: WARM_TERRACOTTA,
      ruleMode: 'terracotta-bar',
      scale,
    });

    return doc.output('blob');
  }

  // SWISS MINIMAL MONOCHROME
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  let y = 17;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(scale.namePt + 2);
  doc.setTextColor(...SWISS_BLACK);
  const sNameLines = doc.splitTextToSize(model.displayName.toUpperCase(), contentW) as string[];
  sNameLines.forEach((ln) => {
    doc.text(ln, marginX, y);
    y += 7;
  });

  if (model.displayRole) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(scale.rolePt + 0.5);
    doc.setTextColor(...SWISS_BLACK);
    doc.text(model.displayRole.toUpperCase(), marginX, y);
    y += 4.5;
  }

  if (model.inlineContactLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(scale.bodyPt - 0.5);
    doc.setTextColor(...SWISS_RULE);
    const cLines = doc.splitTextToSize(model.inlineContactLine, contentW) as string[];
    cLines.forEach((ln) => {
      doc.text(ln, marginX, y);
      y += 3.8;
    });
  }

  doc.setDrawColor(...SWISS_RULE);
  doc.setLineWidth(0.6);
  doc.line(marginX, y + 0.5, pageW - marginX, y + 0.5);
  y += 6.5;

  for (const sec of model.swissSections) {
    if (y >= pageH - 14) break;
    if (sec.id === 'swiss-skills-grid' && sec.bullets && sec.bullets.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(scale.headingPt);
      doc.setTextColor(...SWISS_BLACK);
      doc.text(sec.heading, marginX, y);
      y += 1.5;
      doc.setDrawColor(...SWISS_RULE);
      doc.setLineWidth(0.32);
      doc.line(marginX, y, pageW - marginX, y);
      y += 3.8;

      const cols = 4;
      const colW = contentW / cols;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(scale.bodyPt);
      doc.setTextColor(...SWISS_BODY);
      const rows = Math.ceil(sec.bullets.length / cols);
      for (let r = 0; r < rows; r++) {
        if (y >= pageH - 10) break;
        let maxRowLines = 1;
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= sec.bullets.length) continue;
          const cellLines = doc.splitTextToSize(`•  ${sec.bullets[idx]}`, colW - 3) as string[];
          maxRowLines = Math.max(maxRowLines, cellLines.length);
          cellLines.forEach((ln, li) => {
            doc.text(ln, marginX + c * colW, y + li * scale.lineMm);
          });
        }
        y += maxRowLines * scale.lineMm + 0.6;
      }
      y += scale.gapMm;
    } else {
      y = drawPdfColumnSections(doc, [sec], {
        x: marginX,
        w: contentW,
        startY: y,
        maxY: pageH - 10,
        font: 'helvetica',
        bodyColor: SWISS_BODY,
        headingColor: SWISS_BLACK,
        subColor: SWISS_BLACK,
        accentColor: SWISS_RULE,
        ruleMode: 'full',
        scale,
      });
    }
  }

  return doc.output('blob');
};

export const exportSinglePageTemplateToPdfBlobAsync = async (
  payload: DocumentFormPayload,
  templateId: Exclude<CareerStudioTemplateId, 'default'>
): Promise<Blob> => {
  let embeddedDataUrl: string | null = null;
  if (
    (templateId === 'royal_passport' || templateId === 'slate_two_page') &&
    payload.passportImageUrl
  ) {
    const img = await loadPassportImageElement(payload.passportImageUrl);
    if (img) {
      embeddedDataUrl = imageElementToPdfDataUrl(img, templateId === 'royal_passport');
    }
  }
  return exportSinglePageTemplateToPdfBlob(payload, templateId, embeddedDataUrl);
};

// ============================================================================
// 2. CANVAS FIRST-PAGE VISUAL THUMBNAIL RENDERER (794x1123 -> JPEG)
// ============================================================================

const wrapCanvasLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
};

const drawCanvasSections = (
  ctx: CanvasRenderingContext2D,
  sections: TemplateSection[],
  opts: {
    x: number;
    w: number;
    startY: number;
    maxY: number;
    fontStack: string;
    headingFontStack?: string;
    headingColor: string;
    bodyColor: string;
    subColor: string;
    ruleMode: 'none' | 'full' | 'terracotta-bar' | 'royal-pill' | 'royal-underline';
    lineH: number;
    fontSize: number;
  }
): number => {
  let y = opts.startY;
  const hFont = opts.headingFontStack || opts.fontStack;
  ctx.textAlign = 'left';

  for (const sec of sections) {
    if (y >= opts.maxY - 24) break;
    if (opts.ruleMode === 'royal-pill') {
      ctx.font = `bold ${opts.fontSize + 0.5}px ${hFont}`;
      const pillW = Math.min(opts.w, Math.max(120, ctx.measureText(sec.heading).width + 28));
      ctx.fillStyle = '#0B2D4D';
      ctx.beginPath();
      ctx.roundRect(opts.x, y - 15, pillW, 21, 5);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(sec.heading, opts.x + 10, y);
      if (pillW + 10 < opts.w) {
        ctx.strokeStyle = '#1D70B8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(opts.x + pillW + 8, y - 5);
        ctx.lineTo(opts.x + opts.w, y - 5);
        ctx.stroke();
      }
      y += 20;
    } else if (opts.ruleMode === 'royal-underline') {
      ctx.font = `bold ${opts.fontSize + 1}px ${hFont}`;
      ctx.fillStyle = '#0B2D4D';
      ctx.fillText(sec.heading, opts.x, y);
      y += 6;
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(opts.x, y);
      ctx.lineTo(opts.x + opts.w, y);
      ctx.stroke();
      y += 15;
    } else {
      ctx.font = `bold ${opts.fontSize + 1.5}px ${hFont}`;
      ctx.fillStyle = opts.headingColor;
      ctx.fillText(sec.heading, opts.x, y);
      y += 6;

      if (opts.ruleMode === 'full') {
        ctx.strokeStyle = opts.headingColor;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(opts.x, y);
        ctx.lineTo(opts.x + opts.w, y);
        ctx.stroke();
        y += 16;
      } else if (opts.ruleMode === 'terracotta-bar') {
        ctx.strokeStyle = '#9F9A92';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(opts.x, y);
        ctx.lineTo(opts.x + opts.w, y);
        ctx.stroke();
        ctx.fillStyle = '#B9735B';
        ctx.fillRect(opts.x, y - 2, 32, 3.5);
        y += 16;
      } else {
        y += 10;
      }
    }

    if (sec.kind === 'contacts' && sec.contacts) {
      ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
      ctx.fillStyle = opts.bodyColor;
      for (const c of sec.contacts) {
        const lines = wrapCanvasLines(ctx, `• ${c.value}`, opts.w);
        for (const ln of lines) {
          if (y >= opts.maxY) break;
          ctx.fillText(ln, opts.x, y);
          y += opts.lineH;
        }
      }
    } else if (sec.kind === 'paragraph' && sec.text) {
      ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
      ctx.fillStyle = opts.bodyColor;
      for (const ln of wrapCanvasLines(ctx, sec.text, opts.w)) {
        if (y >= opts.maxY) break;
        ctx.fillText(ln, opts.x, y);
        y += opts.lineH;
      }
    } else if (sec.kind === 'paragraphs' && sec.paragraphs) {
      ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
      ctx.fillStyle = opts.bodyColor;
      for (const p of sec.paragraphs) {
        for (const ln of wrapCanvasLines(ctx, p, opts.w)) {
          if (y >= opts.maxY) break;
          ctx.fillText(ln, opts.x, y);
          y += opts.lineH;
        }
        y += 4;
      }
    } else if (sec.kind === 'bullets' && sec.bullets) {
      ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
      ctx.fillStyle = opts.bodyColor;
      for (const b of sec.bullets) {
        for (const ln of wrapCanvasLines(ctx, `• ${b}`, opts.w)) {
          if (y >= opts.maxY) break;
          ctx.fillText(ln, opts.x, y);
          y += opts.lineH;
        }
      }
    } else if (sec.kind === 'subgroups' && sec.subgroups) {
      for (const sg of sec.subgroups) {
        if (sg.subtitle && y < opts.maxY) {
          ctx.font = `bold ${opts.fontSize}px ${opts.fontStack}`;
          ctx.fillStyle = opts.subColor;
          ctx.fillText(sg.subtitle, opts.x, y);
          y += opts.lineH;
        }
        ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
        ctx.fillStyle = opts.bodyColor;
        for (const item of sg.items) {
          for (const ln of wrapCanvasLines(ctx, `• ${item}`, opts.w)) {
            if (y >= opts.maxY) break;
            ctx.fillText(ln, opts.x, y);
            y += opts.lineH;
          }
        }
        y += 4;
      }
    } else if (sec.kind === 'entries' && sec.entries) {
      for (const entry of sec.entries) {
        if (y >= opts.maxY - 14) break;
        ctx.font = `bold ${opts.fontSize + 0.5}px ${opts.fontStack}`;
        ctx.fillStyle = opts.subColor;
        ctx.fillText(entry.primary, opts.x, y);
        if (entry.dateRange) {
          ctx.textAlign = 'right';
          ctx.font = `${opts.fontSize - 0.5}px ${opts.fontStack}`;
          ctx.fillStyle = '#5E5B55';
          ctx.fillText(entry.dateRange, opts.x + opts.w, y);
          ctx.textAlign = 'left';
        }
        y += opts.lineH;
        if (entry.secondary && y < opts.maxY) {
          ctx.font = `italic ${opts.fontSize}px ${opts.fontStack}`;
          ctx.fillStyle = opts.bodyColor;
          ctx.fillText(entry.secondary, opts.x, y);
          y += opts.lineH;
        }
        if (entry.bodyText && y < opts.maxY) {
          ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
          ctx.fillStyle = opts.bodyColor;
          for (const ln of wrapCanvasLines(ctx, entry.bodyText, opts.w)) {
            if (y >= opts.maxY) break;
            ctx.fillText(ln, opts.x, y);
            y += opts.lineH;
          }
        }
        if (entry.bullets) {
          ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
          ctx.fillStyle = opts.bodyColor;
          for (const b of entry.bullets) {
            for (const ln of wrapCanvasLines(ctx, `• ${b}`, opts.w)) {
              if (y >= opts.maxY) break;
              ctx.fillText(ln, opts.x + 6, y);
              y += opts.lineH;
            }
          }
        }
        y += 6;
      }
    } else if (sec.kind === 'signature' && sec.signature && y < opts.maxY - 24) {
      ctx.font = `${opts.fontSize}px ${opts.fontStack}`;
      ctx.fillStyle = opts.bodyColor;
      ctx.fillText(sec.signature.signOff, opts.x, y);
      y += opts.lineH + 4;
      ctx.font = `bold ${opts.fontSize}px ${opts.fontStack}`;
      ctx.fillStyle = opts.subColor;
      ctx.fillText(sec.signature.name, opts.x, y);
      y += opts.lineH;
    }

    y += 10;
  }

  return y;
};

export const renderSinglePageTemplateDataUrl = (
  payload: DocumentFormPayload,
  templateId: Exclude<CareerStudioTemplateId, 'default'>,
  passportImg?: HTMLImageElement | null
): string => {
  const canvas = document.createElement('canvas');
  const W = 794;
  const H = 1123;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const sans = '"Inter", "Helvetica Neue", Arial, sans-serif';
  const serif = 'Georgia, "Times New Roman", serif';

  if (templateId === 'slate_two_page') {
    const tpModel = buildTwoPageDocumentModel(payload);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Header portrait + Steel blue name + rule
    const px = 56;
    const py = 48;
    const pw = 96;
    const ph = 114;
    if (passportImg) {
      ctx.drawImage(passportImg, px, py, pw, ph);
    } else {
      ctx.fillStyle = '#1B3047';
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 32px ${sans}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        tpModel.displayName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() || '')
          .join('') || 'CV',
        px + pw / 2,
        py + ph / 2 + 10
      );
      ctx.textAlign = 'left';
    }

    const nx = px + pw + 26;
    ctx.fillStyle = '#5B87AC';
    ctx.font = `36px ${sans}`;
    ctx.fillText(tpModel.displayName, nx, py + 42);
    if (tpModel.displayRole) {
      ctx.fillStyle = '#2D3748';
      ctx.font = `14px ${sans}`;
      ctx.fillText(tpModel.displayRole, nx, py + 68);
    }
    ctx.strokeStyle = '#5B87AC';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(nx, py + 88);
    ctx.lineTo(W - 56, py + 88);
    ctx.stroke();

    // Vertical spine + Page 1 columns
    const spineX = 278;
    ctx.strokeStyle = '#5B87AC';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(spineX, 184);
    ctx.lineTo(spineX, H - 80);
    ctx.stroke();

    drawCanvasSections(ctx, tpModel.page1Left, {
      x: 56,
      w: spineX - 74,
      startY: 204,
      maxY: H - 70,
      fontStack: sans,
      headingColor: '#5B87AC',
      bodyColor: '#2D3748',
      subColor: '#1E293B',
      ruleMode: 'none',
      lineH: 17,
      fontSize: 12,
    });

    drawCanvasSections(ctx, tpModel.page1Right, {
      x: spineX + 22,
      w: W - spineX - 78,
      startY: 204,
      maxY: H - 70,
      fontStack: sans,
      headingColor: '#5B87AC',
      bodyColor: '#2D3748',
      subColor: '#1E293B',
      ruleMode: 'none',
      lineH: 17,
      fontSize: 12,
    });

    // Bottom corner triangle + subtle name
    ctx.fillStyle = '#94A3B8';
    ctx.font = `11px ${sans}`;
    ctx.fillText(tpModel.footerName, 56, H - 32);
    ctx.fillStyle = '#9CB8D0';
    ctx.beginPath();
    ctx.moveTo(W - 120, H);
    ctx.lineTo(W, H);
    ctx.lineTo(W, H - 120);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL('image/jpeg', 0.88);
  }

  const model = buildSinglePageDocumentModel(payload);
  const lineH = model.density === 'ultra' ? 14 : model.density === 'compact' ? 15.5 : 17;
  const fontSize = model.density === 'ultra' ? 10.5 : model.density === 'compact' ? 11.2 : 12;

  if (templateId === 'royal_passport') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Top-left geometric diagonal ribbons
    ctx.fillStyle = '#0B2D4D';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(205, 0);
    ctx.lineTo(0, 205);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1D70B8';
    ctx.beginPath();
    ctx.moveTo(120, 0);
    ctx.lineTo(255, 0);
    ctx.lineTo(0, 255);
    ctx.lineTo(0, 120);
    ctx.closePath();
    ctx.fill();

    // Circular Portrait
    const cx = 136;
    const cy = 118;
    const r = 74;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0B2D4D';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.stroke();

    if (passportImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const iw = passportImg.naturalWidth || passportImg.width || r * 2;
      const ih = passportImg.naturalHeight || passportImg.height || r * 2;
      const sc = Math.max((r * 2) / iw, (r * 2) / ih);
      const dw = iw * sc;
      const dh = ih * sc;
      ctx.drawImage(passportImg, cx - dw / 2, cy - dh * 0.35, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = '#EAEFF5';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0B2D4D';
      ctx.font = `bold 15px ${sans}`;
      ctx.textAlign = 'center';
      ctx.fillText('PASSPORT', cx, cy + 4);
      ctx.textAlign = 'left';
    }

    // Header Title + Contact Grid
    const rx = 274;
    const rw = W - rx - 42;
    ctx.fillStyle = '#0B2D4D';
    ctx.font = `bold 34px ${serif}`;
    ctx.fillText(model.displayName, rx, 76);
    if (model.displayRole) {
      ctx.font = `15px ${sans}`;
      ctx.fillText(model.displayRole.toUpperCase(), rx, 102);
    }
    ctx.strokeStyle = '#1D70B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, 114);
    ctx.lineTo(W - 42, 114);
    ctx.stroke();

    ctx.font = `11px ${sans}`;
    ctx.fillStyle = '#1E293B';
    let cyPos = 136;
    for (let i = 0; i < model.contacts.length; i += 2) {
      if (model.contacts[i]) ctx.fillText(`• ${model.contacts[i].value}`, rx, cyPos);
      if (model.contacts[i + 1]) ctx.fillText(`• ${model.contacts[i + 1].value}`, rx + rw / 2, cyPos);
      cyPos += 19;
    }

    // Left Ice-Blue Rounded Panel
    ctx.fillStyle = '#EAEFF5';
    ctx.beginPath();
    ctx.roundRect(28, 224, 228, H - 294, 12);
    ctx.fill();

    const sideSec = model.sidebarSections.filter((s) => s.kind !== 'contacts');
    let sy = 252;
    sideSec.forEach((sec, idx) => {
      sy = drawCanvasSections(ctx, [sec], {
        x: 44,
        w: 196,
        startY: sy,
        maxY: H - 80,
        fontStack: sans,
        headingColor: '#0B2D4D',
        bodyColor: '#1E293B',
        subColor: '#0B2D4D',
        ruleMode: idx === 0 ? 'royal-pill' : 'royal-underline',
        lineH,
        fontSize,
      });
    });

    drawCanvasSections(ctx, [...model.mainSections, ...model.trailingSections], {
      x: rx,
      w: rw,
      startY: 236,
      maxY: H - 80,
      fontStack: sans,
      headingColor: '#0B2D4D',
      bodyColor: '#1E293B',
      subColor: '#0B2D4D',
      ruleMode: 'royal-pill',
      lineH,
      fontSize,
    });

    // Bottom Navy Motto Banner
    ctx.fillStyle = '#0B2D4D';
    ctx.fillRect(0, H - 48, W, 48);
    ctx.fillStyle = '#2E96D8';
    ctx.beginPath();
    ctx.moveTo(W - 120, H);
    ctx.lineTo(W, H);
    ctx.lineTo(W, H - 68);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `italic 14px ${serif}`;
    ctx.textAlign = 'center';
    ctx.fillText(model.footerMotto || model.displayRole || '', W / 2, H - 19);

    return canvas.toDataURL('image/jpeg', 0.88);
  }

  if (templateId === 'navy_sidebar') {
    const sideW = 262;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1B3047';
    ctx.fillRect(0, 0, sideW, H);

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 115);
    ctx.lineTo(120, 0);
    ctx.moveTo(0, 145);
    ctx.lineTo(150, 0);
    ctx.moveTo(90, H);
    ctx.lineTo(sideW, H - 170);
    ctx.stroke();

    drawCanvasSections(ctx, model.sidebarSections, {
      x: 28,
      w: sideW - 50,
      startY: 96,
      maxY: H - 40,
      fontStack: sans,
      headingColor: '#FFFFFF',
      bodyColor: '#DCE4EE',
      subColor: '#93C5FD',
      ruleMode: 'none',
      lineH,
      fontSize,
    });

    const mainX = sideW + 34;
    const mainW = W - mainX - 36;
    let y = 68;
    ctx.fillStyle = '#22262A';
    ctx.font = `bold 26px ${sans}`;
    ctx.fillText(model.displayName.toUpperCase(), mainX, y);
    y += 22;
    if (model.displayRole) {
      ctx.fillStyle = '#374151';
      ctx.font = `13px ${sans}`;
      ctx.fillText(model.displayRole.toUpperCase(), mainX, y);
      y += 28;
    }

    y = drawCanvasSections(ctx, [...model.mainSections, ...model.trailingSections], {
      x: mainX,
      w: mainW,
      startY: y,
      maxY: H - 110,
      fontStack: sans,
      headingColor: '#1E293B',
      bodyColor: '#334155',
      subColor: '#1E293B',
      ruleMode: 'full',
      lineH,
      fontSize,
    });

    if (model.skillsGridItems.length > 0 && y < H - 55) {
      drawCanvasSections(
        ctx,
        [
          {
            id: 'thumb-skills',
            heading: model.skillsGridTitle,
            kind: 'bullets',
            bullets: model.skillsGridItems.slice(0, 8),
          },
        ],
        {
          x: mainX,
          w: mainW,
          startY: y,
          maxY: H - 24,
          fontStack: sans,
          headingColor: '#1E293B',
          bodyColor: '#334155',
          subColor: '#1E293B',
          ruleMode: 'full',
          lineH,
          fontSize,
        }
      );
    }

    return canvas.toDataURL('image/jpeg', 0.88);
  }

  if (templateId === 'warm_editorial') {
    ctx.fillStyle = '#F4F2ED';
    ctx.fillRect(0, 0, W, H);

    const mx = 48;
    const bw = W - mx * 2;
    const by = 44;
    const bh = 96;
    ctx.strokeStyle = '#969188';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx, by, bw, bh);
    ctx.fillStyle = '#B9735B';
    ctx.fillRect(mx, by + bh - 4, bw, 4);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4A4640';
    ctx.font = `28px ${serif}`;
    ctx.fillText(model.displayName.toUpperCase(), W / 2, by + 44);
    if (model.displayRole) {
      ctx.fillStyle = '#2B2A28';
      ctx.font = `12.5px ${sans}`;
      ctx.fillText(model.displayRole.toUpperCase(), W / 2, by + 72);
    }
    ctx.textAlign = 'left';

    const startY = by + bh + 38;
    const lw = 216;
    const rx = mx + lw + 30;
    const rw = bw - lw - 30;

    drawCanvasSections(ctx, model.sidebarSections, {
      x: mx,
      w: lw,
      startY,
      maxY: H - 36,
      fontStack: sans,
      headingFontStack: serif,
      headingColor: '#4A4640',
      bodyColor: '#3D3A35',
      subColor: '#2B2A28',
      ruleMode: 'terracotta-bar',
      lineH,
      fontSize,
    });

    drawCanvasSections(ctx, [...model.mainSections, ...model.trailingSections], {
      x: rx,
      w: rw,
      startY,
      maxY: H - 36,
      fontStack: sans,
      headingFontStack: serif,
      headingColor: '#4A4640',
      bodyColor: '#3D3A35',
      subColor: '#2B2A28',
      ruleMode: 'terracotta-bar',
      lineH,
      fontSize,
    });

    return canvas.toDataURL('image/jpeg', 0.88);
  }

  // SWISS MINIMAL
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  const mx = 56;
  const cw = W - mx * 2;
  let y = 64;
  ctx.fillStyle = '#111827';
  ctx.font = `bold 28px ${sans}`;
  ctx.fillText(model.displayName.toUpperCase(), mx, y);
  y += 22;
  if (model.displayRole) {
    ctx.font = `13.5px ${sans}`;
    ctx.fillText(model.displayRole.toUpperCase(), mx, y);
    y += 18;
  }
  if (model.inlineContactLine) {
    ctx.fillStyle = '#4B5563';
    ctx.font = `11px ${sans}`;
    ctx.fillText(model.inlineContactLine, mx, y);
    y += 12;
  }
  ctx.strokeStyle = '#4B5563';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(mx, y);
  ctx.lineTo(W - mx, y);
  ctx.stroke();
  y += 24;

  drawCanvasSections(ctx, model.swissSections, {
    x: mx,
    w: cw,
    startY: y,
    maxY: H - 32,
    fontStack: sans,
    headingColor: '#111827',
    bodyColor: '#374151',
    subColor: '#111827',
    ruleMode: 'full',
    lineH,
    fontSize,
  });

  return canvas.toDataURL('image/jpeg', 0.88);
};

export const renderSinglePageTemplateDataUrlAsync = async (
  payload: DocumentFormPayload,
  templateId: Exclude<CareerStudioTemplateId, 'default'>
): Promise<string> => {
  let img: HTMLImageElement | null = null;
  if (
    (templateId === 'royal_passport' || templateId === 'slate_two_page') &&
    payload.passportImageUrl
  ) {
    img = await loadPassportImageElement(payload.passportImageUrl);
  }
  return renderSinglePageTemplateDataUrl(payload, templateId, img);
};

// ============================================================================
// 3. STYLED TEMPLATE DOCX EXPORTS (JSZip OOXML)
// ============================================================================

const esc = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const runXml = (
  txt: string,
  opts: { font: string; sizeHalfPt?: number; bold?: boolean; italic?: boolean; colorHex?: string }
) =>
  `<w:r><w:rPr><w:rFonts w:ascii="${opts.font}" w:hAnsi="${opts.font}" w:cs="${opts.font}"/>${
    opts.bold ? '<w:b/>' : ''
  }${opts.italic ? '<w:i/>' : ''}<w:color w:val="${opts.colorHex || '1E293B'}"/><w:sz w:val="${
    opts.sizeHalfPt ?? 19
  }"/><w:szCs w:val="${opts.sizeHalfPt ?? 19}"/></w:rPr><w:t xml:space="preserve">${esc(
    txt
  )}</w:t></w:r>`;

const paraXml = (
  runs: string,
  opts?: {
    align?: 'left' | 'center' | 'right' | 'both';
    before?: number;
    after?: number;
    bottomBorder?: { color: string; sz: number };
    boxBorder?: { color: string; bottomColor?: string };
    shadingHex?: string;
  }
) => {
  const bdr = opts?.boxBorder
    ? `<w:pBdr><w:top w:val="single" w:sz="6" w:space="6" w:color="${opts.boxBorder.color}"/><w:left w:val="single" w:sz="6" w:space="8" w:color="${opts.boxBorder.color}"/><w:right w:val="single" w:sz="6" w:space="8" w:color="${opts.boxBorder.color}"/><w:bottom w:val="single" w:sz="24" w:space="6" w:color="${
        opts.boxBorder.bottomColor || opts.boxBorder.color
      }"/></w:pBdr>`
    : opts?.bottomBorder
    ? `<w:pBdr><w:bottom w:val="single" w:sz="${opts.bottomBorder.sz}" w:space="3" w:color="${opts.bottomBorder.color}"/></w:pBdr>`
    : '';
  const shd = opts?.shadingHex ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.shadingHex}"/>` : '';
  return `<w:p><w:pPr>${bdr}${shd}<w:spacing w:before="${opts?.before ?? 0}" w:after="${
    opts?.after ?? 60
  }" w:line="240" w:lineRule="auto"/>${opts?.align ? `<w:jc w:val="${opts.align}"/>` : ''}</w:pPr>${runs}</w:p>`;
};

const renderSectionToWordXml = (
  sections: TemplateSection[],
  opts: {
    font: string;
    headingFont?: string;
    headingHex: string;
    bodyHex: string;
    subHex: string;
    ruleHex?: string;
    headingBadgeBgHex?: string;
  }
): string[] => {
  const out: string[] = [];
  const hFont = opts.headingFont || opts.font;
  for (const sec of sections) {
    out.push(
      paraXml(
        runXml(opts.headingBadgeBgHex ? `  ${sec.heading}  ` : sec.heading, {
          font: hFont,
          sizeHalfPt: 20,
          bold: true,
          colorHex: opts.headingBadgeBgHex ? 'FFFFFF' : opts.headingHex,
        }),
        {
          before: 110,
          after: 55,
          shadingHex: opts.headingBadgeBgHex,
          bottomBorder: !opts.headingBadgeBgHex && opts.ruleHex ? { color: opts.ruleHex, sz: 10 } : undefined,
        }
      )
    );
    if (sec.kind === 'contacts' && sec.contacts) {
      for (const c of sec.contacts) {
        out.push(paraXml(runXml(`• ${c.value}`, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex })));
      }
    } else if (sec.kind === 'paragraph' && sec.text) {
      out.push(
        paraXml(runXml(sec.text, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex }), {
          align: 'both',
        })
      );
    } else if (sec.kind === 'paragraphs' && sec.paragraphs) {
      for (const p of sec.paragraphs) {
        out.push(
          paraXml(runXml(p, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex }), {
            align: 'both',
          })
        );
      }
    } else if (sec.kind === 'bullets' && sec.bullets) {
      for (const b of sec.bullets) {
        out.push(paraXml(runXml(`• ${b}`, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex }), { after: 35 }));
      }
    } else if (sec.kind === 'subgroups' && sec.subgroups) {
      for (const sg of sec.subgroups) {
        if (sg.subtitle) {
          out.push(
            paraXml(runXml(sg.subtitle, { font: opts.font, sizeHalfPt: 18, bold: true, colorHex: opts.subHex }), {
              after: 30,
            })
          );
        }
        for (const it of sg.items) {
          out.push(paraXml(runXml(`• ${it}`, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex }), { after: 30 }));
        }
      }
    } else if (sec.kind === 'entries' && sec.entries) {
      for (const e of sec.entries) {
        out.push(
          paraXml(
            runXml(e.primary, { font: opts.font, sizeHalfPt: 19, bold: true, colorHex: opts.subHex }) +
              (e.dateRange
                ? runXml(`   (${e.dateRange})`, { font: opts.font, sizeHalfPt: 17, colorHex: opts.bodyHex })
                : ''),
            { before: 50, after: 20 }
          )
        );
        if (e.secondary) {
          out.push(
            paraXml(runXml(e.secondary, { font: opts.font, sizeHalfPt: 18, italic: true, colorHex: opts.bodyHex }), {
              after: 25,
            })
          );
        }
        if (e.bodyText) {
          out.push(paraXml(runXml(e.bodyText, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex }), { after: 30 }));
        }
        if (e.bullets) {
          for (const b of e.bullets) {
            out.push(paraXml(runXml(`• ${b}`, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex }), { after: 25 }));
          }
        }
      }
    } else if (sec.kind === 'signature' && sec.signature) {
      out.push(paraXml(runXml(sec.signature.signOff, { font: opts.font, sizeHalfPt: 18, colorHex: opts.bodyHex }), { before: 80 }));
      out.push(paraXml(runXml(sec.signature.name, { font: opts.font, sizeHalfPt: 18, bold: true, colorHex: opts.subHex })));
    }
  }
  return out;
};

export const exportSinglePageTemplateToDocxBlob = async (
  payload: DocumentFormPayload,
  templateId: Exclude<CareerStudioTemplateId, 'default'>
): Promise<Blob> => {
  const sans = 'Calibri';
  const serif = 'Georgia';
  const totalW = 10466;
  const parts: string[] = [];

  if (templateId === 'slate_two_page') {
    const tpModel = buildTwoPageDocumentModel(payload);
    const leftW = 3300;
    const rightW = totalW - leftW;

    parts.push(
      paraXml(
        runXml(tpModel.displayName, { font: sans, sizeHalfPt: 40, colorHex: '5B87AC' }) +
          (tpModel.displayRole
            ? `<w:r><w:br/></w:r>` +
              runXml(tpModel.displayRole, { font: sans, sizeHalfPt: 20, colorHex: '2D3748' })
            : ''),
        { after: 140, bottomBorder: { color: '5B87AC', sz: 14 } }
      )
    );

    const p1LeftXml = renderSectionToWordXml(tpModel.page1Left, {
      font: sans,
      headingHex: '5B87AC',
      bodyHex: '2D3748',
      subHex: '1E293B',
    }).join('');
    const p1RightXml = renderSectionToWordXml(tpModel.page1Right, {
      font: sans,
      headingHex: '5B87AC',
      bodyHex: '2D3748',
      subHex: '1E293B',
    }).join('');

    parts.push(`<w:tbl>
      <w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="single" w:sz="12" w:space="0" w:color="5B87AC"/></w:tblBorders></w:tblPr>
      <w:tblGrid><w:gridCol w:w="${leftW}"/><w:gridCol w:w="${rightW}"/></w:tblGrid>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="${leftW}" w:type="dxa"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tcMar></w:tcPr>${p1LeftXml}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${rightW}" w:type="dxa"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="220" w:type="dxa"/></w:tcMar></w:tcPr>${p1RightXml}</w:tc>
      </w:tr>
    </w:tbl>`);

    parts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');

    const p2LeftXml = renderSectionToWordXml(tpModel.page2Left, {
      font: sans,
      headingHex: '5B87AC',
      bodyHex: '2D3748',
      subHex: '1E293B',
    }).join('');
    const p2RightXml = renderSectionToWordXml(tpModel.page2Right, {
      font: sans,
      headingHex: '5B87AC',
      bodyHex: '2D3748',
      subHex: '1E293B',
    }).join('');

    parts.push(`<w:tbl>
      <w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="single" w:sz="12" w:space="0" w:color="5B87AC"/></w:tblBorders></w:tblPr>
      <w:tblGrid><w:gridCol w:w="${leftW}"/><w:gridCol w:w="${rightW}"/></w:tblGrid>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="${leftW}" w:type="dxa"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tcMar></w:tcPr>${p2LeftXml || '<w:p/>'}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${rightW}" w:type="dxa"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="220" w:type="dxa"/></w:tcMar></w:tcPr>${p2RightXml || '<w:p/>'}</w:tc>
      </w:tr>
    </w:tbl>`);

    parts.push(
      ...renderSectionToWordXml(tpModel.page2FullWidth, {
        font: sans,
        headingHex: '5B87AC',
        bodyHex: '2D3748',
        subHex: '1E293B',
      })
    );
  } else if (templateId === 'royal_passport') {
    const model = buildSinglePageDocumentModel(payload);
    parts.push(
      paraXml(
        runXml(model.displayName, { font: serif, sizeHalfPt: 40, bold: true, colorHex: '0B2D4D' }) +
          (model.displayRole
            ? `<w:r><w:br/></w:r>` +
              runXml(model.displayRole.toUpperCase(), { font: sans, sizeHalfPt: 20, colorHex: '1E3A5F' })
            : '') +
          (model.inlineContactLine
            ? `<w:r><w:br/></w:r>` +
              runXml(model.inlineContactLine, { font: sans, sizeHalfPt: 17, colorHex: '334155' })
            : ''),
        { after: 140, bottomBorder: { color: '1D70B8', sz: 12 } }
      )
    );

    const sideW = 3500;
    const mainW = totalW - sideW;
    const leftXml = renderSectionToWordXml(
      model.sidebarSections.filter((s) => s.kind !== 'contacts'),
      {
        font: sans,
        headingHex: '0B2D4D',
        bodyHex: '1E293B',
        subHex: '0B2D4D',
        ruleHex: '94A3B8',
      }
    ).join('');
    const rightXml = renderSectionToWordXml([...model.mainSections, ...model.trailingSections], {
      font: sans,
      headingHex: '0B2D4D',
      bodyHex: '1E293B',
      subHex: '0B2D4D',
      headingBadgeBgHex: '0B2D4D',
    }).join('');

    parts.push(`<w:tbl>
      <w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>
      <w:tblGrid><w:gridCol w:w="${sideW}"/><w:gridCol w:w="${mainW}"/></w:tblGrid>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="${sideW}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="EAEFF5"/><w:tcMar><w:top w:w="180" w:type="dxa"/><w:left w:w="180" w:type="dxa"/><w:bottom w:w="180" w:type="dxa"/><w:right w:w="180" w:type="dxa"/></w:tcMar></w:tcPr>${leftXml || '<w:p/>'}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="${mainW}" w:type="dxa"/><w:tcMar><w:top w:w="140" w:type="dxa"/><w:left w:w="220" w:type="dxa"/><w:bottom w:w="140" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${rightXml || '<w:p/>'}</w:tc>
      </w:tr>
    </w:tbl>`);
  } else {
    const model = buildSinglePageDocumentModel(payload);
    if (templateId === 'navy_sidebar') {
      const sideW = 3500;
      const mainW = totalW - sideW;
      const sideParas = renderSectionToWordXml(model.sidebarSections, {
        font: sans,
        headingHex: 'FFFFFF',
        bodyHex: 'DCE4EE',
        subHex: '93C5FD',
      }).join('');
      const mainParas = [
        paraXml(runXml(model.displayName.toUpperCase(), { font: sans, sizeHalfPt: 34, bold: true, colorHex: '22262A' }), {
          after: 20,
        }),
        model.displayRole
          ? paraXml(runXml(model.displayRole.toUpperCase(), { font: sans, sizeHalfPt: 20, colorHex: '374151' }), {
              after: 120,
            })
          : '',
        ...renderSectionToWordXml([...model.mainSections, ...model.trailingSections], {
          font: sans,
          headingHex: '1E293B',
          bodyHex: '334155',
          subHex: '1E293B',
          ruleHex: '334155',
        }),
        ...(model.skillsGridItems.length > 0
          ? renderSectionToWordXml(
              [{ id: 'docx-sk', heading: model.skillsGridTitle, kind: 'bullets', bullets: model.skillsGridItems }],
              { font: sans, headingHex: '1E293B', bodyHex: '334155', subHex: '1E293B', ruleHex: '334155' }
            )
          : []),
      ].join('');

      parts.push(`<w:tbl>
        <w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>
        <w:tblGrid><w:gridCol w:w="${sideW}"/><w:gridCol w:w="${mainW}"/></w:tblGrid>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="${sideW}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="1B3047"/><w:tcMar><w:top w:w="280" w:type="dxa"/><w:left w:w="220" w:type="dxa"/><w:bottom w:w="280" w:type="dxa"/><w:right w:w="220" w:type="dxa"/></w:tcMar></w:tcPr>${sideParas}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="${mainW}" w:type="dxa"/><w:tcMar><w:top w:w="260" w:type="dxa"/><w:left w:w="280" w:type="dxa"/><w:bottom w:w="260" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tcMar></w:tcPr>${mainParas}</w:tc>
        </w:tr>
      </w:tbl>`);
    } else if (templateId === 'warm_editorial') {
      parts.push(
        paraXml(
          runXml(model.displayName.toUpperCase(), { font: serif, sizeHalfPt: 36, colorHex: '4A4640' }) +
            (model.displayRole
              ? `<w:r><w:br/></w:r>` +
                runXml(model.displayRole.toUpperCase(), { font: sans, sizeHalfPt: 19, colorHex: '2B2A28' })
              : ''),
          { align: 'center', after: 160, boxBorder: { color: '969188', bottomColor: 'B9735B' } }
        )
      );
      const leftW = 3400;
      const rightW = totalW - leftW;
      const leftXml = renderSectionToWordXml(model.sidebarSections, {
        font: sans,
        headingFont: serif,
        headingHex: '4A4640',
        bodyHex: '3D3A35',
        subHex: '2B2A28',
        ruleHex: 'B9735B',
      }).join('');
      const rightXml = renderSectionToWordXml([...model.mainSections, ...model.trailingSections], {
        font: sans,
        headingFont: serif,
        headingHex: '4A4640',
        bodyHex: '3D3A35',
        subHex: '2B2A28',
        ruleHex: 'B9735B',
      }).join('');
      parts.push(`<w:tbl>
        <w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/><w:tblBorders><w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/></w:tblBorders></w:tblPr>
        <w:tblGrid><w:gridCol w:w="${leftW}"/><w:gridCol w:w="${rightW}"/></w:tblGrid>
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="${leftW}" w:type="dxa"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="40" w:type="dxa"/><w:right w:w="220" w:type="dxa"/></w:tcMar></w:tcPr>${leftXml}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="${rightW}" w:type="dxa"/><w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tcMar></w:tcPr>${rightXml}</w:tc>
        </w:tr>
      </w:tbl>`);
    } else {
      parts.push(
        paraXml(runXml(model.displayName.toUpperCase(), { font: sans, sizeHalfPt: 38, bold: true, colorHex: '111827' }), {
          after: 20,
        })
      );
      if (model.displayRole) {
        parts.push(
          paraXml(runXml(model.displayRole.toUpperCase(), { font: sans, sizeHalfPt: 21, colorHex: '1F2937' }), {
            after: model.inlineContactLine ? 25 : 100,
            bottomBorder: model.inlineContactLine ? undefined : { color: '4B5563', sz: 14 },
          })
        );
      }
      if (model.inlineContactLine) {
        parts.push(
          paraXml(runXml(model.inlineContactLine, { font: sans, sizeHalfPt: 17, colorHex: '4B5563' }), {
            after: 100,
            bottomBorder: { color: '4B5563', sz: 14 },
          })
        );
      }
      parts.push(
        ...renderSectionToWordXml(model.swissSections, {
          font: sans,
          headingHex: '111827',
          bodyHex: '374151',
          subHex: '111827',
          ruleHex: '6B7280',
        })
      );
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${parts.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.folder('_rels')?.file('.rels', relsXml);
  zip.folder('word')?.file('document.xml', documentXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};
