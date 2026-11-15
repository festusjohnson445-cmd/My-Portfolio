export interface ProjectMedia {
  id: string;
  project_id?: string;
  media_type: 'image' | 'video' | 'cad' | 'doc';
  url: string;
  caption?: string;
  display_order?: number;
}

export interface ProjectItem {
  id: string;
  owner_id?: string;
  title: string;
  slug?: string;
  category: string;
  short_description?: string;
  description?: string;
  tagline?: string;
  overview?: string;
  objectives?: string;
  methodology?: string;
  technical_specifications?: string;
  tools_used?: string[];
  thumbnail_url?: string;
  cad_drawing_url?: string;
  cad_file_url?: string;
  cad_drawings?: any;
  images?: any;
  videos?: any;
  demonstration_links?: any;
  downloadable_documents?: any;
  views_count?: number;
  video_url?: string;
  demo_url?: string;
  results?: string;
  featured?: boolean;
  is_featured?: boolean;
  status?: 'published' | 'draft' | 'archived' | string;
  media?: ProjectMedia[];
  created_at?: string;
  updated_at?: string;
}

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface ArticleComment {
  id: string;
  article_id: string;
  author_name: string;
  author_email?: string;
  author_avatar?: string;
  content: string;
  is_approved?: boolean;
  status?: string;
  is_owner?: boolean;
  created_at: string;
}

export interface ArticleItem {
  id: string;
  author_id?: string;
  author_name: string;
  author_role?: string;
  submitted_by?: string;
  visitor_email?: string;
  is_chief_admin?: boolean;
  is_owner_post?: boolean;
  title: string;
  slug?: string;
  category: string;
  excerpt?: string;
  content: string;
  cover_image?: string;
  cover_image_url?: string;
  reading_time?: string;
  reading_time_minutes?: number;
  published_at?: string;
  summary?: string;
  tags?: string[];
  status?: 'published' | 'pending' | 'draft' | 'archived' | string;
  is_featured?: boolean;
  is_published?: boolean;
  likes_count?: number;
  views_count?: number;
  like_count?: number;
  view_count?: number;
  comments_count?: number;
  created_at?: string;
  updated_at?: string;
  comments?: ArticleComment[];
  is_liked_by_user?: boolean;
}

export interface ExperienceItem {
  id: string;
  owner_id?: string;
  title?: string;
  role?: string;
  role_title?: string;
  company: string;
  location?: string;
  employment_type?: string;
  start_date?: string;
  end_date?: string;
  period?: string;
  current?: boolean;
  is_current?: boolean;
  summary?: string;
  description?: string;
  responsibilities?: string[];
  achievements?: string[];
  key_achievements?: string[];
  technologies?: string[];
  technologies_used?: string[];
  skills_used?: string[];
  project_ids?: string[];
  display_order?: number;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PublicationItem {
  id: string;
  owner_id?: string;
  title: string;
  authors: string | string[];
  publisher?: string;
  journal_or_conference?: string;
  publication_venue?: string;
  publication_type?: string;
  publication_date?: string;
  date?: string;
  pages?: number;
  citations_count?: number;
  tags?: string[];
  featured?: boolean;
  doi?: string;
  doi_or_url?: string;
  url?: string;
  document_url?: string;
  pdf_url?: string;
  thumbnail_url?: string;
  abstract?: string;
  description?: string;
  category?: string;
  keywords?: string[];
  display_order?: number;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AchievementItem {
  id: string;
  owner_id?: string;
  title: string;
  issuing_organization?: string;
  issuer?: string;
  organization?: string;
  issue_date?: string;
  date?: string;
  year?: string;
  date_awarded?: string;
  credential_id?: string;
  credential_url?: string;
  verification_url?: string;
  description?: string;
  category?: 'Award' | 'Honor' | 'Patent' | 'Competition' | 'Certification' | string;
  badgeIcon?: string;
  thumbnail_url?: string;
  display_order?: number;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface SkillWithCert {
  name: string;
  hasCertification: boolean;
  certIssuer?: string;
  certDate?: string;
  certId?: string;
}

export type BlogArticle = ArticleItem & { summary?: string };
export type CareerExperience = ExperienceItem;
export type ResearchPublication = PublicationItem;
export type EngineeringAchievement = AchievementItem;
export interface ServiceOffering {
  id: string;
  title: string;
  description: string;
  [key: string]: any;
}

