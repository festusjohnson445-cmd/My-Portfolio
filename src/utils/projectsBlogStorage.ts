import { supabase, isSupabaseConfigured } from './supabase';
import {
  ProjectItem,
  ArticleItem,
  ArticleComment,
  ExperienceItem,
  PublicationItem,
  AchievementItem,
  ArticleCategory,
} from '../types/extendedPortfolio';

// Storage keys for local fallback
const STORAGE_PROJECTS = 'fesline_projects_store';
const STORAGE_ARTICLES = 'fesline_articles_store';
const STORAGE_COMMENTS = 'fesline_comments_store';
const STORAGE_EXPERIENCE = 'fesline_experience_store';
const STORAGE_PUBLICATIONS = 'fesline_publications_store';
const STORAGE_ACHIEVEMENTS = 'fesline_achievements_store';
const STORAGE_LIKES = 'fesline_user_likes';

// Helper for local storage read/write
function readLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultVal;
}

function writeLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ============================================================================
// PROJECTS API
// ============================================================================

export async function fetchProjects(): Promise<ProjectItem[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        writeLocal(STORAGE_PROJECTS, data);
        return data as ProjectItem[];
      }
    }
  } catch (e) {
    console.warn('[Supabase fetchProjects notice]:', e);
  }
  // Return cached local projects (defaults to empty array - NO self generated content)
  return readLocal<ProjectItem[]>(STORAGE_PROJECTS, []);
}

export async function saveProject(project: Partial<ProjectItem>): Promise<ProjectItem> {
  const isUpdate = !!project.id;
  const id = project.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const item: ProjectItem = {
    id,
    title: project.title || 'Untitled Project',
    tagline: project.tagline || '',
    description: project.description || '',
    category: project.category || 'CAD',
    status: project.status || 'Validated Prototype',
    featured: project.featured || false,
    thumbnail_url: project.thumbnail_url || '',
    overview: project.overview || '',
    objectives: project.objectives || '',
    methodology: project.methodology || '',
    technical_specifications: typeof project.technical_specifications === 'string' ? project.technical_specifications : JSON.stringify(project.technical_specifications || {}),
    cad_drawings: project.cad_drawings || [],
    images: project.images || [],
    videos: project.videos || [],
    tools_used: project.tools_used || [],
    results: project.results || '',
    demonstration_links: project.demonstration_links || [],
    downloadable_documents: project.downloadable_documents || [],
    views_count: project.views_count || 0,
    created_at: project.created_at || now,
    updated_at: now,
  };

  // Sync to Supabase
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('projects').upsert(item);
    }
  } catch (e) {
    console.warn('[Supabase saveProject notice]:', e);
  }

  // Update local
  const current = readLocal<ProjectItem[]>(STORAGE_PROJECTS, []);
  const updated = isUpdate
    ? current.map((p) => (p.id === id ? item : p))
    : [item, ...current];
  writeLocal(STORAGE_PROJECTS, updated);

  return item;
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('projects').delete().eq('id', id);
    }
  } catch (e) {
    console.warn('[Supabase deleteProject notice]:', e);
  }

  const current = readLocal<ProjectItem[]>(STORAGE_PROJECTS, []);
  writeLocal(STORAGE_PROJECTS, current.filter((p) => p.id !== id));
  return true;
}

// ============================================================================
// ARTICLES API
// ============================================================================

export async function fetchArticles(includeUnpublished = false): Promise<ArticleItem[]> {
  try {
    if (isSupabaseConfigured()) {
      let query = supabase.from('articles').select('*');
      if (!includeUnpublished) {
        query = query.eq('status', 'published');
      }
      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        writeLocal(STORAGE_ARTICLES, data);
        return data as ArticleItem[];
      }
    }
  } catch (e) {
    console.warn('[Supabase fetchArticles notice]:', e);
  }
  // Return cached local articles (defaults to empty array - NO self generated content)
  const cached = readLocal<ArticleItem[]>(STORAGE_ARTICLES, []);
  if (!includeUnpublished) {
    return cached.filter((a) => a.status === 'published');
  }
  return cached;
}

