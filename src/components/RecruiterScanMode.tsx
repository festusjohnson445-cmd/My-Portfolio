import React from 'react';

interface RecruiterScanProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectProject?: (projectId: string) => void;
  onResumeClick?: () => void;
}

export const RecruiterScanMode: React.FC<RecruiterScanProps> = () => {
  return null;
};
