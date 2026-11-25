import type { CSSProperties } from 'react';
import type { MediaCardControlsConfig } from './portfolioSupabase';

export function getImageFitClass(fit?: MediaCardControlsConfig['objectFit']): string {
  if (fit === 'cover' || fit === 'fill') return 'object-cover';
  return 'object-contain';
}

export function getContainerWidthClassForAspect(
  aspectRatio?: string,
  context: 'hero' | 'gallery' | 'card' = 'gallery'
): string {
  const norm = (aspectRatio || '4/3').replace(':', '/');
  if (context === 'hero') {
    if (norm === '9/16') return 'w-full max-w-[270px] sm:max-w-[310px] mx-auto';
    if (norm === '4/5' || norm === '3/4') return 'w-full max-w-[340px] sm:max-w-[390px] mx-auto';
    if (norm === '1/1') return 'w-full max-w-[380px] sm:max-w-[420px] mx-auto';
    return 'w-full max-w-3xl mx-auto';
  }
  if (context === 'gallery') {
    if (norm === '9/16') return 'w-full max-w-[260px] mx-auto';
    if (norm === '4/5' || norm === '3/4') return 'w-full max-w-[340px] mx-auto';
    return 'w-full';
  }
  return 'w-full';
}

export function getMediaImgStyle(controls?: MediaCardControlsConfig): CSSProperties {
  const rawZoom = controls?.zoomLevel && controls.zoomLevel > 1 ? controls.zoomLevel : 1;
  const zoom = Math.min(1.08, rawZoom);
  return zoom > 1
    ? {
        transform: `scale(${zoom})`,
        transformOrigin: 'center center',
      }
    : {};
}
