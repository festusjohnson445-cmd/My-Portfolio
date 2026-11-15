import { supabase, resilientSupabaseUpsert, getValidatedSession } from './supabase';

// ==============================================================================
// 1. DATA TYPES & INTERFACES
// ==============================================================================

export interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'Production Deployed' | 'Validated Prototype' | 'Flight Ready' | 'Patent Pending' | 'In Progress';
  featured: boolean;
  thumbnail_url: string;
  hero_image: string;
  overview: string;
  objectives: string;
  methodology: string;
  technical_specs: Record<string, any>;
  cad_drawings: Array<{ title: string; url: string; fileType?: string; notes?: string }>;
  images: Array<{ url: string; caption?: string }>;
  videos: Array<{ url: string; title?: string }>;
  tools_used: string[];
  results: string;
  demo_links: Array<{ label: string; url: string }>;
  document_url?: string;
  document_name?: string;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ArticleRecord {
  id: string;
  title: string;
  slug?: string;
  summary: string;
  content: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  author_name: string;
  author_email?: string;
  author_role: string;
  is_chief_admin: boolean;
  thumbnail_url?: string;
  hero_media_type?: 'image' | 'video' | 'diagram' | 'cad_3d';
  hero_media_url?: string;
  reading_time: string;
  tldr?: string;
  table_of_contents?: Array<{ id: string; title: string; level?: number }>;
  equations?: Array<{ label: string; latex: string; description?: string }>;
  schematics?: Array<{ title: string; url: string; description?: string }>;
  code_blocks?: Array<{ language: string; title?: string; code: string }>;
  charts_data?: any;
  bom_items?: Array<{
    itemNo: number;
    partName: string;
    material: string;
    process: string;
    qty: number;
    cost?: number;
    supplier?: string;
  }>;
  attachments?: Array<{ name: string; url: string; size?: string; type?: string }>;
  is_approved: boolean;
  is_draft: boolean;
  is_archived: boolean;
  views_count: number;
  likes_count: number;
  created_at: string;
  updated_at?: string;
}

export interface ArticleCommentRecord {
  id: string;
  article_id: string;
  author_name: string;
  author_email?: string;
  content: string;
  is_approved: boolean;
  is_chief_admin?: boolean;
  created_at: string;
}

export interface ExperienceRecord {
  id: string;
  title: string;
  company: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description: string;
  key_achievements?: string[];
  technologies?: string[];
  display_order?: number;
  created_at?: string;
  updated_at?: string;
  // Aliases for compatibility
  role?: string;
  organization?: string;
  period?: string;
}

