/**
 * Document Structure & Section Detector for EaseStudy
 * Automatically parses extracted document text to identify chapters,
 * numbered headings, major topics, and page markers.
 */

export interface DetectedSection {
  id: string;
  title: string;
  type: 'chapter' | 'heading' | 'page' | 'part';
  pageNumber?: number;
  snippet?: string;
}

export function detectDocumentSections(text: string): DetectedSection[] {
  if (!text || text.trim().length === 0) return [];

  const lines = text.split('\n');
  const sections: DetectedSection[] = [];
  const seenTitles = new Set<string>();

  let currentPage = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Page marker detection (e.g., --- Page 4 --- or Page 4 of 20)
    const pageMatch = rawLine.match(/^(?:---\s*Page\s*(\d+)\s*---|Page\s+(\d+)(?:\s+of\s+\d+)?)$/i);
    if (pageMatch) {
      currentPage = parseInt(pageMatch[1] || pageMatch[2], 10) || currentPage;
      continue;
    }

    // 1. Explicit Chapter Headings: "Chapter 1", "Chapter I: Dynamics", "CHAPTER THREE - ..."
    const chapterMatch = rawLine.match(/(?:^|\b)(?:chapter|ch\.)\s+([0-9ivxlcdm]+|[a-z]+)(?:[\s:.\-–—]+([^.\n\r]{3,80}))?/i);
    if (chapterMatch) {
      const num = chapterMatch[1];
      const titleRest = (chapterMatch[2] || '').trim();
      const fullTitle = titleRest ? `Chapter ${num}: ${titleRest}` : `Chapter ${num}`;
      const cleanKey = fullTitle.toLowerCase();
      if (!seenTitles.has(cleanKey)) {
        seenTitles.add(cleanKey);
        sections.push({
          id: `sec-${sections.length + 1}`,
          title: fullTitle,
          type: 'chapter',
          pageNumber: currentPage,
          snippet: lines.slice(i + 1, i + 4).join(' ').trim().slice(0, 150),
        });
        continue;
      }
    }

    // 2. Part Headings: "Part 1: Foundations", "Part II"
    const partMatch = rawLine.match(/^part\s+([0-9ivxlcdm]+|[a-z]+)[\s:.\-–—]+(.*)$/i) ||
                      rawLine.match(/^part\s+([0-9ivxlcdm]+|[a-z]+)$/i);
    if (partMatch) {
      const num = partMatch[1];
      const titleRest = partMatch[2] ? partMatch[2].trim() : '';
      const fullTitle = titleRest ? `Part ${num}: ${titleRest}` : `Part ${num}`;
      const cleanKey = fullTitle.toLowerCase();
      if (!seenTitles.has(cleanKey)) {
        seenTitles.add(cleanKey);
        sections.push({
          id: `sec-${sections.length + 1}`,
          title: fullTitle,
          type: 'part',
          pageNumber: currentPage,
        });
        continue;
      }
    }

    // 3. Numbered Sections: "1.0 Introduction", "2.1 Boundary Conditions"
    const numberedMatch = rawLine.match(/^([0-9]{1,2}\.[0-9]{1,2}(?:\.[0-9]{1,2})?)\s+([A-Z][^\n\r]+)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const name = numberedMatch[2].trim();
      const fullTitle = `${num} ${name}`;
      const cleanKey = fullTitle.toLowerCase();
      if (!seenTitles.has(cleanKey) && name.length >= 4) {
        seenTitles.add(cleanKey);
        sections.push({
          id: `sec-${sections.length + 1}`,
          title: fullTitle,
          type: 'heading',
          pageNumber: currentPage,
        });
        continue;
      }
    }

    // 4. Standard Academic & Book Section Names (in Caps or Title Case)
    const standardHeadings = [
      'INTRODUCTION',
      'BACKGROUND',
      'EXECUTIVE SUMMARY',
      'LITERATURE REVIEW',
      'THEORETICAL FRAMEWORK',
      'METHODOLOGY',
      'EXPERIMENTAL SETUP',
      'SYSTEM ARCHITECTURE',
      'RESULTS AND DISCUSSION',
      'ANALYSIS',
      'FINDINGS',
      'CONCLUSION',
      'RECOMMENDATIONS',
      'CASE STUDY',
      'CORE PRINCIPLES',
      'FUNDAMENTAL THEOREMS',
    ];

    const upper = rawLine.toUpperCase();
    for (const sh of standardHeadings) {
      if (upper === sh || upper.startsWith(sh + ':') || upper.startsWith(sh + ' -')) {
        const title = rawLine.length > 50 ? sh : rawLine;
        const cleanKey = title.toLowerCase();
        if (!seenTitles.has(cleanKey)) {
          seenTitles.add(cleanKey);
          sections.push({
            id: `sec-${sections.length + 1}`,
            title,
            type: 'heading',
            pageNumber: currentPage,
          });
        }
        break;
      }
    }

    // Limit to 20 detected sections to keep UI clean and scannable
    if (sections.length >= 20) break;
  }

  return sections;
}
