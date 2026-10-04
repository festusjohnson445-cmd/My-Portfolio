import { jsPDF } from 'jspdf';

export interface ResumeDataProps {
  fullName: string;
  header: string;
  email: string;
  country: string;
  discipline: string;
  badges: string;
  degree: string;
  academicHonors: string;
  leadership: string;
  skills: string;
  description: string;
  documents?: Array<{
    title: string;
    issuer: string;
    id: string;
    date: string;
    description: string;
    competencies: string[];
  }>;
}

export interface SkillCategoryGroup {
  category: string;
  skills: string[];
}

/**
 * Standard categories matching the user's verified competencies and screenshot
 */
export const SCREENSHOT_SKILL_CATEGORIES: SkillCategoryGroup[] = [
  {
    category: 'CAD & Mechanical Design Engineering',
    skills: [
      'SolidWorks (CSWP/CSWE)',
      'PTC Creo',
      'Autodesk Inventor',
      'Siemens NX',
      'Fusion 360',
      'AutoCAD Mechanical',
      'Design Calculation',
    ],
  },
  {
    category: 'Advanced Manufacturing & Digital Fabrication',
    skills: [
      'CNC Machine',
      'Laser Engraver/Cutter',
      '3D Animation',
      '3D Maxs',
    ],
  },
  {
    category: 'Software Engineering & Web Development',
    skills: [
      'React.js & Full-Stack Web Development',
      'Web Developer',
      'C/C++',
      'IT',
    ],
  },
  {
    category: 'Artificial Intelligence, Security & Digital Design',
    skills: [
      'AI & Machine Learning',
      'Cybersecurity',
      'Graphic Design',
      'Microsoft Office',
    ],
  },
];

/**
 * Helper to categorize comma/bullet-delimited skills or preserve user structure
 */
