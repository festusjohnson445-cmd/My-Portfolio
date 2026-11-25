export type AppPortfolioPart =
  | 'home'
  | 'profile'
  | 'messaging'
  | 'overview'
  | 'projects'
  | 'articles'
  | 'documents'
  | 'admin';

export type ProfileSubsectionId =
  | 'profile-bio'
  | 'profile-experience'
  | 'profile-publications'
  | 'profile-achievements';

export interface SeoMetadataPayload {
  title: string;
  description: string;
  canonicalPath: string;
  ogType: 'website' | 'profile' | 'article';
  imagePathOrUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt: string;
  robots?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  jsonLd: Record<string, unknown>;
}

export const SITE_NAME = 'Fesline';
export const OWNER_FULL_NAME = 'Festus, Olorunsogo Johnson';
export const OWNER_SHORT_NAME = 'Festus Johnson';
export const DEFAULT_BANNER_PATH = '/og-banner.jpg';
export const DEFAULT_BANNER_WIDTH = 1200;
export const DEFAULT_BANNER_HEIGHT = 630;
export const DEFAULT_BANNER_ALT =
  'Fesline — Festus Olorunsogo Johnson | Mechanical Engineering, CAD Design, Web Development & AI';

const DEFAULT_PERSON_SCHEMA = {
  '@type': 'Person',
  name: 'Festus, Olorunsogo Johnson',
  alternateName: ['Festus Johnson', 'Fesline', 'Feslonix'],
  jobTitle: 'Lead Mechanical Design Engineer',
  email: 'festusjohnson028@gmail.com',
  knowsAbout: [
    'Mechanical Engineering',
    'Finite Element Analysis (FEA)',
    'Computer-Aided Design (CAD)',
    'ASME Y14.5 GD&T',
    'Design for Manufacturability (DFM/DFA)',
    'Robotics and Mechatronics',
    'Rapid Prototyping and CNC Machining',
    'Full-Stack Web Development',
  ],
  hasCredential: [
    {
      '@type': 'EducationalOccupationalCredential',
      name: 'Certified SolidWorks Professional (CSWP)',
      credentialCategory: 'Professional Certification',
    },
    {
      '@type': 'EducationalOccupationalCredential',
      name: 'ASME GDTP Geometric Dimensioning & Tolerancing Professional',
      credentialCategory: 'Professional Certification',
    },
    {
      '@type': 'EducationalOccupationalCredential',
      name: 'Fundamentals of Engineering (FE) Mechanical Exam',
      credentialCategory: 'Engineering Licensure Track',
    },
  ],
};

export interface ParsedAppRoute {
  part: AppPortfolioPart;
  sectionId?: ProfileSubsectionId;
  projectSlugOrId?: string;
  articleSlugOrId?: string;
  canonicalPath: string;
}

const PROFILE_SUBSECTION_PATHS: Record<ProfileSubsectionId, string> = {
  'profile-bio': '/profile/bio',
  'profile-experience': '/profile/experience',
  'profile-publications': '/profile/publications',
  'profile-achievements': '/profile/achievements',
};

const PATH_TO_SUBSECTION: Record<string, ProfileSubsectionId> = {
  '/profile/bio': 'profile-bio',
  '/bio': 'profile-bio',
  '/about': 'profile-bio',
  '/profile/experience': 'profile-experience',
  '/experience': 'profile-experience',
  '/career': 'profile-experience',
  '/profile/publications': 'profile-publications',
  '/publications': 'profile-publications',
  '/research': 'profile-publications',
  '/profile/achievements': 'profile-achievements',
  '/achievements': 'profile-achievements',
  '/awards': 'profile-achievements',
};

