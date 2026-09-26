export type ProjectCategory = 'All' | 'CAD';

export interface ProjectMetric {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface ProblemConstraints {
  envelope: string;
  thermal: string;
  massBudget: string;
  vibrationDynamic: string;
  factorOfSafety: string;
  environmental: string;
}

export interface HandCalculation {
  title: string;
  formula: string;
  variables: string;
  stepByStep: string[];
  outcome: string;
}

export interface FeaBoundaryConditions {
  software: string;
  meshType: string;
  elementCount: string;
  fixedConstraints: string;
  appliedLoads: string;
  convergenceCriterion: string;
  maxVonMises: string;
  yieldStrength: string;
  sfCalculated: string;
  notes: string;
}

export interface BomItem {
  itemNo: number;
  partName: string;
  material: string;
  process: string;
  qty: number;
  prototypeCost: number;
  productionCost1k: number;
  dfmSavingsPercent: number;
  supplier: string;
  leadTimeWeeks: number;
}

export interface CalculationWhitepaper {
  title: string;
  docRef: string;
  pages: number;
  date: string;
  abstract: string;
  keyFindings: string[];
}

export interface SupervisorEndorsement {
  name: string;
  role: string;
  company: string;
  relationship: string;
  quote: string;
  date: string;
  linkedin: string;
}

export interface Project {
  id: string;
  title: string;
  tagline: string;
  category: 'CAD';
  completionDate: string;
  role: string;
  leadTimeWeeks: number;
  status: 'Production Deployed' | 'Validated Prototype' | 'Flight Ready' | 'Patent Pending';
  metrics: ProjectMetric[];
  heroImage: string;
  cadModelImage: string;
  physicalBuildImage: string;
  feaPlotImage: string;
  problemConstraints: ProblemConstraints;
  handCalculations: HandCalculation[];
  feaBoundaryConditions: FeaBoundaryConditions;
  individualContributions: string[];
  verifiedCredentials: string[];
  bom: BomItem[];
  calculationWhitepaper: CalculationWhitepaper;
  supervisorEndorsements: SupervisorEndorsement[];
  ipComplianceDisclaimer: string;
  gdtSpec: {
    drawingNo: string;
    revision: string;
    material: string;
    treatment: string;
    criticalDatums: { datum: string; feature: string; definition: string }[];
    callouts: { symbol: string; tolerance: string; datumRef: string; description: string }[];
  };
  modelType: 'harmonic_actuator' | 'gimbal_bracket' | 'planetary_gearbox' | 'chassis_suspension';
  websiteUrl?: string;
}
