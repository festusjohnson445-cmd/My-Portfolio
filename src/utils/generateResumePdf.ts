import { jsPDF } from 'jspdf';
import type {
  ProfileExperience,
  ProfilePublication,
  ProfileAchievement,
} from './portfolioSupabase';

import {
  categorizeSkills as categorizeIntoThreeParts,
  resolveSkillStatus,
  formatSkillStatusLabel,
  type SkillStatus,
} from '../data/skillsData';

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
  certifiedSkills?: string[];
  skillStatuses?: Record<string, SkillStatus>;
  description: string;
  experiences?: ProfileExperience[];
  publications?: ProfilePublication[];
  achievements?: ProfileAchievement[];
  documents?: Array<{
    id: string;
    title: string;
    issuer: string;
    credentialId?: string;
    date: string;
    description: string;
    competencies: string[];
    credentialGroup?: 'Specialization' | 'Courses' | 'Document';
    parentSpecializationId?: string;
  }>;
}

export interface SkillCategoryGroup {
  category: string;
  skills: string[];
}

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

export function categorizeSkills(rawSkills?: string): SkillCategoryGroup[] {
  if (!rawSkills || rawSkills.trim().length === 0) {
    return [
      {
        category: 'Core Engineering Skills',
        skills: ['SolidWorks (CSWP/CSWE)', 'PTC Creo', 'Autodesk Inventor', 'Siemens NX', 'Fusion 360', 'AutoCAD Mechanical', 'FEA Analysis'],
      },
      {
        category: 'Handful Skills',
        skills: ['CNC Machine', 'Laser Engraver/Cutter', '3D Animation'],
      },
      {
        category: 'IT Skills',
        skills: ['React.js & Full-Stack Web Development', 'C/C++', 'Python (NumPy / SciPy / Pandas)'],
      },
    ];
  }

  const grouped = categorizeIntoThreeParts(rawSkills);
  const order: Array<'Core Engineering Skills' | 'Handful Skills' | 'IT Skills'> = [
    'Core Engineering Skills',
    'Handful Skills',
    'IT Skills',
  ];
  return order
    .filter((cat) => grouped[cat] && grouped[cat].length > 0)
    .map((cat) => ({
      category: cat,
      skills: grouped[cat],
    }));
}

/**
 * Generates an executive, publication-grade resume PDF formatted in Times New Roman,
 * dynamically populated with Bio & About, Experience & Career, Research & Publications,
 * Achievements & Awards (including verified-certificate skill status), and Credentials.
 */