export function getCanonicalPathForPart(
  part: AppPortfolioPart,
  sectionId?: string,
  itemSlugOrId?: string
): string {
  if (part === 'home') return '/';
  if (part === 'profile') {
    if (sectionId && sectionId in PROFILE_SUBSECTION_PATHS) {
      return PROFILE_SUBSECTION_PATHS[sectionId as ProfileSubsectionId];
    }
    return '/profile';
  }
  if (part === 'overview') return '/hub';
  if (part === 'projects') {
    return itemSlugOrId ? `/projects/${encodeURIComponent(itemSlugOrId)}` : '/projects';
  }
  if (part === 'articles') {
    return itemSlugOrId ? `/articles/${encodeURIComponent(itemSlugOrId)}` : '/articles';
  }
  if (part === 'messaging') return '/messaging';
  if (part === 'documents') return '/career-studio';
  if (part === 'admin') return '/admin';
  return '/';
}

export function resolveRouteFromParts(pathname: string, hash = '', search = ''): ParsedAppRoute {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const lowerPath = cleanPath.toLowerCase();
  const cleanHash = (hash || '').replace(/^#/, '').trim().toLowerCase();
  const params = new URLSearchParams(search || '');

  // Query parameter overrides (backward compatibility)
  const qProject = params.get('project')?.trim();
  const qArticle = params.get('article')?.trim();
  if (qProject) {
    return {
      part: 'projects',
      projectSlugOrId: qProject,
      canonicalPath: `/projects/${encodeURIComponent(qProject)}`,
    };
  }
  if (qArticle) {
    return {
      part: 'articles',
      articleSlugOrId: qArticle,
      canonicalPath: `/articles/${encodeURIComponent(qArticle)}`,
    };
  }

  // Clean path matching first (crawlers & modern links)
  if (lowerPath in PATH_TO_SUBSECTION) {
    const sub = PATH_TO_SUBSECTION[lowerPath];
    return {
      part: 'profile',
      sectionId: sub,
      canonicalPath: PROFILE_SUBSECTION_PATHS[sub],
    };
  }

  if (lowerPath === '/profile') {
    if (cleanHash && cleanHash in PROFILE_SUBSECTION_PATHS) {
      const sub = cleanHash as ProfileSubsectionId;
      return { part: 'profile', sectionId: sub, canonicalPath: PROFILE_SUBSECTION_PATHS[sub] };
    }
    return { part: 'profile', canonicalPath: '/profile' };
  }

  if (lowerPath === '/hub' || lowerPath === '/overview' || lowerPath === '/engineering-hub') {
    return { part: 'overview', canonicalPath: '/hub' };
  }

  if (lowerPath === '/projects') {
    return { part: 'projects', canonicalPath: '/projects' };
  }
  if (lowerPath.startsWith('/projects/')) {
    const slug = decodeURIComponent(cleanPath.slice('/projects/'.length)).trim();
    if (slug) {
      return {
        part: 'projects',
        projectSlugOrId: slug,
        canonicalPath: `/projects/${encodeURIComponent(slug)}`,
      };
    }
    return { part: 'projects', canonicalPath: '/projects' };
  }

  if (lowerPath === '/articles' || lowerPath === '/blog') {
    return { part: 'articles', canonicalPath: '/articles' };
  }
  if (lowerPath.startsWith('/articles/') || lowerPath.startsWith('/blog/')) {
    const prefix = lowerPath.startsWith('/articles/') ? '/articles/' : '/blog/';
    const slug = decodeURIComponent(cleanPath.slice(prefix.length)).trim();
    if (slug) {
      return {
        part: 'articles',
        articleSlugOrId: slug,
        canonicalPath: `/articles/${encodeURIComponent(slug)}`,
      };
    }
    return { part: 'articles', canonicalPath: '/articles' };
  }

  if (
    lowerPath === '/messaging' ||
    lowerPath === '/contact' ||
    lowerPath === '/chat' ||
    lowerPath === '/messages'
  ) {
    return { part: 'messaging', canonicalPath: '/messaging' };
  }

  if (
    lowerPath === '/career-studio' ||
    lowerPath === '/documents' ||
    lowerPath === '/doc-studio'
  ) {
    return { part: 'documents', canonicalPath: '/career-studio' };
  }

  if (lowerPath === '/admin') {
    return { part: 'admin', canonicalPath: '/admin' };
  }

  // Fallback to legacy hash routing on "/"
  if (cleanHash) {
    if (cleanHash in PROFILE_SUBSECTION_PATHS) {
      const sub = cleanHash as ProfileSubsectionId;
      return {
        part: 'profile',
        sectionId: sub,
        canonicalPath: PROFILE_SUBSECTION_PATHS[sub],
      };
    }
    if (cleanHash === 'profile') return { part: 'profile', canonicalPath: '/profile' };
    if (cleanHash === 'overview' || cleanHash === 'hub') {
      return { part: 'overview', canonicalPath: '/hub' };
    }
    if (cleanHash === 'projects') return { part: 'projects', canonicalPath: '/projects' };
    if (cleanHash === 'articles' || cleanHash === 'blog') {
      return { part: 'articles', canonicalPath: '/articles' };
    }
    if (cleanHash === 'documents' || cleanHash === 'doc-studio') {
      return { part: 'documents', canonicalPath: '/career-studio' };
    }
    if (cleanHash === 'admin') return { part: 'admin', canonicalPath: '/admin' };
    if (
      cleanHash === 'metrology' ||
      cleanHash === 'cad-comparison' ||
      cleanHash === 'gdt-drawings' ||
      cleanHash === 'messaging' ||
      cleanHash === 'toolbox' ||
      cleanHash === 'chat' ||
      cleanHash === 'credentials' ||
      cleanHash === 'contact'
    ) {
      return { part: 'messaging', canonicalPath: '/messaging' };
    }
  }

  return { part: 'home', canonicalPath: '/' };
}

export function cleanPlainText(input: string | undefined | null, maxLength = 200): string {
  if (!input) return '';
  const stripped = input
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/[#*_`>|[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return '';
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.slice(0, maxLength - 1).trimEnd()}…`;
}

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|avi|mkv|m3u8)(\?.*)?$/i;
const DOC_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|step|stp|iges|igs|sldprt|sldasm|dwg|dxf)(\?.*)?$/i;

export function isShareableImageUrl(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return false;
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://') && !trimmed.startsWith('/')) {
    return false;
  }
  if (VIDEO_EXT_RE.test(trimmed) || DOC_EXT_RE.test(trimmed)) return false;
  return true;
}

export interface MediaPreviewCandidate {
  url?: string;
  jpegUrl?: string;
  webpUrl?: string;
  posterUrl?: string;
  width?: number;
  height?: number;
}

export function resolveFeaturedImageOrBanner(candidates: Array<string | MediaPreviewCandidate | null | undefined>): {
  imagePathOrUrl: string;
  width?: number;
  height?: number;
  usesDefaultBanner: boolean;
} {
  for (const item of candidates) {
    if (!item) continue;
    if (typeof item === 'string') {
      if (isShareableImageUrl(item)) {
        return { imagePathOrUrl: item.trim(), usesDefaultBanner: false };
      }
      continue;
    }
    const preferred = [item.jpegUrl, item.url, item.posterUrl, item.webpUrl].find((u) =>
      isShareableImageUrl(u)
    );
    if (preferred) {
      return {
        imagePathOrUrl: preferred.trim(),
        width: typeof item.width === 'number' && item.width > 0 ? item.width : undefined,
        height: typeof item.height === 'number' && item.height > 0 ? item.height : undefined,
        usesDefaultBanner: false,
      };
    }
  }
  return {
    imagePathOrUrl: DEFAULT_BANNER_PATH,
    width: DEFAULT_BANNER_WIDTH,
    height: DEFAULT_BANNER_HEIGHT,
    usesDefaultBanner: true,
  };
}

export function toAbsoluteUrl(pathOrUrl: string, origin: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  if (!pathOrUrl) return cleanOrigin;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${cleanOrigin}${normalizedPath}`;
}

export function getPageSeoMetadata(route: ParsedAppRoute, origin = ''): SeoMetadataPayload {
  const cleanOrigin = origin.replace(/\/+$/, '');

  if (route.part === 'profile') {
    if (route.sectionId === 'profile-bio') {
      return {
        title: `Bio & About — ${OWNER_SHORT_NAME} | ${SITE_NAME}`,
        description:
          'Biography, engineering philosophy, core competencies, CSWP & ASME GDTP credentials, and multidisciplinary background of Festus Olorunsogo Johnson.',
        canonicalPath: '/profile/bio',
        ogType: 'profile',
        imagePathOrUrl: DEFAULT_BANNER_PATH,
        imageWidth: DEFAULT_BANNER_WIDTH,
        imageHeight: DEFAULT_BANNER_HEIGHT,
        imageAlt: DEFAULT_BANNER_ALT,
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          url: cleanOrigin ? `${cleanOrigin}/profile/bio` : '/profile/bio',
          name: `Bio & About — ${OWNER_SHORT_NAME}`,
          mainEntity: DEFAULT_PERSON_SCHEMA,
        },
      };
    }
    if (route.sectionId === 'profile-experience') {
      return {
        title: `Experience & Career — ${OWNER_SHORT_NAME} | ${SITE_NAME}`,
        description:
          'Industry leadership, mechanical hardware design engineering roles, airborne gimbal systems, CAD/FEA production workflows, and career milestones.',
        canonicalPath: '/profile/experience',
        ogType: 'profile',
        imagePathOrUrl: DEFAULT_BANNER_PATH,
        imageWidth: DEFAULT_BANNER_WIDTH,
        imageHeight: DEFAULT_BANNER_HEIGHT,
        imageAlt: DEFAULT_BANNER_ALT,
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          url: cleanOrigin ? `${cleanOrigin}/profile/experience` : '/profile/experience',
          name: `Experience & Career — ${OWNER_SHORT_NAME}`,
          mainEntity: DEFAULT_PERSON_SCHEMA,
        },
      };
    }
    if (route.sectionId === 'profile-publications') {
      return {
        title: `Research & Publications — ${OWNER_SHORT_NAME} | ${SITE_NAME}`,
        description:
          'Peer-reviewed engineering research papers, technical methodologies, thermal and structural analyses, and published studies by Festus Johnson.',
        canonicalPath: '/profile/publications',
        ogType: 'profile',
        imagePathOrUrl: DEFAULT_BANNER_PATH,
        imageWidth: DEFAULT_BANNER_WIDTH,
        imageHeight: DEFAULT_BANNER_HEIGHT,
        imageAlt: DEFAULT_BANNER_ALT,
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          url: cleanOrigin ? `${cleanOrigin}/profile/publications` : '/profile/publications',
          name: `Research & Publications — ${OWNER_SHORT_NAME}`,
          about: DEFAULT_PERSON_SCHEMA,
        },
      };
    }
    if (route.sectionId === 'profile-achievements') {
      return {
        title: `Achievements & Awards — ${OWNER_SHORT_NAME} | ${SITE_NAME}`,
        description:
          'Honors, engineering distinctions, CSWP and ASME GDTP certifications, academic awards, and technical leadership milestones of Festus Johnson.',
        canonicalPath: '/profile/achievements',
        ogType: 'profile',
        imagePathOrUrl: DEFAULT_BANNER_PATH,
        imageWidth: DEFAULT_BANNER_WIDTH,
        imageHeight: DEFAULT_BANNER_HEIGHT,
        imageAlt: DEFAULT_BANNER_ALT,
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          url: cleanOrigin ? `${cleanOrigin}/profile/achievements` : '/profile/achievements',
          name: `Achievements & Awards — ${OWNER_SHORT_NAME}`,
          mainEntity: DEFAULT_PERSON_SCHEMA,
        },
      };
    }

    return {
      title: `Profile — ${OWNER_FULL_NAME} | ${SITE_NAME}`,
      description:
        'Official engineering profile of Festus Olorunsogo Johnson: bio, mechanical design experience, research publications, achievements, and verified credentials.',
      canonicalPath: '/profile',
      ogType: 'profile',
      imagePathOrUrl: DEFAULT_BANNER_PATH,
      imageWidth: DEFAULT_BANNER_WIDTH,
      imageHeight: DEFAULT_BANNER_HEIGHT,
      imageAlt: DEFAULT_BANNER_ALT,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: cleanOrigin ? `${cleanOrigin}/profile` : '/profile',
        name: `Profile — ${OWNER_FULL_NAME}`,
        mainEntity: DEFAULT_PERSON_SCHEMA,
      },
    };
  }

  if (route.part === 'overview') {
    return {
      title: `Engineering Hub — Technical Documents & Blueprints | ${SITE_NAME}`,
      description:
        'Explore verified engineering documents, CAD drawings, FEA calculation sheets, technical manuals, and downloadable resources on Fesline Engineering Hub.',
      canonicalPath: '/hub',
      ogType: 'website',
      imagePathOrUrl: DEFAULT_BANNER_PATH,
      imageWidth: DEFAULT_BANNER_WIDTH,
      imageHeight: DEFAULT_BANNER_HEIGHT,
      imageAlt: DEFAULT_BANNER_ALT,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        url: cleanOrigin ? `${cleanOrigin}/hub` : '/hub',
        name: 'Fesline Engineering Hub',
        description:
          'Curated repository of mechanical design specifications, engineering drawings, and technical documentation.',
      },
    };
  }

  if (route.part === 'projects') {
    return {
      title: `Engineering Projects & CAD Studies | ${SITE_NAME}`,
      description:
        'Published mechanical engineering projects, interactive 3D CAD assemblies, GD&T production drawings, FEA optimizations, and robotics builds by Festus Johnson.',
      canonicalPath: '/projects',
      ogType: 'website',
      imagePathOrUrl: DEFAULT_BANNER_PATH,
      imageWidth: DEFAULT_BANNER_WIDTH,
      imageHeight: DEFAULT_BANNER_HEIGHT,
      imageAlt: DEFAULT_BANNER_ALT,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        url: cleanOrigin ? `${cleanOrigin}/projects` : '/projects',
        name: 'Fesline Engineering Projects',
        author: DEFAULT_PERSON_SCHEMA,
      },
    };
  }

  if (route.part === 'articles') {
    return {
      title: `Engineering Blog & Technical Articles | ${SITE_NAME}`,
      description:
        'In-depth mechanical design articles, first-principles engineering calculations, CAD/DFM guides, and web engineering publications on Fesline.',
      canonicalPath: '/articles',
      ogType: 'website',
      imagePathOrUrl: DEFAULT_BANNER_PATH,
      imageWidth: DEFAULT_BANNER_WIDTH,
      imageHeight: DEFAULT_BANNER_HEIGHT,
      imageAlt: DEFAULT_BANNER_ALT,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        url: cleanOrigin ? `${cleanOrigin}/articles` : '/articles',
        name: 'Fesline Engineering Blog & Articles',
        author: DEFAULT_PERSON_SCHEMA,
      },
    };
  }

  if (route.part === 'messaging') {
    return {
      title: `Direct Messaging & Technical Inquiries | ${SITE_NAME}`,
      description:
        'Start a direct conversation with Festus Johnson (Fesline) regarding mechanical engineering projects, CAD design services, consulting, or full-stack collaborations.',
      canonicalPath: '/messaging',
      ogType: 'website',
      imagePathOrUrl: DEFAULT_BANNER_PATH,
      imageWidth: DEFAULT_BANNER_WIDTH,
      imageHeight: DEFAULT_BANNER_HEIGHT,
      imageAlt: DEFAULT_BANNER_ALT,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        url: cleanOrigin ? `${cleanOrigin}/messaging` : '/messaging',
        name: 'Fesline Direct Messaging',
        mainEntity: DEFAULT_PERSON_SCHEMA,
      },
    };
  }

  if (route.part === 'documents') {
    return {
      title: `Career & Academic Documents Studio | ${SITE_NAME}`,
      description:
        'Structured international engineering CV, resume, and academic portfolio studio crafted for technical professionals and researchers.',
      canonicalPath: '/career-studio',
      ogType: 'website',
      imagePathOrUrl: DEFAULT_BANNER_PATH,
      imageWidth: DEFAULT_BANNER_WIDTH,
      imageHeight: DEFAULT_BANNER_HEIGHT,
      imageAlt: DEFAULT_BANNER_ALT,
      robots: 'index, follow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        url: cleanOrigin ? `${cleanOrigin}/career-studio` : '/career-studio',
        name: 'Fesline Career Studio',
      },
    };
  }

  if (route.part === 'admin') {
    return {
      title: `Admin Dashboard | ${SITE_NAME}`,
      description: 'Restricted Fesline portfolio administration portal.',
      canonicalPath: '/admin',
      ogType: 'website',
      imagePathOrUrl: DEFAULT_BANNER_PATH,
      imageWidth: DEFAULT_BANNER_WIDTH,
      imageHeight: DEFAULT_BANNER_HEIGHT,
      imageAlt: DEFAULT_BANNER_ALT,
      robots: 'noindex, nofollow',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Fesline Admin Dashboard',
      },
    };
  }

  // Home default
  return {
    title: `${SITE_NAME} — ${OWNER_SHORT_NAME} | Mechanical Engineer, CAD Designer & Web Developer`,
    description:
      'Official website of Festus Olorunsogo Johnson (Fesline). Mechanical Engineering, CAD Design, FEA & DFM Analysis, Technical Publications, Web Development & AI.',
    canonicalPath: '/',
    ogType: 'website',
    imagePathOrUrl: DEFAULT_BANNER_PATH,
    imageWidth: DEFAULT_BANNER_WIDTH,
    imageHeight: DEFAULT_BANNER_HEIGHT,
    imageAlt: DEFAULT_BANNER_ALT,
    robots: 'index, follow',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url: cleanOrigin || '/',
      name: `${SITE_NAME} — ${OWNER_SHORT_NAME}`,
      description:
        'Mechanical Engineering, CAD Design, Technical Publications, Web Development & AI.',
      publisher: DEFAULT_PERSON_SCHEMA,
    },
  };
}

