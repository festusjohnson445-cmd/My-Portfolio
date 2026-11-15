import { CareerExperience } from '../types/extendedPortfolio';

export const DEFAULT_EXPERIENCE: CareerExperience[] = [
  {
    id: 'exp-lead-mech-engineer',
    title: 'Lead Mechanical Design Engineer',
    company: 'Fesline Mechanical Engineering',
    location: 'United States',
    employment_type: 'Full-time / Principal',
    start_date: '2022',
    end_date: 'Present',
    is_current: true,
    summary: 'Directing the architecture, mechanical design, dynamic simulation, and precision manufacturing of mission-critical electro-mechanical systems, airborne optomechanical gimbals, and robotic gearboxes.',
    key_achievements: [
      'Engineered an airborne bi-axial optomechanical gimbal mount, achieving a 41.8% structural mass reduction (1,420g to 826g) and elevating first natural resonance from 180 Hz to 342 Hz.',
      'Developed a 100:1 zero-backlash harmonic strain-wave reducer with 115 N·m peak output torque and infinite fatigue life safety factor (SF = 2.69).',
      'Saved over $120,000 in manufacturing costs through single-setup 5-axis CNC DFM optimization and MMC tolerance bonus implementations.',
      'Authored ASME Y14.5-2018 GD&T drawings with 1D/3D statistical tolerance stack-up models, achieving 100% first-article inspection pass rate.'
    ],
    technologies_used: [
      'SolidWorks (CSWP)',
      'PTC Creo',
      'Ansys Workbench Mechanical',
      'ASME Y14.5-2018 GD&T',
      'Mastercam 5-Axis CNC',
      'Topology Optimization',
      'React & TypeScript'
    ],
    project_ids: ['airborne-optomechanical-gimbal', 'harmonic-strain-wave-reducer'],
    order_index: 1
  },
  {
    id: 'exp-senior-cad-specialist',
    title: 'Senior Mechanical Hardware & CAD Specialist',
    company: 'Precision Mechanism & Robotics Lab',
    location: 'United States',
    employment_type: 'Full-time',
    start_date: '2020',
    end_date: '2022',
    is_current: false,
    summary: 'Led 3D parametric CAD modeling, kinematic motion studies, finite element structural verification, and prototype fabrication for industrial automation and robotic end-effectors.',
    key_achievements: [
      'Pioneered robust top-down master skeleton assembly techniques in SolidWorks and Creo, reducing design revision cycle times by 45%.',
      'Designed custom dynamic vibration test fixtures for MIL-STD-810H and DO-160G qualification testing.',
      'Conducted non-linear contact FEA simulations and thermal dissipation modeling for high-torque frameless BLDC motor housings.',
      'Managed machine shop operations including 3-axis CNC milling, CNC laser cutting, and additive manufacturing print farms.'
    ],
    technologies_used: [
      'SolidWorks',
      'Autodesk Inventor',
      'Ansys FEA',
      'Laser Cutting / CNC DFM',
      'AS9102 First Article Inspection',
      'Python Data Analysis'
    ],
    project_ids: ['harmonic-strain-wave-reducer'],
    order_index: 2
  },
  {
    id: 'exp-mech-engineer-fellow',
    title: 'Mechanical Engineering Research Associate',
    company: 'Advanced Materials & Dynamics Institute',
    location: 'United States',
    employment_type: 'Research & Development',
    start_date: '2018',
    end_date: '2020',
    is_current: false,
    summary: 'Conducted first-principles structural mechanics research, modal vibration extraction, and material fatigue characterization on aerospace-grade titanium (Ti-6Al-4V) and high-strength alloy steels.',
    key_achievements: [
      'Published engineering whitepapers comparing analytical Euler-Bernoulli flexural frequency equations with high-density tetrahedral FEA models.',
      'Designed and calibrated precision strain gauge data acquisition test benches for cyclic fatigue characterization.',
      'Trained over 35 engineering students in ASME Y14.5 engineering drafting and SolidWorks parametric modeling best practices.'
    ],
    technologies_used: [
      'MATLAB & Simulink',
      'SolidWorks',
      'Ansys Mechanical',
      'Data Acquisition (DAQ)',
      'Laser Interferometry'
    ],
    order_index: 3
  }
];
