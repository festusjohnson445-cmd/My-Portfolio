import {
  CareerStudioTemplateId,
  DocumentFormPayload,
  DocumentWorkspaceCategory,
  getPayloadTemplateId,
} from '../types/documentWorkspace';

export interface TemplateContactItem {
  icon: 'phone' | 'link' | 'mail' | 'pin' | 'id' | 'date';
  label?: string;
  value: string;
}

export interface TemplateEntryBlock {
  primary: string;
  secondary?: string;
  dateRange?: string;
  location?: string;
  bodyText?: string;
  bullets?: string[];
}

export interface TemplateSubGroup {
  subtitle?: string;
  items: string[];
}

export interface TemplateTableData {
  columns: string[];
  rows: string[][];
}

export interface TemplateSection {
  id: string;
  heading: string;
  kind: 'paragraph' | 'paragraphs' | 'bullets' | 'subgroups' | 'entries' | 'table' | 'contacts' | 'signature';
  text?: string;
  paragraphs?: string[];
  bullets?: string[];
  subgroups?: TemplateSubGroup[];
  entries?: TemplateEntryBlock[];
  table?: TemplateTableData;
  contacts?: TemplateContactItem[];
  signature?: { signOff: string; name: string; subline?: string };
}

export type SinglePageDensity = 'normal' | 'compact' | 'ultra';

export interface SinglePageDocumentModel {
  category: DocumentWorkspaceCategory;
  templateId: CareerStudioTemplateId;
  displayName: string;
  displayRole: string;
  inlineContactLine: string;
  passportImageUrl?: string;
  footerMotto?: string;
  contacts: TemplateContactItem[];
  /** Left sidebar / left column sections */
  sidebarSections: TemplateSection[];
  /** Main / right column sections */
  mainSections: TemplateSection[];
  /** Bottom 2-col or 4-col grid items (Skills / Competencies / Keywords) */
  skillsGridTitle: string;
  skillsGridItems: string[];
  /** Additional full-width / Swiss sections after skills grid */
  trailingSections: TemplateSection[];
  /** Ordered flat sections for 1-column Swiss Minimal template */
  swissSections: TemplateSection[];
  density: SinglePageDensity;
}

export interface TwoPageDocumentModel {
  category: DocumentWorkspaceCategory;
  displayName: string;
  displayRole: string;
  passportImageUrl?: string;
  footerName: string;
  page1Left: TemplateSection[];
  page1Right: TemplateSection[];
  page2Left: TemplateSection[];
  page2Right: TemplateSection[];
  page2FullWidth: TemplateSection[];
  density: SinglePageDensity;
}

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const join = (parts: Array<unknown>, sep = ' · '): string =>
  parts
    .map((p) => s(p))
    .filter(Boolean)
    .join(sep);

const splitLines = (raw: unknown): string[] =>
  s(raw)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

const splitParagraphs = (raw: unknown): string[] =>
  s(raw)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

const splitSkillTokens = (raw: unknown): string[] => {
  const txt = s(raw);
  if (!txt) return [];
  // Prefer newline splitting if multiline, else comma/semicolon/bullet splitting
  const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tokens: string[] = [];
  for (const ln of lines) {
    const colonIdx = ln.indexOf(':');
    const cleanLine = colonIdx > 1 && colonIdx < 36 ? ln : ln;
    if (cleanLine.includes(',') && cleanLine.length > 42) {
      const prefix = colonIdx > 1 && colonIdx < 36 ? cleanLine.slice(0, colonIdx + 1) + ' ' : '';
      const rest = colonIdx > 1 && colonIdx < 36 ? cleanLine.slice(colonIdx + 1) : cleanLine;
      const parts = rest.split(/[;,•|]/).map((p) => p.trim()).filter(Boolean);
      if (prefix && parts.length > 0) {
        tokens.push(`${prefix}${parts[0]}`);
        tokens.push(...parts.slice(1));
      } else {
        tokens.push(...parts);
      }
    } else if (cleanLine.includes('•') || cleanLine.includes(';')) {
      tokens.push(...cleanLine.split(/[;•]/).map((p) => p.trim()).filter(Boolean));
    } else {
      tokens.push(cleanLine.replace(/^[•\-*]\s*/, '').trim());
    }
  }
  return tokens.filter(Boolean);
};

const computeDensity = (sections: TemplateSection[], gridItems: string[]): SinglePageDensity => {
  let chars = gridItems.join(' ').length;
  let units = gridItems.length * 0.5;
  for (const sec of sections) {
    units += 2;
    if (sec.text) chars += sec.text.length;
    if (sec.paragraphs) {
      for (const p of sec.paragraphs) {
        chars += p.length;
        units += 1.4;
      }
    }
    if (sec.bullets) {
      for (const b of sec.bullets) {
        chars += b.length;
        units += 0.9;
      }
    }
    if (sec.subgroups) {
      for (const sg of sec.subgroups) {
        units += 1 + sg.items.length * 0.7;
        chars += sg.items.join(' ').length;
      }
    }
    if (sec.entries) {
      for (const e of sec.entries) {
        units += 2.2 + (e.bullets?.length || 0) * 0.85;
        chars +=
          (e.primary?.length || 0) +
          (e.secondary?.length || 0) +
          (e.bodyText?.length || 0) +
          (e.bullets?.join(' ').length || 0);
      }
    }
    if (sec.table) {
      units += 2 + sec.table.rows.length * 1.4;
      chars += sec.table.rows.flat().join(' ').length;
    }
  }
  if (chars > 3300 || units > 38) return 'ultra';
  if (chars > 2100 || units > 24) return 'compact';
  return 'normal';
};

