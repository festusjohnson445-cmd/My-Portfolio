import { ServiceOffering } from '../types/extendedPortfolio';

export const DEFAULT_SERVICES: ServiceOffering[] = [
  {
    id: 'mechanical-design-engineering',
    title: 'Mechanical Design & Hardware Engineering',
    tagline: 'End-to-end mechanism synthesis, kinematics, load path optimization, and physics-driven structural engineering.',
    category: 'mechanical',
    iconName: 'Cpu',
    description: 'Transforming napkin concepts and boundary constraints into flight-rated, production-ready electro-mechanical hardware. Specializing in high-precision pan/tilt gimbals, harmonic reduction systems, optical mounts, and thermal management enclosures.',
    features: [
      'Multi-body kinematics and dynamic synthesis',
      'First-principles physics & analytical hand-calculation validation',
      'Structural load path optimization & mass reduction',
      'Thermal expansion & CTE mismatch mitigation (-40°C to +85°C)',
      'Preloaded duplex bearing arrangement & Hertzian stress calculations'
    ],
    deliverables: [
      'Native CAD assemblies with complete parametric revision history',
      'Comprehensive Engineering Design Document (EDD)',
      'Physics calculation report with safety factors (SF ≥ 2.0)',
      'Supplier selection & component off-the-shelf (COTS) sourcing matrix'
    ],
    toolsAndSoftware: ['SolidWorks', 'PTC Creo', 'Autodesk Inventor', 'Ansys Mechanical', 'MATLAB'],
    turnaroundTime: '2 to 6 weeks per development milestone',
    pricingModel: 'Milestone-based or Dedicated Engineering Sprint',
    featured: true
  },
  {
    id: 'cad-3d-modeling',
    title: 'Parametric CAD & Complex 3D Modeling',
    tagline: 'Robust top-down master modeling, skeleton frameworks, Class-A surfacing, and seamless assembly integration.',
    category: 'cad',
    iconName: 'Box',
    description: 'Engineering fully parametric 3D CAD models built for longevity and revision agility. Implementing robust skeleton modeling methodologies that prevent broken external references when scaling dimensions.',
    features: [
      'Top-down skeleton assembly architecture',
      'Complex lofting, curvature-continuous (G2) surfacing',
      'Injection molded plastic housing design with uniform draft angles',
      'Sheet metal design with accurate K-factors and bend deductions',
      'Multi-configuration family tables for product sizing variants'
    ],
    deliverables: [
      'Native SolidWorks (.sldprt, .sldasm) or Creo/Inventor part trees',
      'Neutral STEP (AP242 with PMI) and IGES archive files',
      'Interactive 3D HTML / WebGL visualization models',
      'Mass properties and center-of-gravity (CG) verification report'
    ],
    toolsAndSoftware: ['SolidWorks CSWP', 'Siemens NX', 'PTC Creo', 'Fusion 360', 'AutoCAD Mechanical'],
    turnaroundTime: '3 to 10 business days',
    pricingModel: 'Fixed-price per component or Hourly engineering rate',
    featured: true
  },
  {
    id: 'gdt-technical-drafting',
    title: '2D Technical Drafting & ASME Y14.5 GD&T',
    tagline: 'Uncompromising 2D production drawings with mathematically unambiguous datum reference frames and MMC modifiers.',
    category: 'drafting',
    iconName: 'FileText',
    description: 'Eliminating ambiguity on the shop floor. Every drawing adheres strictly to ASME Y14.5-2018 standards, ensuring zero assembly interference while giving CNC machinists the widest permissible manufacturing tolerances via MMC/LMC bonuses.',
    features: [
      'ASME Y14.5-2018 GD&T datum reference frame synthesis',
      'Worst-case and RSS (Root Sum Square) statistical 1D/3D tolerance stack-ups',
      'Composite position tolerancing for bolt hole patterns and dowel pins',
      'Runout, profile of a surface, and orientation controls',
      'Standardized title blocks, rev blocks, and welding/surface finish callouts'
    ],
    deliverables: [
      'Vector PDF production drawings (ANSI A through E sizes)',
      'Native 2D DWG / DXF CNC profiles',
      'Detailed 1D/3D Tolerance Stack-up calculation spreadsheets',
      'Inspection ballooned drawing with AS9102 First Article Inspection (FAI) sheets'
    ],
    toolsAndSoftware: ['ASME GDTP Senior Standards', 'SolidWorks Drawings', 'AutoCAD Mechanical', 'Excel / Python Stack Engine'],
    turnaroundTime: '2 to 5 business days',
    pricingModel: 'Fixed price per drawing sheet',
    featured: true
  },
  {
    id: 'cnc-laser-dfm',
    title: 'CNC Machining & Laser Cutting Preparation / DFM',
    tagline: 'Design for Manufacturability audits that slash machining cycle times and eliminate vendor setup scrap.',
    category: 'manufacturing',
    iconName: 'Wrench',
    description: 'Bridging the divide between design engineering and CNC spindle time. Auditing geometries for 3-axis / 5-axis tool access, standard end mill corner radii, fixture clamping surfaces, and sheet metal nesting efficiency.',
    features: [
      'Single-setup 5-axis CNC machining accessibility reviews',
      'Standard tooling radius optimization (eliminating custom EDM requirements)',
      'Laser cutting kerf compensation and micro-tab nesting layouts',
      'Sheet metal bend deduction & relief notch design',
      'Surface finish Ra specification matched to operational function'
    ],
    deliverables: [
      'DFM Redline Audit with actionable geometry rework recommendations',
      'Optimized DXF cut files with lead-ins and kerf specifications',
      'CNC setup orientation guide and stock billet sizing calculations',
      'Machining cycle time & cost reduction estimate'
    ],
    toolsAndSoftware: ['Mastercam', 'Fusion 360 CAM', 'AutoCAD', 'SheetCam', 'LaserCut / LightBurn'],
    turnaroundTime: '2 to 4 business days',
    pricingModel: 'Per-part DFM review or Project batch',
    featured: true
  },
  {
    id: 'product-design-prototyping',
    title: 'Rapid Prototyping & Functional Proof-of-Concept',
    tagline: 'Physical hardware iteration leveraging FDM, SLA, SLS 3D printing and quick-turn precision fabrication.',
    category: 'prototyping',
    iconName: 'Layers',
    description: 'Transforming digital models into tangible, bench-testable hardware within days. Evaluating ergonomic tactile feedback, snap fits, cable routing, and dynamic mechanism clearance before committing to steel tooling.',
    features: [
      'Additive manufacturing material selection (Carbon Fiber Nylon, Tough Resin, TPU, PETG)',
      'Interference fit, press fit, and threaded heat-set insert design',
      'Functional benchtop test rig design and instrumentation',
      'High-speed physical assembly validation and disassembly ergonomics',
      'Rapid turnaround design revisions between test iterations'
    ],
    deliverables: [
      'Sliced print-ready files (.3mf, .stl) with optimized infill and print orientation',
      'Functional 3D printed prototype units shipped or documented via video',
      'Empirical fit-and-function bench test report with high-res photography',
      'Iterative improvement log detailing dimensional adjustments'
    ],
    toolsAndSoftware: ['Bambu Studio', 'PrusaSlicer', 'Formlabs PreForm', 'Physical 3D Printing Farm', 'Digital Calipers & Gauges'],
    turnaroundTime: '3 to 7 business days',
    pricingModel: 'Sprint-based prototype cycle',
    featured: false
  },
  {
    id: 'fullstack-web-development',
    title: 'Full-Stack Web Engineering & Engineering Software',
    tagline: 'Production React/TypeScript web applications, interactive 3D WebGL viewers, and cloud database architectures.',
    category: 'software',
    iconName: 'Code',
    description: 'Combining hardware precision with modern software craftsmanship. Building high-performance responsive web portals, technical dashboards, interactive 3D model viewers (Three.js), and resilient cloud backends (Supabase/Node).',
    features: [
      'React 18/19 SPA & Next.js architectures with TypeScript',
      'Interactive 3D WebGL / Three.js model viewers and CAD file renderers',
      'Supabase PostgreSQL database schemas, RLS policies, and Realtime sync',
      'Tailwind CSS design systems with responsive layouts & light/dark themes',
      'REST & WebSocket APIs with robust error boundary handling'
    ],
    deliverables: [
      'Production-deployed web applications on Vercel, Netlify, or Google Cloud Run',
      'Clean, thoroughly typed Git repository with modular component structure',
      'Interactive CAD/3D viewer integration embeddable into client dashboards',
      'Database migration scripts (SQL / Drizzle ORM)'
    ],
    toolsAndSoftware: ['React', 'TypeScript', 'Tailwind CSS', 'Three.js / WebGL', 'Supabase / PostgreSQL', 'Node.js / Express', 'Vite'],
    turnaroundTime: '1 to 4 weeks depending on scope',
    pricingModel: 'Fixed project scope or Dedicated engineering sprint',
    featured: true
  },
  {
    id: 'technical-documentation-calculations',
    title: 'Engineering Calculations & Technical Documentation',
    tagline: 'First-principles mathematical proofs, Ansys FEA validation reports, and AS9100-compliant technical documentation.',
    category: 'consulting',
    iconName: 'BookOpen',
    description: 'Providing the rigorous mathematical foundations that underwrite mission-critical designs. Synthesizing hand calculations, FEA boundary conditions, and test results into publication-grade technical whitepapers.',
    features: [
      'Euler-Bernoulli beam deflection and modal frequency proofs',
      'Gear tooth bending (Lewis / AGMA) and contact fatigue analysis',
      'Press-fit hoop stress, shrink fits, and bolt preload torque calculations',
      'Ansys FEA simulation documentation with mesh convergence studies',
      'AS9100 / ISO 9001 compliant Assembly and Operating Manuals'
    ],
    deliverables: [
      'MathCAD / Python / Excel automated calculation workbooks',
      'Comprehensive FEA Simulation Verification Report (PDF)',
      'Exploded-view Illustrated Assembly Instructions (IOM)',
      'Executive Summary Presentation for technical stakeholders'
    ],
    toolsAndSoftware: ['Ansys Workbench', 'MathCAD', 'Python (NumPy / SciPy)', 'Excel Engineering Templates', 'LaTeX / Markdown'],
    turnaroundTime: '3 to 7 business days',
    pricingModel: 'Fixed price per technical calculation report',
    featured: false
  }
];
