import { supabase, SUPABASE_BUCKETS, resilientSupabaseUpsert } from './supabase';
import type { CareerStudioCategory } from './portfolioSupabase';

export type { CareerStudioCategory };

export const CAREER_STUDIO_CATEGORIES: CareerStudioCategory[] = [
  'International CV',
  'Academic Resume',
  'Job Resume',
  'Statement of Purpose (SOP)',
  'Personal Statement',
  'Scholarship Motivation Letter',
  'Research Proposal',
  'Study Plan',
];

export interface CareerCategoryMeta {
  id: CareerStudioCategory;
  shortLabel: string;
  layoutStyle: 'ats' | 'academic' | 'letter' | 'proposal';
  atsCompliant: boolean;
  summaryTip: string;
  sectionOrderDefaults: string[];
  sectionLabels: Record<string, string>;
}

export const CAREER_CATEGORY_META: Record<CareerStudioCategory, CareerCategoryMeta> = {
  'International CV': {
    id: 'International CV',
    shortLabel: 'International CV (ATS)',
    layoutStyle: 'ats',
    atsCompliant: true,
    summaryTip:
      'Strict single-column ATS structure: no tables, icons, or multi-column blocks. Include clear dates, country/city, quantified outcomes, and core competencies.',
    sectionOrderDefaults: [
      'summary',
      'experience',
      'education',
      'skills',
      'certifications',
      'languages',
      'referees',
    ],
    sectionLabels: {
      summary: 'Professional Summary',
      experience: 'Work Experience',
      education: 'Education',
      skills: 'Core Competencies & Skills',
      certifications: 'Certifications & Licenses',
      languages: 'Languages',
      referees: 'References',
    },
  },
  'Academic Resume': {
    id: 'Academic Resume',
    shortLabel: 'Academic Resume / CV',
    layoutStyle: 'academic',
    atsCompliant: true,
    summaryTip:
      'Highlight research focus, thesis topics, peer-reviewed publications, teaching/TA experience, grants, and academic honors in reverse chronological order.',
    sectionOrderDefaults: [
      'interests',
      'education',
      'appointments',
      'publications',
      'grants',
      'service',
      'referees',
    ],
    sectionLabels: {
      interests: 'Academic Profile & Research Interests',
      education: 'Education & Theses',
      appointments: 'Research & Teaching Appointments',
      publications: 'Publications & Conference Papers',
      grants: 'Grants, Fellowships & Awards',
      service: 'Academic Service & Memberships',
      referees: 'Academic Referees',
    },
  },
  'Job Resume': {
    id: 'Job Resume',
    shortLabel: 'Job Resume (ATS)',
    layoutStyle: 'ats',
    atsCompliant: true,
    summaryTip:
      'Strict ATS-parsed structure tailored for industry roles: keep headings standard, start experience bullets with action verbs, and pair tools with measurable impact.',
    sectionOrderDefaults: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'],
    sectionLabels: {
      summary: 'Professional Summary',
      experience: 'Professional Experience',
      projects: 'Key Projects',
      education: 'Education',
      skills: 'Technical & Core Skills',
      certifications: 'Certifications',
    },
  },
  'Statement of Purpose (SOP)': {
    id: 'Statement of Purpose (SOP)',
    shortLabel: 'Statement of Purpose',
    layoutStyle: 'academic',
    atsCompliant: false,
    summaryTip:
      'Connect past quantitative preparation and research/work projects directly to why this specific department, lab, and faculty match your future trajectory.',
    sectionOrderDefaults: ['intro', 'academic', 'experience', 'fit', 'goals', 'closing'],
    sectionLabels: {
      intro: 'Introduction & Motivation',
      academic: 'Academic Preparation',
      experience: 'Research & Technical Experience',
      fit: 'Program & Faculty Alignment',
      goals: 'Short- & Long-Term Career Goals',
      closing: 'Closing Statement',
    },
  },
  'Personal Statement': {
    id: 'Personal Statement',
    shortLabel: 'Personal Statement',
    layoutStyle: 'academic',
    atsCompliant: false,
    summaryTip:
      'Center your personal narrative around formative experiences, resilience, values, and how your distinct perspective will enrich the target cohort.',
    sectionOrderDefaults: ['origin', 'milestones', 'leadership', 'alignment'],
    sectionLabels: {
      origin: 'Personal Origin & Motivation',
      milestones: 'Formative Experiences & Growth',
      leadership: 'Leadership, Service & Values',
      alignment: 'Future Contribution & Fit',
    },
  },
  'Scholarship Motivation Letter': {
    id: 'Scholarship Motivation Letter',
    shortLabel: 'Scholarship Motivation Letter',
    layoutStyle: 'letter',
    atsCompliant: false,
    summaryTip:
      'Follow formal letter protocol: specify the exact scholarship title, prove academic merit, demonstrate leadership/impact, and articulate your post-study return plan.',
    sectionOrderDefaults: ['opening', 'merit', 'impact', 'readiness'],
    sectionLabels: {
      opening: 'Purpose & Application Opening',
      merit: 'Academic Merit & Achievements',
      impact: 'Leadership & Societal Impact Plan',
      readiness: 'Program Readiness & Closing Appeal',
    },
  },
  'Research Proposal': {
    id: 'Research Proposal',
    shortLabel: 'Research Proposal',
    layoutStyle: 'proposal',
    atsCompliant: false,
    summaryTip:
      'Articulate a clear knowledge gap, testable research questions/objectives, rigorous methodology, realistic milestone timeline, and authoritative citations.',
    sectionOrderDefaults: [
      'abstract',
      'background',
      'literature',
      'objectives',
      'methodology',
      'outcomes',
      'timeline',
      'references',
    ],
    sectionLabels: {
      abstract: '1. Abstract',
      background: '2. Background & Problem Statement',
      literature: '3. Literature Review & Research Gap',
      objectives: '4. Research Questions & Objectives',
      methodology: '5. Proposed Methodology',
      outcomes: '6. Expected Outcomes & Significance',
      timeline: '7. Work Plan & Timeline',
      references: '8. Key References',
    },
  },
  'Study Plan': {
    id: 'Study Plan',
    shortLabel: 'Study Plan',
    layoutStyle: 'proposal',
    atsCompliant: false,
    summaryTip:
      'Explain your academic progression clearly: why your chosen major, why the host country/university, semester-by-semester study focus, and home-country career return.',
    sectionOrderDefaults: ['background', 'hostFit', 'schedule', 'adaptation', 'careerReturn'],
    sectionLabels: {
      background: '1. Academic Background & Major Rationale',
      hostFit: '2. Rationale for Host Country & University',
      schedule: '3. Structured Academic & Research Schedule',
      adaptation: '4. Language & Cultural Readiness',
      careerReturn: '5. Post-Graduation & Career Plan',
    },
  },
};