export interface ProjectSeoInput {
  id: string;
  slug?: string;
  title: string;
  category?: string;
  description?: string;
  overview?: string;
  thumbnailUrl?: string;
  images?: MediaPreviewCandidate[];
  toolsUsed?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export function buildProjectSeoMetadata(
  project: ProjectSeoInput,
  origin = ''
): SeoMetadataPayload {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const canonicalPath = `/projects/${encodeURIComponent(project.slug || project.id)}`;
  const titleText = project.title?.trim() || 'Engineering Project';
  const descText =
    cleanPlainText(project.description || project.overview, 190) ||
    `${titleText} — Mechanical engineering design study and technical portfolio showcase on Fesline.`;

  const featured = resolveFeaturedImageOrBanner([
    project.thumbnailUrl,
    ...(Array.isArray(project.images) ? project.images : []),
  ]);

  const absUrl = cleanOrigin ? toAbsoluteUrl(canonicalPath, cleanOrigin) : canonicalPath;
  const absImg = cleanOrigin
    ? toAbsoluteUrl(featured.imagePathOrUrl, cleanOrigin)
    : featured.imagePathOrUrl;

  return {
    title: `${titleText} | Projects — ${SITE_NAME}`,
    description: descText,
    canonicalPath,
    ogType: 'article',
    imagePathOrUrl: featured.imagePathOrUrl,
    imageWidth: featured.width,
    imageHeight: featured.height,
    imageAlt: featured.usesDefaultBanner
      ? DEFAULT_BANNER_ALT
      : `${titleText} — ${project.category || 'Engineering Project'} | ${SITE_NAME}`,
    robots: 'index, follow',
    author: OWNER_FULL_NAME,
    publishedTime: project.createdAt,
    modifiedTime: project.updatedAt || project.createdAt,
    section: project.category || 'Mechanical Engineering',
    tags: Array.isArray(project.toolsUsed) ? project.toolsUsed : undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      headline: titleText,
      name: titleText,
      description: descText,
      url: absUrl,
      image: absImg,
      datePublished: project.createdAt,
      dateModified: project.updatedAt || project.createdAt,
      author: DEFAULT_PERSON_SCHEMA,
      genre: project.category || 'Mechanical Engineering',
    },
  };
}

