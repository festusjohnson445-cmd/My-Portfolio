import React from 'react';
import {
  User,
  ArrowRight,
  Layers,
  MessageSquare,
  FolderKanban,
  BookOpen,
  FileText,
  Sun,
  Moon,
} from 'lucide-react';
import { PortfolioPart } from './Navbar';
import { useProfileSync, getRightBadgeCertifications } from '../utils/profileState';
import { withRecordVersion } from '../utils/supabase';
import {
  useWebsiteSettingsSync,
  BUILT_IN_THEMES,
  DEFAULT_HOMEPAGE_CONFIG,
  DEFAULT_HERO_LAYOUT_CONFIG,
  HeroElementKey,
  normalizeHeroElementOrder,
} from '../utils/portfolioSupabase';
import { useUserColorMode, resolveEffectiveTheme } from '../utils/userThemeMode';

interface LandingHomeViewProps {
  onNavigatePart: (part: PortfolioPart) => void;
  onResumeClick: () => void;
}

export const LandingHomeView: React.FC<LandingHomeViewProps> = ({
  onNavigatePart,
}) => {
  const { bio, documents, avatar, updatedAt } = useProfileSync();
  const [userColorMode, toggleUserColorMode] = useUserColorMode();
  const websiteSettings = useWebsiteSettingsSync();
  const appearance = websiteSettings.appearanceConfig;
  const baseTheme =
    appearance.storedThemes.find((t) => t.id === appearance.activeThemeId) || BUILT_IN_THEMES[0];
  const activeTheme = resolveEffectiveTheme(baseTheme, userColorMode);
  const cardAnimClass = appearance.cardAnimationEnabled ? 'card-anim-enabled' : '';

  const activeConfig = appearance.homepageConfig || DEFAULT_HOMEPAGE_CONFIG;
  const heroLayout = {
    ...DEFAULT_HERO_LAYOUT_CONFIG,
    ...(activeConfig.heroLayout || {}),
    heroElementOrder: normalizeHeroElementOrder(activeConfig.heroLayout?.heroElementOrder),
  };

  const defaultHeroMessage =
    bio.header ||
    'Mechanical Design Engineer specializing in precision mechanism design, non-linear structural & thermal FEA, CNC multi-axis machining, and mission-critical hardware for flight-ready aerospace, quantum systems, and robotics.';
  const heroMessage = activeConfig.heroDescription?.trim() || defaultHeroMessage;
  const dynamicCertifications =
    activeConfig.heroBadgeCertifications?.trim() || getRightBadgeCertifications(bio, documents);
  const portfolioTitleText =
    activeConfig.heroTitle?.trim() ||
    (bio.fullName ? `${bio.fullName.split(',')[0]}'s Portfolio` : "Festus, Olorunsogo's Portfolio");

  const flexAlignClass =
    heroLayout.heroTextAlign === 'left'
      ? 'items-start text-left'
      : heroLayout.heroTextAlign === 'right'
        ? 'items-end text-right'
        : 'items-center text-center';

  const verticalSectionAlign =
    heroLayout.heroVerticalAlign === 'start'
      ? 'items-start'
      : heroLayout.heroVerticalAlign === 'end'
        ? 'items-end'
        : 'items-center';

  const renderHeroElement = (key: HeroElementKey) => {
    switch (key) {
      case 'badge':
        return (
          <div
            key="badge"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-xs border border-slate-300 text-xs font-serif text-cyan-950 shadow-xs max-w-full"
            style={{
              maxWidth: `min(100%, ${heroLayout.heroBadgeMaxWidth}px)`,
              marginBottom: `${heroLayout.heroBadgeMarginBottom}px`,
            }}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-serif font-bold shrink-0">{activeConfig.heroBadgeRole}</span>
            <span className="text-slate-300 shrink-0">|</span>
            <span className="font-mono text-slate-600 truncate text-[11px]" title={dynamicCertifications}>
              {dynamicCertifications}
            </span>
          </div>
        );

      case 'title':
        return (
          <h1
            key="title"
            className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-bold tracking-tight text-slate-950 leading-tight font-serif w-full"
            style={{ marginBottom: `${heroLayout.heroTitleMarginBottom}px` }}
          >
            {activeConfig.heroWelcomePrefix}{' '}
            <span className="text-cyan-900 block mt-1">{portfolioTitleText}</span>
          </h1>
        );

      case 'description':
        return (
          <p
            key="description"
            className="text-sm sm:text-base md:text-lg text-slate-700 leading-relaxed font-sans font-normal w-full"
            style={{
              maxWidth: `min(100%, ${heroLayout.heroDescriptionMaxWidth}px)`,
              marginBottom: `${heroLayout.heroDescriptionMarginBottom}px`,
            }}
          >
            {heroMessage}
          </p>
        );

      case 'cta':
        return (
          <div
            key="cta"
            className="grid grid-cols-2 w-full"
            style={{
              maxWidth: `min(100%, ${heroLayout.heroCtaMaxWidth}px)`,
              marginTop: `${heroLayout.heroCtaMarginTop}px`,
              gap: `${heroLayout.heroCtaGap}px`,
            }}
          >
            {/* Primary User CTA: My Profile */}
            <button
              onClick={() => onNavigatePart('profile')}
              className="w-full min-w-0 inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-cyan-900 hover:bg-cyan-800 text-white text-xs sm:text-sm font-serif font-bold shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap group"
            >
              <User className="w-4 h-4 text-cyan-200 group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate">{activeConfig.heroPrimaryCtaLabel}</span>
            </button>

            {/* Secondary CTA: Explore Engineering Hub */}
            <button
              onClick={() => onNavigatePart('overview')}
              className="w-full min-w-0 inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 text-xs sm:text-sm font-serif font-bold border border-slate-300 shadow-2xs hover:border-slate-400 transition-all cursor-pointer whitespace-nowrap"
            >
              <Layers className="w-4 h-4 text-cyan-800 shrink-0" />
              <span className="truncate">{activeConfig.heroSecondaryCtaLabel}</span>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col font-serif text-[0.95em]" style={{ color: activeTheme.textColor }}>
      {/* ======================================================== */}
      {/* 1. HERO SECTION WITH MODERN ENGINEERING STYLING          */}
      {/* ======================================================== */}
      <section
        className={`relative overflow-hidden flex ${verticalSectionAlign} border-b`}
        style={{
          borderColor: activeTheme.borderColor,
          backgroundColor: activeTheme.surfaceBg,
          minHeight: `${heroLayout.heroMinHeight}px`,
          paddingTop: `${heroLayout.heroPaddingY}px`,
          paddingBottom: `${heroLayout.heroPaddingY}px`,
        }}
      >
        {/* Per-User Local Light/Dark Mode Toggle (Top-Right Corner of Hero) */}
        <button
          type="button"
          onClick={() => toggleUserColorMode()}
          className="absolute top-2.5 right-2.5 sm:top-4 sm:right-5 z-20 p-1.5 sm:p-2 rounded-full bg-white/90 hover:bg-white text-slate-800 border border-slate-300 shadow-xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-700/50"
          aria-label={userColorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={userColorMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {userColorMode === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Optional Hero Background Image */}
        {appearance.heroBackgroundImageUrl && (
          <>
            <img
              src={appearance.heroBackgroundImageUrl}
              alt="Hero Background"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: activeTheme.isDark
                  ? 'rgba(11, 17, 30, 0.72)'
                  : 'rgba(240, 244, 249, 0.78)',
              }}
            />
          </>
        )}

        {/* Engineering precision grid background + stored Hero Animation 1 */}
        <div
          className={`absolute inset-0 opacity-20 pointer-events-none ${
            appearance.heroAnimationEnabled && appearance.heroAnimationEffect === 'precision-grid'
              ? 'hero-anim-precision-grid'
              : ''
          }`}
          style={{
            backgroundImage: `radial-gradient(#334155 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* Ambient subtle glow + stored Hero Animation 2 */}
        <div
          className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none ${
            appearance.heroAnimationEnabled && appearance.heroAnimationEffect === 'orbital-pulse'
              ? 'hero-anim-orbital-pulse'
              : ''
          }`}
        />

        {/* Blueprint Scan Overlay + stored Hero Animation 3 */}
        {appearance.heroAnimationEnabled && appearance.heroAnimationEffect === 'blueprint-scan' && (
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent pointer-events-none hero-anim-blueprint-scan" />
        )}

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className={`flex flex-col ${flexAlignClass} mx-auto w-full`}
            style={{
              maxWidth: `min(100%, ${heroLayout.heroContentMaxWidth}px)`,
              paddingLeft: `${heroLayout.heroInnerPaddingX}px`,
              paddingRight: `${heroLayout.heroInnerPaddingX}px`,
              paddingTop: `${heroLayout.heroInnerPaddingY}px`,
              paddingBottom: `${heroLayout.heroInnerPaddingY}px`,
            }}
          >
            {heroLayout.heroElementOrder.map((key) => renderHeroElement(key))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. WEBSITE SECTIONS DIRECT ACCESS HUB                     */}
      {/* ======================================================== */}
      <section className="py-12 sm:py-16" style={{ backgroundColor: activeTheme.pageBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-block px-3.5 py-1 rounded-full bg-cyan-900/10 border border-cyan-800/25 text-cyan-900 text-[11px] font-sans font-extrabold uppercase tracking-widest mb-2 shadow-2xs">
              {activeConfig.exploreBadge}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-cyan-950 mt-1 font-serif tracking-tight drop-shadow-2xs">
              {activeConfig.exploreTitle}
            </h2>
            <p className="text-xs sm:text-sm font-sans text-slate-700 mt-2 max-w-lg mx-auto font-medium leading-relaxed">
              {activeConfig.exploreSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {/* Card 1: My Profile */}
            <div
              onClick={() => onNavigatePart('profile')}
              className={`p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between ${cardAnimClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                      {avatar ? (
                        <img
                          src={withRecordVersion(avatar, updatedAt)}
                          alt="Profile"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-cyan-800" />
                      )}
                    </div>
                    <div>
                      {activeConfig.cards.profile.badge && (
                        <span className="text-[10px] font-sans font-bold text-cyan-900 uppercase tracking-wider block">
                          {activeConfig.cards.profile.badge}
                        </span>
                      )}
                      <span className="text-xs font-serif font-bold text-slate-900 truncate">
                        {bio.fullName || 'Festus, Olorunsogo Johnson'}
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  {activeConfig.cards.profile.title}
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  {activeConfig.cards.profile.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>{activeConfig.cards.profile.ctaLabel}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2: Engineering Hub */}
            <div
              onClick={() => onNavigatePart('overview')}
              className={`p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between ${cardAnimClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    <Layers className="w-5 h-5 text-cyan-800" />
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  {activeConfig.cards.overview.title}
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  {activeConfig.cards.overview.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>{activeConfig.cards.overview.ctaLabel}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3: Direct Messaging & Inquiry Channel */}
            <div
              onClick={() => onNavigatePart('messaging')}
              className={`p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between ${cardAnimClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    <MessageSquare className="w-5 h-5 text-cyan-800" />
                  </div>
                  {activeConfig.cards.messaging.badge && (
                    <span className="text-[10px] font-sans font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {activeConfig.cards.messaging.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  {activeConfig.cards.messaging.title}
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  {activeConfig.cards.messaging.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>{activeConfig.cards.messaging.ctaLabel}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 4: Engineering Portfolio (Projects) */}
            <div
              onClick={() => onNavigatePart('projects')}
              className={`p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between ${cardAnimClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    <FolderKanban className="w-5 h-5 text-cyan-800" />
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  {activeConfig.cards.projects.title}
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  {activeConfig.cards.projects.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>{activeConfig.cards.projects.ctaLabel}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 5: Engineering Articles (Blog / Articles) */}
            <div
              onClick={() => onNavigatePart('articles')}
              className={`p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between ${cardAnimClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    <BookOpen className="w-5 h-5 text-cyan-800" />
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  {activeConfig.cards.articles.title}
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  {activeConfig.cards.articles.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>{activeConfig.cards.articles.ctaLabel}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 6: Career & Academic Docs Studio */}
            {(() => {
              const docCard =
                activeConfig.cards.documents || DEFAULT_HOMEPAGE_CONFIG.cards.documents!;
              return (
                <div
                  onClick={() => onNavigatePart('documents')}
                  className={`p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between ${cardAnimClass}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                        <FileText className="w-5 h-5 text-cyan-800" />
                      </div>
                      {docCard.badge && (
                        <span className="text-[10px] font-sans font-bold text-cyan-900 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                          {docCard.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                      {docCard.title}
                    </h3>
                    <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                      {docCard.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                    <span>{docCard.ctaLabel}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>
    </div>
  );
};