export interface PublicationRecord {
  id: string;
  title: string;
  publisher?: string;
  publication_date?: string;
  authors?: string;
  doi_url?: string;
  doi?: string;
  abstract?: string;
  file_url?: string;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AchievementRecord {
  id: string;
  title: string;
  issuer?: string;
  date_awarded?: string;
  award_date?: string;
  category: 'Award' | 'Honor' | 'Academic' | 'Certification' | 'Skill Group';
  description?: string;
  skills_managed?: string[];
  credential_url?: string;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

// Local storage fallback keys for resilient offline/no-table state
const STORAGE_PROJECTS = 'fesline_portfolio_projects';
const STORAGE_ARTICLES = 'fesline_portfolio_articles';
const STORAGE_EXPERIENCE = 'fesline_portfolio_experience';
const STORAGE_PUBLICATIONS = 'fesline_portfolio_publications';
const STORAGE_ACHIEVEMENTS = 'fesline_portfolio_achievements';

// ==============================================================================
// 2. PROJECTS OPERATIONS (EMPTY BY DEFAULT)
// ==============================================================================

export async function fetchProjectsFromSupabase(): Promise<ProjectRecord[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      try {
        localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('[Supabase Projects Fetch Note]:', err);
  }

  // Fallback to local cache
  try {
    const cached = localStorage.getItem(STORAGE_PROJECTS);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function saveProjectToSupabase(project: Partial<ProjectRecord>): Promise<{ success: boolean; data?: ProjectRecord; error?: string }> {
  const id = project.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}`);
  const payload: any = {
    ...project,
    id,
    title: project.title?.trim() || 'Untitled Project',
    description: project.description || '',
    category: project.category || 'Mechanical & CAD',
    status: project.status || 'Production Deployed',
    featured: Boolean(project.featured),
    thumbnail_url: project.thumbnail_url || '',
    hero_image: project.hero_image || project.thumbnail_url || '',
    overview: project.overview || '',
    objectives: project.objectives || '',
    methodology: project.methodology || '',
    technical_specs: project.technical_specs || {},
    cad_drawings: project.cad_drawings || [],
    images: project.images || [],
    videos: project.videos || [],
    tools_used: project.tools_used || [],
    results: project.results || '',
    demo_links: project.demo_links || [],
    document_url: project.document_url || '',
    document_name: project.document_name || '',
    updated_at: new Date().toISOString(),
  };

  if (!project.created_at) {
    payload.created_at = new Date().toISOString();
  }

  try {
    const { data, error } = await resilientSupabaseUpsert('projects', payload);
    if (!error) {
      // Refresh local cache
      const existing = await fetchProjectsFromSupabase();
      const updated = [payload, ...existing.filter((p) => p.id !== id)];
      try {
        localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(updated));
      } catch {}
      return { success: true, data: payload };
    }
    console.warn('[Supabase Save Project Note]:', error);
  } catch (err: any) {
    console.warn('[Supabase Project Catch]:', err);
  }

  // Local storage fallback
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_PROJECTS) || '[]');
    const filtered = cached.filter((p: any) => p.id !== id);
    const updated = [payload, ...filtered];
    localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(updated));
    return { success: true, data: payload };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to save project' };
  }
}

export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (!error) {
      const cached = JSON.parse(localStorage.getItem(STORAGE_PROJECTS) || '[]');
      localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(cached.filter((p: any) => p.id !== projectId)));
      return true;
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_PROJECTS) || '[]');
    localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(cached.filter((p: any) => p.id !== projectId)));
    return true;
  } catch {
    return false;
  }
}

// ==============================================================================
// 3. ARTICLES OPERATIONS (EMPTY BY DEFAULT, VISITOR SUBMISSIONS NEED APPROVAL)
// ==============================================================================

export async function fetchArticlesFromSupabase(includeUnapproved = false): Promise<ArticleRecord[]> {
  try {
    let query = supabase.from('articles').select('*').order('created_at', { ascending: false });

    if (!includeUnapproved) {
      query = query.eq('is_approved', true).eq('is_draft', false).eq('is_archived', false);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      if (!includeUnapproved) {
        try {
          localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(data));
        } catch {}
      }
      return data;
    }
  } catch (err) {
    console.warn('[Supabase Articles Fetch Note]:', err);
  }

  try {
    const cached = localStorage.getItem(STORAGE_ARTICLES);
    if (cached) {
      const parsed: ArticleRecord[] = JSON.parse(cached);
      return includeUnapproved ? parsed : parsed.filter((a) => a.is_approved && !a.is_draft && !a.is_archived);
    }
  } catch {}
  return [];
}

export async function submitArticleToSupabase(article: Partial<ArticleRecord>, isOwner = false): Promise<{ success: boolean; data?: ArticleRecord; error?: string }> {
  const id = article.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `art_${Date.now()}`);
  
  // Clean reading time calculation if empty
  const wordCount = (article.content || '').split(/\s+/).filter(Boolean).length;
  const calculatedReadingTime = `${Math.max(1, Math.ceil(wordCount / 180))} min read`;

  const payload: any = {
    ...article,
    id,
    title: article.title?.trim() || 'Untitled Article',
    summary: article.summary || '',
    content: article.content || '',
    category: article.category?.trim() || 'Mechanical Engineering',
    difficulty: article.difficulty || 'Intermediate',
    author_name: article.author_name?.trim() || (isOwner ? 'Festus, Olorunsogo Johnson' : 'Visitor Author'),
    author_role: isOwner ? 'Lead Mechanical Engineer' : (article.author_role || 'Contributing Author'),
    is_chief_admin: isOwner || Boolean(article.is_chief_admin),
    thumbnail_url: article.thumbnail_url || '',
    hero_media_type: article.hero_media_type || 'image',
    hero_media_url: article.hero_media_url || article.thumbnail_url || '',
    reading_time: article.reading_time || calculatedReadingTime,
    tldr: article.tldr || '',
    table_of_contents: article.table_of_contents || [],
    equations: article.equations || [],
    schematics: article.schematics || [],
    code_blocks: article.code_blocks || [],
    charts_data: article.charts_data || [],
    bom_items: article.bom_items || [],
    attachments: article.attachments || [],
    // Crucial rule: Visitors REQUIRE admin/owner approval before publication
    is_approved: isOwner ? (article.is_approved !== undefined ? article.is_approved : true) : false,
    is_draft: Boolean(article.is_draft),
    is_archived: Boolean(article.is_archived),
    views_count: article.views_count || 0,
    likes_count: article.likes_count || 0,
    created_at: article.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await resilientSupabaseUpsert('articles', payload);
    if (!error) {
      const cached = JSON.parse(localStorage.getItem(STORAGE_ARTICLES) || '[]');
      const updated = [payload, ...cached.filter((a: any) => a.id !== id)];
      try {
        localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(updated));
      } catch {}
      return { success: true, data: payload };
    }
  } catch (err: any) {
    console.warn('[Supabase Article Post Catch]:', err);
  }

  // Local storage fallback
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_ARTICLES) || '[]');
    const updated = [payload, ...cached.filter((a: any) => a.id !== id)];
    localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(updated));
    return { success: true, data: payload };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to submit article' };
  }
}

export async function approveArticleInSupabase(articleId: string, approve = true): Promise<boolean> {
  try {
    const { error } = await supabase.from('articles').update({ is_approved: approve, updated_at: new Date().toISOString() }).eq('id', articleId);
    if (!error) {
      const cached = JSON.parse(localStorage.getItem(STORAGE_ARTICLES) || '[]');
      const updated = cached.map((a: any) => a.id === articleId ? { ...a, is_approved: approve } : a);
      localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(updated));
      return true;
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_ARTICLES) || '[]');
    const updated = cached.map((a: any) => a.id === articleId ? { ...a, is_approved: approve } : a);
    localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export async function deleteArticleFromSupabase(articleId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('articles').delete().eq('id', articleId);
    if (!error) {
      const cached = JSON.parse(localStorage.getItem(STORAGE_ARTICLES) || '[]');
      localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(cached.filter((a: any) => a.id !== articleId)));
      return true;
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_ARTICLES) || '[]');
    localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(cached.filter((a: any) => a.id !== articleId)));
    return true;
  } catch {
    return false;
  }
}

export async function likeArticleInSupabase(articleId: string, userIdentifier: string): Promise<{ likes: number; hasLiked: boolean }> {
  try {
    // Check local tracker
    const likedKey = `fesline_liked_art_${articleId}`;
    const alreadyLiked = localStorage.getItem(likedKey) === 'true';

    if (alreadyLiked) {
      // Unlike
      localStorage.removeItem(likedKey);
      await supabase.from('article_likes').delete().eq('article_id', articleId).eq('user_identifier', userIdentifier);
      const { data } = await supabase.from('articles').select('likes_count').eq('id', articleId).maybeSingle();
      const current = Math.max(0, (data?.likes_count || 1) - 1);
      await supabase.from('articles').update({ likes_count: current }).eq('id', articleId);
      return { likes: current, hasLiked: false };
    } else {
      // Like
      localStorage.setItem(likedKey, 'true');
      await resilientSupabaseUpsert('article_likes', {
        id: `like_${articleId}_${userIdentifier}`,
        article_id: articleId,
        user_identifier: userIdentifier,
        created_at: new Date().toISOString(),
      });
      const { data } = await supabase.from('articles').select('likes_count').eq('id', articleId).maybeSingle();
      const current = (data?.likes_count || 0) + 1;
      await supabase.from('articles').update({ likes_count: current }).eq('id', articleId);
      return { likes: current, hasLiked: true };
    }
  } catch {
    return { likes: 1, hasLiked: true };
  }
}

export async function incrementArticleViews(articleId: string, visitorId?: string): Promise<void> {
  try {
    const sessionKey = `viewed_art_${articleId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, 'true');

    await resilientSupabaseUpsert('article_views', {
      id: `view_${articleId}_${Date.now()}`,
      article_id: articleId,
      visitor_id: visitorId || 'guest',
      viewed_at: new Date().toISOString(),
    });

    const { data } = await supabase.from('articles').select('views_count').eq('id', articleId).maybeSingle();
    const current = (data?.views_count || 0) + 1;
    await supabase.from('articles').update({ views_count: current }).eq('id', articleId);
  } catch {}
}

// Comments operations
export async function fetchArticleComments(articleId: string): Promise<ArticleCommentRecord[]> {
  try {
    const { data, error } = await supabase
      .from('article_comments')
      .select('*')
      .eq('article_id', articleId)
      .eq('is_approved', true)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data)) return data;
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(`art_comments_${articleId}`) || '[]');
    return cached;
  } catch {
    return [];
  }
}

