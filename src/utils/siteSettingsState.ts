import { useState, useEffect } from 'react';
import { SiteSettings, DEFAULT_SITE_SETTINGS } from '../types/settings';
import { supabase } from './supabase';

const SETTINGS_STORAGE_KEY = 'fesline_site_settings_v2';
const SETTINGS_CHANGE_EVENT = 'fesline-settings-changed';

/**
 * Reads initial settings synchronously from localStorage for ZERO-FLICKER instant startup
 */
export function getStoredSettings(): SiteSettings {
  if (typeof window === 'undefined') return DEFAULT_SITE_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SITE_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed reading site settings from storage:', e);
  }
  return DEFAULT_SITE_SETTINGS;
}

/**
 * Injects dynamic CSS variables directly into :root
 * This ensures lightweight, instantaneous real-time styling with 0% data waste
 */
export function applySiteSettingsToDom(settings: SiteSettings) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // Colors
  root.style.setProperty('--site-primary', settings.primaryColor);
  root.style.setProperty('--site-secondary', settings.secondaryColor);
  root.style.setProperty('--site-accent', settings.accentColor);
  root.style.setProperty('--site-bg', settings.bgColor);
  root.style.setProperty('--site-surface', settings.surfaceColor);
  root.style.setProperty('--site-border', settings.borderColor);
  root.style.setProperty('--site-heading', settings.headingColor);
  root.style.setProperty('--site-text', settings.textColor);
  root.style.setProperty('--site-nav-bg', settings.navBgColor);

  // Button styles
  const radiusMap = {
    sharp: '0px',
    subtle: '6px',
    rounded: '12px',
    pill: '9999px',
  };
  root.style.setProperty('--site-btn-radius', radiusMap[settings.buttonBorderRadius] || '6px');
  root.style.setProperty('--site-btn-transform', settings.buttonTextTransform || 'none');
  root.style.setProperty('--site-btn-primary', settings.buttonPrimaryColor);

  // Resume font family
  const fontMap = {
    serif: '"Tinos", "Times New Roman", Times, serif',
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", monospace',
  };
  root.style.setProperty('--resume-font-family', fontMap[settings.resumeFontFamily] || fontMap.serif);

  // Inject or update custom CSS tag if provided
  let styleEl = document.getElementById('fesline-custom-styles');
  if (settings.customCss && settings.customCss.trim()) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'fesline-custom-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = settings.customCss;
  } else if (styleEl) {
    styleEl.textContent = '';
  }
}

/**
 * Saves settings locally, applies immediately to DOM, and syncs to Supabase
 */
export async function saveSiteSettings(settings: SiteSettings): Promise<boolean> {
  try {
    const updated = { ...settings, updated_at: new Date().toISOString() };
    
    // 1. Instant local persistence & DOM update
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    applySiteSettingsToDom(updated);
    
    // Broadcast to current window
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: updated }));

    // 2. Persist to Supabase site_settings table (upsert id = 'default')
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          {
            id: 'default',
            settings_json: updated,
            updated_at: updated.updated_at,
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.warn('Note on Supabase site_settings sync:', error.message);
      }
    } catch (err) {
      console.warn('Supabase site_settings sync fallback active:', err);
    }

    return true;
  } catch (err) {
    console.error('Failed saving site settings:', err);
    return false;
  }
}

/**
 * Pulls global settings from Supabase and listens for real-time changes across visitors
 */
export async function syncSiteSettingsFromSupabase(): Promise<SiteSettings | null> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('settings_json')
      .eq('id', 'default')
      .single();

    if (!error && data && data.settings_json) {
      const merged: SiteSettings = { ...DEFAULT_SITE_SETTINGS, ...data.settings_json };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      applySiteSettingsToDom(merged);
      window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: merged }));
      return merged;
    }
  } catch (e) {
    console.warn('Supabase initial settings fetch notice:', e);
  }
  return null;
}

let isRealtimeSubscribed = false;

function initGlobalRealtimeSubscription() {
  if (typeof window === 'undefined' || isRealtimeSubscribed) return;
  isRealtimeSubscribed = true;

  try {
    supabase
      .channel('site_settings_realtime_global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        (payload) => {
          if (payload.new && (payload.new as any).settings_json) {
            const incoming = (payload.new as any).settings_json as SiteSettings;
            const merged = { ...DEFAULT_SITE_SETTINGS, ...incoming };
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
            applySiteSettingsToDom(merged);
            window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: merged }));
          }
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Realtime settings channel init note:', err);
  }
}

/**
 * React Hook providing real-time SiteSettings across any component
 */
export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(() => getStoredSettings());

  useEffect(() => {
    // Apply on initial mount
    applySiteSettingsToDom(settings);

    // Ensure global realtime channel is initialized once
    initGlobalRealtimeSubscription();

    // Initial background sync with Supabase
    syncSiteSettingsFromSupabase().then((serverSettings) => {
      if (serverSettings) {
        setSettings(serverSettings);
      }
    });

    // Listen for local changes across tabs or inside admin dashboard
    const handleLocalUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<SiteSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        setSettings(getStoredSettings());
      }
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    return () => {
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
    };
  }, []);

  const updateSettings = async (partial: Partial<SiteSettings>) => {
    const next: SiteSettings = { ...settings, ...partial };
    setSettings(next);
    await saveSiteSettings(next);
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SITE_SETTINGS);
    await saveSiteSettings(DEFAULT_SITE_SETTINGS);
  };

  return { settings, updateSettings, resetSettings };
}
