import React, { useEffect, useState } from 'react';

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
  sizes?: string;
  loading?: 'lazy' | 'eager';
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
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  loading = 'lazy',
}) => {
  const effectiveAvif = avifUrl || (/\.avif($|\?)/i.test(src) ? src : undefined);
  const initialImgSrc = jpegUrl || webpUrl || originalUrl || src || effectiveAvif || '';
  const [fallbackSrc, setFallbackSrc] = useState<string>(initialImgSrc);

  useEffect(() => {
    setFallbackSrc(jpegUrl || webpUrl || originalUrl || src || effectiveAvif || '');
  }, [src, avifUrl, webpUrl, jpegUrl, originalUrl, effectiveAvif]);

  const handleImgError = () => {
    if (webpUrl && fallbackSrc !== webpUrl) {
      setFallbackSrc(webpUrl);
    } else if (jpegUrl && fallbackSrc !== jpegUrl) {
      setFallbackSrc(jpegUrl);
    } else if (originalUrl && fallbackSrc !== originalUrl) {
      setFallbackSrc(originalUrl);
    } else if (src && fallbackSrc !== src) {
      setFallbackSrc(src);
    }
  };

  if (!effectiveAvif && !webpUrl && !jpegUrl && !responsiveUrl) {
    return (
      <img
        src={fallbackSrc}
        alt={alt}
        loading={loading}
        decoding="async"
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
          srcSet={responsiveUrl && responsiveUrl !== effectiveAvif ? `${responsiveUrl} 800w, ${effectiveAvif} 1600w` : effectiveAvif}
          sizes={responsiveUrl ? sizes : undefined}
        />
      )}
      {webpUrl && <source type="image/webp" srcSet={webpUrl} />}
      {jpegUrl && <source type="image/jpeg" srcSet={jpegUrl} />}
      <img
        src={fallbackSrc || src}
        alt={alt}
        loading={loading}
        decoding="async"
        onError={handleImgError}
        className={className}
      />
    </picture>
  );
};
