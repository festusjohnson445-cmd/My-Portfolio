import {
  type SeoMetadataPayload,
  SITE_NAME,
  toAbsoluteUrl,
} from './metadata';

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string | undefined) {
  if (typeof document === 'undefined') return;
  const selector = `meta[${attr}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    if (existing) existing.remove();
    return;
  }
  if (existing) {
    existing.setAttribute('content', content);
    return;
  }
  const el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

function upsertLinkTag(rel: string, href: string) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(jsonLd: Record<string, unknown>) {
  if (typeof document === 'undefined') return;
  let script = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"]#fesline-jsonld'
  );
  if (!script) {
    script = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
  }
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'fesline-jsonld';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);
}

export function applyClientSeoMetadata(meta: SeoMetadataPayload): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const origin = window.location.origin;
  const canonicalUrl = toAbsoluteUrl(meta.canonicalPath, origin);
  const imageUrl = toAbsoluteUrl(meta.imagePathOrUrl, origin);

  document.title = meta.title;

  upsertMetaTag('name', 'description', meta.description);
  upsertMetaTag('name', 'robots', meta.robots || 'index, follow');
  upsertLinkTag('canonical', canonicalUrl);

  // Open Graph
  upsertMetaTag('property', 'og:title', meta.title);
  upsertMetaTag('property', 'og:description', meta.description);
  upsertMetaTag('property', 'og:image', imageUrl);
  upsertMetaTag('property', 'og:image:secure_url', imageUrl.startsWith('https://') ? imageUrl : undefined);
  upsertMetaTag(
    'property',
    'og:image:width',
    meta.imageWidth ? String(meta.imageWidth) : undefined
  );
  upsertMetaTag(
    'property',
    'og:image:height',
    meta.imageHeight ? String(meta.imageHeight) : undefined
  );
  upsertMetaTag('property', 'og:image:alt', meta.imageAlt);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:type', meta.ogType);
  upsertMetaTag('property', 'og:site_name', SITE_NAME);

  // Article-specific Open Graph extensions
  if (meta.ogType === 'article') {
    upsertMetaTag('property', 'article:published_time', meta.publishedTime);
    upsertMetaTag('property', 'article:modified_time', meta.modifiedTime);
    upsertMetaTag('property', 'article:author', meta.author);
    upsertMetaTag('property', 'article:section', meta.section);
  } else {
    upsertMetaTag('property', 'article:published_time', undefined);
    upsertMetaTag('property', 'article:modified_time', undefined);
    upsertMetaTag('property', 'article:author', undefined);
    upsertMetaTag('property', 'article:section', undefined);
  }

  // Twitter / X Card
  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', meta.title);
  upsertMetaTag('name', 'twitter:description', meta.description);
  upsertMetaTag('name', 'twitter:image', imageUrl);
  upsertMetaTag('name', 'twitter:image:alt', meta.imageAlt);

  upsertJsonLd(meta.jsonLd);
}
