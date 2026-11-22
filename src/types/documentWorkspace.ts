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
  experiences: ExperienceEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  languages: LanguageEntry[];
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
  publications: PublicationEntry[];
  grantsAndAwards: string;
  technicalMethods: string;
  referees: RefereeEntry[];
}

export interface JobResumeData {
  header: ContactHeaderBlock;
  targetJobTitle: string;
  professionalSummary: string;
  technicalSkills: string;
  softAndLeadershipSkills: string;
  workExperience: ExperienceEntry[];
  keyProjects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
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
          languages: [],
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
          publications: [],
          grantsAndAwards: '',
          technicalMethods: '',
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

export const extractDocumentTitle = (payload: DocumentFormPayload): string => {
  switch (payload.category) {
    case 'international_cv':
      return payload.data.header.fullName
        ? `${payload.data.header.fullName} — International CV`
        : 'Untitled International CV';
    case 'academic_resume':
      return payload.data.header.fullName
        ? `${payload.data.header.fullName} — Academic Resume`
        : 'Untitled Academic Resume';
    case 'job_resume': {
      const name = payload.data.header.fullName.trim();
      const role = payload.data.targetJobTitle.trim();
      if (name && role) return `${name} — ${role}`;
      if (name) return `${name} — Job Resume`;
      if (role) return `${role} — Job Resume`;
      return 'Untitled Job Resume';
    }
    case 'sop':
      return (
        payload.data.documentTitle.trim() ||
        (payload.data.targetDegreeAndProgram
          ? `Statement of Purpose — ${payload.data.targetDegreeAndProgram}`
          : 'Statement of Purpose')
      );
    case 'personal_statement':
      return (
        payload.data.documentTitle.trim() ||
        (payload.data.targetProgramOrOpportunity
          ? `Personal Statement — ${payload.data.targetProgramOrOpportunity}`
          : 'Personal Statement')
      );
    case 'scholarship_letter':
      return (
        payload.data.subjectLine.trim() ||
        (payload.data.scholarshipName
          ? `Motivation Letter — ${payload.data.scholarshipName}`
          : 'Scholarship Motivation Letter')
      );
    case 'research_proposal':
      return payload.data.proposalTitle.trim() || 'Untitled Research Proposal';
    case 'study_plan':
      return (
        payload.data.documentTitle.trim() ||
        (payload.data.targetDegree
          ? `Study Plan — ${payload.data.targetDegree}`
          : 'Academic Study Plan')
      );
  }
};

export const extractDocumentAuthor = (payload: DocumentFormPayload): string => {
  switch (payload.category) {
    case 'international_cv':
    case 'academic_resume':
    case 'job_resume':
      return payload.data.header.fullName.trim();
    case 'sop':
    case 'personal_statement':
    case 'scholarship_letter':
    case 'research_proposal':
    case 'study_plan':
      return payload.data.applicantName.trim();
  }
};

export const extractDocumentSummary = (payload: DocumentFormPayload): string => {
  switch (payload.category) {
    case 'international_cv':
      return payload.data.professionalSummary.trim().slice(0, 220);
    case 'academic_resume':
      return payload.data.researchProfile.trim().slice(0, 220);
    case 'job_resume':
      return payload.data.professionalSummary.trim().slice(0, 220);
    case 'sop':
      return (
        payload.data.openingMotivation.trim() ||
        `${payload.data.targetDegreeAndProgram} at ${payload.data.targetInstitution}`
      ).slice(0, 220);
    case 'personal_statement':
      return (
        payload.data.definingStoryAndOrigin.trim() ||
        payload.data.targetProgramOrOpportunity
      ).slice(0, 220);
    case 'scholarship_letter':
      return (
        payload.data.purposeAndStanding.trim() ||
        `${payload.data.scholarshipName} — ${payload.data.sponsoringOrganization}`
      ).slice(0, 220);
    case 'research_proposal':
      return (
        payload.data.abstractSummary.trim() || payload.data.problemStatement.trim()
      ).slice(0, 220);
    case 'study_plan':
      return (
        payload.data.purposeAndSpecialization.trim() ||
        `${payload.data.targetDegree} at ${payload.data.hostInstitution}`
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
      if (!d.header.fullName.trim()) errors.push('Full Name is required.');
      if (!d.header.email.trim()) errors.push('Email Address is required.');
      if (!d.professionalSummary.trim()) errors.push('Professional Summary is required.');
      break;
    }
    case 'academic_resume': {
      const d = payload.data;
      if (!d.header.fullName.trim()) errors.push('Full Name is required.');
      if (!d.header.email.trim()) errors.push('Email Address is required.');
      if (!d.researchProfile.trim()) errors.push('Research Profile is required.');
      break;
    }
    case 'job_resume': {
      const d = payload.data;
      if (!d.header.fullName.trim()) errors.push('Full Name is required.');
      if (!d.header.email.trim()) errors.push('Email Address is required.');
      if (!d.targetJobTitle.trim()) errors.push('Target Job Title is required.');
      if (!d.professionalSummary.trim()) errors.push('Executive Summary is required.');
      break;
    }
    case 'sop': {
      const d = payload.data;
      if (!d.applicantName.trim()) errors.push('Applicant Full Name is required.');
      if (!d.targetDegreeAndProgram.trim()) errors.push('Target Degree & Program is required.');
      if (!d.targetInstitution.trim()) errors.push('Target University / Institution is required.');
      if (!d.openingMotivation.trim() && !d.academicFoundation.trim()) {
        errors.push('At least the Opening Motivation or Academic Foundation section is required.');
      }
      break;
    }
    case 'personal_statement': {
      const d = payload.data;
      if (!d.applicantName.trim()) errors.push('Applicant Full Name is required.');
      if (!d.targetProgramOrOpportunity.trim()) {
        errors.push('Target Program / Opportunity is required.');
      }
      if (!d.definingStoryAndOrigin.trim() && !d.valuesAndFutureContribution.trim()) {
        errors.push('Please complete at least one narrative section.');
      }
      break;
    }
    case 'scholarship_letter': {
      const d = payload.data;
      if (!d.applicantName.trim()) errors.push('Applicant Full Name is required.');
      if (!d.scholarshipName.trim()) errors.push('Scholarship Name is required.');
      if (!d.purposeAndStanding.trim() && !d.motivationAndMerit.trim()) {
        errors.push('Letter body motivation content is required.');
      }
      break;
    }
    case 'research_proposal': {
      const d = payload.data;
      if (!d.proposalTitle.trim()) errors.push('Research Proposal Title is required.');
      if (!d.applicantName.trim()) errors.push('Author / Principal Investigator Name is required.');
      if (!d.abstractSummary.trim() && !d.problemStatement.trim()) {
        errors.push('Abstract or Problem Statement is required.');
      }
      break;
    }
    case 'study_plan': {
      const d = payload.data;
      if (!d.applicantName.trim()) errors.push('Applicant Full Name is required.');
      if (!d.targetDegree.trim()) errors.push('Target Degree / Program is required.');
      if (!d.hostInstitution.trim()) errors.push('Host University / Institution is required.');
      if (!d.purposeAndSpecialization.trim() && !d.academicBackground.trim()) {
        errors.push('Academic Background or Purpose of Study is required.');
      }
      break;
    }
  }

  return { valid: errors.length === 0, errors };
};
