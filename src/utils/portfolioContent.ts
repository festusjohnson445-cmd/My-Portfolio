import { supabase, resilientSupabaseUpsert, getValidatedSession } from './supabase';

// ============================================================================
// TYPES & DATA STRUCTURES
// ============================================================================

export interface DbProjectMedia {
  id: string;
  projectId: string;
  fileName: string;
  fileUrl: string;
  fileType: 'image' | 'video' | 'drawing' | 'document';
  caption?: string;
  displayOrder?: number;
}

export interface DbProject {
  id: string;
  ownerId?: string;
  title: string;
  category: string;
  description: string;
  overview?: string;
  objectives?: string;
  methodology?: string;
  results?: string;
  demoLink?: string;
  thumbnailUrl?: string;
  tools: string[];
  specs?: Record<string, string>;
  cadDrawings?: Array<{ title: string; url: string; drawingNo?: string; notes?: string }>;
  media?: DbProjectMedia[];
  isFeatured?: boolean;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbArticle {
  id: string;
  authorId?: string;
  authorName: string;
  authorRole: string; // e.g. 'Chief Admin' or 'Visitor'
  authorEmail?: string;
  isOwner: boolean;
  title: string;
  slug: string;
  category: string;
  summary: string;
  content: string; // rich text or markdown
  coverImage?: string;
  readingTimeMinutes: number;
  status: 'draft' | 'pending' | 'published' | 'archived';
  likesCount: number;
  viewsCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DbArticleComment {
  id: string;
  articleId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  isApproved: boolean;
  createdAt: string;
}

export interface DbExperience {
  id: string;
  role: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  description: string;
  achievements: string[];
  skills: string[];
  displayOrder?: number;
}

export interface DbPublication {
  id: string;
  title: string;
  authors: string;
  publisher?: string;
  publicationDate: string;
  doiUrl?: string;
  abstract?: string;
  pdfUrl?: string;
  displayOrder?: number;
}

export interface DbAchievement {
  id: string;
  title: string;
  issuer: string;
  dateAwarded: string;
  description?: string;
  badgeUrl?: string;
  displayOrder?: number;
}

// Local Storage Fallback Keys
const STORAGE_KEYS = {
  PROJECTS: 'fesline_db_projects',
  PROJECT_MEDIA: 'fesline_db_project_media',
  ARTICLES: 'fesline_db_articles',
  COMMENTS: 'fesline_db_comments',
  LIKES: 'fesline_db_likes',
  VIEWS: 'fesline_db_views',
  EXPERIENCE: 'fesline_db_experience',
  PUBLICATIONS: 'fesline_db_publications',
  ACHIEVEMENTS: 'fesline_db_achievements',
};

function getLocalData<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocalData<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ============================================================================
// 1. PROJECTS CRUD
// ============================================================================

export async function fetchProjects(): Promise<DbProject[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const projects: DbProject[] = data.map((item) => ({
        id: item.id,
        ownerId: item.owner_id,
        title: item.title,
        category: item.category || 'CAD & Mechanical',
        description: item.description,
        overview: item.overview,
        objectives: item.objectives,
        methodology: item.methodology,
        results: item.results,
        demoLink: item.demo_link,
        thumbnailUrl: item.thumbnail_url,
        tools: item.tools || [],
        specs: item.specs || {},
        cadDrawings: item.cad_drawings || [],
        isFeatured: item.is_featured,
        displayOrder: item.display_order,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));

      // Cache locally
      setLocalData(STORAGE_KEYS.PROJECTS, projects);
      return projects;
    }
  } catch (e) {
    console.warn('[Supabase fetchProjects notice]:', e);
  }

  // Graceful local fallback (initially empty)
  return getLocalData<DbProject[]>(STORAGE_KEYS.PROJECTS, []);
}

export async function fetchProjectById(id: string): Promise<DbProject | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      // Also fetch media
      const media = await fetchProjectMedia(id);
      return {
        id: data.id,
        ownerId: data.owner_id,
        title: data.title,
        category: data.category,
        description: data.description,
        overview: data.overview,
        objectives: data.objectives,
        methodology: data.methodology,
        results: data.results,
        demoLink: data.demo_link,
        thumbnailUrl: data.thumbnail_url,
        tools: data.tools || [],
        specs: data.specs || {},
        cadDrawings: data.cad_drawings || [],
        media,
        isFeatured: data.is_featured,
        displayOrder: data.display_order,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  } catch {}

