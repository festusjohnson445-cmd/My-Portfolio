import type { Request } from 'express';
import {
  type SeoMetadataPayload,
  SITE_NAME,
  buildArticleSeoMetadata,
  buildProjectSeoMetadata,
  getPageSeoMetadata,
  resolveRouteFromParts,
  toAbsoluteUrl,
} from './metadata.ts';

const DEFAULT_SUPABASE_URL = 'https://teszyojnwaedjvqaqake.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_-XgRARzNT0COeyl9FE66Lw_-k6wMWex';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const projectMetaCache = new Map<string, CacheEntry<any>>();
const articleMetaCache = new Map<string, CacheEntry<any>>();
const META_CACHE_TTL_MS = 30_000;

function getServerSupabaseConfig() {
  const url = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  )
    .trim()
    .replace(/\/+$/, '');
  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  ).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, anonKey, serviceKey };
}

function buildSupabaseRestHeaders(cfg: { anonKey: string; serviceKey: string }): Record<string, string> {
  const keyToUse = cfg.serviceKey || cfg.anonKey;
  const headers: Record<string, string> = {
    apikey: keyToUse,
    Accept: 'application/json',
  };
  if (!keyToUse.startsWith('sb_publishable_') && !keyToUse.startsWith('sb_secret_')) {
    headers['Authorization'] = `Bearer ${keyToUse}`;
  }
  return headers;
}

async function fetchPublishedProjectBySlugOrId(slugOrId: string): Promise<any | null> {
  const key = slugOrId.trim().toLowerCase();
  if (!key) return null;

  const cached = projectMetaCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const cfg = getServerSupabaseConfig();
  const headers = buildSupabaseRestHeaders(cfg);
  const selectFields =
    'id,slug,title,category,description,overview,thumbnail_url,images,tools_used,status,created_at,updated_at';

  try {
    // Try slug match first
    const slugUrl = `${cfg.url}/rest/v1/projects?select=${encodeURIComponent(
      selectFields
    )}&status=eq.published&slug=eq.${encodeURIComponent(slugOrId.trim())}&limit=1`;
    const slugResp = await fetch(slugUrl, {
      headers,
      signal: AbortSignal.timeout(2500),
    });
    if (slugResp.ok) {
      const rows = (await slugResp.json().catch(() => [])) as any[];
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        projectMetaCache.set(key, { value: row, expiresAt: Date.now() + META_CACHE_TTL_MS });
        return row;
      }
    }

    // Fallback to id match
    const idUrl = `${cfg.url}/rest/v1/projects?select=${encodeURIComponent(
      selectFields
    )}&status=eq.published&id=eq.${encodeURIComponent(slugOrId.trim())}&limit=1`;
    const idResp = await fetch(idUrl, {
      headers,
      signal: AbortSignal.timeout(2500),
    });
    if (idResp.ok) {
      const rows = (await idResp.json().catch(() => [])) as any[];
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        projectMetaCache.set(key, { value: row, expiresAt: Date.now() + META_CACHE_TTL_MS });
        return row;
      }
    }
  } catch {
    // Graceful fallback to page metadata
  }

  projectMetaCache.set(key, { value: null, expiresAt: Date.now() + 10_000 });
  return null;
}

async function fetchPublishedArticleBySlugOrId(slugOrId: string): Promise<any | null> {
  const key = slugOrId.trim().toLowerCase();
  if (!key) return null;

  const cached = articleMetaCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const cfg = getServerSupabaseConfig();
  const headers = buildSupabaseRestHeaders(cfg);
  const selectFields =
    'id,slug,title,summary,tldr,content,category,author_name,thumbnail_url,hero_media,images,tags,status,published_at,created_at,updated_at';

  try {
    const slugUrl = `${cfg.url}/rest/v1/articles?select=${encodeURIComponent(
      selectFields
    )}&status=eq.published&slug=eq.${encodeURIComponent(slugOrId.trim())}&limit=1`;
    const slugResp = await fetch(slugUrl, {
      headers,
      signal: AbortSignal.timeout(2500),
    });
    if (slugResp.ok) {
      const rows = (await slugResp.json().catch(() => [])) as any[];
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        articleMetaCache.set(key, { value: row, expiresAt: Date.now() + META_CACHE_TTL_MS });
        return row;
      }
    }

    const idUrl = `${cfg.url}/rest/v1/articles?select=${encodeURIComponent(
      selectFields
    )}&status=eq.published&id=eq.${encodeURIComponent(slugOrId.trim())}&limit=1`;
    const idResp = await fetch(idUrl, {
      headers,
      signal: AbortSignal.timeout(2500),
    });
    if (idResp.ok) {
      const rows = (await idResp.json().catch(() => [])) as any[];
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        articleMetaCache.set(key, { value: row, expiresAt: Date.now() + META_CACHE_TTL_MS });
        return row;
      }
    }
  } catch {
    // Graceful fallback to page metadata
  }

  articleMetaCache.set(key, { value: null, expiresAt: Date.now() + 10_000 });
  return null;
}