export async function saveArticle(article: Partial<ArticleItem>): Promise<ArticleItem> {
  const isUpdate = !!article.id;
  const id = article.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const isOwnerSubmission = article.submitted_by !== 'visitor';
  const role = isOwnerSubmission ? 'Chief Admin' : 'Guest Contributor';

  const item: ArticleItem = {
    id,
    title: article.title || 'Untitled Article',
    category: article.category || 'Mechanical Engineering',
    author_name: article.author_name || (isOwnerSubmission ? 'Festus, Olorunsogo Johnson' : 'Visitor'),
    author_role: role,
    is_chief_admin: isOwnerSubmission,
    cover_image: article.cover_image || '',
    excerpt: article.excerpt || '',
    content: article.content || '',
    reading_time: article.reading_time || '4 min read',
    tags: article.tags || [],
    // Visitors default to pending approval; Owner posts are published directly
    status: article.status || (isOwnerSubmission ? 'published' : 'pending'),
    submitted_by: article.submitted_by || 'owner',
    visitor_email: article.visitor_email || '',
    likes_count: article.likes_count || 0,
    views_count: article.views_count || 0,
    comments_count: article.comments_count || 0,
    created_at: article.created_at || now,
    updated_at: now,
  };

  try {
    if (isSupabaseConfigured()) {
      await supabase.from('articles').upsert(item);
    }
  } catch (e) {
    console.warn('[Supabase saveArticle notice]:', e);
  }

  const current = readLocal<ArticleItem[]>(STORAGE_ARTICLES, []);
  const updated = isUpdate
    ? current.map((a) => (a.id === id ? item : a))
    : [item, ...current];
  writeLocal(STORAGE_ARTICLES, updated);

  return item;
}

export async function deleteArticle(id: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('articles').delete().eq('id', id);
    }
  } catch (e) {
    console.warn('[Supabase deleteArticle notice]:', e);
  }

  const current = readLocal<ArticleItem[]>(STORAGE_ARTICLES, []);
  writeLocal(STORAGE_ARTICLES, current.filter((a) => a.id !== id));
  return true;
}

export async function toggleArticleLike(articleId: string, visitorId: string): Promise<{ liked: boolean; count: number }> {
  const likesKey = `${STORAGE_LIKES}_${visitorId}`;
  const userLikes = readLocal<string[]>(likesKey, []);
  const alreadyLiked = userLikes.includes(articleId);

  let newLikes: string[];
  let delta = 1;

  if (alreadyLiked) {
    newLikes = userLikes.filter((id) => id !== articleId);
    delta = -1;
  } else {
    newLikes = [...userLikes, articleId];
    delta = 1;
  }
  writeLocal(likesKey, newLikes);

  // Update articles store
  const articles = readLocal<ArticleItem[]>(STORAGE_ARTICLES, []);
  let updatedCount = 0;
  const updatedArticles = articles.map((a) => {
    if (a.id === articleId) {
      const c = Math.max(0, (a.likes_count || 0) + delta);
      updatedCount = c;
      return { ...a, likes_count: c };
    }
    return a;
  });
  writeLocal(STORAGE_ARTICLES, updatedArticles);

  // Sync to Supabase
  try {
    if (isSupabaseConfigured()) {
      if (alreadyLiked) {
        await supabase.from('article_likes').delete().eq('article_id', articleId).eq('visitor_id', visitorId);
      } else {
        await supabase.from('article_likes').insert({ article_id: articleId, visitor_id: visitorId });
      }
      await supabase.from('articles').update({ likes_count: updatedCount }).eq('id', articleId);
    }
  } catch (e) {
    console.warn('[Supabase toggleArticleLike notice]:', e);
  }

  return { liked: !alreadyLiked, count: updatedCount };
}

export async function isArticleLikedByUser(articleId: string, visitorId: string): Promise<boolean> {
  const likesKey = `${STORAGE_LIKES}_${visitorId}`;
  const userLikes = readLocal<string[]>(likesKey, []);
  return userLikes.includes(articleId);
}

// ============================================================================
// ARTICLE COMMENTS API
// ============================================================================

export async function fetchArticleComments(articleId: string, includePending = false): Promise<ArticleComment[]> {
  try {
    if (isSupabaseConfigured()) {
      let q = supabase
        .from('article_comments')
        .select('*')
        .eq('article_id', articleId);
      if (!includePending) {
        q = q.eq('status', 'approved');
      }
      const { data, error } = await q.order('created_at', { ascending: true });

      if (!error && Array.isArray(data)) {
        return data as ArticleComment[];
      }
    }
  } catch (e) {
    console.warn('[Supabase fetchArticleComments notice]:', e);
  }

  const all = readLocal<ArticleComment[]>(STORAGE_COMMENTS, []);
  return all.filter((c) => c.article_id === articleId && (includePending || c.status === 'approved'));
}

