import React from 'react';

interface FeslineLogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export const FeslineLogo: React.FC<FeslineLogoProps> = ({
  className = "h-7 sm:h-8 w-auto",
  showSubtitle = true,
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Fesline Logotype Image/SVG */}
      <img
        src="/assets/fesline_logo.svg"
        alt="Fesline"
        className={`object-contain select-none transition-transform group-hover:scale-[1.02] ${className}`}
      />
      {showSubtitle && (
        <span className="text-cyan-800 font-sans text-xs sm:text-sm font-semibold tracking-wide border-l border-slate-400/60 pl-2 py-0.5 whitespace-nowrap">
          MechE
        </span>
      )}
    </div>
  );
};
