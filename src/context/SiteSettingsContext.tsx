import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../utils/supabase';

export interface SiteSettings {
  id: string;
  theme_mode: 'light' | 'dark' | 'auto';
  primary_color: string;
  secondary_color: string;
  bg_primary: string;
  text_primary: string;
  button_border_radius: string;
  button_padding_y: string;
  button_padding_x: string;
  button_font_size: string;
  button_hover_effect: string;
  button_alignment: string;
  navbar_bg: string;
  navbar_height: string;
  hero_animation_enabled: boolean;
  card_animation_enabled: boolean;
  homepage_cards: any[];
  custom_form_fields: any[];
  resume_pdf_settings: {
    font_family: string;
    margin_mm: number;
    header_font_size: number;
    body_font_size: number;
    section_order: string[];
  };
  projects_articles_config: {
    video_aspect_ratio: string;
    video_fit_mode: string;
    video_zoom_level: number;
    cad_viewer_auto_rotate: boolean;
  };
  profile_sections_config: Array<{
    id: string;
    title: string;
    visible: boolean;
    order: number;
  }>;
  footer_config: {
    copyright_text: string;
    bg_color: string;
    text_size: string;
    alignment: string;
    custom_links: any[];
  };
  updated_at?: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 'global_settings',
  theme_mode: 'light',
  primary_color: '#164e63', // cyan-900
  secondary_color: '#0891b2', // cyan-600
  bg_primary: '#dce1e8',
  text_primary: '#0f172a',
  button_border_radius: '0.75rem',
  button_padding_y: '0.45rem',
  button_padding_x: '0.85rem',
  button_font_size: '0.78rem',
  button_hover_effect: 'scale-subtle',
  button_alignment: 'center',
  navbar_bg: 'rgba(214, 220, 228, 0.95)',
  navbar_height: '4rem',
  hero_animation_enabled: true,
  card_animation_enabled: true,
  homepage_cards: [
    {
      id: 'profile',
      title: 'My Profile & Credentials',
      description: 'Portrait profile, comprehensive biography, direct ATS resume generator, verified engineering certifications, and contact channels.',
      icon_shape: 'circle',
      heading_color: '#0f172a',
      visible: true,
    },
    {
      id: 'projects',
      title: 'Engineering Portfolio',
      description: 'Interactive 3D CAD modeling, first-principles hand calculations, DFM/DFA analysis, and validated flight-ready mechanisms.',
      icon_shape: 'square',
      heading_color: '#0f172a',
      visible: true,
    },
    {
      id: 'articles',
      title: 'Engineering Articles',
      description: 'Peer-reviewed articles, finite element boundary condition studies, LaTeX derivations, schematics, and interactive engineering discussions.',
      icon_shape: 'square',
      heading_color: '#0f172a',
      visible: true,
    },
    {
      id: 'overview',
      title: 'Engineering Hub',
      description: 'Access different categories of Engineering Documents, Technical Archive, Inspirational Books, Christian literature, and more.',
      icon_shape: 'square',
      heading_color: '#0f172a',
      visible: true,
    },
    {
      id: 'messaging',
      title: 'Direct Messaging Channel',
      description: 'Direct inquiry workspace to discuss job roles, design consulting, tolerance reviews, or technical proposals in real time.',
      icon_shape: 'square',
      heading_color: '#0f172a',
      visible: true,
    },
  ],
  custom_form_fields: [],
  resume_pdf_settings: {
    font_family: 'Times New Roman',
    margin_mm: 14,
    header_font_size: 17,
    body_font_size: 9.5,
    section_order: ['summary', 'experience', 'credentials', 'skills', 'education', 'publications'],
  },
  projects_articles_config: {
    video_aspect_ratio: '16:9',
    video_fit_mode: 'cover',
    video_zoom_level: 100,
    cad_viewer_auto_rotate: true,
  },
  profile_sections_config: [
    { id: 'bio', title: 'Bio & About', visible: true, order: 1 },
    { id: 'experience', title: 'Experience & Career', visible: true, order: 2 },
    { id: 'research', title: 'Research & Publications', visible: true, order: 3 },
    { id: 'achievements', title: 'Achievements & Awards', visible: true, order: 4 },
  ],
  footer_config: {
    copyright_text: '© 2026 Festus, Olorunsogo Johnson · Fesline Mechanical Engineering',
    bg_color: '#d2d8e1',
    text_size: 'xs',
    alignment: 'center',
    custom_links: [],
  },
};

const LOCAL_STORAGE_KEY = 'fesline_site_settings_cache_v2';

interface SiteSettingsContextType {
  settings: SiteSettings;
  updateSettings: (newSettings: Partial<SiteSettings>) => Promise<boolean>;
  toggleDarkMode: () => void;
  exportThemeJson: () => string;
  importThemeJson: (jsonStr: string) => Promise<boolean>;
  resetToDefaults: () => Promise<boolean>;
  isDark: boolean;
}

const SiteSettingsContext = createContext<SiteSettingsContextType | null>(null);