  const local = getLocalData<DbProject[]>(STORAGE_KEYS.PROJECTS, []);
  const found = local.find((p) => p.id === id);
  if (found) {
    const media = await fetchProjectMedia(id);
    return { ...found, media };
  }
  return null;
}

export async function saveProject(project: Partial<DbProject> & { title: string; description: string }): Promise<DbProject> {
  const id = project.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  let ownerId: string | undefined = undefined;
  try {
    const { user } = await getValidatedSession();
    ownerId = user.id;
  } catch {}

  const fullProject: DbProject = {
    id,
    ownerId: project.ownerId || ownerId,
    title: project.title,
    category: project.category || 'CAD & Mechanical',
    description: project.description,
    overview: project.overview || '',
    objectives: project.objectives || '',
    methodology: project.methodology || '',
    results: project.results || '',
    demoLink: project.demoLink || '',
    thumbnailUrl: project.thumbnailUrl || '',
    tools: project.tools || [],
    specs: project.specs || {},
    cadDrawings: project.cadDrawings || [],
    isFeatured: project.isFeatured ?? false,
    displayOrder: project.displayOrder ?? 0,
    createdAt: project.createdAt || now,
    updatedAt: now,
  };

  // 1. Save to Supabase
  try {
    const payload = {
      id: fullProject.id,
      owner_id: fullProject.ownerId,
      title: fullProject.title,
      category: fullProject.category,
      description: fullProject.description,
      overview: fullProject.overview,
      objectives: fullProject.objectives,
      methodology: fullProject.methodology,
      results: fullProject.results,
      demo_link: fullProject.demoLink,
      thumbnail_url: fullProject.thumbnailUrl,
      tools: fullProject.tools,
      specs: fullProject.specs,
      cad_drawings: fullProject.cadDrawings,
      is_featured: fullProject.isFeatured,
      display_order: fullProject.displayOrder,
      updated_at: fullProject.updatedAt,
    };
    await resilientSupabaseUpsert('projects', payload, 'id');
  } catch (err) {
    console.warn('[saveProject Supabase notice]:', err);
  }

  // 2. Save locally
  const current = getLocalData<DbProject[]>(STORAGE_KEYS.PROJECTS, []);
  const idx = current.findIndex((p) => p.id === id);
  if (idx >= 0) {
    current[idx] = fullProject;
  } else {
    current.unshift(fullProject);
  }
  setLocalData(STORAGE_KEYS.PROJECTS, current);

  return fullProject;
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await supabase.from('projects').delete().eq('id', id);
  } catch {}

  const current = getLocalData<DbProject[]>(STORAGE_KEYS.PROJECTS, []);
  setLocalData(STORAGE_KEYS.PROJECTS, current.filter((p) => p.id !== id));
  return true;
}

// Media
export async function fetchProjectMedia(projectId: string): Promise<DbProjectMedia[]> {
  try {
    const { data } = await supabase
      .from('project_media')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (Array.isArray(data)) {
      return data.map((d) => ({
        id: d.id,
        projectId: d.project_id,
        fileName: d.file_name,
        fileUrl: d.file_url,
        fileType: d.file_type,
        caption: d.caption,
        displayOrder: d.display_order,
      }));
    }
  } catch {}

  const allMedia = getLocalData<DbProjectMedia[]>(STORAGE_KEYS.PROJECT_MEDIA, []);
  return allMedia.filter((m) => m.projectId === projectId);
}

