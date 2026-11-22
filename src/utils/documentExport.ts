import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import {
  DocumentFormPayload,
  extractDocumentTitle,
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
  fontMode: 'sans' | 'serif';
  headerStyle: 'ats-centered' | 'ats-left' | 'academic-essay' | 'formal-letter' | 'research-title' | 'study-plan';
  title: string;
  subtitle?: string;
  contactLine?: string;
  secondaryContactLine?: string;
  blocks: BlueprintBlock[];
}

const cleanLines = (raw: string): string[] =>
  raw
    .split(/\r?\n/)
    .map((s) => s.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

const joinNonEmpty = (parts: Array<string | undefined | null>, sep = '  |  '): string =>
  parts
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(sep);

export const buildDocumentBlueprint = (payload: DocumentFormPayload): DocumentBlueprint => {
  switch (payload.category) {
    case 'international_cv': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      if (d.professionalSummary.trim()) {
        blocks.push({ kind: 'section-heading', title: 'PROFESSIONAL SUMMARY' });
        blocks.push({
          kind: 'paragraph',
          text: d.professionalSummary.trim(),
          align: 'left',
        });
      }

      if (d.coreCompetencies.trim()) {
        blocks.push({ kind: 'section-heading', title: 'CORE COMPETENCIES' });
        blocks.push({
          kind: 'paragraph',
          text: d.coreCompetencies.trim(),
          align: 'left',
        });
      }

      const validExps = d.experiences.filter(
        (e) => e.roleTitle.trim() || e.organization.trim() || e.highlights.trim()
      );
      if (validExps.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'PROFESSIONAL EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validExps.map((e) => ({
            primaryLeft: e.roleTitle.trim() || 'Role',
            primaryRight: joinNonEmpty([e.startDate, e.endDate], ' – '),
            secondaryLeft: joinNonEmpty([e.organization, e.location], ', '),
            bullets: cleanLines(e.highlights),
          })),
        });
      }

      const validEdu = d.education.filter((e) => e.degree.trim() || e.institution.trim());
      if (validEdu.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EDUCATION' });
        blocks.push({
          kind: 'entries',
          items: validEdu.map((e) => ({
            primaryLeft: e.degree.trim() || 'Degree',
            primaryRight: joinNonEmpty([e.startYear, e.endYear], ' – '),
            secondaryLeft: joinNonEmpty([e.institution, e.location], ', '),
            secondaryRight: e.gpaOrHonors?.trim() || undefined,
            bodyText: e.thesisOrCoursework?.trim() || undefined,
          })),
        });
      }

      const validCerts = d.certifications.filter((c) => c.name.trim());
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
                c.credentialId ? `ID: ${c.credentialId}` : '',
              ],
              ' — '
            )
          ),
        });
      }

      const validLangs = d.languages.filter((l) => l.language.trim());
      if (validLangs.length > 0 || d.nationalityOrWorkAuth.trim()) {
        blocks.push({ kind: 'section-heading', title: 'LANGUAGES & ELIGIBILITY' });
        if (validLangs.length > 0) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Languages',
            value: validLangs
              .map((l) =>
                l.proficiency.trim() ? `${l.language.trim()} (${l.proficiency.trim()})` : l.language.trim()
              )
              .join('  •  '),
          });
        }
        if (d.nationalityOrWorkAuth.trim()) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Work Authorization / Mobility',
            value: d.nationalityOrWorkAuth.trim(),
          });
        }
      }

      return {
        category: 'international_cv',
        fontMode: 'sans',
        headerStyle: 'ats-centered',
        title: d.header.fullName.trim() || 'APPLICANT NAME',
        subtitle: d.header.headlineOrTargetRole.trim() || undefined,
        contactLine: joinNonEmpty([
          d.header.location,
          d.header.phone,
          d.header.email,
        ]),
        secondaryContactLine: joinNonEmpty([
          d.header.linkedinOrPortfolio,
          d.orcidOrGithub,
        ]),
        blocks,
      };
    }

    case 'academic_resume': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      if (d.researchProfile.trim() || d.researchInterests.trim()) {
        blocks.push({ kind: 'section-heading', title: 'RESEARCH PROFILE & INTERESTS' });
        if (d.researchProfile.trim()) {
          blocks.push({ kind: 'paragraph', text: d.researchProfile.trim(), align: 'justify' });
        }
        if (d.researchInterests.trim()) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Research Areas',
            value: d.researchInterests.trim(),
          });
        }
      }

      const validEdu = d.education.filter((e) => e.degree.trim() || e.institution.trim());
      if (validEdu.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EDUCATION & ACADEMIC TRAINING' });
        blocks.push({
          kind: 'entries',
          items: validEdu.map((e) => ({
            primaryLeft: e.degree.trim(),
            primaryRight: joinNonEmpty([e.startYear, e.endYear], ' – '),
            secondaryLeft: joinNonEmpty([e.institution, e.location], ', '),
            secondaryRight: e.gpaOrHonors?.trim() || undefined,
            bodyText: e.thesisOrCoursework?.trim()
              ? `Thesis / Focus: ${e.thesisOrCoursework.trim()}`
              : undefined,
          })),
        });
      }

      const validRes = d.researchAppointments.filter(
        (r) => r.roleTitle.trim() || r.organization.trim() || r.highlights.trim()
      );
      if (validRes.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'RESEARCH APPOINTMENTS & EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validRes.map((r) => ({
            primaryLeft: r.roleTitle.trim(),
            primaryRight: joinNonEmpty([r.startDate, r.endDate], ' – '),
            secondaryLeft: joinNonEmpty([r.organization, r.location], ', '),
            bullets: cleanLines(r.highlights),
          })),
        });
      }

      const validTeach = d.teachingExperience.filter(
        (t) => t.roleTitle.trim() || t.organization.trim() || t.highlights.trim()
      );
      if (validTeach.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'TEACHING & MENTORSHIP EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validTeach.map((t) => ({
            primaryLeft: t.roleTitle.trim(),
            primaryRight: joinNonEmpty([t.startDate, t.endDate], ' – '),
            secondaryLeft: joinNonEmpty([t.organization, t.location], ', '),
            bullets: cleanLines(t.highlights),
          })),
        });
      }

      const validPubs = d.publications.filter((p) => p.citation.trim());
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

      if (d.grantsAndAwards.trim()) {
        blocks.push({ kind: 'section-heading', title: 'GRANTS, FELLOWSHIPS & HONORS' });
        blocks.push({ kind: 'bullet-list', items: cleanLines(d.grantsAndAwards) });
      }

      if (d.technicalMethods.trim()) {
        blocks.push({ kind: 'section-heading', title: 'LABORATORY, COMPUTATIONAL & ANALYTICAL METHODS' });
        blocks.push({ kind: 'paragraph', text: d.technicalMethods.trim(), align: 'left' });
      }

      const validRefs = d.referees.filter((r) => r.name.trim());
      if (validRefs.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'ACADEMIC REFEREES' });
        blocks.push({
          kind: 'bullet-list',
          items: validRefs.map((r) =>
            joinNonEmpty([r.name, r.titleAndDepartment, r.institution, r.email], ' — ')
          ),
        });
      }

      return {
        category: 'academic_resume',
        fontMode: 'serif',
        headerStyle: 'ats-centered',
        title: d.header.fullName.trim() || 'SCHOLAR NAME',
        subtitle:
          joinNonEmpty([d.academicTitleOrField, d.header.headlineOrTargetRole], ' · ') || undefined,
        contactLine: joinNonEmpty([d.header.location, d.header.email, d.header.phone]),
        secondaryContactLine: joinNonEmpty([d.header.linkedinOrPortfolio, d.orcidOrScholarUrl]),
        blocks,
      };
    }

    case 'job_resume': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      if (d.professionalSummary.trim()) {
        blocks.push({ kind: 'section-heading', title: 'EXECUTIVE SUMMARY' });
        blocks.push({ kind: 'paragraph', text: d.professionalSummary.trim(), align: 'left' });
      }

      if (d.technicalSkills.trim() || d.softAndLeadershipSkills.trim()) {
        blocks.push({ kind: 'section-heading', title: 'CORE SKILLS & COMPETENCIES' });
        if (d.technicalSkills.trim()) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Technical Stack',
            value: d.technicalSkills.trim(),
          });
        }
        if (d.softAndLeadershipSkills.trim()) {
          blocks.push({
            kind: 'labeled-line',
            label: 'Leadership & Operations',
            value: d.softAndLeadershipSkills.trim(),
          });
        }
      }

      const validWork = d.workExperience.filter(
        (w) => w.roleTitle.trim() || w.organization.trim() || w.highlights.trim()
      );
      if (validWork.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'WORK EXPERIENCE' });
        blocks.push({
          kind: 'entries',
          items: validWork.map((w) => ({
            primaryLeft: w.roleTitle.trim(),
            primaryRight: joinNonEmpty([w.startDate, w.endDate], ' – '),
            secondaryLeft: joinNonEmpty([w.organization, w.location], ', '),
            bullets: cleanLines(w.highlights),
          })),
        });
      }

      const validProjects = d.keyProjects.filter((p) => p.name.trim() || p.impactBullets.trim());
      if (validProjects.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'KEY PROJECTS & DELIVERABLES' });
        blocks.push({
          kind: 'entries',
          items: validProjects.map((p) => ({
            primaryLeft: p.name.trim(),
            primaryRight: p.period.trim() || undefined,
            secondaryLeft: p.roleOrContext.trim() || undefined,
            bullets: cleanLines(p.impactBullets),
          })),
        });
      }

      const validEdu = d.education.filter((e) => e.degree.trim() || e.institution.trim());
      if (validEdu.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'EDUCATION' });
        blocks.push({
          kind: 'entries',
          items: validEdu.map((e) => ({
            primaryLeft: e.degree.trim(),
            primaryRight: joinNonEmpty([e.startYear, e.endYear], ' – '),
            secondaryLeft: joinNonEmpty([e.institution, e.location], ', '),
            secondaryRight: e.gpaOrHonors?.trim() || undefined,
          })),
        });
      }

      const validCerts = d.certifications.filter((c) => c.name.trim());
      if (validCerts.length > 0) {
        blocks.push({ kind: 'section-heading', title: 'CERTIFICATIONS' });
        blocks.push({
          kind: 'bullet-list',
          items: validCerts.map((c) =>
            joinNonEmpty([c.name, c.issuer, c.year], ' — ')
          ),
        });
      }

      return {
        category: 'job_resume',
        fontMode: 'sans',
        headerStyle: 'ats-left',
        title: d.header.fullName.trim() || 'CANDIDATE NAME',
        subtitle: d.targetJobTitle.trim() || d.header.headlineOrTargetRole.trim() || undefined,
        contactLine: joinNonEmpty([d.header.location, d.header.phone, d.header.email]),
        secondaryContactLine: d.header.linkedinOrPortfolio.trim() || undefined,
        blocks,
      };
    }

    case 'sop': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];
      const metaRows = [
        { label: 'Applicant', value: d.applicantName.trim() },
        { label: 'Target Program', value: d.targetDegreeAndProgram.trim() },
        { label: 'Institution', value: joinNonEmpty([d.targetInstitution, d.targetDepartment], ' — ') },
        { label: 'Intended Term', value: d.intendedTerm.trim() },
        { label: 'Faculty / Lab Focus', value: d.targetFacultyOrLab.trim() },
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
        .map((p) => p.trim())
        .filter(Boolean);

      essayParts.forEach((p) => {
        p.split(/\n{2,}/).forEach((para) => {
          if (para.trim()) {
            blocks.push({
              kind: 'paragraph',
              text: para.trim(),
              align: 'justify',
              spacingAfter: 3.5,
            });
          }
        });
      });

      if (d.applicantName.trim()) {
        blocks.push({
          kind: 'signature',
          signOff: 'Respectfully submitted,',
          name: d.applicantName.trim(),
          subline: joinNonEmpty([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
        });
      }

      return {
        category: 'sop',
        fontMode: 'serif',
        headerStyle: 'academic-essay',
        title: d.documentTitle.trim() || 'Statement of Purpose',
        subtitle: joinNonEmpty([d.targetDegreeAndProgram, d.targetInstitution], ' — ') || undefined,
        contactLine: joinNonEmpty([d.applicantName, d.applicantEmail, d.applicantPhone, d.applicantLocation]),
        blocks,
      };
    }

    case 'personal_statement': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      const metaRows = [
        { label: 'Applicant', value: d.applicantName.trim() },
        { label: 'Opportunity', value: d.targetProgramOrOpportunity.trim() },
        { label: 'Organization', value: d.targetOrganization.trim() },
      ].filter((r) => r.value);
      if (metaRows.length > 0) {
        blocks.push({ kind: 'meta-grid', rows: metaRows });
      }

      const sections = [
        { heading: 'Personal Origin & Motivation', text: d.definingStoryAndOrigin },
        { heading: 'Resilience & Growth', text: d.challengesAndResilience },
        { heading: 'Leadership & Character', text: d.leadershipAndCharacter },
        { heading: 'Values Alignment & Future Impact', text: d.valuesAndFutureContribution },
      ];

      sections.forEach((sec) => {
        if (sec.text.trim()) {
          blocks.push({ kind: 'section-heading', title: sec.heading });
          sec.text
            .trim()
            .split(/\n{2,}/)
            .forEach((para) => {
              if (para.trim()) {
                blocks.push({
                  kind: 'paragraph',
                  text: para.trim(),
                  align: 'justify',
                  spacingAfter: 3,
                });
              }
            });
        }
      });

      if (d.applicantName.trim()) {
        blocks.push({
          kind: 'signature',
          signOff: 'Sincerely,',
          name: d.applicantName.trim(),
          subline: joinNonEmpty([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
        });
      }

      return {
        category: 'personal_statement',
        fontMode: 'serif',
        headerStyle: 'academic-essay',
        title: d.documentTitle.trim() || 'Personal Statement',
        subtitle: joinNonEmpty([d.targetProgramOrOpportunity, d.targetOrganization], ' — ') || undefined,
        contactLine: joinNonEmpty([d.applicantName, d.applicantEmail, d.applicantPhone, d.applicantLocation]),
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
        .map((s) => s.trim())
        .filter(Boolean);
      if (senderLines.length > 0) {
        blocks.push({ kind: 'address-block', lines: senderLines, align: 'left' });
      }

      if (d.letterDate.trim()) {
        blocks.push({
          kind: 'paragraph',
          text: d.letterDate.trim(),
          align: 'left',
          bold: false,
          spacingAfter: 2.5,
        });
      }

      const recipientLines = [
        d.recipientTitle || 'Scholarship Selection Committee',
        d.scholarshipName,
        d.sponsoringOrganization,
        d.hostCountryOrUniversity,
      ]
        .map((s) => s.trim())
        .filter(Boolean);
      if (recipientLines.length > 0) {
        blocks.push({ kind: 'address-block', lines: recipientLines, align: 'left' });
      }

      const subject =
        d.subjectLine.trim() ||
        (d.scholarshipName.trim() ? `RE: Application for ${d.scholarshipName.trim()}` : '');
      if (subject) {
        blocks.push({
          kind: 'paragraph',
          text: subject,
          bold: true,
          align: 'left',
          spacingAfter: 3,
        });
      }

      const salutation = d.salutation.trim() || 'Dear Scholarship Selection Committee,';
      blocks.push({ kind: 'paragraph', text: salutation, align: 'left', spacingAfter: 3 });

      [
        d.purposeAndStanding,
        d.motivationAndMerit,
        d.financialNeedContext,
        d.impactAndCommitment,
      ]
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((sec) => {
          sec.split(/\n{2,}/).forEach((para) => {
            if (para.trim()) {
              blocks.push({
                kind: 'paragraph',
                text: para.trim(),
                align: 'justify',
                spacingAfter: 3,
              });
            }
          });
        });

      blocks.push({
        kind: 'signature',
        signOff: d.signOff.trim() || 'Yours faithfully,',
        name: d.applicantName.trim() || 'Applicant',
      });

      return {
        category: 'scholarship_letter',
        fontMode: 'serif',
        headerStyle: 'formal-letter',
        title: d.scholarshipName.trim()
          ? `Motivation Letter — ${d.scholarshipName.trim()}`
          : 'Scholarship Motivation Letter',
        subtitle: d.sponsoringOrganization.trim() || undefined,
        blocks,
      };
    }

    case 'research_proposal': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      const metaRows = [
        { label: 'Principal Investigator', value: d.applicantName.trim() },
        { label: 'Email', value: d.applicantEmail.trim() },
        { label: 'Host Institution', value: joinNonEmpty([d.targetInstitution, d.targetDepartment], ', ') },
        { label: 'Proposed Supervisor', value: d.proposedSupervisor.trim() },
        { label: 'Keywords', value: d.keywords.trim() },
      ].filter((r) => r.value);
      if (metaRows.length > 0) {
        blocks.push({ kind: 'meta-grid', rows: metaRows });
      }

      if (d.abstractSummary.trim()) {
        blocks.push({ kind: 'section-heading', title: '1. ABSTRACT / EXECUTIVE SUMMARY' });
        blocks.push({ kind: 'paragraph', text: d.abstractSummary.trim(), align: 'justify' });
      }

      if (d.problemStatement.trim()) {
        blocks.push({ kind: 'section-heading', title: '2. BACKGROUND & PROBLEM STATEMENT' });
        blocks.push({ kind: 'paragraph', text: d.problemStatement.trim(), align: 'justify' });
      }

      const rqs = cleanLines(d.researchQuestions);
      if (rqs.length > 0) {
        blocks.push({ kind: 'section-heading', title: '3. RESEARCH QUESTIONS & OBJECTIVES' });
        blocks.push({ kind: 'bullet-list', items: rqs });
      }

      if (d.literatureGap.trim()) {
        blocks.push({ kind: 'section-heading', title: '4. LITERATURE CONTEXT & RESEARCH GAP' });
        blocks.push({ kind: 'paragraph', text: d.literatureGap.trim(), align: 'justify' });
      }

      if (d.methodologyDesign.trim()) {
        blocks.push({ kind: 'section-heading', title: '5. METHODOLOGY & EXPERIMENTAL DESIGN' });
        blocks.push({ kind: 'paragraph', text: d.methodologyDesign.trim(), align: 'justify' });
      }

      if (d.expectedContributions.trim()) {
        blocks.push({ kind: 'section-heading', title: '6. EXPECTED OUTCOMES & SIGNIFICANCE' });
        blocks.push({ kind: 'paragraph', text: d.expectedContributions.trim(), align: 'justify' });
      }

      const milestones = d.timelineMilestones.filter(
        (m) => m.phase.trim() || m.timeframe.trim() || m.deliverable.trim()
      );
      if (milestones.length > 0) {
        blocks.push({ kind: 'section-heading', title: '7. RESEARCH TIMELINE & MILESTONES' });
        blocks.push({
          kind: 'entries',
          items: milestones.map((m) => ({
            primaryLeft: m.phase.trim() || 'Phase',
            primaryRight: m.timeframe.trim() || undefined,
            bodyText: m.deliverable.trim() || undefined,
          })),
        });
      }

      if (d.budgetOrResourceNeeds.trim()) {
        blocks.push({ kind: 'section-heading', title: '8. RESOURCES & EQUIPMENT REQUIREMENTS' });
        blocks.push({ kind: 'paragraph', text: d.budgetOrResourceNeeds.trim(), align: 'justify' });
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
        title: d.proposalTitle.trim() || 'Research Proposal',
        subtitle: joinNonEmpty([d.targetInstitution, d.targetDepartment], ' · ') || undefined,
        contactLine: joinNonEmpty([d.applicantName, d.applicantEmail]),
        blocks,
      };
    }

    case 'study_plan': {
      const d = payload.data;
      const blocks: BlueprintBlock[] = [];

      const metaRows = [
        { label: 'Applicant', value: d.applicantName.trim() },
        { label: 'Target Degree', value: d.targetDegree.trim() },
        { label: 'Host Institution', value: joinNonEmpty([d.hostInstitution, d.hostCountry], ', ') },
        { label: 'Duration', value: d.programDuration.trim() },
      ].filter((r) => r.value);
      if (metaRows.length > 0) {
        blocks.push({ kind: 'meta-grid', rows: metaRows });
      }

      if (d.academicBackground.trim()) {
        blocks.push({ kind: 'section-heading', title: '1. ACADEMIC BACKGROUND & READINESS' });
        blocks.push({ kind: 'paragraph', text: d.academicBackground.trim(), align: 'justify' });
      }

      if (d.purposeAndSpecialization.trim()) {
        blocks.push({ kind: 'section-heading', title: '2. PURPOSE OF STUDY & SPECIALIZATION FOCUS' });
        blocks.push({ kind: 'paragraph', text: d.purposeAndSpecialization.trim(), align: 'justify' });
      }

      const terms = d.studyTerms.filter(
        (t) => t.termLabel.trim() || t.courses.trim() || t.academicGoal.trim()
      );
      if (terms.length > 0) {
        blocks.push({ kind: 'section-heading', title: '3. TERM-BY-TERM COURSEWORK & RESEARCH SCHEDULE' });
        blocks.push({
          kind: 'entries',
          items: terms.map((t) => ({
            primaryLeft: t.termLabel.trim() || 'Academic Term',
            secondaryLeft: t.courses.trim() ? `Courses / Modules: ${t.courses.trim()}` : undefined,
            bodyText: t.academicGoal.trim() ? `Target Milestones: ${t.academicGoal.trim()}` : undefined,
          })),
        });
      }

      if (d.languageAndTechnicalPrep.trim()) {
        blocks.push({ kind: 'section-heading', title: '4. LANGUAGE & TECHNICAL PREPARATION' });
        blocks.push({ kind: 'paragraph', text: d.languageAndTechnicalPrep.trim(), align: 'justify' });
      }

      if (d.postStudyCareerImpact.trim()) {
        blocks.push({ kind: 'section-heading', title: '5. POST-STUDY CAREER & IMPACT PLAN' });
        blocks.push({ kind: 'paragraph', text: d.postStudyCareerImpact.trim(), align: 'justify' });
      }

      if (d.applicantName.trim()) {
        blocks.push({
          kind: 'signature',
          signOff: 'Prepared by,',
          name: d.applicantName.trim(),
          subline: joinNonEmpty([d.applicantEmail, d.applicantLocation], ' · ') || undefined,
        });
      }

      return {
        category: 'study_plan',
        fontMode: 'serif',
        headerStyle: 'study-plan',
        title: d.documentTitle.trim() || 'Academic Study Plan',
        subtitle: joinNonEmpty([d.targetDegree, d.hostInstitution, d.hostCountry], ' · ') || undefined,
        contactLine: joinNonEmpty([d.applicantName, d.applicantEmail, d.applicantLocation]),
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
  const marginBottom = 18;
  const contentW = pageW - marginX * 2;
  const fontFamily = bp.fontMode === 'sans' ? 'helvetica' : 'times';

  let y = marginTop;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
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
      const needed = lines.length * lineHeightMm;
      if (needed > pageH - marginBottom - marginTop) {
        // Long essay paragraph: paginate line by line cleanly
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
      } else {
        ensureSpace(needed);
        lines.forEach((ln, idx) => {
          const isLast = idx === lines.length - 1;
          if (!isLast && ln.trim().includes(' ')) {
            doc.text(ln, x, y, { align: 'justify', maxWidth: maxW });
          } else {
            doc.text(ln, x, y);
          }
          y += lineHeightMm;
        });
      }
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

  // Document Header
  if (bp.headerStyle === 'formal-letter') {
    // Letter title suppressed cleanly on page top; formal correspondence header handled by address blocks
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(bp.title, marginX, y);
    y += 5.5;
    if (bp.subtitle) {
      doc.setFont(fontFamily, 'italic');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(bp.subtitle, marginX, y);
      y += 4.5;
    }
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.35);
    doc.line(marginX, y, pageW - marginX, y);
    y += 6;
  } else {
    const isCentered = bp.headerStyle === 'ats-centered' || bp.headerStyle === 'academic-essay' || bp.headerStyle === 'research-title' || bp.headerStyle === 'study-plan';
    doc.setFont(fontFamily, 'bold');
    doc.setFontSize(bp.headerStyle === 'research-title' ? 15 : 16.5);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(bp.title, contentW) as string[];
    titleLines.forEach((ln) => {
      ensureSpace(7);
      if (isCentered) {
        doc.text(ln, pageW / 2, y, { align: 'center' });
      } else {
        doc.text(ln, marginX, y);
      }
      y += 6.5;
    });

    if (bp.subtitle) {
      doc.setFont(fontFamily, bp.fontMode === 'sans' ? 'bold' : 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(22, 78, 99);
      const subLines = doc.splitTextToSize(bp.subtitle, contentW) as string[];
      subLines.forEach((ln) => {
        ensureSpace(5);
        if (isCentered) {
          doc.text(ln, pageW / 2, y, { align: 'center' });
        } else {
          doc.text(ln, marginX, y);
        }
        y += 4.8;
      });
    }

    if (bp.contactLine) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(51, 65, 85);
      const cLines = doc.splitTextToSize(bp.contactLine, contentW) as string[];
      cLines.forEach((ln) => {
        ensureSpace(4.2);
        if (isCentered) {
          doc.text(ln, pageW / 2, y, { align: 'center' });
        } else {
          doc.text(ln, marginX, y);
        }
        y += 4.2;
      });
    }

    if (bp.secondaryContactLine) {
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const c2Lines = doc.splitTextToSize(bp.secondaryContactLine, contentW) as string[];
      c2Lines.forEach((ln) => {
        ensureSpace(4.2);
        if (isCentered) {
          doc.text(ln, pageW / 2, y, { align: 'center' });
        } else {
          doc.text(ln, marginX, y);
        }
        y += 4.2;
      });
    }

    y += 1.5;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageW - marginX, y);
    y += 5.5;
  }

  // Body Blocks
  for (const block of bp.blocks) {
    switch (block.kind) {
      case 'section-heading': {
        ensureSpace(11);
        y += 2;
        doc.setFont(fontFamily, 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(block.title, marginX, y);
        y += 1.6;
        doc.setDrawColor(180, 194, 210);
        doc.setLineWidth(0.35);
        doc.line(marginX, y, pageW - marginX, y);
        y += 4.4;
        break;
      }

      case 'paragraph': {
        doc.setFont(
          fontFamily,
          block.bold ? 'bold' : block.italic ? 'italic' : 'normal'
        );
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        drawWrappedText(block.text, marginX, contentW, 4.7, block.align || 'left');
        y += block.spacingAfter ?? 2.4;
        break;
      }

      case 'labeled-line': {
        ensureSpace(6);
        doc.setFont(fontFamily, 'bold');
        doc.setFontSize(9.8);
        doc.setTextColor(15, 23, 42);
        const prefix = `${block.label}: `;
        const prefixW = doc.getTextWidth(prefix);
        doc.text(prefix, marginX, y);
        doc.setFont(fontFamily, 'normal');
        doc.setTextColor(30, 41, 59);
        const restLines = doc.splitTextToSize(block.value, Math.max(40, contentW - prefixW)) as string[];
        if (restLines.length > 0) {
          doc.text(restLines[0], marginX + prefixW, y);
          y += 4.5;
          for (let i = 1; i < restLines.length; i++) {
            ensureSpace(4.5);
            doc.text(restLines[i], marginX, y);
            y += 4.5;
          }
        } else {
          y += 4.5;
        }
        y += 1;
        break;
      }

      case 'bullet-list': {
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(9.8);
        doc.setTextColor(30, 41, 59);
        for (const item of block.items) {
          const lines = doc.splitTextToSize(item, contentW - 5) as string[];
          ensureSpace(lines.length * 4.4 + 1);
          lines.forEach((ln, idx) => {
            if (idx === 0) {
              doc.text('•', marginX + 1, y);
            }
            doc.text(ln, marginX + 5, y);
            y += 4.4;
          });
          y += 0.6;
        }
        y += 1.5;
        break;
      }

      case 'entries': {
        for (const entry of block.items) {
          ensureSpace(12);
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(10.2);
          doc.setTextColor(15, 23, 42);
          doc.text(entry.primaryLeft, marginX, y);
          if (entry.primaryRight) {
            doc.setFont(fontFamily, 'normal');
            doc.setFontSize(9.4);
            doc.setTextColor(71, 85, 105);
            doc.text(entry.primaryRight, pageW - marginX, y, { align: 'right' });
          }
          y += 4.4;

          if (entry.secondaryLeft || entry.secondaryRight) {
            ensureSpace(5);
            doc.setFont(fontFamily, 'italic');
            doc.setFontSize(9.6);
            doc.setTextColor(51, 65, 85);
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
            doc.setFontSize(9.6);
            doc.setTextColor(30, 41, 59);
            drawWrappedText(entry.bodyText, marginX, contentW, 4.4, 'left');
          }

          if (entry.bullets && entry.bullets.length > 0) {
            doc.setFont(fontFamily, 'normal');
            doc.setFontSize(9.6);
            doc.setTextColor(30, 41, 59);
            for (const b of entry.bullets) {
              const bLines = doc.splitTextToSize(b, contentW - 5) as string[];
              ensureSpace(bLines.length * 4.3 + 0.8);
              bLines.forEach((ln, idx) => {
                if (idx === 0) doc.text('•', marginX + 1, y);
                doc.text(ln, marginX + 5, y);
                y += 4.3;
              });
              y += 0.4;
            }
          }
          y += 2.2;
        }
        break;
      }

      case 'address-block': {
        ensureSpace(block.lines.length * 4.6 + 4);
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        block.lines.forEach((ln, idx) => {
          doc.setFont(fontFamily, idx === 0 ? 'bold' : 'normal');
          if (block.align === 'right') {
            doc.text(ln, pageW - marginX, y, { align: 'right' });
          } else {
            doc.text(ln, marginX, y);
          }
          y += 4.6;
        });
        y += 3;
        break;
      }

      case 'meta-grid': {
        ensureSpace(block.rows.length * 5 + 5);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        const boxHeight = block.rows.length * 5.2 + 4;
        doc.roundedRect(marginX, y - 1, contentW, boxHeight, 1.5, 1.5, 'FD');
        let ry = y + 3.5;
        for (const r of block.rows) {
          doc.setFont(fontFamily, 'bold');
          doc.setFontSize(9);
          doc.setTextColor(22, 78, 99);
          doc.text(`${r.label}:`, marginX + 3, ry);
          doc.setFont(fontFamily, 'normal');
          doc.setTextColor(15, 23, 42);
          const valTrunc = (doc.splitTextToSize(r.value, contentW - 48) as string[])[0] || r.value;
          doc.text(valTrunc, marginX + 42, ry);
          ry += 5.2;
        }
        y += boxHeight + 4.5;
        break;
      }

      case 'signature': {
        ensureSpace(18);
        y += 3;
        doc.setFont(fontFamily, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(block.signOff, marginX, y);
        y += 7;
        doc.setFont(fontFamily, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(block.name, marginX, y);
        if (block.subline) {
          y += 4.4;
          doc.setFont(fontFamily, 'normal');
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text(block.subline, marginX, y);
        }
        y += 4;
        break;
      }
    }
  }

  // Page numbering footer on multi-page exports
  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${i} of ${totalPages}`, pageW - marginX, pageH - 10, { align: 'right' });
    }
  }

  return doc.output('blob');
};

export const downloadDocumentPdf = (payload: DocumentFormPayload, customFileName?: string) => {
  const blob = exportDocumentToPdfBlob(payload);
  const safeBase = (customFileName || extractDocumentTitle(payload))
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

const xmlParagraph = (
  runsXml: string,
  opts?: {
    align?: 'left' | 'center' | 'right' | 'both';
    spaceBefore?: number;
    spaceAfter?: number;
    bottomBorder?: boolean;
    leftIndent?: number;
  }
) => {
  const jc = opts?.align ? `<w:jc w:val="${opts.align}"/>` : '';
  const spacing = `<w:spacing w:before="${opts?.spaceBefore ?? 0}" w:after="${opts?.spaceAfter ?? 100}" w:line="264" w:lineRule="auto"/>`;
  const border = opts?.bottomBorder
    ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="3" w:color="94A3B8"/></w:pBdr>`
    : '';
  const ind = opts?.leftIndent ? `<w:ind w:left="${opts.leftIndent}" w:hanging="240"/>` : '';
  return `<w:p><w:pPr>${border}${spacing}${ind}${jc}</w:pPr>${runsXml}</w:p>`;
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
    opts?.colorHex ? `<w:color w:val="${opts.colorHex}"/>` : '<w:color w:val="0F172A"/>',
    `<w:sz w:val="${opts?.sizeHalfPt ?? 21}"/>`,
    `<w:szCs w:val="${opts?.sizeHalfPt ?? 21}"/>`,
  ].join('');
  return `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
};

export const exportDocumentToDocxBlob = async (payload: DocumentFormPayload): Promise<Blob> => {
  const bp = buildDocumentBlueprint(payload);
  const docFont = bp.fontMode === 'sans' ? 'Calibri' : 'Times New Roman';
  const isCentered =
    bp.headerStyle === 'ats-centered' ||
    bp.headerStyle === 'academic-essay' ||
    bp.headerStyle === 'research-title' ||
    bp.headerStyle === 'study-plan';
  const headerAlign: 'center' | 'left' = isCentered ? 'center' : 'left';

  const bodyParts: string[] = [];

  // Title block
  bodyParts.push(
    xmlParagraph(
      xmlRun(bp.title, {
        bold: true,
        sizeHalfPt: bp.headerStyle === 'formal-letter' ? 26 : 32,
        colorHex: '0F172A',
        font: docFont,
      }),
      { align: headerAlign, spaceAfter: 60 }
    )
  );

  if (bp.subtitle) {
    bodyParts.push(
      xmlParagraph(
        xmlRun(bp.subtitle, {
          italic: bp.fontMode === 'serif',
          bold: bp.fontMode === 'sans',
          sizeHalfPt: 21,
          colorHex: '164E63',
          font: docFont,
        }),
        { align: headerAlign, spaceAfter: 60 }
      )
    );
  }

  if (bp.contactLine) {
    bodyParts.push(
      xmlParagraph(
        xmlRun(bp.contactLine, { sizeHalfPt: 19, colorHex: '334155', font: docFont }),
        { align: headerAlign, spaceAfter: bp.secondaryContactLine ? 40 : 120, bottomBorder: !bp.secondaryContactLine }
      )
    );
  } else {
    bodyParts.push(
      xmlParagraph(xmlRun('', { sizeHalfPt: 8, font: docFont }), {
        spaceAfter: 120,
        bottomBorder: true,
      })
    );
  }

  if (bp.secondaryContactLine) {
    bodyParts.push(
      xmlParagraph(
        xmlRun(bp.secondaryContactLine, { sizeHalfPt: 18, colorHex: '475569', font: docFont }),
        { align: headerAlign, spaceAfter: 140, bottomBorder: true }
      )
    );
  }

  // Body blocks
  for (const block of bp.blocks) {
    switch (block.kind) {
      case 'section-heading':
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.title, { bold: true, sizeHalfPt: 22, colorHex: '0F172A', font: docFont }),
            { spaceBefore: 160, spaceAfter: 80, bottomBorder: true }
          )
        );
        break;

      case 'paragraph':
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.text, {
              bold: block.bold,
              italic: block.italic,
              sizeHalfPt: 21,
              colorHex: '1E293B',
              font: docFont,
            }),
            {
              align: block.align === 'justify' ? 'both' : block.align || 'left',
              spaceAfter: 110,
            }
          )
        );
        break;

      case 'labeled-line':
        bodyParts.push(
          xmlParagraph(
            xmlRun(`${block.label}: `, { bold: true, sizeHalfPt: 20, colorHex: '0F172A', font: docFont }) +
              xmlRun(block.value, { sizeHalfPt: 20, colorHex: '1E293B', font: docFont }),
            { spaceAfter: 80 }
          )
        );
        break;

      case 'bullet-list':
        for (const item of block.items) {
          bodyParts.push(
            xmlParagraph(
              xmlRun(`•  ${item}`, { sizeHalfPt: 20, colorHex: '1E293B', font: docFont }),
              { spaceAfter: 60, leftIndent: 360 }
            )
          );
        }
        break;

      case 'entries':
        for (const entry of block.items) {
          const rightPart = entry.primaryRight ? `   (${entry.primaryRight})` : '';
          bodyParts.push(
            xmlParagraph(
              xmlRun(entry.primaryLeft, { bold: true, sizeHalfPt: 21, colorHex: '0F172A', font: docFont }) +
                (rightPart
                  ? xmlRun(rightPart, { sizeHalfPt: 19, colorHex: '475569', font: docFont })
                  : ''),
              { spaceBefore: 80, spaceAfter: 30 }
            )
          );
          if (entry.secondaryLeft || entry.secondaryRight) {
            const subLine = [entry.secondaryLeft, entry.secondaryRight].filter(Boolean).join('  —  ');
            bodyParts.push(
              xmlParagraph(
                xmlRun(subLine, { italic: true, sizeHalfPt: 19, colorHex: '334155', font: docFont }),
                { spaceAfter: 50 }
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

      case 'address-block':
        block.lines.forEach((ln, idx) => {
          bodyParts.push(
            xmlParagraph(
              xmlRun(ln, { bold: idx === 0, sizeHalfPt: 20, colorHex: '1E293B', font: docFont }),
              { align: block.align || 'left', spaceAfter: idx === block.lines.length - 1 ? 120 : 30 }
            )
          );
        });
        break;

      case 'meta-grid':
        for (const row of block.rows) {
          bodyParts.push(
            xmlParagraph(
              xmlRun(`${row.label}: `, { bold: true, sizeHalfPt: 19, colorHex: '164E63', font: docFont }) +
                xmlRun(row.value, { sizeHalfPt: 19, colorHex: '0F172A', font: docFont }),
              { spaceAfter: 50 }
            )
          );
        }
        bodyParts.push(
          xmlParagraph(xmlRun('', { sizeHalfPt: 8, font: docFont }), {
            spaceAfter: 100,
            bottomBorder: true,
          })
        );
        break;

      case 'signature':
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.signOff, { sizeHalfPt: 21, colorHex: '1E293B', font: docFont }),
            { spaceBefore: 160, spaceAfter: 140 }
          )
        );
        bodyParts.push(
          xmlParagraph(
            xmlRun(block.name, { bold: true, sizeHalfPt: 21, colorHex: '0F172A', font: docFont }),
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
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="${docFont}" w:hAnsi="${docFont}" w:cs="${docFont}"/>
      <w:sz w:val="21"/>
    </w:rPr>
  </w:style>
</w:styles>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.folder('_rels')?.file('.rels', relsXml);
  const wordDir = zip.folder('word');
  wordDir?.file('document.xml', documentXml);
  wordDir?.file('styles.xml', stylesXml);
  wordDir?.folder('_rels')?.file('document.xml.rels', wordRelsXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};

export const downloadDocumentDocx = async (payload: DocumentFormPayload, customFileName?: string) => {
  const blob = await exportDocumentToDocxBlob(payload);
  const safeBase = (customFileName || extractDocumentTitle(payload))
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
  const W = 794; // A4 width @ ~96dpi
  const H = 1123; // A4 height @ ~96dpi
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // White A4 paper surface
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const marginX = 64;
  const maxW = W - marginX * 2;
  const bottomLimit = H - 64;
  const fontStack = bp.fontMode === 'sans' ? 'Arial, Helvetica, sans-serif' : 'Georgia, "Times New Roman", serif';
  let y = 66;

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

  // Header Title
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${bp.headerStyle === 'formal-letter' ? 20 : 25}px ${fontStack}`;
  ctx.textAlign = isCentered ? 'center' : 'left';
  const titleLines = wrapLines(bp.title, maxW);
  for (const ln of titleLines) {
    if (y > bottomLimit) break;
    ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
    y += 30;
  }

  if (bp.subtitle && y < bottomLimit) {
    ctx.fillStyle = '#164e63';
    ctx.font = `${bp.fontMode === 'serif' ? 'italic ' : 'bold '}15px ${fontStack}`;
    const subLines = wrapLines(bp.subtitle, maxW);
    for (const ln of subLines) {
      if (y > bottomLimit) break;
      ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
      y += 20;
    }
  }

  if (bp.contactLine && y < bottomLimit) {
    ctx.fillStyle = '#334155';
    ctx.font = `13px ${fontStack}`;
    const cLines = wrapLines(bp.contactLine, maxW);
    for (const ln of cLines) {
      if (y > bottomLimit) break;
      ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
      y += 18;
    }
  }

  if (bp.secondaryContactLine && y < bottomLimit) {
    ctx.fillStyle = '#475569';
    ctx.font = `12.5px ${fontStack}`;
    const c2Lines = wrapLines(bp.secondaryContactLine, maxW);
    for (const ln of c2Lines) {
      if (y > bottomLimit) break;
      ctx.fillText(ln, isCentered ? W / 2 : marginX, y);
      y += 17;
    }
  }

  // Divider rule
  y += 6;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(W - marginX, y);
  ctx.stroke();
  y += 24;

  ctx.textAlign = 'left';

  for (const block of bp.blocks) {
    if (y >= bottomLimit - 14) break;

    if (block.kind === 'section-heading') {
      y += 8;
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 14.5px ${fontStack}`;
      ctx.fillText(block.title, marginX, y);
      y += 6;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(W - marginX, y);
      ctx.stroke();
      y += 18;
    } else if (block.kind === 'paragraph') {
      ctx.fillStyle = '#1e293b';
      ctx.font = `${block.bold ? 'bold ' : block.italic ? 'italic ' : ''}13.5px ${fontStack}`;
      const lines = wrapLines(block.text, maxW);
      for (const ln of lines) {
        if (y >= bottomLimit) break;
        ctx.fillText(ln, marginX, y);
        y += 19;
      }
      y += 8;
    } else if (block.kind === 'labeled-line') {
      ctx.font = `bold 13px ${fontStack}`;
      ctx.fillStyle = '#0f172a';
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
        const lines = wrapLines(item, maxW - 18);
        lines.forEach((ln, idx) => {
          if (y >= bottomLimit) return;
          if (idx === 0) ctx.fillText('•', marginX + 4, y);
          ctx.fillText(ln, marginX + 18, y);
          y += 18;
        });
        y += 3;
      }
      y += 6;
    } else if (block.kind === 'entries') {
      for (const entry of block.items) {
        if (y >= bottomLimit - 14) break;
        ctx.font = `bold 14px ${fontStack}`;
        ctx.fillStyle = '#0f172a';
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
          ctx.fillStyle = '#334155';
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
    } else if (block.kind === 'address-block') {
      block.lines.forEach((ln, idx) => {
        if (y >= bottomLimit) return;
        ctx.font = `${idx === 0 ? 'bold ' : ''}13.5px ${fontStack}`;
        ctx.fillStyle = '#1e293b';
        ctx.fillText(ln, marginX, y);
        y += 18;
      });
      y += 10;
    } else if (block.kind === 'meta-grid') {
      const boxH = block.rows.length * 20 + 16;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.fillRect(marginX, y - 8, maxW, boxH);
      ctx.strokeRect(marginX, y - 8, maxW, boxH);
      let ry = y + 10;
      for (const r of block.rows) {
        if (ry >= bottomLimit) break;
        ctx.font = `bold 12px ${fontStack}`;
        ctx.fillStyle = '#164e63';
        ctx.fillText(`${r.label}:`, marginX + 12, ry);
        ctx.font = `12px ${fontStack}`;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(r.value.slice(0, 72), marginX + 160, ry);
        ry += 20;
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
        ctx.fillStyle = '#0f172a';
        ctx.fillText(block.name, marginX, y);
      }
    }
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