function applyCssVariablesToRoot(settings: SiteSettings, isDarkTheme: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Primary CSS Variables
  const bgPrimary = isDarkTheme ? '#0b111e' : settings.bg_primary;
  const textPrimary = isDarkTheme ? '#f1f5f9' : settings.text_primary;
  const primaryColor = isDarkTheme ? '#38bdf8' : settings.primary_color;
  const secondaryColor = isDarkTheme ? '#0284c7' : settings.secondary_color;
  const cardBg = isDarkTheme ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.9)';
  const borderSubtle = isDarkTheme ? '#1e293b' : '#b8c6d4';
  const navbarBg = isDarkTheme ? 'rgba(11, 17, 30, 0.96)' : settings.navbar_bg;

  root.style.setProperty('--primary-color', primaryColor);
  root.style.setProperty('--secondary-color', secondaryColor);
  root.style.setProperty('--bg-primary', bgPrimary);
  root.style.setProperty('--text-primary', textPrimary);
  root.style.setProperty('--card-bg', cardBg);
  root.style.setProperty('--border-subtle', borderSubtle);
  root.style.setProperty('--button-radius', settings.button_border_radius);
  root.style.setProperty('--button-padding-y', settings.button_padding_y);
  root.style.setProperty('--button-padding-x', settings.button_padding_x);
  root.style.setProperty('--button-font-size', settings.button_font_size);
  root.style.setProperty('--navbar-bg', navbarBg);
  root.style.setProperty('--navbar-height', settings.navbar_height);

  // Set font family to Times New Roman universally
  root.style.setProperty('--font-serif', '"Times New Roman", Times, "Tinos", "Liberation Serif", serif');

  if (isDarkTheme) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const SiteSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return { ...DEFAULT_SITE_SETTINGS, ...parsed };
      }
    } catch {}
    return DEFAULT_SITE_SETTINGS;
  });

  const isDark = settings.theme_mode === 'dark';

  // Apply CSS variables on settings or theme_mode change
  useEffect(() => {
    applyCssVariablesToRoot(settings, isDark);
  }, [settings, isDark]);

  // Fetch from Supabase on mount
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('*')
          .eq('id', 'global_settings')
          .maybeSingle();

        if (error) {
          console.warn('[Site Settings] Fetch error, using cached settings:', error.message);
          return;
        }

        if (data && isMounted) {
          const merged: SiteSettings = {
            ...DEFAULT_SITE_SETTINGS,
            ...data,
            homepage_cards: Array.isArray(data.homepage_cards) && data.homepage_cards.length > 0
              ? data.homepage_cards
              : DEFAULT_SITE_SETTINGS.homepage_cards,
            profile_sections_config: Array.isArray(data.profile_sections_config) && data.profile_sections_config.length > 0
              ? data.profile_sections_config
              : DEFAULT_SITE_SETTINGS.profile_sections_config,
            resume_pdf_settings: {
              ...DEFAULT_SITE_SETTINGS.resume_pdf_settings,
              ...(data.resume_pdf_settings || {}),
            },
            projects_articles_config: {
              ...DEFAULT_SITE_SETTINGS.projects_articles_config,
              ...(data.projects_articles_config || {}),
            },
            footer_config: {
              ...DEFAULT_SITE_SETTINGS.footer_config,
              ...(data.footer_config || {}),
            },
          };

          setSettings(merged);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
      } catch (err) {
        console.warn('[Site Settings] Load catch:', err);
      }
    }

    loadSettings();

    // Supabase Realtime Subscription for instant live changes across clients
    const channel = supabase
      .channel('public:site_settings_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        (payload) => {
          if (payload?.new && isMounted) {
            const updated = payload.new as Partial<SiteSettings>;
            setSettings((prev) => {
              const next = { ...prev, ...updated };
              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
              } catch {}
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = useCallback(async (partialSettings: Partial<SiteSettings>): Promise<boolean> => {
    const updated: SiteSettings = {
      ...settings,
      ...partialSettings,
      updated_at: new Date().toISOString(),
    };

    // Optimistically update local state & cache
    setSettings(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {}

    // Persist to Supabase
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(updated, { onConflict: 'id' });

      if (error) {
        console.warn('[Site Settings Update Supabase Note]:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[Site Settings Update Error]:', e);
      return false;
    }
  }, [settings]);

  const toggleDarkMode = useCallback(() => {
    const nextMode = settings.theme_mode === 'dark' ? 'light' : 'dark';
    updateSettings({ theme_mode: nextMode });
  }, [settings.theme_mode, updateSettings]);

  const exportThemeJson = useCallback((): string => {
    return JSON.stringify({
      theme_mode: settings.theme_mode,
      primary_color: settings.primary_color,
      secondary_color: settings.secondary_color,
      bg_primary: settings.bg_primary,
      text_primary: settings.text_primary,
      button_border_radius: settings.button_border_radius,
      button_padding_y: settings.button_padding_y,
      button_padding_x: settings.button_padding_x,
      button_font_size: settings.button_font_size,
      button_hover_effect: settings.button_hover_effect,
      button_alignment: settings.button_alignment,
      navbar_bg: settings.navbar_bg,
      navbar_height: settings.navbar_height,
      hero_animation_enabled: settings.hero_animation_enabled,
      card_animation_enabled: settings.card_animation_enabled,
      homepage_cards: settings.homepage_cards,
      resume_pdf_settings: settings.resume_pdf_settings,
      projects_articles_config: settings.projects_articles_config,
      profile_sections_config: settings.profile_sections_config,
      footer_config: settings.footer_config,
    }, null, 2);
  }, [settings]);

  const importThemeJson = useCallback(async (jsonStr: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonStr);
      return await updateSettings(parsed);
    } catch (e) {
      console.error('[Import Theme JSON Error]:', e);
      return false;
    }
  }, [updateSettings]);

  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    return await updateSettings(DEFAULT_SITE_SETTINGS);
  }, [updateSettings]);

  return (
    <SiteSettingsContext.Provider
      value={{
        settings,
        updateSettings,
        toggleDarkMode,
        exportThemeJson,
        importThemeJson,
        resetToDefaults,
        isDark,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export function useSiteSettings(): SiteSettingsContextType {
  const context = useContext(SiteSettingsContext);
  if (!context) {
    throw new Error('useSiteSettings must be used within a SiteSettingsProvider');
  }
  return context;
}