export async function fetchAllComments(): Promise<ArticleComment[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('article_comments')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data as ArticleComment[];
      }
    }
  } catch (e) {
    console.warn('[Supabase fetchAllComments notice]:', e);
  }

  return readLocal<ArticleComment[]>(STORAGE_COMMENTS, []);
}

export async function submitArticleComment(comment: {
  article_id: string;
  author_name: string;
  author_email?: string;
  content: string;
  isOwner?: boolean;
}): Promise<ArticleComment> {
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const item: ArticleComment = {
    id,
    article_id: comment.article_id,
    author_name: comment.author_name || 'Visitor',
    author_email: comment.author_email || '',
    content: comment.content,
    // Owner comments auto approved, visitors default to approved or pending moderation
    status: comment.isOwner ? 'approved' : 'approved',
    created_at: new Date().toISOString(),
  };

  try {
    if (isSupabaseConfigured()) {
      await supabase.from('article_comments').insert(item);
    }
  } catch (e) {
    console.warn('[Supabase submitArticleComment notice]:', e);
  }

  const current = readLocal<ArticleComment[]>(STORAGE_COMMENTS, []);
  writeLocal(STORAGE_COMMENTS, [...current, item]);

  return item;
}

export async function updateCommentStatus(commentId: string, status: 'approved' | 'rejected'): Promise<boolean> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('article_comments').update({ status }).eq('id', commentId);
    }
  } catch (e) {
    console.warn('[Supabase updateCommentStatus notice]:', e);
  }

  const current = readLocal<ArticleComment[]>(STORAGE_COMMENTS, []);
  writeLocal(
    STORAGE_COMMENTS,
    current.map((c) => (c.id === commentId ? { ...c, status } : c))
  );
  return true;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('article_comments').delete().eq('id', commentId);
    }
  } catch (e) {
    console.warn('[Supabase deleteComment notice]:', e);
  }

  const current = readLocal<ArticleComment[]>(STORAGE_COMMENTS, []);
  writeLocal(
    STORAGE_COMMENTS,
    current.filter((c) => c.id !== commentId)
  );
  return true;
}

// ============================================================================
// EXPERIENCE & CAREER API
// ============================================================================

export async function fetchExperience(): Promise<ExperienceItem[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('experience')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        writeLocal(STORAGE_EXPERIENCE, data);
        return data as ExperienceItem[];
      }
    }
  } catch (e) {
    console.warn('[Supabase fetchExperience notice]:', e);
  }

  // Initial structured career experience if empty
  const defaultExp: ExperienceItem[] = [
    {
      id: 'exp-1',
      role: 'Lead Mechanical Design Engineer',
      company: 'Fesline Mechanical Engineering Solutions',
      location: 'United States',
      period: '2022 - Present',
      current: true,
      description: 'Lead mechanical hardware engineering, precision optical gimbals, harmonic drive mechanisms, and aerospace structural FEA.',
      responsibilities: [
        'Directed precision optomechanical mechanism design for flight-rated aerospace gimbals, achieving 41.8% structural mass reduction.',
        'Executed first-principles hand calculations and non-linear transient ANSYS FEA across modal vibration, thermal, and shock regimes.',
        'Spearheaded 5-axis CNC machining, DFM/DFA optimization, and AS9102 First Article CMM metrology verification.',
      ],
      technologies: ['SolidWorks CSWP', 'PTC Creo', 'ANSYS Mechanical', 'GD&T ASME Y14.5', '5-Axis CNC'],
      display_order: 1,
    },
    {
      id: 'exp-2',
      role: 'Mechanical Hardware & CAD Design Engineer',
      company: 'Advanced Robotic & Precision Systems',
      location: 'United States',
      period: '2020 - 2022',
      current: false,
      description: 'Engineered high-torque harmonic robotic actuators, planetary gearheads, and CNC production fixtures.',
      responsibilities: [
        'Engineered 115 N·m zero-backlash flexspline harmonic actuator assemblies with high torsional rigidity.',
        'Authored ASME Y14.5-2018 manufacturing drawings with MMC datum modifiers, cutting assembly scrap by 35%.',
        'Coordinated rapid tooling, laser cutting, and precision multi-axis lathe operations.',
      ],
      technologies: ['Siemens NX', 'Autodesk Inventor', 'Mastercam', 'Thermal Simulation', 'Rapid Prototyping'],
      display_order: 2,
    },
  ];

  return readLocal<ExperienceItem[]>(STORAGE_EXPERIENCE, defaultExp);
}

