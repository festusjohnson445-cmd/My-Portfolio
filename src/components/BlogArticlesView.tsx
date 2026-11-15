import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  FileText,
  Heart,
  MessageSquare,
  Share2,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Download,
  Upload,
  Code,
  Box,
  Layers,
  X,
  Send,
  Eye,
  Filter,
} from 'lucide-react';
import { Article, ArticleComment } from '../types/portfolio';
import { useProfileSync } from '../utils/profileState';
import { supabase, resilientSupabaseUpsert, uploadMaterialToSupabaseBucket } from '../utils/supabase';

const DEFAULT_ARTICLES: Article[] = [
  {
    id: 'art_1',
    title: 'Harmonic Strain Wave Gear Topology & Thermal Post-Mortem',
    slug: 'harmonic-strain-wave-gear-topology',
    category: 'Optomechanics',
    discipline: 'Mechanical Hardware & FEA',
    difficulty: 'Advanced',
    readingTime: '6 min read',
    author: 'Chief Admin',
    is_approved: true,
    summary: 'A first-principles physics derivation and non-linear finite element post-mortem analyzing tooth engagement, stress concentrations, and thermal expansion in 115 N·m strain wave gearboxes.',
    content: `## 1. Introduction & Kinematic Principles
Harmonic drives operate via non-rigid mechanical compliance. The flexspline tooth contact ratio is governed by elastomechanical deformation under radial cup loading.

### Governing Equation
The theoretical torsional stiffness $K_t$ is defined by:
$$K_t = \\frac{T}{\\theta_{flex} + \\theta_{spline}}$$

## 2. FEA Stress & von Mises Distribution
Under maximum stall torque (115 N·m), non-linear contacts yield localized stress peaks at the cup diaphragm root radius.

\`\`\`cpp
// Flexspline Deflection Calculation Routine
float calculateDiaphragmDeflection(float torque, float flexModulus) {
    float k_diaphragm = (3.0f * flexModulus * I_radial) / pow(L_cup, 3);
    return torque / k_diaphragm;
}
\`\`\`

## 3. Results & DFM Summary
By substituting Grade 5 Titanium for 17-4 PH Stainless Steel, structural mass was reduced by 34.2% while expanding thermal operating limits to +125°C.`,
    heroMediaUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?q=80&w=1000',
    heroMediaType: 'image',
    likes_count: 42,
    views_count: 310,
    comments_count: 5,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'art_2',
    title: 'ASME Y14.5 GD&T Tolerance Stack-Up Analysis in Flight Gimbals',
    slug: 'asme-gdt-tolerance-stackup',
    category: 'CAD Design & GD&T',
    discipline: 'Optomechanical Assembly',
    difficulty: 'Intermediate',
    readingTime: '4 min read',
    author: 'Chief Admin',
    is_approved: true,
    summary: 'Mathematical worst-case and RSS (Root-Sum-Square) tolerance stack-up formulation ensuring zero-interference bearing alignment under extreme vibration.',
    content: `## 1. Datum Selection & MMC Principles
Proper datum reference frames (DRF) control 6 rotational and translational degrees of freedom.

### RSS Formula
$$T_{rss} = \\sqrt{\\sum_{i=1}^n t_i^2}$$

## 2. Machining Tolerances & Vendor DFM
Applying Maximum Material Condition (MMC) callouts increases allowable position tolerance as feature size departs from maximum material condition.`,
    heroMediaUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1000',
    heroMediaType: 'image',
    likes_count: 28,
    views_count: 185,
    comments_count: 2,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

export const BlogArticlesView: React.FC = () => {
  const { isOwner, bio } = useProfileSync();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSort, setSelectedSort] = useState<'newest' | 'popular' | 'difficulty'>('newest');

  // Detail View State
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [userLikedSet, setUserLikedSet] = useState<Set<string>>(new Set());

  // Post Submission Modal State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Optomechanics');
  const [postDifficulty, setPostDifficulty] = useState<Article['difficulty']>('Intermediate');
  const [postSummary, setPostSummary] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postHeroUrl, setPostHeroUrl] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  // Fetch articles from Supabase
  const fetchArticles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setArticles(data as any);
      } else {
        setArticles(DEFAULT_ARTICLES);
      }
    } catch {
      setArticles(DEFAULT_ARTICLES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();

    const channel = supabase
      .channel('public:articles_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, () => {
        fetchArticles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch comments for active article
  const fetchArticleComments = async (articleId: string) => {
    try {
      const { data, error } = await supabase
        .from('article_comments')
        .select('*')
        .eq('article_id', articleId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setComments(data as any);
      } else {
        setComments([]);
      }
    } catch {
      setComments([]);
    }
  };

  const handleSelectArticle = (art: Article) => {
    setActiveArticle(art);
    fetchArticleComments(art.id);
  };

  const handleToggleLike = async (artId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isLiked = userLikedSet.has(artId);
    const updatedSet = new Set(userLikedSet);
    if (isLiked) {
      updatedSet.delete(artId);
    } else {
      updatedSet.add(artId);
    }
    setUserLikedSet(updatedSet);

    // Update count in UI
    setArticles((prev) =>
      prev.map((a) => (a.id === artId ? { ...a, likes_count: a.likes_count + (isLiked ? -1 : 1) } : a))
    );
    if (activeArticle && activeArticle.id === artId) {
      setActiveArticle((prev) => prev ? { ...prev, likes_count: prev.likes_count + (isLiked ? -1 : 1) } : null);
    }

    try {
      await supabase.rpc('increment_likes', { row_id: artId });
    } catch {}
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArticle || !newCommentText.trim()) return;

    const authorName = commentAuthorName.trim() || (isOwner ? (bio.fullName || 'Chief Admin') : 'Visitor Engineer');
    const newComm: Partial<ArticleComment> = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `comm_${Date.now()}`,
      article_id: activeArticle.id,
      author_name: authorName,
      author_role: isOwner ? 'Chief Admin' : 'Visitor',
      content: newCommentText.trim(),
      is_approved: true,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [...prev, newComm as ArticleComment]);
    setNewCommentText('');

    try {
      await resilientSupabaseUpsert('article_comments', newComm, 'id');
    } catch (err) {
      console.warn('Comment save note:', err);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    try {
      const res = await uploadMaterialToSupabaseBucket(file, file.name);
      if (res.publicUrl) setPostHeroUrl(res.publicUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => setPostHeroUrl((ev.target?.result as string) || '');
      reader.readAsDataURL(file);
    } finally {
      setUploadingHero(false);
    }
  };

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) return;

    setSubmittingPost(true);
    const newArt: Partial<Article> = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `art_${Date.now()}`,
      title: postTitle.trim(),
      slug: postTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      category: postCategory,
      discipline: 'Engineering & Technology',
      difficulty: postDifficulty,
      readingTime: '5 min read',
      author: isOwner ? 'Chief Admin' : 'Visitor Submission',
      is_approved: isOwner, // Admin posts automatically approved, visitor posts require approval
      summary: postSummary.trim() || postTitle.trim(),
      content: postContent.trim(),
      heroMediaUrl: postHeroUrl || 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?q=80&w=1000',
      heroMediaType: 'image',
      likes_count: 0,
      views_count: 1,
      comments_count: 0,
      created_at: new Date().toISOString(),
    };

    try {
      await resilientSupabaseUpsert('articles', newArt, 'id');
      await fetchArticles();
      setIsPostModalOpen(false);
      setPostTitle('');
      setPostSummary('');
      setPostContent('');
      setPostHeroUrl('');
      if (!isOwner) {
        alert('Thank you! Your article submission has been received and sent for Chief Admin approval.');
      }
    } catch (err) {
      console.error('Failed to submit article:', err);
    } finally {
      setSubmittingPost(false);
    }
  };

  // Filter & Search Logic
  const categoriesList = ['All', 'Optomechanics', 'FEA Structural & Thermal', 'CAD Design & GD&T', 'Web Engineering & Tech', 'General Engineering'];

  const filteredArticles = articles.filter((art) => {
    const matchesCategory = selectedCategory === 'All' || art.category === selectedCategory;
    const matchesSearch =
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (selectedSort === 'popular') {
    filteredArticles.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
  } else if (selectedSort === 'newest') {
    filteredArticles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-serif text-slate-800">
      {/* 1. Exact Center-Justified Header Section */}
      <div className="text-center my-4 sm:my-6">
        <div className="inline-block px-4 py-1.5 rounded-xl bg-white/90 border border-slate-300 shadow-2xs">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-950 font-serif">
            Engineering Articles
          </h1>
        </div>
      </div>

      {/* FULL ARTICLE DETAIL PAGE */}
      {activeArticle ? (
        <div className="bg-white/95 border border-slate-300 rounded-2xl p-5 sm:p-8 shadow-sm">
          <button
            onClick={() => setActiveArticle(null)}
            className="inline-flex items-center gap-1.5 text-xs font-sans font-bold text-cyan-900 hover:text-cyan-950 mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Engineering Articles Feed</span>
          </button>

          {/* Article Header Metadata */}
          <div className="border-b border-slate-200 pb-5 mb-6">
            <div className="flex flex-wrap items-center gap-2 text-xs font-sans mb-3">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-900 text-white font-bold text-[10px] uppercase">
                {activeArticle.category}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[10px]">
                {activeArticle.difficulty}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-medium inline-flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3 text-slate-400" />
                {activeArticle.readingTime}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-800 font-bold text-[11px]">Author: {activeArticle.author}</span>
            </div>

            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-950 leading-tight font-serif">
              {activeArticle.title}
            </h1>
          </div>

          {/* Hero Visual Media */}
          {activeArticle.heroMediaUrl && (
            <div className="mb-8 rounded-2xl overflow-hidden border border-slate-300 max-h-96 bg-slate-900">
              <img
                src={activeArticle.heroMediaUrl}
                alt={activeArticle.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* TL;DR Summary Box */}
          <div className="p-4 rounded-xl bg-cyan-50/80 border border-cyan-200 mb-8 font-sans">
            <span className="text-[11px] font-bold text-cyan-900 uppercase tracking-wider block mb-1">
              TL;DR Summary
            </span>
            <p className="text-xs sm:text-sm text-cyan-950 leading-relaxed">{activeArticle.summary}</p>
          </div>

          {/* Body Content */}
          <div className="prose max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed font-serif whitespace-pre-line mb-10">
            {activeArticle.content}
          </div>

          {/* Interactive Comments Section */}
          <div className="pt-8 border-t border-slate-200 font-sans">
            <h3 className="text-base font-bold text-slate-950 mb-4 font-serif">
              Discussion &amp; Comments ({comments.length})
            </h3>

            {/* Comment Submission Form */}
            <form onSubmit={handleAddComment} className="mb-6 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Your Name (Optional)..."
                  value={commentAuthorName}
                  onChange={(e) => setCommentAuthorName(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs outline-none"
                />
              </div>
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  required
                  placeholder="Add your technical perspective or question..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none font-sans"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-900 hover:bg-cyan-800 text-white font-bold text-xs cursor-pointer shrink-0 self-end"
                >
                  Post Comment
                </button>
              </div>
            </form>

            {/* Comments Feed */}
            <div className="space-y-3">
              {comments.map((comm) => (
                <div key={comm.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{comm.author_name}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(comm.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{comm.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* LANDING FEED VIEW */
        <>
          {/* Top Bar: Search Controls, Filter Tags, Post Trigger */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-6 font-sans">
            {/* Search Input with Datalist */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                list="article-suggestions"
                placeholder="Search articles, equations, CAD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white/90 text-xs outline-none focus:ring-2 focus:ring-cyan-800"
              />
              <datalist id="article-suggestions">
                <option value="Harmonic Drive" />
                <option value="ASME Y14.5 GD&T" />
                <option value="FEA Stress Analysis" />
                <option value="Optomechanics" />
                <option value="React Full-Stack" />
              </datalist>
            </div>

            {/* Category Filter Tags */}
            <div className="flex flex-wrap items-center gap-1 max-w-full">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white/80 hover:bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Post Action Button */}
            <button
              onClick={() => setIsPostModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Post Article</span>
            </button>
          </div>

          {/* Articles Feed Cards */}
          {loading ? (
            <div className="py-12 text-center text-xs font-sans text-slate-500">
              Fetching Engineering Articles from Supabase...
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-white/50 p-8">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-700 font-serif">No Articles Found</h3>
              <p className="text-xs text-slate-500 font-sans mt-1">
                Be the first to submit a technical article using the "Post" button above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredArticles.map((art) => {
                const isLiked = userLikedSet.has(art.id);
                return (
                  <div
                    key={art.id}
                    onClick={() => handleSelectArticle(art)}
                    className="bg-white/90 border border-slate-300 hover:border-cyan-700 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      {/* Media Header */}
                      <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                        <img
                          src={art.heroMediaUrl || 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?q=80&w=1000'}
                          alt={art.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-cyan-950/80 backdrop-blur-xs text-cyan-200 text-[10px] font-sans font-bold uppercase">
                          {art.category}
                        </span>
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-slate-200 text-[10px] font-sans">
                          {art.difficulty}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 font-serif">
                        <div className="flex items-center gap-2 text-[11px] font-sans text-slate-500 mb-1.5">
                          <span className="font-bold text-cyan-900">{art.author}</span>
                          <span>•</span>
                          <span>{art.readingTime}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-950 group-hover:text-cyan-950 leading-snug">
                          {art.title}
                        </h3>
                        <p className="text-xs text-slate-600 font-sans mt-1.5 line-clamp-3 leading-relaxed">
                          {art.summary}
                        </p>
                      </div>
                    </div>

                    {/* Footer Stats & Like Action */}
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-sans">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => handleToggleLike(art.id, e)}
                          className={`inline-flex items-center gap-1 font-bold transition-colors ${
                            isLiked ? 'text-rose-600' : 'text-slate-600 hover:text-rose-600'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-600' : ''}`} />
                          <span>{art.likes_count || 0}</span>
                        </button>
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{art.comments_count || 0}</span>
                        </span>
                      </div>

                      <span className="font-bold text-cyan-900 group-hover:text-cyan-950 inline-flex items-center gap-1 text-[11px]">
                        <span>Read Full Post</span>
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SUBMISSION / POST MODAL */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-300 max-h-[90vh] overflow-y-auto p-5 font-serif text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-lg font-bold font-serif text-slate-950">Submit Engineering Article</h2>
              <button
                onClick={() => setIsPostModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateArticle} className="space-y-3 text-xs font-sans mt-4">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Article Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Non-linear Contact Analysis in Optomechanical Assemblies"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-serif outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Category</label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white outline-none"
                  >
                    {categoriesList.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Difficulty Level</label>
                  <select
                    value={postDifficulty}
                    onChange={(e) => setPostDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white outline-none"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Short Executive Summary / TL;DR</label>
                <textarea
                  rows={2}
                  placeholder="Brief overview of technical takeaways..."
                  value={postSummary}
                  onChange={(e) => setPostSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none font-serif"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Full Article Content (Markdown, LaTeX & Code supported) *</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Write your article markdown here..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Hero Image / Media URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://..."
                    value={postHeroUrl}
                    onChange={(e) => setPostHeroUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs outline-none"
                  />
                  <label className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs cursor-pointer inline-flex items-center gap-1 shrink-0">
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" onChange={handleHeroUpload} className="hidden" />
                  </label>
                </div>
                {uploadingHero && <span className="text-[10px] text-cyan-800 block mt-1">Uploading hero media...</span>}
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPost}
                  className="px-5 py-2 rounded-xl bg-cyan-900 hover:bg-cyan-800 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {submittingPost ? 'Submitting Article...' : isOwner ? 'Publish Article' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
