import { supabase, resilientSupabaseUpsert, getValidatedSession } from './supabase';
import {
  ProjectItem,
  ProjectMediaItem,
  ArticleItem,
  ArticleCommentItem,
  ExperienceItem,
  PublicationItem,
  AchievementItem,
} from '../types/extended';

// Storage keys for local resilience
const STORAGE_PROJECTS = 'fesline_portfolio_projects';
const STORAGE_ARTICLES = 'fesline_portfolio_articles';
const STORAGE_EXPERIENCE = 'fesline_portfolio_experience';
const STORAGE_PUBLICATIONS = 'fesline_portfolio_publications';
const STORAGE_ACHIEVEMENTS = 'fesline_portfolio_achievements';

// ============================================================================
// 1. PROJECTS CRUD
// ============================================================================

export async function fetchProjectsFromSupabase(): Promise<ProjectItem[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*, media:project_media(*)')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      try {
        localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(data));
      } catch {}
      return data as ProjectItem[];
    }
  } catch (err) {
    console.warn('[fetchProjectsFromSupabase note]:', err);
  }

  // Fallback to local storage
  try {
    const saved = localStorage.getItem(STORAGE_PROJECTS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  return [];
}

export async function saveProjectToSupabase(project: Partial<ProjectItem>): Promise<ProjectItem | null> {
  const safeId = project.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}`);
  const payload: any = {
    ...project,
    id: safeId,
    updated_at: new Date().toISOString(),
  };

  if (!payload.created_at) {
    payload.created_at = new Date().toISOString();
  }

  // Save locally first
  try {
    const existing = await fetchProjectsFromSupabase();
    const idx = existing.findIndex((p) => p.id === safeId);
    let updated: ProjectItem[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...updated[idx], ...payload };
    } else {
      updated = [payload as ProjectItem, ...existing];
    }
    localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(updated));
  } catch {}

  // Attempt Supabase insert/upsert
  try {
    const { data, error } = await resilientSupabaseUpsert('projects', payload, 'id');
    if (!error) {
      return (data?.[0] || payload) as ProjectItem;
    }
  } catch (err) {
    console.warn('[saveProjectToSupabase note]:', err);
  }

  return payload as ProjectItem;
}

export async function deleteProjectFromSupabase(projectId: string): Promise<boolean> {
  // Remove from local cache
  try {
    const existing = await fetchProjectsFromSupabase();
    const filtered = existing.filter((p) => p.id !== projectId);
    localStorage.setItem(STORAGE_PROJECTS, JSON.stringify(filtered));
  } catch {}

  try {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      console.warn('[deleteProject error]:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[deleteProject exception]:', err);
    return false;
  }
}

// ============================================================================
// 2. ARTICLES & BLOG CRUD
// ============================================================================

export async function fetchArticlesFromSupabase(includeUnpublished = false): Promise<ArticleItem[]> {
  try {
    let query = supabase
      .from('articles')
      .select('*, comments:article_comments(*)')
      .order('created_at', { ascending: false });

    if (!includeUnpublished) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;

    if (!error && Array.isArray(data)) {
      try {
        if (!includeUnpublished) {
          localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(data));
        }
      } catch {}
      return data as ArticleItem[];
    }
  } catch (err) {
    console.warn('[fetchArticlesFromSupabase note]:', err);
  }

  // Fallback to local storage
  try {
    const saved = localStorage.getItem(STORAGE_ARTICLES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        if (includeUnpublished) return parsed;
        return parsed.filter((a: ArticleItem) => a.status === 'published');
      }
    }
  } catch {}

  return [];
}

export async function saveArticleToSupabase(article: Partial<ArticleItem>): Promise<ArticleItem | null> {
  const safeId = article.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `art_${Date.now()}`);
  const payload: any = {
    ...article,
    id: safeId,
    likes_count: article.likes_count ?? 0,
    views_count: article.views_count ?? 0,
    reading_time_minutes: article.reading_time_minutes || Math.max(1, Math.round(((article.content || '').split(/\s+/).length || 100) / 200)),
    updated_at: new Date().toISOString(),
  };

  if (!payload.created_at) {
    payload.created_at = new Date().toISOString();
  }

  // Save locally
  try {
    const existing = await fetchArticlesFromSupabase(true);
    const idx = existing.findIndex((a) => a.id === safeId);
    let updated: ArticleItem[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...updated[idx], ...payload };
    } else {
      updated = [payload as ArticleItem, ...existing];
    }
    localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(updated));
  } catch {}

  try {
    const { data, error } = await resilientSupabaseUpsert('articles', payload, 'id');
    if (!error) {
      return (data?.[0] || payload) as ArticleItem;
    }
  } catch (err) {
    console.warn('[saveArticleToSupabase note]:', err);
  }

  return payload as ArticleItem;
}

export async function deleteArticleFromSupabase(articleId: string): Promise<boolean> {
  try {
    const existing = await fetchArticlesFromSupabase(true);
    const filtered = existing.filter((a) => a.id !== articleId);
    localStorage.setItem(STORAGE_ARTICLES, JSON.stringify(filtered));
  } catch {}

  try {
    const { error } = await supabase.from('articles').delete().eq('id', articleId);
    if (error) {
      console.warn('[deleteArticle error]:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[deleteArticle exception]:', err);
    return false;
  }
}

export async function incrementArticleViews(articleId: string, visitorId: string): Promise<void> {
  try {
    await supabase.from('article_views').insert({
      article_id: articleId,
      visitor_id: visitorId,
    });
  } catch {}
}

export async function toggleArticleLike(articleId: string, visitorId: string): Promise<{ liked: boolean; newCount: number }> {
  try {
    // Check if like exists
    const { data } = await supabase
      .from('article_likes')
      .select('id')
      .eq('article_id', articleId)
      .eq('visitor_id', visitorId)
      .maybeSingle();

    if (data?.id) {
      await supabase.from('article_likes').delete().eq('id', data.id);
      return { liked: false, newCount: -1 };
    } else {
      await supabase.from('article_likes').insert({
        article_id: articleId,
        visitor_id: visitorId,
      });
      return { liked: true, newCount: 1 };
    }
  } catch {
    return { liked: true, newCount: 1 };
  }
}

export async function addArticleComment(comment: {
  article_id: string;
  author_name: string;
  author_email?: string;
  content: string;
  is_owner?: boolean;
}): Promise<ArticleCommentItem | null> {
  const safeId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cmt_${Date.now()}`;
  const payload: any = {
    id: safeId,
    article_id: comment.article_id,
    author_name: comment.author_name || 'Visitor',
    author_email: comment.author_email || '',
    content: comment.content,
    is_owner: Boolean(comment.is_owner),
    status: comment.is_owner ? 'approved' : 'pending',
    created_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase.from('article_comments').insert(payload);
    if (!error) return payload as ArticleCommentItem;
  } catch (e) {
    console.warn('[addArticleComment note]:', e);
  }

  return payload as ArticleCommentItem;
}