export function generateAndDownloadResume(data: ResumeDataProps): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 19;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - margin - 8;
  let y = margin;

  const ensureSpace = (neededHeight: number): void => {
    if (y + neededHeight > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  // --- HEADER ---
  const centerX = pageWidth / 2;
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  const nameLines = doc.splitTextToSize(
    (data.fullName || 'Festus, Olorunsogo Johnson').toUpperCase(),
    contentWidth
  ) as string[];
  nameLines.forEach((ln) => {
    doc.text(ln, centerX, y, { align: 'center' });
    y += 6.2;
  });

  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  const headerLines = doc.splitTextToSize(
    data.header || 'Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology',
    contentWidth
  ) as string[];
  headerLines.forEach((ln) => {
    doc.text(ln, centerX, y, { align: 'center' });
    y += 4.9;
  });
  y += 1.2;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const contactParts: string[] = [];
  if (data.email) contactParts.push(`Email: ${data.email}`);
  if (data.country) contactParts.push(`Location: ${data.country}`);
  if (data.discipline) contactParts.push(`Discipline: ${data.discipline}`);
  if (data.badges) contactParts.push(`Credentials: ${data.badges}`);

  const contactLines = doc.splitTextToSize(contactParts.join('  |  '), contentWidth) as string[];
  contactLines.forEach((ln) => {
    doc.text(ln, centerX, y, { align: 'center' });
    y += 4.6;
  });
  y += 1.8;

  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.55);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5.5;

  const renderSectionHeader = (title: string): void => {
    ensureSpace(12);
    y += 1.6;
    doc.setFont('times', 'bold');
    doc.setFontSize(11.8);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), margin, y);
    y += 1.5;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.32);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4.6;
  };

  // --- 1. BIO & ABOUT ---
  renderSectionHeader('Bio & About');
  doc.setFont('times', 'normal');
  doc.setFontSize(10.8);
  doc.setTextColor(15, 23, 42);

  const summary =
    data.description ||
    'Lead Mechanical Design Engineer with specialized experience in precision hardware mechanisms, flight-rated assemblies, and robotic systems.';
  const paragraphs = summary.split('\n\n').filter((p) => p.trim().length > 0);
  paragraphs.forEach((pText) => {
    const wrappedLines = doc.splitTextToSize(pText.trim(), contentWidth);
    ensureSpace(wrappedLines.length * 4.9 + 2.4);
    doc.text(wrappedLines, margin, y);
    y += wrappedLines.length * 4.9 + 2.5;
  });

  // Education / Degree & Leadership inside Bio context
  if (data.degree || data.leadership) {
    ensureSpace(12);
    doc.setFont('times', 'bold');
    doc.setFontSize(10.6);
    if (data.degree) {
      const degLine = `Education: ${data.degree}${data.academicHonors ? ` — ${data.academicHonors}` : ''}`;
      const wrappedDeg = doc.splitTextToSize(degLine, contentWidth);
      doc.setFont('times', 'normal');
      doc.text(wrappedDeg, margin, y);
      y += wrappedDeg.length * 4.8 + 1.5;
    }
    if (data.leadership) {
      const leadLine = `Leadership: ${data.leadership}`;
      const wrappedLead = doc.splitTextToSize(leadLine, contentWidth);
      doc.setFont('times', 'normal');
      doc.text(wrappedLead, margin, y);
      y += wrappedLead.length * 4.8 + 2.2;
    }
  }

  // --- 2. EXPERIENCE & CAREER ---
  if (data.experiences && data.experiences.length > 0) {
    renderSectionHeader('Experience & Career');
    data.experiences.forEach((exp) => {
      ensureSpace(18);
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const roleOrg = `${exp.roleTitle}${exp.organization ? ` — ${exp.organization}` : ''}`;
      doc.text(roleOrg, margin, y);

      const dateRange = `${exp.startDate}${exp.isCurrent ? ' – Present' : exp.endDate ? ` – ${exp.endDate}` : ''}`;
      if (dateRange) {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        const dw = doc.getTextWidth(dateRange);
        doc.text(dateRange, margin + contentWidth - dw, y);
      }
      y += 4.6;

      if (exp.location) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9.8);
        doc.setTextColor(71, 85, 105);
        doc.text(exp.location, margin, y);
        y += 4.3;
      }

      if (exp.summary) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        const sLines = doc.splitTextToSize(exp.summary, contentWidth - 2);
        ensureSpace(sLines.length * 4.7 + 2);
        doc.text(sLines, margin + 2, y);
        y += sLines.length * 4.7 + 1.2;
      }

      if (exp.highlights && exp.highlights.length > 0) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10.2);
        exp.highlights.forEach((h) => {
          const hLines = doc.splitTextToSize(`• ${h}`, contentWidth - 6);
          ensureSpace(hLines.length * 4.5 + 1);
          doc.text(hLines, margin + 4, y);
          y += hLines.length * 4.5 + 0.8;
        });
      }
      y += 2.2;
    });
  }

  // --- 3. RESEARCH & PUBLICATIONS ---
  if (data.publications && data.publications.length > 0) {
    renderSectionHeader('Research & Publications');
    data.publications.forEach((pub, idx) => {
      ensureSpace(15);
      doc.setFont('times', 'bold');
      doc.setFontSize(10.8);
      doc.setTextColor(15, 23, 42);
      const pubTitle = doc.splitTextToSize(`${idx + 1}. ${pub.title}`, contentWidth - 18);
      doc.text(pubTitle, margin, y);
      if (pub.year) {
        doc.setFont('times', 'italic');
        doc.setFontSize(10);
        const yw = doc.getTextWidth(pub.year);
        doc.text(pub.year, margin + contentWidth - yw, y);
      }
      y += pubTitle.length * 4.7 + 0.8;

      const meta = [pub.authors, pub.venueOrJournal, pub.doiOrUrl].filter(Boolean).join('  |  ');
      if (meta) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9.8);
        doc.setTextColor(71, 85, 105);
        const mLines = doc.splitTextToSize(meta, contentWidth - 4);
        doc.text(mLines, margin + 4, y);
        y += mLines.length * 4.4 + 0.8;
      }
      if (pub.abstract) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10.2);
        doc.setTextColor(30, 41, 59);
        const aLines = doc.splitTextToSize(pub.abstract, contentWidth - 4);
        ensureSpace(aLines.length * 4.5 + 1.5);
        doc.text(aLines, margin + 4, y);
        y += aLines.length * 4.5 + 1.5;
      }
      y += 1.5;
    });
  }

  // --- 4. ACHIEVEMENTS, AWARDS & TECHNICAL SKILLS ---
  renderSectionHeader('Achievements, Awards & Core Skills');

  if (data.achievements && data.achievements.length > 0) {
    data.achievements.forEach((ach) => {
      ensureSpace(12);
      doc.setFont('times', 'bold');
      doc.setFontSize(10.6);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${ach.title}${ach.issuer ? ` (${ach.issuer})` : ''}`, margin, y);
      if (ach.dateStr) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9.8);
        doc.setTextColor(71, 85, 105);
        const dw = doc.getTextWidth(ach.dateStr);
        doc.text(ach.dateStr, margin + contentWidth - dw, y);
      }
      y += 4.5;
      if (ach.description) {
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        const dLines = doc.splitTextToSize(ach.description, contentWidth - 5);
        ensureSpace(dLines.length * 4.4 + 1);
        doc.text(dLines, margin + 4, y);
        y += dLines.length * 4.4 + 1.2;
      }
    });
    y += 1.5;
  }

  const skillCategories = categorizeSkills(data.skills);
  skillCategories.forEach((catGroup) => {
    const labeledSkills = catGroup.skills.map((sk) => {
      const st = resolveSkillStatus(sk, data.skillStatuses, data.certifiedSkills);
      return `${sk} [${formatSkillStatusLabel(st)}]`;
    });
    const lineStr = `• ${catGroup.category}: ${labeledSkills.join('  •  ')}`;
    doc.setFont('times', 'normal');
    doc.setFontSize(10.4);
    doc.setTextColor(30, 41, 59);
    const wrapped = doc.splitTextToSize(lineStr, contentWidth);
    ensureSpace(wrapped.length * 4.7 + 1.5);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.7 + 1.5;
  });

  // --- 5. VERIFIED CREDENTIALS (SPECIALIZATIONS & COURSES) ---
  if (data.documents && data.documents.length > 0) {
    renderSectionHeader('Verified Credentials & Certificates');
    const specializations = data.documents.filter((d) => d.credentialGroup === 'Specialization');
    const courses = data.documents.filter((d) => d.credentialGroup === 'Courses');
    const standalone = data.documents.filter(
      (d) => d.credentialGroup !== 'Specialization' && d.credentialGroup !== 'Courses'
    );

    const printCred = (docItem: NonNullable<ResumeDataProps['documents']>[number], prefix = '') => {
      ensureSpace(14);
      doc.setFont('times', 'bold');
      doc.setFontSize(10.6);
      doc.setTextColor(15, 23, 42);
      const label = `${prefix}${docItem.title}${docItem.credentialGroup ? ` [${docItem.credentialGroup}]` : ''}`;
      doc.text(label, margin + (prefix.startsWith('  ') ? 4 : 0), y);
      if (docItem.date) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9.8);
        doc.setTextColor(71, 85, 105);
        const dw = doc.getTextWidth(docItem.date);
        doc.text(docItem.date, margin + contentWidth - dw, y);
      }
      y += 4.5;
      doc.setFont('times', 'normal');
      doc.setFontSize(9.8);
      doc.setTextColor(51, 65, 85);
      const issuerInfo = `Issuer: ${docItem.issuer || 'Accredited Body'}${
        docItem.credentialId || docItem.id ? `  |  ID: ${docItem.credentialId || docItem.id}` : ''
      }`;
      const wIssuer = doc.splitTextToSize(issuerInfo, contentWidth - 8);
      doc.text(wIssuer, margin + 4, y);
      y += wIssuer.length * 4.3 + 1.2;
    };

    specializations.forEach((spec, idx) => {
      printCred(spec, `${idx + 1}. `);
      const subCourses = courses.filter((c) => c.parentSpecializationId === spec.id);
      subCourses.forEach((c) => printCred(c, '   ↳ Course: '));
    });

    const orphanCourses = courses.filter(
      (c) => !c.parentSpecializationId || !specializations.some((s) => s.id === c.parentSpecializationId)
    );
    orphanCourses.forEach((c) => printCred(c, '• '));
    standalone.forEach((d) => printCred(d, '• '));
  }

  // --- RUNNING FOOTER ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, margin + contentWidth, pageHeight - 14);
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${data.fullName || 'Festus, Olorunsogo Johnson'}  —  Curriculum Vitae`,
      margin,
      pageHeight - 9
    );
    const pageStr = `Page ${p} of ${totalPages}`;
    doc.text(pageStr, margin + contentWidth - doc.getTextWidth(pageStr), pageHeight - 9);
  }

  const safeFilename = `${(data.fullName || 'Festus_Johnson').replace(/[^a-zA-Z0-9]/g, '_')}_Resume.pdf`;
  doc.save(safeFilename);
}
