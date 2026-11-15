import { EngineeringAchievement } from '../types/extendedPortfolio';

export const DEFAULT_ACHIEVEMENTS: EngineeringAchievement[] = [
  {
    id: 'ach-cswp',
    title: 'Certified SolidWorks Professional (CSWP)',
    issuer: 'Dassault Systèmes',
    category: 'Certification',
    date: 'Certified Senior Practitioner',
    description: 'Demonstrated advanced parametric part modeling, complex configuration management, assembly constraint kinematics, and multi-body top-down mechanism design under rigorous time constraints.',
    credential_id: 'C-SWP-99214-MECH',
    verification_url: 'https://www.solidworks.com/sw/support/cswp.htm',
    order_index: 1
  },
  {
    id: 'ach-asme-gdtp',
    title: 'ASME GDTP Senior Professional (Y14.5-2018)',
    issuer: 'American Society of Mechanical Engineers (ASME)',
    category: 'Certification',
    date: 'Verified Credential',
    description: 'Certified mastery in Geometric Dimensioning & Tolerancing across 1D/3D tolerance stack-up analysis, composite positional tolerancing, datum reference frames, and MMC/LMC boundary controls.',
    credential_id: 'ASME-GDTP-SR-2018-0482',
    verification_url: 'https://www.asme.org/learning-development/credentials/gdtp-certification',
    order_index: 2
  },
  {
    id: 'ach-fe-eit',
    title: 'Fundamentals of Engineering (FE) Mechanical — EIT Verified',
    issuer: 'NCEES (National Council of Examiners for Engineering and Surveying)',
    category: 'Licensure',
    date: 'Verified Passing Record',
    description: 'Comprehensive examination covering thermodynamics, continuum mechanics, fluid dynamics, heat transfer, machine design, electrical circuits, and engineering economics on the PE licensure track.',
    credential_id: 'NCEES-FE-MECH-VERIFIED',
    verification_url: 'https://ncees.org/engineering/fe/',
    order_index: 3
  },
  {
    id: 'ach-bsme-honors',
    title: 'B.S. in Mechanical Engineering (BSME) — Magna Cum Laude Honors',
    issuer: 'ABET Accredited Engineering Institution',
    category: 'Honor',
    date: 'Dean’s Honor List · GPA 3.84 / 4.00',
    description: 'Awarded Bachelor of Science in Mechanical Engineering with highest academic distinction. Capstone project lead for precision robotics and airborne mechanism topology optimization.',
    credential_id: 'BSME-ABET-HONORS-384',
    order_index: 4
  },
  {
    id: 'ach-aerospace-design-award',
    title: 'Aerospace Mechanism Innovation & DFM Award',
    issuer: 'Precision Aerospace & Defense Engineering Consortium',
    category: 'Award',
    date: '2025',
    description: 'Recognized for pioneering monolithic 5-axis CNC titanium bracket topology optimization that slashed gimbal mass by 41.8% while elevating fundamental resonant frequency by 90%.',
    credential_id: 'AERO-DFM-AWARD-2025',
    order_index: 5
  }
];