export async function updateCommentStatus(commentId: string, status: 'approved' | 'rejected'): Promise<boolean> {
  try {
    const { error } = await supabase.from('article_comments').update({ status }).eq('id', commentId);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('article_comments').delete().eq('id', commentId);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 3. EXPERIENCE, PUBLICATIONS & ACHIEVEMENTS CRUD
// ============================================================================

export async function fetchExperienceFromSupabase(): Promise<ExperienceItem[]> {
  try {
    const { data, error } = await supabase
      .from('experience')
      .select('*')
      .order('display_order', { ascending: true })
      .order('start_date', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      try {
        localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(data));
      } catch {}
      return data as ExperienceItem[];
    }
  } catch {}

  try {
    const saved = localStorage.getItem(STORAGE_EXPERIENCE);
    if (saved) return JSON.parse(saved);
  } catch {}

  return [];
}

export async function saveExperienceToSupabase(item: Partial<ExperienceItem>): Promise<ExperienceItem | null> {
  const safeId = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exp_${Date.now()}`);
  const payload: any = {
    ...item,
    id: safeId,
    created_at: item.created_at || new Date().toISOString(),
  };

  try {
    const existing = await fetchExperienceFromSupabase();
    const idx = existing.findIndex((e) => e.id === safeId);
    let updated: ExperienceItem[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...updated[idx], ...payload };
    } else {
      updated = [...existing, payload as ExperienceItem];
    }
    localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(updated));
  } catch {}

  try {
    await resilientSupabaseUpsert('experience', payload, 'id');
  } catch {}

  return payload as ExperienceItem;
}

export async function deleteExperienceFromSupabase(id: string): Promise<boolean> {
  try {
    const existing = await fetchExperienceFromSupabase();
    localStorage.setItem(STORAGE_EXPERIENCE, JSON.stringify(existing.filter((e) => e.id !== id)));
    await supabase.from('experience').delete().eq('id', id);
    return true;
  } catch {
    return false;
  }
}

export async function fetchPublicationsFromSupabase(): Promise<PublicationItem[]> {
  try {
    const { data, error } = await supabase
      .from('publications')
      .select('*')
      .order('display_order', { ascending: true })
      .order('date', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      try {
        localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(data));
      } catch {}
      return data as PublicationItem[];
    }
  } catch {}

  try {
    const saved = localStorage.getItem(STORAGE_PUBLICATIONS);
    if (saved) return JSON.parse(saved);
  } catch {}

  return [];
}

export async function savePublicationToSupabase(item: Partial<PublicationItem>): Promise<PublicationItem | null> {
  const safeId = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pub_${Date.now()}`);
  const payload: any = {
    ...item,
    id: safeId,
    created_at: item.created_at || new Date().toISOString(),
  };

  try {
    const existing = await fetchPublicationsFromSupabase();
    const idx = existing.findIndex((p) => p.id === safeId);
    let updated: PublicationItem[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...updated[idx], ...payload };
    } else {
      updated = [...existing, payload as PublicationItem];
    }
    localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(updated));
  } catch {}

  try {
    await resilientSupabaseUpsert('publications', payload, 'id');
  } catch {}

  return payload as PublicationItem;
}

