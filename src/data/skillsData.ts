export type SkillCategoryName =
  | 'Core Engineering Skills'
  | 'Handful Skills'
  | 'IT Skills';

export type SkillStatus = 'in progress' | 'verified' | 'licensed' | 'completed';

export const SKILL_STATUS_OPTIONS: SkillStatus[] = [
  'in progress',
  'verified',
  'licensed',
  'completed',
];

export const DEFAULT_SKILL_STATUS: SkillStatus = 'in progress';

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
    category: 'Core Engineering Skills',
    shortLabel: 'Core Engineering',
    description:
      'CAD architecture, FEA simulation, GD&T tolerancing, theoretical mechanics & engineering design governance',
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
          'Design Calculation',
          'Surface Modeling & Complex Lofting',
        ],
      },
      {
        name: 'Simulation, FEA & Theory',
        skills: [
          'FEA Analysis',
          'Ansys Workbench (Static / Modal / Thermal FEA)',
          'Ansys Fluent (CFD)',
          'SolidWorks Simulation',
          'Topology Optimization',
          'Vibration & Harmonic Response',
          'Non-Linear Stress Analysis',
          'Thermal Management & Heat Transfer',
          'Thermodynamics & Fluid Mechanics',
          'MATLAB & Simulink Mathematical Modeling',
        ],
      },
      {
        name: 'Tolerancing, Mechanisms & Governance',
        skills: [
          'ASME Y14.5-2018 GD&T',
          '1D / 3D Tolerance Stack-up Analysis',
          'Harmonic Drive & Zero-Backlash Actuators',
          'Airborne Gimbal Mechanisms',
          'Optomechanical Assembly Design',
          'Design for Manufacturability (DFM / DFA)',
          'DFMEA / PFMEA & Root Cause Analysis',
          'Cross-Functional Engineering Leadership',
        ],
      },
    ],
  },
  {
    category: 'Handful Skills',
    shortLabel: 'Handful Skills',
    description:
      'Hands-on shop fabrication, multi-axis CNC, laser cutting, metrology, rapid prototyping & precision assembly',
    subcategories: [
      {
        name: 'Machining & Fabrication',
        skills: [
          'CNC Machine',
          '5-Axis CNC Milling (Haas / Mastercam)',
          'Laser Engraver/Cutter',
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
        name: 'Prototyping, Sculpting & Assembly',
        skills: [
          '3D Animation',
          '3D Maxs',
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
    category: 'IT Skills',
    shortLabel: 'IT Skills',
    description:
      'Programming, full-stack software, databases, AI integration, cybersecurity & productivity suites',
    subcategories: [
      {
        name: 'Programming & Scripting',
        skills: [
          'Python (NumPy / SciPy / Pandas)',
          'TypeScript & Modern JavaScript',
          'C/C++',
          'C / C++ Embedded Motor Control',
          'Bash & Linux Shell Scripting',
          'SQL (PostgreSQL / SQLite)',
        ],
      },
      {
        name: 'Software, Web & Cloud',
        skills: [
          'React.js & Full-Stack Web Development',
          'Web Developer',
          'Node.js & Express REST APIs',
          'Git & GitHub Version Control',
          'Docker Containerization & CI/CD',
          'IT',
          'Microcontroller Firmware (STM32 / Arduino)',
        ],
      },
      {
        name: 'AI, Security & Digital Tools',
        skills: [
          'AI & Machine Learning',
          'AI API Integration (Gemini / LLMs)',
          'Cybersecurity',
          'Graphic Design',
          'Microsoft Office',
        ],
      },
    ],
  },
];

export const CORE_ENGINEERING_SKILLS_LIST: string[] = Array.from(
  new Set(
    SKILLS_DATABASE.find((g) => g.category === 'Core Engineering Skills')?.subcategories.flatMap(
      (s) => s.skills
    ) || []
  )
).sort((a, b) => a.localeCompare(b));

export const HANDFUL_SKILLS_LIST: string[] = Array.from(
  new Set(
    SKILLS_DATABASE.find((g) => g.category === 'Handful Skills')?.subcategories.flatMap(
      (s) => s.skills
    ) || []
  )
).sort((a, b) => a.localeCompare(b));

export const IT_SKILLS_LIST: string[] = Array.from(
  new Set(
    SKILLS_DATABASE.find((g) => g.category === 'IT Skills')?.subcategories.flatMap(
      (s) => s.skills
    ) || []
  )
).sort((a, b) => a.localeCompare(b));

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

export function stripSkillTags(rawSkill: string): string {
  return rawSkill
    .replace(/\[Certified(?::\s*[^\]]+)?\]/gi, '')
    .replace(/\(Certified(?::\s*[^\)]+)?\)/gi, '')
    .replace(/\[(In Progress|Verified|Licensed|Completed)\]/gi, '')
    .trim();
}

export function resolveSkillStatus(
  skillName: string,
  skillStatuses?: Record<string, SkillStatus>,
  legacyCertifiedSkills?: string[]
): SkillStatus {
  const clean = stripSkillTags(skillName);
  const lower = clean.toLowerCase();
  if (skillStatuses) {
    const exact = skillStatuses[clean];
    if (exact && SKILL_STATUS_OPTIONS.includes(exact)) return exact;
    const foundKey = Object.keys(skillStatuses).find((k) => k.toLowerCase() === lower);
    if (foundKey && SKILL_STATUS_OPTIONS.includes(skillStatuses[foundKey])) {
      return skillStatuses[foundKey];
    }
  }
  if (
    legacyCertifiedSkills?.some((c) => c.toLowerCase() === lower) ||
    /\[certified/i.test(skillName)
  ) {
    return 'verified';
  }
  return DEFAULT_SKILL_STATUS;
}

export function formatSkillStatusLabel(status: SkillStatus): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'licensed':
      return 'Licensed';
    case 'completed':
      return 'Completed';
    default:
      return 'In Progress';
  }
}

/**
 * Categorizes an arbitrary comma-separated skills string into the 3 structured parts:
 * Core Engineering Skills, Handful Skills, and IT Skills
 */
export function categorizeSkills(skillsString: string): Record<SkillCategoryName, string[]> {
  const result: Record<SkillCategoryName, string[]> = {
    'Core Engineering Skills': [],
    'Handful Skills': [],
    'IT Skills': [],
  };

  if (!skillsString) return result;

  const rawList = skillsString
    .split(',')
    .map((s) => stripSkillTags(s))
    .filter(Boolean);

  rawList.forEach((skill) => {
    const lower = skill.toLowerCase();
    let category: SkillCategoryName | undefined = SKILL_CATEGORY_MAP.get(lower);

    if (!category) {
      if (
        /cnc|laser|engraver|cutter|animation|maxs|3d max|3ds|machin|edm|lathe|weld|sheet|prototyp|3d print|print|metrolog|cmm|shop|handful|hand|fixture|assembly/i.test(
          skill
        )
      ) {
        category = 'Handful Skills';
      } else if (
        /python|script|code|react|web|developer|c\+\+|c\/c\+\+|software|sql|git|docker|linux|cloud|api|^it$|information tech|ai|machine learning|cyber|graphic|microsoft|office|node|typescript|javascript/i.test(
          skill
        )
      ) {
        category = 'IT Skills';
      } else {
        category = 'Core Engineering Skills';
      }
    }

    if (!result[category].includes(skill)) {
      result[category].push(skill);
    }
  });

  return result;
}
