import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import {
  CAREER_CATEGORY_META,
  createDefaultSectionCustomization,
  resolveDocumentTitle,
  type CareerStudioCategory,
  type CareerStudioFormData,
  type CareerSectionCustomization,
} from './careerStudio';

interface DocxParagraph {
  text: string;
  style?: 'Title' | 'Subtitle' | 'Heading1' | 'Heading2' | 'Normal' | 'Bullet' | 'Meta';
  align?: 'left' | 'center' | 'right' | 'both';
  bold?: boolean;
  italic?: boolean;
  spaceAfter?: number;
  spaceBefore?: number;
  bottomBorder?: boolean;
}

function getOrderedVisibleSections(
  category: CareerStudioCategory,
  customization?: CareerSectionCustomization
): { id: string; label: string }[] {
  const meta = CAREER_CATEGORY_META[category];
  const cfg = customization || createDefaultSectionCustomization(category);
  const hidden = new Set(cfg.hiddenSections || []);
  const order = cfg.order && cfg.order.length > 0 ? cfg.order : meta.sectionOrderDefaults;
  // Append any default keys missing from saved order
  const fullOrder = [...order, ...meta.sectionOrderDefaults.filter((k) => !order.includes(k))];
  return fullOrder
    .filter((id) => !hidden.has(id) && meta.sectionLabels[id])
    .map((id) => ({
      id,
      label: cfg.customTitleOverrides?.[id]?.trim() || meta.sectionLabels[id],
    }));
}

function sanitizeFilename(base: string, ext: string): string {
  const clean = (base || 'Career_Document')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
  return `${clean || 'Career_Document'}.${ext}`;
}

function splitParagraphs(raw?: string): string[] {
  return (raw || '')
    .split(/\n{2,}|\r\n\r\n/)
    .map((s) => s.replace(/\r?\n/g, ' ').trim())
    .filter(Boolean);
}