export interface ArticleSeoInput {
  id: string;
  slug?: string;
  title: string;
  summary?: string;
  tldr?: string;
  content?: string;
  category?: string;
  authorName?: string;
  thumbnailUrl?: string;
  heroMedia?: MediaPreviewCandidate & { type?: string };
  images?: MediaPreviewCandidate[];
  tags?: string[];
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function buildArticleSeoMetadata(
  article: ArticleSeoInput,
  origin = ''
): SeoMetadataPayload {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const canonicalPath = `/articles/${encodeURIComponent(article.slug || article.id)}`;
  const titleText = article.title?.trim() || 'Technical Article';
  const descText =
    cleanPlainText(article.summary || article.tldr || article.content, 190) ||
    `${titleText} — Engineering insights and technical publication on Fesline.`;

  const heroCandidate =
    article.heroMedia && article.heroMedia.type !== 'none'
      ? {
          url: article.heroMedia.url,
          jpegUrl: article.heroMedia.jpegUrl,
          webpUrl: article.heroMedia.webpUrl,
          posterUrl: article.heroMedia.posterUrl,
        }
      : undefined;

  const featured = resolveFeaturedImageOrBanner([
    article.thumbnailUrl,
    heroCandidate,
    ...(Array.isArray(article.images) ? article.images : []),
  ]);

  const absUrl = cleanOrigin ? toAbsoluteUrl(canonicalPath, cleanOrigin) : canonicalPath;
  const absImg = cleanOrigin
    ? toAbsoluteUrl(featured.imagePathOrUrl, cleanOrigin)
    : featured.imagePathOrUrl;
  const authorLabel = article.authorName?.trim() || OWNER_FULL_NAME;

  return {
    title: `${titleText} | Articles — ${SITE_NAME}`,
    description: descText,
    canonicalPath,
    ogType: 'article',
    imagePathOrUrl: featured.imagePathOrUrl,
    imageWidth: featured.width,
    imageHeight: featured.height,
    imageAlt: featured.usesDefaultBanner
      ? DEFAULT_BANNER_ALT
      : `${titleText} — ${article.category || 'Technical Article'} | ${SITE_NAME}`,
    robots: 'index, follow',
    author: authorLabel,
    publishedTime: article.publishedAt || article.createdAt,
    modifiedTime: article.updatedAt || article.publishedAt || article.createdAt,
    section: article.category || 'Engineering',
    tags: Array.isArray(article.tags) ? article.tags : undefined,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: titleText,
      description: descText,
      url: absUrl,
      image: absImg,
      datePublished: article.publishedAt || article.createdAt,
      dateModified: article.updatedAt || article.publishedAt || article.createdAt,
      author: {
        '@type': 'Person',
        name: authorLabel,
      },
      publisher: {
        '@type': 'Person',
        name: OWNER_FULL_NAME,
      },
      articleSection: article.category || 'Engineering',
    },
  };
}
