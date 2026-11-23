import React from 'react';
import { PortfolioPart } from './Navbar';
import { EngineeringDocumentHub } from './EngineeringDocumentHub';

interface HomeViewProps {
  onNavigatePart?: (part: PortfolioPart) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigatePart }) => {
  return (
    <div className="flex-1 w-full flex flex-col py-3 sm:py-5 pb-8 font-serif">
      <section className="w-full max-w-[1440px] mx-auto px-2 sm:px-4 lg:px-5">
        {/* ======================================================== */}
        {/* ACCESSORIES - OWNER PROTECTED ENGINEERING REPOSITORY     */}
        {/* ======================================================== */}
        <EngineeringDocumentHub onNavigatePart={onNavigatePart} />
      </section>
    </div>
  );
};