function splitBullets(raw?: string): string[] {
  return (raw || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}

// ============================================================================
// 1. CATEGORY-TAILORED PDF GENERATOR (SELECTABLE TEXT, A4, ATS-COMPLIANT)
// ============================================================================

export function buildCareerStudioPdfBytes(
  category: CareerStudioCategory,
  data: CareerStudioFormData,
  customization?: CareerSectionCustomization
): { arrayBuffer: ArrayBuffer; blob: Blob; fileName: string } {
  const meta = CAREER_CATEGORY_META[category];
  const sections = getOrderedVisibleSections(category, customization);
  const isStrictAts = meta.atsCompliant && (category === 'International CV' || category === 'Job Resume');
  const fontFamily = isStrictAts ? 'helvetica' : 'times';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = isStrictAts ? 17 : 20;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 18;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = margin;
    }
  };

  const drawJustifiedOrLeftParagraph = (text: string, fontSize = 10.5, indent = 0) => {
    const clean = text.trim();
    if (!clean) return;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(15, 23, 42);
    const width = contentWidth - indent;
    const lines = doc.splitTextToSize(clean, width);
    const lineHeight = fontSize * 0.44;
    ensureSpace(lines.length * lineHeight + 2.5);
    if (!isStrictAts && lines.length > 1) {
      // Justify all lines except the last line cleanly
      doc.text(clean, margin + indent, y, {
        maxWidth: width,
        align: 'justify',
      });
    } else {
      doc.text(lines, margin + indent, y);
    }
    y += lines.length * lineHeight + 2.4;
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(12);
    y += 2;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(isStrictAts ? 11 : 11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title.toUpperCase(), margin, y);
    y += 1.6;
    doc.setDrawColor(isStrictAts ? 51 : 22, isStrictAts ? 65 : 78, isStrictAts ? 85 : 99);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4.6;
  };

  const renderBullets = (bullets: string[], indent = 3) => {
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    bullets.forEach((b) => {
      const lines = doc.splitTextToSize(`• ${b}`, contentWidth - indent);
      ensureSpace(lines.length * 4.3 + 1.2);
      doc.text(lines, margin + indent, y);
      y += lines.length * 4.3 + 1.0;
    });
  };

  const contactLineParts = [
    data.email.trim(),
    data.phone.trim(),
    data.location.trim(),
    data.websiteOrLink.trim(),
    data.workAuthorization.trim(),
  ].filter(Boolean);

  // --- CATEGORY HEADER ---
  if (meta.layoutStyle === 'ats' || category === 'Academic Resume') {
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(17);
    doc.setTextColor(15, 23, 42);
    const nameStr = (data.fullName.trim() || 'CANDIDATE NAME').toUpperCase();
    doc.text(nameStr, margin, y);
    y += 6.2;

    if (data.headlineOrTargetRole.trim() || data.academicAffiliation.trim()) {
      doc.setFont(fontFamily, isStrictAts ? 'normal' : 'italic');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      const sub = [data.headlineOrTargetRole.trim(), data.academicAffiliation.trim()]
        .filter(Boolean)
        .join(' — ');
      const subLines = doc.splitTextToSize(sub, contentWidth);
      doc.text(subLines, margin, y);
      y += subLines.length * 4.6 + 1;
    }

    if (contactLineParts.length > 0) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      const cLines = doc.splitTextToSize(contactLineParts.join('  |  '), contentWidth);
      doc.text(cLines, margin, y);
      y += cLines.length * 4.2 + 2;
    }

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.55);
    doc.line(margin, y, margin + contentWidth, y);
    y += 4.5;
  } else if (category === 'Scholarship Motivation Letter') {
    // Formal Correspondence Layout
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(15, 23, 42);
    doc.text(data.fullName.trim() || 'Applicant Name', margin, y);
    y += 5;

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    contactLineParts.forEach((p) => {
      doc.text(p, margin, y);
      y += 4.3;
    });
    if (data.documentDate.trim()) {
      y += 2;
      doc.text(data.documentDate.trim(), margin, y);
      y += 5;
    } else {
      y += 3;
    }

    const recipientLines = [
      'Scholarship Selection Committee',
      data.awardingBody.trim(),
      data.targetInstitution.trim(),
      data.hostCountry.trim(),
    ].filter(Boolean);
    if (recipientLines.length > 0) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(10.2);
      doc.setTextColor(15, 23, 42);
      recipientLines.forEach((rl) => {
        doc.text(rl, margin, y);
        y += 4.4;
      });
      y += 3;
    }

    const subj = `SUBJECT: APPLICATION FOR ${
      data.scholarshipName.trim() || 'SCHOLARSHIP FELLOWSHIP'
    }${data.targetProgram.trim() ? ` — ${data.targetProgram.trim()}` : ''}`;
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(10.8);
    doc.setTextColor(15, 23, 42);
    const subjLines = doc.splitTextToSize(subj.toUpperCase(), contentWidth);
    doc.text(subjLines, margin, y);
    y += subjLines.length * 4.8 + 3;

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10.6);
    doc.text(data.recipientSalutation.trim() || 'Dear Selection Committee,', margin, y);
    y += 6;
  } else {
    // Academic Essay / Research Proposal / Study Plan
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    const docHeading =
      data.documentTitle.trim() ||
      (category === 'Statement of Purpose (SOP)'
        ? `Statement of Purpose — ${data.targetProgram.trim() || 'Graduate Admissions'}`
        : category === 'Personal Statement'
        ? `Personal Statement — ${data.targetProgram.trim() || 'Applicant Profile'}`
        : category === 'Study Plan'
        ? `Study Plan — ${data.targetProgram.trim() || 'Academic Program'}`
        : category);
    const headLines = doc.splitTextToSize(docHeading, contentWidth);
    doc.text(headLines, margin, y);
    y += headLines.length * 5.8 + 2;

    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const metaLines: string[] = [];
    if (data.fullName.trim()) {
      metaLines.push(
        `Applicant: ${data.fullName.trim()}${
          contactLineParts.length ? `  |  ${contactLineParts.join('  |  ')}` : ''
        }`
      );
    }
    const targetBits = [
      data.targetProgram.trim() || data.proposedDegreeLevel.trim(),
      data.targetDepartment.trim(),
      data.targetInstitution.trim(),
      data.hostCountry.trim(),
      data.applicationTerm.trim() || data.studyDuration.trim(),
      data.targetSupervisor.trim() ? `Supervisor: ${data.targetSupervisor.trim()}` : '',
      data.citizenshipCountry.trim() ? `Citizenship: ${data.citizenshipCountry.trim()}` : '',
      data.documentDate.trim(),
    ].filter(Boolean);
    if (targetBits.length > 0) {
      metaLines.push(targetBits.join('  |  '));
    }
    metaLines.forEach((ml) => {
      const w = doc.splitTextToSize(ml, contentWidth);
      doc.text(w, margin, y);
      y += w.length * 4.3 + 0.8;
    });
    y += 1.5;
    doc.setDrawColor(22, 78, 99);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;
  }

  // --- SECTION BODY RENDERING ---
  sections.forEach(({ id, label }) => {
    switch (category) {
      case 'International CV':
      case 'Job Resume': {
        if (id === 'summary' && data.professionalSummary.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.professionalSummary).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.2));
        } else if (id === 'experience' && data.experience.length > 0) {
          drawSectionHeading(label);
          data.experience.forEach((exp) => {
            ensureSpace(16);
            doc.setFont(fontFamily, 'bold');
            doc.setFontSize(10.6);
            doc.setTextColor(15, 23, 42);
            const titleStr = [exp.role.trim(), exp.organization.trim()].filter(Boolean).join(' — ');
            const dateStr = [exp.startDate.trim(), exp.isCurrent ? 'Present' : exp.endDate.trim()]
              .filter(Boolean)
              .join(' – ');
            doc.text(titleStr || 'Role', margin, y);
            if (dateStr) {
              doc.setFont(fontFamily, 'normal');
              doc.setFontSize(9.6);
              doc.setTextColor(71, 85, 105);
              doc.text(dateStr, margin + contentWidth - doc.getTextWidth(dateStr), y);
            }
            y += 4.4;
            if (exp.location.trim()) {
              doc.setFont(fontFamily, 'italic');
              doc.setFontSize(9.5);
              doc.setTextColor(71, 85, 105);
              doc.text(exp.location.trim(), margin, y);
              y += 4.1;
            }
            const bullets = splitBullets(exp.bullets);
            if (bullets.length > 0) renderBullets(bullets);
            y += 1.8;
          });
        } else if (id === 'projects' && data.projects.length > 0) {
          drawSectionHeading(label);
          data.projects.forEach((pr) => {
            ensureSpace(13);
            doc.setFont(fontFamily, 'bold');
            doc.setFontSize(10.4);
            doc.setTextColor(15, 23, 42);
            const head = [pr.name.trim(), pr.roleOrContext.trim()].filter(Boolean).join(' — ');
            doc.text(head || 'Project', margin, y);
            y += 4.3;
            if (pr.tools.trim()) {
              doc.setFont(fontFamily, 'italic');
              doc.setFontSize(9.5);
              doc.setTextColor(71, 85, 105);
              const tLines = doc.splitTextToSize(`Tools: ${pr.tools.trim()}`, contentWidth);
              doc.text(tLines, margin, y);
              y += tLines.length * 4.1;
            }
            if (pr.outcome.trim()) renderBullets(splitBullets(pr.outcome));
            y += 1.5;
          });
        } else if (id === 'education' && data.education.length > 0) {
          drawSectionHeading(label);
          data.education.forEach((ed) => {
            ensureSpace(13);
            doc.setFont(fontFamily, 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(15, 23, 42);
            const deg = [ed.degree.trim(), ed.institution.trim()].filter(Boolean).join(' — ');
            const yr = [ed.startYear.trim(), ed.endYear.trim()].filter(Boolean).join(' – ');
            doc.text(deg || 'Degree', margin, y);
            if (yr) {
              doc.setFont(fontFamily, 'normal');
              doc.setFontSize(9.6);
              doc.setTextColor(71, 85, 105);
              doc.text(yr, margin + contentWidth - doc.getTextWidth(yr), y);
            }
            y += 4.3;
            const sub = [ed.location.trim(), ed.gradeOrGpa.trim()].filter(Boolean).join('  |  ');
            if (sub) {
              doc.setFont(fontFamily, 'italic');
              doc.setFontSize(9.5);
              doc.setTextColor(71, 85, 105);
              doc.text(sub, margin, y);
              y += 4.1;
            }
            if (ed.highlights.trim()) renderBullets(splitBullets(ed.highlights));
            y += 1.5;
          });
        } else if (id === 'skills' && data.skillsText.trim()) {
          drawSectionHeading(label);
          splitBullets(data.skillsText).forEach((line) => drawJustifiedOrLeftParagraph(line, 10));
        } else if (id === 'certifications' && data.certifications.length > 0) {
          drawSectionHeading(label);
          data.certifications.forEach((cert) => {
            const line = `• ${cert.name.trim()}${cert.issuer.trim() ? ` — ${cert.issuer.trim()}` : ''}${
              cert.year.trim() ? ` (${cert.year.trim()})` : ''
            }${cert.credentialId.trim() ? ` [ID: ${cert.credentialId.trim()}]` : ''}`;
            drawJustifiedOrLeftParagraph(line, 9.8, 2);
          });
        } else if (id === 'languages' && data.languages.length > 0) {
          drawSectionHeading(label);
          const langStr = data.languages
            .map((l) => `${l.language.trim()}${l.proficiency.trim() ? ` (${l.proficiency.trim()})` : ''}`)
            .filter(Boolean)
            .join('  •  ');
          if (langStr) drawJustifiedOrLeftParagraph(langStr, 10);
        } else if (id === 'referees' && (data.refereesAvailableOnRequest || data.referees.length > 0)) {
          drawSectionHeading(label);
          if (data.refereesAvailableOnRequest && data.referees.length === 0) {
            drawJustifiedOrLeftParagraph('Available upon request.', 10);
          } else {
            data.referees.forEach((r) => {
              const info = [r.name.trim(), r.titleAndOrg.trim(), r.email.trim(), r.phone.trim()]
                .filter(Boolean)
                .join('  |  ');
              drawJustifiedOrLeftParagraph(`• ${info}`, 9.8, 2);
            });
          }
        }
        break;
      }

      case 'Academic Resume': {
        if (id === 'interests' && (data.researchInterests.trim() || data.professionalSummary.trim())) {
          drawSectionHeading(label);
          splitParagraphs(data.researchInterests || data.professionalSummary).forEach((p) =>
            drawJustifiedOrLeftParagraph(p, 10.4)
          );
        } else if (id === 'education' && data.education.length > 0) {
          drawSectionHeading(label);
          data.education.forEach((ed) => {
            ensureSpace(13);
            doc.setFont(fontFamily, 'bold');
            doc.setFontSize(10.6);
            doc.setTextColor(15, 23, 42);
            doc.text([ed.degree.trim(), ed.institution.trim()].filter(Boolean).join(', '), margin, y);
            const yr = [ed.startYear.trim(), ed.endYear.trim()].filter(Boolean).join(' – ');
            if (yr) {
              doc.setFont(fontFamily, 'italic');
              doc.setFontSize(9.8);
              doc.text(yr, margin + contentWidth - doc.getTextWidth(yr), y);
            }
            y += 4.4;
            const sub = [ed.location.trim(), ed.gradeOrGpa.trim()].filter(Boolean).join('  |  ');
            if (sub) {
              doc.setFont(fontFamily, 'italic');
              doc.setFontSize(9.8);
              doc.setTextColor(51, 65, 85);
              doc.text(sub, margin, y);
              y += 4.2;
            }
            if (ed.highlights.trim()) renderBullets(splitBullets(ed.highlights));
            y += 1.5;
          });
        } else if (id === 'appointments' && data.experience.length > 0) {
          drawSectionHeading(label);
          data.experience.forEach((exp) => {
            ensureSpace(14);
            doc.setFont(fontFamily, 'bold');
            doc.setFontSize(10.6);
            doc.setTextColor(15, 23, 42);
            doc.text([exp.role.trim(), exp.organization.trim()].filter(Boolean).join(' — '), margin, y);
            const dr = [exp.startDate.trim(), exp.isCurrent ? 'Present' : exp.endDate.trim()]
              .filter(Boolean)
              .join(' – ');
            if (dr) {
              doc.setFont(fontFamily, 'italic');
              doc.setFontSize(9.8);
              doc.text(dr, margin + contentWidth - doc.getTextWidth(dr), y);
            }
            y += 4.4;
            if (exp.bullets.trim()) renderBullets(splitBullets(exp.bullets));
            y += 1.5;
          });
        } else if (id === 'publications' && data.publications.length > 0) {
          drawSectionHeading(label);
          data.publications.forEach((pub, idx) => {
            const citation = `${idx + 1}. ${pub.authors.trim() ? `${pub.authors.trim()} ` : ''}${
              pub.year.trim() ? `(${pub.year.trim()}). ` : ''
            }"${pub.title.trim()}." ${pub.venue.trim()}${
              pub.doiOrUrl.trim() ? ` (${pub.doiOrUrl.trim()})` : ''
            }`;
            drawJustifiedOrLeftParagraph(citation, 10, 3);
          });
        } else if (id === 'grants' && data.grantsAndAwards.trim()) {
          drawSectionHeading(label);
          renderBullets(splitBullets(data.grantsAndAwards));
        } else if (id === 'service' && (data.academicService.trim() || data.skillsText.trim())) {
          drawSectionHeading(label);
          if (data.academicService.trim()) renderBullets(splitBullets(data.academicService));
          if (data.skillsText.trim()) drawJustifiedOrLeftParagraph(`Technical Tools: ${data.skillsText.trim()}`, 10);
        } else if (id === 'referees' && (data.refereesAvailableOnRequest || data.referees.length > 0)) {
          drawSectionHeading(label);
          if (data.refereesAvailableOnRequest && data.referees.length === 0) {
            drawJustifiedOrLeftParagraph('Available upon request.', 10);
          } else {
            data.referees.forEach((r) => {
              drawJustifiedOrLeftParagraph(
                `• ${[r.name.trim(), r.titleAndOrg.trim(), r.email.trim(), r.phone.trim()]
                  .filter(Boolean)
                  .join('  |  ')}`,
                10,
                2
              );
            });
          }
        }
        break;
      }

      case 'Statement of Purpose (SOP)': {
        const map: Record<string, string> = {
          intro: data.secIntro,
          academic: data.secAcademic,
          experience: data.secExperience,
          fit: data.secFit,
          goals: data.secGoals,
          closing: data.secClosing,
        };
        const txt = map[id] || '';
        if (txt.trim()) {
          drawSectionHeading(label);
          splitParagraphs(txt).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.6));
        }
        break;
      }

      case 'Personal Statement': {
        const map: Record<string, string> = {
          origin: data.secPersonalOrigin,
          milestones: data.secPersonalMilestones,
          leadership: data.secPersonalLeadership,
          alignment: data.secPersonalAlignment,
        };
        const txt = map[id] || '';
        if (txt.trim()) {
          drawSectionHeading(label);
          splitParagraphs(txt).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.6));
        }
        break;
      }

      case 'Scholarship Motivation Letter': {
        const map: Record<string, string> = {
          opening: data.secLetterOpening,
          merit: data.secLetterMerit,
          impact: data.secLetterImpact,
          readiness: data.secLetterReadiness,
        };
        const txt = map[id] || '';
        if (txt.trim()) {
          splitParagraphs(txt).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.6));
        }
        break;
      }

      case 'Research Proposal': {
        if (id === 'abstract' && data.secAbstract.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secAbstract).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.4));
        } else if (id === 'background' && data.secBackground.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secBackground).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.4));
        } else if (id === 'literature' && data.secLiteratureGap.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secLiteratureGap).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.4));
        } else if (id === 'objectives' && data.researchObjectivesList.trim()) {
          drawSectionHeading(label);
          renderBullets(splitBullets(data.researchObjectivesList));
        } else if (id === 'methodology' && data.secMethodology.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secMethodology).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.4));
        } else if (id === 'outcomes' && data.secExpectedOutcomes.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secExpectedOutcomes).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.4));
        } else if (id === 'timeline' && data.milestones.length > 0) {
          drawSectionHeading(label);
          data.milestones.forEach((m) => {
            drawJustifiedOrLeftParagraph(
              `• ${m.phase.trim()}${m.duration.trim() ? ` (${m.duration.trim()})` : ''}: ${m.deliverable.trim()}`,
              10.2,
              2
            );
          });
        } else if (id === 'references' && data.referencesList.trim()) {
          drawSectionHeading(label);
          splitBullets(data.referencesList).forEach((ref, i) =>
            drawJustifiedOrLeftParagraph(`[${i + 1}] ${ref}`, 9.8, 2)
          );
        }
        break;
      }

      case 'Study Plan': {
        if (id === 'background' && data.secStudyBackground.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secStudyBackground).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.5));
        } else if (id === 'hostFit' && data.secHostUniversityRationale.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secHostUniversityRationale).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.5));
        } else if (id === 'schedule' && data.studySchedule.length > 0) {
          drawSectionHeading(label);
          data.studySchedule.forEach((m) => {
            drawJustifiedOrLeftParagraph(
              `• ${m.phase.trim()}${m.duration.trim() ? ` [${m.duration.trim()}]` : ''}: ${m.deliverable.trim()}`,
              10.2,
              2
            );
          });
        } else if (id === 'adaptation' && data.secLanguageAdaptation.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secLanguageAdaptation).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.5));
        } else if (id === 'careerReturn' && data.secPostGradPlan.trim()) {
          drawSectionHeading(label);
          splitParagraphs(data.secPostGradPlan).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.5));
        }
        break;
      }
    }
  });

  // Append custom user sections
  if (data.customSections && data.customSections.length > 0) {
    data.customSections.forEach((cs) => {
      if (!cs.heading.trim() || !cs.content.trim()) return;
      drawSectionHeading(cs.heading.trim());
      splitParagraphs(cs.content).forEach((p) => drawJustifiedOrLeftParagraph(p, 10.3));
    });
  }

  // Signature Sign-off for Letter / Statements
  if (
    category === 'Scholarship Motivation Letter' ||
    category === 'Statement of Purpose (SOP)' ||
    category === 'Personal Statement' ||
    category === 'Study Plan'
  ) {
    ensureSpace(16);
    y += 4;
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(category === 'Scholarship Motivation Letter' ? 'Sincerely,' : 'Respectfully submitted,', margin, y);
    y += 6;
    doc.setFont(fontFamily, 'bold');
    doc.text(data.fullName.trim() || 'Applicant Name', margin, y);
  }

  // Page footer on all pages (omit clutter on 1-page strict ATS resume if desired, keep clean numbering on multi-page)
  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1 || !isStrictAts) {
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const leftFooter = `${data.fullName.trim() || category}  —  ${category}`;
      const rightFooter = `Page ${p} of ${totalPages}`;
      doc.text(leftFooter, margin, pageHeight - 9);
      doc.text(rightFooter, margin + contentWidth - doc.getTextWidth(rightFooter), pageHeight - 9);
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const fileName = sanitizeFilename(resolveDocumentTitle(category, data), 'pdf');
  return { arrayBuffer, blob, fileName };
}

