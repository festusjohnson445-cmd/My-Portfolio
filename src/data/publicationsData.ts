import { ResearchPublication } from '../types/extendedPortfolio';

export const DEFAULT_PUBLICATIONS: ResearchPublication[] = [
  {
    id: 'pub-topological-mass-opt',
    title: 'Topological Mass Optimization and Dynamic Modal Isolation in Airborne Optical Gimbal Mounts',
    authors: ['Festus Johnson', 'Collaborating Engineering Review Board'],
    publication_venue: 'Aerospace Mechanical Structures & Mechanisms Symposium',
    publication_type: 'Whitepaper',
    date: '2026',
    abstract: 'Investigates the algorithmic synthesis of monolithic 5-axis CNC titanium gimbal yokes subjected to multi-axis random vibration spectrums (MIL-STD-810H). Demonstrates how combining non-parametric SIMP topology optimization with closed-form Euler-Bernoulli cantilever frequency formulas achieves a 41.8% structural mass reduction while raising fundamental natural resonance from 180 Hz to 342 Hz.',
    doi: '10.1109/AERO-MECH.2026.0421',
    pages: 18,
    citations_count: 14,
    tags: ['Topology Optimization', 'Modal Analysis', 'Titanium Ti-6Al-4V', 'Gimbal Mechanisms', 'Ansys FEA'],
    featured: true
  },
  {
    id: 'pub-asme-gdt-machining-efficiency',
    title: 'Maximizing CNC Spindle Efficiency via ASME Y14.5 Composite Position & Datum Modifiers',
    authors: ['Festus Johnson'],
    publication_venue: 'Journal of Mechanical Design & Precision Manufacturing Standards',
    publication_type: 'CAD Standard',
    date: '2025',
    abstract: 'A comprehensive technical treatise on the implementation of ASME Y14.5-2018 composite tolerancing in aerospace component drawings. Demonstrates mathematical derivations proving a 57% increase in permissible hole pattern boundary area over coordinate dimensioning, detailing practical shop-floor datum qualification procedures and automated CMM inspection routines.',
    doi: '10.1016/j.precisionmanuf.2025.1104',
    pages: 24,
    citations_count: 22,
    tags: ['GD&T', 'ASME Y14.5', 'Tolerance Stackup', 'Manufacturing Standards', 'Metrology'],
    featured: true
  },
  {
    id: 'pub-flexspline-fatigue-strainwave',
    title: 'Gerber Mean-Stress Derating and High-Cycle Bending Fatigue in 4340 Alloy Flexsplines',
    authors: ['Festus Johnson'],
    publication_venue: 'Robotic Mechanism & Actuator Engineering Review',
    publication_type: 'Technical Report',
    date: '2024',
    abstract: 'Presents analytical and empirical strain-gauge fatigue data for thin-walled flexspline cups subjected to dual-lobe elliptical deflection waves. Formulates a modified Gerber fatigue criterion accounting for vacuum-arc remelted 4340 steel grain structure, electro-discharge machining micro-cracking mitigation, and thin-film boundary lubrication.',
    doi: '10.1115/ROBOT-ACTUATOR.2024.0882',
    pages: 16,
    citations_count: 9,
    tags: ['Strain-Wave Gear', 'Fatigue Mechanics', 'Robotics', 'High-Strength Steel', 'Kinematics'],
    featured: true
  }
];
