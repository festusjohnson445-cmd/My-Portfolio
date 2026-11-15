export interface ProjectItem {
  id: string;
  title: string;
  category: string;
  description: string;
  overview?: string;
  objectives?: string;
  methodology?: string;
  technical_specs?: string;
  cad_drawings?: string;
  thumbnail_url?: string;
  document_url?: string;
  document_name?: string;
  demo_url?: string;
  video_url?: string;
  tools?: string;
  results?: string;
  is_featured?: boolean;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
  media?: ProjectMediaItem[];
}

export interface ProjectMediaItem {
  id: string;
  project_id: string;
  media_url: string;
  media_type: 'image' | 'video' | 'cad' | 'document';
  caption?: string;
  display_order?: number;
  created_at?: string;
}

export interface ArticleItem {
  id: string;
  title: string;
  slug?: string;
  summary: string;
  content: string;
  category: string;
  author_name: string;
  author_role?: string;
  author_id?: string;
  is_owner?: boolean;
  thumbnail_url?: string;
  video_url?: string;
  status: 'published' | 'draft' | 'pending' | 'archived';
  reading_time_minutes: number;
  likes_count: number;
  views_count: number;
  created_at?: string;
  updated_at?: string;
  comments?: ArticleCommentItem[];
}

export interface ArticleCommentItem {
  id: string;
  article_id: string;
  author_name: string;
  author_email?: string;
  content: string;
  status: 'approved' | 'pending' | 'rejected';
  is_owner?: boolean;
  created_at?: string;
}

export interface ExperienceItem {
  id: string;
  role: string;
  organization: string;
  location?: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
  description: string;
  achievements?: string;
  display_order?: number;
  created_at?: string;
}

export interface PublicationItem {
  id: string;
  title: string;
  publication_venue?: string;
  date?: string;
  doi_or_url?: string;
  abstract?: string;
  authors?: string;
  category?: string;
  display_order?: number;
  created_at?: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  issuer?: string;
  date?: string;
  category?: string;
  description?: string;
  credential_url?: string;
  skills?: string;
  display_order?: number;
  created_at?: string;
}

export interface SpecializationCredential {
  id: string;
  title: string;
  issuer: string;
  date: string;
  category: 'Specialization';
  credentialId?: string;
  description: string;
  attachmentUrl?: string;
  attachmentName?: string;
  subCourses?: CourseCertificate[];
}

export interface CourseCertificate {
  id: string;
  specializationId?: string;
  title: string;
  issuer: string;
  date: string;
  category: 'Course';
  credentialId?: string;
  description?: string;
  attachmentUrl?: string;
  attachmentName?: string;
}
