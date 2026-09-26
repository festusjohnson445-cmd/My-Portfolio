export interface ToolItem {
  name: string;
  category: 'CAD' | 'FEA & Simulation' | 'Machining & Fabrication' | 'Metrology & QA' | 'Computation & Code';
  level: 'Expert' | 'Advanced' | 'Proficient';
  yoe: number;
  highlight: string;
  tags: string[];
}

export const TOOLBOX_CATEGORIES = [
  'CAD',
  'FEA & Simulation',
  'Machining & Fabrication',
  'Metrology & QA',
  'Computation & Code',
] as const;

export const TOOLBOX_ITEMS: ToolItem[] = [
  // CAD
  {
    name: 'SolidWorks',
    category: 'CAD',
    level: 'Expert',
    yoe: 6,
    highlight: 'CSWP Certified. Complex surfacing, top-down skeletons, sheet metal, weldments, large assembly (>2,500 parts) performance optimization.',
    tags: ['CSWP', 'Complex Surfacing', 'Large Assemblies', 'Drawings'],
  },
  {
    name: 'PTC Creo / Pro-E',
    category: 'CAD',
    level: 'Advanced',
    yoe: 4,
    highlight: 'Parametric mechanism design, flexible modeling, family tables, and kinematic mechanism simulation.',
    tags: ['Parametric', 'Kinematics', 'Family Tables'],
  },
  {
    name: 'Autodesk Inventor & Fusion 360',
    category: 'CAD',
    level: 'Advanced',
    yoe: 5,
    highlight: 'Integrated CAD/CAM workflows, generative design algorithms, sheet metal nesting, 5-axis toolpathing.',
    tags: ['Generative Design', 'CAM Toolpaths', 'Simulation'],
  },
  {
    name: 'Onshape',
    category: 'CAD',
    level: 'Proficient',
    yoe: 3,
    highlight: 'Cloud-native multi-user collaborative modeling, FeatureScript custom parametric macro creation.',
    tags: ['FeatureScript', 'Cloud CAD', 'Git-style Branching'],
  },

  // FEA & Simulation
  {
    name: 'Ansys Workbench (Mechanical)',
    category: 'FEA & Simulation',
    level: 'Expert',
    yoe: 5,
    highlight: 'Non-linear static structural, modal harmonic response, transient thermal, contact non-linearities, mesh convergence automation.',
    tags: ['Non-linear', 'Modal Dynamics', 'Thermal-Stress', 'Mesh Convergence'],
  },
  {
    name: 'SolidWorks Simulation Premium',
    category: 'FEA & Simulation',
    level: 'Expert',
    yoe: 6,
    highlight: 'Rapid linear static, fatigue Goodman diagrams, factor of safety contours, thermal distribution and vibration analysis.',
    tags: ['Fatigue Analysis', 'Linear Static', 'FOS Mapping'],
  },
  {
    name: 'Abaqus FEA',
    category: 'FEA & Simulation',
    level: 'Advanced',
    yoe: 3,
    highlight: 'Dynamic explicit impact simulations, material hyperelasticity, composite layup modeling, plasticity strain hardening.',
    tags: ['Explicit Dynamics', 'Plasticity', 'Hyperelastic'],
  },
  {
    name: 'SimScale & OpenFOAM',
    category: 'FEA & Simulation',
    level: 'Proficient',
    yoe: 3,
    highlight: 'Convective electronics cooling, internal pipe pressure drop, turbulent k-omega SST airflow simulations.',
    tags: ['CFD', 'Convective Cooling', 'Aerodynamics'],
  },

  // Machining & Fabrication
  {
    name: '5-Axis CNC Milling (Haas UMC / VF-2)',
    category: 'Machining & Fabrication',
    level: 'Expert',
    yoe: 5,
    highlight: 'Mastercam G-code authoring, high-speed trochoidal roughing, custom modular soft-jaw fixturing, 0.005mm repeatability.',
    tags: ['5-Axis Milling', 'Mastercam', 'G-Code', 'Fixture Design'],
  },
  {
    name: 'CNC Wire EDM (Sodick / Makino)',
    category: 'Machining & Fabrication',
    level: 'Advanced',
    yoe: 4,
    highlight: 'Sub-0.003mm hardened tool steel cutting (D2, 4140, Ti), taper wire burns, multi-pass skim cutting, Ra 0.2µm finish.',
    tags: ['Wire EDM', 'Tool Steel', 'Sub-micron Accuracies'],
  },
  {
    name: 'CNC Turning & Mill-Turn (Live Tooling)',
    category: 'Machining & Fabrication',
    level: 'Advanced',
    yoe: 5,
    highlight: 'Precision shaft turned journals, external/internal metric threads, synchronized live milling and axial cross-drilling.',
    tags: ['Live Tooling', 'Precision Turning', 'Threading'],
  },
  {
    name: 'Additive Manufacturing (DMLS, SLA, FDM)',
    category: 'Machining & Fabrication',
    level: 'Expert',
    yoe: 6,
    highlight: 'Direct Metal Laser Sintering (Ti-6Al-4V, 316L stainless), Formlabs Form 4 SLA, Markforged continuous carbon fiber Onyx.',
    tags: ['DMLS Metal', 'Carbon Fiber', 'Rapid Iteration'],
  },
  {
    name: 'Sheet Metal Fabrication & Press Brake',
    category: 'Machining & Fabrication',
    level: 'Advanced',
    yoe: 4,
    highlight: 'K-factor bend deduction calculations, CNC press brake air-bending, PEM hardware insertion, laser cutting layout.',
    tags: ['K-Factor', 'Press Brake', 'PEM Fasteners'],
  },

  // Metrology & QA
  {
    name: 'ASME Y14.5-2018 GD&T',
    category: 'Metrology & QA',
    level: 'Expert',
    yoe: 6,
    highlight: 'Certified GDTP Senior Track. 1D & 2D statistical tolerance stack-up (RSS / Worst-Case), MMC/LMC datum shifts, functional gage design.',
    tags: ['ASME Y14.5', 'Tolerance Stack-up', 'Datum Frames', 'MMC Shift'],
  },
  {
    name: 'Zeiss Coordinate Measuring Machine (CMM)',
    category: 'Metrology & QA',
    level: 'Advanced',
    yoe: 4,
    highlight: 'Calypso CAD-based probing routines, form & position verification, point-cloud alignment to master step solid.',
    tags: ['Zeiss Calypso', 'Contact Probing', 'Inspection Reports'],
  },
  {
    name: 'Optical Comparator & Digital Micrometers',
    category: 'Metrology & QA',
    level: 'Expert',
    yoe: 6,
    highlight: 'Mitutoyo profile projector shadowgraph, bore micrometers calibrated to gauge blocks, Ra/Rz surface profilometry.',
    tags: ['Mitutoyo', 'Surface Finish Ra', 'Bore Gauges', 'Calibration'],
  },

  // Computation & Code
  {
    name: 'MATLAB & Simulink',
    category: 'Computation & Code',
    level: 'Expert',
    yoe: 5,
    highlight: 'Dynamic mechanism simulation, closed-loop PID tuning, Bode plot stability, numerical ODE integration, data processing.',
    tags: ['Simulink', 'Bode Stability', 'PID Control', 'State-Space'],
  },
  {
    name: 'Python (NumPy, SciPy, Matplotlib)',
    category: 'Computation & Code',
    level: 'Expert',
    yoe: 5,
    highlight: 'Automated FEA post-processing, Monte Carlo tolerance stack-up simulation (100,000 iterations), cycloidal curve generation.',
    tags: ['Monte Carlo', 'Tolerance Stacks', 'Automated Post-Processing'],
  },
  {
    name: 'Embedded C / C++ & Arduino / ESP32',
    category: 'Computation & Code',
    level: 'Advanced',
    yoe: 4,
    highlight: 'Motor driver control (CAN bus, SPI, I2C, BiSS-C encoder interfacing), sensor data acquisition at 1 kHz.',
    tags: ['CAN Bus', 'BiSS-C Encoders', 'Motor Drivers', 'Sensors'],
  },
];

