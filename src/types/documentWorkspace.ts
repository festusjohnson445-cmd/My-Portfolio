export type DocumentWorkspaceCategory =
  | 'international_cv'
  | 'academic_resume'
  | 'job_resume'
  | 'sop'
  | 'personal_statement'
  | 'scholarship_letter'
  | 'research_proposal'
  | 'study_plan';

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startYear: string;
  endYear: string;
  gpaOrHonors?: string;
  thesisOrCoursework?: string;
}

export interface ExperienceEntry {
  id: string;
  roleTitle: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  highlights: string; // newline-separated bullet points
}

export interface PublicationEntry {
  id: string;
  citation: string;
  venueOrJournal: string;
  year: string;
  doiOrUrl?: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  roleOrContext: string;
  period: string;
  impactBullets: string;
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  year: string;
  credentialId?: string;
}

export interface LanguageEntry {
  id: string;
  language: string;
  proficiency: string;
}

export interface RefereeEntry {
  id: string;
  name: string;
  titleAndDepartment: string;
  institution: string;
  email: string;
}

export interface TimelineMilestoneEntry {
  id: string;
  phase: string;
  timeframe: string;
  deliverable: string;
}

export interface StudyTermEntry {
  id: string;
  termLabel: string;
  courses: string;
  academicGoal: string;
}

export interface ContactHeaderBlock {
  fullName: string;
  headlineOrTargetRole: string;
  email: string;
  phone: string;
  location: string;
  linkedinOrPortfolio: string;
}

export interface InternationalCvData {
  header: ContactHeaderBlock;
  nationalityOrWorkAuth: string;
  orcidOrGithub: string;
  professionalSummary: string;
  coreCompetencies: string;
  technicalAndDigitalSkills: string;
  experiences: ExperienceEntry[];
  leadershipRoles: ExperienceEntry[];
  selectedProjects: ProjectEntry[];
  education: EducationEntry[];
  technicalTraining: string;
  certifications: CertificationEntry[];
  languages: LanguageEntry[];
  professionalInterests: string;
  references: RefereeEntry[];
  referencesNote: string;
}

export interface AcademicResumeData {
  header: ContactHeaderBlock;
  academicTitleOrField: string;
  orcidOrScholarUrl: string;
  researchProfile: string;
  researchInterests: string;
  education: EducationEntry[];
  researchAppointments: ExperienceEntry[];
  teachingExperience: ExperienceEntry[];
  professionalExperience: ExperienceEntry[];
  leadershipRoles: ExperienceEntry[];
  selectedProjects: ProjectEntry[];
  publications: PublicationEntry[];
  grantsAndAwards: string;
  technicalMethods: string;
  technicalAndDigitalSkills: string;
  technicalTraining: string;
  professionalInterests: string;
  referees: RefereeEntry[];
}

export interface JobResumeData {
  header: ContactHeaderBlock;
  targetJobTitle: string;
  professionalSummary: string;
  technicalSkills: string;
  softAndLeadershipSkills: string;
  workExperience: ExperienceEntry[];
  leadershipRoles: ExperienceEntry[];
  keyProjects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  technicalTraining: string;
  professionalInterests: string;
  references: RefereeEntry[];
  referencesNote: string;
}

export interface SopData {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantLocation: string;
  targetDegreeAndProgram: string;
  targetInstitution: string;
  targetDepartment: string;
  intendedTerm: string;
  targetFacultyOrLab: string;
  documentTitle: string;
  openingMotivation: string;
  academicFoundation: string;
  researchAndPracticalExperience: string;
  programAndFacultyFit: string;
  careerGoalsAndClosing: string;
}

export interface PersonalStatementData {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantLocation: string;
  targetProgramOrOpportunity: string;
  targetOrganization: string;
  documentTitle: string;
  definingStoryAndOrigin: string;
  challengesAndResilience: string;
  leadershipAndCharacter: string;
  valuesAndFutureContribution: string;
}

