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

export function generateAndDownloadResume(data: ResumeDataProps): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = 18;
      return true;
    }
    return false;
  };

  // --- HEADER SECTION ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent line
  doc.setFillColor(8, 145, 178); // cyan-600
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  // Full Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(data.fullName.toUpperCase(), margin, 12);

  // Title / Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(165, 243, 252); // cyan-200
  const headerLines = doc.splitTextToSize(data.header || 'Lead Mechanical Design Engineer', contentWidth - 40);
  doc.text(headerLines[0] || 'Lead Mechanical Design Engineer', margin, 18);

  // Contact Info bar
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  const contactText = `Email: ${data.email || 'festusjohnson028@gmail.com'}  |  Country: ${data.country || 'United States'}  |  Discipline: ${data.discipline || 'Mechanical Design'}`;
  doc.text(contactText, margin, 24);

  y = 36;

  // --- SECTION BUILDER HELPER ---
  const drawSectionHeading = (title: string) => {
    checkPageBreak(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(14, 116, 144); // cyan-700
    doc.text(title.toUpperCase(), margin, y);

    // Section underline
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.line(margin, y + 1.5, margin + contentWidth, y + 1.5);
    y += 6.5;
  };

  // --- 1. PROFESSIONAL SUMMARY ---
  drawSectionHeading('Executive Summary & Engineering Philosophy');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // slate-700

  const summaryText = data.description || 'Lead Mechanical Design Engineer with deep expertise in precision mechanism design, non-linear structural and thermal FEA, multi-axis CNC fabrication, and ASME Y14.5 GD&T metrology.';
  const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
  
  checkPageBreak(summaryLines.length * 4.2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4.2 + 4;

  // --- 2. EDUCATION & ACADEMIC ACCREDITATIONS ---
  drawSectionHeading('Education & Academic Accreditations');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(data.degree || 'B.S. in Mechanical Engineering (BSME)', margin, y);

  if (data.academicHonors) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(` — ${data.academicHonors}`, margin + doc.getTextWidth(data.degree || 'B.S. in Mechanical Engineering (BSME)'), y);
  }
  y += 5;

  // --- 3. LEADERSHIP & APPOINTMENTS ---
  if (data.leadership) {
    drawSectionHeading('Leadership & Key Roles');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const leaderLines = doc.splitTextToSize(data.leadership, contentWidth);
    checkPageBreak(leaderLines.length * 4.2);
    doc.text(leaderLines, margin, y);
    y += leaderLines.length * 4.2 + 3;
  }

  // --- 4. CORE TECHNICAL SKILLS ---
  drawSectionHeading('Core Technical Competencies & Tooling');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const skillsText = data.skills || 'SolidWorks (CSWP), PTC Creo, Ansys Workbench (Static / Modal / Thermal FEA), ASME Y14.5 GD&T, 5-Axis CNC Milling, Wire EDM, CMM Probing';
  const skillLines = doc.splitTextToSize(skillsText, contentWidth);
  checkPageBreak(skillLines.length * 4.2);
  doc.text(skillLines, margin, y);
  y += skillLines.length * 4.2 + 4;

  // --- 5. VERIFIED DOCUMENTS & CREDENTIALS ---
  if (data.documents && data.documents.length > 0) {
    drawSectionHeading('Verified Credentials & Engineering Documents');
    data.documents.forEach((docItem) => {
      checkPageBreak(22);
      // Title + date
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(docItem.title, margin, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(8, 145, 178); // cyan-600
      const dateWidth = doc.getTextWidth(docItem.date || 'Verified');
      doc.text(docItem.date || 'Verified', margin + contentWidth - dateWidth, y);
      y += 4;

      // Issuer & ID
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Issuer: ${docItem.issuer}  |  Credential ID: ${docItem.id}`, margin, y);
      y += 4;

      // Description
      if (docItem.description) {
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const descLines = doc.splitTextToSize(docItem.description, contentWidth);
        doc.text(descLines, margin, y);
        y += descLines.length * 3.8;
      }

      // Competencies
      if (docItem.competencies && docItem.competencies.length > 0) {
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);
        docItem.competencies.slice(0, 3).forEach((comp) => {
          doc.text(`• ${comp}`, margin + 3, y);
          y += 3.5;
        });
      }
      y += 2;
    });
  }

  // --- FOOTER ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Generated directly from Verified Portfolio · Festus Johnson · Page ${i} of ${totalPages}`, margin, pageHeight - 8);
  }

  // Download directly
  const safeFilename = `${data.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_Engineering_Resume.pdf`;
  doc.save(safeFilename);
}