// Dynamic Repeatable Entry Interfaces
export interface CareerEducationEntry {
  id: string;
  degree: string;
  institution: string;
  location: string;
  startYear: string;
  endYear: string;
  gradeOrGpa: string;
  highlights: string;
}

export interface CareerExperienceEntry {
  id: string;
  role: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  bullets: string;
}

export interface CareerProjectEntry {
  id: string;
  name: string;
  roleOrContext: string;
  tools: string;
  outcome: string;
}

export interface CareerPublicationEntry {
  id: string;
  title: string;
  authors: string;
  venue: string;
  year: string;
  doiOrUrl: string;
}

export interface CareerCertificationEntry {
  id: string;
  name: string;
  issuer: string;
  year: string;
  credentialId: string;
}

export interface CareerLanguageEntry {
  id: string;
  language: string;
  proficiency: string;
}

export interface CareerRefereeEntry {
  id: string;
  name: string;
  titleAndOrg: string;
  email: string;
  phone: string;
}

export interface CareerMilestoneEntry {
  id: string;
  phase: string;
  duration: string;
  deliverable: string;
}

export interface CareerCustomSectionEntry {
  id: string;
  heading: string;
  content: string;
}

export interface CareerSectionCustomization {
  order: string[];
  hiddenSections: string[];
  customTitleOverrides: Record<string, string>;
}