export async function fetchAllPublishedSlugsForSitemap(): Promise<{
  projects: Array<{ slug: string; updatedAt?: string }>;
  articles: Array<{ slug: string; updatedAt?: string }>;
}> {
  const cfg = getServerSupabaseConfig();
  const headers = buildSupabaseRestHeaders(cfg);
  try {
    const [projResp, artResp] = await Promise.all([
      fetch(`${cfg.url}/rest/v1/projects?select=id,slug,updated_at&status=eq.published&limit=200`, {
        headers,
        signal: AbortSignal.timeout(2500),
      }),
      fetch(`${cfg.url}/rest/v1/articles?select=id,slug,updated_at&status=eq.published&limit=200`, {
        headers,
        signal: AbortSignal.timeout(2500),
      }),
    ]);
    const projRows = projResp.ok ? ((await projResp.json().catch(() => [])) as any[]) : [];
    const artRows = artResp.ok ? ((await artResp.json().catch(() => [])) as any[]) : [];
    return {
      projects: (Array.isArray(projRows) ? projRows : []).map((r) => ({
        slug: String(r.slug || r.id),
        updatedAt: r.updated_at,
      })),
      articles: (Array.isArray(artRows) ? artRows : []).map((r) => ({
        slug: String(r.slug || r.id),
        updatedAt: r.updated_at,
      })),
    };
  } catch {
    return { projects: [], articles: [] };
  }
}

