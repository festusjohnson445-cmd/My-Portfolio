import React, { useEffect, useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  webpUrl?: string;
  jpegUrl?: string;
  responsiveUrl?: string;
  originalUrl?: string;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  webpUrl,
  jpegUrl,
  responsiveUrl,
  originalUrl,
  className = 'w-full h-full object-cover block',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  loading = 'lazy',
}) => {
  const [fallbackSrc, setFallbackSrc] = useState<string>(src);

  useEffect(() => {
    setFallbackSrc(src);
  }, [src]);

  const isPrimaryAvif = /\.avif($|\?)/i.test(src);

  const handleImgError = () => {
    if (fallbackSrc === src && webpUrl && webpUrl !== fallbackSrc) {
      setFallbackSrc(webpUrl);
    } else if (fallbackSrc !== jpegUrl && jpegUrl) {
      setFallbackSrc(jpegUrl);
    } else if (fallbackSrc !== originalUrl && originalUrl) {
      setFallbackSrc(originalUrl);
    }
  };

  if (!webpUrl && !jpegUrl && !responsiveUrl) {
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
    <picture className="w-full h-full block">
      {isPrimaryAvif && (
        <source
          type="image/avif"
          srcSet={responsiveUrl ? `${responsiveUrl} 800w, ${src} 1600w` : src}
          sizes={responsiveUrl ? sizes : undefined}
        />
      )}
      {webpUrl && <source type="image/webp" srcSet={webpUrl} />}
      {jpegUrl && <source type="image/jpeg" srcSet={jpegUrl} />}
      <img
        src={fallbackSrc || jpegUrl || webpUrl || originalUrl || src}
        alt={alt}
        loading={loading}
        decoding="async"
        onError={handleImgError}
        className={className}
      />
    </picture>
  );
};
