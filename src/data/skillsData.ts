export type SkillCategoryName =
  | 'Generate Skills'
  | 'Educational Skills'
  | 'Handful Skills'
  | 'Personal Skills'
  | 'IT Skills';

export interface SkillCategoryGroup {
  category: SkillCategoryName;
  shortLabel: string;
  description: string;
  subcategories: {
    name: string;
    skills: string[];
  }[];
}

export const SKILLS_DATABASE: SkillCategoryGroup[] = [
  {
    category: 'Generate Skills',
    shortLabel: 'Core Engineering',
    description: 'CAD architecture, FEA simulation, GD&T tolerancing & precision mechanism design',
    subcategories: [
      {
        name: 'CAD & 3D Modeling',
        skills: [
          'SolidWorks (CSWP/CSWE)',
          'PTC Creo',
          'Autodesk Inventor',
          'CATIA V5 / 3DEXPERIENCE',
          'Siemens NX',
          'AutoCAD Mechanical',
          'Fusion 360',
          'Onshape',
          'Surface Modeling & Complex Lofting',
        ],
      },
      {
        name: 'Simulation & FEA',
        skills: [
          'Ansys Workbench (Static / Modal / Thermal FEA)',
          'Ansys Fluent (CFD)',
          'SolidWorks Simulation',
          'Topology Optimization',
          'Vibration & Harmonic Response',
          'Non-Linear Stress Analysis',
          'Thermal Management & Heat Transfer',
        ],
      },
      {
        name: 'Tolerancing & Mechanism Design',
        skills: [
          'ASME Y14.5-2018 GD&T',
          '1D / 3D Tolerance Stack-up Analysis',
          'Harmonic Drive & Zero-Backlash Actuators',
          'Airborne Gimbal Mechanisms',
          'Optomechanical Assembly Design',
          'Kinematic Linkages & Cam Design',
        ],
      },
    ],
  },
  {
    category: 'Educational Skills',
    shortLabel: 'Academic & Theory',
    description: 'First-principles physics, structural mechanics, fluid dynamics & engineering mathematics',
    subcategories: [
      {
        name: 'Theoretical Mechanics & Physics',
        skills: [
          'Classical Mechanics & Dynamics',
          'Continuum Mechanics & Elasticity',
          'Thermodynamics & Heat Cycles',
          'Fluid Mechanics & Navier-Stokes',
          'Materials Science & Metallurgy',
          'Fatigue & Fracture Mechanics',
        ],
      },
      {
        name: 'Analytical & Mathematical Methods',
        skills: [
          'MATLAB & Simulink Mathematical Modeling',
          'Finite Element Mathematics & Numerical Methods',
          'Differential Equations & Fourier Analysis',
          'Linear Algebra & Vector Calculus',
          'Statistical Process Control (SPC)',
          'Design of Experiments (DOE)',
        ],
      },
      {
        name: 'Accreditation & Academic Foundations',
        skills: [
          'ABET Engineering Standards',
          'FE Mechanical Examination (EIT)',
          'Academic Research & Thesis Defense',
          'Technical Peer Review & Publication',
        ],
      },
    ],
  },
  {
    category: 'Handful Skills',
    shortLabel: 'Hands-on & Shop',
    description: 'Precision machining, multi-axis CNC, physical prototyping, metrology & assembly',
    subcategories: [
      {
        name: 'Machining & Fabrication',
        skills: [
          '5-Axis CNC Milling (Haas / Mastercam)',
          'Wire EDM & Sinker EDM',
          'Manual Lathe Turning & Mill Operations',
          'Precision Sheet Metal Fabrication',
          'TIG / MIG Welding & Brazing',
          'Die Casting & Injection Mold Tooling',
        ],
      },
      {
        name: 'Metrology & Quality Inspection',
        skills: [
          'Zeiss CMM Metrology & Touch Probing',
          'Optical & 3D Laser Scanning Inspection',
          'Surface Profilometry (Ra / Rz)',
          'First Article Inspection (FAI / AS9102)',
          'Gage R&R Measurement Analysis',
          'Micrometers, Calipers & Height Gages',
        ],
      },
      {
        name: 'Prototyping & Assembly',
        skills: [
          'Additive Manufacturing (DMLS / SLS / FDM 3D Printing)',
          'Rapid Hardware Prototyping',
          'Jig & Fixture Tooling Design',
          'Cleanroom Assembly (ISO Class 7/8)',
          'Mechanical Torque & Fastener Verification',
        ],
      },
    ],
  },
  {
    category: 'Personal Skills',
    shortLabel: 'Leadership & Soft Skills',
    description: 'Cross-functional leadership, design reviews, technical writing & vendor negotiation',
    subcategories: [
      {
        name: 'Leadership & Project Governance',
        skills: [
          'Cross-Functional Engineering Leadership',
          'Critical Path Project Management (PMP / Agile)',
          'Design for Manufacturability (DFM / DFA)',
          'Design Failure Mode & Effect Analysis (DFMEA / PFMEA)',
          'Budget Planning & CapEx / OpEx Rollups',
        ],
      },
      {
        name: 'Communication & Collaboration',
        skills: [
          'Technical Documentation & Drawing Release (ECO / ECN)',
          'Vendor Sourcing & Contract Negotiation',
          'Client Technical Consultation & Demos',
          'Root Cause Analysis (8D / 5-Whys)',
          'Mentorship & Junior Engineer Training',
          'Multi-disciplinary Team Coordination',
        ],
      },
    ],
  },
  {
    category: 'IT Skills',
    shortLabel: 'Computation & Software',
    description: 'Programming, cloud, automated data pipelines, databases & developer tooling',
    subcategories: [
      {
        name: 'Programming & Scripting',
        skills: [
          'Python (NumPy / SciPy / Pandas)',
          'TypeScript & Modern JavaScript',
          'C / C++ Embedded Motor Control',
          'Bash & Linux Shell Scripting',
          'SQL (PostgreSQL / SQLite)',
        ],
      },
      {
        name: 'Software, Web & Automation',
        skills: [
          'React.js & Full-Stack Web Development',
          'Node.js & Express REST APIs',
          'Git & GitHub Version Control',
          'Docker Containerization & CI/CD',
          'AI API Integration (Gemini / LLMs)',
          'Microcontroller Firmware (STM32 / Arduino)',
        ],
      },
    ],
  },
];

