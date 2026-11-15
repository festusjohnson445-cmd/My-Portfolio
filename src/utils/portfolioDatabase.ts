import { supabase, resilientSupabaseUpsert, getValidatedSession, uploadMaterialToSupabaseBucket, uploadChatFileToMaterialsBucket } from './supabase';
import type {
  DynamicProject,
  Article,
  ArticleCategory,
  ArticleComment,
  ExperienceItem,
  PublicationItem,
  AchievementItem,
} from '../types/database';

// Local storage backup keys for resiliency before remote migration runs
const STORAGE_PROJECTS = 'fesline_dynamic_projects';
const STORAGE_ARTICLES = 'fesline_dynamic_articles';
const STORAGE_COMMENTS = 'fesline_dynamic_comments';
const STORAGE_EXPERIENCE = 'fesline_dynamic_experience';
const STORAGE_PUBLICATIONS = 'fesline_dynamic_publications';
const STORAGE_ACHIEVEMENTS = 'fesline_dynamic_achievements';

// ============================================================================
// 1. UNIVERSAL MEDIA UPLOAD HELPER (FILE OR URL)
// ============================================================================

export async function uploadPortfolioMedia(
  fileOrUrl: File | Blob | string,
  fileName?: string
): Promise<string> {
  if (typeof fileOrUrl === 'string') {
    const trimmed = fileOrUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (trimmed.startsWith('data:')) {
      // Data URL or base64
      return trimmed;
    }
  }

  // Upload file / blob to materials bucket
  const name = fileName || (fileOrUrl instanceof File ? fileOrUrl.name : `media_${Date.now()}`);
  try {
    const result = await uploadChatFileToMaterialsBucket(
      fileOrUrl as File | Blob,
      name,
      'files'
    );
    if (result?.url) return result.url;
  } catch (err) {
    console.warn('[uploadPortfolioMedia fallback]', err);
  }

  // Resilient fallback to Data URL
  return new Promise<string>((resolve) => {
    if (fileOrUrl instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileOrUrl);
    } else {
      resolve(String(fileOrUrl || ''));
    }
  });
}

// ============================================================================
// 2. PROJECTS CRUD
// ============================================================================