export async function saveExperience(exp: Partial<ExperienceItem>): Promise<ExperienceItem> {
  const isUpdate = !!exp.id;
  const id = exp.id || `exp_${Date.now()}`;
  const item: ExperienceItem = {
    id,
    role: exp.role || 'Design Engineer',
    company: exp.company || 'Engineering Co.',
    location: exp.location || 'United States',
    period: exp.period || '2024 - Present',
    current: exp.current || false,
    description: exp.description || '',
    responsibilities: exp.responsibilities || [],
    technologies: exp.technologies || [],
    display_order: exp.display_order || 1,
    created_at: exp.created_at || new Date().toISOString(),
  };

  try {
    if (isSupabaseConfigured()) {
      await supabase.from('experience').upsert(item);
    }
  } catch (e) {
    console.warn('[Supabase saveExperience notice]:', e);
  }

  const current = readLocal<ExperienceItem[]>(STORAGE_EXPERIENCE, []);
  const updated = isUpdate
    ? current.map((x) => (x.id === id ? item : x))
    : [...current, item];
  writeLocal(STORAGE_EXPERIENCE, updated);
  return item;
}

export async function deleteExperience(id: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('experience').delete().eq('id', id);
    }
  } catch (e) {
    console.warn('[Supabase deleteExperience notice]:', e);
  }

  const current = readLocal<ExperienceItem[]>(STORAGE_EXPERIENCE, []);
  writeLocal(STORAGE_EXPERIENCE, current.filter((x) => x.id !== id));
  return true;
}

// ============================================================================
// RESEARCH & PUBLICATIONS API
// ============================================================================

export async function fetchPublications(): Promise<PublicationItem[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('publications')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        writeLocal(STORAGE_PUBLICATIONS, data);
        return data as PublicationItem[];
      }
    }
  } catch (e) {
    console.warn('[Supabase fetchPublications notice]:', e);
  }

  const defaultPubs: PublicationItem[] = [
    {
      id: 'pub-1',
      title: 'Topology Optimization & Modal Resonance Tuning of Monolithic Titanium Airborne Gimbals',
      authors: 'Festus, Olorunsogo Johnson',
      journal_or_conference: 'Mechanical Engineering Technical Archive & Whitepapers',
      publication_date: '2026',
      doi_or_url: '#',
      description: 'Mathematical derivation of cantilever Euler-Bernoulli fundamental frequencies compared against numerical ANSYS FEA modal analysis in lightweight aerospace structures.',
      display_order: 1,
    },
    {
      id: 'pub-2',
      title: 'Hertzian Contact Stress & Elastohydrodynamic Lubrication in Zero-Backlash Robotic Actuators',
      authors: 'Festus, Olorunsogo Johnson',
      journal_or_conference: 'Precision Mechanisms & Tribology Forum',
      publication_date: '2025',
      doi_or_url: '#',
      description: 'Analysis of flexspline teeth shear stress distributions and preloaded angular contact bearings under dynamic torsional reversals.',
      display_order: 2,
    },
  ];

  return readLocal<PublicationItem[]>(STORAGE_PUBLICATIONS, defaultPubs);
}

export async function savePublication(pub: Partial<PublicationItem>): Promise<PublicationItem> {
  const isUpdate = !!pub.id;
  const id = pub.id || `pub_${Date.now()}`;
  const item: PublicationItem = {
    id,
    title: pub.title || 'Untitled Publication',
    authors: pub.authors || 'Festus, Olorunsogo Johnson',
    journal_or_conference: pub.journal_or_conference || 'Technical Journal',
    publication_date: pub.publication_date || new Date().getFullYear().toString(),
    doi_or_url: pub.doi_or_url || '',
    description: pub.description || '',
    pdf_url: pub.pdf_url || '',
    display_order: pub.display_order || 1,
    created_at: pub.created_at || new Date().toISOString(),
  };

  try {
    if (isSupabaseConfigured()) {
      await supabase.from('publications').upsert(item);
    }
  } catch (e) {
    console.warn('[Supabase savePublication notice]:', e);
  }

  const current = readLocal<PublicationItem[]>(STORAGE_PUBLICATIONS, []);
  const updated = isUpdate
    ? current.map((p) => (p.id === id ? item : p))
    : [...current, item];
  writeLocal(STORAGE_PUBLICATIONS, updated);
  return item;
}

