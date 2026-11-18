import React, { useEffect, useState } from 'react';

export function formatRelativeTime(isoDate?: string | number | null, nowMs = Date.now()): string {
  if (!isoDate) return 'just now';
  const ts = typeof isoDate === 'number' ? isoDate : new Date(isoDate).getTime();
  if (!Number.isFinite(ts)) return 'just now';

  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 1) return 'just now';
  if (diffSec < 60) {
    return diffSec === 1 ? '1 sec ago' : `${diffSec} secs ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1 ? '1 min ago' : `${diffMin} mins ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return diffHr === 1 ? '1 hr ago' : `${diffHr} hrs ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  }
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) {
    return diffWeek === 1 ? '1 wk ago' : `${diffWeek} wks ago`;
  }
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return diffMonth === 1 ? '1 mo ago' : `${diffMonth} mos ago`;
  }
  const diffYear = Math.floor(diffDay / 365);
  return diffYear === 1 ? '1 yr ago' : `${diffYear} yrs ago`;
}

interface RelativeTimeTextProps {
  isoDate?: string | number | null;
  className?: string;
}

export const RelativeTimeText: React.FC<RelativeTimeTextProps> = ({
  isoDate,
  className = 'text-[9.5px] text-slate-500 tabular-nums whitespace-nowrap',
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isoDate) return;
    const ts = typeof isoDate === 'number' ? isoDate : new Date(isoDate).getTime();
    if (!Number.isFinite(ts)) return;

    const ageSec = Math.max(0, (Date.now() - ts) / 1000);
    // Tick every 1s for the first 90s so "just now -> 1 sec -> 2 secs..." updates live
    const intervalMs = ageSec < 90 ? 1000 : 30000;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [isoDate, Math.floor((nowMs - (typeof isoDate === 'number' ? isoDate : new Date(isoDate || 0).getTime())) / 90000)]);

  return (
    <span className={className} title={isoDate ? new Date(isoDate).toLocaleString() : undefined}>
      {formatRelativeTime(isoDate, nowMs)}
    </span>
  );
};
