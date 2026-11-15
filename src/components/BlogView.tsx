import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowRight,
  BookOpen,
  Clock,
  User,
  Heart,
  Eye,
  Share2,
  Check,
  Copy,
  X,
  Upload,
  MessageSquare,
  FileText,
  Code,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { useProfileSync } from '../utils/profileState';
import {
  fetchArticlesFromSupabase,
  submitArticleToSupabase,
  likeArticleInSupabase,
  incrementArticleViews,
  fetchArticleComments,
  postArticleComment,
  type ArticleRecord,
  type ArticleCommentRecord,
} from '../utils/supabaseExtended';
import { uploadMaterialToSupabaseBucket } from '../utils/supabase';

interface BlogViewProps {
  onSelectArticle?: (article: ArticleRecord) => void;
}

export const BlogView: React.FC<BlogViewProps> = () => {
  const { isOwner } = useProfileSync();
  const [articles, setArticles] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [activeArticle, setActiveArticle] = useState<ArticleRecord | null>(null);

  // Search input suggestions state
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);

  // "Post" Article Modal State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postNotice, setPostNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Post Article Form Fields - DO NOT automatically populate text in any input fields
  const [postTitle, setPostTitle] = useState('');
  const [postSummary, setPostSummary] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postCategory, setPostCategory] = useState('');
  const [postDifficulty, setPostDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'>('Intermediate');
  const [postAuthorName, setPostAuthorName] = useState('');
  const [postAuthorEmail, setPostAuthorEmail] = useState('');
  const [postThumbnailUrl, setPostThumbnailUrl] = useState('');
  const [postHeroMediaType, setPostHeroMediaType] = useState<'image' | 'video' | 'diagram' | 'cad_3d'>('image');
  const [postHeroMediaUrl, setPostHeroMediaUrl] = useState('');
  const [postTldr, setPostTldr] = useState('');
  const [postCodeSnippet, setPostCodeSnippet] = useState('');
  const [postCodeLang, setPostCodeLang] = useState('python');
  const [postEquationLatex, setPostEquationLatex] = useState('');
  const [postEquationLabel, setPostEquationLabel] = useState('');
  const [postAttachmentUrl, setPostAttachmentUrl] = useState('');
  const [postAttachmentName, setPostAttachmentName] = useState('');

  // Active Reading Page States
  const [comments, setComments] = useState<ArticleCommentRecord[]>([]);
  const [newCommentName, setNewCommentName] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [currentLikes, setCurrentLikes] = useState(0);

  // Load articles from Supabase
  const loadArticles = async () => {
    setLoading(true);
    // Show approved to public, or all if owner
    const data = await fetchArticlesFromSupabase(isOwner);
    setArticles(data);
    setLoading(false);
  };

  useEffect(() => {
    loadArticles();
  }, [isOwner]);

  // Handle opening an article reading page
  const handleOpenArticle = async (art: ArticleRecord) => {
    setActiveArticle(art);
    setCurrentLikes(art.likes_count || 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Increment views counter
    incrementArticleViews(art.id).catch(() => {});

    // Fetch comments
    const cms = await fetchArticleComments(art.id);
    setComments(cms);
  };

  // Categories & Suggestions list
  const categoryList = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.category) set.add(a.category);
    });
    return ['All', ...Array.from(set)];
  }, [articles]);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const suggestions: string[] = [];
    articles.forEach((a) => {
      if (a.title.toLowerCase().includes(q) && !suggestions.includes(a.title)) {
        suggestions.push(a.title);
      }
      if (a.category.toLowerCase().includes(q) && !suggestions.includes(a.category)) {
        suggestions.push(a.category);
      }
    });
    return suggestions.slice(0, 5);
  }, [articles, searchQuery]);

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
      const matchesDifficulty = selectedDifficulty === 'All' || a.difficulty === selectedDifficulty;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return matchesCategory && matchesDifficulty && matchesSearch;
    });
  }, [articles, selectedCategory, selectedDifficulty, searchQuery]);

  // Handle Like
  const handleLike = async () => {
    if (!activeArticle) return;
    const userIdentifier = localStorage.getItem('fesline_user_fingerprint') || 'visitor_' + Date.now();
    localStorage.setItem('fesline_user_fingerprint', userIdentifier);
    const res = await likeArticleInSupabase(activeArticle.id, userIdentifier);
    setHasLiked(res.hasLiked);
    setCurrentLikes(res.likes);
  };

  // Handle New Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeArticle || !newCommentText.trim()) return;

    setIsSubmittingComment(true);
    const commentRecord = await postArticleComment({
      article_id: activeArticle.id,
      author_name: newCommentName.trim() || (isOwner ? 'Festus Johnson' : 'Visitor Engineer'),
      content: newCommentText.trim(),
      is_chief_admin: isOwner,
    });

    if (commentRecord) {
      setComments((prev) => [...prev, commentRecord]);
      setNewCommentText('');
    }
    setIsSubmittingComment(false);
  };

  // File Upload helper
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetField: 'thumbnail' | 'attachment') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await uploadMaterialToSupabaseBucket(file, file.name);
      if (targetField === 'thumbnail') {
        setPostThumbnailUrl(res.publicUrl);
        if (!postHeroMediaUrl) setPostHeroMediaUrl(res.publicUrl);
      } else {
        setPostAttachmentUrl(res.publicUrl);
        setPostAttachmentName(file.name);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (targetField === 'thumbnail') {
          setPostThumbnailUrl(dataUrl);
          if (!postHeroMediaUrl) setPostHeroMediaUrl(dataUrl);
        } else {
          setPostAttachmentUrl(dataUrl);
          setPostAttachmentName(file.name);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Handle Submit New Article
  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postContent.trim()) {
      setFormError('Article title and content are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    // Code blocks & equations structures
    const codeBlocks = postCodeSnippet.trim()
      ? [{ language: postCodeLang, title: 'Code Implementation', code: postCodeSnippet.trim() }]
      : [];

    const equations = postEquationLatex.trim()
      ? [{ label: postEquationLabel.trim() || 'Eq. 1', latex: postEquationLatex.trim(), description: 'Mathematical Formula' }]
      : [];

    const attachments = postAttachmentUrl
      ? [{ name: postAttachmentName || 'Technical Attachment', url: postAttachmentUrl, size: 'Document', type: 'file' }]
      : [];

    const payload: Partial<ArticleRecord> = {
      title: postTitle.trim(),
      summary: postSummary.trim(),
      content: postContent.trim(),
      category: postCategory.trim() || 'General Engineering',
      difficulty: postDifficulty,
      author_name: postAuthorName.trim() || (isOwner ? 'Festus, Olorunsogo Johnson' : 'Visitor Author'),
      author_email: postAuthorEmail.trim(),
      author_role: isOwner ? 'Lead Mechanical Engineer' : 'Contributing Engineer',
      is_chief_admin: isOwner,
      thumbnail_url: postThumbnailUrl.trim(),
      hero_media_type: postHeroMediaType,
      hero_media_url: postHeroMediaUrl.trim() || postThumbnailUrl.trim(),
      tldr: postTldr.trim(),
      code_blocks: codeBlocks,
      equations: equations,
      attachments: attachments,
    };

    const res = await submitArticleToSupabase(payload, isOwner);
    if (res.success) {
      await loadArticles();
      setIsPostModalOpen(false);
      setPostNotice(
        isOwner
          ? 'Article published successfully!'
          : 'Thank you! Your article submission has been received and is pending administrator approval.'
      );
      setTimeout(() => setPostNotice(null), 6000);

      // Reset form
      setPostTitle('');
      setPostSummary('');
      setPostContent('');
      setPostCategory('');
      setPostDifficulty('Intermediate');
      setPostAuthorName('');
      setPostAuthorEmail('');
      setPostThumbnailUrl('');
      setPostHeroMediaUrl('');
      setPostTldr('');
      setPostCodeSnippet('');
      setPostEquationLatex('');
      setPostEquationLabel('');
      setPostAttachmentUrl('');
      setPostAttachmentName('');
    } else {
      setFormError(res.error || 'Failed to submit article.');
    }
    setIsSubmitting(false);
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex-1 w-full flex flex-col font-serif text-slate-900 bg-[#dce1e8] py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col">
        
        {/* ======================================================== */}
        {/* MAIN HEADING: Small, Well-Designed Div Container Without Subtext */}
        {/* ======================================================== */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-xl bg-white border border-[#b4c2d1] shadow-2xs">
            <h1 className="text-base sm:text-lg font-bold text-slate-950 font-serif tracking-tight text-center">
              Engineering Articles
            </h1>
          </div>
        </div>

        {/* Global Notice Toast */}
        {postNotice && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-serif text-center shadow-xs">
            {postNotice}
          </div>
        )}

        {/* ======================================================== */}
        {/* DEDICATED FULL ARTICLE READING VIEW                      */}
        {/* ======================================================== */}
        {activeArticle ? (
          <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Back Button */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveArticle(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                <span>Back to Articles</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLike}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    hasLiked
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50 hover:text-rose-700'
                  }`}
                  title="Like article"
                >
                  <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
                  <span>{currentLikes}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-cyan-800 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  title="Share article link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Share'}</span>
                </button>
              </div>
            </div>

            {/* Main Article Container */}
            <article className="p-6 sm:p-9 bg-white rounded-2xl border border-slate-300 shadow-sm space-y-6 font-serif">
              
              {/* 1. Article Metadata Header */}
              <div className="border-b border-slate-200 pb-5 space-y-2.5 text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px] font-sans font-bold">
                    {activeArticle.category}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-sans font-bold">
                    {activeArticle.difficulty}
                  </span>
                  {activeArticle.is_chief_admin && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-sans font-bold inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-700" />
                      <span>Chief Admin</span>
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-3xl font-bold text-slate-950 font-serif leading-tight">
                  {activeArticle.title}
                </h1>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-600 font-sans">
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                    <User className="w-3.5 h-3.5 text-cyan-800" />
                    <span>{activeArticle.author_name}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeArticle.reading_time || '5 min read'}</span>
                  </span>
                  <span>{new Date(activeArticle.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{activeArticle.views_count || 1} views</span>
                  </span>
                </div>
              </div>

              {/* 2. Flexible Visual Hero */}
              {(activeArticle.hero_media_url || activeArticle.thumbnail_url) && (
                <div className="w-full max-h-96 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 flex items-center justify-center shadow-xs">
                  <img
                    src={activeArticle.hero_media_url || activeArticle.thumbnail_url}
                    alt={activeArticle.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* 3. TL;DR Summary Box */}
              {activeArticle.tldr && (
                <div className="p-4 rounded-xl bg-cyan-50/70 border border-cyan-200/90 text-xs sm:text-[13px] text-cyan-950 space-y-1">
                  <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-cyan-900 block">
                    TL;DR Summary
                  </span>
                  <p className="leading-relaxed font-serif text-justify">
                    {activeArticle.tldr}
                  </p>
                </div>
              )}

              {/* 4. Article Rich Content & Paragraphs */}
              <div className="prose max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed font-serif space-y-4 text-justify">
                {activeArticle.content.split('\n\n').map((paragraph, idx) => (
                  <p key={idx} className="whitespace-pre-line leading-relaxed text-justify">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* 5. LaTeX Mathematical Equations */}
              {activeArticle.equations && activeArticle.equations.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    Mathematical Equations &amp; Analytical Proofs
                  </h3>
                  <div className="space-y-2">
                    {activeArticle.equations.map((eq, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                        <div>
                          <span className="text-[10px] font-sans font-bold text-slate-500 uppercase">{eq.label}</span>
                          <div className="text-sm sm:text-base font-serif font-bold text-slate-950 tracking-wider font-mono py-1">
                            {eq.latex}
                          </div>
                          {eq.description && (
                            <span className="text-[11px] text-slate-600 font-serif italic">{eq.description}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Copyable Code Blocks */}
              {activeArticle.code_blocks && activeArticle.code_blocks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    Implementation Code
                  </h3>
                  {activeArticle.code_blocks.map((cb, idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-200 font-mono text-xs">
                      <div className="px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase">{cb.language || 'Code'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(cb.code);
                            setCopiedCodeIndex(idx);
                            setTimeout(() => setCopiedCodeIndex(null), 2000);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedCodeIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCodeIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="p-3.5 overflow-x-auto text-[11px] leading-relaxed">
                        <code>{cb.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              {/* 7. Downloadable Attachments */}
              {activeArticle.attachments && activeArticle.attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                    Technical Files &amp; Attachments
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {activeArticle.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-serif font-bold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-cyan-800" />
                        <span>{att.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 8. Comments Section */}
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold font-serif text-slate-950 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-cyan-800" />
                    <span>Discussion &amp; Feedback ({comments.length})</span>
                  </h3>
                </div>

                {/* Comment Form */}
                <form onSubmit={handlePostComment} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Your Name (Optional)"
                      value={newCommentName}
                      onChange={(e) => setNewCommentName(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    placeholder="Write a technical inquiry or peer review comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingComment}
                      className="px-3.5 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                    >
                      {isSubmittingComment ? 'Submitting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-2.5">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-500 font-serif italic text-center py-2">
                      No comments posted yet. Be the first to start the discussion!
                    </p>
                  ) : (
                    comments.map((comm) => (
                      <div key={comm.id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 font-serif flex items-center gap-1">
                            <span>{comm.author_name}</span>
                            {comm.is_chief_admin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-sans font-bold">
                                Chief Admin
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            {new Date(comm.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-800 font-serif whitespace-pre-line leading-relaxed">
                          {comm.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </article>
          </div>
        ) : (
          /* ======================================================== */
          /* ARTICLES LIST / CARDS VIEW                               */
          /* ======================================================== */
          <div className="w-full space-y-6">
            
            {/* Filter / Search Bar / "Post" Button */}
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-[#b8c6d4] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Search Box with Suggestions */}
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search articles, keywords, topics..."
                  value={searchQuery}
                  onFocus={() => setSearchSuggestionsOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchSuggestionsOpen(true);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                />

                {/* Suggestions Dropdown */}
                {searchSuggestionsOpen && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-lg p-1.5 z-30 font-serif">
                    {searchSuggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSearchQuery(sug);
                          setSearchSuggestionsOpen(false);
                        }}
                        className="w-full text-left px-2.5 py-1 text-xs hover:bg-slate-100 rounded text-slate-800 cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category, Difficulty & Post Button */}
              <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                {/* Category Dropdown */}
                {categoryList.length > 1 && (
                  <div className="flex items-center gap-1 text-xs">
                    <Filter className="w-3 h-3 text-slate-500" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-[#f8fafc] border border-slate-300 rounded-lg text-slate-800 font-serif focus:outline-none focus:ring-1 focus:ring-cyan-800 cursor-pointer"
                    >
                      {categoryList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Difficulty Filter */}
                <div className="flex items-center gap-1 text-xs">
                  <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                  <select
                    value={selectedDifficulty}
                    onChange={(e) => setSelectedDifficulty(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-[#f8fafc] border border-slate-300 rounded-lg text-slate-800 font-serif focus:outline-none focus:ring-1 focus:ring-cyan-800 cursor-pointer"
                  >
                    <option value="All">All Levels</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>

                {/* "Post" as a small button for creating new articles */}
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer shrink-0"
                  title="Create and submit a new article"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </div>
            </div>

            {/* Articles Cards Grid */}
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-500 bg-white/70 rounded-2xl border border-slate-300">
                Loading engineering articles...
              </div>
            ) : filteredArticles.length === 0 ? (
              /* Empty by default without dummy/self-generated content */
              <div className="p-10 sm:p-14 text-center bg-white/80 rounded-2xl border border-slate-300 max-w-xl mx-auto shadow-2xs">
                <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-950 font-serif text-center">
                  No Articles Published Yet
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto text-center font-serif leading-relaxed">
                  The engineering articles repository is ready for publications and technical whitepapers from visitors and the administrator.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post First Article</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    onClick={() => handleOpenArticle(article)}
                    className="rounded-2xl bg-white border border-slate-300 hover:border-cyan-800 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer group"
                  >
                    <div>
                      {/* High Quality Thumbnail Image at the Top Where Available */}
                      {article.thumbnail_url ? (
                        <div className="w-full h-40 bg-slate-100 overflow-hidden relative border-b border-slate-200">
                          <img
                            src={article.thumbnail_url}
                            alt={article.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-24 bg-gradient-to-r from-slate-100 to-slate-200 border-b border-slate-200 flex items-center justify-center text-slate-400">
                          <BookOpen className="w-6 h-6" />
                        </div>
                      )}

                      {/* Card Body */}
                      <div className="p-4 sm:p-4.5 space-y-2">
                        {/* Discipline/Category Tags & Difficulty Badge */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-900 text-[9.5px] font-sans font-bold border border-cyan-200">
                            {article.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9.5px] font-sans font-bold border border-slate-200">
                            {article.difficulty}
                          </span>
                          {article.is_chief_admin && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[9.5px] font-sans font-bold border border-emerald-300">
                              Chief Admin
                            </span>
                          )}
                        </div>

                        {/* Article Title */}
                        <h3 className="text-sm sm:text-base font-bold text-slate-950 font-serif leading-snug group-hover:text-cyan-900 transition-colors">
                          {article.title}
                        </h3>

                        {/* Short Summary */}
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-serif">
                          {article.summary || article.content}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer: Reading Time, Author Tag */}
                    <div className="p-4 sm:p-4.5 pt-0 border-t border-slate-100 flex items-center justify-between mt-3 text-xs text-slate-500 font-sans">
                      <div className="flex items-center gap-1.5 truncate pr-2">
                        <User className="w-3 h-3 text-cyan-800 shrink-0" />
                        <span className="truncate font-medium">{article.author_name}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{article.reading_time || '5 min read'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>

      {/* ======================================================== */}
      {/* "POST" ARTICLE SUBMISSION MODAL                          */}
      {/* ======================================================== */}
      {isPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-5 py-3 border-b border-slate-200 bg-[#edf2f8] flex items-center justify-between shrink-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-950 font-serif text-center w-full">
                Post Engineering Article
              </h2>
              <button
                type="button"
                onClick={() => setIsPostModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer absolute right-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateArticle} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-serif">
              
              {!isOwner && (
                <div className="p-2.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs font-serif">
                  Note: Visitor submissions require administrator review before publication on the live site.
                </div>
              )}

              {formError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-sans text-center">
                  {formError}
                </div>
              )}

              {/* Title - DO NOT automatically populate text in any input fields */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Article Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter article title..."
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                />
              </div>

              {/* Summary */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Short Summary</label>
                <textarea
                  rows={2}
                  placeholder="Concise overview for the article card..."
                  value={postSummary}
                  onChange={(e) => setPostSummary(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                />
              </div>

              {/* Category (User input / datalist) & Difficulty Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Discipline / Category</label>
                  <input
                    type="text"
                    list="article-category-suggestions"
                    placeholder="Type or pick category..."
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                  />
                  <datalist id="article-category-suggestions">
                    <option value="Mechanical & Optomechanical Design" />
                    <option value="Structural & Thermal FEA" />
                    <option value="ASME Y14.5 GD&T & Metrology" />
                    <option value="CNC Machining & DFM/DFA" />
                    <option value="Mechatronics & Robotics" />
                    <option value="Materials Science & Composites" />
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Difficulty Level</label>
                  <select
                    value={postDifficulty}
                    onChange={(e) => setPostDifficulty(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif cursor-pointer"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                  </select>
                </div>
              </div>

              {/* Author Info */}
              {!isOwner && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Author Name</label>
                    <input
                      type="text"
                      placeholder="Your name or organization..."
                      value={postAuthorName}
                      onChange={(e) => setPostAuthorName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Author Email (Confidential)</label>
                    <input
                      type="email"
                      placeholder="Contact email for approvals..."
                      value={postAuthorEmail}
                      onChange={(e) => setPostAuthorEmail(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                    />
                  </div>
                </div>
              )}

              {/* Thumbnail Image: File Upload OR URL */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Thumbnail Image (Upload File or Enter URL)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://... image URL"
                    value={postThumbnailUrl}
                    onChange={(e) => setPostThumbnailUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                  />
                  <label className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer text-slate-700 text-xs font-sans font-semibold inline-flex items-center gap-1 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'thumbnail')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* TL;DR Summary */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">TL;DR Summary Box (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Key takeaway in 1-2 sentences..."
                  value={postTldr}
                  onChange={(e) => setPostTldr(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                />
              </div>

              {/* Article Main Content (Rich Text / Technical Formatting) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Article Content *</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Enter full technical article text, methodology, observations, equations..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                />
              </div>

              {/* Optional Mathematical Equation */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 block">Mathematical Formula (LaTeX / Math Notation)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Eq. Label (e.g. Eq. 1)"
                    value={postEquationLabel}
                    onChange={(e) => setPostEquationLabel(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                  />
                  <input
                    type="text"
                    placeholder="\sigma_{vm} = \sqrt{\sigma_1^2 - \sigma_1\sigma_2 + \sigma_2^2}"
                    value={postEquationLatex}
                    onChange={(e) => setPostEquationLatex(e.target.value)}
                    className="sm:col-span-2 px-2.5 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Optional Code Block */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 block">Copyable Code Block</span>
                <textarea
                  rows={3}
                  placeholder="Paste Python, C++, or MATLAB code snippet here..."
                  value={postCodeSnippet}
                  onChange={(e) => setPostCodeSnippet(e.target.value)}
                  className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-mono text-[11px]"
                />
              </div>

              {/* Technical Attachment (File or URL) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Technical Attachment / Whitepaper Document</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="File URL or upload"
                    value={postAttachmentUrl}
                    onChange={(e) => setPostAttachmentUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
                  />
                  <label className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 cursor-pointer text-slate-700 text-xs font-sans font-semibold inline-flex items-center gap-1 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Doc</span>
                    <input
                      type="file"
                      accept=".pdf,.step,.stp,.zip"
                      onChange={(e) => handleFileUpload(e, 'attachment')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-sans font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white font-sans font-bold text-xs transition-colors shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Post Article'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
