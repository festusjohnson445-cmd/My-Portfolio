import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import {
  DocumentFormPayload,
  extractDocumentTitle,
  getCategoryMeta,
} from '../types/documentWorkspace';

export type BlueprintAlign = 'left' | 'center' | 'right' | 'justify';

export interface BlueprintEntryItem {
  primaryLeft: string;
  primaryRight?: string;
  secondaryLeft?: string;
  secondaryRight?: string;
  bodyText?: string;
  bullets?: string[];
}

export type BlueprintBlock =
  | {
      kind: 'section-heading';
      title: string;
    }
  | {
      kind: 'paragraph';
      text: string;
      align?: BlueprintAlign;
      bold?: boolean;
      italic?: boolean;
      underlineRule?: boolean;
      spacingAfter?: number;
    }
  | {
      kind: 'labeled-line';
      label: string;
      value: string;
    }
  | {
      kind: 'bullet-list';
      items: string[];
    }
  | {
      kind: 'entries';
      items: BlueprintEntryItem[];
    }
  | {
      kind: 'table';
      columns: string[];
      colWidthsPct?: number[];
      rows: string[][];
    }
  | {
      kind: 'address-block';
      lines: string[];
      align?: 'left' | 'right';
    }
  | {
      kind: 'meta-grid';
      rows: Array<{ label: string; value: string }>;
    }
  | {
      kind: 'signature';
      signOff: string;
      name: string;
      subline?: string;
    };

export interface DocumentBlueprint {
  category: DocumentFormPayload['category'];
  fontMode: 'serif';
  headerStyle:
    | 'ats-centered'
    | 'ats-left'
    | 'academic-essay'
    | 'formal-letter'
    | 'research-title'
    | 'study-plan';
  uppercaseHeaderSubtitle?: boolean;
  title: string;
  subtitle?: string;
  contactLine?: string;
  secondaryContactLine?: string;
  footerText?: string;
  blocks: BlueprintBlock[];
}

// Executive Navy & Petrol Teal palette inspired by classic international academic & professional CVs
const NAVY_RGB: [number, number, number] = [15, 43, 70]; // #0f2b46
const TEAL_RGB: [number, number, number] = [14, 98, 124]; // #0e627c
const SLATE_MUTED_RGB: [number, number, number] = [71, 85, 105]; // #475569
const BODY_DARK_RGB: [number, number, number] = [30, 41, 59]; // #1e293b
const FOOTER_TEXT_RGB: [number, number, number] = [100, 116, 139]; // #64748b
const FOOTER_RULE_RGB: [number, number, number] = [203, 213, 225]; // #cbd5e1