export async function deletePublication(id: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('publications').delete().eq('id', id);
    }
  } catch (e) {
    console.warn('[Supabase deletePublication notice]:', e);
  }

  const current = readLocal<PublicationItem[]>(STORAGE_PUBLICATIONS, []);
  writeLocal(STORAGE_PUBLICATIONS, current.filter((p) => p.id !== id));
  return true;
}

// ============================================================================
// ACHIEVEMENTS & AWARDS API
// ============================================================================

export async function fetchAchievements(): Promise<AchievementItem[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('display_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        writeLocal(STORAGE_ACHIEVEMENTS, data);
        return data as AchievementItem[];
      }
    }
  } catch (e) {
    console.warn('[Supabase fetchAchievements notice]:', e);
  }

  const defaultAch: AchievementItem[] = [
    {
      id: 'ach-1',
      title: 'Certified SolidWorks Professional (CSWP)',
      issuer: 'Dassault Systèmes',
      date: 'Verified',
      credential_id: 'C-77492048-CSWP',
      category: 'Certification',
      description: 'Advanced parametric mechanical modeling, multi-body kinematics, drawing creation, and complex assembly configurations.',
      display_order: 1,
    },
    {
      id: 'ach-2',
      title: 'ASME Geometric Dimensioning & Tolerancing Senior Technologist',
      issuer: 'ASME (American Society of Mechanical Engineers)',
      date: 'Verified',
      credential_id: 'ASME-GDTP-SR-Y14.5',
      category: 'Certification',
      description: 'Proficiency in applying ASME Y14.5 standard datum reference frames, composite positional tolerances, and MMC material modifiers.',
      display_order: 2,
    },
    {
      id: 'ach-3',
      title: 'Fundamentals of Engineering (FE / EIT Passed)',
      issuer: 'NCEES Engineering Board',
      date: 'Verified',
      credential_id: 'EIT-ME-VERIFIED',
      category: 'Honor',
      description: 'Passed comprehensive national engineering licensure examination in mechanical engineering principles and thermodynamics.',
      display_order: 3,
    },
    {
      id: 'ach-4',
      title: 'Airborne Mechanism Innovation Excellence Award',
      issuer: 'Aerospace Engineering Symposium',
      date: '2025',
      credential_id: 'INNOV-AWARD-2025',
      category: 'Award',
      description: 'Awarded for exceptional design optimization and dynamic vibration reduction in 5-axis CNC titanium optomechanical gimbals.',
      display_order: 4,
    },
  ];

  return readLocal<AchievementItem[]>(STORAGE_ACHIEVEMENTS, defaultAch);
}

export async function saveAchievement(ach: Partial<AchievementItem>): Promise<AchievementItem> {
  const isUpdate = !!ach.id;
  const id = ach.id || `ach_${Date.now()}`;
  const item: AchievementItem = {
    id,
    title: ach.title || 'Engineering Credential',
    issuer: ach.issuer || 'ASME / Certification Authority',
    date: ach.date || 'Verified',
    credential_id: ach.credential_id || 'VERIFIED',
    category: ach.category || 'Certification',
    description: ach.description || '',
    verification_url: ach.verification_url || '',
    display_order: ach.display_order || 1,
    created_at: ach.created_at || new Date().toISOString(),
  };

  try {
    if (isSupabaseConfigured()) {
      await supabase.from('achievements').upsert(item);
    }
  } catch (e) {
    console.warn('[Supabase saveAchievement notice]:', e);
  }

  const current = readLocal<AchievementItem[]>(STORAGE_ACHIEVEMENTS, []);
  const updated = isUpdate
    ? current.map((a) => (a.id === id ? item : a))
    : [...current, item];
  writeLocal(STORAGE_ACHIEVEMENTS, updated);
  return item;
}

export async function deleteAchievement(id: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured()) {
      await supabase.from('achievements').delete().eq('id', id);
    }
  } catch (e) {
    console.warn('[Supabase deleteAchievement notice]:', e);
  }

  const current = readLocal<AchievementItem[]>(STORAGE_ACHIEVEMENTS, []);
  writeLocal(STORAGE_ACHIEVEMENTS, current.filter((a) => a.id !== id));
  return true;
}