// Flat list of all predefined skills
export const ALL_PREDEFINED_SKILLS: string[] = Array.from(
  new Set(
    SKILLS_DATABASE.flatMap((group) =>
      group.subcategories.flatMap((sub) => sub.skills)
    )
  )
).sort((a, b) => a.localeCompare(b));

// Map skill name (lowercased) -> Category Name for classification
const SKILL_CATEGORY_MAP = new Map<string, SkillCategoryName>();
SKILLS_DATABASE.forEach((group) => {
  group.subcategories.forEach((sub) => {
    sub.skills.forEach((skill) => {
      SKILL_CATEGORY_MAP.set(skill.toLowerCase(), group.category);
    });
  });
});

/**
 * Categorizes an arbitrary comma-separated skills string into the 5 structured categories
 */
export function categorizeSkills(skillsString: string): Record<SkillCategoryName, string[]> {
  const result: Record<SkillCategoryName, string[]> = {
    'Generate Skills': [],
    'Educational Skills': [],
    'Handful Skills': [],
    'Personal Skills': [],
    'IT Skills': [],
  };

  if (!skillsString) return result;

  const rawList = skillsString
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  rawList.forEach((skill) => {
    const lower = skill.toLowerCase();
    let category: SkillCategoryName | undefined = SKILL_CATEGORY_MAP.get(lower);

    // Fallback heuristic classification for custom skills
    if (!category) {
      if (/cad|solidworks|creo|inventor|catia|nx|fusion|autocad|fea|ansys|cfd|gd&t|toleranc|gimbal|optomech|design calculation/i.test(skill)) {
        category = 'Generate Skills';
      } else if (/theory|math|physic|thermo|fluid|dynam|mechanic|abet|degree|calcul|educat|academ/i.test(skill)) {
        category = 'Educational Skills';
      } else if (/cnc|laser|engraver|cutter|animation|maxs|3d max|machin|edm|lathe|weld|sheet|prototyp|3d print|print|metrolog|cmm|shop|hand/i.test(skill)) {
        category = 'Handful Skills';
      } else if (/python|script|code|react|web|developer|c\+\+|c\/c\+\+|software|sql|git|docker|linux|cloud|api|it|ai|machine learning|cyber|graphic|microsoft|office/i.test(skill)) {
        category = 'IT Skills';
      } else {
        category = 'Personal Skills';
      }
    }

    if (!result[category].includes(skill)) {
      result[category].push(skill);
    }
  });

  return result;
}
