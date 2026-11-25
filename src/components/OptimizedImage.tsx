import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  avifUrl?: string;
  webpUrl?: string;
  jpegUrl?: string;
  responsiveUrl?: string;
  originalUrl?: string;
  className?: string;
  pictureClassName?: string;
  style?: React.CSSProperties;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  fallbackLabel?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  avifUrl,
  webpUrl,
  jpegUrl,
  responsiveUrl,
  originalUrl,
  className = 'w-full h-full object-cover block',
  pictureClassName = 'w-full h-full block',
  style,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  loading = 'lazy',
  fallbackLabel,
}) => {
  const effectiveAvif = avifUrl || (/\.avif($|\?)/i.test(src) ? src : undefined);
  const initialImgSrc = jpegUrl || webpUrl || originalUrl || src || effectiveAvif || '';
  const [fallbackSrc, setFallbackSrc] = useState<string>(initialImgSrc);
  const [exhausted, setExhausted] = useState<boolean>(!initialImgSrc);

  useEffect(() => {
    const next = jpegUrl || webpUrl || originalUrl || src || effectiveAvif || '';
    setFallbackSrc(next);
    setExhausted(!next);
  }, [src, avifUrl, webpUrl, jpegUrl, originalUrl, effectiveAvif]);

  const handleImgError = () => {
    const candidates = [webpUrl, jpegUrl, originalUrl, src, effectiveAvif].filter(
      (v): v is string => Boolean(v && v.trim())
    );
    const currentIdx = candidates.indexOf(fallbackSrc);
    const nextCandidate = candidates.find((c, idx) => c !== fallbackSrc && idx > currentIdx);
    if (nextCandidate) {
      setFallbackSrc(nextCandidate);
      return;
    }
    setExhausted(true);
  };

  if (exhausted || !fallbackSrc) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#e7eef6] via-[#edf2f8] to-[#dbe6f2] flex flex-col items-center justify-center gap-1.5 p-4 text-center select-none">
        <ImageOff className="w-5 h-5 text-cyan-800/60" />
        <span className="text-[11px] font-semibold text-slate-600 line-clamp-1 max-w-[85%]">
          {fallbackLabel || alt || 'Preview Unavailable'}
        </span>
      </div>
    );
  }

  if (!effectiveAvif && !webpUrl && !jpegUrl && !responsiveUrl) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        style={style}
        onError={handleImgError}
        className={className}
      />
    );
  }

  return (
    <picture className={pictureClassName}>
      {effectiveAvif && (
        <source
          type="image/avif"
          srcSet={
            responsiveUrl && responsiveUrl !== effectiveAvif
              ? `${responsiveUrl} 800w, ${effectiveAvif} 1600w`
              : effectiveAvif
          }
          sizes={responsiveUrl ? sizes : undefined}
        />
      )}
      {webpUrl && <source type="image/webp" srcSet={webpUrl} />}
      {jpegUrl && <source type="image/jpeg" srcSet={jpegUrl} />}
      <img
        src={fallbackSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        style={style}
        onError={handleImgError}
        className={className}
      />
    </picture>
  );
};