export async function fetchProjectsFromSupabase(): Promise<DynamicProject[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('[fetchProjectsFromSupabase warning]', err);
  }

  try {
    const cached = localStorage.getItem(STORAGE_PROJECTS);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function saveProjectToSupabase(project: Partial<DynamicProject>): Promise<DynamicProject> {
  const id = project.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}`);
  const payload: any = {
    id,
    title: project.title || 'Untitled Project',
    description: project.description || '',
    category: project.category || 'Engineering',
    thumbnail_url: project.thumbnail_url || '',
    overview: project.overview || '',
    objectives: project.objectives || '',
    methodology: project.methodology || '',
    technical_specifications: project.technical_specifications || '',
    cad_drawings: project.cad_drawings || [],
    images: project.images || [],
    videos: project.videos || [],
    tools_used: project.tools_used || [],
    results: project.results || '',
    demo_links: project.demo_links || [],
    document_url: project.document_url || '',
    updated_at: new Date().toISOString(),
  };

  if (!project.id) {
    payload.created_at = new Date().toISOString();
  }

  // Try saving to Supabase
  try {
    await resilientSupabaseUpsert('projects', payload, 'id');
  } catch (err) {
    console.warn('[saveProjectToSupabase note]', err);
  }

  // Update localStorage cache
  try {
    const existing = await fetchProjectsFromSupabase();
    const idx = existing.findIndex((p) => p.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...payload };
    } else {
      existing.unshift(payload);
    }
    localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(existing));
  } catch {}

  return payload;
}

export async function deleteProjectFromSupabase(id: string): Promise<boolean> {
  try {
    await supabase.from('projects').delete().eq('id', id);
  } catch (err) {
    console.warn('[deleteProjectFromSupabase note]', err);
  }

  try {
    const cached = localStorage.getItem(STORAGE_PROJECTS);
    if (cached) {
      const list: DynamicProject[] = JSON.parse(cached);
      const filtered = list.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(filtered));
    }
  } catch {}
  return true;
}

// ============================================================================
// 3. ARTICLES CRUD
// ============================================================================

export async function fetchArticlesFromSupabase(includeUnpublished = false): Promise<Article[]> {
  try {
    let query = supabase.from('articles').select('*').order('created_at', { ascending: false });
    if (!includeUnpublished) {
      query = query.eq('status', 'published');
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('[fetchArticlesFromSupabase warning]', err);
  }

  try {
    const cached = localStorage.getItem(STORAGE_ARTICLES);
    if (cached) {
      const list: Article[] = JSON.parse(cached);
      return includeUnpublished ? list : list.filter((a) => a.status === 'published');
    }
  } catch {}
  return [];
}

export async function fetchArticleById(id: string): Promise<Article | null> {
  try {
    const { data, error } = await supabase.from('articles').select('*').eq('id', id).maybeSingle();
    if (!error && data) return data;
  } catch {}

  try {
    const cached = localStorage.getItem(STORAGE_ARTICLES);
    if (cached) {
      const list: Article[] = JSON.parse(cached);
      return list.find((a) => a.id === id) || null;
    }
  } catch {}
  return null;
}

export async function saveArticleToSupabase(article: Partial<Article>): Promise<Article> {
  const id = article.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `art_${Date.now()}`);
  
  // Calculate reading time
  const textLength = (article.content || '').trim().split(/\s+/).length;
  const readingTime = Math.max(1, Math.round(textLength / 200));

  const payload: any = {
    id,
    title: article.title || 'Untitled Article',
    category: article.category || 'General',
    content: article.content || '',
    excerpt: article.excerpt || (article.content ? article.content.substring(0, 160) + '...' : ''),
    thumbnail_url: article.thumbnail_url || '',
    video_url: article.video_url || '',
    file_url: article.file_url || '',
    author_name: article.author_name || 'Visitor',
    author_role: article.author_role || (article.is_chief_admin ? 'Chief Admin' : 'Contributor'),
    is_chief_admin: Boolean(article.is_chief_admin),
    status: article.status || (article.is_chief_admin ? 'published' : 'pending'),
    reading_time_minutes: article.reading_time_minutes || readingTime,
    views_count: article.views_count || 0,
    likes_count: article.likes_count || 0,
    updated_at: new Date().toISOString(),
  };

  if (!article.id) {
    payload.created_at = new Date().toISOString();
  }

  try {
    await resilientSupabaseUpsert('articles', payload, 'id');
  } catch (err) {
    console.warn('[saveArticleToSupabase note]', err);
  }

  try {
    const existing = await fetchArticlesFromSupabase(true);
    const idx = existing.findIndex((a) => a.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...payload };
    } else {
      existing.unshift(payload);
    }
    localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(existing));
  } catch {}

  return payload;
}

export async function deleteArticleFromSupabase(id: string): Promise<boolean> {
  try {
    await supabase.from('articles').delete().eq('id', id);
  } catch (err) {
    console.warn('[deleteArticleFromSupabase note]', err);
  }

  try {
    const cached = localStorage.getItem(STORAGE_ARTICLES);
    if (cached) {
      const list: Article[] = JSON.parse(cached);
      localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(list.filter((a) => a.id !== id)));
    }
  } catch {}
  return true;
}

export async function incrementArticleViews(articleId: string): Promise<void> {
  try {
    // Record view in views table
    await supabase.from('article_views').insert({
      article_id: articleId,
      visitor_ip_or_id: localStorage.getItem('visitor_id') || 'visitor',
    });
    // Increment count
    await supabase.rpc('increment_article_views', { art_id: articleId });
  } catch {}
}

export async function toggleArticleLike(articleId: string, userIdentifier: string): Promise<{ liked: boolean; totalLikes: number }> {
  try {
    // Check if like exists
    const { data } = await supabase
      .from('article_likes')
      .select('id')
      .eq('article_id', articleId)
      .eq('user_identifier', userIdentifier)
      .maybeSingle();

    if (data?.id) {
      // Remove like
      await supabase.from('article_likes').delete().eq('id', data.id);
      return { liked: false, totalLikes: 0 };
    } else {
      // Add like
      await supabase.from('article_likes').insert({
        article_id: articleId,
        user_identifier: userIdentifier,
      });
      return { liked: true, totalLikes: 1 };
    }
  } catch {
    return { liked: true, totalLikes: 1 };
  }
}

export async function fetchArticleComments(articleId: string): Promise<ArticleComment[]> {
  try {
    const { data, error } = await supabase
      .from('article_comments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(`${STORAGE_COMMENTS}_${articleId}`);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function addArticleComment(articleId: string, authorName: string, content: string, autoApprove = true): Promise<ArticleComment> {
  const comment: ArticleComment = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cmt_${Date.now()}`,
    article_id: articleId,
    author_name: authorName.trim() || 'Visitor',
    content: content.trim(),
    is_approved: autoApprove,
    created_at: new Date().toISOString(),
  };

  try {
    await resilientSupabaseUpsert('article_comments', comment, 'id');
  } catch {}

  try {
    const existing = await fetchArticleComments(articleId);
    existing.push(comment);
    localStorage.setItem(`${STORAGE_COMMENTS}_${articleId}`, JSON.stringify(existing));
  } catch {}

  return comment;
}