export const buildSinglePageDocumentModel = (
  payload: DocumentFormPayload
): SinglePageDocumentModel => {
  const templateId = getPayloadTemplateId(payload);
  let displayName = 'APPLICANT NAME';
  let displayRole = 'PROFESSIONAL TITLE';
  const contacts: TemplateContactItem[] = [];
  const sidebarSections: TemplateSection[] = [];
  const mainSections: TemplateSection[] = [];
  let skillsGridTitle = 'SKILLS';
  let skillsGridItems: string[] = [];
  const trailingSections: TemplateSection[] = [];

  switch (payload.category) {
    case 'international_cv': {
      const d = payload.data;
      const h = d.header || ({} as any);
      displayName = s(h.fullName) || 'APPLICANT NAME';
      displayRole = s(h.headlineOrTargetRole) || 'INTERNATIONAL CURRICULUM VITAE';

      if (s(h.phone)) contacts.push({ icon: 'phone', value: s(h.phone) });
      if (s(h.linkedinOrPortfolio)) contacts.push({ icon: 'link', value: s(h.linkedinOrPortfolio) });
      if (s(d.orcidOrGithub)) contacts.push({ icon: 'id', value: s(d.orcidOrGithub) });
      if (s(h.email)) contacts.push({ icon: 'mail', value: s(h.email) });
      if (s(h.location)) contacts.push({ icon: 'pin', value: s(h.location) });

      // Sidebar PROFILE highlights (mobility, core competencies summary, interests)
      const profileBullets: string[] = [];
      if (s(d.nationalityOrWorkAuth)) profileBullets.push(`Work Auth: ${s(d.nationalityOrWorkAuth)}`);
      const coreTokens = splitSkillTokens(d.coreCompetencies);
      if (coreTokens.length > 0 && coreTokens.length <= 5) {
        profileBullets.push(...coreTokens);
      } else if (s(d.coreCompetencies)) {
        profileBullets.push(s(d.coreCompetencies));
      }
      if (s(d.professionalInterests)) profileBullets.push(`Interests: ${s(d.professionalInterests)}`);
      if (profileBullets.length > 0) {
        sidebarSections.push({
          id: 'cv-profile',
          heading: 'PROFILE',
          kind: 'bullets',
          bullets: profileBullets,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'cv-contact',
          heading: 'CONTACT',
          kind: 'contacts',
          contacts,
        });
      }

      const hardSkills = splitSkillTokens(d.technicalAndDigitalSkills);
      const softSkills = splitSkillTokens(d.coreCompetencies);
      const trainingList = splitLines(d.technicalTraining);

      if (hardSkills.length > 0 || softSkills.length > 0) {
        sidebarSections.push({
          id: 'cv-skills-side',
          heading: 'SKILLS',
          kind: 'subgroups',
          subgroups: [
            ...(hardSkills.length > 0 ? [{ subtitle: 'Technical & Digital', items: hardSkills }] : []),
            ...(softSkills.length > 0 ? [{ subtitle: 'Core Competencies', items: softSkills }] : []),
          ],
        });
      }

      const validLangs = (d.languages || []).filter((l) => l && s(l.language));
      if (validLangs.length > 0) {
        sidebarSections.push({
          id: 'cv-languages',
          heading: 'LANGUAGES',
          kind: 'bullets',
          bullets: validLangs.map((l) =>
            s(l.proficiency) ? `${s(l.language)} (${s(l.proficiency)})` : s(l.language)
          ),
        });
      }

      const validCerts = (d.certifications || []).filter((c) => c && s(c.name));
      if (validCerts.length > 0 || trainingList.length > 0) {
        const certBullets = [
          ...validCerts.map((c) =>
            join([c.name, c.issuer, c.year, s(c.credentialId) ? `ID: ${s(c.credentialId)}` : ''], ' — ')
          ),
          ...trainingList,
        ];
        trailingSections.push({
          id: 'cv-certs',
          heading: 'CERTIFICATIONS & TRAINING',
          kind: 'bullets',
          bullets: certBullets,
        });
        sidebarSections.push({
          id: 'cv-certs-side',
          heading: 'CERTIFICATIONS',
          kind: 'bullets',
          bullets: certBullets,
        });
      }

      // Main Sections
      if (s(d.professionalSummary)) {
        mainSections.push({
          id: 'cv-summary',
          heading: 'SUMMARY',
          kind: 'paragraph',
          text: s(d.professionalSummary),
        });
      }

      const exps = [...(d.experiences || []), ...(d.leadershipRoles || [])].filter(
        (e) => e && (s(e.roleTitle) || s(e.organization) || s(e.highlights))
      );
      if (exps.length > 0) {
        mainSections.push({
          id: 'cv-experience',
          heading: 'EXPERIENCE',
          kind: 'entries',
          entries: exps.map((e) => ({
            primary: s(e.roleTitle) || 'Role Title',
            secondary: join([e.organization, e.location], ', '),
            dateRange: join([e.startDate, e.endDate], ' – '),
            bullets: splitLines(e.highlights),
          })),
        });
      }

      const edus = (d.education || []).filter((e) => e && (s(e.degree) || s(e.institution)));
      if (edus.length > 0) {
        mainSections.push({
          id: 'cv-education',
          heading: 'EDUCATION',
          kind: 'entries',
          entries: edus.map((e) => ({
            primary: s(e.degree) || 'Academic Degree',
            secondary: join([e.institution, e.location, e.gpaOrHonors], ' · '),
            dateRange: join([e.startYear, e.endYear], ' – '),
            bodyText: s(e.thesisOrCoursework) ? `Thesis / Focus: ${s(e.thesisOrCoursework)}` : undefined,
          })),
        });
      }

      const projs = (d.selectedProjects || []).filter((p) => p && (s(p.name) || s(p.impactBullets)));
      if (projs.length > 0) {
        mainSections.push({
          id: 'cv-projects',
          heading: 'PROJECTS',
          kind: 'entries',
          entries: projs.map((p) => ({
            primary: s(p.name) || 'Project',
            secondary: s(p.roleOrContext) || undefined,
            dateRange: s(p.period) || undefined,
            bullets: splitLines(p.impactBullets),
          })),
        });
      }

      const refs = (d.references || []).filter((r) => r && s(r.name));
      if (refs.length > 0 || s(d.referencesNote)) {
        const refBullets = refs.map((r) =>
          join([r.name, r.titleAndDepartment, r.institution, r.email], ' — ')
        );
        if (s(d.referencesNote)) refBullets.push(s(d.referencesNote));
        mainSections.push({
          id: 'cv-references',
          heading: 'REFERENCES',
          kind: 'bullets',
          bullets: refBullets,
        });
      }

      skillsGridTitle = 'SKILLS';
      skillsGridItems = [...hardSkills, ...softSkills].slice(0, 12);
      if (validLangs.length > 0) {
        trailingSections.push({
          id: 'cv-langs-trail',
          heading: 'LANGUAGES',
          kind: 'bullets',
          bullets: validLangs.map((l) =>
            s(l.proficiency) ? `${s(l.language)} (${s(l.proficiency)})` : s(l.language)
          ),
        });
      }
      break;
    }

    case 'academic_resume': {
      const d = payload.data;
      const h = d.header || ({} as any);
      displayName = s(h.fullName) || 'SCHOLAR NAME';
      displayRole =
        join([d.academicTitleOrField, h.headlineOrTargetRole], ' | ') || 'ACADEMIC RESEARCHER';

      if (s(h.phone)) contacts.push({ icon: 'phone', value: s(h.phone) });
      if (s(h.linkedinOrPortfolio)) contacts.push({ icon: 'link', value: s(h.linkedinOrPortfolio) });
      if (s(d.orcidOrScholarUrl)) contacts.push({ icon: 'id', value: s(d.orcidOrScholarUrl) });
      if (s(h.email)) contacts.push({ icon: 'mail', value: s(h.email) });
      if (s(h.location)) contacts.push({ icon: 'pin', value: s(h.location) });

      const researchTags = splitSkillTokens(d.researchInterests);
      const profileBullets = [
        ...researchTags,
        ...(s(d.professionalInterests) ? [`Interests: ${s(d.professionalInterests)}`] : []),
      ];
      if (profileBullets.length > 0) {
        sidebarSections.push({
          id: 'acad-profile',
          heading: 'RESEARCH FOCUS',
          kind: 'bullets',
          bullets: profileBullets,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'acad-contact',
          heading: 'CONTACT',
          kind: 'contacts',
          contacts,
        });
      }

      const methodTokens = splitSkillTokens(d.technicalMethods);
      const digitalTokens = splitSkillTokens(d.technicalAndDigitalSkills);
      if (methodTokens.length > 0 || digitalTokens.length > 0) {
        sidebarSections.push({
          id: 'acad-methods',
          heading: 'METHODS & SKILLS',
          kind: 'subgroups',
          subgroups: [
            ...(methodTokens.length > 0 ? [{ subtitle: 'Analytical Methods', items: methodTokens }] : []),
            ...(digitalTokens.length > 0 ? [{ subtitle: 'Technical & Digital', items: digitalTokens }] : []),
          ],
        });
      }

      const grants = splitLines(d.grantsAndAwards);
      const training = splitLines(d.technicalTraining);
      if (grants.length > 0 || training.length > 0) {
        const items = [...grants, ...training];
        sidebarSections.push({
          id: 'acad-grants',
          heading: 'GRANTS & TRAINING',
          kind: 'bullets',
          bullets: items,
        });
        trailingSections.push({
          id: 'acad-grants-trail',
          heading: 'GRANTS, FELLOWSHIPS & TRAINING',
          kind: 'bullets',
          bullets: items,
        });
      }

      // Main Column
      if (s(d.researchProfile)) {
        mainSections.push({
          id: 'acad-summary',
          heading: 'RESEARCH PROFILE',
          kind: 'paragraph',
          text: s(d.researchProfile),
        });
      }

      const edus = (d.education || []).filter((e) => e && (s(e.degree) || s(e.institution)));
      if (edus.length > 0) {
        mainSections.push({
          id: 'acad-edu',
          heading: 'EDUCATION',
          kind: 'entries',
          entries: edus.map((e) => ({
            primary: s(e.degree) || 'Academic Degree',
            secondary: join([e.institution, e.location, e.gpaOrHonors], ' · '),
            dateRange: join([e.startYear, e.endYear], ' – '),
            bodyText: s(e.thesisOrCoursework) ? `Thesis: ${s(e.thesisOrCoursework)}` : undefined,
          })),
        });
      }

      const appointments = [
        ...(d.researchAppointments || []),
        ...(d.teachingExperience || []),
        ...(d.professionalExperience || []),
        ...(d.leadershipRoles || []),
      ].filter((e) => e && (s(e.roleTitle) || s(e.organization) || s(e.highlights)));
      if (appointments.length > 0) {
        mainSections.push({
          id: 'acad-exp',
          heading: 'RESEARCH & ACADEMIC APPOINTMENTS',
          kind: 'entries',
          entries: appointments.map((e) => ({
            primary: s(e.roleTitle) || 'Research Appointment',
            secondary: join([e.organization, e.location], ', '),
            dateRange: join([e.startDate, e.endDate], ' – '),
            bullets: splitLines(e.highlights),
          })),
        });
      }

      const pubs = (d.publications || []).filter((p) => p && s(p.citation));
      if (pubs.length > 0) {
        mainSections.push({
          id: 'acad-pubs',
          heading: 'PUBLICATIONS',
          kind: 'bullets',
          bullets: pubs.map((p, idx) =>
            `[${idx + 1}] ${join([p.citation, p.venueOrJournal, p.year, p.doiOrUrl], '. ')}`
          ),
        });
      }

      const projs = (d.selectedProjects || []).filter((p) => p && (s(p.name) || s(p.impactBullets)));
      if (projs.length > 0) {
        mainSections.push({
          id: 'acad-projs',
          heading: 'SELECTED PROJECTS',
          kind: 'entries',
          entries: projs.map((p) => ({
            primary: s(p.name) || 'Project',
            secondary: s(p.roleOrContext) || undefined,
            dateRange: s(p.period) || undefined,
            bullets: splitLines(p.impactBullets),
          })),
        });
      }

      const refs = (d.referees || []).filter((r) => r && s(r.name));
      if (refs.length > 0) {
        const refBullets = refs.map((r) =>
          join([r.name, r.titleAndDepartment, r.institution, r.email], ' — ')
        );
        mainSections.push({
          id: 'acad-refs',
          heading: 'ACADEMIC REFEREES',
          kind: 'bullets',
          bullets: refBullets,
        });
      }

      skillsGridTitle = 'TECHNICAL & ANALYTICAL SKILLS';
      skillsGridItems = [...methodTokens, ...digitalTokens, ...researchTags].slice(0, 12);
      break;
    }

    case 'job_resume': {
      const d = payload.data;
      const h = d.header || ({} as any);
      displayName = s(h.fullName) || 'CANDIDATE NAME';
      displayRole = s(d.targetJobTitle) || s(h.headlineOrTargetRole) || 'PROFESSIONAL TITLE';

      if (s(h.phone)) contacts.push({ icon: 'phone', value: s(h.phone) });
      if (s(h.linkedinOrPortfolio)) contacts.push({ icon: 'link', value: s(h.linkedinOrPortfolio) });
      if (s(h.email)) contacts.push({ icon: 'mail', value: s(h.email) });
      if (s(h.location)) contacts.push({ icon: 'pin', value: s(h.location) });

      const softTokens = splitSkillTokens(d.softAndLeadershipSkills);
      const hardTokens = splitSkillTokens(d.technicalSkills);
      const profileBullets = [
        ...(s(d.targetJobTitle) ? [`Target Role: ${s(d.targetJobTitle)}`] : []),
        ...(s(d.professionalInterests) ? [`Interests: ${s(d.professionalInterests)}`] : []),
      ];
      if (profileBullets.length > 0) {
        sidebarSections.push({
          id: 'job-profile',
          heading: 'PROFILE',
          kind: 'bullets',
          bullets: profileBullets,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'job-contact',
          heading: 'CONTACT',
          kind: 'contacts',
          contacts,
        });
      }

      if (hardTokens.length > 0 || softTokens.length > 0) {
        sidebarSections.push({
          id: 'job-skills-side',
          heading: 'SKILLS',
          kind: 'subgroups',
          subgroups: [
            ...(hardTokens.length > 0 ? [{ subtitle: 'Hard Skills', items: hardTokens }] : []),
            ...(softTokens.length > 0 ? [{ subtitle: 'Soft Skills', items: softTokens }] : []),
          ],
        });
      }

      const validCerts = (d.certifications || []).filter((c) => c && s(c.name));
      const training = splitLines(d.technicalTraining);
      if (validCerts.length > 0 || training.length > 0) {
        const certBullets = [
          ...validCerts.map((c) =>
            join([c.name, c.issuer, c.year, s(c.credentialId) ? `ID: ${s(c.credentialId)}` : ''], ' — ')
          ),
          ...training,
        ];
        sidebarSections.push({
          id: 'job-certs-side',
          heading: 'CERTIFICATIONS',
          kind: 'bullets',
          bullets: certBullets,
        });
        trailingSections.push({
          id: 'job-certs-trail',
          heading: 'CERTIFICATIONS & TRAINING',
          kind: 'bullets',
          bullets: certBullets,
        });
      }

      if (s(d.professionalSummary)) {
        mainSections.push({
          id: 'job-summary',
          heading: 'SUMMARY',
          kind: 'paragraph',
          text: s(d.professionalSummary),
        });
      }

      const workList = [...(d.workExperience || []), ...(d.leadershipRoles || [])].filter(
        (w) => w && (s(w.roleTitle) || s(w.organization) || s(w.highlights))
      );
      if (workList.length > 0) {
        mainSections.push({
          id: 'job-exp',
          heading: 'EXPERIENCE',
          kind: 'entries',
          entries: workList.map((w) => ({
            primary: s(w.roleTitle) || 'Position Title',
            secondary: join([w.organization, w.location], ', '),
            dateRange: join([w.startDate, w.endDate], ' – '),
            bullets: splitLines(w.highlights),
          })),
        });
      }

      const projs = (d.keyProjects || []).filter((p) => p && (s(p.name) || s(p.impactBullets)));
      if (projs.length > 0) {
        mainSections.push({
          id: 'job-projects',
          heading: 'PROJECTS',
          kind: 'entries',
          entries: projs.map((p) => ({
            primary: s(p.name) || 'Key Project',
            secondary: s(p.roleOrContext) || undefined,
            dateRange: s(p.period) || undefined,
            bullets: splitLines(p.impactBullets),
          })),
        });
      }

      const edus = (d.education || []).filter((e) => e && (s(e.degree) || s(e.institution)));
      if (edus.length > 0) {
        mainSections.push({
          id: 'job-edu',
          heading: 'EDUCATION',
          kind: 'entries',
          entries: edus.map((e) => ({
            primary: s(e.degree) || 'Degree',
            secondary: join([e.institution, e.location, e.gpaOrHonors], ' · '),
            dateRange: join([e.startYear, e.endYear], ' – '),
          })),
        });
      }

      const refs = (d.references || []).filter((r) => r && s(r.name));
      if (refs.length > 0 || s(d.referencesNote)) {
        const refBullets = refs.map((r) =>
          join([r.name, r.titleAndDepartment, r.institution, r.email], ' — ')
        );
        if (s(d.referencesNote)) refBullets.push(s(d.referencesNote));
        mainSections.push({
          id: 'job-refs',
          heading: 'REFERENCES',
          kind: 'bullets',
          bullets: refBullets,
        });
      }

      skillsGridTitle = 'SKILLS';
      skillsGridItems = [...hardTokens, ...softTokens].slice(0, 12);
      break;
    }

    case 'sop': {
      const d = payload.data;
      displayName = s(d.applicantName) || 'APPLICANT NAME';
      displayRole =
        join([d.documentTitle || 'Statement of Purpose', d.targetDegreeAndProgram], ' — ') ||
        'STATEMENT OF PURPOSE';

      if (s(d.applicantPhone)) contacts.push({ icon: 'phone', value: s(d.applicantPhone) });
      if (s(d.applicantEmail)) contacts.push({ icon: 'mail', value: s(d.applicantEmail) });
      if (s(d.applicantLocation)) contacts.push({ icon: 'pin', value: s(d.applicantLocation) });

      const appMeta: string[] = [];
      if (s(d.targetDegreeAndProgram)) appMeta.push(`Program: ${s(d.targetDegreeAndProgram)}`);
      if (s(d.targetInstitution)) appMeta.push(`University: ${s(d.targetInstitution)}`);
      if (s(d.targetDepartment)) appMeta.push(`Department: ${s(d.targetDepartment)}`);
      if (s(d.intendedTerm)) appMeta.push(`Term: ${s(d.intendedTerm)}`);
      if (appMeta.length > 0) {
        sidebarSections.push({
          id: 'sop-profile',
          heading: 'ADMISSIONS PROFILE',
          kind: 'bullets',
          bullets: appMeta,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'sop-contact',
          heading: 'CONTACT',
          kind: 'contacts',
          contacts,
        });
      }

      const fitHighlights = splitSkillTokens(d.targetFacultyOrLab);
      if (fitHighlights.length > 0) {
        sidebarSections.push({
          id: 'sop-fit',
          heading: 'FACULTY & LAB FIT',
          kind: 'bullets',
          bullets: fitHighlights,
        });
      }

      const sopParts: Array<{ heading: string; text: string }> = [
        { heading: 'OPENING MOTIVATION', text: s(d.openingMotivation) },
        { heading: 'ACADEMIC FOUNDATION', text: s(d.academicFoundation) },
        { heading: 'RESEARCH & PRACTICAL EXPERIENCE', text: s(d.researchAndPracticalExperience) },
        { heading: 'PROGRAM & FACULTY ALIGNMENT', text: s(d.programAndFacultyFit) },
        { heading: 'CAREER GOALS & CLOSING', text: s(d.careerGoalsAndClosing) },
      ];
      sopParts.forEach((part, idx) => {
        if (part.text) {
          mainSections.push({
            id: `sop-sec-${idx}`,
            heading: part.heading,
            kind: 'paragraphs',
            paragraphs: splitParagraphs(part.text),
          });
        }
      });

      if (s(d.applicantName)) {
        mainSections.push({
          id: 'sop-sign',
          heading: 'SUBMISSION',
          kind: 'signature',
          signature: {
            signOff: 'Respectfully submitted,',
            name: s(d.applicantName),
            subline: join([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
          },
        });
      }

      skillsGridTitle = 'TARGET ALIGNMENT';
      skillsGridItems = [...appMeta, ...fitHighlights].slice(0, 8);
      break;
    }

    case 'personal_statement': {
      const d = payload.data;
      displayName = s(d.applicantName) || 'APPLICANT NAME';
      displayRole =
        join([d.documentTitle || 'Personal Statement', d.targetProgramOrOpportunity], ' — ') ||
        'PERSONAL STATEMENT';

      if (s(d.applicantPhone)) contacts.push({ icon: 'phone', value: s(d.applicantPhone) });
      if (s(d.applicantEmail)) contacts.push({ icon: 'mail', value: s(d.applicantEmail) });
      if (s(d.applicantLocation)) contacts.push({ icon: 'pin', value: s(d.applicantLocation) });

      const overviewMeta: string[] = [];
      if (s(d.targetProgramOrOpportunity))
        overviewMeta.push(`Opportunity: ${s(d.targetProgramOrOpportunity)}`);
      if (s(d.targetOrganization)) overviewMeta.push(`Host: ${s(d.targetOrganization)}`);
      if (overviewMeta.length > 0) {
        sidebarSections.push({
          id: 'ps-overview',
          heading: 'APPLICATION FOCUS',
          kind: 'bullets',
          bullets: overviewMeta,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'ps-contact',
          heading: 'CONTACT',
          kind: 'contacts',
          contacts,
        });
      }

      const psParts = [
        { heading: 'DEFINING ORIGIN & STORY', text: s(d.definingStoryAndOrigin) },
        { heading: 'CHALLENGES & RESILIENCE', text: s(d.challengesAndResilience) },
        { heading: 'LEADERSHIP & CHARACTER', text: s(d.leadershipAndCharacter) },
        { heading: 'VALUES & FUTURE CONTRIBUTION', text: s(d.valuesAndFutureContribution) },
      ];
      psParts.forEach((part, idx) => {
        if (part.text) {
          mainSections.push({
            id: `ps-sec-${idx}`,
            heading: part.heading,
            kind: 'paragraphs',
            paragraphs: splitParagraphs(part.text),
          });
        }
      });

      if (s(d.applicantName)) {
        mainSections.push({
          id: 'ps-sign',
          heading: 'CLOSING',
          kind: 'signature',
          signature: {
            signOff: 'Sincerely,',
            name: s(d.applicantName),
            subline: join([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
          },
        });
      }

      skillsGridTitle = 'STATEMENT OVERVIEW';
      skillsGridItems = overviewMeta;
      break;
    }

    case 'scholarship_letter': {
      const d = payload.data;
      displayName = s(d.applicantName) || 'APPLICANT NAME';
      displayRole = s(d.scholarshipName)
        ? `SCHOLARSHIP APPLICATION — ${s(d.scholarshipName).toUpperCase()}`
        : 'SCHOLARSHIP MOTIVATION LETTER';

      if (s(d.applicantPhone)) contacts.push({ icon: 'phone', value: s(d.applicantPhone) });
      if (s(d.applicantEmail)) contacts.push({ icon: 'mail', value: s(d.applicantEmail) });
      if (s(d.applicantAddress)) contacts.push({ icon: 'pin', value: s(d.applicantAddress) });
      if (s(d.letterDate)) contacts.push({ icon: 'date', value: s(d.letterDate) });

      const recipientBullets = [
        s(d.recipientTitle) || 'Scholarship Selection Committee',
        s(d.scholarshipName),
        s(d.sponsoringOrganization),
        s(d.hostCountryOrUniversity),
        s(d.letterDate) ? `Date: ${s(d.letterDate)}` : '',
      ].filter(Boolean);

      if (recipientBullets.length > 0) {
        sidebarSections.push({
          id: 'sch-recipient',
          heading: 'AWARD & RECIPIENT',
          kind: 'bullets',
          bullets: recipientBullets,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'sch-contact',
          heading: 'APPLICANT DETAILS',
          kind: 'contacts',
          contacts,
        });
      }

      const subject =
        s(d.subjectLine) ||
        (s(d.scholarshipName) ? `RE: Application for ${s(d.scholarshipName)}` : '');
      if (subject) {
        mainSections.push({
          id: 'sch-subject',
          heading: 'SUBJECT & SALUTATION',
          kind: 'paragraphs',
          paragraphs: [subject, s(d.salutation) || 'Dear Scholarship Selection Committee,'],
        });
      } else {
        mainSections.push({
          id: 'sch-salutation',
          heading: 'SALUTATION',
          kind: 'paragraph',
          text: s(d.salutation) || 'Dear Scholarship Selection Committee,',
        });
      }

      const letterSections = [
        { heading: 'PURPOSE & ACADEMIC STANDING', text: s(d.purposeAndStanding) },
        { heading: 'MOTIVATION & MERIT', text: s(d.motivationAndMerit) },
        { heading: 'FINANCIAL NEED CONTEXT', text: s(d.financialNeedContext) },
        { heading: 'IMPACT & COMMITMENT', text: s(d.impactAndCommitment) },
      ];
      letterSections.forEach((sec, idx) => {
        if (sec.text) {
          mainSections.push({
            id: `sch-body-${idx}`,
            heading: sec.heading,
            kind: 'paragraphs',
            paragraphs: splitParagraphs(sec.text),
          });
        }
      });

      mainSections.push({
        id: 'sch-sign',
        heading: 'SIGN-OFF',
        kind: 'signature',
        signature: {
          signOff: s(d.signOff) || 'Yours faithfully,',
          name: s(d.applicantName) || 'Applicant',
          subline: join([d.applicantEmail, d.applicantPhone], ' · ') || undefined,
        },
      });

      skillsGridTitle = 'SCHOLARSHIP SUMMARY';
      skillsGridItems = recipientBullets;
      break;
    }

    case 'research_proposal': {
      const d = payload.data;
      displayName = s(d.proposalTitle) || 'RESEARCH PROPOSAL';
      displayRole =
        join(
          [
            s(d.applicantName) ? `PI: ${s(d.applicantName)}` : '',
            s(d.targetInstitution),
            s(d.targetDepartment),
          ],
          ' · '
        ) || 'RESEARCH PROPOSAL';

      if (s(d.applicantName)) contacts.push({ icon: 'id', value: `PI: ${s(d.applicantName)}` });
      if (s(d.applicantEmail)) contacts.push({ icon: 'mail', value: s(d.applicantEmail) });
      if (s(d.targetInstitution)) contacts.push({ icon: 'pin', value: s(d.targetInstitution) });
      if (s(d.proposedSupervisor))
        contacts.push({ icon: 'link', value: `Supervisor: ${s(d.proposedSupervisor)}` });

      const hostMeta = [
        s(d.targetInstitution) ? `Institution: ${s(d.targetInstitution)}` : '',
        s(d.targetDepartment) ? `Department: ${s(d.targetDepartment)}` : '',
        s(d.proposedSupervisor) ? `Supervisor: ${s(d.proposedSupervisor)}` : '',
      ].filter(Boolean);

      if (hostMeta.length > 0) {
        sidebarSections.push({
          id: 'rp-meta',
          heading: 'PROPOSAL META',
          kind: 'bullets',
          bullets: hostMeta,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'rp-contact',
          heading: 'INVESTIGATOR',
          kind: 'contacts',
          contacts,
        });
      }

      const kwTokens = splitSkillTokens(d.keywords);
      if (kwTokens.length > 0) {
        sidebarSections.push({
          id: 'rp-keywords',
          heading: 'KEYWORDS',
          kind: 'bullets',
          bullets: kwTokens,
        });
      }

      if (s(d.budgetOrResourceNeeds)) {
        sidebarSections.push({
          id: 'rp-budget',
          heading: 'RESOURCES & BUDGET',
          kind: 'bullets',
          bullets: splitLines(d.budgetOrResourceNeeds),
        });
      }

      if (s(d.abstractSummary)) {
        mainSections.push({
          id: 'rp-abstract',
          heading: 'ABSTRACT',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.abstractSummary),
        });
      }

      if (s(d.problemStatement)) {
        mainSections.push({
          id: 'rp-problem',
          heading: 'PROBLEM STATEMENT',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.problemStatement),
        });
      }

      const rqs = splitLines(d.researchQuestions);
      if (rqs.length > 0) {
        mainSections.push({
          id: 'rp-rqs',
          heading: 'RESEARCH QUESTIONS',
          kind: 'bullets',
          bullets: rqs,
        });
      }

      if (s(d.literatureGap)) {
        mainSections.push({
          id: 'rp-lit',
          heading: 'LITERATURE GAP',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.literatureGap),
        });
      }

      if (s(d.methodologyDesign)) {
        mainSections.push({
          id: 'rp-method',
          heading: 'METHODOLOGY',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.methodologyDesign),
        });
      }

      if (s(d.expectedContributions)) {
        mainSections.push({
          id: 'rp-contrib',
          heading: 'EXPECTED OUTCOMES',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.expectedContributions),
        });
      }

      const milestones = (d.timelineMilestones || []).filter(
        (m) => m && (s(m.phase) || s(m.timeframe) || s(m.deliverable))
      );
      if (milestones.length > 0) {
        mainSections.push({
          id: 'rp-timeline',
          heading: 'TIMELINE & MILESTONES',
          kind: 'entries',
          entries: milestones.map((m) => ({
            primary: s(m.phase) || 'Research Phase',
            dateRange: s(m.timeframe) || undefined,
            bodyText: s(m.deliverable) || undefined,
          })),
        });
      }

      const refs = splitLines(d.keyReferences);
      if (refs.length > 0) {
        mainSections.push({
          id: 'rp-refs',
          heading: 'KEY REFERENCES',
          kind: 'bullets',
          bullets: refs.map((r, i) => `[${i + 1}] ${r}`),
        });
      }

      skillsGridTitle = 'RESEARCH KEYWORDS';
      skillsGridItems = kwTokens.slice(0, 12);
      if (s(d.budgetOrResourceNeeds)) {
        trailingSections.push({
          id: 'rp-budget-trail',
          heading: 'RESOURCES & EQUIPMENT',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.budgetOrResourceNeeds),
        });
      }
      break;
    }

    case 'study_plan': {
      const d = payload.data;
      displayName = s(d.applicantName) || 'APPLICANT NAME';
      displayRole =
        join([d.documentTitle || 'Academic Study Plan', d.targetDegree], ' — ') ||
        'ACADEMIC STUDY PLAN';

      if (s(d.applicantEmail)) contacts.push({ icon: 'mail', value: s(d.applicantEmail) });
      if (s(d.applicantLocation)) contacts.push({ icon: 'pin', value: s(d.applicantLocation) });

      const programMeta = [
        s(d.targetDegree) ? `Degree: ${s(d.targetDegree)}` : '',
        s(d.hostInstitution) ? `Institution: ${s(d.hostInstitution)}` : '',
        s(d.hostCountry) ? `Country: ${s(d.hostCountry)}` : '',
        s(d.programDuration) ? `Duration: ${s(d.programDuration)}` : '',
      ].filter(Boolean);

      if (programMeta.length > 0) {
        sidebarSections.push({
          id: 'sp-meta',
          heading: 'PROGRAM DETAILS',
          kind: 'bullets',
          bullets: programMeta,
        });
      }

      if (contacts.length > 0) {
        sidebarSections.push({
          id: 'sp-contact',
          heading: 'CONTACT',
          kind: 'contacts',
          contacts,
        });
      }

      const prepTokens = splitLines(d.languageAndTechnicalPrep);
      if (prepTokens.length > 0) {
        sidebarSections.push({
          id: 'sp-prep',
          heading: 'LANGUAGE & TECH PREP',
          kind: 'bullets',
          bullets: prepTokens,
        });
      }

      if (s(d.academicBackground)) {
        mainSections.push({
          id: 'sp-bg',
          heading: 'ACADEMIC BACKGROUND',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.academicBackground),
        });
      }

      if (s(d.purposeAndSpecialization)) {
        mainSections.push({
          id: 'sp-purpose',
          heading: 'PURPOSE & SPECIALIZATION',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.purposeAndSpecialization),
        });
      }

      const terms = (d.studyTerms || []).filter(
        (t) => t && (s(t.termLabel) || s(t.courses) || s(t.academicGoal))
      );
      if (terms.length > 0) {
        mainSections.push({
          id: 'sp-terms',
          heading: 'TERM-BY-TERM COURSEWORK',
          kind: 'entries',
          entries: terms.map((item) => ({
            primary: s(item.termLabel) || 'Academic Term',
            secondary: s(item.courses) ? `Courses: ${s(item.courses)}` : undefined,
            bodyText: s(item.academicGoal) ? `Goal: ${s(item.academicGoal)}` : undefined,
          })),
        });
      }

      if (s(d.postStudyCareerImpact)) {
        mainSections.push({
          id: 'sp-impact',
          heading: 'POST-STUDY CAREER IMPACT',
          kind: 'paragraphs',
          paragraphs: splitParagraphs(d.postStudyCareerImpact),
        });
      }

      if (s(d.applicantName)) {
        mainSections.push({
          id: 'sp-sign',
          heading: 'DECLARATION',
          kind: 'signature',
          signature: {
            signOff: 'Prepared by,',
            name: s(d.applicantName),
            subline: join([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
          },
        });
      }

      skillsGridTitle = 'PREPARATION & PROGRAM FOCUS';
      skillsGridItems = [...programMeta, ...prepTokens].slice(0, 12);
      break;
    }
  }

  const inlineContactLine = contacts.map((c) => c.value).filter(Boolean).join('  •  ');

  // Build clean Swiss Minimal single-column sequence without losing any field
  const swissSections: TemplateSection[] = [];
  const usedIds = new Set<string>();
  const addSwiss = (sec: TemplateSection) => {
    if (!usedIds.has(sec.id)) {
      usedIds.add(sec.id);
      swissSections.push(sec);
    }
  };

  // Summary / abstract / first paragraph section first
  mainSections.forEach((sec) => {
    if (
      sec.id.includes('summary') ||
      sec.id.includes('abstract') ||
      sec.id.includes('subject') ||
      sec.id.includes('salutation') ||
      sec.id.includes('bg') ||
      sec.id.includes('sec-0')
    ) {
      addSwiss(sec);
    }
  });

  // Add non-contact sidebar metadata if essay/proposal/study plan
  if (
    payload.category === 'sop' ||
    payload.category === 'personal_statement' ||
    payload.category === 'scholarship_letter' ||
    payload.category === 'research_proposal' ||
    payload.category === 'study_plan'
  ) {
    sidebarSections
      .filter((sec) => sec.kind !== 'contacts')
      .forEach((sec) => addSwiss(sec));
  }

  mainSections.forEach((sec) => addSwiss(sec));

  // Add 4-column skills grid section for Swiss Minimal if present
  if (skillsGridItems.length > 0) {
    addSwiss({
      id: 'swiss-skills-grid',
      heading: skillsGridTitle,
      kind: 'bullets',
      bullets: skillsGridItems,
    });
  }

  trailingSections.forEach((sec) => addSwiss(sec));

  // Also include profile bullets on Swiss for CV/Resume if not redundant
  sidebarSections
    .filter(
      (sec) =>
        sec.kind !== 'contacts' &&
        !sec.id.includes('skills-side') &&
        !sec.id.includes('certs-side') &&
        !sec.id.includes('grants') &&
        !sec.id.includes('methods')
    )
    .forEach((sec) => addSwiss(sec));

  const density = computeDensity(
    [...sidebarSections, ...mainSections, ...trailingSections],
    skillsGridItems
  );

  return {
    category: payload.category,
    templateId,
    displayName,
    displayRole,
    inlineContactLine,
    passportImageUrl: s(payload.passportImageUrl) || undefined,
    footerMotto: displayRole || 'Committed to Excellence & Continuous Innovation',
    contacts,
    sidebarSections,
    mainSections,
    skillsGridTitle,
    skillsGridItems,
    trailingSections,
    swissSections,
    density,
  };
};