export interface CareerStudioFormData {
  // Universal header / identity fields (used appropriately per category)
  documentTitle: string;
  fullName: string;
  headlineOrTargetRole: string;
  email: string;
  phone: string;
  location: string;
  websiteOrLink: string;
  documentDate: string;

  // International CV & Job Resume
  workAuthorization: string;
  professionalSummary: string;
  skillsText: string;
  education: CareerEducationEntry[];
  experience: CareerExperienceEntry[];
  projects: CareerProjectEntry[];
  certifications: CareerCertificationEntry[];
  languages: CareerLanguageEntry[];
  referees: CareerRefereeEntry[];
  refereesAvailableOnRequest: boolean;

  // Academic Resume extras
  academicAffiliation: string;
  researchInterests: string;
  publications: CareerPublicationEntry[];
  grantsAndAwards: string;
  academicService: string;

  // SOP / Personal Statement / Motivation Letter context
  targetProgram: string;
  targetInstitution: string;
  targetDepartment: string;
  applicationTerm: string;
  scholarshipName: string;
  awardingBody: string;
  recipientSalutation: string;
  hostCountry: string;
  citizenshipCountry: string;
  studyDuration: string;

  // Narrative Sections (SOP / Personal Statement / Motivation Letter)
  secIntro: string;
  secAcademic: string;
  secExperience: string;
  secFit: string;
  secGoals: string;
  secClosing: string;
  secPersonalOrigin: string;
  secPersonalMilestones: string;
  secPersonalLeadership: string;
  secPersonalAlignment: string;

  // Scholarship Letter sections
  secLetterOpening: string;
  secLetterMerit: string;
  secLetterImpact: string;
  secLetterReadiness: string;

  // Research Proposal sections
  proposedDegreeLevel: string;
  targetSupervisor: string;
  secAbstract: string;
  secBackground: string;
  secLiteratureGap: string;
  researchObjectivesList: string;
  secMethodology: string;
  secExpectedOutcomes: string;
  milestones: CareerMilestoneEntry[];
  referencesList: string;

  // Study Plan sections
  secStudyBackground: string;
  secHostUniversityRationale: string;
  studySchedule: CareerMilestoneEntry[];
  secLanguageAdaptation: string;
  secPostGradPlan: string;

  // Custom extra sections appended at bottom
  customSections: CareerCustomSectionEntry[];
}

