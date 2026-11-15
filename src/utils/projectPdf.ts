import { jsPDF } from 'jspdf';
import type { PortfolioProject } from './portfolioSupabase';

/**
 * Generates a structured technical dossier PDF for a Project and saves it
 * using the exact filename format: "<Title of the project>.pdf".
 */
export function downloadProjectAsPdf(project: PortfolioProject): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - margin - 10;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  const renderSection = (title: string, body?: string) => {
    if (!body || !body.trim()) return;
    ensureSpace(16);
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), margin, y);
    y += 1.5;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(body.trim(), contentWidth);
    lines.forEach((line: string) => {
      ensureSpace(5.5);
      doc.text(line, margin, y);
      y += 5.2;
    });
    y += 3;
  };

  // Title Header
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(project.title || 'Engineering Project', contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6.8 + 1;

  doc.setFont('times', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  const metaText = [
    project.category ? `Category: ${project.category}` : '',
    project.status ? `Status: ${project.status}` : '',
    project.createdAt ? `Date: ${new Date(project.createdAt).toLocaleDateString()}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');
  if (metaText) {
    doc.text(metaText, margin, y);
    y += 5.5;
  }

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.55);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6.5;

  renderSection('Summary', project.description);
  renderSection('Overview', project.overview);
  renderSection('Objectives', project.objectives);
  renderSection('Methodology', project.methodology);

  if (project.specifications && project.specifications.length > 0) {
    ensureSpace(16);
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('SPECIFICATIONS', margin, y);
    y += 1.5;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    doc.setFontSize(10.5);
    project.specifications.forEach((spec) => {
      const line = `${spec.label}: ${spec.value}`;
      const wrapped = doc.splitTextToSize(line, contentWidth - 4);
      ensureSpace(wrapped.length * 5 + 2);
      doc.setFont('times', 'bold');
      doc.text('•', margin, y);
      doc.setFont('times', 'normal');
      doc.text(wrapped, margin + 4, y);
      y += wrapped.length * 5 + 1.5;
    });
    y += 3;
  }

  if (project.toolsUsed && project.toolsUsed.length > 0) {
    renderSection('Tools Used', project.toolsUsed.join(', '));
  }

  renderSection('Results & Outcomes', project.results);

  if (project.demoLinks && project.demoLinks.length > 0) {
    const linksText = project.demoLinks
      .map((l) => `${l.label || 'Link'}: ${l.url}`)
      .join('\n');
    renderSection('Demonstration Links', linksText);
  }

  if (project.cadDrawings && project.cadDrawings.length > 0) {
    const cadText = project.cadDrawings
      .map((d) => `${d.title || d.fileName || 'CAD Drawing'}: ${d.url}`)
      .join('\n');
    renderSection('CAD Drawings & Blueprints', cadText);
  }

  if (project.documents && project.documents.length > 0) {
    const docsText = project.documents
      .map((d) => `${d.title || d.fileName || 'Technical Document'}: ${d.url}`)
      .join('\n');
    renderSection('Attached Technical Documents', docsText);
  }

  // Page Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 14, margin + contentWidth, pageHeight - 14);
    doc.setFont('times', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(project.title || 'Engineering Project', margin, pageHeight - 9);
    const pageLabel = `Page ${p} of ${totalPages}`;
    doc.text(pageLabel, margin + contentWidth - doc.getTextWidth(pageLabel), pageHeight - 9);
  }

  // Required filename format: "<Title of the project>.pdf"
  const cleanTitle = (project.title || 'Engineering Project')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
  const fileName = `${cleanTitle || 'Engineering Project'}.pdf`;
  doc.save(fileName);
}
