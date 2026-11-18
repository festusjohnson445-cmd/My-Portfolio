import React, { useEffect, useState } from 'react';
import { formatLiveRelativeTime } from '../utils/mediaMetadata';

interface LiveRelativeTimeProps {
  date?: string | number | Date;
  className?: string;
}

export const LiveRelativeTime: React.FC<LiveRelativeTimeProps> = ({ date, className = '' }) => {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!date) return;
    const ts =
      date instanceof Date
        ? date.getTime()
        : typeof date === 'number'
        ? date
        : new Date(date).getTime();
    if (!Number.isFinite(ts)) return;

    const ageSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    const intervalMs = ageSec < 90 ? 1000 : ageSec < 3600 ? 15000 : 60000;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [date]);

  return (
    <span className={`tabular-nums ${className}`} title={date ? new Date(date).toLocaleString() : ''}>
      {formatLiveRelativeTime(date, now)}
    </span>
  );
};
