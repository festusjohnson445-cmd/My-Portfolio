export type AllowedFileType = 'pdf' | 'cad' | 'cad_image';

export interface ScannedCaseStudy {
  title: string;
  tagline: string;
  massDelta: string;
  cycleTimeDelta: string;
  costSavings: string;
  factorOfSafety: string;
  problemEnvelope: string;
  thermalConstraint: string;
  vibrationConstraint: string;
  handCalculations: Array<{
    title: string;
    formula: string;
    variables: string;
    stepByStep: string[];
    outcome: string;
  }>;
  dfmOptimizations: string[];
  failureModesAnalyzed: string[];
}

export interface ScannedMetrology {
  drawingNo: string;
  revision: string;
  standard: string;
  datums: Array<{
    datum: string;
    feature: string;
    definition: string;
  }>;
  cmmInspectionPoints: Array<{
    id: string;
    feature: string;
    nominalMm: string;
    measuredMm: string;
    deviationMm: string;
    toleranceMm: string;
    status: 'PASS' | 'WARN';
  }>;
  surfaceRoughnessRa: string;
  fairStatus: string;
  bonusToleranceMmc: string;
  probeTechnique: string;
}

export interface ScannedSimulation {
  solver: string;
  meshType: string;
  elementCount: string;
  fixedConstraints: string;
  appliedLoads: string;
  maxVonMisesMpa: number;
  yieldStrengthMpa: number;
  calculatedSafetyFactor: number;
  maxDeflectionMm: number;
  modalResonances: Array<{
    mode: number;
    frequencyHz: number;
    description: string;
  }>;
  thermalHeatFlux?: string;
  convergenceStatus: string;
}

export type CADModelType =
  | 'harmonic_actuator'
  | 'gimbal_bracket'
  | 'planetary_gearbox'
  | 'chassis_suspension'
  | 'custom_uploaded'
  | 'hydraulic_actuator'
  | 'precision_spindle'
  | 'cnc_laser_engraver';

export interface ScannedCADModel {
  id: string;
  title: string;
  partNumber: string;
  drawingNumber: string;
  revision: string;
  fileName: string;
  fileSize: string;
  fileCategory: '3D PDF' | 'CAD Model (STEP/IGES)' | 'CAD Drawing (DWG/DXF)' | 'CAD Vector Image';
  uploadedImagePreview?: string; // If image or generated preview
  userDescription: string;
  material: string;
  finish: string;
  toleranceStandard: string;
  dimensions: {
    envelope: string;
    massTotal: string;
    criticalDatum: string;
    generalTolerance: string;
  };
  modelType: CADModelType;
  bom: Array<{
    itemNo: number;
    name: string;
    partNumber: string;
    material: string;
    finish: string;
    qty: number;
    massKg: number;
    notes: string;
  }>;
  gdtCallouts: Array<{
    id: string;
    feature: string;
    type: 'position' | 'flatness' | 'perpendicularity' | 'runout' | 'profile';
    symbol: string;
    tolerance: string;
    modifiers: string;
    datums: string;
    surfaceLocation: string;
    passMm: string;
  }>;
  scannedAt: string;
  confidenceScore: number;

  // Dynamically populated by CAD File Scanner & Instructions
  caseStudy: ScannedCaseStudy;
  metrology: ScannedMetrology;
  simulation: ScannedSimulation;
}

export type ViewportSection = 'exploded' | 'detailed_3d' | 'production_drawing';

