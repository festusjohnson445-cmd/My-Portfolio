import React, { useState } from 'react';
import {
  Palette,
  Sliders,
  Layout,
  FileText,
  Video,
  User,
  Shield,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  Upload,
  ArrowUp,
  ArrowDown,
  Eye,
  Type,
  Maximize2,
  Sparkles,
  Link,
  ChevronRight,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useSiteSettings } from '../utils/siteSettingsState';
import { SiteSettings } from '../types/settings';

const PRESET_THEMES = [
  {
    id: 'slate',
    name: 'Slate Steel (Default)',
    desc: 'Industrial precision palette with deep slate and mechanical cyan.',
    primary: '#155e75',
    secondary: '#334155',
    accent: '#0891b2',
    bg: '#dce1e8',
    surface: '#ffffff',
    border: '#b8c6d4',
    heading: '#020617',
    text: '#1e293b',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Minimal',
    desc: 'Modern dark aerospace graphite with high-contrast metallic tones.',
    primary: '#38bdf8',
    secondary: '#94a3b8',
    accent: '#0284c7',
    bg: '#0f172a',
    surface: '#1e293b',
    border: '#334155',
    heading: '#f8fafc',
    text: '#cbd5e1',
  },
  {
    id: 'cyan',
    name: 'Precision Cyan',
    desc: 'High-tech CNC & CAD workstation styling with vivid precision blues.',
    primary: '#0e7490',
    secondary: '#1e293b',
    accent: '#06b6d4',
    bg: '#e0f2fe',
    surface: '#ffffff',
    border: '#7dd3fc',
    heading: '#082f49',
    text: '#0f172a',
  },
  {
    id: 'blueprint',
    name: 'Industrial Blueprint',
    desc: 'Classic engineering draftsman blueprint scheme with technical navy accents.',
    primary: '#1d4ed8',
    secondary: '#1e3a8a',
    accent: '#3b82f6',
    bg: '#eff6ff',
    surface: '#ffffff',
    border: '#bfdbfe',
    heading: '#172554',
    text: '#1e293b',
  },
  {
    id: 'sand',
    name: 'Warm Editorial Sand',
    desc: 'Clean executive consulting & research tone with warm canvas hues.',
    primary: '#854d0e',
    secondary: '#44403c',
    accent: '#ca8a04',
    bg: '#f5f5f4',
    surface: '#ffffff',
    border: '#d6d3d1',
    heading: '#1c1917',
    text: '#292524',
  },
  {
    id: 'titanium',
    name: 'Titanium High-Contrast',
    desc: 'Crisp black-and-white minimalist layout for maximum clarity.',
    primary: '#09090b',
    secondary: '#27272a',
    accent: '#71717a',
    bg: '#f4f4f5',
    surface: '#ffffff',
    border: '#e4e4e7',
    heading: '#000000',
    text: '#18181b',
  },
];

type SettingsSection =
  | 'theme'
  | 'buttons'
  | 'cards'
  | 'forms'
  | 'resume'
  | 'media'
  | 'profile'
  | 'footer';