export interface ScholarshipLetterData {
  applicantName: string;
  applicantAddress: string;
  applicantEmail: string;
  applicantPhone: string;
  letterDate: string;
  recipientTitle: string;
  scholarshipName: string;
  sponsoringOrganization: string;
  hostCountryOrUniversity: string;
  subjectLine: string;
  salutation: string;
  purposeAndStanding: string;
  motivationAndMerit: string;
  financialNeedContext: string;
  impactAndCommitment: string;
  signOff: string;
}

export interface ResearchProposalData {
  proposalTitle: string;
  applicantName: string;
  applicantEmail: string;
  targetInstitution: string;
  targetDepartment: string;
  proposedSupervisor: string;
  keywords: string;
  abstractSummary: string;
  problemStatement: string;
  researchQuestions: string; // newline-separated research questions / objectives
  literatureGap: string;
  methodologyDesign: string;
  expectedContributions: string;
  timelineMilestones: TimelineMilestoneEntry[];
  budgetOrResourceNeeds: string;
  keyReferences: string; // newline-separated references
}

export interface StudyPlanData {
  applicantName: string;
  applicantEmail: string;
  applicantLocation: string;
  targetDegree: string;
  hostInstitution: string;
  hostCountry: string;
  programDuration: string;
  documentTitle: string;
  academicBackground: string;
  purposeAndSpecialization: string;
  studyTerms: StudyTermEntry[];
  languageAndTechnicalPrep: string;
  postStudyCareerImpact: string;
}

export type DocumentFormPayload =
  | { category: 'international_cv'; data: InternationalCvData }
  | { category: 'academic_resume'; data: AcademicResumeData }
  | { category: 'job_resume'; data: JobResumeData }
  | { category: 'sop'; data: SopData }
  | { category: 'personal_statement'; data: PersonalStatementData }
  | { category: 'scholarship_letter'; data: ScholarshipLetterData }
  | { category: 'research_proposal'; data: ResearchProposalData }
  | { category: 'study_plan'; data: StudyPlanData };