export async function deleteArticleComment(commentId: string): Promise<boolean> {
  try {
    await supabase.from('article_comments').delete().eq('id', commentId);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 4. EXPERIENCE & CAREER CRUD
// ============================================================================

export async function fetchExperienceList(): Promise<ExperienceItem[]> {
  try {
    const { data, error } = await supabase
      .from('experience')
      .select('*')
      .order('order_index', { ascending: true });

    if (!error && Array.isArray(data)) {
      localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(data));
      return data;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(STORAGE_EXPERIENCE);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function saveExperienceItem(item: Partial<ExperienceItem>): Promise<ExperienceItem> {
  const id = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exp_${Date.now()}`);
  const payload: any = {
    id,
    title: item.title || '',
    company: item.company || '',
    location: item.location || '',
    start_date: item.start_date || '',
    end_date: item.end_date || '',
    is_current: Boolean(item.is_current),
    description: item.description || '',
    key_achievements: item.key_achievements || [],
    order_index: item.order_index || 0,
    updated_at: new Date().toISOString(),
  };

  if (!item.id) payload.created_at = new Date().toISOString();

  try {
    await resilientSupabaseUpsert('experience', payload, 'id');
  } catch {}

  try {
    const list = await fetchExperienceList();
    const idx = list.findIndex((e) => e.id === id);
    if (idx >= 0) list[idx] = payload;
    else list.push(payload);
    localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(list));
  } catch {}

  return payload;
}

export async function deleteExperienceItem(id: string): Promise<boolean> {
  try {
    await supabase.from('experience').delete().eq('id', id);
  } catch {}

  try {
    const list = await fetchExperienceList();
    localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(list.filter((e) => e.id !== id)));
  } catch {}
  return true;
}

// ============================================================================
// 5. RESEARCH & PUBLICATIONS CRUD
// ============================================================================

export async function fetchPublicationsList(): Promise<PublicationItem[]> {
  try {
    const { data, error } = await supabase
      .from('publications')
      .select('*')
      .order('order_index', { ascending: true });

    if (!error && Array.isArray(data)) {
      localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(data));
      return data;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(STORAGE_PUBLICATIONS);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function savePublicationItem(item: Partial<PublicationItem>): Promise<PublicationItem> {
  const id = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pub_${Date.now()}`);
  const payload: any = {
    id,
    title: item.title || '',
    publisher: item.publisher || '',
    date: item.date || '',
    doi_or_url: item.doi_or_url || '',
    description: item.description || '',
    category: item.category || 'Research',
    order_index: item.order_index || 0,
    updated_at: new Date().toISOString(),
  };

  if (!item.id) payload.created_at = new Date().toISOString();

  try {
    await resilientSupabaseUpsert('publications', payload, 'id');
  } catch {}

  try {
    const list = await fetchPublicationsList();
    const idx = list.findIndex((p) => p.id === id);
    if (idx >= 0) list[idx] = payload;
    else list.push(payload);
    localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(list));
  } catch {}

  return payload;
}

export async function deletePublicationItem(id: string): Promise<boolean> {
  try {
    await supabase.from('publications').delete().eq('id', id);
  } catch {}

  try {
    const list = await fetchPublicationsList();
    localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(list.filter((p) => p.id !== id)));
  } catch {}
  return true;
}

// ============================================================================
// 6. ACHIEVEMENTS & AWARDS CRUD
// ============================================================================

export async function fetchAchievementsList(): Promise<AchievementItem[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('order_index', { ascending: true });

    if (!error && Array.isArray(data)) {
      localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(data));
      return data;
    }
  } catch {}

  try {
    const cached = localStorage.getItem(STORAGE_ACHIEVEMENTS);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [];
}

export async function saveAchievementItem(item: Partial<AchievementItem>): Promise<AchievementItem> {
  const id = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ach_${Date.now()}`);
  const payload: any = {
    id,
    title: item.title || '',
    issuer: item.issuer || '',
    date: item.date || '',
    description: item.description || '',
    category: item.category || 'Award',
    order_index: item.order_index || 0,
    updated_at: new Date().toISOString(),
  };

  if (!item.id) payload.created_at = new Date().toISOString();

  try {
    await resilientSupabaseUpsert('achievements', payload, 'id');
  } catch {}

  try {
    const list = await fetchAchievementsList();
    const idx = list.findIndex((a) => a.id === id);
    if (idx >= 0) list[idx] = payload;
    else list.push(payload);
    localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(list));
  } catch {}

  return payload;
}

export async function deleteAchievementItem(id: string): Promise<boolean> {
  try {
    await supabase.from('achievements').delete().eq('id', id);
  } catch {}

  try {
    const list = await fetchAchievementsList();
    localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(list.filter((a) => a.id !== id)));
  } catch {}
  return true;
}
