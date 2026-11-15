export interface SiteSettings {
  id?: string;
  updated_at?: string;

  // 1. Theme & Animations
  activeThemeId: 'slate' | 'obsidian' | 'cyan' | 'blueprint' | 'sand' | 'titanium' | 'custom';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  borderColor: string;
  headingColor: string;
  textColor: string;
  customCss?: string;
  heroButtonSize: 'small' | 'normal' | 'large';
  
  // Animation Effects
  enableAmbientGlow: boolean;
  enableMeshDrift: boolean;
  enableCardHoverLift: boolean;
  enableSmoothEntrance: boolean;

  // Navbar Settings
  navSize: 'compact' | 'standard' | 'spacious';
  navBgColor: string;
  navBlur: boolean;
  navIconSize: 'small' | 'medium' | 'large';

  // 2. Button Customizer
  buttonSize: 'small' | 'medium' | 'large';
  buttonPrimaryColor: string;
  buttonSecondaryColor: string;
  buttonAlignment: 'left' | 'center' | 'right' | 'justify';
  buttonBorderRadius: 'sharp' | 'subtle' | 'rounded' | 'pill';
  buttonTextTransform: 'uppercase' | 'capitalize' | 'none';

  // 3. Homepage Cards Editor
  cardBgColor: string;
  cardBorderColor: string;
  cardTextColor: string;
  cardTextAlignment: 'left' | 'center' | 'justify';
  cardHeadingColor: string;
  cardHeadingAlignment: 'center' | 'left' | 'right';
  cardIconSize: 'small' | 'medium' | 'large';
  cardIconShape: 'rounded-square' | 'circle' | 'sharp' | 'squircle';

  // 4. Form Customizer & Placeholders
  formPlaceholders: Record<string, string>;
  customFormFields: Array<{
    id: string;
    targetForm: 'projects' | 'articles' | 'contact' | 'profile';
    label: string;
    type: 'text' | 'textarea' | 'select' | 'number';
    placeholder: string;
    options?: string[];
    required: boolean;
  }>;

  // 5. Download Resume & PDF Structure
  resumeSectionOrder: string[];
  resumeSectionVisibility: Record<string, boolean>;
  resumeTextSize: 'small' | 'medium' | 'standard';
  resumePageMargins: 'compact' | 'standard' | 'relaxed';
  resumeFontFamily: 'serif' | 'sans' | 'mono';

  // 6. Article & Project Page, and Video Player Customizer
  videoAspectRatio: '16:9' | '4:3' | '1:1' | '21:9';
  videoZoomState: '100%' | '110%' | '125%';
  videoFitness: 'contain' | 'cover';
  videoOrientation: 'horizontal' | 'vertical';
  videoBorderRadius: 'sharp' | 'subtle' | 'rounded';
  projectCardFormat: 'compact' | 'detailed' | 'grid';
  articleCardFormat: 'editorial' | 'magazine' | 'compact';

  // 7. Profile Page Sections Customizer
  profileHeadings: {
    bio: { text: string; size: 'xs' | 'sm' | 'base'; alignment: 'center' | 'left' | 'right'; visible: boolean };
    experience: { text: string; size: 'xs' | 'sm' | 'base'; alignment: 'center' | 'left' | 'right'; visible: boolean };
    publications: { text: string; size: 'xs' | 'sm' | 'base'; alignment: 'center' | 'left' | 'right'; visible: boolean };
    achievements: { text: string; size: 'xs' | 'sm' | 'base'; alignment: 'center' | 'left' | 'right'; visible: boolean };
    credentials: { text: string; size: 'xs' | 'sm' | 'base'; alignment: 'center' | 'left' | 'right'; visible: boolean };
    follow: { text: string; size: 'xs' | 'sm' | 'base'; alignment: 'center' | 'left' | 'right'; visible: boolean };
  };
  honorsCards: Array<{
    id: string;
    badge: string;
    title: string;
    description: string;
    tag?: string;
    subtitle?: string;
  }>;
  customProfileSections: Array<{
    id: string;
    title: string;
    content: string;
    alignment: 'center' | 'left';
  }>;

  // 8. Footer Redesign & Customizer
  footerAlignment: 'center' | 'left' | 'justify' | 'split';
  footerCopyrightText: string;
  footerDisclaimerText: string;
  footerShowSocial: boolean;
  footerShowLock: boolean;
  footerCustomLinks: Array<{ id: string; label: string; url: string }>;
  customFooterSections?: Array<{ id: string; title: string; content: string }>;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  activeThemeId: 'slate',
  primaryColor: '#155e75',      // cyan-800
  secondaryColor: '#334155',    // slate-700
  accentColor: '#0891b2',       // cyan-600
  bgColor: '#dce1e8',           // soft industrial canvas
  surfaceColor: '#ffffff',
  borderColor: '#b8c6d4',
  headingColor: '#020617',      // slate-950
  textColor: '#1e293b',         // slate-800
  heroButtonSize: 'normal',

  enableAmbientGlow: true,
  enableMeshDrift: true,
  enableCardHoverLift: true,
  enableSmoothEntrance: true,

  navSize: 'standard',
  navBgColor: '#243346',
  navBlur: true,
  navIconSize: 'medium',

  buttonSize: 'small',
  buttonPrimaryColor: '#155e75',
  buttonSecondaryColor: '#e2e8f0',
  buttonAlignment: 'left',
  buttonBorderRadius: 'subtle',
  buttonTextTransform: 'none',

  cardBgColor: '#ffffff',
  cardBorderColor: '#b8c6d4',
  cardTextColor: '#334155',
  cardTextAlignment: 'justify',
  cardHeadingColor: '#020617',
  cardHeadingAlignment: 'center',
  cardIconSize: 'medium',
  cardIconShape: 'rounded-square',

  formPlaceholders: {
    projectTitle: 'Enter engineering project title...',
    projectCategory: 'Mechanism Design / FEA Analysis...',
    projectOverview: 'Provide high-level project summary and design intent...',
    projectSpecs: 'GD&T tolerances, cycle rate, torque rating...',
    articleTitle: 'Enter technical article heading...',
    articleCategory: 'Mechanical Principles / CAD Standards...',
    articleContent: 'Write detailed engineering breakdown or methodology...',
  },
  customFormFields: [],

  resumeSectionOrder: ['bio', 'experience', 'publications', 'skills', 'achievements', 'credentials'],
  resumeSectionVisibility: {
    bio: true,
    experience: true,
    publications: true,
    skills: true,
    achievements: true,
    credentials: true,
  },
  resumeTextSize: 'small',
  resumePageMargins: 'compact',
  resumeFontFamily: 'serif',

  videoAspectRatio: '16:9',
  videoZoomState: '100%',
  videoFitness: 'contain',
  videoOrientation: 'horizontal',
  videoBorderRadius: 'rounded',
  projectCardFormat: 'compact',
  articleCardFormat: 'editorial',

  profileHeadings: {
    bio: { text: 'Bio & About', size: 'sm', alignment: 'center', visible: true },
    experience: { text: 'Experience & Career', size: 'sm', alignment: 'center', visible: true },
    publications: { text: 'Research & Publications', size: 'sm', alignment: 'center', visible: true },
    achievements: { text: 'Achievements & Awards', size: 'sm', alignment: 'center', visible: true },
    credentials: { text: 'Verified Documents & Credentials', size: 'sm', alignment: 'center', visible: true },
    follow: { text: 'Follow Me', size: 'sm', alignment: 'center', visible: true },
  },
  honorsCards: [
    {
      id: 'honor-1',
      badge: 'Academic Merit',
      title: "Dean's Honor Roll",
      description: 'Excellence in Mechanical Engineering design, thermodynamics and machine design.',
    },
    {
      id: 'honor-2',
      badge: 'Society Leadership',
      title: 'ASME Active Student Member',
      description: 'Leading CAD workshops, SolidWorks modeling sprints, and peer tutoring sessions.',
    },
    {
      id: 'honor-3',
      badge: 'Design Awards',
      title: 'Best Senior Capstone Prototype',
      description: '1st place for precision high-efficiency mechanism design and FEA stress optimization.',
    },
  ],
  customProfileSections: [],

  footerAlignment: 'center',
  footerCopyrightText: '© 2026 Festus, Olorunsogo Johnson · Fesline Mechanical Engineering',
  footerDisclaimerText: '',
  footerShowSocial: true,
  footerShowLock: true,
  footerCustomLinks: [],
};