export const CERTIFICATIONS = [
  {
    title: 'Certified SolidWorks Professional (CSWP)',
    issuer: 'Dassault Systèmes',
    date: 'Verified active',
    id: 'C-7X8M9Q4K',
    verifiedLink: 'https://www.solidworks.com/certifications',
    category: 'CAD / Design',
  },
  {
    title: 'ASME GDTP Geometric Dimensioning & Tolerancing Professional',
    issuer: 'ASME (American Society of Mechanical Engineers)',
    date: 'Verified active',
    id: 'GDTP-2024-8812',
    verifiedLink: 'https://asme.org/credentials',
    category: 'Metrology / Standards',
  },
  {
    title: 'Fundamentals of Engineering (FE) Mechanical Exam',
    issuer: 'NCEES (National Council of Examiners for Engineering and Surveying)',
    date: 'Passed (EIT Licensure Track)',
    id: 'NCEES-EIT-2023-904',
    verifiedLink: 'https://ncees.org',
    category: 'Licensure / Fundamentals',
  },
  {
    title: 'Mastercam Multi-Axis 5-Axis Programming Specialist',
    issuer: 'CNC Software / Mastercam University',
    date: 'Certified 2024',
    id: 'MC-5AX-5529',
    verifiedLink: 'https://mastercam.com',
    category: 'Manufacturing / CNC',
  },
];