export function resolveRequestOrigin(req: Request): string {
  const envUrl = (process.env.APP_URL || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const rawHost = forwardedHost || String(req.headers.host || '').split(',')[0].trim();

  if (rawHost) {
    const isLocal =
      rawHost.startsWith('localhost') ||
      rawHost.startsWith('127.0.0.1') ||
      rawHost.startsWith('0.0.0.0');
    const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const proto = isLocal ? rawProto || 'http' : 'https';
    return `${proto}://${rawHost}`;
  }

  if (envUrl) return envUrl;
  return 'https://fesline.vercel.app';
}

function escapeHtmlAttr(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function resolveRequestSeoMetadata(
  req: Request
): Promise<{ meta: SeoMetadataPayload; origin: string }> {
  const origin = resolveRequestOrigin(req);
  const fullUrl = req.originalUrl || req.url || '/';
  const [rawPath, rawSearch = ''] = fullUrl.split('?');
  const parsed = resolveRouteFromParts(rawPath || '/', '', rawSearch ? `?${rawSearch}` : '');

  if (parsed.part === 'projects' && parsed.projectSlugOrId) {
    const row = await fetchPublishedProjectBySlugOrId(parsed.projectSlugOrId);
    if (row) {
      return {
        origin,
        meta: buildProjectSeoMetadata(
          {
            id: row.id,
            slug: row.slug || row.id,
            title: row.title,
            category: row.category,
            description: row.description,
            overview: row.overview,
            thumbnailUrl: row.thumbnail_url,
            images: Array.isArray(row.images) ? row.images : [],
            toolsUsed: Array.isArray(row.tools_used) ? row.tools_used : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
          origin
        ),
      };
    }
  }

  if (parsed.part === 'articles' && parsed.articleSlugOrId) {
    const row = await fetchPublishedArticleBySlugOrId(parsed.articleSlugOrId);
    if (row) {
      return {
        origin,
        meta: buildArticleSeoMetadata(
          {
            id: row.id,
            slug: row.slug || row.id,
            title: row.title,
            summary: row.summary,
            tldr: row.tldr,
            content: row.content,
            category: row.category,
            authorName: row.author_name,
            thumbnailUrl: row.thumbnail_url,
            heroMedia: row.hero_media,
            images: Array.isArray(row.images) ? row.images : [],
            tags: Array.isArray(row.tags) ? row.tags : [],
            publishedAt: row.published_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
          origin
        ),
      };
    }
  }

  return {
    origin,
    meta: getPageSeoMetadata(parsed, origin),
  };
}

export function renderSeoHeadBlock(meta: SeoMetadataPayload, origin: string): string {
  const canonicalUrl = toAbsoluteUrl(meta.canonicalPath, origin);
  const imageUrl = toAbsoluteUrl(meta.imagePathOrUrl, origin);
  const safeTitle = escapeHtmlText(meta.title);
  const safeTitleAttr = escapeHtmlAttr(meta.title);
  const safeDescAttr = escapeHtmlAttr(meta.description);
  const safeImgAttr = escapeHtmlAttr(imageUrl);
  const safeImgAlt = escapeHtmlAttr(meta.imageAlt);
  const safeCanonical = escapeHtmlAttr(canonicalUrl);
  const safeRobots = escapeHtmlAttr(meta.robots || 'index, follow');

  const lines: string[] = [
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDescAttr}" />`,
    `<meta name="robots" content="${safeRobots}" />`,
    `<link rel="canonical" href="${safeCanonical}" />`,
    `<meta property="og:title" content="${safeTitleAttr}" />`,
    `<meta property="og:description" content="${safeDescAttr}" />`,
    `<meta property="og:image" content="${safeImgAttr}" />`,
  ];

  if (imageUrl.startsWith('https://')) {
    lines.push(`<meta property="og:image:secure_url" content="${safeImgAttr}" />`);
  }
  if (meta.imageWidth && meta.imageHeight) {
    lines.push(`<meta property="og:image:width" content="${meta.imageWidth}" />`);
    lines.push(`<meta property="og:image:height" content="${meta.imageHeight}" />`);
  }
  lines.push(`<meta property="og:image:alt" content="${safeImgAlt}" />`);
  lines.push(`<meta property="og:url" content="${safeCanonical}" />`);
  lines.push(`<meta property="og:type" content="${escapeHtmlAttr(meta.ogType)}" />`);
  lines.push(`<meta property="og:site_name" content="${escapeHtmlAttr(SITE_NAME)}" />`);
  lines.push(`<meta property="og:locale" content="en_US" />`);

  if (meta.ogType === 'article') {
    if (meta.publishedTime) {
      lines.push(
        `<meta property="article:published_time" content="${escapeHtmlAttr(meta.publishedTime)}" />`
      );
    }
    if (meta.modifiedTime) {
      lines.push(
        `<meta property="article:modified_time" content="${escapeHtmlAttr(meta.modifiedTime)}" />`
      );
    }
    if (meta.author) {
      lines.push(`<meta property="article:author" content="${escapeHtmlAttr(meta.author)}" />`);
    }
    if (meta.section) {
      lines.push(`<meta property="article:section" content="${escapeHtmlAttr(meta.section)}" />`);
    }
  }

  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`<meta name="twitter:title" content="${safeTitleAttr}" />`);
  lines.push(`<meta name="twitter:description" content="${safeDescAttr}" />`);
  lines.push(`<meta name="twitter:image" content="${safeImgAttr}" />`);
  lines.push(`<meta name="twitter:image:alt" content="${safeImgAlt}" />`);

  const jsonLdString = JSON.stringify(meta.jsonLd).replace(/<\/script>/gi, '<\\/script>');
  lines.push(`<script type="application/ld+json" id="fesline-jsonld">${jsonLdString}</script>`);

  return lines.join('\n    ');
}

export function injectSeoMetaIntoHtml(
  htmlTemplate: string,
  meta: SeoMetadataPayload,
  origin: string
): string {
  const seoHeadBlock = renderSeoHeadBlock(meta, origin);

  const markerRegex = /<!--\s*SEO_META_START\s*-->[\s\S]*?<!--\s*SEO_META_END\s*-->/;
  if (markerRegex.test(htmlTemplate)) {
    return htmlTemplate.replace(
      markerRegex,
      `<!-- SEO_META_START -->\n    ${seoHeadBlock}\n    <!-- SEO_META_END -->`
    );
  }

  // Fallback replacement if template markers were absent
  let output = htmlTemplate
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']robots["'][^>]*>/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta[^>]+property=["']article:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  return output.replace('</head>', `    ${seoHeadBlock}\n  </head>`);
}