export const AdminSettingsManager: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSiteSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('theme');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Custom Form Field Creator State
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldTarget, setNewFieldTarget] = useState<'projects' | 'articles' | 'contact' | 'profile'>('projects');
  const [newFieldType, setNewFieldType] = useState<'text' | 'textarea' | 'select' | 'number'>('text');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Custom Profile Section Creator State
  const [newProfileSecTitle, setNewProfileSecTitle] = useState('');
  const [newProfileSecContent, setNewProfileSecContent] = useState('');

  // Online / Uploaded Theme State
  const [customCssInput, setCustomCssInput] = useState(settings.customCss || '');

  const triggerSaveNotice = (msg = 'Settings updated and live across all devices!') => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  const handleApplyPreset = async (preset: typeof PRESET_THEMES[0]) => {
    await updateSettings({
      activeThemeId: preset.id as any,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
      bgColor: preset.bg,
      surfaceColor: preset.surface,
      borderColor: preset.border,
      headingColor: preset.heading,
      textColor: preset.text,
      buttonPrimaryColor: preset.primary,
    });
    triggerSaveNotice(`Applied theme: ${preset.name}`);
  };

  const handleThemeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          await updateSettings({
            ...parsed,
            activeThemeId: 'custom',
          });
          triggerSaveNotice('Custom JSON theme imported and applied!');
        } else {
          // CSS file
          await updateSettings({
            customCss: content,
            activeThemeId: 'custom',
          });
          setCustomCssInput(content);
          triggerSaveNotice('Custom CSS theme file imported and applied!');
        }
      } catch (err) {
        alert('Invalid theme file format. Please upload valid JSON or CSS.');
      }
    };
    reader.readAsText(file);
  };

  // Move resume section up or down
  const moveResumeSection = async (index: number, direction: 'up' | 'down') => {
    const order = [...settings.resumeSectionOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= order.length) return;

    const temp = order[index];
    order[index] = order[targetIndex];
    order[targetIndex] = temp;

    await updateSettings({ resumeSectionOrder: order });
    triggerSaveNotice('Resume section order updated!');
  };

  // Add custom form field
  const handleAddCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) return;

    const newField = {
      id: `field-${Date.now()}`,
      targetForm: newFieldTarget,
      label: newFieldLabel.trim(),
      type: newFieldType,
      placeholder: newFieldPlaceholder.trim() || `Enter ${newFieldLabel.trim()}...`,
      required: newFieldRequired,
    };

    const updated = [...(settings.customFormFields || []), newField];
    await updateSettings({ customFormFields: updated });
    setNewFieldLabel('');
    setNewFieldPlaceholder('');
    triggerSaveNotice(`Field "${newField.label}" added to ${newFieldTarget} form!`);
  };

  const handleRemoveCustomField = async (id: string) => {
    const updated = (settings.customFormFields || []).filter((f) => f.id !== id);
    await updateSettings({ customFormFields: updated });
    triggerSaveNotice('Field removed!');
  };

  // Add custom profile section
  const handleAddProfileSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileSecTitle.trim()) return;

    const newSec = {
      id: `psec-${Date.now()}`,
      title: newProfileSecTitle.trim(),
      content: newProfileSecContent.trim(),
      alignment: 'center' as const,
    };

    const updated = [...(settings.customProfileSections || []), newSec];
    await updateSettings({ customProfileSections: updated });
    setNewProfileSecTitle('');
    setNewProfileSecContent('');
    triggerSaveNotice(`Profile section "${newSec.title}" published!`);
  };

  const handleRemoveProfileSection = async (id: string) => {
    const updated = (settings.customProfileSections || []).filter((s) => s.id !== id);
    await updateSettings({ customProfileSections: updated });
    triggerSaveNotice('Profile section removed!');
  };

  // Edit Honors Card in Achievements & Awards
  const handleUpdateHonorCard = async (index: number, updates: Partial<typeof settings.honorsCards[0]>) => {
    const updated = [...settings.honorsCards];
    updated[index] = { ...updated[index], ...updates };
    await updateSettings({ honorsCards: updated });
    triggerSaveNotice('Honors card updated!');
  };

  const handleRemoveHonorCard = async (id: string) => {
    const updated = settings.honorsCards.filter((c) => c.id !== id);
    await updateSettings({ honorsCards: updated });
    triggerSaveNotice('Honors card removed!');
  };

  const handleAddHonorCard = async () => {
    const newCard = {
      id: `honor-${Date.now()}`,
      badge: 'Engineering Distinction',
      title: 'New Award or Recognition',
      description: 'Describe distinction, key achievements, or organizational honors.',
    };
    await updateSettings({ honorsCards: [...settings.honorsCards, newCard] });
    triggerSaveNotice('New honors card created!');
  };

  return (
    <div className="space-y-4 font-serif">
      {/* Top Banner with Real-Time Indicator & Reset */}
      <div className="p-3.5 bg-white rounded-2xl border border-slate-300 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-100 border border-cyan-300 flex items-center justify-center text-cyan-800">
            <SettingsIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-900">
                Website Universal Settings Suite
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-sans font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Real-Time Sync
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Changes apply instantly across all visitors, laptops, mobile devices, and browsers without glance of previous state.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetSettings}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-sans font-semibold border border-slate-300 transition-colors cursor-pointer"
            title="Restore all default settings"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {saveNotice && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs rounded-xl flex items-center justify-between animate-fade-in font-sans">
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveNotice}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold">Zero-latency applied</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-300 text-xs font-sans">
        {[
          { id: 'theme', label: '1. Theme & Navbar', icon: Palette },
          { id: 'buttons', label: '2. Buttons Customizer', icon: Sliders },
          { id: 'cards', label: '3. Homepage Cards', icon: Layout },
          { id: 'forms', label: '4. Form Builder', icon: Plus },
          { id: 'resume', label: '5. Resume & PDF', icon: FileText },
          { id: 'media', label: '6. Projects, Articles & Video', icon: Video },
          { id: 'profile', label: '7. Profile Sections', icon: User },
          { id: 'footer', label: '8. Footer Redesign', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as SettingsSection)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-800 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 1. THEME, ANIMATIONS & NAVBAR                            */}
      {/* ======================================================== */}
      {activeSection === 'theme' && (
        <div className="space-y-4 animate-fade-in">
          {/* Preset Themes Grid */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                  Pre-Configured Engineering Themes
                </h3>
                <p className="text-[10.5px] text-slate-500">
                  Select a theme to instantly restyle the entire website with high-contrast precision.
                </p>
              </div>
              <span className="text-[10px] font-sans font-bold text-cyan-800 uppercase">
                Active: {settings.activeThemeId}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {PRESET_THEMES.map((theme) => {
                const isCurrent = settings.activeThemeId === theme.id;
                return (
                  <div
                    key={theme.id}
                    onClick={() => handleApplyPreset(theme)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isCurrent
                        ? 'border-cyan-700 bg-cyan-50/50 shadow-xs ring-1 ring-cyan-700'
                        : 'border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{theme.name}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-cyan-700" />}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{theme.desc}</p>
                    </div>

                    {/* Color Swatch Dots */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: theme.primary }} title="Primary" />
                      <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: theme.accent }} title="Accent" />
                      <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: theme.bg }} title="Background" />
                      <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: theme.surface }} title="Surface" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Granular Color Pickers */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              Granular Color Adjustments
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => updateSettings({ primaryColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => updateSettings({ primaryColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => updateSettings({ accentColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.accentColor}
                    onChange={(e) => updateSettings({ accentColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Canvas Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.bgColor}
                    onChange={(e) => updateSettings({ bgColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.bgColor}
                    onChange={(e) => updateSettings({ bgColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Card / Surface</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.surfaceColor}
                    onChange={(e) => updateSettings({ surfaceColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.surfaceColor}
                    onChange={(e) => updateSettings({ surfaceColor: e.target.value, activeThemeId: 'custom' })}
                    className="w-20 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Upload & Online Theme Input */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                  Upload Theme or Online CSS Style Injection
                </h3>
                <p className="text-[10.5px] text-slate-500">
                  Upload a JSON theme file or paste custom online CSS rules to style your site live.
                </p>
              </div>
              <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-sans font-semibold border border-slate-300 cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>Upload File</span>
                <input type="file" accept=".json,.css" onChange={handleThemeFileUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-700 uppercase">
                Custom CSS Stylesheet (Online / Live Override)
              </label>
              <textarea
                rows={3}
                value={customCssInput}
                onChange={(e) => setCustomCssInput(e.target.value)}
                placeholder="/* e.g. .hero-btn { box-shadow: 0 4px 15px rgba(0,0,0,0.2); } */"
                className="w-full p-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  await updateSettings({ customCss: customCssInput, activeThemeId: 'custom' });
                  triggerSaveNotice('Live CSS rules applied!');
                }}
                className="px-3 py-1 bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Apply Custom CSS
              </button>
            </div>
          </div>

          {/* Hero Button Sizes & Animation Effects Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hero Section Button Size */}
            <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                Hero Section Button Size
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(['small', 'normal', 'large'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateSettings({ heroButtonSize: sz })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                      settings.heroButtonSize === sz
                        ? 'bg-cyan-800 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Modern Animation Effects */}
            <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
                Homepage Modern Animations
              </h3>
              <div className="space-y-2 text-xs">
                {[
                  { key: 'enableAmbientGlow', label: 'Ambient Canvas Gradient Drift' },
                  { key: 'enableMeshDrift', label: 'Subtle Grid Mesh Pulse' },
                  { key: 'enableCardHoverLift', label: 'Card Depth & Hover Elevation' },
                  { key: 'enableSmoothEntrance', label: 'Smooth Staggered Entrance' },
                ].map((anim) => (
                  <label key={anim.key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-slate-800">{anim.label}</span>
                    <input
                      type="checkbox"
                      checked={(settings as any)[anim.key]}
                      onChange={(e) => updateSettings({ [anim.key]: e.target.checked } as any)}
                      className="w-4 h-4 rounded text-cyan-800 focus:ring-cyan-700 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Navbar Customizer */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              Global Navigation Bar Customizer
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Height / Size</label>
                <select
                  value={settings.navSize}
                  onChange={(e) => updateSettings({ navSize: e.target.value as any })}
                  className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
                >
                  <option value="compact">Compact (Slim)</option>
                  <option value="standard">Standard (Default)</option>
                  <option value="spacious">Spacious (Executive)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Background Tone</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={settings.navBgColor}
                    onChange={(e) => updateSettings({ navBgColor: e.target.value })}
                    className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-slate-700">{settings.navBgColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Icon Size</label>
                <select
                  value={settings.navIconSize}
                  onChange={(e) => updateSettings({ navIconSize: e.target.value as any })}
                  className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
                >
                  <option value="small">Small (14px)</option>
                  <option value="medium">Medium (16px)</option>
                  <option value="large">Large (18px)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Glass Blur Filter</label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.navBlur}
                    onChange={(e) => updateSettings({ navBlur: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-800"
                  />
                  <span className="text-slate-800">Backdrop Blur Active</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. UNIVERSAL BUTTON CUSTOMIZER                            */}
      {/* ======================================================== */}
      {activeSection === 'buttons' && (
        <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-4 animate-fade-in">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Universal Button Styling Engine
            </h3>
            <p className="text-[10.5px] text-slate-500">
              Customize button size, border radius, alignment, and styling across all buttons on the website.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Button Size</label>
              <select
                value={settings.buttonSize}
                onChange={(e) => updateSettings({ buttonSize: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="small">Small (Compact, Single-Text)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="large">Large (Prominent)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Border Radius / Shape</label>
              <select
                value={settings.buttonBorderRadius}
                onChange={(e) => updateSettings({ buttonBorderRadius: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="sharp">Sharp (0px)</option>
                <option value="subtle">Subtle (6px - Default)</option>
                <option value="rounded">Rounded (12px)</option>
                <option value="pill">Pill Capsule (9999px)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Text Style / Transform</label>
              <select
                value={settings.buttonTextTransform}
                onChange={(e) => updateSettings({ buttonTextTransform: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="none">Normal Case (e.g. Download)</option>
                <option value="uppercase">Uppercase (e.g. DOWNLOAD)</option>
                <option value="capitalize">Capitalize Words</option>
              </select>
            </div>
          </div>

          {/* Button Color Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Primary Button Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.buttonPrimaryColor}
                  onChange={(e) => updateSettings({ buttonPrimaryColor: e.target.value })}
                  className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.buttonPrimaryColor}
                  onChange={(e) => updateSettings({ buttonPrimaryColor: e.target.value })}
                  className="w-24 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Secondary Button Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.buttonSecondaryColor}
                  onChange={(e) => updateSettings({ buttonSecondaryColor: e.target.value })}
                  className="w-7 h-7 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.buttonSecondaryColor}
                  onChange={(e) => updateSettings({ buttonSecondaryColor: e.target.value })}
                  className="w-24 px-1.5 py-0.5 border border-slate-300 rounded text-[11px] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Live Button Preview */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-sans">Live Button Preview:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                style={{
                  backgroundColor: settings.buttonPrimaryColor,
                  borderRadius: settings.buttonBorderRadius === 'sharp' ? '0px' : settings.buttonBorderRadius === 'subtle' ? '6px' : settings.buttonBorderRadius === 'rounded' ? '12px' : '9999px',
                  textTransform: settings.buttonTextTransform as any,
                }}
                className="px-3 py-1.5 text-white text-xs font-bold shadow-2xs"
              >
                Download
              </button>
              <button
                type="button"
                style={{
                  backgroundColor: settings.buttonSecondaryColor,
                  borderRadius: settings.buttonBorderRadius === 'sharp' ? '0px' : settings.buttonBorderRadius === 'subtle' ? '6px' : settings.buttonBorderRadius === 'rounded' ? '12px' : '9999px',
                  textTransform: settings.buttonTextTransform as any,
                }}
                className="px-3 py-1.5 text-slate-800 border border-slate-300 text-xs font-semibold"
              >
                Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. HOMEPAGE CARDS EDITOR                                 */}
      {/* ======================================================== */}
      {activeSection === 'cards' && (
        <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-4 animate-fade-in">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Homepage Cards &amp; Grid Editor
            </h3>
            <p className="text-[10.5px] text-slate-500">
              Adjust typography color, text alignment, headings justification, and icon shape on all cards.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Body Text Alignment</label>
              <select
                value={settings.cardTextAlignment}
                onChange={(e) => updateSettings({ cardTextAlignment: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="justify">Justify (Executive Standard)</option>
                <option value="left">Left Aligned</option>
                <option value="center">Centered</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Heading Alignment</label>
              <select
                value={settings.cardHeadingAlignment}
                onChange={(e) => updateSettings({ cardHeadingAlignment: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="center">Centered (Default)</option>
                <option value="left">Left Aligned</option>
                <option value="right">Right Aligned</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Icon Shape</label>
              <select
                value={settings.cardIconShape}
                onChange={(e) => updateSettings({ cardIconShape: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="rounded-square">Rounded Square</option>
                <option value="circle">Circular</option>
                <option value="sharp">Sharp Box</option>
                <option value="squircle">Squircle</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Icon Size</label>
              <select
                value={settings.cardIconSize}
                onChange={(e) => updateSettings({ cardIconSize: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="small">Small</option>
                <option value="medium">Medium (Standard)</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. FORM BUILDER & PLACEHOLDERS                           */}
      {/* ======================================================== */}
      {activeSection === 'forms' && (
        <div className="space-y-4 animate-fade-in">
          {/* Add New Functional Form Field */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              Add Functional Field to Any Form
            </h3>
            <form onSubmit={handleAddCustomField} className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Target Form</label>
                <select
                  value={newFieldTarget}
                  onChange={(e) => setNewFieldTarget(e.target.value as any)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
                >
                  <option value="projects">Projects Upload Form</option>
                  <option value="articles">Articles Post Form</option>
                  <option value="contact">Contact Inquiry Form</option>
                  <option value="profile">Profile Form</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Field Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tolerances, Material"
                  value={newFieldLabel}
                  onChange={(e) => setNewFieldLabel(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Field Type</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as any)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
                >
                  <option value="text">Single Line Text</option>
                  <option value="textarea">Multi-line Paragraph</option>
                  <option value="number">Numeric Value</option>
                  <option value="select">Dropdown Options</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Placeholder</label>
                <input
                  type="text"
                  placeholder="e.g. Enter technical data..."
                  value={newFieldPlaceholder}
                  onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900 text-xs"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-1.5 px-3 bg-cyan-800 hover:bg-cyan-900 text-white font-sans text-xs font-bold rounded cursor-pointer"
                >
                  + Add Field
                </button>
              </div>
            </form>

            {/* List of Active Custom Fields */}
            {settings.customFormFields && settings.customFormFields.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                  Active Custom Fields ({settings.customFormFields.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {settings.customFormFields.map((field) => (
                    <div
                      key={field.id}
                      className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{field.label}</span>
                        <span className="text-[10px] text-slate-500 ml-1.5 font-sans">
                          [{field.targetForm} · {field.type}]
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(field.id)}
                        className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                        title="Delete custom field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form Placeholders Editor */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              Edit Form Placeholder Text (No Personal/Private Info)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Project Title Placeholder</label>
                <input
                  type="text"
                  value={settings.formPlaceholders.projectTitle || ''}
                  onChange={(e) =>
                    updateSettings({
                      formPlaceholders: { ...settings.formPlaceholders, projectTitle: e.target.value },
                    })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Project Category Placeholder</label>
                <input
                  type="text"
                  value={settings.formPlaceholders.projectCategory || ''}
                  onChange={(e) =>
                    updateSettings({
                      formPlaceholders: { ...settings.formPlaceholders, projectCategory: e.target.value },
                    })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Article Title Placeholder</label>
                <input
                  type="text"
                  value={settings.formPlaceholders.articleTitle || ''}
                  onChange={(e) =>
                    updateSettings({
                      formPlaceholders: { ...settings.formPlaceholders, articleTitle: e.target.value },
                    })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Article Content Placeholder</label>
                <input
                  type="text"
                  value={settings.formPlaceholders.articleContent || ''}
                  onChange={(e) =>
                    updateSettings({
                      formPlaceholders: { ...settings.formPlaceholders, articleContent: e.target.value },
                    })
                  }
                  className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. RESUME & PDF STRUCTURE                                */}
      {/* ======================================================== */}
      {activeSection === 'resume' && (
        <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-4 animate-fade-in">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Download Resume &amp; PDF Architecture Customizer
            </h3>
            <p className="text-[10.5px] text-slate-500">
              Rearrange section positions, toggle section visibility, adjust print margins and font family.
            </p>
          </div>

          {/* Typography & Margins */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Resume Font Family</label>
              <select
                value={settings.resumeFontFamily}
                onChange={(e) => updateSettings({ resumeFontFamily: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="serif">Times New Roman / Editorial Serif</option>
                <option value="sans">Modern Sans-Serif (Inter)</option>
                <option value="mono">JetBrains Mono (Technical Spec)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Text Size</label>
              <select
                value={settings.resumeTextSize}
                onChange={(e) => updateSettings({ resumeTextSize: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="small">Small (Dense 1-Page Format)</option>
                <option value="medium">Medium (Executive Standard)</option>
                <option value="standard">Standard (Spacious)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Page Margins</label>
              <select
                value={settings.resumePageMargins}
                onChange={(e) => updateSettings({ resumePageMargins: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="compact">Compact (0.4 in / 10mm)</option>
                <option value="standard">Standard (0.6 in / 15mm)</option>
                <option value="relaxed">Relaxed (0.8 in / 20mm)</option>
              </select>
            </div>
          </div>

          {/* Section Re-arranging Order */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
              Section Insertion Order &amp; Visibility Specification
            </span>
            <div className="space-y-1.5">
              {settings.resumeSectionOrder.map((sec, idx) => {
                const isVisible = settings.resumeSectionVisibility[sec] !== false;
                const labelMap: Record<string, string> = {
                  bio: '1. Professional Header & Executive Bio',
                  experience: '2. Professional Experience & Career History',
                  publications: '3. Peer-Reviewed Research & Publications',
                  skills: '4. Categorized Engineering Skills & Competencies',
                  achievements: '5. Academic Honors & Achievements',
                  credentials: '6. Verified Credentials & Specializations',
                };

                return (
                  <div
                    key={sec}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-mono font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <span className={`font-semibold ${isVisible ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                        {labelMap[sec] || sec}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Visibility Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          updateSettings({
                            resumeSectionVisibility: {
                              ...settings.resumeSectionVisibility,
                              [sec]: !isVisible,
                            },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold cursor-pointer ${
                          isVisible
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isVisible ? 'Visible' : 'Hidden'}
                      </button>

                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveResumeSection(idx, 'up')}
                        className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={idx === settings.resumeSectionOrder.length - 1}
                        onClick={() => moveResumeSection(idx, 'down')}
                        className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. PROJECTS, ARTICLES & VIDEO PLAYER CUSTOMIZER          */}
      {/* ======================================================== */}
      {activeSection === 'media' && (
        <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-4 animate-fade-in">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Projects, Articles &amp; Video Media Customizer
            </h3>
            <p className="text-[10.5px] text-slate-500">
              Configure video card aspect ratios, intake scale, zoom states, orientation, and card layout format.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Video Aspect Ratio</label>
              <select
                value={settings.videoAspectRatio}
                onChange={(e) => updateSettings({ videoAspectRatio: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="16:9">16:9 Standard Widescreen</option>
                <option value="4:3">4:3 CAD Drawing Standard</option>
                <option value="1:1">1:1 Square</option>
                <option value="21:9">21:9 Ultra-Wide Cinematic</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Intake Zoom / Scale State</label>
              <select
                value={settings.videoZoomState}
                onChange={(e) => updateSettings({ videoZoomState: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="100%">100% (Natural Scale)</option>
                <option value="110%">110% (Subtle Crop/Zoom)</option>
                <option value="125%">125% (Focus Center)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Fitness Mode</label>
              <select
                value={settings.videoFitness}
                onChange={(e) => updateSettings({ videoFitness: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="contain">Contain (Fit entirely without crop)</option>
                <option value="cover">Cover (Fill card completely)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Video Card Orientation</label>
              <select
                value={settings.videoOrientation}
                onChange={(e) => updateSettings({ videoOrientation: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="horizontal">Horizontal (Standard Showcase)</option>
                <option value="vertical">Vertical (Reels / Mobile Demo)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Project Card Format</label>
              <select
                value={settings.projectCardFormat}
                onChange={(e) => updateSettings({ projectCardFormat: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="compact">Compact Format (Minimalist)</option>
                <option value="detailed">Detailed Format (Specifications &amp; Objectives)</option>
                <option value="grid">Grid Showcase</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. PROFILE PAGE SECTIONS CUSTOMIZER                      */}
      {/* ======================================================== */}
      {activeSection === 'profile' && (
        <div className="space-y-4 animate-fade-in">
          {/* Section Headings & Orientation Editor */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              Profile Sections Heading &amp; Visibility Specification
            </h3>
            <div className="space-y-2 text-xs">
              {(
                [
                  { id: 'bio', defaultLabel: 'Bio & About' },
                  { id: 'experience', defaultLabel: 'Experience & Career' },
                  { id: 'publications', defaultLabel: 'Research & Publications' },
                  { id: 'achievements', defaultLabel: 'Achievements & Awards (Honors & Skills)' },
                  { id: 'credentials', defaultLabel: 'Verified Documents & Credentials' },
                ] as const
              ).map((sec) => {
                const config = (settings.profileHeadings as any)[sec.id] || {
                  text: sec.defaultLabel,
                  size: 'sm',
                  alignment: 'center',
                  visible: true,
                };

                return (
                  <div
                    key={sec.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={config.text}
                        onChange={(e) =>
                          updateSettings({
                            profileHeadings: {
                              ...settings.profileHeadings,
                              [sec.id]: { ...config, text: e.target.value },
                            },
                          })
                        }
                        className="w-full p-1 bg-white border border-slate-300 rounded text-xs font-bold font-serif"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={config.alignment}
                        onChange={(e) =>
                          updateSettings({
                            profileHeadings: {
                              ...settings.profileHeadings,
                              [sec.id]: { ...config, alignment: e.target.value },
                            },
                          })
                        }
                        className="p-1 border border-slate-300 rounded bg-white text-[10px]"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          updateSettings({
                            profileHeadings: {
                              ...settings.profileHeadings,
                              [sec.id]: { ...config, visible: !config.visible },
                            },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold cursor-pointer ${
                          config.visible
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {config.visible ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Honors & Skills Manager (Directly edit, add, or remove cards) */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                  Honors &amp; Skills Cards Manager
                </h3>
                <p className="text-[10.5px] text-slate-500">
                  Admin editing: Directly update, add, or delete the cards shown under Achievements &amp; Awards.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddHonorCard}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-800 hover:bg-cyan-900 text-white text-[10px] font-bold rounded cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Add Honor Card</span>
              </button>
            </div>

            <div className="space-y-2">
              {settings.honorsCards.map((card, idx) => (
                <div key={card.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={card.badge}
                      onChange={(e) => handleUpdateHonorCard(idx, { badge: e.target.value })}
                      placeholder="Badge Label (e.g. Academic Merit)"
                      className="w-1/3 p-1 bg-white border border-slate-300 rounded text-[10.5px] font-bold uppercase text-cyan-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveHonorCard(card.id)}
                      className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                      title="Remove card"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) => handleUpdateHonorCard(idx, { title: e.target.value })}
                    placeholder="Honor Title (e.g. Dean's Honor Roll)"
                    className="w-full p-1 bg-white border border-slate-300 rounded font-bold text-xs"
                  />

                  <textarea
                    rows={2}
                    value={card.description}
                    onChange={(e) => handleUpdateHonorCard(idx, { description: e.target.value })}
                    placeholder="Honor description..."
                    className="w-full p-1 bg-white border border-slate-300 rounded text-[11px]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Add New Custom Profile Section */}
          <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-2">
              Add New Custom Functional Profile Section
            </h3>
            <form onSubmit={handleAddProfileSection} className="space-y-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Section Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optomechanical Patents &amp; Field Tests"
                  value={newProfileSecTitle}
                  onChange={(e) => setNewProfileSecTitle(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Section Body Content</label>
                <textarea
                  rows={3}
                  placeholder="Write section narrative or documentation..."
                  value={newProfileSecContent}
                  onChange={(e) => setNewProfileSecContent(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded bg-white text-slate-900 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="py-1.5 px-4 bg-cyan-800 hover:bg-cyan-900 text-white font-sans text-xs font-bold rounded cursor-pointer"
                >
                  Publish Custom Profile Section
                </button>
              </div>
            </form>

            {/* List of Custom Profile Sections */}
            {settings.customProfileSections && settings.customProfileSections.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                {settings.customProfileSections.map((sec) => (
                  <div key={sec.id} className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{sec.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveProfileSection(sec.id)}
                      className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. FOOTER REDESIGN & CUSTOMIZER                          */}
      {/* ======================================================== */}
      {activeSection === 'footer' && (
        <div className="p-4 bg-white rounded-2xl border border-slate-300 space-y-4 animate-fade-in">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Footer Redesign &amp; Architecture Editor
            </h3>
            <p className="text-[10.5px] text-slate-500">
              Re-align text, add custom disclaimers, customize copyright statement, and toggle visibility.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Footer Alignment</label>
              <select
                value={settings.footerAlignment}
                onChange={(e) => updateSettings({ footerAlignment: e.target.value as any })}
                className="w-full p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
              >
                <option value="center">Centered (Default)</option>
                <option value="left">Left Aligned</option>
                <option value="justify">Justified</option>
                <option value="split">Split Edges (Copyright Left, Links Right)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Copyright Line</label>
              <input
                type="text"
                value={settings.footerCopyrightText}
                onChange={(e) => updateSettings({ footerCopyrightText: e.target.value })}
                className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Disclaimer or Verification Statement</label>
            <input
              type="text"
              placeholder="e.g. Certified CSWP Engineer · Proprietary mechanisms under ASME Y14.5 standards."
              value={settings.footerDisclaimerText}
              onChange={(e) => updateSettings({ footerDisclaimerText: e.target.value })}
              className="w-full p-1.5 border border-slate-300 rounded bg-slate-50 text-slate-900 text-xs"
            />
          </div>

          <div className="flex items-center gap-4 text-xs pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.footerShowSocial}
                onChange={(e) => updateSettings({ footerShowSocial: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-800"
              />
              <span className="text-slate-800">Show Social Links in Footer</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.footerShowLock}
                onChange={(e) => updateSettings({ footerShowLock: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-800"
              />
              <span className="text-slate-800">Show Hidden Owner Access Lock (Double-Click)</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