// ============================================================================
// TWO-PAGE STEEL BLUE EDITORIAL MODEL BUILDER (Screenshots 1 & 2)
// ============================================================================

export const buildTwoPageDocumentModel = (
  payload: DocumentFormPayload
): TwoPageDocumentModel => {
  const sp = buildSinglePageDocumentModel(payload);
  const page1Left: TemplateSection[] = [];
  const page1Right: TemplateSection[] = [];
  const page2Left: TemplateSection[] = [];
  const page2Right: TemplateSection[] = [];
  const page2FullWidth: TemplateSection[] = [];

  // 1. Contact Details always starts Page 1 Left
  const contactSec = sp.sidebarSections.find((sec) => sec.kind === 'contacts');
  if (contactSec) {
    page1Left.push({ ...contactSec, heading: 'Contact Details' });
  }

  // 2. Skills / Key Competencies / Focus on Page 1 Left
  const skillSec = sp.sidebarSections.find(
    (sec) =>
      sec.id.includes('skills') ||
      sec.id.includes('methods') ||
      sec.id.includes('keywords') ||
      sec.id.includes('meta') ||
      sec.id.includes('fit') ||
      sec.id.includes('overview') ||
      sec.id.includes('recipient')
  );
  if (skillSec) {
    const flattenedBullets =
      skillSec.bullets ||
      skillSec.subgroups?.flatMap((g) => g.items) ||
      [];
    if (flattenedBullets.length > 0) {
      page1Left.push({
        id: 'tp-key-skills',
        heading:
          payload.category === 'international_cv' || payload.category === 'job_resume'
            ? 'Key Skills'
            : skillSec.heading,
        kind: 'bullets',
        bullets: flattenedBullets.slice(0, 10),
      });
    }
  } else if (sp.skillsGridItems.length > 0) {
    page1Left.push({
      id: 'tp-key-skills-grid',
      heading: 'Key Skills',
      kind: 'bullets',
      bullets: sp.skillsGridItems.slice(0, 10),
    });
  }

  // 3. Qualifications / Certifications / Languages / Grants on Page 1 Left
  const qualSec = sp.sidebarSections.find(
    (sec) =>
      sec.id.includes('certs') ||
      sec.id.includes('grants') ||
      sec.id.includes('languages') ||
      sec.id.includes('prep') ||
      sec.id.includes('budget')
  );
  if (qualSec) {
    page1Left.push({
      ...qualSec,
      heading:
        qualSec.id.includes('certs')
          ? 'Professional Qualifications'
          : qualSec.heading,
    });
  }

  // 4. Profile / Summary / Abstract / Opening on Page 1 Right
  const profileSec = sp.mainSections.find(
    (sec) =>
      sec.id.includes('summary') ||
      sec.id.includes('abstract') ||
      sec.id.includes('sec-0') ||
      sec.id.includes('subject') ||
      sec.id.includes('bg')
  );
  if (profileSec) {
    page1Right.push({
      ...profileSec,
      heading:
        payload.category === 'international_cv' ||
        payload.category === 'job_resume' ||
        payload.category === 'academic_resume'
          ? 'Profile'
          : profileSec.heading,
    });
  }

  // 5. Partition Remaining Main Sections cleanly across Page 1 Right, Page 2 Left, Page 2 Right, and Page 2 Full Width
  const remainingMain = sp.mainSections.filter((sec) => sec.id !== profileSec?.id);

  const eduSec = remainingMain.find((sec) => sec.id.includes('edu'));
  if (eduSec) {
    page2Left.push({ ...eduSec, heading: 'Education' });
  } else {
    // For non-CV categories (e.g., SOP/Proposal/Study Plan), place secondary sidebar meta or prep on Page 2 Left
    const extraLeft = sp.sidebarSections.find(
      (sec) =>
        sec.kind !== 'contacts' &&
        sec.id !== skillSec?.id &&
        sec.id !== qualSec?.id
    );
    if (extraLeft) {
      page2Left.push(extraLeft);
    }
  }

  const expSec = remainingMain.find((sec) => sec.id.includes('exp'));
  if (expSec && expSec.kind === 'entries' && expSec.entries && expSec.entries.length > 0) {
    const splitAt = Math.min(2, expSec.entries.length);
    page1Right.push({
      ...expSec,
      id: `${expSec.id}-p1`,
      heading: 'Experience',
      entries: expSec.entries.slice(0, splitAt),
    });
    if (expSec.entries.length > splitAt) {
      page2Right.push({
        ...expSec,
        id: `${expSec.id}-p2`,
        heading: 'Experience (Continued)',
        entries: expSec.entries.slice(splitAt),
      });
    }
  }

  // Handle all other remaining sections (Projects, Publications, Essays, Methodology, Milestones, Study Terms, etc.)
  const handledIds = new Set<string>([
    ...(profileSec ? [profileSec.id] : []),
    ...(eduSec ? [eduSec.id] : []),
    ...(expSec ? [expSec.id] : []),
  ]);

  const middleSections = remainingMain.filter(
    (sec) =>
      !handledIds.has(sec.id) &&
      !sec.id.includes('refs') &&
      !sec.id.includes('sign')
  );

  // If no Experience section existed (e.g. SOP / Proposal / Study Plan), distribute cleanly: first 2 to Page 1 Right, rest to Page 2 Right
  if (!expSec) {
    middleSections.forEach((sec, idx) => {
      if (idx < 2) {
        page1Right.push(sec);
      } else if (idx < 5) {
        page2Right.push(sec);
      } else {
        page2FullWidth.push(sec);
      }
    });
  } else {
    // CV/Resume has Experience split, so put Projects/Publications on Page 2 Right
    middleSections.forEach((sec) => page2Right.push(sec));
  }

  // Trailing sections & Interests -> Page 2 Full Width
  const profileExtraSec = sp.sidebarSections.find((sec) => sec.id.includes('profile'));
  if (profileExtraSec && profileExtraSec.bullets && profileExtraSec.bullets.length > 0) {
    page2FullWidth.push({
      id: 'tp-interests',
      heading:
        payload.category === 'international_cv' || payload.category === 'job_resume'
          ? 'Interests & Highlights'
          : profileExtraSec.heading,
      kind: 'bullets',
      bullets: profileExtraSec.bullets,
    });
  }

  sp.trailingSections.forEach((sec) => {
    if (!page1Left.some((x) => x.id === sec.id)) {
      page2FullWidth.push(sec);
    }
  });

  // References & Signatures -> Page 2 Full Width at bottom (matching Screenshot 2)
  remainingMain
    .filter((sec) => sec.id.includes('refs') || sec.id.includes('sign'))
    .forEach((sec) => page2FullWidth.push(sec));

  // If Page 2 Left ended up empty (e.g. an essay with no Education), pull one concise metadata section or quick summary box so Page 2's 2-column spine looks balanced
  if (page2Left.length === 0 && page2Right.length > 1) {
    const moved = page2Right.shift();
    if (moved) page2Left.push(moved);
  }

  return {
    category: payload.category,
    displayName: sp.displayName,
    displayRole: sp.displayRole,
    passportImageUrl: sp.passportImageUrl,
    footerName: sp.displayName,
    page1Left,
    page1Right,
    page2Left,
    page2Right,
    page2FullWidth,
    density: sp.density,
  };
};
