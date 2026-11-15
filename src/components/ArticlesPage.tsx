import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Heart,
  MessageSquare,
  Share2,
  Clock,
  Eye,
  User,
  ArrowRight,
  BookOpen,
  Calendar,
  Tag,
  Code,
  FileText,
  Download,
  Check,
  Copy,
  ChevronDown,
  Layers,
  Sparkles,
  X,
  Upload,
  Loader2,
  ThumbsUp,
  Send,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { supabase, uploadMaterialToSupabaseBucket } from '../utils/supabase';
import { useProfileSync } from '../utils/profileState';

export interface ArticleComment {
  id: string;
  article_id: string;
  author_name: string;
  author_role: string;
  comment_text: string;
  created_at: string;
}

export interface DynamicArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  discipline_tag: string;
  category: string;
  difficulty: 'Introductory' | 'Intermediate' | 'Advanced';
  reading_time_min: number;
  thumbnail_url: string;
  hero_media_type: 'image' | 'pdf' | 'diagram' | 'video' | 'cad_embed';
  hero_media_url?: string;
  tldr_summary: string;
  bom_table?: Array<{ itemNo: number; partName: string; material: string; qty: number; supplier: string }>;
  downloadable_files?: Array<{ name: string; url: string; size?: string }>;
  author_name: string;
  author_tag: string;
  is_approved: boolean;
  is_archived: boolean;
  likes_count: number;
  views_count: number;
  created_at: string;
  updated_at?: string;
}

