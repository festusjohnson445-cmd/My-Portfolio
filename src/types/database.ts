export interface DynamicProject {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail_url?: string;
  overview?: string;
  objectives?: string;
  methodology?: string;
  technical_specifications?: string;
  cad_drawings?: string[];
  images?: string[];
  videos?: string[];
  tools_used?: string[];
  results?: string;
  demo_links?: string[];
  document_url?: string;
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
}

export interface ProjectMedia {
  id: string;
  project_id: string;
  media_type: 'image' | 'video' | 'cad' | 'pdf';
  url: string;
  title?: string;
  created_at?: string;
}

export interface Article {
  id: string;
  title: string;
  category: string;
  content: string;
  excerpt?: string;
  thumbnail_url?: string;
  video_url?: string;
  file_url?: string;
  author_name: string;
  author_role?: string;
  is_chief_admin?: boolean;
  status: 'published' | 'draft' | 'archived' | 'pending';
  reading_time_minutes?: number;
  views_count?: number;
  likes_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ArticleCategory {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface ArticleComment {
  id: string;
  article_id: string;
  author_name: string;
  content: string;
  is_approved: boolean;
  created_at?: string;
}

export interface ArticleLike {
  id: string;
  article_id: string;
  user_identifier: string;
  created_at?: string;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  location?: string;
  start_date: string;
  end_date?: string;
  is_current?: boolean;
  description: string;
  key_achievements?: string[];
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PublicationItem {
  id: string;
  title: string;
  publisher: string;
  date?: string;
  doi_or_url?: string;
  description: string;
  category?: string;
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  issuer: string;
  date?: string;
  description: string;
  category: 'Award' | 'Skill' | 'Academic' | 'Honor';
  order_index?: number;
  created_at?: string;
  updated_at?: string;
}
