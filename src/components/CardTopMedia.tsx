import React, { useState } from 'react';
import { BookOpen, Play, Wrench } from 'lucide-react';
import type { MediaCardControlsConfig } from '../utils/portfolioSupabase';

interface CardTopMediaProps {
  title: string;
  category?: string;
  imageUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  variant: 'project' | 'article';
  layout?: 'grid' | 'featured';
  isCad?: boolean;
  imageControls?: Partial<MediaCardControlsConfig>;
}

function resolveCardAspect(ratio?: string): string {
  const norm = (ratio || '').replace(':', '/').trim();
  if (norm === '1/1' || norm === '16/9' || norm === '4/3' || norm === '3/4' || norm === '21/9') {
    return norm;
  }
  return '16/10';
}

export const CardTopMedia: React.FC<CardTopMediaProps> = ({
  title,
  category,
  imageUrl,
  videoUrl,
  posterUrl,
  variant,
  layout = 'grid',
  isCad = false,
  imageControls,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  const hasValidImg = Boolean(imageUrl && imageUrl.trim() && !imgFailed);
  const hasValidVid = Boolean(!hasValidImg && videoUrl && videoUrl.trim());
  const hasValidPoster = Boolean(posterUrl && posterUrl.trim() && !posterFailed);

  // Never allow stretched 'fill' distortion on cards; preserve true proportions cleanly
  const fitClass = imageControls?.objectFit === 'contain' ? 'object-contain bg-slate-50' : 'object-cover';

  // Clamp zoom subtly so thumbnails remain well-framed without awkward cropping
  const rawZoom = Number(imageControls?.zoomLevel || 1);
  const safeZoom = rawZoom > 1 ? Math.min(rawZoom, 1.08) : 1;

  const aspect =
    layout === 'featured'
      ? undefined
      : resolveCardAspect(imageControls?.aspectRatio && imageControls.aspectRatio !== '4/3' ? imageControls.aspectRatio : '16/10');

  const frameClass =
    layout === 'featured'
      ? 'relative w-full aspect-[16/10] sm:aspect-auto sm:w-60 md:w-64 sm:min-h-[205px] shrink-0 overflow-hidden border-b sm:border-b-0 sm:border-r border-slate-200/90'
      : 'relative w-full overflow-hidden border-b border-slate-200/90';

  if (hasValidImg) {
    return (
      <div
        className={`${frameClass} bg-slate-100 flex items-center justify-center`}
        style={aspect ? { aspectRatio: aspect } : undefined}
      >
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          style={safeZoom > 1 ? { transform: `scale(${safeZoom})`, transformOrigin: 'center center' } : undefined}
          className={`w-full h-full ${fitClass} object-center block transition-transform duration-300 group-hover:scale-[1.03]`}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/15 to-transparent" />
      </div>
    );
  }

  if (hasValidVid) {
    return (
      <div
        className={`${frameClass} bg-slate-950 flex items-center justify-center`}
        style={aspect ? { aspectRatio: aspect } : { aspectRatio: layout === 'featured' ? undefined : '16/10' }}
      >
        {hasValidPoster ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setPosterFailed(true)}
            className="w-full h-full object-cover object-center block transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <video
            src={videoUrl}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover pointer-events-none"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/25 group-hover:bg-slate-950/15 transition-colors">
          <span className="w-10 h-10 rounded-full bg-slate-950/80 border border-white/35 flex items-center justify-center text-white shadow-md transition-transform duration-200 group-hover:scale-105">
            <Play className="w-4 h-4 fill-white ml-0.5" />
          </span>
        </div>
      </div>
    );
  }

  // Polished engineering/editorial fallback container when no image or video is present
  return (
    <div
      className={`${frameClass} bg-gradient-to-br from-[#eef3f9] via-[#e3ebf5] to-[#d7e2ef] flex flex-col items-center justify-center p-4 text-center`}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-11 h-11 rounded-xl bg-white/95 border border-[#b8c6d4] shadow-2xs flex items-center justify-center text-cyan-900">
          {variant === 'project' ? (
            <Wrench className="w-5 h-5" />
          ) : (
            <BookOpen className="w-5 h-5" />
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-600 max-w-[180px] truncate">
          {category || (variant === 'project' ? 'Engineering Project' : 'Technical Article')}
        </span>
      </div>
    </div>
  );
};