export async function saveProjectMediaItem(media: Omit<DbProjectMedia, 'id'> & { id?: string }): Promise<DbProjectMedia> {
  const id = media.id || `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const item: DbProjectMedia = {
    id,
    projectId: media.projectId,
    fileName: media.fileName,
    fileUrl: media.fileUrl,
    fileType: media.fileType,
    caption: media.caption,
    displayOrder: media.displayOrder ?? 0,
  };

  try {
    await resilientSupabaseUpsert('project_media', {
      id: item.id,
      project_id: item.projectId,
      file_name: item.fileName,
      file_url: item.fileUrl,
      file_type: item.fileType,
      caption: item.caption,
      display_order: item.displayOrder,
    }, 'id');
  } catch {}

  const current = getLocalData<DbProjectMedia[]>(STORAGE_KEYS.PROJECT_MEDIA, []);
  const idx = current.findIndex((m) => m.id === id);
  if (idx >= 0) current[idx] = item;
  else current.push(item);
  setLocalData(STORAGE_KEYS.PROJECT_MEDIA, current);

  return item;
}

export async function deleteProjectMediaItem(id: string): Promise<boolean> {
  try {
    await supabase.from('project_media').delete().eq('id', id);
  } catch {}
  const current = getLocalData<DbProjectMedia[]>(STORAGE_KEYS.PROJECT_MEDIA, []);
  setLocalData(STORAGE_KEYS.PROJECT_MEDIA, current.filter((m) => m.id !== id));
  return true;
}

// ============================================================================
// 2. BLOG & ARTICLES CRUD
// ============================================================================

export async function fetchArticles(statusFilter?: 'published' | 'pending' | 'draft' | 'all'): Promise<DbArticle[]> {
  try {
    let query = supabase.from('articles').select('*').order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      const articles: DbArticle[] = data.map((a) => ({
        id: a.id,
        authorId: a.author_id,
        authorName: a.author_name || (a.is_owner ? 'Festus Johnson' : 'Author'),
        authorRole: a.author_role || (a.is_owner ? 'Chief Admin' : 'Visitor Contributor'),
        authorEmail: a.author_email,
        isOwner: Boolean(a.is_owner),
        title: a.title,
        slug: a.slug || a.id,
        category: a.category || 'Mechanical Engineering',
        summary: a.summary,
        content: a.content,
        coverImage: a.cover_image,
        readingTimeMinutes: a.reading_time_minutes || 3,
        status: a.status || 'published',
        likesCount: a.likes_count || 0,
        viewsCount: a.views_count || 0,
        tags: a.tags || [],
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      setLocalData(STORAGE_KEYS.ARTICLES, articles);
      return articles;
    }
  } catch {}

  const local = getLocalData<DbArticle[]>(STORAGE_KEYS.ARTICLES, []);
  if (statusFilter && statusFilter !== 'all') {
    return local.filter((a) => a.status === statusFilter);
  }
  return local;
}

export async function fetchArticleByIdOrSlug(idOrSlug: string): Promise<DbArticle | null> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        authorId: data.author_id,
        authorName: data.author_name,
        authorRole: data.author_role,
        authorEmail: data.author_email,
        isOwner: Boolean(data.is_owner),
        title: data.title,
        slug: data.slug,
        category: data.category,
        summary: data.summary,
        content: data.content,
        coverImage: data.cover_image,
        readingTimeMinutes: data.reading_time_minutes || 3,
        status: data.status,
        likesCount: data.likes_count || 0,
        viewsCount: data.views_count || 0,
        tags: data.tags || [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  } catch {}

  const local = getLocalData<DbArticle[]>(STORAGE_KEYS.ARTICLES, []);
  return local.find((a) => a.id === idOrSlug || a.slug === idOrSlug) || null;
}

export async function saveArticle(article: Partial<DbArticle> & { title: string; summary: string; content: string }): Promise<DbArticle> {
  const id = article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const slug = article.slug || article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || id;
  const wordCount = article.content.split(/\s+/).length;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  const isOwner = Boolean(article.isOwner);
  const authorRole = isOwner ? 'Chief Admin' : (article.authorRole || 'Contributor');

  const fullArticle: DbArticle = {
    id,
    authorId: article.authorId,
    authorName: article.authorName || (isOwner ? 'Festus, Olorunsogo Johnson' : 'Guest Contributor'),
    authorRole,
    authorEmail: article.authorEmail,
    isOwner,
    title: article.title,
    slug,
    category: article.category || 'Mechanical Design',
    summary: article.summary,
    content: article.content,
    coverImage: article.coverImage || '',
    readingTimeMinutes: article.readingTimeMinutes || readingTimeMinutes,
    status: article.status || (isOwner ? 'published' : 'pending'),
    likesCount: article.likesCount ?? 0,
    viewsCount: article.viewsCount ?? 0,
    tags: article.tags || [],
    createdAt: article.createdAt || now,
    updatedAt: now,
  };

  try {
    const payload = {
      id: fullArticle.id,
      author_id: fullArticle.authorId,
      author_name: fullArticle.authorName,
      author_role: fullArticle.authorRole,
      author_email: fullArticle.authorEmail,
      is_owner: fullArticle.isOwner,
      title: fullArticle.title,
      slug: fullArticle.slug,
      category: fullArticle.category,
      summary: fullArticle.summary,
      content: fullArticle.content,
      cover_image: fullArticle.coverImage,
      reading_time_minutes: fullArticle.readingTimeMinutes,
      status: fullArticle.status,
      likes_count: fullArticle.likesCount,
      views_count: fullArticle.viewsCount,
      tags: fullArticle.tags,
      updated_at: fullArticle.updatedAt,
    };
    await resilientSupabaseUpsert('articles', payload, 'id');
  } catch (err) {
    console.warn('[saveArticle Supabase notice]:', err);
  }

  const current = getLocalData<DbArticle[]>(STORAGE_KEYS.ARTICLES, []);
  const idx = current.findIndex((a) => a.id === id);
  if (idx >= 0) current[idx] = fullArticle;
  else current.unshift(fullArticle);
  setLocalData(STORAGE_KEYS.ARTICLES, current);

  return fullArticle;
}

export async function deleteArticle(id: string): Promise<boolean> {
  try {
    await supabase.from('articles').delete().eq('id', id);
  } catch {}
  const current = getLocalData<DbArticle[]>(STORAGE_KEYS.ARTICLES, []);
  setLocalData(STORAGE_KEYS.ARTICLES, current.filter((a) => a.id !== id));
  return true;
}

export async function recordArticleView(articleId: string, visitorId: string): Promise<void> {
  try {
    await supabase.from('article_views').insert({
      article_id: articleId,
      visitor_id: visitorId,
    });
    // increment local
    const current = getLocalData<DbArticle[]>(STORAGE_KEYS.ARTICLES, []);
    const found = current.find((a) => a.id === articleId);
    if (found) {
      found.viewsCount = (found.viewsCount || 0) + 1;
      setLocalData(STORAGE_KEYS.ARTICLES, current);
    }
  } catch {}
}

export async function toggleArticleLike(articleId: string, visitorId: string): Promise<{ liked: boolean; count: number }> {
  let liked = false;
  let count = 0;

  // Local likes tracking
  const likesMap = getLocalData<Record<string, string[]>>(STORAGE_KEYS.LIKES, {});
  const currentArticleLikes = likesMap[articleId] || [];

  if (currentArticleLikes.includes(visitorId)) {
    likesMap[articleId] = currentArticleLikes.filter((id) => id !== visitorId);
    liked = false;
    try {
      await supabase.from('article_likes').delete().eq('article_id', articleId).eq('visitor_id', visitorId);
    } catch {}
  } else {
    likesMap[articleId] = [...currentArticleLikes, visitorId];
    liked = true;
    try {
      await supabase.from('article_likes').insert({ article_id: articleId, visitor_id: visitorId });
    } catch {}
  }

  setLocalData(STORAGE_KEYS.LIKES, likesMap);
  count = likesMap[articleId].length;

  // Sync back to article
  const articles = getLocalData<DbArticle[]>(STORAGE_KEYS.ARTICLES, []);
  const target = articles.find((a) => a.id === articleId);
  if (target) {
    target.likesCount = count;
    setLocalData(STORAGE_KEYS.ARTICLES, articles);
    try {
      await supabase.from('articles').update({ likes_count: count }).eq('id', articleId);
    } catch {}
  }

  return { liked, count };
}

// Comments
export async function fetchArticleComments(articleId: string): Promise<DbArticleComment[]> {
  try {
    const { data } = await supabase
      .from('article_comments')
      .select('*')
      .eq('article_id', articleId)
      .eq('is_approved', true)
      .order('created_at', { ascending: true });

    if (Array.isArray(data)) {
      return data.map((c) => ({
        id: c.id,
        articleId: c.article_id,
        authorName: c.author_name,
        authorEmail: c.author_email,
        content: c.content,
        isApproved: Boolean(c.is_approved),
        createdAt: c.created_at,
      }));
    }
  } catch {}

  const allComments = getLocalData<DbArticleComment[]>(STORAGE_KEYS.COMMENTS, []);
  return allComments.filter((c) => c.articleId === articleId && c.isApproved);
}

export async function fetchAllCommentsForModeration(): Promise<DbArticleComment[]> {
  try {
    const { data } = await supabase
      .from('article_comments')
      .select('*')
      .order('created_at', { ascending: false });

    if (Array.isArray(data)) {
      return data.map((c) => ({
        id: c.id,
        articleId: c.article_id,
        authorName: c.author_name,
        authorEmail: c.author_email,
        content: c.content,
        isApproved: Boolean(c.is_approved),
        createdAt: c.created_at,
      }));
    }
  } catch {}

  return getLocalData<DbArticleComment[]>(STORAGE_KEYS.COMMENTS, []);
}

export async function submitArticleComment(comment: {
  articleId: string;
  authorName: string;
  authorEmail?: string;
  content: string;
  isOwner?: boolean;
}): Promise<DbArticleComment> {
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const item: DbArticleComment = {
    id,
    articleId: comment.articleId,
    authorName: comment.authorName.trim(),
    authorEmail: comment.authorEmail?.trim(),
    content: comment.content.trim(),
    isApproved: true, // auto approve or admin moderate
    createdAt: new Date().toISOString(),
  };

  try {
    await resilientSupabaseUpsert('article_comments', {
      id: item.id,
      article_id: item.articleId,
      author_name: item.authorName,
      author_email: item.authorEmail,
      content: item.content,
      is_approved: item.isApproved,
    }, 'id');
  } catch {}

  const allComments = getLocalData<DbArticleComment[]>(STORAGE_KEYS.COMMENTS, []);
  allComments.push(item);
  setLocalData(STORAGE_KEYS.COMMENTS, allComments);

  return item;
}

export async function moderateComment(id: string, isApproved: boolean): Promise<boolean> {
  try {
    await supabase.from('article_comments').update({ is_approved: isApproved }).eq('id', id);
  } catch {}

  const all = getLocalData<DbArticleComment[]>(STORAGE_KEYS.COMMENTS, []);
  const found = all.find((c) => c.id === id);
  if (found) {
    found.isApproved = isApproved;
    setLocalData(STORAGE_KEYS.COMMENTS, all);
  }
  return true;
}

export async function deleteComment(id: string): Promise<boolean> {
  try {
    await supabase.from('article_comments').delete().eq('id', id);
  } catch {}
  const all = getLocalData<DbArticleComment[]>(STORAGE_KEYS.COMMENTS, []);
  setLocalData(STORAGE_KEYS.COMMENTS, all.filter((c) => c.id !== id));
  return true;
}

// ============================================================================
// 3. EXPERIENCE, PUBLICATIONS & ACHIEVEMENTS CRUD
// ============================================================================

export async function fetchExperience(): Promise<DbExperience[]> {
  try {
    const { data } = await supabase
      .from('experience')
      .select('*')
      .order('display_order', { ascending: true })
      .order('start_date', { ascending: false });

    if (Array.isArray(data)) {
      const mapped: DbExperience[] = data.map((d) => ({
        id: d.id,
        role: d.role,
        company: d.company,
        location: d.location,
        startDate: d.start_date,
        endDate: d.end_date,
        isCurrent: Boolean(d.is_current),
        description: d.description,
        achievements: d.achievements || [],
        skills: d.skills || [],
        displayOrder: d.display_order,
      }));
      setLocalData(STORAGE_KEYS.EXPERIENCE, mapped);
      return mapped;
    }
  } catch {}

  return getLocalData<DbExperience[]>(STORAGE_KEYS.EXPERIENCE, []);
}

export async function saveExperienceItem(exp: DbExperience): Promise<DbExperience> {
  try {
    await resilientSupabaseUpsert('experience', {
      id: exp.id,
      role: exp.role,
      company: exp.company,
      location: exp.location,
      start_date: exp.startDate,
      end_date: exp.endDate,
      is_current: exp.isCurrent,
      description: exp.description,
      achievements: exp.achievements,
      skills: exp.skills,
      display_order: exp.displayOrder ?? 0,
      updated_at: new Date().toISOString(),
    }, 'id');
  } catch {}

  const current = getLocalData<DbExperience[]>(STORAGE_KEYS.EXPERIENCE, []);
  const idx = current.findIndex((e) => e.id === exp.id);
  if (idx >= 0) current[idx] = exp;
  else current.push(exp);
  setLocalData(STORAGE_KEYS.EXPERIENCE, current);

  return exp;
}

export async function deleteExperienceItem(id: string): Promise<boolean> {
  try {
    await supabase.from('experience').delete().eq('id', id);
  } catch {}
  const current = getLocalData<DbExperience[]>(STORAGE_KEYS.EXPERIENCE, []);
  setLocalData(STORAGE_KEYS.EXPERIENCE, current.filter((e) => e.id !== id));
  return true;
}

export async function fetchPublications(): Promise<DbPublication[]> {
  try {
    const { data } = await supabase
      .from('publications')
      .select('*')
      .order('display_order', { ascending: true })
      .order('publication_date', { ascending: false });

    if (Array.isArray(data)) {
      const mapped: DbPublication[] = data.map((d) => ({
        id: d.id,
        title: d.title,
        authors: d.authors,
        publisher: d.publisher,
        publicationDate: d.publication_date,
        doiUrl: d.doi_url,
        abstract: d.abstract,
        pdfUrl: d.pdf_url,
        displayOrder: d.display_order,
      }));
      setLocalData(STORAGE_KEYS.PUBLICATIONS, mapped);
      return mapped;
    }
  } catch {}

  return getLocalData<DbPublication[]>(STORAGE_KEYS.PUBLICATIONS, []);
}

export async function savePublicationItem(pub: DbPublication): Promise<DbPublication> {
  try {
    await resilientSupabaseUpsert('publications', {
      id: pub.id,
      title: pub.title,
      authors: pub.authors,
      publisher: pub.publisher,
      publication_date: pub.publicationDate,
      doi_url: pub.doiUrl,
      abstract: pub.abstract,
      pdf_url: pub.pdfUrl,
      display_order: pub.displayOrder ?? 0,
      updated_at: new Date().toISOString(),
    }, 'id');
  } catch {}

  const current = getLocalData<DbPublication[]>(STORAGE_KEYS.PUBLICATIONS, []);
  const idx = current.findIndex((p) => p.id === pub.id);
  if (idx >= 0) current[idx] = pub;
  else current.push(pub);
  setLocalData(STORAGE_KEYS.PUBLICATIONS, current);

  return pub;
}

export async function deletePublicationItem(id: string): Promise<boolean> {
  try {
    await supabase.from('publications').delete().eq('id', id);
  } catch {}
  const current = getLocalData<DbPublication[]>(STORAGE_KEYS.PUBLICATIONS, []);
  setLocalData(STORAGE_KEYS.PUBLICATIONS, current.filter((p) => p.id !== id));
  return true;
}

export async function fetchAchievements(): Promise<DbAchievement[]> {
  try {
    const { data } = await supabase
      .from('achievements')
      .select('*')
      .order('display_order', { ascending: true })
      .order('date_awarded', { ascending: false });

    if (Array.isArray(data)) {
      const mapped: DbAchievement[] = data.map((d) => ({
        id: d.id,
        title: d.title,
        issuer: d.issuer,
        dateAwarded: d.date_awarded,
        description: d.description,
        badgeUrl: d.badge_url,
        displayOrder: d.display_order,
      }));
      setLocalData(STORAGE_KEYS.ACHIEVEMENTS, mapped);
      return mapped;
    }
  } catch {}

  return getLocalData<DbAchievement[]>(STORAGE_KEYS.ACHIEVEMENTS, []);
}

export async function saveAchievementItem(ach: DbAchievement): Promise<DbAchievement> {
  try {
    await resilientSupabaseUpsert('achievements', {
      id: ach.id,
      title: ach.title,
      issuer: ach.issuer,
      date_awarded: ach.dateAwarded,
      description: ach.description,
      badge_url: ach.badgeUrl,
      display_order: ach.displayOrder ?? 0,
      updated_at: new Date().toISOString(),
    }, 'id');
  } catch {}

  const current = getLocalData<DbAchievement[]>(STORAGE_KEYS.ACHIEVEMENTS, []);
  const idx = current.findIndex((a) => a.id === ach.id);
  if (idx >= 0) current[idx] = ach;
  else current.push(ach);
  setLocalData(STORAGE_KEYS.ACHIEVEMENTS, current);

  return ach;
}

export async function deleteAchievementItem(id: string): Promise<boolean> {
  try {
    await supabase.from('achievements').delete().eq('id', id);
  } catch {}
  const current = getLocalData<DbAchievement[]>(STORAGE_KEYS.ACHIEVEMENTS, []);
  setLocalData(STORAGE_KEYS.ACHIEVEMENTS, current.filter((a) => a.id !== id));
  return true;
}