export async function deletePublicationFromSupabase(id: string): Promise<boolean> {
  try {
    const existing = await fetchPublicationsFromSupabase();
    localStorage.setItem(STORAGE_PUBLICATIONS, JSON.stringify(existing.filter((p) => p.id !== id)));
    await supabase.from('publications').delete().eq('id', id);
    return true;
  } catch {
    return false;
  }
}

export async function fetchAchievementsFromSupabase(): Promise<AchievementItem[]> {
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('display_order', { ascending: true })
      .order('date', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      try {
        localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(data));
      } catch {}
      return data as AchievementItem[];
    }
  } catch {}

  try {
    const saved = localStorage.getItem(STORAGE_ACHIEVEMENTS);
    if (saved) return JSON.parse(saved);
  } catch {}

  return [];
}

export async function saveAchievementToSupabase(item: Partial<AchievementItem>): Promise<AchievementItem | null> {
  const safeId = item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ach_${Date.now()}`);
  const payload: any = {
    ...item,
    id: safeId,
    created_at: item.created_at || new Date().toISOString(),
  };

  try {
    const existing = await fetchAchievementsFromSupabase();
    const idx = existing.findIndex((a) => a.id === safeId);
    let updated: AchievementItem[];
    if (idx >= 0) {
      updated = [...existing];
      updated[idx] = { ...updated[idx], ...payload };
    } else {
      updated = [...existing, payload as AchievementItem];
    }
    localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(updated));
  } catch {}

  try {
    await resilientSupabaseUpsert('achievements', payload, 'id');
  } catch {}

  return payload as AchievementItem;
}

export async function deleteAchievementFromSupabase(id: string): Promise<boolean> {
  try {
    const existing = await fetchAchievementsFromSupabase();
    localStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify(existing.filter((a) => a.id !== id)));
    await supabase.from('achievements').delete().eq('id', id);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 4. GENERAL FILE / MEDIA UPLOAD HELPER (ACCEPTS FILE OR URL)
// ============================================================================

export async function uploadMediaFile(
  fileOrBlob: File | Blob,
  fileName: string,
  bucket: 'projects' | 'articles' | 'materials' = 'materials'
): Promise<string> {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = Date.now();
  const filePath = `${uniquePrefix}_${cleanName}`;

  let contentType = (fileOrBlob as any).type || '';
  if (!contentType || contentType === 'application/octet-stream') {
    if (cleanName.endsWith('.pdf')) contentType = 'application/pdf';
    else if (cleanName.endsWith('.png')) contentType = 'image/png';
    else if (cleanName.endsWith('.jpg') || cleanName.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (cleanName.endsWith('.webp')) contentType = 'image/webp';
    else if (cleanName.endsWith('.step') || cleanName.endsWith('.stp')) contentType = 'model/step';
    else contentType = 'application/octet-stream';
  }

  // 1. Try specified bucket then Materials
  const bucketCandidates = [bucket, 'Materials', 'materials'];
  for (const bName of bucketCandidates) {
    try {
      const { data, error } = await supabase.storage
        .from(bName)
        .upload(filePath, fileOrBlob, { contentType, upsert: true });

      if (!error && data?.path) {
        const { data: pubData } = supabase.storage.from(bName).getPublicUrl(data.path);
        if (pubData?.publicUrl) return pubData.publicUrl;
      }
    } catch {}
  }

  // 2. Resilient data URL fallback
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(fileOrBlob);
  });
}