export function downloadCareerStudioPdf(
  category: CareerStudioCategory,
  data: CareerStudioFormData,
  customization?: CareerSectionCustomization
): { arrayBuffer: ArrayBuffer; blob: Blob; fileName: string } {
  const res = buildCareerStudioPdfBytes(category, data, customization);
  const url = URL.createObjectURL(res.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return res;
}

// ============================================================================
// 2. CATEGORY-TAILORED DOCX GENERATOR (VALID OOXML ARCHIVE VIA JSZIP)
// ============================================================================

function xmlEscape(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDocxParagraphXml(p: DocxParagraph, isStrictAts: boolean): string {
  const align = p.align || (p.style === 'Normal' && !isStrictAts ? 'both' : 'left');
  const jc = `<w:jc w:val="${align}"/>`;
  const spacingAfter = p.spaceAfter ?? (p.style === 'Heading1' ? 80 : p.style === 'Bullet' ? 60 : 120);
  const spacingBefore = p.spaceBefore ?? (p.style === 'Heading1' ? 180 : 0);

  let sz = 21; // 10.5pt in half-points
  let bold = Boolean(p.bold);
  let italic = Boolean(p.italic);
  let color = '0F172A';

  if (p.style === 'Title') {
    sz = 32;
    bold = true;
  } else if (p.style === 'Subtitle') {
    sz = 22;
    italic = !isStrictAts;
    color = '334155';
  } else if (p.style === 'Heading1') {
    sz = 23;
    bold = true;
  } else if (p.style === 'Heading2') {
    sz = 21;
    bold = true;
  } else if (p.style === 'Meta') {
    sz = 19;
    color = '475569';
  } else if (p.style === 'Bullet') {
    sz = 20;
    color = '1E293B';
  }

  const pBdr = p.bottomBorder
    ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="475569"/></w:pBdr>`
    : '';
  const ind = p.style === 'Bullet' ? `<w:ind w:left="320" w:hanging="160"/>` : '';
  const fontName = isStrictAts ? 'Calibri' : 'Times New Roman';

  const rPr = [
    `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>`,
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`,
    `<w:color w:val="${color}"/>`,
    bold ? '<w:b/>' : '',
    italic ? '<w:i/>' : '',
  ]
    .filter(Boolean)
    .join('');

  return `<w:p><w:pPr>${pBdr}${ind}<w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="264" w:lineRule="auto"/>${jc}</w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${xmlEscape(p.text)}</w:t></w:r></w:p>`;
}

export async function buildCareerStudioDocxBlob(
  category: CareerStudioCategory,
  data: CareerStudioFormData,
  customization?: CareerSectionCustomization
): Promise<{ blob: Blob; fileName: string }> {
  const meta = CAREER_CATEGORY_META[category];
  const sections = getOrderedVisibleSections(category, customization);
  const isStrictAts = meta.atsCompliant && (category === 'International CV' || category === 'Job Resume');
  const paragraphs: DocxParagraph[] = [];

  const contactParts = [
    data.email.trim(),
    data.phone.trim(),
    data.location.trim(),
    data.websiteOrLink.trim(),
    data.workAuthorization.trim(),
  ].filter(Boolean);

  if (meta.layoutStyle === 'ats' || category === 'Academic Resume') {
    paragraphs.push({
      text: (data.fullName.trim() || 'CANDIDATE NAME').toUpperCase(),
      style: 'Title',
      spaceAfter: 40,
    });
    if (data.headlineOrTargetRole.trim() || data.academicAffiliation.trim()) {
      paragraphs.push({
        text: [data.headlineOrTargetRole.trim(), data.academicAffiliation.trim()].filter(Boolean).join(' — '),
        style: 'Subtitle',
        spaceAfter: 40,
      });
    }
    if (contactParts.length > 0) {
      paragraphs.push({
        text: contactParts.join('  |  '),
        style: 'Meta',
        bottomBorder: true,
        spaceAfter: 120,
      });
    }
  } else if (category === 'Scholarship Motivation Letter') {
    paragraphs.push({ text: data.fullName.trim() || 'Applicant Name', style: 'Heading2', spaceAfter: 30 });
    contactParts.forEach((c) => paragraphs.push({ text: c, style: 'Meta', spaceAfter: 20 }));
    if (data.documentDate.trim()) {
      paragraphs.push({ text: data.documentDate.trim(), style: 'Normal', spaceBefore: 120, spaceAfter: 120 });
    }
    [
      'Scholarship Selection Committee',
      data.awardingBody.trim(),
      data.targetInstitution.trim(),
      data.hostCountry.trim(),
    ]
      .filter(Boolean)
      .forEach((l) => paragraphs.push({ text: l, style: 'Normal', spaceAfter: 20 }));
    paragraphs.push({
      text: `SUBJECT: APPLICATION FOR ${(data.scholarshipName.trim() || 'SCHOLARSHIP FELLOWSHIP').toUpperCase()}${
        data.targetProgram.trim() ? ` — ${data.targetProgram.trim().toUpperCase()}` : ''
      }`,
      style: 'Heading2',
      spaceBefore: 140,
      spaceAfter: 120,
    });
    paragraphs.push({
      text: data.recipientSalutation.trim() || 'Dear Selection Committee,',
      style: 'Normal',
      spaceAfter: 120,
    });
  } else {
    paragraphs.push({
      text: resolveDocumentTitle(category, data),
      style: 'Title',
      spaceAfter: 60,
    });
    if (data.fullName.trim()) {
      paragraphs.push({
        text: `Applicant: ${data.fullName.trim()}${
          contactParts.length ? `  |  ${contactParts.join('  |  ')}` : ''
        }`,
        style: 'Meta',
        spaceAfter: 40,
      });
    }
    const subMeta = [
      data.targetProgram.trim() || data.proposedDegreeLevel.trim(),
      data.targetDepartment.trim(),
      data.targetInstitution.trim(),
      data.hostCountry.trim(),
      data.applicationTerm.trim() || data.studyDuration.trim(),
      data.targetSupervisor.trim() ? `Supervisor: ${data.targetSupervisor.trim()}` : '',
      data.documentDate.trim(),
    ].filter(Boolean);
    if (subMeta.length > 0) {
      paragraphs.push({
        text: subMeta.join('  |  '),
        style: 'Meta',
        bottomBorder: true,
        spaceAfter: 120,
      });
    }
  }

  const pushHeading = (label: string) => {
    paragraphs.push({
      text: label.toUpperCase(),
      style: 'Heading1',
      bottomBorder: true,
      spaceBefore: 180,
      spaceAfter: 80,
    });
  };

  sections.forEach(({ id, label }) => {
    if (category === 'International CV' || category === 'Job Resume') {
      if (id === 'summary' && data.professionalSummary.trim()) {
        pushHeading(label);
        splitParagraphs(data.professionalSummary).forEach((p) =>
          paragraphs.push({ text: p, style: 'Normal', align: isStrictAts ? 'left' : 'both' })
        );
      } else if (id === 'experience' && data.experience.length > 0) {
        pushHeading(label);
        data.experience.forEach((exp) => {
          const dr = [exp.startDate.trim(), exp.isCurrent ? 'Present' : exp.endDate.trim()]
            .filter(Boolean)
            .join(' – ');
          paragraphs.push({
            text: `${[exp.role.trim(), exp.organization.trim()].filter(Boolean).join(' — ')}${
              dr ? ` (${dr})` : ''
            }`,
            style: 'Heading2',
            spaceAfter: 30,
          });
          if (exp.location.trim()) {
            paragraphs.push({ text: exp.location.trim(), style: 'Meta', italic: true, spaceAfter: 40 });
          }
          splitBullets(exp.bullets).forEach((b) =>
            paragraphs.push({ text: `• ${b}`, style: 'Bullet', align: 'left' })
          );
        });
      } else if (id === 'projects' && data.projects.length > 0) {
        pushHeading(label);
        data.projects.forEach((pr) => {
          paragraphs.push({
            text: [pr.name.trim(), pr.roleOrContext.trim()].filter(Boolean).join(' — '),
            style: 'Heading2',
            spaceAfter: 30,
          });
          if (pr.tools.trim()) {
            paragraphs.push({ text: `Tools: ${pr.tools.trim()}`, style: 'Meta', italic: true, spaceAfter: 30 });
          }
          splitBullets(pr.outcome).forEach((b) =>
            paragraphs.push({ text: `• ${b}`, style: 'Bullet', align: 'left' })
          );
        });
      } else if (id === 'education' && data.education.length > 0) {
        pushHeading(label);
        data.education.forEach((ed) => {
          const yr = [ed.startYear.trim(), ed.endYear.trim()].filter(Boolean).join(' – ');
          paragraphs.push({
            text: `${[ed.degree.trim(), ed.institution.trim()].filter(Boolean).join(' — ')}${
              yr ? ` (${yr})` : ''
            }`,
            style: 'Heading2',
            spaceAfter: 30,
          });
          const sub = [ed.location.trim(), ed.gradeOrGpa.trim()].filter(Boolean).join('  |  ');
          if (sub) paragraphs.push({ text: sub, style: 'Meta', spaceAfter: 40 });
          splitBullets(ed.highlights).forEach((b) =>
            paragraphs.push({ text: `• ${b}`, style: 'Bullet', align: 'left' })
          );
        });
      } else if (id === 'skills' && data.skillsText.trim()) {
        pushHeading(label);
        splitBullets(data.skillsText).forEach((s) =>
          paragraphs.push({ text: s, style: 'Normal', align: 'left', spaceAfter: 60 })
        );
      } else if (id === 'certifications' && data.certifications.length > 0) {
        pushHeading(label);
        data.certifications.forEach((c) => {
          paragraphs.push({
            text: `• ${c.name.trim()}${c.issuer.trim() ? ` — ${c.issuer.trim()}` : ''}${
              c.year.trim() ? ` (${c.year.trim()})` : ''
            }`,
            style: 'Bullet',
          });
        });
      } else if (id === 'languages' && data.languages.length > 0) {
        pushHeading(label);
        paragraphs.push({
          text: data.languages
            .map((l) => `${l.language.trim()}${l.proficiency.trim() ? ` (${l.proficiency.trim()})` : ''}`)
            .join('  •  '),
          style: 'Normal',
          align: 'left',
        });
      } else if (id === 'referees' && (data.refereesAvailableOnRequest || data.referees.length > 0)) {
        pushHeading(label);
        if (data.refereesAvailableOnRequest && data.referees.length === 0) {
          paragraphs.push({ text: 'Available upon request.', style: 'Normal', align: 'left' });
        } else {
          data.referees.forEach((r) =>
            paragraphs.push({
              text: `• ${[r.name.trim(), r.titleAndOrg.trim(), r.email.trim(), r.phone.trim()]
                .filter(Boolean)
                .join('  |  ')}`,
              style: 'Bullet',
            })
          );
        }
      }
    } else if (category === 'Academic Resume') {
      if (id === 'interests' && (data.researchInterests.trim() || data.professionalSummary.trim())) {
        pushHeading(label);
        splitParagraphs(data.researchInterests || data.professionalSummary).forEach((p) =>
          paragraphs.push({ text: p, style: 'Normal', align: 'both' })
        );
      } else if (id === 'education' && data.education.length > 0) {
        pushHeading(label);
        data.education.forEach((ed) => {
          const yr = [ed.startYear.trim(), ed.endYear.trim()].filter(Boolean).join(' – ');
          paragraphs.push({
            text: `${[ed.degree.trim(), ed.institution.trim()].filter(Boolean).join(', ')}${
              yr ? ` (${yr})` : ''
            }`,
            style: 'Heading2',
            spaceAfter: 30,
          });
          if (ed.highlights.trim()) {
            splitBullets(ed.highlights).forEach((b) => paragraphs.push({ text: `• ${b}`, style: 'Bullet' }));
          }
        });
      } else if (id === 'appointments' && data.experience.length > 0) {
        pushHeading(label);
        data.experience.forEach((exp) => {
          const dr = [exp.startDate.trim(), exp.isCurrent ? 'Present' : exp.endDate.trim()]
            .filter(Boolean)
            .join(' – ');
          paragraphs.push({
            text: `${[exp.role.trim(), exp.organization.trim()].filter(Boolean).join(' — ')}${
              dr ? ` (${dr})` : ''
            }`,
            style: 'Heading2',
            spaceAfter: 30,
          });
          splitBullets(exp.bullets).forEach((b) => paragraphs.push({ text: `• ${b}`, style: 'Bullet' }));
        });
      } else if (id === 'publications' && data.publications.length > 0) {
        pushHeading(label);
        data.publications.forEach((pub, idx) =>
          paragraphs.push({
            text: `${idx + 1}. ${pub.authors.trim()} (${pub.year.trim()}). "${pub.title.trim()}." ${pub.venue.trim()}${
              pub.doiOrUrl.trim() ? ` [${pub.doiOrUrl.trim()}]` : ''
            }`,
            style: 'Normal',
            align: 'both',
          })
        );
      } else if (id === 'grants' && data.grantsAndAwards.trim()) {
        pushHeading(label);
        splitBullets(data.grantsAndAwards).forEach((b) => paragraphs.push({ text: `• ${b}`, style: 'Bullet' }));
      } else if (id === 'service' && (data.academicService.trim() || data.skillsText.trim())) {
        pushHeading(label);
        splitBullets(data.academicService).forEach((b) => paragraphs.push({ text: `• ${b}`, style: 'Bullet' }));
        if (data.skillsText.trim()) {
          paragraphs.push({ text: `Technical Tools: ${data.skillsText.trim()}`, style: 'Normal' });
        }
      } else if (id === 'referees' && (data.refereesAvailableOnRequest || data.referees.length > 0)) {
        pushHeading(label);
        if (data.refereesAvailableOnRequest && data.referees.length === 0) {
          paragraphs.push({ text: 'Available upon request.', style: 'Normal' });
        } else {
          data.referees.forEach((r) =>
            paragraphs.push({
              text: `• ${[r.name.trim(), r.titleAndOrg.trim(), r.email.trim(), r.phone.trim()]
                .filter(Boolean)
                .join('  |  ')}`,
              style: 'Bullet',
            })
          );
        }
      }
    } else if (category === 'Statement of Purpose (SOP)') {
      const map: Record<string, string> = {
        intro: data.secIntro,
        academic: data.secAcademic,
        experience: data.secExperience,
        fit: data.secFit,
        goals: data.secGoals,
        closing: data.secClosing,
      };
      if ((map[id] || '').trim()) {
        pushHeading(label);
        splitParagraphs(map[id]).forEach((p) => paragraphs.push({ text: p, style: 'Normal', align: 'both' }));
      }
    } else if (category === 'Personal Statement') {
      const map: Record<string, string> = {
        origin: data.secPersonalOrigin,
        milestones: data.secPersonalMilestones,
        leadership: data.secPersonalLeadership,
        alignment: data.secPersonalAlignment,
      };
      if ((map[id] || '').trim()) {
        pushHeading(label);
        splitParagraphs(map[id]).forEach((p) => paragraphs.push({ text: p, style: 'Normal', align: 'both' }));
      }
    } else if (category === 'Scholarship Motivation Letter') {
      const map: Record<string, string> = {
        opening: data.secLetterOpening,
        merit: data.secLetterMerit,
        impact: data.secLetterImpact,
        readiness: data.secLetterReadiness,
      };
      if ((map[id] || '').trim()) {
        splitParagraphs(map[id]).forEach((p) => paragraphs.push({ text: p, style: 'Normal', align: 'both' }));
      }
    } else if (category === 'Research Proposal') {
      if (id === 'abstract' && data.secAbstract.trim()) {
        pushHeading(label);
        splitParagraphs(data.secAbstract).forEach((p) => paragraphs.push({ text: p, style: 'Normal', align: 'both' }));
      } else if (id === 'background' && data.secBackground.trim()) {
        pushHeading(label);
        splitParagraphs(data.secBackground).forEach((p) => paragraphs.push({ text: p, style: 'Normal', align: 'both' }));
      } else if (id === 'literature' && data.secLiteratureGap.trim()) {
        pushHeading(label);
        splitParagraphs(data.secLiteratureGap).forEach((p) => paragraphs.push({ text: p, style: 'Normal', align: 'both' }));
      } else if (id === 'objectives' && data.researchObjectivesList.trim()) {
        pushHeading(label);
        splitBullets(data.researchObjectivesList).forEach((b) =>
          paragraphs.push({ text: `• ${b}`, style: 'Bullet' })
        );
      } else if (id === 'methodology' && data.secMethodology.trim()) {
        pushHeading(label);
        splitParagraphs(data.secMethodology).forEach((p) => paragraphs.push({ text: p, style: 'Normal', align: 'both' }));
      } else if (id === 'outcomes' && data.secExpectedOutcomes.trim()) {
        pushHeading(label);
        splitParagraphs(data.secExpectedOutcomes).forEach((p) =>
          paragraphs.push({ text: p, style: 'Normal', align: 'both' })
        );
      } else if (id === 'timeline' && data.milestones.length > 0) {
        pushHeading(label);
        data.milestones.forEach((m) =>
          paragraphs.push({
            text: `• ${m.phase.trim()}${m.duration.trim() ? ` (${m.duration.trim()})` : ''}: ${m.deliverable.trim()}`,
            style: 'Bullet',
          })
        );
      } else if (id === 'references' && data.referencesList.trim()) {
        pushHeading(label);
        splitBullets(data.referencesList).forEach((ref, i) =>
          paragraphs.push({ text: `[${i + 1}] ${ref}`, style: 'Normal', align: 'left', spaceAfter: 60 })
        );
      }
    } else if (category === 'Study Plan') {
      if (id === 'background' && data.secStudyBackground.trim()) {
        pushHeading(label);
        splitParagraphs(data.secStudyBackground).forEach((p) =>
          paragraphs.push({ text: p, style: 'Normal', align: 'both' })
        );
      } else if (id === 'hostFit' && data.secHostUniversityRationale.trim()) {
        pushHeading(label);
        splitParagraphs(data.secHostUniversityRationale).forEach((p) =>
          paragraphs.push({ text: p, style: 'Normal', align: 'both' })
        );
      } else if (id === 'schedule' && data.studySchedule.length > 0) {
        pushHeading(label);
        data.studySchedule.forEach((m) =>
          paragraphs.push({
            text: `• ${m.phase.trim()}${m.duration.trim() ? ` [${m.duration.trim()}]` : ''}: ${m.deliverable.trim()}`,
            style: 'Bullet',
          })
        );
      } else if (id === 'adaptation' && data.secLanguageAdaptation.trim()) {
        pushHeading(label);
        splitParagraphs(data.secLanguageAdaptation).forEach((p) =>
          paragraphs.push({ text: p, style: 'Normal', align: 'both' })
        );
      } else if (id === 'careerReturn' && data.secPostGradPlan.trim()) {
        pushHeading(label);
        splitParagraphs(data.secPostGradPlan).forEach((p) =>
          paragraphs.push({ text: p, style: 'Normal', align: 'both' })
        );
      }
    }
  });

  if (data.customSections && data.customSections.length > 0) {
    data.customSections.forEach((cs) => {
      if (!cs.heading.trim() || !cs.content.trim()) return;
      pushHeading(cs.heading.trim());
      splitParagraphs(cs.content).forEach((p) => paragraphs.push({ text: p, style: 'Normal' }));
    });
  }

  if (
    category === 'Scholarship Motivation Letter' ||
    category === 'Statement of Purpose (SOP)' ||
    category === 'Personal Statement' ||
    category === 'Study Plan'
  ) {
    paragraphs.push({
      text: category === 'Scholarship Motivation Letter' ? 'Sincerely,' : 'Respectfully submitted,',
      style: 'Normal',
      align: 'left',
      spaceBefore: 160,
      spaceAfter: 80,
    });
    paragraphs.push({
      text: data.fullName.trim() || 'Applicant Name',
      style: 'Heading2',
      align: 'left',
    });
  }

  const bodyXml = paragraphs.map((p) => buildDocxParagraphXml(p, isStrictAts)).join('');

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
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

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const fileName = sanitizeFilename(resolveDocumentTitle(category, data), 'docx');
  return { blob, fileName };
}

export async function downloadCareerStudioDocx(
  category: CareerStudioCategory,
  data: CareerStudioFormData,
  customization?: CareerSectionCustomization
): Promise<{ blob: Blob; fileName: string }> {
  const res = await buildCareerStudioDocxBlob(category, data, customization);
  const url = URL.createObjectURL(res.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = res.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return res;
}