export function categorizeSkills(rawSkills?: string): SkillCategoryGroup[] {
  if (!rawSkills || rawSkills.trim().length === 0) {
    return SCREENSHOT_SKILL_CATEGORIES;
  }

  // If already structured with colons/newlines
  if (rawSkills.includes(':') && (rawSkills.includes('\n') || rawSkills.includes(';'))) {
    const lines = rawSkills.split(/[\n;]/).map((l) => l.trim()).filter(Boolean);
    const customGroups: SkillCategoryGroup[] = [];
    lines.forEach((line) => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const catName = line.slice(0, colonIdx).replace(/^[•\-\*]\s*/, '').trim();
        const sks = line.slice(colonIdx + 1).split(/[,•]/).map((s) => s.trim()).filter(Boolean);
        if (sks.length > 0) {
          customGroups.push({ category: catName, skills: sks });
        }
      }
    });
    if (customGroups.length > 0) return customGroups;
  }

  const items = rawSkills
    .split(/[,•\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const groups: Record<string, string[]> = {
    'CAD & Mechanical Design Engineering': [],
    'Advanced Manufacturing & Digital Fabrication': [],
    'Software Engineering & Web Development': [],
    'Artificial Intelligence, Security & Digital Design': [],
    'Specialized Engineering Competencies': [],
  };

  items.forEach((item) => {
    const lower = item.toLowerCase();
    if (
      lower.includes('solidworks') ||
      lower.includes('creo') ||
      lower.includes('inventor') ||
      lower.includes('nx') ||
      lower.includes('fusion') ||
      lower.includes('autocad') ||
      lower.includes('cad') ||
      lower.includes('calculation') ||
      lower.includes('gd&t') ||
      lower.includes('ansys') ||
      lower.includes('fea')
    ) {
      groups['CAD & Mechanical Design Engineering'].push(item);
    } else if (
      lower.includes('cnc') ||
      lower.includes('laser') ||
      lower.includes('engraver') ||
      lower.includes('cutter') ||
      lower.includes('animation') ||
      lower.includes('maxs') ||
      lower.includes('3ds') ||
      lower.includes('machin') ||
      lower.includes('milling')
    ) {
      groups['Advanced Manufacturing & Digital Fabrication'].push(item);
    } else if (
      lower.includes('react') ||
      lower.includes('full-stack') ||
      lower.includes('web') ||
      lower.includes('c++') ||
      lower.includes('c/') ||
      lower.includes('developer') ||
      lower.includes('software') ||
      lower === 'it' ||
      lower.includes('information tech')
    ) {
      groups['Software Engineering & Web Development'].push(item);
    } else if (
      lower.includes('ai') ||
      lower.includes('machine learning') ||
      lower.includes('cyber') ||
      lower.includes('graphic') ||
      lower.includes('microsoft') ||
      lower.includes('office')
    ) {
      groups['Artificial Intelligence, Security & Digital Design'].push(item);
    } else {
      groups['Specialized Engineering Competencies'].push(item);
    }
  });

  const result: SkillCategoryGroup[] = [];
  Object.entries(groups).forEach(([category, skills]) => {
    if (skills.length > 0) {
      result.push({ category, skills });
    }
  });

  return result.length > 0 ? result : SCREENSHOT_SKILL_CATEGORIES;
}

/**
 * Generates an executive, publication-grade resume PDF formatted in Times New Roman.
 * All text sizes and vertical metrics are reduced by 5% to ensure immaculate layout balance
 * and comprehensive fitting across standard A4 pages with 20mm margins.
 */
export function generateAndDownloadResume(data: ResumeDataProps): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2; // 170mm
  const bottomLimit = pageHeight - margin - 8; // Leave room for footer
  let y = margin;

  // Helper for dynamic page breaks
  const ensureSpace = (neededHeight: number): void => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  // --- HEADER: NAME, SUBTITLE & CONTACT INFO ---
  // Name: 18pt * 0.95 = 17.1pt
  doc.setFont('times', 'bold');
  doc.setFontSize(17.1);
  doc.setTextColor(15, 23, 42); // slate-900
  const nameText = (data.fullName || 'Festus, Olorunsogo Johnson').toUpperCase();
  doc.text(nameText, margin, y);
  y += 6.5;

  // Professional Subtitle / Header: 12pt * 0.95 = 11.4pt
  doc.setFont('times', 'italic');
  doc.setFontSize(11.4);
  doc.setTextColor(30, 41, 59); // slate-800
  const headerLines = doc.splitTextToSize(
    data.header || 'Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology',
    contentWidth
  );
  doc.text(headerLines, margin, y);
  y += headerLines.length * 5.2 + 1.2;

  // Contact / Details Line: 11pt * 0.95 = 10.45pt
  doc.setFont('times', 'normal');
  doc.setFontSize(10.45);
  doc.setTextColor(51, 65, 85); // slate-700
  const contactParts: string[] = [];
  if (data.email) contactParts.push(`Email: ${data.email}`);
  if (data.country) contactParts.push(`Location: ${data.country}`);
  if (data.discipline) contactParts.push(`Discipline: ${data.discipline}`);
  if (data.badges) contactParts.push(`Credentials: ${data.badges}`);

  const contactString = contactParts.join('  |  ');
  const contactLines = doc.splitTextToSize(contactString, contentWidth);
  doc.text(contactLines, margin, y);
  y += contactLines.length * 4.9 + 1.8;

  // Header Divider Rule
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.55);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6.0;

  // --- HELPER: SECTION HEADING BUILDER ---
  // Section Headings: 13pt * 0.95 = 12.35pt
  const renderSectionHeader = (title: string): void => {
    ensureSpace(13);
    y += 1.8;
    doc.setFont('times', 'bold');
    doc.setFontSize(12.35);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), margin, y);
    y += 1.6;

    // Horizontal Rule under section heading
    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5.0;
  };

  // --- 1. PROFESSIONAL SUMMARY & ENGINEERING PHILOSOPHY ---
  renderSectionHeader('Professional Summary & Engineering Philosophy');
  // Body text: 12pt * 0.95 = 11.4pt
  doc.setFont('times', 'normal');
  doc.setFontSize(11.4);
  doc.setTextColor(15, 23, 42);

  const summary =
    data.description ||
    'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems. Specialized in first-principles physics, non-linear FEA, ASME Y14.5 GD&T, and 5-axis CNC DFM optimization.';

  // Split paragraphs and wrap
  const paragraphs = summary.split('\n\n').filter((p) => p.trim().length > 0);
  paragraphs.forEach((pText) => {
    const wrappedLines = doc.splitTextToSize(pText.trim(), contentWidth);
    ensureSpace(wrappedLines.length * 5.4 + 2.8);
    doc.text(wrappedLines, margin, y);
    y += wrappedLines.length * 5.4 + 3.0;
  });

  // --- 2. CORE TECHNICAL COMPETENCIES & TOOLING (CATEGORIZED FROM SCREENSHOT) ---
  renderSectionHeader('Technical Skills & Core Competencies');
  const skillCategories = categorizeSkills(data.skills);

  skillCategories.forEach((catGroup) => {
    const bulletPrefix = `•  `;
    const categoryLabel = `${catGroup.category}: `;
    const skillsListStr = catGroup.skills.join('  •  ');

    // 1. Measure bold label width
    doc.setFont('times', 'bold');
    doc.setFontSize(11.4);
    doc.setTextColor(15, 23, 42);

    const bulletWidth = doc.getTextWidth(bulletPrefix);
    const labelWidth = doc.getTextWidth(categoryLabel);
    const totalPrefixWidth = bulletWidth + labelWidth;

    // 2. Measure skills text in normal font
    doc.setFont('times', 'normal');
    doc.setFontSize(11.4);
    doc.setTextColor(30, 41, 59);

    const firstLineAvailWidth = contentWidth - totalPrefixWidth;
    const words = skillsListStr.split(' ');
    let firstLineText = '';
    let remainingWords: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const candidate = firstLineText ? `${firstLineText} ${words[i]}` : words[i];
      if (doc.getTextWidth(candidate) <= firstLineAvailWidth) {
        firstLineText = candidate;
      } else {
        remainingWords = words.slice(i);
        break;
      }
    }

    // Subsequent lines use 6.5mm hanging indent
    const hangingIndent = 6.5;
    const subsequentAvailWidth = contentWidth - hangingIndent;
    const subsequentLines =
      remainingWords.length > 0
        ? doc.splitTextToSize(remainingWords.join(' '), subsequentAvailWidth)
        : [];

    const totalHeight = (1 + subsequentLines.length) * 5.2 + 1.8;
    ensureSpace(totalHeight);

    // Draw bullet and category in bold
    doc.setFont('times', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(bulletPrefix, margin, y);
    doc.text(categoryLabel, margin + bulletWidth, y);

    // Draw first line of skills in normal weight
    doc.setFont('times', 'normal');
    doc.setTextColor(30, 41, 59);
    if (firstLineText) {
      doc.text(firstLineText, margin + totalPrefixWidth, y);
    }
    y += 5.2;

    // Draw subsequent wrapped lines with hanging indent
    subsequentLines.forEach((sLine: string) => {
      doc.text(sLine, margin + hangingIndent, y);
      y += 5.2;
    });

    y += 1.2; // Clean spacing between categories
  });
  y += 1.5;

  // --- 3. EDUCATION & ACADEMIC ACCREDITATIONS ---
  renderSectionHeader('Education & Academic Accreditations');
  ensureSpace(15);

  // Degree: 12pt * 0.95 = 11.4pt bold
  doc.setFont('times', 'bold');
  doc.setFontSize(11.4);
  doc.setTextColor(15, 23, 42);
  const degreeText = data.degree || 'B.S. in Mechanical Engineering (BSME)';
  doc.text(degreeText, margin, y);

  // Honors / Accreditation: 12pt * 0.95 = 11.4pt italic
  if (data.academicHonors) {
    const degreeWidth = doc.getTextWidth(degreeText);
    doc.setFont('times', 'italic');
    doc.setFontSize(11.4);
    doc.setTextColor(51, 65, 85);
    const honorsText = `  —  ${data.academicHonors}`;
    const honorsWidth = doc.getTextWidth(honorsText);

    if (margin + degreeWidth + honorsWidth <= margin + contentWidth) {
      doc.text(honorsText, margin + degreeWidth, y);
      y += 5.4;
    } else {
      y += 5.4;
      const wrappedHonors = doc.splitTextToSize(data.academicHonors, contentWidth - 6);
      doc.text(wrappedHonors, margin + 4, y);
      y += wrappedHonors.length * 5.4;
    }
  } else {
    y += 5.4;
  }
  y += 1.8;

  // --- 4. LEADERSHIP & APPOINTMENTS ---
  if (data.leadership && data.leadership.trim().length > 0) {
    renderSectionHeader('Leadership & Appointments');
    doc.setFont('times', 'normal');
    doc.setFontSize(11.4);
    doc.setTextColor(15, 23, 42);

    const leaderLines = doc.splitTextToSize(data.leadership.trim(), contentWidth);
    ensureSpace(leaderLines.length * 5.4 + 2.5);
    doc.text(leaderLines, margin, y);
    y += leaderLines.length * 5.4 + 2.5;
  }

  // --- 5. VERIFIED CREDENTIALS & ENGINEERING DOCUMENTS ---
  if (data.documents && data.documents.length > 0) {
    renderSectionHeader('Verified Credentials & Engineering Documents');

    data.documents.forEach((docItem, index) => {
      ensureSpace(22);

      // Title: 12pt * 0.95 = 11.4pt bold
      doc.setFont('times', 'bold');
      doc.setFontSize(11.4);
      doc.setTextColor(15, 23, 42);
      doc.text(`${index + 1}.  ${docItem.title}`, margin, y);

      // Date on right: 11pt * 0.95 = 10.45pt italic
      if (docItem.date) {
        doc.setFont('times', 'italic');
        doc.setFontSize(10.45);
        doc.setTextColor(71, 85, 105);
        const dateWidth = doc.getTextWidth(docItem.date);
        doc.text(docItem.date, margin + contentWidth - dateWidth, y);
      }
      y += 5.1;

      // Issuer & Credential ID: 11pt * 0.95 = 10.45pt
      doc.setFont('times', 'normal');
      doc.setFontSize(10.45);
      doc.setTextColor(51, 65, 85);
      const issuerInfo = `Issuer: ${docItem.issuer || 'Accredited Body'}${
        docItem.id ? `  |  Credential ID: ${docItem.id}` : ''
      }`;
      const wrappedIssuer = doc.splitTextToSize(issuerInfo, contentWidth - 4);
      doc.text(wrappedIssuer, margin + 4, y);
      y += wrappedIssuer.length * 4.9 + 1;

      // Description: 11.5pt * 0.95 = 10.9pt
      if (docItem.description && docItem.description.trim().length > 0) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10.9);
        doc.setTextColor(30, 41, 59);
        const wrappedDesc = doc.splitTextToSize(docItem.description.trim(), contentWidth - 4);
        ensureSpace(wrappedDesc.length * 5.1 + 1.8);
        doc.text(wrappedDesc, margin + 4, y);
        y += wrappedDesc.length * 5.1 + 1.8;
      }

      // Competencies: 11pt * 0.95 = 10.45pt italic
      if (docItem.competencies && docItem.competencies.length > 0) {
        doc.setFont('times', 'italic');
        doc.setFontSize(10.45);
        doc.setTextColor(71, 85, 105);
        const compText = `Key Competencies: ${docItem.competencies.join(', ')}`;
        const wrappedComp = doc.splitTextToSize(compText, contentWidth - 6);
        ensureSpace(wrappedComp.length * 4.9 + 1.8);
        doc.text(wrappedComp, margin + 6, y);
        y += wrappedComp.length * 4.9 + 1.8;
      }

      y += 2.5;
    });
  }

  // --- RUNNING FOOTER WITH PAGE NUMBERS ---
  // Footer: 10pt * 0.95 = 9.5pt
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Footer divider line
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, margin + contentWidth, pageHeight - 14);

    // Footer text
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
      `${data.fullName || 'Festus Johnson'}  —  Curriculum Vitae / Professional Resume`,
      margin,
      pageHeight - 9
    );

    const pageStr = `Page ${p} of ${totalPages}`;
    const pageStrWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, margin + contentWidth - pageStrWidth, pageHeight - 9);
  }

  // --- DOWNLOAD PDF ---
  const safeFilename = `${(data.fullName || 'Festus_Johnson').replace(/[^a-zA-Z0-9]/g, '_')}_Resume.pdf`;
  doc.save(safeFilename);
}
