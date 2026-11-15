import { BlogArticle } from '../types/extendedPortfolio';

export const DEFAULT_ARTICLES: BlogArticle[] = [
  {
    id: 'first-principles-vs-fea-traps',
    slug: 'first-principles-vs-fea-traps',
    title: 'Euler-Bernoulli vs Ansys: Why First-Principles Math Prevents Million-Dollar FEA Traps',
    summary: 'Finite element simulations produce visually convincing, colorful stress plots—even when the underlying boundary conditions are catastrophically wrong. Here is how back-of-the-envelope physics saved our airborne optical gimbal from resonance failure.',
    content: `
### The Illusion of Computational Precision

Modern CAD and FEA suites have made it deceptively easy to import a solid body, click "Auto-Mesh", apply a fixed support, and generate a vibrant von Mises stress contour within minutes.

However, computational FEA operates on a strict principle of **Garbage In, Rainbows Out**. Without an analytical sanity check, subtle modeling errors—such as artificial singularities at sharp re-entrant corners, over-constrained rotational degrees of freedom, or improperly modeled contact stiffness—can lead engineers to sign off on structures destined to fail on the vibration table.

### Case Study: The Airborne Gimbal Yoke Resonance

During the preliminary design phase of an airborne bi-axial optomechanical mount, our design objective was simple yet demanding:
- **Structural mass:** < 900 grams
- **First fundamental natural resonance ($f_n$):** $\\ge 200\\text{ Hz}$ to avoid optical payload jitter under aircraft engine idle vibration (120–180 Hz).

Our initial raw CAD model, when meshed in Ansys with default bonded trunnion contacts, yielded an impressive first-mode eigenfrequency of **342 Hz**.

Before cutting titanium billet, we performed an analytical Euler-Bernoulli cantilever verification:

$$f_n = \\frac{3.52}{2\\pi} \\sqrt{\\frac{E \\cdot I}{m_{\\text{eff}} \\cdot L^3}}$$

Where:
- $E = 114\\text{ GPa}$ (Titanium Ti-6Al-4V Grade 5)
- $I = 1.48 \\times 10^{-7}\\text{ m}^4$ (Moment of inertia across the critical yoke root)
- $m_{\\text{eff}} = 1.85\\text{ kg}$ (Equivalent lumped mass including sensor turret)
- $L = 0.165\\text{ m}$ (Effective cantilever span)

Solving the analytical closed-form equation:
$$EI = (114 \\times 10^9\\text{ N/m}^2) \\times (1.48 \\times 10^{-7}\\text{ m}^4) = 16,872\\text{ N}\\cdot\\text{m}^2$$
$$f_n = 0.560 \\times \\sqrt{\\frac{16,872}{1.85 \\times 0.00449}} = 344.2\\text{ Hz}$$

### The 0.6% Sanity Check Discrepancy

The analytical hand calculation ($344.2\\text{ Hz}$) matched the Ansys higher-order 10-node tetrahedral simulation ($342.1\\text{ Hz}$) within **0.6%**. 

Why is this result profound?
1. It proved that our Ansys boundary conditions were not artificially stiffening the fixture.
2. It confirmed that the rib web thickness was functioning as a true Euler-Bernoulli flexural member without shear locking.
3. It gave our aerospace clients 100% confidence to authorize 5-axis CNC machining of the Grade 5 titanium billet without requiring multiple physical prototype test spins.

### Key Takeaways for Hardware Designers
- **Never mesh before calculating:** Spend 15 minutes deriving the theoretical upper and lower bounds using classical beam, plate, or Hertzian formulas.
- **Isolate singularities:** Watch for 90-degree internal fillets where stress reaches artificial infinities as mesh density increases.
- **Audit your constraints:** An infinitely rigid "Fixed Support" rarely exists in real physics. Model the compliant compliance of bearings and bolt interfaces whenever dynamic modal isolation matters.
    `,
    cover_image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
    category: 'FEA & Physics',
    tags: ['FEA', 'Hand Calculations', 'Vibration', 'Mechanics', 'Aerospace'],
    author_name: 'Festus Johnson',
    author_role: 'Lead Mechanical Design Engineer',
    published_at: '2026-03-12T10:00:00Z',
    reading_time_minutes: 6,
    view_count: 342,
    like_count: 58,
    is_published: true,
    is_featured: true
  },
  {
    id: 'demystifying-asme-y14-5-gdt-composite-position',
    slug: 'demystifying-asme-y14-5-gdt-composite-position',
    title: 'Demystifying ASME Y14.5 Composite Position Tolerancing for Precision Machining',
    summary: 'Composite feature control frames are often feared by draftsmen and misunderstood by machinists. Here is a clear breakdown of PLTZF vs FRTZF, datum modifiers, and how MMC unlocks up to 35% wider manufacturing tolerances.',
    content: `
### The Cost of Plus-Minus Coordinate Tolerancing

Traditional Cartesian plus-or-minus tolerancing (e.g. $X = 50.00 \\pm 0.05\\text{ mm}, Y = 25.00 \\pm 0.05\\text{ mm}$) produces a square tolerance zone of $0.10 \\times 0.10\\text{ mm}$.

Under ASME Y14.5-2018, true position uses a **cylindrical tolerance zone** that increases the usable manufacturing area by **57%** for the exact same clearance envelope, while eliminating the diagonal "drift" that causes mating bolts to jam.

### Deconstructing the Composite Feature Control Frame

When designing a pattern of mounting holes (such as a 6-bolt circle on an optical flange), you care about two distinct physical requirements:
1. **Pattern Location:** Where does the whole bolt cluster sit relative to the primary datum reference frame (e.g. relative to the chassis)?
2. **Feature-to-Feature Spacing:** How accurately are the holes positioned relative to each other so the mating flange drops in cleanly?

Composite tolerancing decouples these two requirements into two tiers within a single feature control frame:

\`\`\`
| ⌖ | ⌀ 0.25 Ⓜ | A | B | C |  <- Pattern-Locating Tolerance Zone Framework (PLTZF)
|   | ⌀ 0.05 Ⓜ | A |      |    |  <- Feature-Relating Tolerance Zone Framework (FRTZF)
\`\`\`

#### Tier 1: PLTZF (The Outer Boundary)
- Governs where the pattern as a collective whole is located relative to Datums A, B, and C.
- Given a larger tolerance zone ($0.25\\text{ mm}$) because loose chassis assembly clearances can absorb location variations without degradation.

#### Tier 2: FRTZF (The Pitch & Spacing)
- Governs the hole-to-hole spacing within the pattern and perpendicularity to primary Datum A.
- Given a tight tolerance zone ($0.05\\text{ mm}$) ensuring that the high-precision dowel pins and cap screws align with absolute repeatability.
- Notice Datums B and C are omitted: rotational and translational orientation to B and C are relaxed, saving expensive CNC re-indexing time.

### The Power of the Maximum Material Condition (MMC) Bonus

By appending the circled-M modifier ($Ⓜ$) to both tiers, any departure from the hole's minimum permissible diameter creates a **bonus tolerance**:

$$\\text{Total Permissible Tolerance} = \\text{Specified Tolerance} + (\\text{Actual Hole Size} - \\text{MMC Size})$$

For example:
- Specified Hole: $\\varnothing 6.000 +0.10 / -0.00$
- At MMC ($\\varnothing 6.000$): Permissible position error is $0.05\\text{ mm}$.
- If the reamer finishes the hole at $\\varnothing 6.080$: The permissible position error expands to $0.05 + 0.08 = \\mathbf{0.13\\text{ mm}}$!

This single modifier prevented 14 scrap parts during our 5-axis aerospace gimbal production run, directly translating to **$18,400 in scrap avoidance**.

### Engineering Recommendation
Never dimension bolt patterns with linear $\\pm$ coordinates. Apply composite true position with MMC modifiers to reward machining precision with generous functional bonus tolerances.
    `,
    cover_image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=1200&q=80',
    category: 'CAD Standards',
    tags: ['GD&T', 'ASME Y14.5', 'Drafting', 'CNC Machining', 'Tolerance Stackup'],
    author_name: 'Festus Johnson',
    author_role: 'Lead Mechanical Design Engineer (ASME GDTP Senior)',
    published_at: '2026-02-18T14:30:00Z',
    reading_time_minutes: 8,
    view_count: 512,
    like_count: 89,
    is_published: true,
    is_featured: true
  },
  {
    id: 'harmonic-drive-flexspline-fatigue-analysis',
    slug: 'harmonic-drive-flexspline-fatigue-analysis',
    title: 'Zero-Backlash Strain-Wave Gear Mechanics: Flexspline Fatigue & Wave Generator Kinematics',
    summary: 'Harmonic strain-wave reducers achieve 100:1 gear reduction with zero backlash inside a pocket-sized package. Here is an in-depth mechanical review of flexspline elliptical deflection stresses and Gerber fatigue margins.',
    content: `
### Why Strain-Wave Gearing Dominates Robotics

Robotic joints and airborne pan-tilt gimbals require three contradictory mechanical characteristics:
1. Extremely high reduction ratio ($> 80:1$) within minimal axial length.
2. High torsional stiffness ($> 15,000\\text{ N}\\cdot\\text{m/rad}$).
3. **True zero mechanical backlash** across reversals to prevent closed-loop servo hunting.

Conventional planetary gearboxes achieve low backlash only through anti-backlash spring splits or preloaded gear meshes that generate high friction and rapid wear.

The strain-wave gear (invented by C.W. Musser) resolves this through continuous elastic deformation of a thin-walled steel cup: the **Flexspline**.

### Anatomy of the 100:1 Strain Wave System

A strain-wave reducer consists of three fundamental coaxial components:
1. **Wave Generator:** An elliptical cam enclosed by a specialized thin-race flexible ball bearing.
2. **Flexspline:** A flexible, thin-walled cylindrical cup of high-grade alloy steel (4340 or 17-4 PH) with external teeth.
3. **Circular Spline:** A rigid ring with internal teeth.

The fundamental reduction kinematics obey:
$$i = \\frac{Z_{\\text{flex}}}{Z_{\\text{circ}} - Z_{\\text{flex}}}$$

In our 100:1 design:
- Circular Spline teeth: $Z_{\\text{circ}} = 202$
- Flexspline teeth: $Z_{\\text{flex}} = 200$
- Reduction ratio: $i = \\frac{200}{202 - 200} = \\mathbf{100:1}$ (reverse rotation).

### Flexspline Elastic Bending & Gerber Fatigue Life

Because the flexspline flexes elliptically two times per revolution of the wave generator, its outer teeth experience continuous alternating cyclic bending stresses.

The radial deflection of the flexspline wall follows:
$$w(\\theta) = w_0 \\cos(2\\theta)$$
Where $w_0$ is the radial lift generated by the wave generator major axis.

The alternating bending stress $\\sigma_a$ across the thin diaphragm wall is:
$$\\sigma_a = \\frac{E \\cdot t}{2 \\cdot (1 - \\nu^2) \\cdot R^2} \\cdot w_0$$

Combined with the steady torsional shear stress $\\tau_m$ resulting from the output torque ($115\\text{ N}\\cdot\\text{m}$), we apply the **Gerber Fatigue Criterion**:

$$\\frac{\\sigma_a}{S_e} + \\left(\\frac{\\sigma_m}{S_{ut}}\\right)^2 = \\frac{1}{\\text{SF}}$$

Using vacuum-arc remelted (VAR) 4340 alloy steel heat-treated to 36–40 HRC:
- Ultimate Tensile Strength ($S_{ut}$): $1,180\\text{ MPa}$
- Endurance Limit ($S_e$): $540\\text{ MPa}$ (including Ra 0.2 surface finish and size factor derating)
- Calculated Peak Alternating Stress ($\\sigma_a$): $198\\text{ MPa}$
- Mean Stress from torque ($\\sigma_m$): $82\\text{ MPa}$

$$\\text{SF} = \\left( \\frac{198}{540} + \\left(\\frac{82}{1180}\\right)^2 \\right)^{-1} = (0.366 + 0.0048)^{-1} = \\mathbf{2.69}$$

### Conclusion

A safety factor of **2.69 against infinite life ($> 10^7$ cycles)** proves that high-ratio harmonic gearboxes can withstand flight shock loads without flexspline cup rupture when diaphragm fillet radii are designed with continuous curvature transitions.
    `,
    cover_image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
    category: 'Mechanical Design',
    tags: ['Robotics', 'Gears', 'Harmonic Reducer', 'Fatigue Analysis', 'Mechanisms'],
    author_name: 'Festus Johnson',
    author_role: 'Lead Mechanical Design Engineer',
    published_at: '2026-01-24T09:15:00Z',
    reading_time_minutes: 7,
    view_count: 420,
    like_count: 73,
    is_published: true,
    is_featured: false
  }
];