const DEFAULT_SAMPLE_ARTICLES: DynamicArticle[] = [
  {
    id: 'art-001',
    title: 'First-Principles Vibration Sanity Checks vs. Ansys Modal Topology',
    slug: 'first-principles-vibration-sanity-checks',
    excerpt: 'How closed-form Euler-Bernoulli cantilever equations predict structural fundamental resonances within 1.2% of high-order 10-node tetrahedral FEA meshing.',
    content: `## 1. Executive Summary & Design Premise
When engineering precision flight hardware, computational Finite Element Analysis (FEA) must never be trusted without independent closed-form mathematical verification. A subtle boundary condition error or unconstrained rotational degree of freedom can easily produce deceptively optimistic modal results.

\`\`\`math
f_n = \\frac{3.52}{2\\pi} \\sqrt{\\frac{E \\cdot I}{m_{eff} \\cdot L^3}}
\`\`\`

### Key Variables & Derived Constants:
- **Young's Modulus (Ti-6Al-4V):** E = 114 GPa
- **Second Moment of Area:** I_{xx} = 1.48 \\times 10^{-7} m^4
- **Lumped Sensor Mass:** m_{eff} = 1.85 kg
- **Cantilever Arm Span:** L = 0.165 m

\`\`\`python
# Python closed-form calculation snippet
import math

E = 114e9       # Titanium Ti-6Al-4V in Pa
I = 1.48e-7     # m^4
m_eff = 1.85    # kg lumped payload
L = 0.165       # m

stiffness = (E * I) / (L ** 3)
fn = (3.52 / (2 * math.pi)) * math.sqrt(stiffness / m_eff)
print(f"Theoretical Fundamental Resonance: {fn:.2f} Hz")
# Output: 344.20 Hz vs FEA 342.10 Hz (0.61% Error)
\`\`\`

## 2. Experimental FEA Boundary Setup
The assembly was meshed in Ansys Workbench with SOLID187 higher-order 10-node tetrahedral elements. A fixed support constraint was mapped directly to the bearing interface shoulder (Datum A) with zero allowable translation across the primary flight axes.

## 3. Shop-Floor Realities & DFM Integration
By standardizing toolpath radii to 4.0mm ball endmills, 5-axis setup times were reduced by 3.5 hours per yoke, preventing chatter marks and stress concentration notches along the root fillet.`,
    discipline_tag: 'Vibration & FEA',
    category: 'Mechanical & CAD Design',
    difficulty: 'Advanced',
    reading_time_min: 6,
    thumbnail_url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
    hero_media_type: 'image',
    hero_media_url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80',
    tldr_summary: 'Always calculate natural frequency by hand before launching 10-node FEA. Closed-form Euler-Bernoulli equations matched Ansys transient modal output within 0.6%, preventing costly titanium scrap.',
    bom_table: [
      { itemNo: 1, partName: 'Gimbal Yoke Bracket', material: 'Ti-6Al-4V (Grade 5)', qty: 1, supplier: 'Carpenter Aerospace' },
      { itemNo: 2, partName: 'Duplex Angular Contact Bearing', material: '52100 Steel / P4', qty: 2, supplier: 'SKF Aerospace' },
      { itemNo: 3, partName: 'Preload Wave Spring', material: '17-7 PH Stainless Steel', qty: 1, supplier: 'Smalley' },
    ],
    downloadable_files: [
      { name: 'modal-derivation-whitepaper.pdf', url: '#', size: '2.4 MB' },
      { name: 'cad-yoke-gdt-spec.step', url: '#', size: '14.1 MB' },
    ],
    author_name: 'Festus Johnson',
    author_tag: 'Chief Admin',
    is_approved: true,
    is_archived: false,
    likes_count: 24,
    views_count: 312,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'art-002',
    title: 'ASME Y14.5 MMC Zero-Interference GD&T Methodology in High-Precision CNC',
    slug: 'asme-y14-5-mmc-zero-interference-gdt',
    excerpt: 'Practical implementation of Maximum Material Condition (MMC) bonus tolerances on CNC multi-axis mating components to eliminate shop scrap.',
    content: `## 1. The Cost of Over-Constraining Machinists
Traditional coordinate tolerancing (±0.05mm) often forces machine shops to reject perfectly functional parts simply because individual axis measurements strayed, even when the true geometric clearance was preserved.

## 2. Datum Hierarchy & Datum Shift
By establishing functional datums A (primary planar seat), B (secondary rotational index), and C (tertiary pin stop), we allow true positional tolerance bonus under Maximum Material Condition (MMC).

\`\`\`math
\\text{Bonus Tolerance} = \\text{Actual Mating Size} - \\text{MMC Boundary}
\`\`\`

## 3. Quantitative Inspection Summary
Across a production run of 120 optical bracket housings, utilizing MMC callouts yielded a 0% assembly interference rate while slashing machine inspection hold times by 44%.`,
    discipline_tag: 'GD&T & Metrology',
    category: 'Manufacturing & CNC',
    difficulty: 'Intermediate',
    reading_time_min: 4,
    thumbnail_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    hero_media_type: 'image',
    hero_media_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    tldr_summary: 'Applying ASME Y14.5 MMC positional tolerances granted machinists up to 0.08mm in bonus tolerance, resulting in zero vendor scrap and $14,000 in saved manufacturing costs.',
    bom_table: [
      { itemNo: 1, partName: 'Optical Housing Base', material: 'Al 6061-T651', qty: 1, supplier: 'Ryerson' },
      { itemNo: 2, partName: 'Dowel Alignment Pin (m6)', material: 'A2 Tool Steel', qty: 2, supplier: 'McMaster-Carr' },
    ],
    downloadable_files: [
      { name: 'gdt-drawing-spec-sheet.pdf', url: '#', size: '1.8 MB' },
    ],
    author_name: 'Festus Johnson',
    author_tag: 'Chief Admin',
    is_approved: true,
    is_archived: false,
    likes_count: 19,
    views_count: 245,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
];

interface ArticlesPageProps {
  onNavigatePart?: (part: any, anchorId?: string) => void;
}

export const ArticlesPage: React.FC<ArticlesPageProps> = () => {
  const { isOwner, bio } = useProfileSync();
  const [articles, setArticles] = useState<DynamicArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'likes' | 'views' | 'title'>('newest');

  // Detail Modal & Submission Modal State
  const [activeArticle, setActiveArticle] = useState<DynamicArticle | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [copiedLink, setCopiedLink] = useState(false);

  // New Post Form State
  const [postTitle, setPostTitle] = useState('');
  const [postExcerpt, setPostExcerpt] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postDiscipline, setPostDiscipline] = useState('Mechanical Design');
  const [postCategory, setPostCategory] = useState('Mechanical & CAD Design');
  const [postDifficulty, setPostDifficulty] = useState<'Introductory' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [postReadingTime, setPostReadingTime] = useState(5);
  const [postTldr, setPostTldr] = useState('');
  const [postThumbnail, setPostThumbnail] = useState('');
  const [postAuthorName, setPostAuthorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Fetch articles from Supabase
  const fetchArticles = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('articles')
        .select('*')
        .eq('is_archived', false);

      // If not owner, filter to approved only
      if (!isOwner) {
        query.eq('is_approved', true);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase Articles Fetch Note]:', error.message);
        setArticles(DEFAULT_SAMPLE_ARTICLES);
      } else if (data && data.length > 0) {
        setArticles(data);
      } else {
        // Fallback to sample articles so page is functional
        setArticles(DEFAULT_SAMPLE_ARTICLES);
      }
    } catch {
      setArticles(DEFAULT_SAMPLE_ARTICLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();

    const channel = supabase
      .channel('public:articles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => {
        fetchArticles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOwner]);

  // Load comments for active article
  useEffect(() => {
    if (!activeArticle) {
      setComments([]);
      return;
    }

    async function loadComments() {
      try {
        const { data, error } = await supabase
          .from('article_comments')
          .select('*')
          .eq('article_id', activeArticle?.id)
          .eq('is_approved', true)
          .eq('is_archived', false)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setComments(data);
        } else {
          // Provide sample discussion comment
          setComments([
            {
              id: 'c1',
              article_id: activeArticle?.id || '',
              author_name: 'Dr. Marcus Vance (Aerospace Structures)',
              author_role: 'Lead Dynamics Specialist',
              comment_text: 'Excellent methodology correlating the 3.52 Euler-Bernoulli coefficient against SOLID187 boundary stiffness. Did you notice any micro-yielding at the bearing corner fillet during transient 30g shock simulations?',
              created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
            },
          ]);
        }
      } catch {
        setComments([]);
      }
    }

    loadComments();
  }, [activeArticle]);

  // Auto suggestions for search datalist
  const autoSuggestions = useMemo(() => {
    const list = new Set<string>();
    articles.forEach((a) => {
      list.add(a.title);
      list.add(a.discipline_tag);
      list.add(a.category);
    });
    return Array.from(list);
  }, [articles]);

  // Filter and sort articles
  const filteredArticles = useMemo(() => {
    let result = articles.filter((a) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.discipline_tag.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'All' || a.category === selectedCategory;
      return matchesSearch && matchesCat;
    });

    result.sort((a, b) => {
      if (sortBy === 'likes') return (b.likes_count || 0) - (a.likes_count || 0);
      if (sortBy === 'views') return (b.views_count || 0) - (a.views_count || 0);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [articles, searchQuery, selectedCategory, sortBy]);

  // Handle article like toggle
  const handleToggleLike = async (e: React.MouseEvent, article: DynamicArticle) => {
    e.stopPropagation();
    const hasLiked = userLikes.has(article.id);
    const newLikesCount = hasLiked ? Math.max(0, article.likes_count - 1) : article.likes_count + 1;

    // Optimistically update
    setArticles((prev) =>
      prev.map((a) => (a.id === article.id ? { ...a, likes_count: newLikesCount } : a))
    );
    if (activeArticle && activeArticle.id === article.id) {
      setActiveArticle({ ...activeArticle, likes_count: newLikesCount });
    }

    setUserLikes((prev) => {
      const next = new Set(prev);
      if (hasLiked) next.delete(article.id);
      else next.add(article.id);
      return next;
    });

    // Supabase persist
    try {
      await supabase
        .from('articles')
        .update({ likes_count: newLikesCount })
        .eq('id', article.id);
    } catch {}
  };

  // Submit new article
  const handlePostArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;

    try {
      setIsSubmitting(true);
      const slug = postTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') + `-${Date.now().toString(36)}`;

      const authorName = isOwner
        ? bio.fullName || 'Festus Johnson'
        : postAuthorName.trim() || 'Visitor Contributor';

      const authorTag = isOwner ? 'Chief Admin' : 'Visitor Submission';
      const isApproved = isOwner; // Owners bypass moderation directly

      const payload = {
        title: postTitle.trim(),
        slug,
        excerpt: postExcerpt.trim() || postContent.trim().slice(0, 160) + '...',
        content: postContent.trim(),
        discipline_tag: postDiscipline.trim(),
        category: postCategory,
        difficulty: postDifficulty,
        reading_time_min: Number(postReadingTime) || 5,
        thumbnail_url: postThumbnail.trim() || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        hero_media_type: 'image' as const,
        hero_media_url: postThumbnail.trim() || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        tldr_summary: postTldr.trim() || 'Key engineering synthesis and empirical takeaways.',
        author_name: authorName,
        author_tag: authorTag,
        is_approved: isApproved,
        is_archived: false,
        likes_count: 0,
        views_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('articles').insert(payload).select().single();

      if (!error && data) {
        if (isApproved) {
          setArticles((prev) => [data, ...prev]);
        }
      } else {
        // Fallback local update
        if (isApproved) {
          setArticles((prev) => [{ id: `art_${Date.now()}`, ...payload }, ...prev]);
        }
      }

      setSubmissionSuccess(true);
      setTimeout(() => {
        setIsPostModalOpen(false);
        setSubmissionSuccess(false);
        setPostTitle('');
        setPostExcerpt('');
        setPostContent('');
        setPostTldr('');
        setPostThumbnail('');
        setPostAuthorName('');
      }, 1500);
    } catch (err) {
      console.error('Failed to post article:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeArticle) return;

    const newComment: ArticleComment = {
      id: `comm_${Date.now()}`,
      article_id: activeArticle.id,
      author_name: isOwner ? bio.fullName || 'Festus Johnson' : (commentAuthor.trim() || 'Engineering Peer'),
      author_role: isOwner ? 'Chief Mechanical Engineer' : 'Peer Reviewer',
      comment_text: commentText.trim(),
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [...prev, newComment]);
    setCommentText('');

    try {
      await supabase.from('article_comments').insert({
        article_id: activeArticle.id,
        author_name: newComment.author_name,
        author_role: newComment.author_role,
        comment_text: newComment.comment_text,
        is_approved: true,
        created_at: newComment.created_at,
      });
    } catch {}
  };

  // Thumbnail upload
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMaterialToSupabaseBucket(file, file.name);
      if (res?.publicUrl) {
        setPostThumbnail(res.publicUrl);
      }
    } catch {}
  };

  // Social share copy helper
  const handleCopyShareLink = (article: DynamicArticle) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col font-serif pb-16">
      {/* 1. Header Section: Center justified header in a compact div container reading exactly "Engineering Articles" */}
      <div className="w-full py-4 sm:py-6 border-b border-[#b8c6d4] bg-[#dbe2eb]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block py-1 px-4">
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-slate-950 tracking-tight">
              Engineering Articles
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full">
        {/* 2. Top Bar & Search Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-5 border-b border-[#cbd5e1]">
          {/* Search Bar with Datalist Auto Suggestions */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              list="article-suggestions"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles, tags, formulas..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-serif placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-800"
            />
            <datalist id="article-suggestions">
              {autoSuggestions.map((s, idx) => (
                <option key={idx} value={s} />
              ))}
            </datalist>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-serif cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Mechanical & CAD Design">Mechanical &amp; CAD Design</option>
              <option value="Manufacturing & CNC">Manufacturing &amp; CNC</option>
              <option value="Software & Web Systems">Software &amp; Web Systems</option>
              <option value="Robotics & Mechatronics">Robotics &amp; Mechatronics</option>
              <option value="General Engineering">General Engineering</option>
            </select>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-serif cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="likes">Most Liked</option>
              <option value="views">Most Viewed</option>
              <option value="title">Title (A-Z)</option>
            </select>

            {/* Compact "Post" Action Button */}
            <button
              type="button"
              onClick={() => setIsPostModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-950 text-white text-xs font-serif font-bold shadow-2xs transition-all cursor-pointer shrink-0"
              title="Post an article (Visitors require admin moderation, Chief Admin bypasses)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Post</span>
            </button>
          </div>
        </div>

        {/* 3. Article Cards (Landing Feed Grid) */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-800 mb-2" />
            <span className="text-xs font-serif">Loading Engineering Articles from Supabase...</span>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-[#b8c6d4] rounded-2xl bg-white/50 p-8 my-6">
            <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Articles Found</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
              Be the first to share an engineering analysis or simulation study. Click "Post" above to submit an article.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-6">
            {filteredArticles.map((article) => {
              const hasLiked = userLikes.has(article.id);
              return (
                <div
                  key={article.id}
                  onClick={() => {
                    setActiveArticle(article);
                    setIsDetailOpen(true);
                  }}
                  className="group rounded-2xl bg-white/95 border border-slate-300 hover:border-cyan-800 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Thumbnail Media */}
                    <div className="relative w-full h-40 bg-slate-200 overflow-hidden">
                      <img
                        src={article.thumbnail_url}
                        alt={article.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-bold bg-slate-900/90 text-white backdrop-blur-xs">
                          {article.discipline_tag}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-bold bg-cyan-800/90 text-white backdrop-blur-xs">
                          {article.difficulty}
                        </span>
                      </div>
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-sans flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{article.reading_time_min} min read</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 sm:p-4.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                        <span className="font-bold text-cyan-900">{article.author_tag}</span>
                        <span>{new Date(article.created_at).toLocaleDateString()}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-cyan-900 transition-colors line-clamp-2 leading-snug">
                        {article.title}
                      </h3>

                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                        {article.excerpt}
                      </p>
                    </div>
                  </div>

                  {/* Card Social & Engagement Footer */}
                  <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600 font-sans">
                    <div className="flex items-center gap-3">
                      {/* Like Toggle */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleLike(e, article)}
                        className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          hasLiked ? 'text-rose-600 font-bold' : 'hover:text-rose-600'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-600' : ''}`} />
                        <span>{article.likes_count}</span>
                      </button>

                      <div className="inline-flex items-center gap-1 text-slate-500">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{article.views_count}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyShareLink(article);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-slate-900 transition-colors"
                        title="Share Article Link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-cyan-900 font-serif font-bold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                        <span>Read</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. DETAIL PAGE / FULL ARTICLE MODAL VIEW                  */}
      {/* ======================================================== */}
      {isDetailOpen && activeArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-[#eaf0f6] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#d8e0eb] border-b border-[#b8c6d4] shrink-0">
              <div className="flex items-center gap-2 text-[11px] font-sans font-bold text-cyan-900">
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-white">{activeArticle.discipline_tag}</span>
                <span>·</span>
                <span className="text-slate-600">{activeArticle.difficulty} Level</span>
                <span>·</span>
                <span>{activeArticle.reading_time_min} Min Read</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(activeArticle)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white"
                  title="Share Article"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-xs sm:text-sm">
              {/* Article Title & Author Header */}
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-slate-950 leading-tight">
                  {activeArticle.title}
                </h1>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 font-sans">
                  <span className="font-bold text-slate-900">{activeArticle.author_name}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                    {activeArticle.author_tag}
                  </span>
                  <span>·</span>
                  <span>{new Date(activeArticle.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Flexible Visual Hero */}
              <div className="w-full h-56 sm:h-72 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shadow-2xs">
                <img
                  src={activeArticle.hero_media_url || activeArticle.thumbnail_url}
                  alt={activeArticle.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* TL;DR Summary Box */}
              {activeArticle.tldr_summary && (
                <div className="p-4 rounded-xl bg-cyan-950/5 border border-cyan-800/30 text-cyan-950">
                  <span className="block text-[11px] font-sans font-bold uppercase tracking-wider mb-1 text-cyan-900">
                    TL;DR Engineering Summary
                  </span>
                  <p className="italic text-xs sm:text-sm leading-relaxed">
                    {activeArticle.tldr_summary}
                  </p>
                </div>
              )}

              {/* Rich Markdown / Derivation Content */}
              <div className="prose prose-slate max-w-none space-y-3.5 text-slate-800 leading-relaxed font-serif text-xs sm:text-sm">
                <div className="whitespace-pre-line bg-white/70 p-4 sm:p-5 rounded-xl border border-slate-300">
                  {activeArticle.content}
                </div>
              </div>

              {/* Optional Bill of Materials (BOM) Table */}
              {activeArticle.bom_table && activeArticle.bom_table.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-2 pb-1 border-b border-slate-300">
                    Bill of Materials (BOM) Spec
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
                    <table className="w-full text-left text-xs font-serif">
                      <thead className="bg-[#e4ebf3] border-b border-slate-300 text-slate-700 font-bold">
                        <tr>
                          <th className="p-2 sm:p-2.5">#</th>
                          <th className="p-2 sm:p-2.5">Part Name</th>
                          <th className="p-2 sm:p-2.5">Material</th>
                          <th className="p-2 sm:p-2.5">Qty</th>
                          <th className="p-2 sm:p-2.5">Supplier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {activeArticle.bom_table.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 sm:p-2.5 font-mono">{row.itemNo || idx + 1}</td>
                            <td className="p-2 sm:p-2.5 font-bold text-slate-900">{row.partName}</td>
                            <td className="p-2 sm:p-2.5">{row.material}</td>
                            <td className="p-2 sm:p-2.5">{row.qty}</td>
                            <td className="p-2 sm:p-2.5 text-slate-600">{row.supplier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Downloadable Project Files: Sanitized Display Names (no raw URLs) */}
              {activeArticle.downloadable_files && activeArticle.downloadable_files.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-2 pb-1 border-b border-slate-300">
                    Project Deliverables &amp; Verified CAD Assets
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeArticle.downloadable_files.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-white border border-slate-300 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-cyan-800 shrink-0" />
                          <span className="font-bold text-slate-900 truncate" title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {file.size || 'Download'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interactive Markdown Comment Section */}
              <div className="pt-4 border-t border-slate-300">
                <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-900" />
                  <span>Technical Peer Review &amp; Comments ({comments.length})</span>
                </h4>

                {/* Comment list */}
                <div className="space-y-3 mb-4">
                  {comments.map((comm) => (
                    <div
                      key={comm.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-300 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <User className="w-3.5 h-3.5 text-cyan-800" />
                          <span>{comm.author_name}</span>
                          <span className="text-[10px] font-sans font-normal text-slate-500">
                            ({comm.author_role})
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(comm.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed pt-1">
                        {comm.comment_text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Comment Input Form */}
                <form onSubmit={handleAddComment} className="p-3.5 rounded-xl bg-[#e0e7f1] border border-slate-300 space-y-2 text-xs">
                  {!isOwner && (
                    <input
                      type="text"
                      value={commentAuthor}
                      onChange={(e) => setCommentAuthor(e.target.value)}
                      placeholder="Your Name & Engineering Title..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                    />
                  )}
                  <textarea
                    rows={2}
                    required
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Leave a technical question, calculation review, or methodology critique..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-950 text-white font-bold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Review</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. "POST" ACTION MODAL (VISITORS & CHIEF ADMIN)          */}
      {/* ======================================================== */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#eaf0f6] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#d8e0eb] border-b border-[#b8c6d4] shrink-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-900" />
                <h3 className="text-sm sm:text-base font-bold text-slate-950">
                  Post to Engineering Articles
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPostModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Moderation notice */}
            <div className="px-5 py-2.5 bg-cyan-900/10 border-b border-cyan-800/20 text-cyan-950 text-xs flex items-center gap-2">
              {isOwner ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Authenticated as <strong>Chief Admin</strong>. Articles publish instantly.</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Visitor submissions undergo technical moderation prior to public feed listing.</span>
                </>
              )}
            </div>

            {/* Submission Form */}
            <form onSubmit={handlePostArticle} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              {submissionSuccess && (
                <div className="p-3 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Article submitted successfully!</span>
                </div>
              )}

              {!isOwner && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Your Name & Title *</label>
                  <input
                    type="text"
                    required
                    value={postAuthorName}
                    onChange={(e) => setPostAuthorName(e.target.value)}
                    placeholder="e.g. David Vance, Aerospace Propulsion Engineer"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">Article Title *</label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g. Non-Linear Contact Mechanics in Cryogenic Seals"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-cyan-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Discipline Tag</label>
                  <input
                    type="text"
                    value={postDiscipline}
                    onChange={(e) => setPostDiscipline(e.target.value)}
                    placeholder="e.g. Cryogenics & FEA"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Category</label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 cursor-pointer"
                  >
                    <option value="Mechanical & CAD Design">Mechanical &amp; CAD Design</option>
                    <option value="Manufacturing & CNC">Manufacturing &amp; CNC</option>
                    <option value="Software & Web Systems">Software &amp; Web Systems</option>
                    <option value="Robotics & Mechatronics">Robotics &amp; Mechatronics</option>
                    <option value="General Engineering">General Engineering</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Difficulty</label>
                  <select
                    value={postDifficulty}
                    onChange={(e) => setPostDifficulty(e.target.value as any)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 cursor-pointer"
                  >
                    <option value="Introductory">Introductory</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Short Excerpt / Abstract</label>
                <input
                  type="text"
                  value={postExcerpt}
                  onChange={(e) => setPostExcerpt(e.target.value)}
                  placeholder="1-2 sentences summarizing the empirical thesis..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">TL;DR Executive Summary</label>
                <textarea
                  rows={2}
                  value={postTldr}
                  onChange={(e) => setPostTldr(e.target.value)}
                  placeholder="Key practical takeaways and actionable rule of thumb..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Full Rich Text &amp; Code Blocks (Markdown / LaTeX equations supported) *
                </label>
                <textarea
                  rows={6}
                  required
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Write full article content. Include formulas, code blocks (```python), methodology, and results..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Thumbnail Media (File Upload or External URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={postThumbnail}
                    onChange={(e) => setPostThumbnail(e.target.value)}
                    placeholder="https://... or upload image"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                  <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer font-bold">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-300 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-950 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>{isOwner ? 'Publish Article' : 'Submit for Review'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
