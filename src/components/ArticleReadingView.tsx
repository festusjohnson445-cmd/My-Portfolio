import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Heart,
  Share2,
  Clock,
  Calendar,
  MessageSquare,
  Check,
  Send,
  User,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ArticleItem, ArticleComment } from '../types/extendedPortfolio';
import {
  fetchArticleComments,
  submitArticleComment,
  toggleArticleLike,
  isArticleLikedByUser,
} from '../utils/projectsBlogStorage';
import { useProfileSync } from '../utils/profileState';

interface ArticleReadingViewProps {
  article: ArticleItem;
  allArticles?: ArticleItem[];
  onBack: () => void;
  onSelectArticle?: (art: ArticleItem) => void;
}

export const ArticleReadingView: React.FC<ArticleReadingViewProps> = ({
  article,
  allArticles = [],
  onBack,
  onSelectArticle,
}) => {
  const { isOwner } = useProfileSync();
  const [visitorId] = useState<string>(() => {
    let id = localStorage.getItem('fesline_current_visitor_id');
    if (!id) {
      id = `vis_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('fesline_current_visitor_id', id);
    }
    return id;
  });

  const [likesCount, setLikesCount] = useState<number>(article.likes_count || 0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentNotice, setCommentNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    isArticleLikedByUser(article.id, visitorId).then(setHasLiked);
    fetchArticleComments(article.id, isOwner).then((c) => {
      setComments(c);
      setLoadingComments(false);
    });
  }, [article.id, visitorId, isOwner]);

  const handleToggleLike = async () => {
    const res = await toggleArticleLike(article.id, visitorId);
    setHasLiked(res.liked);
    setLikesCount(res.count);
  };

  const handleShare = (platform?: 'twitter' | 'linkedin' | 'whatsapp') => {
    const url = window.location.href;
    const text = `${article.title} · by ${article.author_name}`;

    if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'linkedin') {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    setIsSubmittingComment(true);
    try {
      const author = isOwner
        ? 'Festus, Olorunsogo Johnson (Chief Admin)'
        : commentAuthor.trim() || 'Visitor';

      const newComm = await submitArticleComment({
        article_id: article.id,
        author_name: author,
        content: commentContent.trim(),
        isOwner,
      });

      setComments((prev) => [...prev, newComm]);
      setCommentContent('');
      if (!isOwner) setCommentAuthor('');
      setCommentNotice('Thank you! Your comment has been posted.');
      setTimeout(() => setCommentNotice(null), 4000);
    } catch (err: any) {
      setCommentNotice('Failed to post comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Related articles (same category or recent)
  const related = allArticles
    .filter((a) => a.id !== article.id)
    .slice(0, 3);

  // Render markdown-like or formatted text with code blocks and paragraphs
  const renderFormattedContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const firstLine = lines[0] || '';
        const lang = /^[a-zA-Z0-9_-]+$/.test(firstLine) ? firstLine : '';
        const codeText = lang ? lines.slice(1).join('\n') : lines.join('\n');
        return (
          <pre key={idx} className="my-4 p-3 rounded-lg bg-slate-900 text-cyan-200 text-xs font-mono overflow-x-auto border border-slate-700 shadow-sm">
            <code>{codeText}</code>
          </pre>
        );
      }
      return (
        <div key={idx} className="space-y-3">
          {part.split('\n\n').map((para, pIdx) => {
            const clean = para.trim();
            if (!clean) return null;
            if (clean.startsWith('### ')) {
              return (
                <h3 key={pIdx} className="text-base sm:text-lg font-bold text-slate-900 mt-4 mb-2 font-serif text-center">
                  {clean.replace('### ', '')}
                </h3>
              );
            }
            if (clean.startsWith('## ')) {
              return (
                <h2 key={pIdx} className="text-lg sm:text-xl font-bold text-slate-900 mt-5 mb-2 font-serif text-center">
                  {clean.replace('## ', '')}
                </h2>
              );
            }
            if (clean.startsWith('# ')) {
              return (
                <h1 key={pIdx} className="text-xl sm:text-2xl font-bold text-slate-950 mt-6 mb-3 font-serif text-center">
                  {clean.replace('# ', '')}
                </h1>
              );
            }
            return (
              <p key={pIdx} className="text-xs sm:text-sm text-slate-800 leading-relaxed font-serif">
                {clean}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="w-full font-serif text-slate-800 pb-16 animate-fade-in">
      {/* Top Nav Bar */}
      <div className="bg-[#e4ebf3] border-b border-[#b8c6d4] py-2 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-800" />
            <span>Back to Articles</span>
          </button>

          {/* Social Share & Likes Action */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleLike}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer border ${
                hasLiked
                  ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title="Like this article"
            >
              <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
              <span className="text-[11px]">{likesCount}</span>
            </button>

            <button
              onClick={() => handleShare()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs cursor-pointer"
              title="Copy link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-600" />}
              <span className="text-[11px]">{copiedLink ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Article Header */}
        <div className="text-center space-y-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-900/10 text-cyan-900 border border-cyan-800/30 text-[10px] font-sans font-bold uppercase tracking-wider">
            {article.category || 'Mechanical Engineering'}
          </span>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-950 font-serif leading-tight text-center">
            {article.title}
          </h1>

          {/* Metadata & Author Badge */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 font-sans pt-1">
            <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-0.5 rounded-full border border-slate-300 shadow-2xs">
              <User className="w-3 h-3 text-cyan-800" />
              <span className="font-semibold text-slate-900">{article.author_name}</span>
              {/* REQUIREMENT: "always specific owner post with a small base text 'Chief Admin'" */}
              {(article.is_chief_admin || article.author_role?.includes('Chief Admin')) && (
                <span className="px-1.5 py-0.2 rounded bg-cyan-900 text-white text-[9px] font-bold tracking-wide">
                  Chief Admin
                </span>
              )}
            </div>

            <span className="text-slate-400">•</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{article.created_at ? new Date(article.created_at).toLocaleDateString() : 'Recent'}</span>
            </span>

            <span className="text-slate-400">•</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{article.reading_time || '4 min read'}</span>
            </span>
          </div>
        </div>

        {/* Cover Image */}
        {article.cover_image && (
          <div className="rounded-xl overflow-hidden border border-[#b8c6d4] shadow-sm max-h-96 bg-slate-100 flex items-center justify-center">
            <img src={article.cover_image} alt={article.title} className="w-full h-full object-cover max-h-96" />
          </div>
        )}

        {/* Excerpt if present */}
        {article.excerpt && (
          <div className="p-3.5 rounded-lg bg-[#eaf0f8] border-l-3 border-cyan-800 text-xs sm:text-sm text-slate-700 italic">
            {article.excerpt}
          </div>
        )}

        {/* Rich Article Body */}
        <div className="p-5 sm:p-7 rounded-xl bg-white border border-[#b8c6d4] shadow-2xs space-y-4">
          {renderFormattedContent(article.content)}
        </div>

        {/* Social Sharing Strip */}
        <div className="p-3 rounded-lg bg-white border border-[#b8c6d4] flex flex-wrap items-center justify-between gap-2 text-xs font-sans">
          <span className="text-slate-600 font-semibold text-[11px]">Share this publication:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleShare('twitter')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium cursor-pointer"
            >
              Twitter / X
            </button>
            <button
              onClick={() => handleShare('linkedin')}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium cursor-pointer"
            >
              LinkedIn
            </button>
            <button
              onClick={() => handleShare('whatsapp')}
              className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-medium cursor-pointer"
            >
              WhatsApp
            </button>
            <button
              onClick={() => handleShare()}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-medium cursor-pointer"
            >
              Copy Link
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="p-5 sm:p-6 rounded-xl bg-white border border-[#b8c6d4] shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-slate-950 font-serif flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-cyan-800" />
              <span>Discussion &amp; Comments ({comments.length})</span>
            </h3>
          </div>

          {/* Comment submission form */}
          <form onSubmit={handleCommentSubmit} className="space-y-2">
            {commentNotice && (
              <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-sans">
                {commentNotice}
              </div>
            )}
            {!isOwner && (
              <input
                type="text"
                placeholder="Your name or affiliation (optional)"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                className="w-full sm:w-64 p-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-cyan-800"
              />
            )}
            <textarea
              required
              rows={3}
              placeholder="Join the discussion or share technical insights..."
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-cyan-800 font-serif"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingComment}
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{isSubmittingComment ? 'Posting...' : 'Post Comment'}</span>
              </button>
            </div>
          </form>

          {/* Comments list */}
          <div className="divide-y divide-slate-100 pt-2">
            {loadingComments ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 italic">
                No comments yet. Start the conversation!
              </div>
            ) : (
              comments.map((comm) => (
                <div key={comm.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-sans">
                    <span className="font-bold text-slate-900">{comm.author_name}</span>
                    <span className="text-slate-400 text-[10px]">
                      {comm.created_at ? new Date(comm.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-serif">
                    {comm.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Related Articles */}
        {related.length > 0 && (
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-bold text-slate-900 font-serif text-center">
              Related Articles &amp; Insights
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {related.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => onSelectArticle && onSelectArticle(rel)}
                  className="p-3 rounded-lg bg-white border border-[#b8c6d4] hover:border-cyan-800 shadow-2xs transition-colors cursor-pointer space-y-1"
                >
                  <span className="text-[10px] text-cyan-900 font-bold block">{rel.category}</span>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{rel.title}</h4>
                  <span className="text-[10px] text-slate-500 font-sans block">{rel.reading_time || '4 min'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};