export async function postArticleComment(comment: {
  article_id: string;
  author_name: string;
  author_email?: string;
  content: string;
  is_chief_admin?: boolean;
}): Promise<ArticleCommentRecord | null> {
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const record: ArticleCommentRecord = {
    id,
    article_id: comment.article_id,
    author_name: comment.author_name.trim() || 'Anonymous Reader',
    author_email: comment.author_email?.trim() || '',
    content: comment.content.trim(),
    is_approved: true, // Auto-approved or moderated
    is_chief_admin: Boolean(comment.is_chief_admin),
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await resilientSupabaseUpsert('article_comments', record);
    if (!error) {
      const cached = JSON.parse(localStorage.getItem(`art_comments_${comment.article_id}`) || '[]');
      localStorage.setItem(`art_comments_${comment.article_id}`, JSON.stringify([...cached, record]));
      return record;
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(`art_comments_${comment.article_id}`) || '[]');
    localStorage.setItem(`art_comments_${comment.article_id}`, JSON.stringify([...cached, record]));
    return record;
  } catch {
    return null;
  }
}

// ==============================================================================
// 4. EXPERIENCE & CAREER OPERATIONS
// ==============================================================================

export async function fetchExperienceFromSupabase(): Promise<ExperienceRecord[]> {
  try {
    const { data, error } = await supabase
      .from('experience')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && Array.isArray(data)) {
      try {
        localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(STORAGE_EXPERIENCE);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function saveExperienceToSupabase(exp: Partial<ExperienceRecord>): Promise<boolean> {
  const id = exp.id || `exp_${Date.now()}`;
  const payload: any = {
    ...exp,
    id,
    title: exp.title?.trim() || 'Role Title',
    company: exp.company?.trim() || 'Company / Organization',
    location: exp.location || '',
    start_date: exp.start_date || '',
    end_date: exp.end_date || (exp.is_current ? 'Present' : ''),
    is_current: Boolean(exp.is_current),
    description: exp.description || '',
    key_achievements: exp.key_achievements || [],
    technologies: exp.technologies || [],
    display_order: exp.display_order || 0,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await resilientSupabaseUpsert('experience', payload);
    if (!error) {
      const current = await fetchExperienceFromSupabase();
      const updated = [payload, ...current.filter((e) => e.id !== id)];
      localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(updated));
      return true;
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_EXPERIENCE) || '[]');
    const updated = [payload, ...cached.filter((e: any) => e.id !== id)];
    localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export async function deleteExperienceFromSupabase(expId: string): Promise<boolean> {
  try {
    await supabase.from('experience').delete().eq('id', expId);
    const cached = JSON.parse(localStorage.getItem(STORAGE_EXPERIENCE) || '[]');
    localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(cached.filter((e: any) => e.id !== expId)));
    return true;
  } catch {
    return false;
  }
}

// ==============================================================================
// 5. RESEARCH & PUBLICATIONS OPERATIONS
// ==============================================================================

export async function fetchPublicationsFromSupabase(): Promise<PublicationRecord[]> {
  try {
    const { data, error } = await supabase
      .from('publications')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && Array.isArray(data)) {
      try {
        localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(STORAGE_PUBLICATIONS);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function savePublicationToSupabase(pub: Partial<PublicationRecord>): Promise<boolean> {
  const id = pub.id || `pub_${Date.now()}`;
  const payload: any = {
    ...pub,
    id,
    title: pub.title?.trim() || 'Untitled Paper',
    publisher: pub.publisher || '',
    publication_date: pub.publication_date || '',
    authors: pub.authors || 'Festus Johnson',
    doi_url: pub.doi_url || '',
    abstract: pub.abstract || '',
    file_url: pub.file_url || '',
    display_order: pub.display_order || 0,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await resilientSupabaseUpsert('publications', payload);
    if (!error) {
      const current = await fetchPublicationsFromSupabase();
      const updated = [payload, ...current.filter((p) => p.id !== id)];
      localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(updated));
      return true;
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_PUBLICATIONS) || '[]');
    const updated = [payload, ...cached.filter((p: any) => p.id !== id)];
    localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export async function deletePublicationFromSupabase(pubId: string): Promise<boolean> {
  try {
    await supabase.from('publications').delete().eq('id', pubId);
    const cached = JSON.parse(localStorage.getItem(STORAGE_PUBLICATIONS) || '[]');
    localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(cached.filter((p: any) => p.id !== pubId)));
    return true;
  } catch {
    return false;
  }
}

// ==============================================================================
// 6. ACHIEVEMENTS & AWARDS OPERATIONS (INCLUDING SKILLS MANAGEMENT)
// ==============================================================================

export async function fetchAchievementsFromSupabase(): Promise<AchievementRecord[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('display_order', { ascending: true });

    if (!error && Array.isArray(data)) {
      try {
        localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(STORAGE_ACHIEVEMENTS);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function saveAchievementToSupabase(ach: Partial<AchievementRecord>): Promise<boolean> {
  const id = ach.id || `ach_${Date.now()}`;
  const payload: any = {
    ...ach,
    id,
    title: ach.title?.trim() || 'Achievement Title',
    issuer: ach.issuer || '',
    date_awarded: ach.date_awarded || '',
    category: ach.category || 'Award',
    description: ach.description || '',
    skills_managed: ach.skills_managed || [],
    credential_url: ach.credential_url || '',
    display_order: ach.display_order || 0,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await resilientSupabaseUpsert('achievements', payload);
    if (!error) {
      const current = await fetchAchievementsFromSupabase();
      const updated = [payload, ...current.filter((a) => a.id !== id)];
      localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(updated));
      return true;
    }
  } catch {}

  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_ACHIEVEMENTS) || '[]');
    const updated = [payload, ...cached.filter((a: any) => a.id !== id)];
    localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export async function deleteAchievementFromSupabase(achId: string): Promise<boolean> {
  try {
    await supabase.from('achievements').delete().eq('id', achId);
    const cached = JSON.parse(localStorage.getItem(STORAGE_ACHIEVEMENTS) || '[]');
    localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(cached.filter((a: any) => a.id !== achId)));
    return true;
  } catch {
    return false;
  }
}