const cleanLines = (raw?: string | null): string[] =>
  (raw || '')
    .split(/\r?\n/)
    .map((s) => s.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

const joinNonEmpty = (parts: Array<string | undefined | null>, sep = '  |  '): string =>
  parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(sep);

const splitEssayParagraphs = (raw?: string | null): string[] =>
  (raw || '')
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

const makeFooterStamp = (
  ownerName: string | undefined | null,
  cat: DocumentFormPayload['category']
): string => {
  const catLabel = getCategoryMeta(cat).label.toUpperCase();
  const cleanName = (ownerName || '').trim().toUpperCase();
  return cleanName ? `${cleanName}  |  ${catLabel}` : catLabel;
};

const pushSkillLines = (blocks: BlueprintBlock[], raw: string | undefined) => {
  const lines = (raw || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return;
  for (const ln of lines) {
    const colonIdx = ln.indexOf(':');
    if (colonIdx > 1 && colonIdx < 48) {
      const label = ln.slice(0, colonIdx).trim();
      const val = ln.slice(colonIdx + 1).trim();
      if (label && val) {
        blocks.push({ kind: 'labeled-line', label, value: val });
        continue;
      }
    }
    blocks.push({ kind: 'paragraph', text: ln, align: 'left', spacingAfter: 1.5 });
  }
};

const t = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const buildDocumentBlueprint = (payload: DocumentFormPayload): DocumentBlueprint => {
  switch (payload.category) {
    case 'international_cv': {
      const d = payload.data;
      const hdr = (d.header || {}) as any;
      const blocks: BlueprintBlock[] = [];

      if (t(d.professionalSummary)) {
        blocks.push({ kind: 'section-heading', title: 'PROFESSIONAL PROFILE' });
        blocks.push({
          kind: 'paragraph',
          text: t(d.professionalSummary),
          align: 'justify',
        });
      }

      if (t(d.coreCompetencies)) {
        blocks.push({ kind: 'section-heading', title: 'CORE COMPETENCIES' });
        blocks.push({
          kind: 'paragraph',
          text: t(d.coreCompetencies),
          align: 'left',
        });
      }

      if (t(d.technicalAndDigitalSkills)) {
        blocks.push({ kind: 'section-heading', title: 'TECHNICAL & DIGITAL SKILLS' });
        pushSkillLines(blocks, d.technicalAndDigitalSkills);
      }

      const validExps = (d.experiences || []).filter(
        (e) => e && (t(e.roleTitle) || t(e.organization) || t(e.highlights))
      );
      if (validExps.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validExps.map((e) => ({
            primaryLeft: t(e.roleTitle) || 'Role Title',
            primaryRight: joinNonEmpty([e.startDate, e.endDate], ' – '),
            secondaryLeft: joinNonEmpty([e.organization, e.location], ', '),
            bullets: cleanLines(e.highlights),
          })),
        });
      }

      const validLeadership = (d.leadershipRoles || []).filter(
        (l) => l && (t(l.roleTitle) || t(l.organization) || t(l.highlights))
      );
      if (validLeadership.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'LEADERSHIP' });
        blocks.push({
          kind: 'entries',
          items: validLeadership.map((l) => ({
            primaryLeft: t(l.roleTitle) || 'Leadership Role',
            primaryRight: joinNonEmpty([l.startDate, l.endDate], ' – '),
            secondaryLeft: joinNonEmpty([l.organization, l.location], ', '),
            bullets: cleanLines(l.highlights),
          })),
        });
      }

      const validProjects = (d.selectedProjects || []).filter(
        (p) => p && (t(p.name) || t(p.impactBullets))
      );
      if (validProjects.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'SELECTED PROJECTS' });
        blocks.push({
          kind: 'entries',
          items: validProjects.map((p) => ({
            primaryLeft: t(p.name) || 'Project',
            primaryRight: t(p.period) || undefined,
            secondaryLeft: t(p.roleOrContext) || undefined,
            bullets: cleanLines(p.impactBullets),
          })),
        });
      }

      const validEdu = (d.education || []).filter((e) => e && (t(e.degree) || t(e.institution)));
      if (validEdu.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EDUCATION' });
        blocks.push({
          kind: 'entries',
          items: validEdu.map((e) => ({
            primaryLeft: t(e.degree) || 'Academic Degree',
            primaryRight: joinNonEmpty([e.startYear, e.endYear], ' – '),
            secondaryLeft: joinNonEmpty([e.institution, e.location], ', '),
            secondaryRight: t(e.gpaOrHonors) || undefined,
            bodyText: t(e.thesisOrCoursework)
              ? `Thesis / Key Coursework: ${t(e.thesisOrCoursework)}`
              : undefined,
          })),
        });
      }

      const trainingItems = cleanLines(d.technicalTraining);
      if (trainingItems.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'TECHNICAL TRAINING & DEVELOPMENT' });
        blocks.push({ kind: 'bullet-list', items: trainingItems });
      }

      const validCerts = (d.certifications || []).filter((c) => c && t(c.name));
      if (validCerts.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'CERTIFICATIONS & LICENSES' });
        blocks.push({
          kind: 'bullet-list',
          items: validCerts.map((c) =>
            joinNonEmpty(
              [
                c.name,
                c.issuer,
                c.year,
                t(c.credentialId) ? `Credential ID: ${t(c.credentialId)}` : '',
              ],
              ' — '
            )
          ),
        });
      }

      const validLangs = (d.languages || []).filter((l) => l && t(l.language));
      if (validLangs.length > 0 || t(d.nationalityOrWorkAuth)) {
        blocks.push({ kind: 'section-heading', title: 'LANGUAGES & ELIGIBILITY' });
        if (validLangs.length > 0) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Languages',
            value: validLangs
              .map((l) =>
                t(l.proficiency) ? `${t(l.language)} (${t(l.proficiency)})` : t(l.language)
              )
              .join('  •  '),
          });
        }
        if (t(d.nationalityOrWorkAuth)) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Work Authorization / Mobility',
            value: t(d.nationalityOrWorkAuth),
          });
        }
      }

      if (t(d.professionalInterests)) {
        blocks.push({ kind: 'section-heading', title: 'PROFESSIONAL INTERESTS' });
        blocks.push({
          kind: 'paragraph',
          text: t(d.professionalInterests),
          align: 'left',
        });
      }

      const validRefs = (d.references || []).filter((r) => r && t(r.name));
      if (validRefs.length > 0 || t(d.referencesNote)) {
        blocks.push({ kind: 'section-heading', title: 'REFERENCES' });
        if (validRefs.length > 0) {
          blocks.push({
            kind: 'bullet-list',
            items: validRefs.map((r) =>
              joinNonEmpty([r.name, r.titleAndDepartment, r.institution, r.email], ' — ')
            ),
          });
        }
        if (t(d.referencesNote)) {
          blocks.push({
            kind: 'paragraph',
            text: t(d.referencesNote),
            align: 'left',
            italic: validRefs.length === 0,
          });
        }
      }

      const fullName = t(hdr.fullName) || 'APPLICANT NAME';
      const headline = t(hdr.headlineOrTargetRole);
      return {
        category: 'international_cv',
        fontMode: 'serif',
        headerStyle: 'ats-centered',
        uppercaseHeaderSubtitle: true,
        title: fullName.toUpperCase(),
        subtitle: headline ? headline.toUpperCase() : undefined,
        contactLine: joinNonEmpty([
          hdr.location,
          hdr.phone,
          hdr.email,
          hdr.linkedinOrPortfolio,
          d.orcidOrGithub,
        ]),
        footerText: makeFooterStamp(fullName, 'international_cv'),
        blocks,
      };
    }

    case 'academic_resume': {
      const d = payload.data;
      const hdr = (d.header || {}) as any;
      const blocks: BlueprintBlock[] = [];

      if (t(d.researchProfile) || t(d.researchInterests)) {
        blocks.push({ kind: 'section-heading', title: 'RESEARCH PROFILE & INTERESTS' });
        if (t(d.researchProfile)) {
          blocks.push({ kind: 'paragraph', text: t(d.researchProfile), align: 'justify' });
        }
        if (t(d.researchInterests)) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Research Areas',
            value: t(d.researchInterests),
          });
        }
      }

      const validEdu = (d.education || []).filter((e) => e && (t(e.degree) || t(e.institution)));
      if (validEdu.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EDUCATION & ACADEMIC TRAINING' });
        blocks.push({
          kind: 'entries',
          items: validEdu.map((e) => ({
            primaryLeft: t(e.degree) || 'Academic Degree',
            primaryRight: joinNonEmpty([e.startYear, e.endYear], ' – '),
            secondaryLeft: joinNonEmpty([e.institution, e.location], ', '),
            secondaryRight: t(e.gpaOrHonors) || undefined,
            bodyText: t(e.thesisOrCoursework)
              ? `Thesis / Focus: ${t(e.thesisOrCoursework)}`
              : undefined,
          })),
        });
      }

      const validRes = (d.researchAppointments || []).filter(
        (r) => r && (t(r.roleTitle) || t(r.organization) || t(r.highlights))
      );
      if (validRes.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'RESEARCH APPOINTMENTS & EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validRes.map((r) => ({
            primaryLeft: t(r.roleTitle) || 'Research Role',
            primaryRight: joinNonEmpty([r.startDate, r.endDate], ' – '),
            secondaryLeft: joinNonEmpty([r.organization, r.location], ', '),
            bullets: cleanLines(r.highlights),
          })),
        });
      }

      const validTeach = (d.teachingExperience || []).filter(
        (item) => item && (t(item.roleTitle) || t(item.organization) || t(item.highlights))
      );
      if (validTeach.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'TEACHING & MENTORSHIP EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validTeach.map((item) => ({
            primaryLeft: t(item.roleTitle) || 'Teaching Appointment',
            primaryRight: joinNonEmpty([item.startDate, item.endDate], ' – '),
            secondaryLeft: joinNonEmpty([item.organization, item.location], ', '),
            bullets: cleanLines(item.highlights),
          })),
        });
      }

      const validProfExp = (d.professionalExperience || []).filter(
        (e) => e && (t(e.roleTitle) || t(e.organization) || t(e.highlights))
      );
      if (validProfExp.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validProfExp.map((e) => ({
            primaryLeft: t(e.roleTitle) || 'Role Title',
            primaryRight: joinNonEmpty([e.startDate, e.endDate], ' – '),
            secondaryLeft: joinNonEmpty([e.organization, e.location], ', '),
            bullets: cleanLines(e.highlights),
          })),
        });
      }

      const validLead = (d.leadershipRoles || []).filter(
        (l) => l && (t(l.roleTitle) || t(l.organization) || t(l.highlights))
      );
      if (validLead.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'LEADERSHIP' });
        blocks.push({
          kind: 'entries',
          items: validLead.map((l) => ({
            primaryLeft: t(l.roleTitle) || 'Leadership Role',
            primaryRight: joinNonEmpty([l.startDate, l.endDate], ' – '),
            secondaryLeft: joinNonEmpty([l.organization, l.location], ', '),
            bullets: cleanLines(l.highlights),
          })),
        });
      }

      const validAcadProjects = (d.selectedProjects || []).filter(
        (p) => p && (t(p.name) || t(p.impactBullets))
      );
      if (validAcadProjects.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'SELECTED PROJECTS' });
        blocks.push({
          kind: 'entries',
          items: validAcadProjects.map((p) => ({
            primaryLeft: t(p.name) || 'Project',
            primaryRight: t(p.period) || undefined,
            secondaryLeft: t(p.roleOrContext) || undefined,
            bullets: cleanLines(p.impactBullets),
          })),
        });
      }

      const validPubs = (d.publications || []).filter((p) => p && t(p.citation));
      if (validPubs.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'PUBLICATIONS & CONFERENCE PROCEEDINGS' });
        blocks.push({
          kind: 'bullet-list',
          items: validPubs.map((p, idx) =>
            `[${idx + 1}] ${joinNonEmpty(
              [p.citation, p.venueOrJournal, p.year, p.doiOrUrl],
              '. '
            )}`
          ),
        });
      }

      if (t(d.grantsAndAwards)) {
        blocks.push({ kind: 'section-heading', title: 'GRANTS, FELLOWSHIPS & HONORS' });
        blocks.push({ kind: 'bullet-list', items: cleanLines(d.grantsAndAwards) });
      }

      if (t(d.technicalMethods)) {
        blocks.push({
          kind: 'section-heading',
          title: 'LABORATORY, COMPUTATIONAL & ANALYTICAL METHODS',
        });
        blocks.push({ kind: 'paragraph', text: t(d.technicalMethods), align: 'left' });
      }

      if (t(d.technicalAndDigitalSkills)) {
        blocks.push({ kind: 'section-heading', title: 'TECHNICAL & DIGITAL SKILLS' });
        pushSkillLines(blocks, d.technicalAndDigitalSkills);
      }

      const acadTraining = cleanLines(d.technicalTraining);
      if (acadTraining.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'TECHNICAL TRAINING & DEVELOPMENT' });
        blocks.push({ kind: 'bullet-list', items: acadTraining });
      }

      if (t(d.professionalInterests)) {
        blocks.push({ kind: 'section-heading', title: 'PROFESSIONAL INTERESTS' });
        blocks.push({ kind: 'paragraph', text: t(d.professionalInterests), align: 'left' });
      }

      const validRefs = (d.referees || []).filter((r) => r && t(r.name));
      if (validRefs.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'ACADEMIC REFEREES' });
        blocks.push({
          kind: 'bullet-list',
          items: validRefs.map((r) =>
            joinNonEmpty([r.name, r.titleAndDepartment, r.institution, r.email], ' — ')
          ),
        });
      }

      const fullName = t(hdr.fullName) || 'SCHOLAR NAME';
      const subText = joinNonEmpty([d.academicTitleOrField, hdr.headlineOrTargetRole], ' | ');
      return {
        category: 'academic_resume',
        fontMode: 'serif',
        headerStyle: 'ats-centered',
        uppercaseHeaderSubtitle: true,
        title: fullName.toUpperCase(),
        subtitle: subText ? subText.toUpperCase() : undefined,
        contactLine: joinNonEmpty([
          hdr.location,
          hdr.phone,
          hdr.email,
          hdr.linkedinOrPortfolio,
          d.orcidOrScholarUrl,
        ]),
        footerText: makeFooterStamp(fullName, 'academic_resume'),
        blocks,
      };
    }

    case 'job_resume': {
      const d = payload.data;
      const hdr = (d.header || {}) as any;
      const blocks: BlueprintBlock[] = [];

      if (t(d.professionalSummary)) {
        blocks.push({ kind: 'section-heading', title: 'PROFESSIONAL PROFILE' });
        blocks.push({ kind: 'paragraph', text: t(d.professionalSummary), align: 'justify' });
      }

      if (t(d.technicalSkills) || t(d.softAndLeadershipSkills)) {
        blocks.push({ kind: 'section-heading', title: 'TECHNICAL & DIGITAL SKILLS' });
        if (t(d.technicalSkills)) {
          if (String(d.technicalSkills).includes('\n')) {
            pushSkillLines(blocks, d.technicalSkills);
          } else {
            blocks.push({
              kind: 'labeled-line',
              label: 'Technical & Digital Skills',
              value: t(d.technicalSkills),
            });
          }
        }
        if (t(d.softAndLeadershipSkills)) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Leadership & Operations',
            value: t(d.softAndLeadershipSkills),
          });
        }
      }

      const validWork = (d.workExperience || []).filter(
        (w) => w && (t(w.roleTitle) || t(w.organization) || t(w.highlights))
      );
      if (validWork.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validWork.map((w) => ({
            primaryLeft: t(w.roleTitle) || 'Position Title',
            primaryRight: joinNonEmpty([w.startDate, w.endDate], ' – '),
            secondaryLeft: joinNonEmpty([w.organization, w.location], ', '),
            bullets: cleanLines(w.highlights),
          })),
        });
      }

      const validLead = (d.leadershipRoles || []).filter(
        (l) => l && (t(l.roleTitle) || t(l.organization) || t(l.highlights))
      );
      if (validLead.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'LEADERSHIP' });
        blocks.push({
          kind: 'entries',
          items: validLead.map((l) => ({
            primaryLeft: t(l.roleTitle) || 'Leadership Role',
            primaryRight: joinNonEmpty([l.startDate, l.endDate], ' – '),
            secondaryLeft: joinNonEmpty([l.organization, l.location], ', '),
            bullets: cleanLines(l.highlights),
          })),
        });
      }

      const validProjects = (d.keyProjects || []).filter(
        (p) => p && (t(p.name) || t(p.impactBullets))
      );
      if (validProjects.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'SELECTED PROJECTS & DELIVERABLES' });
        blocks.push({
          kind: 'entries',
          items: validProjects.map((p) => ({
            primaryLeft: t(p.name) || 'Project',
            primaryRight: t(p.period) || undefined,
            secondaryLeft: t(p.roleOrContext) || undefined,
            bullets: cleanLines(p.impactBullets),
          })),
        });
      }

      const validEdu = (d.education || []).filter((e) => e && (t(e.degree) || t(e.institution)));
      if (validEdu.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EDUCATION' });
        blocks.push({
          kind: 'entries',
          items: validEdu.map((e) => ({
            primaryLeft: t(e.degree) || 'Degree',
            primaryRight: joinNonEmpty([e.startYear, e.endYear], ' – '),
            secondaryLeft: joinNonEmpty([e.institution, e.location], ', '),
            secondaryRight: t(e.gpaOrHonors) || undefined,
          })),
        });
      }

      const validCerts = (d.certifications || []).filter((c) => c && t(c.name));
      if (validCerts.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'CERTIFICATIONS & LICENSES' });
        blocks.push({
          kind: 'bullet-list',
          items: validCerts.map((c) =>
            joinNonEmpty(
              [c.name, c.issuer, c.year, t(c.credentialId) ? `ID: ${t(c.credentialId)}` : ''],
              ' — '
            )
          ),
        });
      }

      const jobTraining = cleanLines(d.technicalTraining);
      if (jobTraining.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'TECHNICAL TRAINING & DEVELOPMENT' });
        blocks.push({ kind: 'bullet-list', items: jobTraining });
      }

      if (t(d.professionalInterests)) {
        blocks.push({ kind: 'section-heading', title: 'PROFESSIONAL INTERESTS' });
        blocks.push({ kind: 'paragraph', text: t(d.professionalInterests), align: 'left' });
      }

      const validJobRefs = (d.references || []).filter((r) => r && t(r.name));
      if (validJobRefs.length > 0 || t(d.referencesNote)) {
        blocks.push({ kind: 'section-heading', title: 'REFERENCES' });
        if (validJobRefs.length > 0) {
          blocks.push({
            kind: 'bullet-list',
            items: validJobRefs.map((r) =>
              joinNonEmpty([r.name, r.titleAndDepartment, r.institution, r.email], ' — ')
            ),
          });
        }
        if (t(d.referencesNote)) {
          blocks.push({
            kind: 'paragraph',
            text: t(d.referencesNote),
            align: 'left',
            italic: validJobRefs.length === 0,
          });
        }
      }

      const fullName = t(hdr.fullName) || 'CANDIDATE NAME';
      const subText = t(d.targetJobTitle) || t(hdr.headlineOrTargetRole);
      return {
        category: 'job_resume',
        fontMode: 'serif',
        headerStyle: 'ats-centered',
        uppercaseHeaderSubtitle: true,
        title: fullName.toUpperCase(),
        subtitle: subText ? subText.toUpperCase() : undefined,
        contactLine: joinNonEmpty([
          hdr.location,
          hdr.phone,
          hdr.email,
          hdr.linkedinOrPortfolio,
        ]),
        footerText: makeFooterStamp(fullName, 'job_resume'),
        blocks,
      };
    }

    case 'sop': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];
      const metaRows = [
        { label: 'Applicant', value: t(d.applicantName) },
        { label: 'Target Program', value: t(d.targetDegreeAndProgram) },
        {
          label: 'Host Institution',
          value: joinNonEmpty([d.targetInstitution, d.targetDepartment], ' — '),
        },
        { label: 'Intended Term', value: t(d.intendedTerm) },
        { label: 'Faculty / Lab Focus', value: t(d.targetFacultyOrLab) },
      ].filter((r) => r.value);

      if (metaRows.length > 0) {
        blocks.push({ kind: 'meta-grid', rows: metaRows });
      }

      const essayParts = [
        d.openingMotivation,
        d.academicFoundation,
        d.researchAndPracticalExperience,
        d.programAndFacultyFit,
        d.careerGoalsAndClosing,
      ]
        .map((p) => t(p))
        .filter(Boolean);

      essayParts.forEach((p) => {
        splitEssayParagraphs(p).forEach((para) => {
          blocks.push({
            kind: 'paragraph',
            text: para,
            align: 'justify',
            spacingAfter: 3.5,
          });
        });
      });

      if (t(d.applicantName)) {
        blocks.push({
          kind: 'signature',
          signOff: 'Respectfully submitted,',
          name: t(d.applicantName),
          subline: joinNonEmpty([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
        });
      }

      return {
        category: 'sop',
        fontMode: 'serif',
        headerStyle: 'academic-essay',
        title: (t(d.documentTitle) || 'Statement of Purpose').toUpperCase(),
        subtitle:
          joinNonEmpty([d.targetDegreeAndProgram, d.targetInstitution], ' — ') || undefined,
        contactLine: joinNonEmpty([
          d.applicantName,
          d.applicantEmail,
          d.applicantPhone,
          d.applicantLocation,
        ]),
        footerText: makeFooterStamp(d.applicantName, 'sop'),
        blocks,
      };
    }

    case 'personal_statement': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      const metaRows = [
        { label: 'Applicant', value: t(d.applicantName) },
        { label: 'Target Opportunity', value: t(d.targetProgramOrOpportunity) },
        { label: 'Host Organization', value: t(d.targetOrganization) },
      ].filter((r) => r.value);
      if (metaRows.length > 0) {
        blocks.push({ kind: 'meta-grid', rows: metaRows });
      }

      const sections = [
        { heading: 'PERSONAL ORIGIN & MOTIVATION', text: d.definingStoryAndOrigin },
        { heading: 'RESILIENCE & GROWTH', text: d.challengesAndResilience },
        { heading: 'LEADERSHIP & CHARACTER', text: d.leadershipAndCharacter },
        { heading: 'VALUES ALIGNMENT & FUTURE IMPACT', text: d.valuesAndFutureContribution },
      ];

      sections.forEach((sec) => {
        if (t(sec.text)) {
          blocks.push({ kind: 'section-heading', title: sec.heading });
          splitEssayParagraphs(sec.text).forEach((para) => {
            blocks.push({
              kind: 'paragraph',
              text: para,
              align: 'justify',
              spacingAfter: 3.2,
            });
          });
        }
      });

      if (t(d.applicantName)) {
        blocks.push({
          kind: 'signature',
          signOff: 'Sincerely,',
          name: t(d.applicantName),
          subline: joinNonEmpty([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
        });
      }

      return {
        category: 'personal_statement',
        fontMode: 'serif',
        headerStyle: 'academic-essay',
        title: (t(d.documentTitle) || 'Personal Statement').toUpperCase(),
        subtitle:
          joinNonEmpty([d.targetProgramOrOpportunity, d.targetOrganization], ' — ') || undefined,
        contactLine: joinNonEmpty([
          d.applicantName,
          d.applicantEmail,
          d.applicantPhone,
          d.applicantLocation,
        ]),
        footerText: makeFooterStamp(d.applicantName, 'personal_statement'),
        blocks,
      };
    }

    case 'scholarship_letter': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      const senderLines = [
        d.applicantName,
        d.applicantAddress,
        d.applicantEmail,
        d.applicantPhone,
      ]
        .map((s) => t(s))
        .filter(Boolean);
      if (senderLines.length > 0) {
        blocks.push({ kind: 'address-block', lines: senderLines, align: 'left' });
      }

      if (t(d.letterDate)) {
        blocks.push({
          kind: 'paragraph',
          text: t(d.letterDate),
          align: 'left',
          bold: false,
          spacingAfter: 3,
        });
      }

      const recipientLines = [
        t(d.recipientTitle) || 'Scholarship Selection Committee',
        d.scholarshipName,
        d.sponsoringOrganization,
        d.hostCountryOrUniversity,
      ]
        .map((s) => t(s))
        .filter(Boolean);
      if (recipientLines.length > 0) {
        blocks.push({ kind: 'address-block', lines: recipientLines, align: 'left' });
      }

      const subject =
        t(d.subjectLine) ||
        (t(d.scholarshipName) ? `RE: Application for ${t(d.scholarshipName)}` : '');
      if (subject) {
        blocks.push({
          kind: 'paragraph',
          text: subject,
          bold: true,
          underlineRule: true,
          align: 'left',
          spacingAfter: 3.5,
        });
      }

      const salutation = t(d.salutation) || 'Dear Scholarship Selection Committee,';
      blocks.push({ kind: 'paragraph', text: salutation, align: 'left', spacingAfter: 3 });

      [
        d.purposeAndStanding,
        d.motivationAndMerit,
        d.financialNeedContext,
        d.impactAndCommitment,
      ]
        .map((p) => t(p))
        .filter(Boolean)
        .forEach((sec) => {
          splitEssayParagraphs(sec).forEach((para) => {
            blocks.push({
              kind: 'paragraph',
              text: para,
              align: 'justify',
              spacingAfter: 3.2,
            });
          });
        });

      blocks.push({
        kind: 'signature',
        signOff: t(d.signOff) || 'Yours faithfully,',
        name: t(d.applicantName) || 'Applicant',
        subline: joinNonEmpty([d.applicantEmail, d.applicantPhone], ' · ') || undefined,
      });

      return {
        category: 'scholarship_letter',
        fontMode: 'serif',
        headerStyle: 'formal-letter',
        title: t(d.scholarshipName)
          ? `Motivation Letter — ${t(d.scholarshipName)}`
          : 'Scholarship Motivation Letter',
        subtitle: t(d.sponsoringOrganization) || undefined,
        footerText: makeFooterStamp(d.applicantName, 'scholarship_letter'),
        blocks,
      };
    }

    case 'research_proposal': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      const metaRows = [
        { label: 'Principal Investigator', value: t(d.applicantName) },
        { label: 'Contact Email', value: t(d.applicantEmail) },
        {
          label: 'Host Institution',
          value: joinNonEmpty([d.targetInstitution, d.targetDepartment], ', '),
        },
        { label: 'Proposed Supervisor', value: t(d.proposedSupervisor) },
        { label: 'Research Keywords', value: t(d.keywords) },
      ].filter((r) => r.value);
      if (metaRows.length > 0) {
        blocks.push({ kind: 'meta-grid', rows: metaRows });
      }

      if (t(d.abstractSummary)) {
        blocks.push({ kind: 'section-heading', title: '1. ABSTRACT / EXECUTIVE SUMMARY' });
        splitEssayParagraphs(d.abstractSummary).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      if (t(d.problemStatement)) {
        blocks.push({ kind: 'section-heading', title: '2. BACKGROUND & PROBLEM STATEMENT' });
        splitEssayParagraphs(d.problemStatement).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      const rqs = cleanLines(d.researchQuestions);
      if (rqs.length > 0) {
        blocks.push({ kind: 'section-heading', title: '3. RESEARCH QUESTIONS & OBJECTIVES' });
        blocks.push({ kind: 'bullet-list', items: rqs });
      }

      if (t(d.literatureGap)) {
        blocks.push({ kind: 'section-heading', title: '4. LITERATURE CONTEXT & KNOWLEDGE GAP' });
        splitEssayParagraphs(d.literatureGap).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      if (t(d.methodologyDesign)) {
        blocks.push({
          kind: 'section-heading',
          title: '5. METHODOLOGY & ANALYTICAL DESIGN',
        });
        splitEssayParagraphs(d.methodologyDesign).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      if (t(d.expectedContributions)) {
        blocks.push({
          kind: 'section-heading',
          title: '6. EXPECTED OUTCOMES & SIGNIFICANCE',
        });
        splitEssayParagraphs(d.expectedContributions).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      const milestones = (d.timelineMilestones || []).filter(
        (m) => m && (t(m.phase) || t(m.timeframe) || t(m.deliverable))
      );
      if (milestones.length > 0) {
        blocks.push({ kind: 'section-heading', title: '7. RESEARCH TIMELINE & MILESTONES' });
        blocks.push({
          kind: 'table',
          columns: ['Research Phase', 'Timeframe', 'Key Deliverable'],
          colWidthsPct: [26, 20, 54],
          rows: milestones.map((m) => [
            t(m.phase) || 'Phase',
            t(m.timeframe) || '—',
            t(m.deliverable) || '—',
          ]),
        });
      }

      if (t(d.budgetOrResourceNeeds)) {
        blocks.push({
          kind: 'section-heading',
          title: '8. RESOURCES & EQUIPMENT REQUIREMENTS',
        });
        splitEssayParagraphs(d.budgetOrResourceNeeds).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      const refs = cleanLines(d.keyReferences);
      if (refs.length > 0) {
        blocks.push({ kind: 'section-heading', title: '9. KEY REFERENCES' });
        blocks.push({
          kind: 'bullet-list',
          items: refs.map((r, idx) => `[${idx + 1}] ${r}`),
        });
      }

      return {
        category: 'research_proposal',
        fontMode: 'serif',
        headerStyle: 'research-title',
        title: t(d.proposalTitle) || 'Research Proposal',
        subtitle: joinNonEmpty([d.targetInstitution, d.targetDepartment], ' · ') || undefined,
        contactLine: joinNonEmpty([d.applicantName, d.applicantEmail]),
        footerText: makeFooterStamp(d.applicantName, 'research_proposal'),
        blocks,
      };
    }

    case 'study_plan': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      const metaRows = [
        { label: 'Applicant', value: t(d.applicantName) },
        { label: 'Target Degree', value: t(d.targetDegree) },
        {
          label: 'Host Institution',
          value: joinNonEmpty([d.hostInstitution, d.hostCountry], ', '),
        },
        { label: 'Program Duration', value: t(d.programDuration) },
      ].filter((r) => r.value);
      if (metaRows.length > 0) {
        blocks.push({ kind: 'meta-grid', rows: metaRows });
      }

      if (t(d.academicBackground)) {
        blocks.push({ kind: 'section-heading', title: '1. ACADEMIC BACKGROUND & READINESS' });
        splitEssayParagraphs(d.academicBackground).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      if (t(d.purposeAndSpecialization)) {
        blocks.push({
          kind: 'section-heading',
          title: '2. PURPOSE OF STUDY & SPECIALIZATION FOCUS',
        });
        splitEssayParagraphs(d.purposeAndSpecialization).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      const terms = (d.studyTerms || []).filter(
        (item) => item && (t(item.termLabel) || t(item.courses) || t(item.academicGoal))
      );
      if (terms.length > 0) {
        blocks.push({
          kind: 'section-heading',
          title: '3. TERM-BY-TERM COURSEWORK & RESEARCH SCHEDULE',
        });
        blocks.push({
          kind: 'table',
          columns: ['Academic Term', 'Courses & Modules', 'Academic Milestones'],
          colWidthsPct: [22, 39, 39],
          rows: terms.map((item) => [
            t(item.termLabel) || 'Academic Term',
            t(item.courses) || '—',
            t(item.academicGoal) || '—',
          ]),
        });
      }

      if (t(d.languageAndTechnicalPrep)) {
        blocks.push({
          kind: 'section-heading',
          title: '4. LANGUAGE & TECHNICAL PREPARATION',
        });
        splitEssayParagraphs(d.languageAndTechnicalPrep).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      if (t(d.postStudyCareerImpact)) {
        blocks.push({
          kind: 'section-heading',
          title: '5. POST-STUDY CAREER & IMPACT PLAN',
        });
        splitEssayParagraphs(d.postStudyCareerImpact).forEach((para) => {
          blocks.push({ kind: 'paragraph', text: para, align: 'justify', spacingAfter: 3 });
        });
      }

      if (t(d.applicantName)) {
        blocks.push({
          kind: 'signature',
          signOff: 'Prepared by,',
          name: t(d.applicantName),
          subline: joinNonEmpty([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
        });
      }

      return {
        category: 'study_plan',
        fontMode: 'serif',
        headerStyle: 'study-plan',
        title: (t(d.documentTitle) || 'Academic Study Plan').toUpperCase(),
        subtitle:
          joinNonEmpty([d.targetDegree, d.hostInstitution, d.hostCountry], ' · ') || undefined,
        contactLine: joinNonEmpty([d.applicantName, d.applicantEmail, d.applicantLocation]),
        footerText: makeFooterStamp(d.applicantName, 'study_plan'),
        blocks,
      };
    }
  }
};

// ============================================================================
// 1. PROGRAMMATIC SELECTABLE-TEXT A4 PDF GENERATOR (jsPDF)
// ============================================================================

export const exportDocumentToPdfBlob = (payload: DocumentFormPayload): Blob => {
  const bp = buildDocumentBlueprint(payload);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = 210;
  const pageH = 297;
  const marginX = 18;
  const marginTop = 18;
  const marginBottom = 20;
  const contentW = pageW - marginX * 2;
  const fontFamily = 'times';

  let y = marginTop;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - marginBottom) {
      doc.addPage();
      y = marginTop;
      return true;
    }
    return false;
  };

  const drawWrappedText = (
    text: string,
    x: number,
    maxW: number,
    lineHeightMm: number,
    align: BlueprintAlign = 'left'
  ) => {
    const clean = text.trim();
    if (!clean) return;
    if (align === 'justify') {
      const lines = doc.splitTextToSize(clean, maxW) as string[];
      lines.forEach((ln, idx) => {
        ensureSpace(lineHeightMm + 1);
        const isLast = idx === lines.length - 1;
        if (!isLast && ln.trim().includes(' ')) {
          doc.text(ln, x, y, { align: 'justify', maxWidth: maxW });
        } else {
          doc.text(ln, x, y);
        }
        y += lineHeightMm;
      });
      return;
    }

    const lines = doc.splitTextToSize(clean, maxW) as string[];
    lines.forEach((ln) => {
      ensureSpace(lineHeightMm + 1);
      if (align === 'center') {
        doc.text(ln, pageW / 2, y, { align: 'center' });
      } else if (align === 'right') {
        doc.text(ln, pageW - marginX, y, { align: 'right' });
      } else {
        doc.text(ln, x, y);
      }
      y += lineHeightMm;
    });
  };

  // Document Header (suppressed on formal-letter so it opens with authentic correspondence)
  if (bp.headerStyle !== 'formal-letter') {
    const isCentered =
      bp.headerStyle === 'ats-centered' ||
      bp.headerStyle === 'academic-essay' ||
      bp.headerStyle === 'research-title' ||
      bp.headerStyle === 'study-plan';

    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(bp.headerStyle === 'research-title' ? 16 : 18.5);
    doc.setTextColor(...NAVY_RGB);
    const titleLines = doc.splitTextToSize(bp.title, contentW) as string[];
    titleLines.forEach((ln) => {
      ensureSpace(7.5);
      if (isCentered) {
        doc.text(ln, pageW / 2, y, { align: 'center' });
      } else {
        doc.text(ln, marginX, y);
      }
      y += 6.6;
    });

    if (bp.subtitle) {
      doc.setFont(fontFamily, bp.uppercaseHeaderSubtitle ? 'bold' : 'italic');
      doc.setFontSize(9.8);
      doc.setTextColor(...TEAL_RGB);
      const subLines = doc.splitTextToSize(bp.subtitle, contentW) as string[];
      subLines.forEach((ln) => {
        ensureSpace(4.8);
        if (isCentered) {
          doc.text(ln, pageW / 2, y, { align: 'center' });
        } else {
          doc.text(ln, marginX, y);
        }
        y += 4.5;
      });
    }

    if (bp.contactLine) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(...SLATE_MUTED_RGB);
      const cLines = doc.splitTextToSize(bp.contactLine, contentW) as string[];
      cLines.forEach((ln) => {
        ensureSpace(4.2);
        if (isCentered) {
          doc.text(ln, pageW / 2, y, { align: 'center' });
        } else {
          doc.text(ln, marginX, y);
        }
        y += 4.1;
      });
    }

    if (bp.secondaryContactLine) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(8.6);
      doc.setTextColor(...SLATE_MUTED_RGB);
      const c2Lines = doc.splitTextToSize(bp.secondaryContactLine, contentW) as string[];
      c2Lines.forEach((ln) => {
        ensureSpace(4);
        if (isCentered) {
          doc.text(ln, pageW / 2, y, { align: 'center' });
        } else {
          doc.text(ln, marginX, y);
        }
        y += 4;
      });
    }

    // Draw subtle header divider only when the first body block is NOT a section heading (to avoid double lines)
    if (bp.blocks[0]?.kind !== 'section-heading') {
      y += 1.5;
      doc.setDrawColor(...TEAL_RGB);
      doc.setLineWidth(0.42);
      doc.line(marginX, y, pageW - marginX, y);
      y += 5;
    } else {
      y += 2.5;
    }
  }

  // Body Blocks
  for (const block of bp.blocks) {
    switch (block.kind) {
      case 'section-heading': {
        ensureSpace(12);
        y += 2.2;
        doc.setFont(fontFamily, 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...NAVY_RGB);
        doc.text(block.title, marginX, y);
        y += 1.7;
        doc.setDrawColor(...TEAL_RGB);
        doc.setLineWidth(0.45);
        doc.line(marginX, y, pageW - marginX, y);
        y += 4.8;
        break;
      }

      case 'paragraph': {
        doc.setFont(
          fontFamily,
          block.bold ? 'bold' : block.italic ? 'italic' : 'normal'
        );
        doc.setFontSize(10);
        doc.setTextColor(...(block.bold ? NAVY_RGB : BODY_DARK_RGB));
        drawWrappedText(block.text, marginX, contentW, 4.65, block.align || 'left');
        if (block.underlineRule) {
          doc.setDrawColor(...TEAL_RGB);
          doc.setLineWidth(0.4);
          doc.line(marginX, y - 0.8, pageW - marginX, y - 0.8);
          y += 1.6;
        }
        y += block.spacingAfter ?? 2.3;
        break;
      }

      case 'labeled-line': {
        ensureSpace(6);
        doc.setFont(fontFamily, 'bold');
        doc.setFontSize(9.9);
        doc.setTextColor(...NAVY_RGB);
        const prefix = `${block.label}: `;
        const prefixW = doc.getTextWidth(prefix);
        doc.text(prefix, marginX, y);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(...BODY_DARK_RGB);
        const restLines = doc.splitTextToSize(block.value, Math.max(40, contentW - prefixW)) as string[];
        if (restLines.length > 0) {
          doc.text(restLines[0], marginX + prefixW, y);
          y += 4.55;
          for (let i = 1; i < restLines.length; i++) {
            ensureSpace(4.55);
            doc.text(restLines[i], marginX, y);
            y += 4.55;
          }
        } else {
          y += 4.55;
        }
        y += 1.1;
        break;
      }

      case 'bullet-list': {
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(9.9);
        doc.setTextColor(...BODY_DARK_RGB);
        for (const item of block.items) {
          const isNumberedCitation = /^\[\d+\]\s/.test(item);
          const indentX = isNumberedCitation ? marginX + 1.5 : marginX + 4.8;
          const wrapW = isNumberedCitation ? contentW - 2 : contentW - 5;
          const lines = doc.splitTextToSize(item, wrapW) as string[];
          ensureSpace(lines.length * 4.45 + 1);
          lines.forEach((ln, idx) => {
            if (!isNumberedCitation && idx === 0) {
              doc.text('•', marginX + 1, y);
            }
            doc.text(ln, isNumberedCitation && idx > 0 ? indentX + 5 : indentX, y);
            y += 4.45;
          });
          y += 0.7;
        }
        y += 1.4;
        break;
      }

      case 'entries': {
        for (const entry of block.items) {
          ensureSpace(12);
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(10.1);
          doc.setTextColor(...NAVY_RGB);
          const rightReserve = entry.primaryRight ? 44 : 0;
          const leftLines = doc.splitTextToSize(entry.primaryLeft, contentW - rightReserve) as string[];
          leftLines.forEach((ln, idx) => {
            doc.text(ln, marginX, y);
            if (idx === 0 && entry.primaryRight) {
              doc.setFont(fontFamily, 'normal');
              doc.setFontSize(9.3);
              doc.setTextColor(...SLATE_MUTED_RGB);
              doc.text(entry.primaryRight, pageW - marginX, y, { align: 'right' });
              doc.setFont(fontFamily, 'bold');
              doc.setFontSize(10.1);
              doc.setTextColor(...NAVY_RGB);
            }
            y += 4.4;
          });

          if (entry.secondaryLeft || entry.secondaryRight) {
            ensureSpace(5);
            doc.setFont(fontFamily, 'italic');
            doc.setFontSize(9.6);
            doc.setTextColor(...SLATE_MUTED_RGB);
            if (entry.secondaryLeft) {
              doc.text(entry.secondaryLeft, marginX, y);
            }
            if (entry.secondaryRight) {
              doc.text(entry.secondaryRight, pageW - marginX, y, { align: 'right' });
            }
            y += 4.4;
          }

          if (entry.bodyText) {
            doc.setFont(fontFamily, 'normal');
            doc.setFontSize(9.8);
            doc.setTextColor(...BODY_DARK_RGB);
            drawWrappedText(entry.bodyText, marginX, contentW, 4.5, 'left');
          }

          if (entry.bullets && entry.bullets.length > 0) {
            doc.setFont(fontFamily, 'normal');
            doc.setFontSize(9.8);
            doc.setTextColor(...BODY_DARK_RGB);
            for (const b of entry.bullets) {
              const bLines = doc.splitTextToSize(b, contentW - 5) as string[];
              ensureSpace(bLines.length * 4.4 + 0.8);
              bLines.forEach((ln, idx) => {
                if (idx === 0) doc.text('•', marginX + 1, y);
                doc.text(ln, marginX + 5, y);
                y += 4.4;
              });
              y += 0.4;
            }
          }
          y += 2.3;
        }
        break;
      }

      case 'table': {
        const pcts =
          block.colWidthsPct && block.colWidthsPct.length === block.columns.length
            ? block.colWidthsPct
            : block.columns.map(() => 100 / block.columns.length);
        const colWidths = pcts.map((p) => (contentW * p) / 100);
        const padX = 2.5;
        const padY = 2.4;
        const rowLineH = 4.2;

        const drawTableHeader = () => {
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(9.2);
          const headerCellLines = block.columns.map(
            (col, idx) => doc.splitTextToSize(col, Math.max(12, colWidths[idx] - padX * 2)) as string[]
          );
          const maxLines = Math.max(1, ...headerCellLines.map((l) => l.length));
          const headerH = maxLines * rowLineH + padY * 2;
          ensureSpace(headerH + 8);

          let cx = marginX;
          block.columns.forEach((_, idx) => {
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(...FOOTER_RULE_RGB);
            doc.rect(cx, y, colWidths[idx], headerH, 'FD');
            doc.setTextColor(...TEAL_RGB);
            headerCellLines[idx].forEach((ln, lIdx) => {
              doc.text(ln, cx + padX, y + padY + 3 + lIdx * rowLineH);
            });
            cx += colWidths[idx];
          });
          y += headerH;
        };

        drawTableHeader();

        for (const row of block.rows) {
          doc.setFont(fontFamily, 'normal');
          doc.setFontSize(9.2);
          const cellLines = block.columns.map((_, idx) => {
            const val = (row[idx] ?? '—').trim() || '—';
            return doc.splitTextToSize(val, Math.max(12, colWidths[idx] - padX * 2)) as string[];
          });
          const maxLines = Math.max(1, ...cellLines.map((l) => l.length));
          const rowH = maxLines * rowLineH + padY * 2;

          if (ensureSpace(rowH)) {
            drawTableHeader();
          }

          let cx = marginX;
          block.columns.forEach((_, idx) => {
            doc.setDrawColor(...FOOTER_RULE_RGB);
            doc.rect(cx, y, colWidths[idx], rowH, 'S');
            doc.setFont(fontFamily, idx === 0 ? 'bold' : 'normal');
            doc.setTextColor(...(idx === 0 ? NAVY_RGB : BODY_DARK_RGB));
            cellLines[idx].forEach((ln, lIdx) => {
              doc.text(ln, cx + padX, y + padY + 3 + lIdx * rowLineH);
            });
            cx += colWidths[idx];
          });
          y += rowH;
        }
        y += 4;
        break;
      }

      case 'address-block': {
        ensureSpace(block.lines.length * 4.7 + 4);
        doc.setFontSize(10.1);
        block.lines.forEach((ln, idx) => {
          doc.setFont(fontFamily, idx === 0 ? 'bold' : 'normal');
          doc.setTextColor(...(idx === 0 ? NAVY_RGB : BODY_DARK_RGB));
          if (block.align === 'right') {
            doc.text(ln, pageW - marginX, y, { align: 'right' });
          } else {
            doc.text(ln, marginX, y);
          }
          y += 4.65;
        });
        y += 3.2;
        break;
      }

      case 'meta-grid': {
        doc.setFontSize(9.4);
        const labelColW = 42;
        const valMaxW = contentW - labelColW - 5;
        const preparedRows = block.rows.map((r) => {
          doc.setFont(fontFamily, 'normal');
          const wrapped = doc.splitTextToSize(r.value, valMaxW) as string[];
          return {
            label: r.label,
            lines: wrapped.length > 0 ? wrapped : [r.value],
          };
        });
        const totalLines = preparedRows.reduce((sum, r) => sum + r.lines.length, 0);
        const lineH = 4.6;
        const boxHeight = totalLines * lineH + preparedRows.length * 1.2 + 5;
        ensureSpace(boxHeight + 4);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...FOOTER_RULE_RGB);
        doc.roundedRect(marginX, y - 1, contentW, boxHeight, 1.5, 1.5, 'FD');

        let ry = y + 3.6;
        for (const row of preparedRows) {
          doc.setFont(fontFamily, 'bold');
          doc.setTextColor(...TEAL_RGB);
          doc.text(`${row.label}:`, marginX + 3.5, ry);
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(...NAVY_RGB);
          row.lines.forEach((ln) => {
            doc.text(ln, marginX + 3.5 + labelColW, ry);
            ry += lineH;
          });
          ry += 1.2;
        }
        y += boxHeight + 4.5;
        break;
      }

      case 'signature': {
        ensureSpace(20);
        y += 3.5;
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(10.1);
        doc.setTextColor(...BODY_DARK_RGB);
        doc.text(block.signOff, marginX, y);
        y += 7.5;
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(...NAVY_RGB);
        doc.text(block.name, marginX, y);
        if (block.subline) {
          y += 4.5;
          doc.setFont(fontFamily, 'normal');
          doc.setFontSize(9.1);
          doc.setTextColor(...SLATE_MUTED_RGB);
          doc.text(block.subline, marginX, y);
        }
        y += 4;
        break;
      }
    }
  }

  // Executive running footer strip on every page (matching international academic CV layout)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...FOOTER_RULE_RGB);
    doc.setLineWidth(0.28);
    doc.line(marginX, pageH - 13.5, pageW - marginX, pageH - 13.5);
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(...FOOTER_TEXT_RGB);
    const baseFooter = bp.footerText || '';
    const stamp =
      totalPages > 1
        ? `${baseFooter ? `${baseFooter}  |  ` : ''}PAGE ${i} OF ${totalPages}`
        : baseFooter;
    if (stamp) {
      doc.text(stamp, pageW / 2, pageH - 9.2, { align: 'center' });
    }
  }

  return doc.output('blob');
};

export const downloadDocumentPdf = (payload: DocumentFormPayload, customFileName?: string) => {
  const blob = exportDocumentToPdfBlob(payload);
  const safeBase =
    (customFileName || extractDocumentTitle(payload))
      .replace(/[^a-z0-9_\- ]/gi, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'Document';
  triggerBlobDownload(blob, `${safeBase}.pdf`);
};

// ============================================================================
// 2. AUTHENTIC DOCX OOXML GENERATOR (JSZip)
// ============================================================================

const escapeXml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const A4_MARGIN_TWIPS = 1020; // ~18mm (0.71in)
const A4_USABLE_TWIPS = 11906 - A4_MARGIN_TWIPS * 2; // 9866 twips

const xmlParagraph = (
  runsXml: string,
  opts?: {
    align?: 'left' | 'center' | 'right' | 'both';
    spaceBefore?: number;
    spaceAfter?: number;
    bottomBorderColor?: string;
    bottomBorderSz?: number;
    topBorderColor?: string;
    leftIndent?: number;
    hanging?: number;
    rightTabStop?: boolean;
  }
) => {
  const jc = opts?.align ? `<w:jc w:val="${opts.align}"/>` : '';
  const tabs = opts?.rightTabStop
    ? `<w:tabs><w:tab w:val="right" w:pos="${A4_USABLE_TWIPS}"/></w:tabs>`
    : '';
  const spacing = `<w:spacing w:before="${opts?.spaceBefore ?? 0}" w:after="${
    opts?.spaceAfter ?? 90
  }" w:line="264" w:lineRule="auto"/>`;

  const topBdr = opts?.topBorderColor
    ? `<w:top w:val="single" w:sz="4" w:space="4" w:color="${opts.topBorderColor}"/>`
    : '';
  const botBdr = opts?.bottomBorderColor
    ? `<w:bottom w:val="single" w:sz="${opts.bottomBorderSz ?? 8}" w:space="3" w:color="${
        opts.bottomBorderColor
      }"/>`
    : '';
  const border = topBdr || botBdr ? `<w:pBdr>${topBdr}${botBdr}</w:pBdr>` : '';

  const ind = opts?.leftIndent
    ? `<w:ind w:left="${opts.leftIndent}" w:hanging="${opts.hanging ?? 240}"/>`
    : '';
  return `<w:p><w:pPr>${border}${tabs}${spacing}${ind}${jc}</w:pPr>${runsXml}</w:p>`;
};

const xmlRun = (
  text: string,
  opts?: { bold?: boolean; italic?: boolean; sizeHalfPt?: number; colorHex?: string; font?: string }
) => {
  const font = opts?.font || 'Times New Roman';
  const rPr = [
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`,
    opts?.bold ? '<w:b/>' : '',
    opts?.italic ? '<w:i/>' : '',
    opts?.colorHex ? `<w:color w:val="${opts.colorHex}"/>` : '<w:color w:val="1E293B"/>',
    `<w:sz w:val="${opts?.sizeHalfPt ?? 20}"/>`,
    `<w:szCs w:val="${opts?.sizeHalfPt ?? 20}"/>`,
  ].join('');
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
};

const xmlTabRun = (font = 'Times New Roman') =>
  `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/></w:rPr><w:tab/></w:r>`;

const xmlTable = (
  columns: string[],
  colWidthsPct: number[] | undefined,
  rows: string[][],
  docFont: string
): string => {
  const pcts =
    colWidthsPct && colWidthsPct.length === columns.length
      ? colWidthsPct
      : columns.map(() => 100 / columns.length);
  const colTwips = pcts.map((p) => Math.round((A4_USABLE_TWIPS * p) / 100));

  const gridCols = colTwips.map((w) => `<w:gridCol w:w="${w}"/>`).join('');

  const buildCell = (text: string, widthTwips: number, isHeader: boolean, isFirstCol: boolean) => {
    const shd = isHeader ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : '';
    const tcPr = `<w:tcPr><w:tcW w:w="${widthTwips}" w:type="dxa"/>${shd}<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>`;
    const pXml = xmlParagraph(
      xmlRun(text.trim() || '—', {
        bold: isHeader || isFirstCol,
        sizeHalfPt: 19,
        colorHex: isHeader ? '0E627C' : isFirstCol ? '0F2B46' : '1E293B',
        font: docFont,
      }),
      { spaceAfter: 40 }
    );
    return `<w:tc>${tcPr}${pXml}</w:tc>`;
  };

  const headerRowXml = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${columns
    .map((c, idx) => buildCell(c, colTwips[idx], true, false))
    .join('')}</w:tr>`;

  const dataRowsXml = rows
    .map(
      (r) =>
        `<w:tr>${columns
          .map((_, idx) => buildCell(r[idx] ?? '—', colTwips[idx], false, idx === 0))
          .join('')}</w:tr>`
    )
    .join('');

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${A4_USABLE_TWIPS}" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${gridCols}</w:tblGrid>
    ${headerRowXml}
    ${dataRowsXml}
  </w:tbl>`;
};

export const exportDocumentToDocxBlob = async (payload: DocumentFormPayload): Promise<Blob> => {
  const bp = buildDocumentBlueprint(payload);
  const docFont = 'Times New Roman';
  const isCentered =
    bp.headerStyle === 'ats-centered' ||
    bp.headerStyle === 'academic-essay' ||
    bp.headerStyle === 'research-title' ||
    bp.headerStyle === 'study-plan';
  const headerAlign: 'center' | 'left' = isCentered ? 'center' : 'left';

  const bodyParts: string[] = [];

  if (bp.headerStyle !== 'formal-letter') {
    bodyParts.push(
      xmlParagraph(
        xmlRun(bp.title, {
          bold: true,
          sizeHalfPt: 36,
          colorHex: '0F2B46',
          font: docFont,
        }),
        { align: headerAlign, spaceAfter: 50 }
      )
    );

    if (bp.subtitle) {
      bodyParts.push(
        xmlParagraph(
          xmlRun(bp.subtitle, {
            bold: Boolean(bp.uppercaseHeaderSubtitle),
            italic: !bp.uppercaseHeaderSubtitle,
            sizeHalfPt: 20,
            colorHex: '0E627C',
            font: docFont,
          }),
          { align: headerAlign, spaceAfter: 50 }
        )
      );
    }

    const needsHeaderRule = bp.blocks[0]?.kind !== 'section-heading';
    if (bp.contactLine) {
      bodyParts.push(
        xmlParagraph(
          xmlRun(bp.contactLine, { sizeHalfPt: 18, colorHex: '475569', font: docFont }),
          {
            align: headerAlign,
            spaceAfter: bp.secondaryContactLine ? 40 : 120,
            bottomBorderColor: !bp.secondaryContactLine && needsHeaderRule ? '0E627C' : undefined,
            bottomBorderSz: 8,
          }
        )
      );
    }

    if (bp.secondaryContactLine) {
      bodyParts.push(
        xmlParagraph(
          xmlRun(bp.secondaryContactLine, { sizeHalfPt: 18, colorHex: '475569', font: docFont }),
          {
            align: headerAlign,
            spaceAfter: 120,
            bottomBorderColor: needsHeaderRule ? '0E627C' : undefined,
            bottomBorderSz: 8,
          }
        )
      );
    }
  }

  for (const block of bp.blocks) {
    switch (block.kind) {
      case 'section-heading':
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.title, { bold: true, sizeHalfPt: 21, colorHex: '0F2B46', font: docFont }),
            {
              spaceBefore: 160,
              spaceAfter: 90,
              bottomBorderColor: '0E627C',
              bottomBorderSz: 10,
            }
          )
        );
        break;

      case 'paragraph':
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.text, {
              bold: block.bold,
              italic: block.italic,
              sizeHalfPt: 20,
              colorHex: block.bold ? '0F2B46' : '1E293B',
              font: docFont,
            }),
            {
              align: block.align === 'justify' ? 'both' : block.align || 'left',
              spaceAfter: block.underlineRule ? 140 : 100,
              bottomBorderColor: block.underlineRule ? '0E627C' : undefined,
              bottomBorderSz: 8,
            }
          )
        );
        break;

      case 'labeled-line':
        bodyParts.push(
          xmlParagraph(
            xmlRun(`${block.label}: `, { bold: true, sizeHalfPt: 20, colorHex: '0F2B46', font: docFont }) +
              xmlRun(block.value, { sizeHalfPt: 20, colorHex: '1E293B', font: docFont }),
            { spaceAfter: 80 }
          )
        );
        break;

      case 'bullet-list':
        for (const item of block.items) {
          const isNumberedCitation = /^\[\d+\]\s/.test(item);
          bodyParts.push(
            xmlParagraph(
              xmlRun(isNumberedCitation ? item : `•  ${item}`, {
                sizeHalfPt: 20,
                colorHex: '1E293B',
                font: docFont,
              }),
              {
                spaceAfter: 60,
                leftIndent: 360,
                hanging: isNumberedCitation ? 360 : 240,
              }
            )
          );
        }
        break;

      case 'entries':
        for (const entry of block.items) {
          bodyParts.push(
            xmlParagraph(
              xmlRun(entry.primaryLeft, { bold: true, sizeHalfPt: 20, colorHex: '0F2B46', font: docFont }) +
                (entry.primaryRight
                  ? xmlTabRun(docFont) +
                    xmlRun(entry.primaryRight, { sizeHalfPt: 19, colorHex: '475569', font: docFont })
                  : ''),
              { spaceBefore: 80, spaceAfter: 30, rightTabStop: Boolean(entry.primaryRight) }
            )
          );
          if (entry.secondaryLeft || entry.secondaryRight) {
            bodyParts.push(
              xmlParagraph(
                xmlRun(entry.secondaryLeft || '', {
                  italic: true,
                  sizeHalfPt: 19,
                  colorHex: '475569',
                  font: docFont,
                }) +
                  (entry.secondaryRight
                    ? xmlTabRun(docFont) +
                      xmlRun(entry.secondaryRight, {
                        italic: true,
                        sizeHalfPt: 19,
                        colorHex: '475569',
                        font: docFont,
                      })
                    : ''),
                { spaceAfter: 50, rightTabStop: Boolean(entry.secondaryRight) }
              )
            );
          }
          if (entry.bodyText) {
            bodyParts.push(
              xmlParagraph(
                xmlRun(entry.bodyText, { sizeHalfPt: 20, colorHex: '1E293B', font: docFont }),
                { spaceAfter: 60 }
              )
            );
          }
          if (entry.bullets && entry.bullets.length > 0) {
            for (const b of entry.bullets) {
              bodyParts.push(
                xmlParagraph(
                  xmlRun(`•  ${b}`, { sizeHalfPt: 20, colorHex: '1E293B', font: docFont }),
                  { spaceAfter: 50, leftIndent: 360 }
                )
              );
            }
          }
        }
        break;

      case 'table':
        bodyParts.push(xmlTable(block.columns, block.colWidthsPct, block.rows, docFont));
        bodyParts.push(xmlParagraph(xmlRun('', { sizeHalfPt: 8, font: docFont }), { spaceAfter: 80 }));
        break;

      case 'address-block':
        block.lines.forEach((ln, idx) => {
          bodyParts.push(
            xmlParagraph(
              xmlRun(ln, {
                bold: idx === 0,
                sizeHalfPt: 20,
                colorHex: idx === 0 ? '0F2B46' : '1E293B',
                font: docFont,
              }),
              { align: block.align || 'left', spaceAfter: idx === block.lines.length - 1 ? 120 : 30 }
            )
          );
        });
        break;

      case 'meta-grid':
        for (const row of block.rows) {
          bodyParts.push(
            xmlParagraph(
              xmlRun(`${row.label}: `, { bold: true, sizeHalfPt: 19, colorHex: '0E627C', font: docFont }) +
                xmlRun(row.value, { sizeHalfPt: 19, colorHex: '0F2B46', font: docFont }),
              { spaceAfter: 50 }
            )
          );
        }
        bodyParts.push(
          xmlParagraph(xmlRun('', { sizeHalfPt: 8, font: docFont }), {
            spaceAfter: 100,
            bottomBorderColor: 'CBD5E1',
            bottomBorderSz: 6,
          })
        );
        break;

      case 'signature':
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.signOff, { sizeHalfPt: 20, colorHex: '1E293B', font: docFont }),
            { spaceBefore: 160, spaceAfter: 140 }
          )
        );
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.name, { bold: true, sizeHalfPt: 20, colorHex: '0F2B46', font: docFont }),
            { spaceAfter: block.subline ? 40 : 80 }
          )
        );
        if (block.subline) {
          bodyParts.push(
            xmlParagraph(
              xmlRun(block.subline, { sizeHalfPt: 18, colorHex: '475569', font: docFont }),
              { spaceAfter: 80 }
            )
          );
        }
        break;
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyParts.join('\n    ')}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rId2"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="${A4_MARGIN_TWIPS}" w:right="${A4_MARGIN_TWIPS}" w:bottom="${A4_MARGIN_TWIPS}" w:left="${A4_MARGIN_TWIPS}" w:header="560" w:footer="560" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${xmlParagraph(
    xmlRun(bp.footerText || '', { sizeHalfPt: 16, colorHex: '64748B', font: docFont }),
    { align: 'center', spaceBefore: 40, spaceAfter: 0, topBorderColor: 'CBD5E1' }
  )}
</w:ftr>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="${docFont}" w:hAnsi="${docFont}" w:cs="${docFont}"/>
      <w:sz w:val="20"/>
    </w:rPr>
  </w:style>
</w:styles>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.folder('_rels')?.file('.rels', relsXml);
  const wordDir = zip.folder('word');
  wordDir?.file('document.xml', documentXml);
  wordDir?.file('styles.xml', stylesXml);
  wordDir?.file('footer1.xml', footerXml);
  wordDir?.folder('_rels')?.file('document.xml.rels', wordRelsXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};

export const downloadDocumentDocx = async (payload: DocumentFormPayload, customFileName?: string) => {
  const blob = await exportDocumentToDocxBlob(payload);
  const safeBase =
    (customFileName || extractDocumentTitle(payload))
      .replace(/[^a-z0-9_\- ]/gi, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'Document';
  triggerBlobDownload(blob, `${safeBase}.docx`);
};

// ============================================================================
// 3. PAGE-1 VISUAL PREVIEW THUMBNAIL RENDERER (A4 CANVAS -> JPEG DATA URL)
// ============================================================================

export const renderDocumentFirstPageDataUrl = (payload: DocumentFormPayload): string => {
  const bp = buildDocumentBlueprint(payload);
  const canvas = document.createElement('canvas');
  const W = 794;
  const H = 1123;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const marginX = 64;
  const maxW = W - marginX * 2;
  const bottomLimit = H - 72;
  const fontStack = '"Times New Roman", Georgia, serif';
  let y = 64;

  const wrapLines = (text: string, widthPx: number): string[] => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const lines: string[] = [];
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${current} ${words[i]}`;
      if (ctx.measureText(test).width <= widthPx) {
        current = test;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
    return lines;
  };

  const isCentered =
    bp.headerStyle === 'ats-centered' ||
    bp.headerStyle === 'academic-essay' ||
    bp.headerStyle === 'research-title' ||
    bp.headerStyle === 'study-plan';

  if (bp.headerStyle !== 'formal-letter') {
    ctx.fillStyle = '#0f2b46';
    ctx.font = `bold 25px ${fontStack}`;
    ctx.textAlign = isCentered ? 'center' : 'left';
    const titleLines = wrapLines(bp.title, maxW);
    for (const ln of titleLines) {
      if (y > bottomLimit) break;
      ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
      y += 28;
    }

    if (bp.subtitle && y < bottomLimit) {
      ctx.fillStyle = '#0e627c';
      ctx.font = `${bp.uppercaseHeaderSubtitle ? 'bold ' : 'italic '}13.5px ${fontStack}`;
      const subLines = wrapLines(bp.subtitle, maxW);
      for (const ln of subLines) {
        if (y > bottomLimit) break;
        ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
        y += 19;
      }
    }

    if (bp.contactLine && y < bottomLimit) {
      ctx.fillStyle = '#475569';
      ctx.font = `12px ${fontStack}`;
      const cLines = wrapLines(bp.contactLine, maxW);
      for (const ln of cLines) {
        if (y > bottomLimit) break;
        ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
        y += 17;
      }
    }

    if (bp.secondaryContactLine && y < bottomLimit) {
      ctx.fillStyle = '#475569';
      ctx.font = `12px ${fontStack}`;
      const c2Lines = wrapLines(bp.secondaryContactLine, maxW);
      for (const ln of c2Lines) {
        if (y > bottomLimit) break;
        ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
        y += 17;
      }
    }

    if (bp.blocks[0]?.kind !== 'section-heading') {
      y += 6;
      ctx.strokeStyle = '#0e627c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(W - marginX, y);
      ctx.stroke();
      y += 22;
    } else {
      y += 12;
    }
  }

  ctx.textAlign = 'left';

  for (const block of bp.blocks) {
    if (y >= bottomLimit - 14) break;

    if (block.kind === 'section-heading') {
      y += 8;
      ctx.fillStyle = '#0f2b46';
      ctx.font = `bold 14.5px ${fontStack}`;
      ctx.fillText(block.title, marginX, y);
      y += 6;
      ctx.strokeStyle = '#0e627c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(W - marginX, y);
      ctx.stroke();
      y += 19;
    } else if (block.kind === 'paragraph') {
      ctx.fillStyle = block.bold ? '#0f2b46' : '#1e293b';
      ctx.font = `${block.bold ? 'bold ' : block.italic ? 'italic ' : ''}13.5px ${fontStack}`;
      const lines = wrapLines(block.text, maxW);
      for (const ln of lines) {
        if (y >= bottomLimit) break;
        ctx.fillText(ln, marginX, y);
        y += 19;
      }
      if (block.underlineRule && y < bottomLimit) {
        ctx.strokeStyle = '#0e627c';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(marginX, y - 10);
        ctx.lineTo(W - marginX, y - 10);
        ctx.stroke();
      }
      y += 8;
    } else if (block.kind === 'labeled-line') {
      ctx.font = `bold 13px ${fontStack}`;
      ctx.fillStyle = '#0f2b46';
      const prefix = `${block.label}: `;
      const prefixW = ctx.measureText(prefix).width;
      ctx.fillText(prefix, marginX, y);
      ctx.font = `13px ${fontStack}`;
      ctx.fillStyle = '#1e293b';
      const lines = wrapLines(block.value, Math.max(120, maxW - prefixW));
      if (lines.length > 0) {
        ctx.fillText(lines[0], marginX + prefixW, y);
        y += 18;
        for (let i = 1; i < lines.length; i++) {
          if (y >= bottomLimit) break;
          ctx.fillText(lines[i], marginX, y);
          y += 18;
        }
      } else {
        y += 18;
      }
      y += 4;
    } else if (block.kind === 'bullet-list') {
      ctx.font = `13px ${fontStack}`;
      ctx.fillStyle = '#1e293b';
      for (const item of block.items) {
        if (y >= bottomLimit) break;
        const isNum = /^\[\d+\]\s/.test(item);
        const lines = wrapLines(item, isNum ? maxW - 8 : maxW - 18);
        lines.forEach((ln, idx) => {
          if (y >= bottomLimit) return;
          if (!isNum && idx === 0) ctx.fillText('•', marginX + 4, y);
          ctx.fillText(ln, isNum ? marginX + 6 : marginX + 18, y);
          y += 18;
        });
        y += 3;
      }
      y += 6;
    } else if (block.kind === 'entries') {
      for (const entry of block.items) {
        if (y >= bottomLimit - 14) break;
        ctx.font = `bold 13.8px ${fontStack}`;
        ctx.fillStyle = '#0f2b46';
        ctx.textAlign = 'left';
        ctx.fillText(entry.primaryLeft, marginX, y);
        if (entry.primaryRight) {
          ctx.font = `12.5px ${fontStack}`;
          ctx.fillStyle = '#475569';
          ctx.textAlign = 'right';
          ctx.fillText(entry.primaryRight, W - marginX, y);
          ctx.textAlign = 'left';
        }
        y += 18;
        if (entry.secondaryLeft || entry.secondaryRight) {
          ctx.font = `italic 13px ${fontStack}`;
          ctx.fillStyle = '#475569';
          if (entry.secondaryLeft) ctx.fillText(entry.secondaryLeft, marginX, y);
          if (entry.secondaryRight) {
            ctx.textAlign = 'right';
            ctx.fillText(entry.secondaryRight, W - marginX, y);
            ctx.textAlign = 'left';
          }
          y += 17;
        }
        if (entry.bodyText) {
          ctx.font = `13px ${fontStack}`;
          ctx.fillStyle = '#1e293b';
          const lines = wrapLines(entry.bodyText, maxW);
          for (const ln of lines) {
            if (y >= bottomLimit) break;
            ctx.fillText(ln, marginX, y);
            y += 18;
          }
        }
        if (entry.bullets) {
          ctx.font = `13px ${fontStack}`;
          ctx.fillStyle = '#1e293b';
          for (const b of entry.bullets) {
            if (y >= bottomLimit) break;
            const lines = wrapLines(b, maxW - 18);
            lines.forEach((ln, idx) => {
              if (y >= bottomLimit) return;
              if (idx === 0) ctx.fillText('•', marginX + 4, y);
              ctx.fillText(ln, marginX + 18, y);
              y += 18;
            });
          }
        }
        y += 8;
      }
    } else if (block.kind === 'table') {
      const pcts =
        block.colWidthsPct && block.colWidthsPct.length === block.columns.length
          ? block.colWidthsPct
          : block.columns.map(() => 100 / block.columns.length);
      const colWidthsPx = pcts.map((p) => (maxW * p) / 100);
      const padX = 8;
      const rowHeaderH = 26;
      if (y + rowHeaderH < bottomLimit) {
        let cx = marginX;
        block.columns.forEach((col, idx) => {
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(cx, y - 14, colWidthsPx[idx], rowHeaderH);
          ctx.strokeStyle = '#cbd5e1';
          ctx.strokeRect(cx, y - 14, colWidthsPx[idx], rowHeaderH);
          ctx.font = `bold 12px ${fontStack}`;
          ctx.fillStyle = '#0e627c';
          ctx.fillText(col, cx + padX, y + 3);
          cx += colWidthsPx[idx];
        });
        y += rowHeaderH + 4;
      }
      for (const row of block.rows) {
        if (y >= bottomLimit - 14) break;
        ctx.font = `12px ${fontStack}`;
        const cellLines = block.columns.map((_, idx) =>
          wrapLines((row[idx] ?? '—').trim() || '—', Math.max(40, colWidthsPx[idx] - padX * 2))
        );
        const maxCellLines = Math.max(1, ...cellLines.map((l) => l.length));
        const rH = maxCellLines * 17 + 10;
        if (y + rH > bottomLimit) break;
        let cx = marginX;
        block.columns.forEach((_, idx) => {
          ctx.strokeStyle = '#cbd5e1';
          ctx.strokeRect(cx, y - 14, colWidthsPx[idx], rH);
          ctx.font = `${idx === 0 ? 'bold ' : ''}12px ${fontStack}`;
          ctx.fillStyle = idx === 0 ? '#0f2b46' : '#1e293b';
          cellLines[idx].forEach((ln, lIdx) => {
            ctx.fillText(ln, cx + padX, y + 3 + lIdx * 17);
          });
          cx += colWidthsPx[idx];
        });
        y += rH;
      }
      y += 10;
    } else if (block.kind === 'address-block') {
      block.lines.forEach((ln, idx) => {
        if (y >= bottomLimit) return;
        ctx.font = `${idx === 0 ? 'bold ' : ''}13.5px ${fontStack}`;
        ctx.fillStyle = idx === 0 ? '#0f2b46' : '#1e293b';
        ctx.fillText(ln, marginX, y);
        y += 18;
      });
      y += 10;
    } else if (block.kind === 'meta-grid') {
      ctx.font = `12px ${fontStack}`;
      const valOffset = 165;
      const wrappedRows = block.rows.map((r) => ({
        label: r.label,
        lines: wrapLines(r.value, maxW - valOffset - 12),
      }));
      const totalLns = wrappedRows.reduce((acc, r) => acc + Math.max(1, r.lines.length), 0);
      const boxH = totalLns * 18 + wrappedRows.length * 4 + 14;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.fillRect(marginX, y - 8, maxW, boxH);
      ctx.strokeRect(marginX, y - 8, maxW, boxH);
      let ry = y + 10;
      for (const r of wrappedRows) {
        if (ry >= bottomLimit) break;
        ctx.font = `bold 12px ${fontStack}`;
        ctx.fillStyle = '#0e627c';
        ctx.fillText(`${r.label}:`, marginX + 12, ry);
        ctx.font = `12px ${fontStack}`;
        ctx.fillStyle = '#0f2b46';
        const lns = r.lines.length > 0 ? r.lines : ['—'];
        lns.forEach((ln) => {
          if (ry < bottomLimit) {
            ctx.fillText(ln, marginX + valOffset, ry);
          }
          ry += 18;
        });
        ry += 4;
      }
      y += boxH + 12;
    } else if (block.kind === 'signature') {
      if (y < bottomLimit - 40) {
        y += 14;
        ctx.font = `13.5px ${fontStack}`;
        ctx.fillStyle = '#1e293b';
        ctx.fillText(block.signOff, marginX, y);
        y += 28;
        ctx.font = `bold 14px ${fontStack}`;
        ctx.fillStyle = '#0f2b46';
        ctx.fillText(block.name, marginX, y);
      }
    }
  }

  // Bottom executive footer rule & stamp
  if (bp.footerText) {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, H - 48);
    ctx.lineTo(W - marginX, H - 48);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = `10.5px ${fontStack}`;
    ctx.textAlign = 'center';
    ctx.fillText(bp.footerText, W / 2, H - 30);
  }

  return canvas.toDataURL('image/jpeg', 0.88);
};

export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, b64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};
