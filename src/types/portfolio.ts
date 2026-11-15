export type ProjectCategory = 'All' | 'CAD' | 'Web' | 'General';

export interface ProjectMetric {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface ProblemConstraints {
  envelope: string;
  thermal: string;
  massBudget: string;
  vibrationDynamic: string;
  factorOfSafety: string;
  environmental: string;
}

export interface HandCalculation {
  title: string;
  formula: string;
  variables: string;
  stepByStep: string[];
  outcome: string;
}

export interface FeaBoundaryConditions {
  software: string;
  meshType: string;
  elementCount: string;
  fixedConstraints: string;
  appliedLoads: string;
  convergenceCriterion: string;
  maxVonMises: string;
  yieldStrength: string;
  sfCalculated: string;
  notes: string;
}

export interface BomItem {
  itemNo: number;
  partName: string;
  material: string;
  process: string;
  qty: number;
  prototypeCost: number;
  productionCost1k: number;
  dfmSavingsPercent: number;
  supplier: string;
  leadTimeWeeks: number;
}

export interface CalculationWhitepaper {
  title: string;
  docRef: string;
  pages: number;
  date: string;
  abstract: string;
  keyFindings: string[];
}

export interface SupervisorEndorsement {
  name: string;
  role: string;
  company: string;
  relationship: string;
  quote: string;
  date: string;
  linkedin: string;
}

export interface Project {
  id: string;
  title: string;
  tagline: string;
  category: 'CAD' | 'Web' | 'General';
  completionDate: string;
  role: string;
  leadTimeWeeks?: number;
  status: 'Production Deployed' | 'Validated Prototype' | 'Flight Ready' | 'Patent Pending' | 'Active Development' | 'Completed';
  metrics?: ProjectMetric[];
  heroImage: string;
  cadModelImage?: string;
  physicalBuildImage?: string;
  feaPlotImage?: string;
  description?: string;
  overview?: string;
  objectives?: string;
  methodology?: string;
  techSpecs?: string;
  cadDrawingsUrl?: string;
  websiteUrl?: string;
  liveDemoUrl?: string;
  mediaGallery?: string[];
  toolsUsed?: string[];
  results?: string;
  problemConstraints?: ProblemConstraints;
  handCalculations?: HandCalculation[];
  feaBoundaryConditions?: FeaBoundaryConditions;
  individualContributions?: string[];
  verifiedCredentials?: string[];
  bom?: BomItem[];
  calculationWhitepaper?: CalculationWhitepaper;
  supervisorEndorsements?: SupervisorEndorsement[];
  ipComplianceDisclaimer?: string;
  gdtSpec?: any;
  templateType?: 'CAD' | 'Web' | 'General';
  modelType?: 'harmonic_actuator' | 'gimbal_bracket' | 'planetary_gearbox' | 'chassis_suspension';
  videoUrl?: string;
  videoAspectRatio?: '16:9' | '4:3' | '1:1';
  created_at?: string;
}

export interface Article {
  id: string;
  title: string;
  slug?: string;
  category: string;
  discipline: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  readingTime: string;
  author: string;
  author_id?: string;
  is_approved: boolean;
  summary: string;
  content: string;
  heroMediaUrl?: string;
  heroMediaType?: 'image' | 'video' | 'pdf' | 'cad';
  cadModelUrl?: string;
  pdfUrl?: string;
  bom?: {
    itemNo: number;
    partName: string;
    material: string;
    process: string;
    qty: number;
    supplier: string;
    cost: number;
  }[];
  attachments?: {
    name: string;
    url: string;
    size?: string;
  }[];
  likes_count: number;
  views_count: number;
  comments_count: number;
  created_at: string;
}

export interface ArticleComment {
  id: string;
  article_id: string;
  author_name: string;
  author_role?: string;
  author_avatar?: string;
  content: string;
  is_approved: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface HierarchicalCredential {
  id: string;
  title: string;
  type: 'Specialization' | 'Course';
  parent_id?: string | null;
  issuer: string;
  date: string;
  credentialId?: string;
  description?: string;
  documentUrl?: string;
  subCourses?: HierarchicalCredential[];
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  employment_type?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description: string;
  key_responsibilities?: string[];
  tools_used?: string[];
  order_index?: number;
  created_at?: string;
  updated_at?: string;
  // Aliases & compatibility properties
  role?: string;
  organization?: string;
  period?: string;
  technologies?: string[];
  highlights?: string[];
}

export interface PublicationItem {
  id: string;
  title: string;
  authors?: string;
  publisher?: string;
  publication_date?: string;
  doi?: string;
  doi_url?: string;
  abstract?: string;
  file_url?: string;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
  // Aliases & compatibility properties
  thumbnail_url?: string;
  journal_or_conference?: string;
  pdf_url?: string;
  document_url?: string;
  doi_or_url?: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  issuer?: string;
  category: string;
  date_awarded?: string;
  award_date?: string;
  description?: string;
  skills_managed?: string[];
  credential_url?: string;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
  // Aliases & compatibility properties
  issuer_or_organization?: string;
  organization?: string;
  badge_label?: string;
  certificate_url?: string;
  verification_url?: string;
}
