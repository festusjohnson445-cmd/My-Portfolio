import React from 'react';
import { PortfolioPart } from './Navbar';
import { EngineeringDocumentHub } from './EngineeringDocumentHub';

interface HomeViewProps {
  onNavigatePart?: (part: PortfolioPart) => void;
  onResumeClick?: () => void;
  onRecruiterScanClick?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigatePart }) => {
  return (
    <div className="flex-1 w-full flex flex-col space-y-6 sm:space-y-8 py-6 pb-16 font-sans">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ======================================================== */}
        {/* ACCESSORIES - OWNER PROTECTED ENGINEERING REPOSITORY     */}
        {/* ======================================================== */}
        <EngineeringDocumentHub onNavigatePart={onNavigatePart} />
      </section>
    </div>
  );
};
