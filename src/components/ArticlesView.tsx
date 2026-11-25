import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ArrowLeft,
  Clock,
  Heart,
  Share2,
  Download,
  Copy,
  Check,
  MessageSquare,
  Edit3,
  Trash2,
  Send,
  FileText,
  Compass,
  BarChart3,
  Table as TableIcon,
  ShieldCheck,
  Plus,
  Play,
  X,
  Eye,
} from 'lucide-react';
import {
  fetchArticlesFromSupabase,
  deleteArticleFromSupabase,
  updateArticleHeroInscription,
  toggleArticleLikeInSupabase,
  incrementArticleViewsInSupabase,
  subscribeToArticlesRealtime,
  fetchCommentsForArticle,
  getCachedCommentsForArticle,
  submitArticleComment,
  moderateCommentInSupabase,
  deleteCommentFromSupabase,
  useWebsiteSettingsSync,
  getCachedArticles,
  hasArticlesCacheHydrated,
  EVENT_ARTICLES_UPDATED,
  type PortfolioArticle,
  type ArticleComment,
} from '../utils/portfolioSupabase';
import { useProfileSync } from '../utils/profileState';
import { Interactive3DViewer } from './Interactive3DViewer';
import { ArticleFormPanel } from './ArticleFormPanel';
import { CleanVideoPlayer } from './CleanVideoPlayer';
import { LiveRelativeTime } from './LiveRelativeTime';
import {
  extractHtmlHeadings,
  isRichHtmlContent,
  sanitizeArticleHtml,
} from '../utils/htmlSanitizer';
import {
  getContainerWidthClassForAspect,
  getImageFitClass,
  getMediaImgStyle,
} from '../utils/mediaCardStyle';
import {
  buildArticleSeoMetadata,
  getPageSeoMetadata,
} from '../seo/metadata';
import { applyClientSeoMetadata } from '../seo/clientMeta';

function slugHeadingId(heading: string, idx: number): string {
  const clean = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `sec-${idx}-${clean || 'section'}`;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Handle **bold**, `code`, and inline links [label](url) safely
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**')) {
      return <strong key={i} className="font-bold text-slate-950">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith('`') && tok.endsWith('`')) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-cyan-900">
          {tok.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={i}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-800 underline hover:text-cyan-950"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={i}>{tok}</React.Fragment>;
  });
}

const ArticleMarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const richHtml = useMemo(() => {
    if (!isRichHtmlContent(content)) return null;
    return sanitizeArticleHtml(content);
  }, [content]);

  const blocks = useMemo(() => {
    if (richHtml !== null) return [];
    const lines = content.split('\n');
    const out: Array<
      | { type: 'heading'; level: number; text: string; id: string }
      | { type: 'code'; lang: string; code: string }
      | { type: 'equation'; expr: string }
      | { type: 'table'; headers: string[]; rows: string[][] }
      | { type: 'list'; ordered: boolean; items: string[] }
      | { type: 'paragraph'; text: string }
    > = [];

    let i = 0;
    let headingCounter = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // Fenced code block
      if (trimmed.startsWith('```')) {
        const lang = trimmed.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        out.push({ type: 'code', lang, code: codeLines.join('\n') });
        continue;
      }

      // Block equation $$ ... $$
      if (trimmed.startsWith('$$')) {
        if (trimmed.endsWith('$$') && trimmed.length > 4) {
          out.push({ type: 'equation', expr: trimmed.slice(2, -2).trim() });
          i++;
          continue;
        }
        const eqLines: string[] = [trimmed.slice(2)];
        i++;
        while (i < lines.length && !lines[i].trim().endsWith('$$')) {
          eqLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          eqLines.push(lines[i].trim().slice(0, -2));
          i++;
        }
        out.push({ type: 'equation', expr: eqLines.join('\n').trim() });
        continue;
      }

      // Heading
      const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const hText = hMatch[2].trim();
        out.push({ type: 'heading', level, text: hText, id: slugHeadingId(hText, headingCounter++) });
        i++;
        continue;
      }

      // Markdown table
      if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && lines[i + 1].includes('-')) {
        const parseRow = (r: string) =>
          r
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((c) => c.trim());
        const headers = parseRow(trimmed);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          rows.push(parseRow(lines[i]));
          i++;
        }
        out.push({ type: 'table', headers, rows });
        continue;
      }

      // Unordered / Ordered list
      if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const ordered = /^\d+\.\s+/.test(trimmed);
        const items: string[] = [];
        while (
          i < lines.length &&
          (ordered ? /^\d+\.\s+/.test(lines[i].trim()) : /^[-*•]\s+/.test(lines[i].trim()))
        ) {
          items.push(lines[i].trim().replace(/^([-*•]|\d+\.)\s+/, ''));
          i++;
        }
        out.push({ type: 'list', ordered, items });
        continue;
      }

      // Paragraph accumulation
      const pLines: string[] = [trimmed];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,3}\s+|```|\$\$|\||[-*•]\s+|\d+\.\s+)/.test(lines[i].trim())
      ) {
        pLines.push(lines[i].trim());
        i++;
      }
      out.push({ type: 'paragraph', text: pLines.join(' ') });
    }
    return out;
  }, [content, richHtml]);

  if (richHtml !== null) {
    return (
      <div
        className="fesline-rich-article max-w-full overflow-x-hidden space-y-2 text-xs sm:text-sm text-slate-800 leading-relaxed font-serif break-words [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-950 [&_h1]:pt-2 [&_h1]:pb-1 [&_h1]:border-b [&_h1]:border-slate-200 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-950 [&_h2]:pt-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-slate-200 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-950 [&_h3]:pt-1.5 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ul]:pl-2 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-1 [&_ol]:pl-2 [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-700 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-700 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:bg-slate-50 [&_pre]:border [&_pre]:border-slate-200 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-[11px] [&_a]:text-cyan-800 [&_a]:underline [&_table]:w-full [&_table]:block [&_table]:overflow-x-auto [&_img]:max-w-full [&_img]:h-auto"
        dangerouslySetInnerHTML={{ __html: richHtml }}
      />
    );
  }

  return (
    <div className="space-y-3 text-xs sm:text-sm text-slate-800 leading-relaxed font-serif">
      {blocks.map((blk, idx) => {
        if (blk.type === 'heading') {
          return (
            <h2
              key={idx}
              id={blk.id}
              className={`font-bold text-slate-950 text-center pt-2 border-b border-slate-200 pb-1 ${
                blk.level === 1 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
              }`}
            >
              {blk.text}
            </h2>
          );
        }
        if (blk.type === 'code') {
          return (
            <div key={idx} className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 text-slate-900 shadow-2xs">
              {blk.lang && (
                <div className="px-3 py-1 bg-[#edf2f8] text-[10px] font-mono font-bold text-cyan-950 border-b border-slate-200 uppercase">
                  {blk.lang}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-900 bg-slate-50">{blk.code}</pre>
            </div>
          );
        }
        if (blk.type === 'equation') {
          return (
            <div
              key={idx}
              className="p-3 rounded-lg bg-[#edf2f8] border border-[#b8c6d4] text-center font-mono text-xs text-slate-900 overflow-x-auto"
            >
              {blk.expr}
            </div>
          );
        }
        if (blk.type === 'table') {
          return (
            <div key={idx} className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#edf2f8] text-slate-900 font-bold">
                  <tr>
                    {blk.headers.map((h, hi) => (
                      <th key={hi} className="px-3 py-1.5 border-b border-slate-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {blk.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((cell, ci) => (
                        <td key={ci} className="px-3 py-1.5 text-slate-700">
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (blk.type === 'list') {
          return blk.ordered ? (
            <ol key={idx} className="list-decimal list-inside space-y-1 pl-2 text-xs">
              {blk.items.map((it, ii) => (
                <li key={ii}>{renderInlineMarkdown(it)}</li>
              ))}
            </ol>
          ) : (
            <ul key={idx} className="list-disc list-inside space-y-1 pl-2 text-xs">
              {blk.items.map((it, ii) => (
                <li key={ii}>{renderInlineMarkdown(it)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} className="text-xs leading-relaxed text-justify">
            {renderInlineMarkdown(blk.text)}
          </p>
        );
      })}
    </div>
  );
};

interface ArticlesViewProps {
  isActive?: boolean;
  initialSlugOrId?: string;
  onActiveSlugChange?: (slug: string | undefined) => void;
}

export const ArticlesView: React.FC<ArticlesViewProps> = ({
  isActive = true,
  initialSlugOrId,
  onActiveSlugChange,
}) => {
  const { isOwner } = useProfileSync();
  const websiteSettings = useWebsiteSettingsSync();
  const { projectsArticlesConfig, cardAnimationEnabled, commentStyleConfig } =
    websiteSettings.appearanceConfig;
  const { customSections, innerLayout, videoCardControls } = projectsArticlesConfig;
  const imageCardControls = projectsArticlesConfig.imageCardControls || {
    aspectRatio: '4/3' as const,
    objectFit: 'contain' as const,
    zoomLevel: 1,
  };
  const cardAnimClass = cardAnimationEnabled ? 'card-anim-enabled' : '';
  const visibleCustomSections = useMemo(
    () =>
      (customSections || []).filter(
        (s) => s.visible !== false && (s.targetPage === 'articles' || s.targetPage === 'both')
      ),
    [customSections]
  );

  const [articles, setArticles] = useState<PortfolioArticle[]>(() => getCachedArticles(isOwner));
  const [loading, setLoading] = useState(() => !hasArticlesCacheHydrated() && getCachedArticles(isOwner).length === 0);
  const [selectedArticle, setSelectedArticle] = useState<PortfolioArticle | null>(null);

  const [isPostOpen, setIsPostOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<PortfolioArticle | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Detail Reading State
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentNotice, setCommentNotice] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [copiedCodeIdx, setCopiedCodeIdx] = useState<number | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [editingInscription, setEditingInscription] = useState(false);
  const [inscriptionDraft, setInscriptionDraft] = useState('');
  const [savingInscription, setSavingInscription] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('fesline_liked_articles_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set();
  });

  const loadArticles = async () => {
    if (!hasArticlesCacheHydrated() && articles.length === 0) {
      setLoading(true);
    }
    try {
      const data = await fetchArticlesFromSupabase(isOwner);
      setArticles(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
    const onUpdated = () => {
      const updatedList = getCachedArticles(isOwner);
      setArticles(updatedList);
      setSelectedArticle((cur) => (cur ? updatedList.find((x) => x.id === cur.id) || cur : null));
      setLoading(false);
    };
    window.addEventListener(EVENT_ARTICLES_UPDATED, onUpdated);
    const unsubRealtime = subscribeToArticlesRealtime(isOwner, (updatedList) => {
      setArticles(updatedList);
      setSelectedArticle((cur) => (cur ? updatedList.find((x) => x.id === cur.id) || cur : null));
    });
    return () => {
      window.removeEventListener(EVENT_ARTICLES_UPDATED, onUpdated);
      unsubRealtime();
    };
  }, [isOwner]);

  // Sync deep-linked article slug/id from URL when active
  useEffect(() => {
    if (!initialSlugOrId) {
      setSelectedArticle(null);
      return;
    }
    const target = initialSlugOrId.trim().toLowerCase();
    const match = articles.find(
      (a) =>
        (isOwner || a.status === 'published') &&
        ((a.slug && a.slug.toLowerCase() === target) || a.id.toLowerCase() === target)
    );
    if (match) {
      setSelectedArticle((prev) => (prev?.id === match.id ? prev : match));
    }
  }, [initialSlugOrId, articles, isOwner]);

  // Sync dynamic client-side Open Graph / SEO tags for selected article
  useEffect(() => {
    if (!isActive) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (selectedArticle) {
      applyClientSeoMetadata(buildArticleSeoMetadata(selectedArticle, origin));
    } else {
      applyClientSeoMetadata(
        getPageSeoMetadata({ part: 'articles', canonicalPath: '/articles' }, origin)
      );
    }
  }, [isActive, selectedArticle]);

  const openArticleDetail = (art: PortfolioArticle) => {
    setIsPostOpen(false);
    setEditingArticle(null);
    setCommentNotice(null);
    setCopiedCodeIdx(null);
    setCopiedShare(false);
    setEditingInscription(false);
    setInscriptionDraft(
      art.heroInscription || art.heroMedia?.inscription || art.heroMedia?.caption || ''
    );
    const slugOrId = art.slug || art.id;
    onActiveSlugChange?.(slugOrId);
    if (typeof window !== 'undefined') {
      const targetUrl = `/articles/${encodeURIComponent(slugOrId)}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
    // Instantly hydrate cached comments synchronously for immediate display
    setComments(getCachedCommentsForArticle(art.id, isOwner));
    const optimisticViews = (art.viewsCount || 0) + 1;
    setSelectedArticle({ ...art, viewsCount: optimisticViews });
    setArticles((prev) =>
      prev.map((a) => (a.id === art.id ? { ...a, viewsCount: optimisticViews } : a))
    );
    void incrementArticleViewsInSupabase(art.id).then((serverViews) => {
      if (typeof serverViews === 'number') {
        setSelectedArticle((cur) => (cur?.id === art.id ? { ...cur, viewsCount: serverViews } : cur));
      }
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const closeArticleDetail = () => {
    setSelectedArticle(null);
    onActiveSlugChange?.(undefined);
    if (typeof window !== 'undefined' && window.location.pathname !== '/articles') {
      window.history.pushState(null, '', '/articles');
    }
  };

  const handleSaveHeroInscription = async () => {
    if (!selectedArticle) return;
    setSavingInscription(true);
    try {
      const updated = await updateArticleHeroInscription(selectedArticle, inscriptionDraft);
      setSelectedArticle(updated);
      setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditingInscription(false);
    } catch (err) {
      console.error('Unable to save article hero inscription:', err);
    } finally {
      setSavingInscription(false);
    }
  };

  useEffect(() => {
    if (!selectedArticle) {
      setComments([]);
      return;
    }
    let active = true;
    const cached = getCachedCommentsForArticle(selectedArticle.id, isOwner);
    setComments(cached);
    fetchCommentsForArticle(selectedArticle.id, isOwner).then((fresh) => {
      if (active) setComments(fresh);
    });
    return () => {
      active = false;
    };
  }, [selectedArticle?.id, isOwner]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if ((isOwner || a.status === 'published') && a.category?.trim()) {
        set.add(a.category.trim());
      }
    });
    return ['All', ...Array.from(set)];
  }, [articles, isOwner]);

  const activeUploadCategories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((a) => {
      if (a.status === 'published' && a.category?.trim()) {
        set.add(a.category.trim());
      }
    });
    return Array.from(set);
  }, [articles]);

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const pool = new Set<string>();
    articles.forEach((a) => {
      if (!isOwner && a.status !== 'published') return;
      if (a.title.toLowerCase().includes(q)) pool.add(a.title);
      if (a.category.toLowerCase().includes(q)) pool.add(a.category);
      if (a.authorName.toLowerCase().includes(q)) pool.add(a.authorName);
      a.tags.forEach((t) => {
        if (t.toLowerCase().includes(q)) pool.add(t);
      });
    });
    return Array.from(pool).slice(0, 6);
  }, [articles, isOwner, searchQuery]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      if (!isOwner && a.status !== 'published') return false;
      if (selectedCategory !== 'All' && a.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.authorName.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [articles, isOwner, selectedCategory, searchQuery]);

  const relatedArticles = useMemo(() => {
    if (!selectedArticle) return [];
    return articles
      .filter(
        (a) =>
          a.id !== selectedArticle.id &&
          a.status === 'published' &&
          (a.category === selectedArticle.category ||
            a.tags.some((t) => selectedArticle.tags.includes(t)))
      )
      .slice(0, 3);
  }, [articles, selectedArticle]);

  const tocHeadings = useMemo(() => {
    if (!selectedArticle) return [];
    if (isRichHtmlContent(selectedArticle.content)) {
      return extractHtmlHeadings(selectedArticle.content).map((h) => ({
        label: h.label,
        id: h.id,
      }));
    }
    let counter = 0;
    const headings = selectedArticle.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^#{1,3}\s+/.test(l))
      .map((l) => {
        const clean = l.replace(/^#{1,3}\s+/, '').trim();
        return { label: clean, id: slugHeadingId(clean, counter++) };
      });
    return headings;
  }, [selectedArticle]);

  const handleLike = async (article: PortfolioArticle) => {
    const currentlyLiked = likedIds.has(article.id);
    const delta: 1 | -1 = currentlyLiked ? -1 : 1;
    const optimistic = Math.max(0, (article.likesCount || 0) + delta);

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(article.id);
      else next.add(article.id);
      try {
        localStorage.setItem('fesline_liked_articles_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, likesCount: optimistic } : a)));
    if (selectedArticle?.id === article.id) {
      setSelectedArticle((prev) => (prev ? { ...prev, likesCount: optimistic } : prev));
    }

    const serverCount = await toggleArticleLikeInSupabase(article.id, delta, optimistic);
    if (typeof serverCount === 'number') {
      setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, likesCount: serverCount } : a)));
      if (selectedArticle?.id === article.id) {
        setSelectedArticle((prev) => (prev ? { ...prev, likesCount: serverCount } : prev));
      }
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle || !commentAuthor.trim() || !commentText.trim()) return;
    setSubmittingComment(true);
    setCommentNotice(null);
    try {
      const created = await submitArticleComment({
        articleId: selectedArticle.id,
        authorName: commentAuthor.trim(),
        contentMarkdown: commentText.trim(),
        isOwnerPosting: isOwner,
      });
      setComments((prev) => [created, ...prev]);
      setCommentNotice('Comment published.');
      setCommentAuthor('');
      setCommentText('');
    } catch (err: any) {
      setCommentNotice(err?.message || 'Unable to post comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteArticle = async (art: PortfolioArticle) => {
    try {
      await deleteArticleFromSupabase(art.id);
      setArticles((prev) => prev.filter((a) => a.id !== art.id));
      if (selectedArticle?.id === art.id) closeArticleDetail();
    } catch (err) {
      console.error(err);
    }
  };

  // =========================================================================
  // FULL ARTICLE DETAIL READING VIEW
  // =========================================================================
  if (selectedArticle) {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/articles/${encodeURIComponent(
            selectedArticle.slug || selectedArticle.id
          )}`
        : '';
    const shareTitle = encodeURIComponent(selectedArticle.title);
    const shareHref = encodeURIComponent(shareUrl);

    const keyPointsList = (selectedArticle.tldr || '')
      .split(/\n+/)
      .map((line) => line.replace(/^([-*•]|\d+\.)\s+/, '').trim())
      .filter(Boolean);

    const normalizedKeyPoints =
      keyPointsList.length > 1
        ? keyPointsList
        : (selectedArticle.tldr || '')
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter(Boolean);

    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 pb-12 space-y-3 font-serif text-slate-900">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#edf2f8] border border-[#b8c6d4] rounded-xl px-3 py-2 shadow-2xs">
          <button
            type="button"
            onClick={closeArticleDetail}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold tabular-nums"
              title="Real-time views"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-800" />
              <span>{selectedArticle.viewsCount || 0}</span>
            </span>
            <button
              type="button"
              onClick={() => handleLike(selectedArticle)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
                likedIds.has(selectedArticle.id)
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${likedIds.has(selectedArticle.id) ? 'fill-rose-600 text-rose-600' : ''}`} />
              <span>{selectedArticle.likesCount}</span>
            </button>

            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareHref}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-slate-700"
            >
              LinkedIn
            </a>
            <a
              href={`https://x.com/intent/tweet?text=${shareTitle}&url=${shareHref}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-slate-700"
            >
              X
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2000);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
            >
              {copiedShare ? <Check className="w-3 h-3 text-emerald-700" /> : <Share2 className="w-3 h-3" />}
              <span>{copiedShare ? 'Copied' : 'Share'}</span>
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingArticle(selectedArticle);
                    setIsPostOpen(true);
                    closeArticleDetail();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 text-cyan-800" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteArticle(selectedArticle)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Article Body Container */}
        <article className="w-full bg-white border border-[#b8c6d4] rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5">
          <header className="text-center border-b border-slate-200 pb-3.5 space-y-2">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-950 text-center leading-snug">
              {selectedArticle.title}
            </h1>
            {selectedArticle.summary && (
              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl mx-auto leading-relaxed">
                {selectedArticle.summary}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 pt-0.5">
              <span className="px-2.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-950 font-bold">
                {selectedArticle.category}
              </span>
              {selectedArticle.authorName && !/^chief\s*admin$/i.test(selectedArticle.authorName.trim()) && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-semibold text-slate-800">By: {selectedArticle.authorName}</span>
                </>
              )}
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-slate-600">
                <Clock className="w-3 h-3 text-cyan-800" />
                <span>{selectedArticle.readingTime}</span>
              </span>
              <span className="text-slate-300">·</span>
              <LiveRelativeTime
                date={selectedArticle.publishedAt || selectedArticle.createdAt}
                className="text-[11px] text-slate-500 font-medium"
              />
            </div>
          </header>

          {/* Flexible Visual Hero: Rectangular Full-Fit Media + Top-Right Inscription Overlay */}
          {(() => {
            const hero = selectedArticle.heroMedia;
            const hasSpecialHero = Boolean(hero && (hero.type === 'cad3d' || (hero.type === 'video' && hero.url)));
            const heroBgUrl =
              !hasSpecialHero
                ? (hero && hero.type !== 'none' && hero.url
                    ? hero.jpegUrl || hero.url || hero.webpUrl || hero.avifUrl || ''
                    : '') ||
                  selectedArticle.thumbnailUrl ||
                  ''
                : '';
            const currentInscription =
              selectedArticle.heroInscription ||
              hero?.inscription ||
              hero?.caption ||
              '';

            if (!hasSpecialHero && !heroBgUrl) return null;

            const topRightInscriptionOverlay = (currentInscription || isOwner) && (
              <div
                className="absolute top-2.5 right-2.5 z-20 max-w-[85%] sm:max-w-[58%]"
                onClick={(e) => e.stopPropagation()}
              >
                {editingInscription && isOwner ? (
                  <div className="flex flex-col gap-1.5 bg-slate-950/90 backdrop-blur-xs border border-white/25 rounded-lg p-2 shadow-lg">
                    <input
                      type="text"
                      value={inscriptionDraft}
                      onChange={(e) => setInscriptionDraft(e.target.value)}
                      placeholder="Top-right hero inscription..."
                      className="w-full min-w-[180px] sm:min-w-[230px] px-2 py-1 rounded border border-slate-500 bg-slate-900 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={savingInscription}
                        onClick={handleSaveHeroInscription}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[10.5px] font-semibold cursor-pointer disabled:opacity-60"
                      >
                        <Check className="w-3 h-3" />
                        <span>{savingInscription ? 'Saving...' : 'Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingInscription(false);
                          setInscriptionDraft(currentInscription);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-[10.5px] font-semibold cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/75 backdrop-blur-xs border border-white/25 text-white shadow-md">
                    {currentInscription && (
                      <p className="text-[11px] sm:text-xs font-medium italic leading-snug text-right break-words">
                        {currentInscription}
                      </p>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setInscriptionDraft(currentInscription);
                          setEditingInscription(true);
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[10px] font-semibold cursor-pointer shrink-0"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>{currentInscription ? 'Edit' : 'Add Inscription'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );

            return (
              <figure className="w-full">
                {hero?.type === 'cad3d' ? (
                  <div className="relative w-full rounded-xl overflow-hidden">
                    <Interactive3DViewer modelType={hero.cadModelType || 'harmonic_actuator'} />
                    {topRightInscriptionOverlay}
                  </div>
                ) : hero?.type === 'video' && hero.url ? (
                  <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
                    <CleanVideoPlayer
                      src={hero.url}
                      poster={hero.posterUrl}
                      av1Urls={hero.av1Urls}
                      h264Urls={hero.h264Urls}
                      vttThumbnailsUrl={hero.vttThumbnailsUrl}
                      subtitleUrl={hero.subtitleUrl}
                      mediaId={hero.mediaAssetId || hero.url}
                      title={selectedArticle.title}
                      aspectRatio={videoCardControls.aspectRatio || '16/9'}
                      objectFit={videoCardControls.objectFit || 'contain'}
                      zoomLevel={videoCardControls.zoomLevel || 1}
                    />
                    {topRightInscriptionOverlay}
                  </div>
                ) : (
                  <div
                    className={`relative ${getContainerWidthClassForAspect(imageCardControls.aspectRatio, 'hero')} max-h-[420px] rounded-xl overflow-hidden border border-[#cbd5e1] shadow-xs bg-slate-100 flex items-center justify-center`}
                    style={{
                      aspectRatio: (imageCardControls.aspectRatio || '4/3').replace(':', '/'),
                    }}
                  >
                    <picture className="w-full h-full flex items-center justify-center overflow-hidden">
                      {hero?.avifUrl && (
                        <source
                          srcSet={
                            hero.mobileUrl && hero.mobileUrl !== hero.avifUrl
                              ? `${hero.mobileUrl} 768w, ${hero.avifUrl} 1600w`
                              : hero.avifUrl
                          }
                          sizes="(max-width: 640px) 100vw, 1000px"
                          type="image/avif"
                        />
                      )}
                      {hero?.webpUrl && <source srcSet={hero.webpUrl} type="image/webp" />}
                      <img
                        src={heroBgUrl}
                        alt={currentInscription || selectedArticle.title}
                        loading="lazy"
                        decoding="async"
                        style={getMediaImgStyle(imageCardControls)}
                        className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                      />
                    </picture>
                    {topRightInscriptionOverlay}
                  </div>
                )}
              </figure>
            );
          })()}

          {/* Key Points List */}
          {normalizedKeyPoints.length > 0 && (
            <div className="w-full p-3.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] space-y-1.5">
              <h2 className="text-xs font-bold text-slate-950 text-center uppercase tracking-wider">Key Points</h2>
              <ul className="list-disc list-inside space-y-1 text-xs text-slate-800 leading-relaxed pl-1">
                {normalizedKeyPoints.map((pt, idx) => (
                  <li key={idx}>{pt}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Layout: Sticky ToC + Body */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5 items-start">
            <aside className="w-full lg:col-span-1 lg:sticky lg:top-20 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <h3 className="font-bold text-slate-950 text-center border-b border-slate-200 pb-1">
                Table of Contents
              </h3>
              <nav aria-label="Table of Contents">
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700">
                  {tocHeadings.map((h) => (
                    <li key={h.id} className="truncate">
                      <a
                        href={`#${h.id}`}
                        className="text-slate-700 hover:text-cyan-900 hover:underline"
                      >
                        {h.label}
                      </a>
                    </li>
                  ))}
                  {selectedArticle.diagrams.length > 0 && (
                    <li>
                      <a href="#article-schematics" className="text-slate-700 hover:text-cyan-900 hover:underline">
                        Illustrations
                      </a>
                    </li>
                  )}
                  {selectedArticle.chartData.length > 0 && (
                    <li>
                      <a href="#article-charts" className="text-slate-700 hover:text-cyan-900 hover:underline">
                        Data Visualizations
                      </a>
                    </li>
                  )}
                  {selectedArticle.bomItems.length > 0 && (
                    <li>
                      <a href="#article-bom" className="text-slate-700 hover:text-cyan-900 hover:underline">
                        Bill of Materials (BOM)
                      </a>
                    </li>
                  )}
                  {selectedArticle.attachments.length > 0 && (
                    <li>
                      <a href="#article-attachments" className="text-slate-700 hover:text-cyan-900 hover:underline">
                        Technical Attachments
                      </a>
                    </li>
                  )}
                  <li>
                    <a href="#article-comments" className="text-slate-700 hover:text-cyan-900 hover:underline">
                      Discussion &amp; Comments ({comments.length})
                    </a>
                  </li>
                </ol>
              </nav>
            </aside>

            <div className="w-full lg:col-span-3 space-y-3.5 min-w-0">
              {/* Rich Markdown Content */}
              <ArticleMarkdownRenderer content={selectedArticle.content} />

              {/* Explicit Code Blocks (Light Background Theme) */}
              {selectedArticle.codeBlocks.length > 0 && (
                <div className="space-y-2.5">
                  {selectedArticle.codeBlocks.map((cb, idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 text-slate-900 shadow-2xs">
                      <div className="px-3 py-1.5 bg-[#edf2f8] border-b border-slate-200 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-cyan-950">
                          {cb.title || 'Code Listing'} {cb.language ? `(${cb.language})` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(cb.code);
                            setCopiedCodeIdx(idx);
                            setTimeout(() => setCopiedCodeIdx(null), 1500);
                          }}
                          className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-950 font-semibold cursor-pointer"
                        >
                          {copiedCodeIdx === idx ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCodeIdx === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="p-3 overflow-x-auto text-[11px] font-mono leading-relaxed text-slate-900 bg-slate-50">{cb.code}</pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Illustrations */}
              {selectedArticle.diagrams.length > 0 && (
                <section id="article-schematics" className="space-y-2 pt-2 border-t border-slate-200">
                  <h2 className="text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Illustrations</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    {selectedArticle.diagrams.map((diag, idx) => {
                      const avifSrcSet =
                        diag.mobileUrl && diag.avifUrl && diag.mobileUrl !== diag.avifUrl
                          ? `${diag.mobileUrl} 768w, ${diag.avifUrl} 1600w`
                          : diag.avifUrl;
                      return (
                        <div key={idx} className="w-full flex flex-col gap-2">
                          <div
                            className={`${getContainerWidthClassForAspect(imageCardControls.aspectRatio, 'gallery')} max-h-[280px] rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center`}
                            style={{
                              aspectRatio: (imageCardControls.aspectRatio || '4/3').replace(':', '/'),
                            }}
                          >
                            <picture className="w-full h-full flex items-center justify-center overflow-hidden">
                              {avifSrcSet && (
                                <source
                                  srcSet={avifSrcSet}
                                  sizes="(max-width: 640px) 100vw, 50vw"
                                  type="image/avif"
                                />
                              )}
                              {diag.webpUrl && <source srcSet={diag.webpUrl} type="image/webp" />}
                              <img
                                src={diag.jpegUrl || diag.url}
                                alt={diag.note || diag.title || `Diagram ${idx + 1}`}
                                loading="lazy"
                                decoding="async"
                                style={getMediaImgStyle(imageCardControls)}
                                className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                              />
                            </picture>
                          </div>
                          {diag.note && diag.note.trim() && (
                            <div className="w-full rounded-xl border border-[#cbd5e1] bg-[#edf2f8]/75 px-3 py-2 text-[11px] text-slate-700 text-justify leading-relaxed shadow-2xs">
                              {diag.note.trim()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Embedded Article Images & Videos */}
              {selectedArticle.images.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 items-start">
                  {selectedArticle.images.map((im, idx) => {
                    const avifSrcSet =
                      im.mobileUrl && im.avifUrl && im.mobileUrl !== im.avifUrl
                        ? `${im.mobileUrl} 768w, ${im.avifUrl} 1600w`
                        : im.avifUrl;
                    return (
                      <div key={idx} className="w-full flex flex-col gap-2">
                        <div
                          className={`${getContainerWidthClassForAspect(imageCardControls.aspectRatio, 'gallery')} max-h-[280px] rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center`}
                          style={{
                            aspectRatio: (imageCardControls.aspectRatio || '4/3').replace(':', '/'),
                          }}
                        >
                          <picture className="w-full h-full flex items-center justify-center overflow-hidden">
                            {avifSrcSet && (
                              <source
                                srcSet={avifSrcSet}
                                sizes="(max-width: 640px) 100vw, 50vw"
                                type="image/avif"
                              />
                            )}
                            {im.webpUrl && <source srcSet={im.webpUrl} type="image/webp" />}
                            <img
                              src={im.jpegUrl || im.url}
                              alt={im.note || im.title || `Article Image ${idx + 1}`}
                              loading="lazy"
                              decoding="async"
                              style={getMediaImgStyle(imageCardControls)}
                              className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                            />
                          </picture>
                        </div>
                        {im.note && im.note.trim() && (
                          <div className="w-full rounded-xl border border-[#cbd5e1] bg-[#edf2f8]/75 px-3 py-2 text-[11px] text-slate-700 text-justify leading-relaxed shadow-2xs">
                            {im.note.trim()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedArticle.videos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 items-start">
                  {selectedArticle.videos.map((v, idx) => (
                    <div key={idx} className="w-full flex flex-col gap-2">
                      <div className="w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-950">
                        <CleanVideoPlayer
                          src={v.url}
                          poster={v.posterUrl}
                          av1Urls={v.av1Urls}
                          h264Urls={v.h264Urls}
                          vttThumbnailsUrl={v.vttThumbnailsUrl}
                          subtitleUrl={v.subtitleUrl}
                          mediaId={v.mediaAssetId || v.url}
                          title={v.title || selectedArticle.title}
                          aspectRatio={videoCardControls.aspectRatio || '16/9'}
                          objectFit={videoCardControls.objectFit || 'contain'}
                          zoomLevel={videoCardControls.zoomLevel || 1}
                        />
                      </div>
                      {v.note && v.note.trim() && (
                        <div className="w-full rounded-xl border border-[#cbd5e1] bg-[#edf2f8]/75 px-3 py-2 text-[11px] text-slate-700 text-justify leading-relaxed shadow-2xs">
                          {v.note.trim()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Data Charts & Visualizations */}
              {selectedArticle.chartData.length > 0 && (
                <section id="article-charts" className="space-y-2.5 pt-2 border-t border-slate-200">
                  <h2 className="text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Data Charts &amp; Visualizations</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedArticle.chartData.map((ch, cIdx) => {
                      const maxVal = Math.max(1, ...ch.items.map((x) => Math.abs(x.value)));
                      return (
                        <div key={cIdx} className="w-full p-3.5 rounded-xl bg-white border border-[#b8c6d4] shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
                            <h3 className="text-xs font-bold text-slate-950">
                              {ch.title || 'Engineering Data'}
                            </h3>
                            {ch.unit && (
                              <span className="px-2 py-0.5 rounded bg-[#edf2f8] border border-[#b8c6d4] text-[10px] font-mono font-bold text-cyan-950">
                                {ch.unit}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {ch.items.map((pt, pIdx) => {
                              const pct = Math.max(4, Math.round((Math.abs(pt.value) / maxVal) * 100));
                              return (
                                <div key={pIdx} className="space-y-1 text-[11px]">
                                  <div className="flex items-center justify-between gap-2 text-slate-800">
                                    <span className="font-medium truncate">{pt.label}</span>
                                    <span className="font-mono font-bold text-cyan-950 shrink-0 tabular-nums">
                                      {pt.value.toLocaleString()} {ch.unit || ''}
                                    </span>
                                  </div>
                                  <div className="w-full h-3 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-800 to-cyan-600 rounded-full transition-all duration-300"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Optional Bill of Materials (BOM) */}
              {selectedArticle.bomItems.length > 0 && (
                <section id="article-bom" className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                      <TableIcon className="w-3.5 h-3.5 text-cyan-800" />
                      <span>Bill of Materials (BOM)</span>
                    </h2>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#edf2f8] border border-[#b8c6d4] text-cyan-950">
                      {selectedArticle.bomItems.length} {selectedArticle.bomItems.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>
                  <div className="w-full overflow-x-auto border border-[#b8c6d4] rounded-xl bg-white shadow-2xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#edf2f8] text-slate-950 font-bold border-b border-[#b8c6d4]">
                        <tr>
                          <th className="px-3 py-2 whitespace-nowrap">Part #</th>
                          <th className="px-3 py-2">Component</th>
                          <th className="px-3 py-2">Material</th>
                          <th className="px-3 py-2 whitespace-nowrap text-center">Qty</th>
                          <th className="px-3 py-2">Specification</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {selectedArticle.bomItems.map((b, i) => (
                          <tr key={i} className="even:bg-slate-50/70 hover:bg-cyan-50/40 transition-colors">
                            <td className="px-3 py-2 font-mono text-[11px] font-semibold text-cyan-950 whitespace-nowrap">{b.partNo || '—'}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{b.name || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{b.material || '—'}</td>
                            <td className="px-3 py-2 font-mono text-center font-semibold text-slate-900">{b.qty || '—'}</td>
                            <td className="px-3 py-2 text-slate-700">{b.specification || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Downloadable Technical Attachments */}
              {selectedArticle.attachments.length > 0 && (
                <section id="article-attachments" className="space-y-2 pt-2 border-t border-slate-200">
                  <h2 className="text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Project Files &amp; Technical Attachments</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedArticle.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-cyan-700 text-xs text-slate-800"
                      >
                        <span className="truncate font-semibold">{att.title || att.fileName}</span>
                        <Download className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Related Articles */}
              {relatedArticles.length > 0 && (
                <section className="space-y-2.5 pt-3 border-t border-slate-200">
                  <h2 className="text-sm font-bold text-slate-950 text-center">Related Articles</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {relatedArticles.map((rel) => (
                      <div
                        key={rel.id}
                        onClick={() => openArticleDetail(rel)}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-cyan-700 cursor-pointer space-y-1"
                      >
                        <span className="text-[10px] font-bold text-cyan-900">{rel.category}</span>
                        <h3 className="text-xs font-bold text-slate-950 line-clamp-2">{rel.title}</h3>
                        <span className="text-[10px] text-slate-500 block">{rel.readingTime}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Markdown-Supported Comment Section */}
              <section id="article-comments" className="space-y-3 pt-3 border-t border-slate-200">
                <h2 className="text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-cyan-800" />
                  <span>Comments &amp; Technical Discussion ({comments.length})</span>
                </h2>

                <form onSubmit={handleSubmitComment} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  {commentNotice && (
                    <div className="p-2 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 text-[11px]">
                      {commentNotice}
                    </div>
                  )}
                  <input
                    type="text"
                    required
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                  <textarea
                    rows={3}
                    required
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a technical comment..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingComment}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>{submittingComment ? 'Posting...' : 'Post Comment'}</span>
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  {comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      style={{
                        fontFamily: commentStyleConfig.fontFamily || '"Times New Roman", Times, serif',
                        fontSize: commentStyleConfig.fontSize || '12px',
                      }}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-950">{cmt.authorName}</span>
                          {cmt.authorRole === 'Chief Admin' && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold">
                              Chief Admin
                            </span>
                          )}
                          {cmt.status !== 'approved' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                              {cmt.status}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(cmt.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div
                        style={{
                          fontFamily: commentStyleConfig.fontFamily || '"Times New Roman", Times, serif',
                          fontSize: commentStyleConfig.fontSize || '12px',
                        }}
                      >
                        <ArticleMarkdownRenderer content={cmt.contentMarkdown} />
                      </div>
                      {isOwner && (
                        <div className="flex items-center gap-2 pt-1 text-[10px]">
                          {cmt.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await moderateCommentInSupabase(cmt.id, 'approved');
                                setComments((prev) =>
                                  prev.map((c) => (c.id === cmt.id ? { ...c, status: 'approved' } : c))
                                );
                              }}
                              className="text-emerald-700 font-bold hover:underline cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {cmt.status !== 'archived' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await moderateCommentInSupabase(cmt.id, 'archived');
                                setComments((prev) =>
                                  prev.map((c) => (c.id === cmt.id ? { ...c, status: 'archived' } : c))
                                );
                              }}
                              className="text-amber-700 font-bold hover:underline cursor-pointer"
                            >
                              Archive
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteCommentFromSupabase(cmt.id);
                              setComments((prev) => prev.filter((c) => c.id !== cmt.id));
                            }}
                            className="text-rose-700 font-bold hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </article>
      </div>
    );
  }

  // =========================================================================
  // MAIN BLOG / ARTICLES LIST PAGE
  // =========================================================================
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-5 font-serif text-slate-900">
      {/* Small, well-designed div container for heading */}
      <div className="max-w-xs mx-auto px-4 py-2 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs text-center">
        <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight text-center">
          Engineering Articles
        </h1>
      </div>

      {/* Toolbar: Search on row 1; Category Dropdown + Small "Post" button aligned on same row */}
      <div className="p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs space-y-2 text-xs">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSuggestions(true);
            }}
            placeholder="Search articles by title, category, author, or tag..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-20 divide-y divide-slate-100">
              {searchSuggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onMouseDown={() => {
                    setSearchQuery(sug);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-800 hover:bg-[#edf2f8] cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-w-0 max-w-[200px] px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium cursor-pointer truncate"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All' : cat}
              </option>
            ))}
          </select>

          {/* Small "Post" button aligned cleanly with category select */}
          <button
            type="button"
            onClick={() => {
              setEditingArticle(null);
              setIsPostOpen(!isPostOpen);
            }}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-[11px] font-semibold cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3 h-3" />
            <span>Post</span>
          </button>
        </div>
      </div>

      {submissionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs text-center flex items-center justify-between">
          <span className="flex-1 text-center">{submissionNotice}</span>
          <button
            type="button"
            onClick={() => setSubmissionNotice(null)}
            className="text-emerald-700 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Article Creation / Editing Form */}
      {isPostOpen && (
        <ArticleFormPanel
          initialArticle={editingArticle}
          isOwner={isOwner}
          activeCategories={activeUploadCategories}
          onSaved={(saved, wasPendingVisitor) => {
            setIsPostOpen(false);
            setEditingArticle(null);
            if (wasPendingVisitor) {
              setSubmissionNotice(
                'Thank you! Your article was submitted and is awaiting Chief Admin approval before publication.'
              );
            } else {
              setArticles((prev) => {
                const exists = prev.some((a) => a.id === saved.id);
                return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
              });
              setSubmissionNotice('Article saved to Engineering Articles.');
            }
          }}
          onCancel={() => {
            setIsPostOpen(false);
            setEditingArticle(null);
          }}
        />
      )}

      {/* Custom Content Sections configured via Admin Dashboard */}
      {visibleCustomSections.length > 0 && (
        <div className="space-y-3">
          {visibleCustomSections.map((sec) => (
            <div
              key={sec.id}
              className={`p-4 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs space-y-1.5 ${
                sec.textAlign === 'left'
                  ? 'text-left'
                  : sec.textAlign === 'right'
                  ? 'text-right'
                  : 'text-center'
              }`}
            >
              {sec.badgeText && (
                <span className="inline-block px-2 py-0.5 rounded bg-cyan-100 border border-cyan-300 text-cyan-900 text-[10px] font-bold">
                  {sec.badgeText}
                </span>
              )}
              <h2 className="text-sm font-bold text-slate-950">{sec.title}</h2>
              {sec.subtitle && <p className="text-[11px] text-cyan-900 font-semibold">{sec.subtitle}</p>}
              {sec.body && (
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{sec.body}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Articles Grid — Empty by default when 0 rows exist in Supabase */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading articles...</div>
      ) : filteredArticles.length === 0 ? (
        <div className="p-8 rounded-xl bg-white/80 border border-dashed border-[#b8c6d4] text-center">
          <p className="text-xs text-slate-600">No articles published yet.</p>
        </div>
      ) : (() => {
        const gridColsClass =
          innerLayout.gridColumns === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : innerLayout.gridColumns === 4
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
        const gapClass =
          innerLayout.cardSpacing === 'compact'
            ? 'gap-2.5'
            : innerLayout.cardSpacing === 'relaxed'
            ? 'gap-6'
            : 'gap-4';
        const padClass =
          innerLayout.cardSpacing === 'compact'
            ? 'p-2.5'
            : innerLayout.cardSpacing === 'relaxed'
            ? 'p-5'
            : 'p-3.5';
        const summaryAlignClass =
          innerLayout.cardTextAlign === 'left'
            ? 'text-left'
            : innerLayout.cardTextAlign === 'center'
            ? 'text-center'
            : 'text-justify';

        return (
          <div className={`grid ${gridColsClass} ${gapClass}`}>
            {filteredArticles.map((art) => {
              const isLiked = likedIds.has(art.id);
              const cardImg =
                art.thumbnailUrl ||
                (art.heroMedia?.type === 'image' || art.heroMedia?.type === 'diagram'
                  ? art.heroMedia.url || ''
                  : '') ||
                art.images?.[0]?.url ||
                '';
              const cardVid = !cardImg
                ? (art.heroMedia?.type === 'video'
                    ? art.heroMedia.h264Urls?.['720p'] || art.heroMedia.url || ''
                    : '') ||
                  art.videos?.[0]?.h264Urls?.['720p'] ||
                  art.videos?.[0]?.url ||
                  ''
                : '';
              const cardVidPoster =
                art.heroMedia?.type === 'video' ? art.heroMedia.posterUrl : art.videos?.[0]?.posterUrl;
              return (
                <article
                  key={art.id}
                  onClick={() => openArticleDetail(art)}
                  className={`rounded-xl bg-white border border-[#b8c6d4] hover:border-cyan-700 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${cardAnimClass}`}
                >
                  <div>
                    {cardImg ? (
                      <div
                        className="w-full max-h-[240px] bg-slate-100 border-b border-slate-200 overflow-hidden flex items-center justify-center"
                        style={{
                          aspectRatio: (imageCardControls.aspectRatio || '4/3').replace(':', '/'),
                        }}
                      >
                        <img
                          src={cardImg}
                          alt={art.title}
                          loading="lazy"
                          decoding="async"
                          style={getMediaImgStyle(imageCardControls)}
                          className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                        />
                      </div>
                    ) : cardVid ? (
                      <div className="relative w-full aspect-video bg-slate-950 overflow-hidden border-b border-slate-200">
                        {cardVidPoster ? (
                          <img
                            src={cardVidPoster}
                            alt={art.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover block"
                          />
                        ) : (
                          <video
                            src={cardVid}
                            preload="none"
                            muted
                            playsInline
                            className="w-full h-full object-contain pointer-events-none"
                          />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                          <span className="w-9 h-9 rounded-full bg-slate-950/75 border border-white/30 flex items-center justify-center text-white shadow-sm">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div className={`${padClass} space-y-2`}>
                      <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-950 font-bold truncate">
                          {art.category}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {art.status !== 'published' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 uppercase font-bold">
                              {art.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <h3
                        className={`text-sm font-bold text-slate-950 leading-snug line-clamp-2 ${
                          innerLayout.cardTextAlign === 'left' ? 'text-left' : 'text-center'
                        }`}
                      >
                        {art.title}
                      </h3>
                      <p className={`text-[11px] text-slate-600 line-clamp-3 leading-relaxed ${summaryAlignClass}`}>
                        {art.summary}
                      </p>
                    </div>
                  </div>

                  <div className="px-3.5 pb-2.5 pt-2 bg-slate-50/70 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-500">
                    <div className="flex items-center justify-between gap-2">
                      {art.authorName && !/^chief\s*admin$/i.test(art.authorName.trim()) ? (
                        <span className="truncate font-semibold text-slate-700">
                          By: {art.authorName}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                          <Clock className="w-3 h-3 text-cyan-800" />
                          <span>{art.readingTime}</span>
                        </span>
                      )}
                      <LiveRelativeTime
                        date={art.publishedAt || art.createdAt}
                        className="text-[9.5px] text-slate-500 shrink-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-200/70">
                      <div className="flex items-center gap-2 text-slate-600 font-semibold">
                        {art.authorName && !/^chief\s*admin$/i.test(art.authorName.trim()) && (
                          <>
                            <span className="inline-flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3 text-cyan-800" />
                              <span>{art.readingTime}</span>
                            </span>
                            <span className="text-slate-300">·</span>
                          </>
                        )}
                        <span
                          className="inline-flex items-center gap-1 tabular-nums"
                          title="Real-time views"
                        >
                          <Eye className="w-3 h-3 text-cyan-800" />
                          <span>{art.viewsCount || 0}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleLike(art);
                        }}
                        aria-label={isLiked ? 'Unlike article' : 'Like article'}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-colors cursor-pointer ${
                          isLiked
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-rose-50/50 hover:border-rose-200'
                        }`}
                      >
                        <Heart className={`w-3 h-3 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
                        <span className="tabular-nums">{art.likesCount || 0}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};