export interface CareerStudioDocumentRecord {
  id: string;
  category: CareerStudioCategory;
  title: string;
  authorName: string;
  clientToken?: string;
  formData: CareerStudioFormData;
  sectionConfig: CareerSectionCustomization;
  pdfUrl?: string;
  docxUrl?: string;
  previewImageUrl?: string;
  status: 'draft' | 'published';
  viewsCount: number;
  downloadsCount: number;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyFormData(): CareerStudioFormData {
  return {
    documentTitle: '',
    fullName: '',
    headlineOrTargetRole: '',
    email: '',
    phone: '',
    location: '',
    websiteOrLink: '',
    documentDate: '',
    workAuthorization: '',
    professionalSummary: '',
    skillsText: '',
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    languages: [],
    referees: [],
    refereesAvailableOnRequest: false,
    academicAffiliation: '',
    researchInterests: '',
    publications: [],
    grantsAndAwards: '',
    academicService: '',
    targetProgram: '',
    targetInstitution: '',
    targetDepartment: '',
    applicationTerm: '',
    scholarshipName: '',
    awardingBody: '',
    recipientSalutation: '',
    hostCountry: '',
    citizenshipCountry: '',
    studyDuration: '',
    secIntro: '',
    secAcademic: '',
    secExperience: '',
    secFit: '',
    secGoals: '',
    secClosing: '',
    secPersonalOrigin: '',
    secPersonalMilestones: '',
    secPersonalLeadership: '',
    secPersonalAlignment: '',
    secLetterOpening: '',
    secLetterMerit: '',
    secLetterImpact: '',
    secLetterReadiness: '',
    proposedDegreeLevel: '',
    targetSupervisor: '',
    secAbstract: '',
    secBackground: '',
    secLiteratureGap: '',
    researchObjectivesList: '',
    secMethodology: '',
    secExpectedOutcomes: '',
    milestones: [],
    referencesList: '',
    secStudyBackground: '',
    secHostUniversityRationale: '',
    studySchedule: [],
    secLanguageAdaptation: '',
    secPostGradPlan: '',
    customSections: [],
  };
}

export function createDefaultSectionCustomization(
  category: CareerStudioCategory
): CareerSectionCustomization {
  return {
    order: [...CAREER_CATEGORY_META[category].sectionOrderDefaults],
    hiddenSections: [],
    customTitleOverrides: {},
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  completenessPct: number;
}

export function validateCareerStudioForm(
  category: CareerStudioCategory,
  data: CareerStudioFormData
): ValidationResult {
  const errors: string[] = [];
  let filledChecks = 0;
  let totalChecks = 4;

  if (!data.fullName.trim()) {
    errors.push('Full Name is required.');
  } else {
    filledChecks++;
  }

  if (!data.email.trim()) {
    errors.push('Email Address is required.');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.push('Enter a valid Email Address.');
  } else {
    filledChecks++;
  }

  switch (category) {
    case 'International CV': {
      totalChecks = 5;
      if (!data.professionalSummary.trim()) {
        errors.push('Professional Summary is required.');
      } else {
        filledChecks++;
      }
      if (data.experience.length === 0 && data.education.length === 0) {
        errors.push('Add at least one Work Experience or Education entry.');
      } else {
        filledChecks++;
      }
      if (data.skillsText.trim()) filledChecks++;
      break;
    }
    case 'Academic Resume': {
      totalChecks = 5;
      if (!data.researchInterests.trim() && !data.academicAffiliation.trim()) {
        errors.push('Research Interests or Academic Affiliation is required.');
      } else {
        filledChecks++;
      }
      if (data.education.length === 0) {
        errors.push('Add at least one Education entry.');
      } else {
        filledChecks++;
      }
      if (data.publications.length > 0 || data.experience.length > 0) filledChecks++;
      break;
    }
    case 'Job Resume': {
      totalChecks = 5;
      if (!data.headlineOrTargetRole.trim()) {
        errors.push('Target Role / Job Headline is required.');
      } else {
        filledChecks++;
      }
      if (data.experience.length === 0 && data.projects.length === 0) {
        errors.push('Add at least one Professional Experience or Key Project entry.');
      } else {
        filledChecks++;
      }
      if (data.skillsText.trim()) filledChecks++;
      break;
    }
    case 'Statement of Purpose (SOP)': {
      totalChecks = 6;
      if (!data.targetProgram.trim()) errors.push('Target Degree & Program is required.');
      else filledChecks++;
      if (!data.targetInstitution.trim()) errors.push('Target University / Institution is required.');
      else filledChecks++;
      if (!data.secIntro.trim() || !data.secFit.trim()) {
        errors.push('Introduction and Program & Faculty Alignment are required.');
      } else {
        filledChecks += 2;
      }
      break;
    }
    case 'Personal Statement': {
      totalChecks = 5;
      if (!data.targetProgram.trim()) errors.push('Target Program / Opportunity is required.');
      else filledChecks++;
      if (!data.secPersonalOrigin.trim() || !data.secPersonalAlignment.trim()) {
        errors.push('Personal Origin & Motivation and Future Contribution & Fit are required.');
      } else {
        filledChecks += 2;
      }
      break;
    }
    case 'Scholarship Motivation Letter': {
      totalChecks = 6;
      if (!data.scholarshipName.trim()) errors.push('Scholarship Name is required.');
      else filledChecks++;
      if (!data.targetInstitution.trim()) errors.push('Target Host University is required.');
      else filledChecks++;
      if (!data.secLetterOpening.trim() || !data.secLetterMerit.trim()) {
        errors.push('Opening Purpose and Academic Merit sections are required.');
      } else {
        filledChecks += 2;
      }
      break;
    }
    case 'Research Proposal': {
      totalChecks = 6;
      if (!data.documentTitle.trim()) errors.push('Research Proposal Title is required.');
      else filledChecks++;
      if (!data.secAbstract.trim()) errors.push('Abstract is required.');
      else filledChecks++;
      if (!data.secBackground.trim() || !data.secMethodology.trim()) {
        errors.push('Problem Statement and Proposed Methodology are required.');
      } else {
        filledChecks += 2;
      }
      break;
    }
    case 'Study Plan': {
      totalChecks = 6;
      if (!data.targetProgram.trim()) errors.push('Target Degree & Major is required.');
      else filledChecks++;
      if (!data.targetInstitution.trim()) errors.push('Host University / Institution is required.');
      else filledChecks++;
      if (!data.secStudyBackground.trim() || !data.secPostGradPlan.trim()) {
        errors.push('Academic Background and Post-Graduation Career Plan are required.');
      } else {
        filledChecks += 2;
      }
      break;
    }
  }

  const completenessPct = Math.min(100, Math.round((filledChecks / Math.max(1, totalChecks)) * 100));
  return {
    valid: errors.length === 0,
    errors,
    completenessPct,
  };
}

export function resolveDocumentTitle(
  category: CareerStudioCategory,
  data: CareerStudioFormData
): string {
  if (data.documentTitle.trim()) return data.documentTitle.trim();
  const who = data.fullName.trim();
  if (who && data.targetProgram.trim()) return `${who} — ${data.targetProgram.trim()} (${category})`;
  if (who && data.headlineOrTargetRole.trim()) return `${who} — ${data.headlineOrTargetRole.trim()}`;
  if (who) return `${who} — ${category}`;
  return category;
}

// ============================================================================
// CLIENT IDENTITY TOKEN + LOCAL CACHE + SUPABASE PERSISTENCE
// ============================================================================

const CLIENT_TOKEN_KEY = 'fesline_career_studio_client_token';
const LOCAL_DOCS_CACHE_KEY = 'fesline_career_studio_docs_cache';

export function getCareerStudioClientToken(): string {
  try {
    let tok = localStorage.getItem(CLIENT_TOKEN_KEY);
    if (!tok) {
      tok =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? `cs_${crypto.randomUUID()}`
          : `cs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(CLIENT_TOKEN_KEY, tok);
    }
    return tok;
  } catch {
    return 'cs_browser';
  }
}

function mapRowToDoc(row: any): CareerStudioDocumentRecord {
  let formData = row.form_data;
  if (typeof formData === 'string') {
    try {
      formData = JSON.parse(formData);
    } catch {
      formData = {};
    }
  }
  let sectionConfig = row.section_config;
  if (typeof sectionConfig === 'string') {
    try {
      sectionConfig = JSON.parse(sectionConfig);
    } catch {
      sectionConfig = {};
    }
  }
  const cat = (CAREER_STUDIO_CATEGORIES.includes(row.category)
    ? row.category
    : 'International CV') as CareerStudioCategory;

  return {
    id: String(row.id),
    category: cat,
    title: String(row.title || cat),
    authorName: String(row.author_name || formData?.fullName || 'Anonymous'),
    clientToken: row.client_token || undefined,
    formData: { ...createEmptyFormData(), ...(formData || {}) },
    sectionConfig: {
      ...createDefaultSectionCustomization(cat),
      ...(sectionConfig || {}),
    },
    pdfUrl: row.pdf_url || '',
    docxUrl: row.docx_url || '',
    previewImageUrl: row.preview_image_url || '',
    status: row.status === 'published' ? 'published' : 'draft',
    viewsCount: Number(row.views_count || 0),
    downloadsCount: Number(row.downloads_count || 0),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function getCachedCareerStudioDocs(): CareerStudioDocumentRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_CACHE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

function writeCachedCareerStudioDocs(docs: CareerStudioDocumentRecord[]): void {
  try {
    localStorage.setItem(LOCAL_DOCS_CACHE_KEY, JSON.stringify(docs.slice(0, 60)));
  } catch {}
}

export async function fetchCareerStudioDocuments(
  includeAllForAdmin = false
): Promise<CareerStudioDocumentRecord[]> {
  const clientToken = getCareerStudioClientToken();
  try {
    let query = supabase
      .from('career_studio_documents')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (!includeAllForAdmin) {
      query = query.or(`status.eq.published,client_token.eq.${clientToken}`);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const mapped = data.map(mapRowToDoc);
      writeCachedCareerStudioDocs(mapped);
      return mapped;
    }
  } catch {}
  return getCachedCareerStudioDocs();
}

export async function uploadCareerStudioArtifact(
  blob: Blob,
  fileName: string,
  contentType: string
): Promise<string> {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `career-studio/${Date.now()}_${cleanName}`;
  const buckets = [SUPABASE_BUCKETS.MATERIALS, 'Materials'];

  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, blob, {
          contentType,
          cacheControl: '3600',
          upsert: true,
        });
      if (!error && data?.path) {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(data.path);
        if (pub?.publicUrl) return pub.publicUrl;
      }
    } catch {}
  }
  return '';
}

export async function saveCareerStudioDocument(
  record: Omit<CareerStudioDocumentRecord, 'createdAt' | 'updatedAt' | 'viewsCount' | 'downloadsCount'> & {
    createdAt?: string;
    viewsCount?: number;
    downloadsCount?: number;
  }
): Promise<CareerStudioDocumentRecord> {
  const now = new Date().toISOString();
  const clientToken = record.clientToken || getCareerStudioClientToken();
  let ownerUid: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    ownerUid = data?.session?.user?.id || null;
  } catch {}

  const fullRecord: CareerStudioDocumentRecord = {
    ...record,
    clientToken,
    viewsCount: record.viewsCount ?? 0,
    downloadsCount: record.downloadsCount ?? 0,
    createdAt: record.createdAt || now,
    updatedAt: now,
  };

  const payload = {
    id: fullRecord.id,
    owner_id: ownerUid,
    client_token: clientToken,
    category: fullRecord.category,
    title: fullRecord.title,
    author_name: fullRecord.authorName,
    form_data: fullRecord.formData,
    section_config: fullRecord.sectionConfig,
    pdf_url: fullRecord.pdfUrl || '',
    docx_url: fullRecord.docxUrl || '',
    preview_image_url: fullRecord.previewImageUrl || '',
    status: fullRecord.status,
    views_count: fullRecord.viewsCount,
    downloads_count: fullRecord.downloadsCount,
    created_at: fullRecord.createdAt,
    updated_at: fullRecord.updatedAt,
  };

  try {
    const { error } = await resilientSupabaseUpsert('career_studio_documents', payload);
    if (error) {
      console.warn('[Career Studio Save fallback]:', error.message || error);
    }
  } catch (err) {
    console.warn('[Career Studio Save error]:', err);
  }

  const existing = getCachedCareerStudioDocs();
  const merged = existing.some((d) => d.id === fullRecord.id)
    ? existing.map((d) => (d.id === fullRecord.id ? fullRecord : d))
    : [fullRecord, ...existing];
  writeCachedCareerStudioDocs(merged);
  return fullRecord;
}

export async function deleteCareerStudioDocument(id: string): Promise<boolean> {
  const clientToken = getCareerStudioClientToken();
  let deletedRemotely = false;
  try {
    const { error } = await supabase
      .from('career_studio_documents')
      .delete()
      .eq('id', id);
    if (!error) deletedRemotely = true;
    else {
      // Try client-token scoped delete if owner policy didn't match
      const retry = await supabase
        .from('career_studio_documents')
        .delete()
        .eq('id', id)
        .eq('client_token', clientToken);
      if (!retry.error) deletedRemotely = true;
    }
  } catch {}

  const updated = getCachedCareerStudioDocs().filter((d) => d.id !== id);
  writeCachedCareerStudioDocs(updated);
  return deletedRemotely || true;
}

export function subscribeToCareerStudioDocuments(callback: () => void): () => void {
  try {
    const chan = supabase
      .channel('public:career_studio_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'career_studio_documents' },
        () => callback()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(chan).catch(() => {});
    };
  } catch {
    return () => {};
  }
}