export interface GeneratedDocumentRecord {
  id: string;
  category: DocumentWorkspaceCategory;
  title: string;
  authorName: string;
  summary: string;
  formData: DocumentFormPayload;
  previewImageUrl: string;
  pdfUrl: string;
  docxUrl: string;
  storagePaths: string[];
  status: 'draft' | 'published' | 'archived';
  viewsCount: number;
  downloadsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryMetaInfo {
  id: DocumentWorkspaceCategory;
  label: string;
  shortLabel: string;
  badgeText: string;
  description: string;
  structureNotes: string;
  isAtsStrict: boolean;
}

export const DOCUMENT_CATEGORY_META: CategoryMetaInfo[] = [
  {
    id: 'international_cv',
    label: 'International CV',
    shortLabel: 'International CV',
    badgeText: 'ATS-Strict',
    description:
      'Globally standardized curriculum vitae built strictly with single-column ATS headings, zero tables or visual clutter, and optional international mobility fields.',
    structureNotes:
      'Uses standard ATS headings (Professional Summary, Core Competencies, Professional Experience, Education, Certifications, Languages) for 100% machine readability.',
    isAtsStrict: true,
  },
  {
    id: 'academic_resume',
    label: 'Academic Resume',
    shortLabel: 'Academic Resume',
    badgeText: 'Scholarly',
    description:
      'Dedicated academic curriculum vitae highlighting thesis research, peer-reviewed publications, grants, teaching appointments, and academic referees.',
    structureNotes:
      'Structured around academic evaluation criteria: Education & Thesis, Research Appointments, Teaching, Publications, Grants, Technical Methods, and Referees.',
    isAtsStrict: true,
  },
  {
    id: 'job_resume',
    label: 'Job Resume',
    shortLabel: 'Job Resume',
    badgeText: 'ATS-Ready',
    description:
      'Focused industry resume emphasizing quantified achievements, core technical skills, reverse-chronological roles, and measurable engineering or business impact.',
    structureNotes:
      'Single-column ATS hierarchy: Target Role, Executive Summary, Core Technical Skills, Professional Experience, Key Projects, Education, and Certifications.',
    isAtsStrict: true,
  },
  {
    id: 'sop',
    label: 'Statement of Purpose',
    shortLabel: 'SOP',
    badgeText: 'Admissions Essay',
    description:
      'Structured graduate admissions Statement of Purpose connecting academic readiness, research experience, faculty/lab alignment, and future career goals.',
    structureNotes:
      'Formal A4 academic essay header with target program block, justified prose paragraphs, and logical five-part admissions narrative.',
    isAtsStrict: false,
  },
  {
    id: 'personal_statement',
    label: 'Personal Statement',
    shortLabel: 'Personal Statement',
    badgeText: 'Narrative',
    description:
      'Holistic personal narrative conveying defining experiences, resilience, leadership character, and how your values align with the target institution.',
    structureNotes:
      'Clean A4 formal statement layout with justified narrative paragraphs highlighting personal trajectory, character, and contribution.',
    isAtsStrict: false,
  },
  {
    id: 'scholarship_letter',
    label: 'Scholarship Motivation Letter',
    shortLabel: 'Motivation Letter',
    badgeText: 'Formal Letter',
    description:
      'Authentic formal scholarship letter with sender/recipient address blocks, subject line, academic merit, financial justification, and community impact.',
    structureNotes:
      'Standard formal business/admissions correspondence structure: Sender Header, Date, Selection Committee Address, Subject Line, Justified Letter Body, and Sign-off.',
    isAtsStrict: false,
  },
  {
    id: 'research_proposal',
    label: 'Research Proposal',
    shortLabel: 'Research Proposal',
    badgeText: 'Research Plan',
    description:
      'Comprehensive scholarly research proposal featuring abstract, problem statement, research questions, methodology, milestone timeline, and bibliography.',
    structureNotes:
      'Formal academic proposal header followed by structured scholarly sections, milestone schedule, optional resource plan, and reference list.',
    isAtsStrict: false,
  },
  {
    id: 'study_plan',
    label: 'Study Plan',
    shortLabel: 'Study Plan',
    badgeText: 'Academic Roadmap',
    description:
      'Clear term-by-term study and research plan outlining academic readiness, semester coursework modules, language/skill prep, and post-graduation impact.',
    structureNotes:
      'Structured academic roadmap combining program metadata, readiness narrative, term-by-term coursework schedule, and post-study career plan.',
    isAtsStrict: false,
  },
];

export const getCategoryMeta = (cat: DocumentWorkspaceCategory): CategoryMetaInfo =>
  DOCUMENT_CATEGORY_META.find((c) => c.id === cat) || DOCUMENT_CATEGORY_META[0];

export const makeUid = (prefix = 'item') =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const createEmptyFormPayload = (
  category: DocumentWorkspaceCategory
): DocumentFormPayload => {
  switch (category) {
    case 'international_cv':
      return {
        category: 'international_cv',
        data: {
          header: {
            fullName: '',
            headlineOrTargetRole: '',
            email: '',
            phone: '',
            location: '',
            linkedinOrPortfolio: '',
          },
          nationalityOrWorkAuth: '',
          orcidOrGithub: '',
          professionalSummary: '',
          coreCompetencies: '',
          technicalAndDigitalSkills: '',
          experiences: [
            {
              id: makeUid('exp'),
              roleTitle: '',
              organization: '',
              location: '',
              startDate: '',
              endDate: '',
              highlights: '',
            },
          ],
          leadershipRoles: [],
          selectedProjects: [],
          education: [
            {
              id: makeUid('edu'),
              degree: '',
              institution: '',
              location: '',
              startYear: '',
              endYear: '',
              gpaOrHonors: '',
              thesisOrCoursework: '',
            },
          ],
          technicalTraining: '',
          certifications: [],
          languages: [],
          professionalInterests: '',
          references: [],
          referencesNote: '',
        },
      };

    case 'academic_resume':
      return {
        category: 'academic_resume',
        data: {
          header: {
            fullName: '',
            headlineOrTargetRole: '',
            email: '',
            phone: '',
            location: '',
            linkedinOrPortfolio: '',
          },
          academicTitleOrField: '',
          orcidOrScholarUrl: '',
          researchProfile: '',
          researchInterests: '',
          education: [
            {
              id: makeUid('edu'),
              degree: '',
              institution: '',
              location: '',
              startYear: '',
              endYear: '',
              gpaOrHonors: '',
              thesisOrCoursework: '',
            },
          ],
          researchAppointments: [
            {
              id: makeUid('res'),
              roleTitle: '',
              organization: '',
              location: '',
              startDate: '',
              endDate: '',
              highlights: '',
            },
          ],
          teachingExperience: [],
          professionalExperience: [],
          leadershipRoles: [],
          selectedProjects: [],
          publications: [],
          grantsAndAwards: '',
          technicalMethods: '',
          technicalAndDigitalSkills: '',
          technicalTraining: '',
          professionalInterests: '',
          referees: [],
        },
      };

    case 'job_resume':
      return {
        category: 'job_resume',
        data: {
          header: {
            fullName: '',
            headlineOrTargetRole: '',
            email: '',
            phone: '',
            location: '',
            linkedinOrPortfolio: '',
          },
          targetJobTitle: '',
          professionalSummary: '',
          technicalSkills: '',
          softAndLeadershipSkills: '',
          workExperience: [
            {
              id: makeUid('work'),
              roleTitle: '',
              organization: '',
              location: '',
              startDate: '',
              endDate: '',
              highlights: '',
            },
          ],
          leadershipRoles: [],
          keyProjects: [],
          education: [
            {
              id: makeUid('edu'),
              degree: '',
              institution: '',
              location: '',
              startYear: '',
              endYear: '',
              gpaOrHonors: '',
              thesisOrCoursework: '',
            },
          ],
          certifications: [],
          technicalTraining: '',
          professionalInterests: '',
          references: [],
          referencesNote: '',
        },
      };

    case 'sop':
      return {
        category: 'sop',
        data: {
          applicantName: '',
          applicantEmail: '',
          applicantPhone: '',
          applicantLocation: '',
          targetDegreeAndProgram: '',
          targetInstitution: '',
          targetDepartment: '',
          intendedTerm: '',
          targetFacultyOrLab: '',
          documentTitle: '',
          openingMotivation: '',
          academicFoundation: '',
          researchAndPracticalExperience: '',
          programAndFacultyFit: '',
          careerGoalsAndClosing: '',
        },
      };

    case 'personal_statement':
      return {
        category: 'personal_statement',
        data: {
          applicantName: '',
          applicantEmail: '',
          applicantPhone: '',
          applicantLocation: '',
          targetProgramOrOpportunity: '',
          targetOrganization: '',
          documentTitle: '',
          definingStoryAndOrigin: '',
          challengesAndResilience: '',
          leadershipAndCharacter: '',
          valuesAndFutureContribution: '',
        },
      };

    case 'scholarship_letter':
      return {
        category: 'scholarship_letter',
        data: {
          applicantName: '',
          applicantAddress: '',
          applicantEmail: '',
          applicantPhone: '',
          letterDate: '',
          recipientTitle: '',
          scholarshipName: '',
          sponsoringOrganization: '',
          hostCountryOrUniversity: '',
          subjectLine: '',
          salutation: '',
          purposeAndStanding: '',
          motivationAndMerit: '',
          financialNeedContext: '',
          impactAndCommitment: '',
          signOff: '',
        },
      };

    case 'research_proposal':
      return {
        category: 'research_proposal',
        data: {
          proposalTitle: '',
          applicantName: '',
          applicantEmail: '',
          targetInstitution: '',
          targetDepartment: '',
          proposedSupervisor: '',
          keywords: '',
          abstractSummary: '',
          problemStatement: '',
          researchQuestions: '',
          literatureGap: '',
          methodologyDesign: '',
          expectedContributions: '',
          timelineMilestones: [
            {
              id: makeUid('ms'),
              phase: '',
              timeframe: '',
              deliverable: '',
            },
          ],
          budgetOrResourceNeeds: '',
          keyReferences: '',
        },
      };

    case 'study_plan':
      return {
        category: 'study_plan',
        data: {
          applicantName: '',
          applicantEmail: '',
          applicantLocation: '',
          targetDegree: '',
          hostInstitution: '',
          hostCountry: '',
          programDuration: '',
          documentTitle: '',
          academicBackground: '',
          purposeAndSpecialization: '',
          studyTerms: [
            {
              id: makeUid('term'),
              termLabel: '',
              courses: '',
              academicGoal: '',
            },
          ],
          languageAndTechnicalPrep: '',
          postStudyCareerImpact: '',
        },
      };
  }
};

export const normalizeDocumentPayload = (rawPayload: DocumentFormPayload): DocumentFormPayload => {
  if (!rawPayload || !rawPayload.category) {
    return createEmptyFormPayload('international_cv');
  }
  const base = createEmptyFormPayload(rawPayload.category);
  const rawData: any = rawPayload.data || {};
  switch (rawPayload.category) {
    case 'international_cv': {
      const b = base.data as InternationalCvData;
      return {
        category: 'international_cv',
        data: {
          ...b,
          ...rawData,
          header: { ...b.header, ...(rawData.header || {}) },
          experiences: Array.isArray(rawData.experiences) ? rawData.experiences : b.experiences,
          leadershipRoles: Array.isArray(rawData.leadershipRoles) ? rawData.leadershipRoles : [],
          selectedProjects: Array.isArray(rawData.selectedProjects) ? rawData.selectedProjects : [],
          education: Array.isArray(rawData.education) ? rawData.education : b.education,
          certifications: Array.isArray(rawData.certifications) ? rawData.certifications : [],
          languages: Array.isArray(rawData.languages) ? rawData.languages : [],
          references: Array.isArray(rawData.references) ? rawData.references : [],
        },
      };
    }
    case 'academic_resume': {
      const b = base.data as AcademicResumeData;
      return {
        category: 'academic_resume',
        data: {
          ...b,
          ...rawData,
          header: { ...b.header, ...(rawData.header || {}) },
          education: Array.isArray(rawData.education) ? rawData.education : b.education,
          researchAppointments: Array.isArray(rawData.researchAppointments)
            ? rawData.researchAppointments
            : b.researchAppointments,
          teachingExperience: Array.isArray(rawData.teachingExperience)
            ? rawData.teachingExperience
            : [],
          professionalExperience: Array.isArray(rawData.professionalExperience)
            ? rawData.professionalExperience
            : [],
          leadershipRoles: Array.isArray(rawData.leadershipRoles) ? rawData.leadershipRoles : [],
          selectedProjects: Array.isArray(rawData.selectedProjects) ? rawData.selectedProjects : [],
          publications: Array.isArray(rawData.publications) ? rawData.publications : [],
          referees: Array.isArray(rawData.referees) ? rawData.referees : [],
        },
      };
    }
    case 'job_resume': {
      const b = base.data as JobResumeData;
      return {
        category: 'job_resume',
        data: {
          ...b,
          ...rawData,
          header: { ...b.header, ...(rawData.header || {}) },
          workExperience: Array.isArray(rawData.workExperience)
            ? rawData.workExperience
            : b.workExperience,
          leadershipRoles: Array.isArray(rawData.leadershipRoles) ? rawData.leadershipRoles : [],
          keyProjects: Array.isArray(rawData.keyProjects) ? rawData.keyProjects : [],
          education: Array.isArray(rawData.education) ? rawData.education : b.education,
          certifications: Array.isArray(rawData.certifications) ? rawData.certifications : [],
          references: Array.isArray(rawData.references) ? rawData.references : [],
        },
      };
    }
    default:
      return {
        category: rawPayload.category,
        data: { ...(base.data as any), ...rawData },
      } as DocumentFormPayload;
  }
};

const safeStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const extractDocumentTitle = (payload: DocumentFormPayload): string => {
  switch (payload.category) {
    case 'international_cv':
      return safeStr(payload.data.header?.fullName)
        ? `${safeStr(payload.data.header?.fullName)} — International CV`
        : 'Untitled International CV';
    case 'academic_resume':
      return safeStr(payload.data.header?.fullName)
        ? `${safeStr(payload.data.header?.fullName)} — Academic Resume`
        : 'Untitled Academic Resume';
    case 'job_resume': {
      const name = safeStr(payload.data.header?.fullName);
      const role = safeStr(payload.data.targetJobTitle);
      if (name && role) return `${name} — ${role}`;
      if (name) return `${name} — Job Resume`;
      if (role) return `${role} — Job Resume`;
      return 'Untitled Job Resume';
    }
    case 'sop':
      return (
        safeStr(payload.data.documentTitle) ||
        (safeStr(payload.data.targetDegreeAndProgram)
          ? `Statement of Purpose — ${safeStr(payload.data.targetDegreeAndProgram)}`
          : 'Statement of Purpose')
      );
    case 'personal_statement':
      return (
        safeStr(payload.data.documentTitle) ||
        (safeStr(payload.data.targetProgramOrOpportunity)
          ? `Personal Statement — ${safeStr(payload.data.targetProgramOrOpportunity)}`
          : 'Personal Statement')
      );
    case 'scholarship_letter':
      return (
        safeStr(payload.data.subjectLine) ||
        (safeStr(payload.data.scholarshipName)
          ? `Motivation Letter — ${safeStr(payload.data.scholarshipName)}`
          : 'Scholarship Motivation Letter')
      );
    case 'research_proposal':
      return safeStr(payload.data.proposalTitle) || 'Untitled Research Proposal';
    case 'study_plan':
      return (
        safeStr(payload.data.documentTitle) ||
        (safeStr(payload.data.targetDegree)
          ? `Study Plan — ${safeStr(payload.data.targetDegree)}`
          : 'Academic Study Plan')
      );
  }
};

export const extractDocumentAuthor = (payload: DocumentFormPayload): string => {
  switch (payload.category) {
    case 'international_cv':
    case 'academic_resume':
    case 'job_resume':
      return safeStr(payload.data.header?.fullName);
    case 'sop':
    case 'personal_statement':
    case 'scholarship_letter':
    case 'research_proposal':
    case 'study_plan':
      return safeStr(payload.data.applicantName);
  }
};

export const extractDocumentSummary = (payload: DocumentFormPayload): string => {
  switch (payload.category) {
    case 'international_cv':
      return safeStr(payload.data.professionalSummary).slice(0, 220);
    case 'academic_resume':
      return safeStr(payload.data.researchProfile).slice(0, 220);
    case 'job_resume':
      return safeStr(payload.data.professionalSummary).slice(0, 220);
    case 'sop':
      return (
        safeStr(payload.data.openingMotivation) ||
        `${safeStr(payload.data.targetDegreeAndProgram)} at ${safeStr(payload.data.targetInstitution)}`
      ).slice(0, 220);
    case 'personal_statement':
      return (
        safeStr(payload.data.definingStoryAndOrigin) ||
        safeStr(payload.data.targetProgramOrOpportunity)
      ).slice(0, 220);
    case 'scholarship_letter':
      return (
        safeStr(payload.data.purposeAndStanding) ||
        `${safeStr(payload.data.scholarshipName)} — ${safeStr(payload.data.sponsoringOrganization)}`
      ).slice(0, 220);
    case 'research_proposal':
      return (
        safeStr(payload.data.abstractSummary) || safeStr(payload.data.problemStatement)
      ).slice(0, 220);
    case 'study_plan':
      return (
        safeStr(payload.data.purposeAndSpecialization) ||
        `${safeStr(payload.data.targetDegree)} at ${safeStr(payload.data.hostInstitution)}`
      ).slice(0, 220);
  }
};

export const validateDocumentPayload = (
  payload: DocumentFormPayload
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  switch (payload.category) {
    case 'international_cv': {
      const d = payload.data;
      if (!safeStr(d.header?.fullName)) errors.push('Full Name is required.');
      if (!safeStr(d.header?.email)) errors.push('Email Address is required.');
      if (!safeStr(d.professionalSummary)) errors.push('Professional Summary is required.');
      break;
    }
    case 'academic_resume': {
      const d = payload.data;
      if (!safeStr(d.header?.fullName)) errors.push('Full Name is required.');
      if (!safeStr(d.header?.email)) errors.push('Email Address is required.');
      if (!safeStr(d.researchProfile)) errors.push('Research Profile is required.');
      break;
    }
    case 'job_resume': {
      const d = payload.data;
      if (!safeStr(d.header?.fullName)) errors.push('Full Name is required.');
      if (!safeStr(d.header?.email)) errors.push('Email Address is required.');
      if (!safeStr(d.targetJobTitle)) errors.push('Target Job Title is required.');
      if (!safeStr(d.professionalSummary)) errors.push('Executive Summary is required.');
      break;
    }
    case 'sop': {
      const d = payload.data;
      if (!safeStr(d.applicantName)) errors.push('Applicant Full Name is required.');
      if (!safeStr(d.targetDegreeAndProgram)) errors.push('Target Degree & Program is required.');
      if (!safeStr(d.targetInstitution)) errors.push('Target University / Institution is required.');
      if (!safeStr(d.openingMotivation) && !safeStr(d.academicFoundation)) {
        errors.push('At least the Opening Motivation or Academic Foundation section is required.');
      }
      break;
    }
    case 'personal_statement': {
      const d = payload.data;
      if (!safeStr(d.applicantName)) errors.push('Applicant Full Name is required.');
      if (!safeStr(d.targetProgramOrOpportunity)) {
        errors.push('Target Program / Opportunity is required.');
      }
      if (!safeStr(d.definingStoryAndOrigin) && !safeStr(d.valuesAndFutureContribution)) {
        errors.push('Please complete at least one narrative section.');
      }
      break;
    }
    case 'scholarship_letter': {
      const d = payload.data;
      if (!safeStr(d.applicantName)) errors.push('Applicant Full Name is required.');
      if (!safeStr(d.scholarshipName)) errors.push('Scholarship Name is required.');
      if (!safeStr(d.purposeAndStanding) && !safeStr(d.motivationAndMerit)) {
        errors.push('Letter body motivation content is required.');
      }
      break;
    }
    case 'research_proposal': {
      const d = payload.data;
      if (!safeStr(d.proposalTitle)) errors.push('Research Proposal Title is required.');
      if (!safeStr(d.applicantName)) errors.push('Author / Principal Investigator Name is required.');
      if (!safeStr(d.abstractSummary) && !safeStr(d.problemStatement)) {
        errors.push('Abstract or Problem Statement is required.');
      }
      break;
    }
    case 'study_plan': {
      const d = payload.data;
      if (!safeStr(d.applicantName)) errors.push('Applicant Full Name is required.');
      if (!safeStr(d.targetDegree)) errors.push('Target Degree / Program is required.');
      if (!safeStr(d.hostInstitution)) errors.push('Host University / Institution is required.');
      if (!safeStr(d.purposeAndSpecialization) && !safeStr(d.academicBackground)) {
        errors.push('Academic Background or Purpose of Study is required.');
      }
      break;
    }
  }

  return { valid: errors.length === 0, errors };
};
