/**
 * Verified Initial Engineering Archive Documents for Fesline Engineering Document Hub
 * Guarantees permanent, rich repository content across all visitor browsers
 */

export interface PublicEngineeringDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category:
    | 'Christians Book'
    | 'Inspirational Book'
    | 'Technical Drawing'
    | '3D CAD Model'
    | 'Production Blueprint'
    | 'Whitepaper & Report'
    | 'BOM & Specification'
    | 'Calculation & Dataset';
  description: string;
  author: string;
  uploaderName: string;
  uploaderType: 'owner' | 'visitor';
  status: 'approved' | 'pending';
  uploadDate: string;
  uploadTimestamp?: number;
  downloadCount: number;
  tags: string[];
  previewUrl?: string;
  dataUrl?: string;
  downloadUrl?: string;
  hasServerFile?: boolean;
  isCustomUpload?: boolean;
}

export const DEFAULT_HUB_DOCUMENTS: PublicEngineeringDocument[] = [
  {
    id: 'doc-seed-01-laser-gantry',
    title: 'ASME Y14.5 GD&T CNC Gantry Laser Engraver & Cutter Blueprint',
    fileName: 'WA0009_Laser_Engraver_Blueprint.pdf',
    fileSize: '3.4 MB',
    fileType: 'PDF',
    category: 'Technical Drawing',
    description: 'Fully constrained ASME Y14.5-2018 manufacturing drawing with Datum reference frame [-A-][-B-][-C-], 450nm 40W optical laser module assembly, 480x460mm envelope, and linear rail tolerance stack-up analysis.',
    author: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-10-02',
    uploadTimestamp: 1790669863000,
    downloadCount: 42,
    tags: ['ASME Y14.5', 'GD&T', 'Laser Engraver', 'CNC Gantry', 'Precision Machining'],
    downloadUrl: '/api/documents/files/doc-seed-01-laser-gantry',
    hasServerFile: true,
  },
  {
    id: 'doc-seed-02-harmonic-actuator',
    title: 'Dual-Axis Zero-Backlash Harmonic Actuator DFM Blueprint & Production Schedule',
    fileName: 'Harmonic_Actuator_DFM_Production_RevB.dwg',
    fileSize: '5.8 MB',
    fileType: 'DWG',
    category: 'Production Blueprint',
    description: 'Detailed mechanical fabrication blueprint for 115 N·m harmonic robotic actuator yoke, 6061-T6 aluminum CNC tool paths, bearing press-fit interference fits, and dual resolver alignment specs.',
    author: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-10-01',
    uploadTimestamp: 1790583463000,
    downloadCount: 38,
    tags: ['Robotics', 'Harmonic Drive', 'Production', 'DFM', 'CNC Milling'],
    downloadUrl: '/api/documents/files/doc-seed-02-harmonic-actuator',
    hasServerFile: true,
  },
  {
    id: 'doc-seed-03-cad-arm-assembly',
    title: '6-DOF Precision Articulated Robotic Manipulator Arm Assembly',
    fileName: '6DOF_Robotic_Arm_Kinematic_Assembly.step',
    fileSize: '18.2 MB',
    fileType: 'STEP',
    category: '3D CAD Model',
    description: 'Full solid STEP 3D CAD parametric assembly with kinematics constraints, payload capacity 5.5 kg, internal cable routing channels, quick-disconnect end-effector flange, and SolidWorks native mates.',
    author: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-09-28',
    uploadTimestamp: 1790324263000,
    downloadCount: 57,
    tags: ['STEP', 'CAD', 'SolidWorks', 'Kinematics', 'Mechatronics'],
    downloadUrl: '/api/documents/files/doc-seed-03-cad-arm-assembly',
    hasServerFile: true,
  },
  {
    id: 'doc-seed-04-christian-book',
    title: 'Walking in Divine Grace: Faith, Purpose and Technical Excellence',
    fileName: 'Walking_In_Divine_Grace_Christian_Life.pdf',
    fileSize: '2.1 MB',
    fileType: 'PDF',
    category: 'Christians Book',
    description: 'An uplifting spiritual treatise exploring divine stewardship, integrity in professional craft, relentless faith through adversity, and dedicating technical excellence to the glory of God.',
    author: 'Festus, Olorunsogo Johnson',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-09-24',
    uploadTimestamp: 1789978663000,
    downloadCount: 64,
    tags: ['Christian Book', 'Faith', 'Inspiration', 'Purpose', 'Grace'],
    downloadUrl: '/api/documents/files/doc-seed-04-christian-book',
    hasServerFile: true,
  },
  {
    id: 'doc-seed-05-inspirational-book',
    title: 'The Mindset of Precision: Engineering Leadership & Disciplined Focus',
    fileName: 'Mindset_Of_Precision_Leadership_Guide.pdf',
    fileSize: '1.9 MB',
    fileType: 'PDF',
    category: 'Inspirational Book',
    description: 'Actionable blueprint on first-principles thinking, building unshakeable technical habits, mastering complex engineering challenges, and cultivating elite execution discipline.',
    author: 'Festus, Olorunsogo Johnson',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-09-20',
    uploadTimestamp: 1789633063000,
    downloadCount: 49,
    tags: ['Inspirational', 'Leadership', 'Mindset', 'Discipline', 'Growth'],
    downloadUrl: '/api/documents/files/doc-seed-05-inspirational-book',
    hasServerFile: true,
  },
  {
    id: 'doc-seed-06-thermal-fea-dataset',
    title: 'Multiphysics Thermal Dissipation & Harmonic Vibration FEA Dataset',
    fileName: 'Airborne_Gimbal_Vibration_FEA_Dataset.xlsx',
    fileSize: '4.6 MB',
    fileType: 'XLSX',
    category: 'Calculation & Dataset',
    description: 'Empirical acceleration PSD data, modal frequency sweep from 10 Hz to 2,000 Hz, finite element boundary condition matrices, and steady-state thermal dissipation curve calculations for 40W diode heatsink.',
    author: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-09-15',
    uploadTimestamp: 1789201063000,
    downloadCount: 31,
    tags: ['FEA', 'Vibration', 'Thermal Simulation', 'Dataset', 'ANSYS'],
    downloadUrl: '/api/documents/files/doc-seed-06-thermal-fea-dataset',
    hasServerFile: true,
  },
  {
    id: 'doc-seed-07-whitepaper-gimbal',
    title: 'Topology Optimization & 41.8% Structural Mass Reduction in Airborne Gimbals',
    fileName: 'Whitepaper_Airborne_Gimbal_Topology_Optimization.pdf',
    fileSize: '2.8 MB',
    fileType: 'PDF',
    category: 'Whitepaper & Report',
    description: 'Peer-reviewed technical whitepaper detailing the topology optimization methodology that reduced airborne optical gimbal yoke mass from 1,420g to 826g while elevating natural frequency from 180 Hz to 342 Hz.',
    author: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-09-10',
    uploadTimestamp: 1788769063000,
    downloadCount: 73,
    tags: ['Whitepaper', 'Topology Optimization', 'Aerospace', 'Mass Reduction'],
    downloadUrl: '/api/documents/files/doc-seed-07-whitepaper-gimbal',
    hasServerFile: true,
  },
  {
    id: 'doc-seed-08-bom-fasteners',
    title: 'Master Mechanical Bill of Materials & High-Strength Fastener Torque Schedule',
    fileName: 'Master_BOM_Fastener_Torque_Schedule_RevC.xlsx',
    fileSize: '1.2 MB',
    fileType: 'XLSX',
    category: 'BOM & Specification',
    description: 'Complete parts breakdown, vendor SKU cross-reference, Grade 12.9 socket head cap screw torque values with Loctite 242 specifications, and DFM unit cost analysis.',
    author: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderName: 'Festus, Olorunsogo Johnson (Owner)',
    uploaderType: 'owner',
    status: 'approved',
    uploadDate: '2026-09-05',
    uploadTimestamp: 1788337063000,
    downloadCount: 29,
    tags: ['BOM', 'Fasteners', 'Torque Schedule', 'Procurement', 'Assembly'],
    downloadUrl: '/api/documents/files/doc-seed-08-bom-fasteners',
    hasServerFile: true,
  },
];
