import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding knowledge graph…")

  // ─── Pathways ────────────────────────────────────────
  const pathways = await Promise.all(
    [
      { name: "mTOR Signalling", category: "aging", description: "Mechanistic target of rapamycin – central growth/aging regulator" },
      { name: "AMPK Activation", category: "metabolic", description: "AMP-activated protein kinase – energy sensor and longevity pathway" },
      { name: "Sirtuin / NAD+ Metabolism", category: "epigenetic", description: "NAD-dependent deacetylases involved in DNA repair and aging" },
      { name: "NF-κB Inflammatory Cascade", category: "inflammatory", description: "Master regulator of inflammatory gene expression" },
      { name: "Autophagy", category: "aging", description: "Cellular self-cleaning and recycling of damaged components" },
      { name: "Insulin / IGF-1 Signalling", category: "hormonal", description: "Growth hormone axis modulating aging rate" },
      { name: "DNA Methylation", category: "epigenetic", description: "Epigenetic clock mechanism; methylation patterns shift with age" },
      { name: "Telomere Maintenance", category: "aging", description: "Chromosome end-cap preservation linked to cellular senescence" },
      { name: "Senescence / SASP", category: "aging", description: "Senescent cell accumulation and secretory phenotype driving tissue dysfunction" },
      { name: "Mitochondrial Biogenesis", category: "metabolic", description: "PGC-1α driven mitochondrial quality and quantity" },
    ].map((p) =>
      prisma.pathway.upsert({
        where: { name: p.name },
        update: {},
        create: p,
      })
    )
  )

  const pw = Object.fromEntries(pathways.map((p) => [p.name, p.id]))

  // ─── Compounds ───────────────────────────────────────
  const compounds = [
    {
      name: "Rapamycin",
      category: "drug",
      mechanism: "mTOR complex 1 inhibitor; promotes autophagy and reduces cellular senescence",
      casNumber: "53123-88-9",
      aliases: JSON.stringify(["Sirolimus", "Rapamune"]),
    },
    {
      name: "Metformin",
      category: "drug",
      mechanism: "AMPK activator; reduces hepatic glucose production; potential geroprotector",
      casNumber: "657-24-9",
      aliases: JSON.stringify(["Glucophage"]),
    },
    {
      name: "NMN",
      category: "supplement",
      mechanism: "NAD+ precursor; restores cellular NAD+ levels declining with age",
      casNumber: "1094-61-7",
      aliases: JSON.stringify(["Nicotinamide Mononucleotide", "β-NMN"]),
    },
    {
      name: "NR",
      category: "supplement",
      mechanism: "NAD+ precursor converted via NRK pathway; supports sirtuin activity",
      casNumber: "1341-23-7",
      aliases: JSON.stringify(["Nicotinamide Riboside", "Niagen"]),
    },
    {
      name: "Resveratrol",
      category: "supplement",
      mechanism: "Polyphenol activating SIRT1; anti-inflammatory and antioxidant properties",
      casNumber: "501-36-0",
      aliases: JSON.stringify(["trans-Resveratrol"]),
    },
    {
      name: "Fisetin",
      category: "supplement",
      mechanism: "Flavonoid senolytic; selectively clears senescent cells",
      casNumber: "528-48-3",
      aliases: null,
    },
    {
      name: "Dasatinib",
      category: "drug",
      mechanism: "Tyrosine kinase inhibitor used as senolytic in combination with quercetin",
      casNumber: "302962-49-8",
      aliases: JSON.stringify(["Sprycel"]),
    },
    {
      name: "Quercetin",
      category: "supplement",
      mechanism: "Flavonoid senolytic and anti-inflammatory; enhances dasatinib senolytic effect",
      casNumber: "117-39-5",
      aliases: null,
    },
    {
      name: "Spermidine",
      category: "supplement",
      mechanism: "Polyamine inducing autophagy; cardioprotective in epidemiological studies",
      casNumber: "124-20-9",
      aliases: null,
    },
    {
      name: "Alpha-Ketoglutarate",
      category: "supplement",
      mechanism: "TCA cycle metabolite; extended lifespan in C. elegans and mice models",
      casNumber: "328-50-7",
      aliases: JSON.stringify(["AKG", "Calcium AKG"]),
    },
    {
      name: "Berberine",
      category: "supplement",
      mechanism: "AMPK activator; lowers blood glucose and lipids; anti-inflammatory",
      casNumber: "2086-83-1",
      aliases: null,
    },
    {
      name: "Senolytics D+Q",
      category: "drug",
      mechanism: "Dasatinib + Quercetin combination protocol for senescent cell clearance",
      aliases: JSON.stringify(["D+Q", "Dasatinib plus Quercetin"]),
    },
  ]

  const compoundRecords = await Promise.all(
    compounds.map((c) =>
      prisma.compound.upsert({
        where: { name: c.name },
        update: {},
        create: c,
      })
    )
  )

  const cmp = Object.fromEntries(compoundRecords.map((c) => [c.name, c.id]))

  // ─── Compound ↔ Pathway links ───────────────────────
  const links = [
    { compoundId: cmp["Rapamycin"], pathwayId: pw["mTOR Signalling"], effect: "inhibitor", strength: "strong" },
    { compoundId: cmp["Rapamycin"], pathwayId: pw["Autophagy"], effect: "activator", strength: "strong" },
    { compoundId: cmp["Metformin"], pathwayId: pw["AMPK Activation"], effect: "activator", strength: "strong" },
    { compoundId: cmp["Metformin"], pathwayId: pw["mTOR Signalling"], effect: "inhibitor", strength: "moderate" },
    { compoundId: cmp["NMN"], pathwayId: pw["Sirtuin / NAD+ Metabolism"], effect: "activator", strength: "strong" },
    { compoundId: cmp["NR"], pathwayId: pw["Sirtuin / NAD+ Metabolism"], effect: "activator", strength: "strong" },
    { compoundId: cmp["Resveratrol"], pathwayId: pw["Sirtuin / NAD+ Metabolism"], effect: "activator", strength: "moderate" },
    { compoundId: cmp["Resveratrol"], pathwayId: pw["NF-κB Inflammatory Cascade"], effect: "inhibitor", strength: "moderate" },
    { compoundId: cmp["Fisetin"], pathwayId: pw["Senescence / SASP"], effect: "inhibitor", strength: "strong" },
    { compoundId: cmp["Fisetin"], pathwayId: pw["NF-κB Inflammatory Cascade"], effect: "inhibitor", strength: "moderate" },
    { compoundId: cmp["Dasatinib"], pathwayId: pw["Senescence / SASP"], effect: "inhibitor", strength: "strong" },
    { compoundId: cmp["Quercetin"], pathwayId: pw["Senescence / SASP"], effect: "inhibitor", strength: "moderate" },
    { compoundId: cmp["Quercetin"], pathwayId: pw["NF-κB Inflammatory Cascade"], effect: "inhibitor", strength: "moderate" },
    { compoundId: cmp["Spermidine"], pathwayId: pw["Autophagy"], effect: "activator", strength: "strong" },
    { compoundId: cmp["Spermidine"], pathwayId: pw["Mitochondrial Biogenesis"], effect: "activator", strength: "moderate" },
    { compoundId: cmp["Alpha-Ketoglutarate"], pathwayId: pw["mTOR Signalling"], effect: "inhibitor", strength: "moderate" },
    { compoundId: cmp["Berberine"], pathwayId: pw["AMPK Activation"], effect: "activator", strength: "strong" },
    { compoundId: cmp["Berberine"], pathwayId: pw["Insulin / IGF-1 Signalling"], effect: "modulator", strength: "moderate" },
    { compoundId: cmp["Senolytics D+Q"], pathwayId: pw["Senescence / SASP"], effect: "inhibitor", strength: "strong" },
  ]

  for (const link of links) {
    await prisma.compoundPathway.upsert({
      where: { compoundId_pathwayId: { compoundId: link.compoundId, pathwayId: link.pathwayId } },
      update: {},
      create: link,
    })
  }

  // ─── Interactions ────────────────────────────────────
  const interactions = [
    { compoundAId: cmp["Rapamycin"], compoundBId: cmp["Metformin"], severity: "BENEFICIAL" as const, description: "Complementary geroprotective mechanisms; combined mTOR inhibition + AMPK activation" },
    { compoundAId: cmp["Dasatinib"], compoundBId: cmp["Quercetin"], severity: "BENEFICIAL" as const, description: "Standard D+Q senolytic protocol; quercetin enhances dasatinib senolytic activity" },
    { compoundAId: cmp["NMN"], compoundBId: cmp["Resveratrol"], severity: "BENEFICIAL" as const, description: "NMN provides NAD+ substrate; resveratrol activates SIRT1 to consume it" },
    { compoundAId: cmp["Metformin"], compoundBId: cmp["Berberine"], severity: "CAUTION" as const, description: "Both lower blood glucose via AMPK; combined use risks hypoglycemia" },
    { compoundAId: cmp["Rapamycin"], compoundBId: cmp["Fisetin"], severity: "NEUTRAL" as const, description: "Different mechanisms (mTOR vs senolytic); no established interaction" },
  ]

  for (const ix of interactions) {
    await prisma.compoundInteraction.upsert({
      where: { compoundAId_compoundBId: { compoundAId: ix.compoundAId, compoundBId: ix.compoundBId } },
      update: {},
      create: ix,
    })
  }

  // ─── Biomarker effects ──────────────────────────────
  const effects = [
    { compoundId: cmp["Metformin"], biomarkerName: "HbA1c", direction: "decrease", magnitude: "significant", source: "Multiple RCTs" },
    { compoundId: cmp["Metformin"], biomarkerName: "CRP", direction: "decrease", magnitude: "moderate", source: "TAME trial preliminary" },
    { compoundId: cmp["NMN"], biomarkerName: "NAD+ levels", direction: "increase", magnitude: "significant", source: "Igarashi et al. 2022" },
    { compoundId: cmp["Rapamycin"], biomarkerName: "mTORC1 activity", direction: "decrease", magnitude: "significant", source: "Mannick et al. 2018" },
    { compoundId: cmp["Fisetin"], biomarkerName: "p16INK4a (senescence marker)", direction: "decrease", magnitude: "moderate", source: "Yousefzadeh et al. 2018" },
    { compoundId: cmp["Spermidine"], biomarkerName: "Diastolic blood pressure", direction: "decrease", magnitude: "mild", source: "Eisenberg et al. 2016" },
    { compoundId: cmp["Berberine"], biomarkerName: "LDL cholesterol", direction: "decrease", magnitude: "moderate", source: "Dong et al. 2012 meta-analysis" },
    { compoundId: cmp["Resveratrol"], biomarkerName: "CRP", direction: "decrease", magnitude: "mild", source: "Koushki et al. 2018 meta-analysis" },
  ]

  for (const eff of effects) {
    const existing = await prisma.compoundBiomarkerEffect.findFirst({
      where: { compoundId: eff.compoundId, biomarkerName: eff.biomarkerName },
    })
    if (!existing) {
      await prisma.compoundBiomarkerEffect.create({ data: eff })
    }
  }

  console.log(`Seeded ${pathways.length} pathways, ${compoundRecords.length} compounds, ${links.length} links, ${interactions.length} interactions, ${effects.length} biomarker effects`)

  // ─── Learning Articles ─────────────────────────────────
  // Create a system author for seeded content
  const systemAuthor = await prisma.user.upsert({
    where: { email: "content@biozephyra.com" },
    update: {},
    create: {
      email: "content@biozephyra.com",
      name: "Biozephyra Science Team",
      passwordHash: "SYSTEM_ACCOUNT_NO_LOGIN",
      role: "RESEARCHER",
    },
  })

  const articles = [
    {
      slug: "hallmarks-of-aging",
      topic: "OVERVIEW" as const,
      title: "The 12 Hallmarks of Aging",
      summary: "A comprehensive overview of the biological mechanisms that drive aging, from genomic instability to altered intercellular communication.",
      body: `## The 12 Hallmarks of Aging

Aging is not a single process but a convergence of interconnected biological mechanisms. In 2023, López-Otín et al. expanded the original 9 hallmarks to 12:

### Primary Hallmarks (causes of damage)
1. **Genomic instability** — Accumulation of DNA damage from endogenous and exogenous sources
2. **Telomere attrition** — Progressive shortening of chromosome protective caps
3. **Epigenetic alterations** — Changes in DNA methylation, histone modification, and chromatin remodeling
4. **Loss of proteostasis** — Decline in protein folding quality control

### Antagonistic Hallmarks (responses to damage)
5. **Deregulated nutrient sensing** — Dysfunction in mTOR, AMPK, insulin/IGF-1, and sirtuin pathways
6. **Mitochondrial dysfunction** — Reduced oxidative phosphorylation efficiency and increased ROS
7. **Cellular senescence** — Accumulation of growth-arrested cells with pro-inflammatory secretome (SASP)

### Integrative Hallmarks (culprits of the phenotype)
8. **Stem cell exhaustion** — Decline in regenerative capacity
9. **Altered intercellular communication** — Chronic low-grade inflammation ("inflammaging")

### New Hallmarks (added 2023)
10. **Disabled macroautophagy** — Impaired cellular recycling mechanisms
11. **Chronic inflammation** — Elevated baseline inflammatory signaling
12. **Dysbiosis** — Age-related changes in microbiome composition

Understanding these hallmarks is essential for designing effective longevity interventions, as most anti-aging compounds target one or more of these pathways.

**Key reference:** López-Otín C, et al. *Hallmarks of aging: An expanding universe.* Cell. 2023;186(2):243-278.`,
    },
    {
      slug: "mtor-rapamycin-longevity",
      topic: "PATHWAYS" as const,
      title: "mTOR Inhibition and Rapamycin: The Most Validated Longevity Pathway",
      summary: "How mTOR signalling controls aging and why rapamycin remains the most consistently life-extending compound across species.",
      body: `## mTOR Inhibition and Longevity

The mechanistic target of rapamycin (mTOR) is a serine/threonine kinase that integrates signals from nutrients, growth factors, and energy status to regulate cell growth and metabolism.

### Why mTOR Matters for Aging
- **Overactivation accelerates aging**: Chronic mTOR signaling drives protein synthesis, suppresses autophagy, and promotes cellular senescence
- **Inhibition extends lifespan**: Rapamycin has extended lifespan in yeast, worms, flies, and mice — the most replicated result in aging research
- **ITP results**: The NIA Interventions Testing Program showed rapamycin extends mouse lifespan by 9-14% even when started late in life

### Mechanism
mTOR exists in two complexes:
- **mTORC1**: Promotes anabolism, inhibits autophagy (target of rapamycin)
- **mTORC2**: Regulates cytoskeleton and metabolism (chronic rapamycin may inhibit this too)

### Clinical Considerations
- Intermittent dosing may provide longevity benefits while minimizing immunosuppression
- The PEARL trial and other human studies are exploring low-dose rapamycin for aging
- Biomarker effects: decreased p70S6K phosphorylation, increased autophagy markers

**Key reference:** Mannick JB, et al. *mTOR inhibition improves immune function in the elderly.* Sci Transl Med. 2014;6(268):268ra179.`,
    },
    {
      slug: "nad-boosting-strategies",
      topic: "COMPOUNDS" as const,
      title: "NAD+ Boosting: NMN, NR, and the Sirtuin Connection",
      summary: "The science behind NAD+ decline with age and whether supplementation with NMN or NR can restore cellular function.",
      body: `## NAD+ and Aging

Nicotinamide adenine dinucleotide (NAD+) is a critical coenzyme present in every cell, essential for energy metabolism and hundreds of enzymatic reactions.

### The NAD+ Decline
- NAD+ levels drop approximately 50% between ages 40 and 60
- This decline impairs sirtuin activity, DNA repair (PARP), and mitochondrial function
- CD38, an NAD+-consuming enzyme, increases with age-related inflammation

### Boosting Strategies
**NMN (Nicotinamide Mononucleotide)**
- Direct NAD+ precursor: NMN → NAD+ (via NMNAT enzymes)
- Human trials show increased blood NAD+ levels and improved muscle insulin sensitivity
- Typical research doses: 250-1000mg/day

**NR (Nicotinamide Riboside)**
- Converted to NMN then NAD+: NR → NMN → NAD+
- NIAGEN trials showed safe elevation of NAD+ in humans
- May have different tissue distribution than NMN

### What the Evidence Shows
- Both NMN and NR reliably raise blood NAD+ levels in humans
- Functional benefits in humans are still being established
- Mouse studies show improved vascular function, muscle performance, and neuroprotection
- The METRO trial is testing NMN in middle-aged adults

### Biomarker Tracking
Monitor these if supplementing: NAD+ blood levels, triglycerides, fasting glucose, grip strength, VO2max

**Key reference:** Yoshino J, et al. *NAD+ intermediates: The biology and therapeutic potential.* Cell Metab. 2018;27(3):513-528.`,
    },
    {
      slug: "senolytic-strategies",
      topic: "COMPOUNDS" as const,
      title: "Senolytics: Clearing Zombie Cells",
      summary: "How senolytic compounds like Dasatinib+Quercetin and Fisetin selectively eliminate senescent cells to improve healthspan.",
      body: `## Senolytics: Targeting Cellular Senescence

Senescent cells are "zombie cells" — they stop dividing but resist death, accumulating with age and secreting inflammatory factors (SASP) that damage surrounding tissue.

### The SASP Problem
The senescence-associated secretory phenotype includes:
- Inflammatory cytokines (IL-6, IL-8, TNF-α)
- Matrix metalloproteinases that degrade tissue
- Growth factors that can promote cancer

### Key Senolytic Compounds

**Dasatinib + Quercetin (D+Q)**
- The most studied senolytic combination
- Dasatinib (tyrosine kinase inhibitor) targets senescent preadipocytes
- Quercetin (flavonoid) targets senescent endothelial cells
- Human trial: Improved walking speed in idiopathic pulmonary fibrosis patients
- Intermittent dosing (e.g., 3 days/month) may be sufficient

**Fisetin**
- Natural flavonoid found in strawberries
- Showed senolytic activity in mice, extending healthspan
- The AFFIRM trial is testing fisetin in elderly adults
- Better tolerated than D+Q, but evidence is earlier-stage

### Protocol Considerations
- Senolytics are typically used intermittently (hit-and-run approach)
- Timing matters: clearing senescent cells after they accumulate, not continuously
- Monitor inflammatory markers (CRP, IL-6) as response biomarkers
- Not yet FDA-approved for aging; available as research or off-label use

**Key reference:** Xu M, et al. *Senolytics improve physical function and increase lifespan in old age.* Nat Med. 2018;24(8):1246-1256.`,
    },
    {
      slug: "epigenetic-clocks-guide",
      topic: "BIOMARKERS" as const,
      title: "Epigenetic Clocks: Measuring Your Biological Age",
      summary: "How DNA methylation-based clocks work, which ones to use, and what they can tell you about your rate of aging.",
      body: `## Epigenetic Clocks

Epigenetic clocks use DNA methylation patterns at specific CpG sites to estimate biological age — a measure that can differ significantly from chronological age.

### Major Clocks
**First Generation (age estimators)**
- **Horvath Clock (2013)**: Multi-tissue clock using 353 CpG sites. The original biological age estimator
- **Hannum Clock (2013)**: Blood-based, 71 CpG sites

**Second Generation (mortality predictors)**
- **PhenoAge / Levine Clock (2018)**: Trained on mortality and clinical biomarkers. Better at predicting healthspan
- **GrimAge (2019)**: Incorporates smoking history and plasma protein surrogates. Strongest mortality predictor

**Third Generation (pace of aging)**
- **DunedinPACE (2022)**: Measures the *rate* of aging rather than total biological age. Developed from longitudinal data on 1,000 people tracked from birth

### How to Use Them
1. **Get tested**: Services like TruDiagnostic, Elysium Index, or myDNAge provide epigenetic age testing from blood samples
2. **Benchmark**: Compare biological age to chronological age. <0 means you're aging slower
3. **Track interventions**: Re-test after 6-12 months of lifestyle or supplement changes
4. **Use DunedinPACE for pace**: It's the most sensitive to short-term intervention effects

### What Moves the Clocks
Evidence-backed interventions that have shown epigenetic age reduction:
- Caloric restriction / time-restricted eating
- Exercise (especially combination of aerobic + resistance)
- Improved sleep quality
- Stress reduction (meditation showed results in TRIM study)
- Some supplements (alpha-ketoglutarate showed age reduction in TruAge pilot)

**Key reference:** Belsky DW, et al. *DunedinPACE, a DNA methylation biomarker of the pace of aging.* eLife. 2022;11:e73420.`,
    },
    {
      slug: "longevity-biomarker-panel",
      topic: "BIOMARKERS" as const,
      title: "The Essential Longevity Biomarker Panel",
      summary: "Which blood tests and functional markers to track for optimizing healthspan, with target ranges backed by research.",
      body: `## Essential Longevity Biomarkers

Tracking the right biomarkers gives you objective feedback on your aging trajectory. Here's what the science supports.

### Blood Biomarkers

**Metabolic**
- Fasting glucose: Target <90 mg/dL (longevity-associated range)
- HbA1c: Target <5.3% (lower within normal range associated with better outcomes)
- Fasting insulin: Target <5 μIU/mL (marker of insulin sensitivity)
- HOMA-IR: Target <1.0 (calculated insulin resistance index)
- Triglycerides: Target <70 mg/dL

**Inflammatory**
- hs-CRP: Target <0.5 mg/L (chronic inflammation is a hallmark of aging)
- IL-6: Lower is better (major SASP cytokine)
- Homocysteine: Target <7 μmol/L (cardiovascular and cognitive risk)

**Hormonal**
- IGF-1: Moderate range (neither too high nor too low)
- DHEA-S: Track for age-related decline
- Free testosterone / estradiol: Maintain healthy range for sex

**Organ Function**
- Cystatin C: More accurate kidney function than creatinine, independent mortality predictor
- ALT: Target <20 U/L (liver health, lower is better within range)
- ApoB: Target <60 mg/dL (cardiovascular risk; more accurate than LDL-C)

### Functional Biomarkers
- **Grip strength**: Strongest single predictor of all-cause mortality in elderly
- **VO2max**: Each 1 MET increase = 12% reduction in mortality
- **Walking speed**: >1.0 m/s associated with above-average survival
- **Sit-to-stand test**: 5 reps in <12 seconds indicates good lower body strength

### Epigenetic
- **Biological age** (Horvath, GrimAge): Total aging assessment
- **DunedinPACE**: Rate of aging assessment

### Testing Frequency
- Blood panel: Every 6 months
- Functional tests: Monthly self-assessment
- Epigenetic clock: Annually

**Key reference:** Attia P. *Outlive: The Science and Art of Longevity.* Harmony Books. 2023.`,
    },
  ]

  let articleCount = 0
  for (const art of articles) {
    const existing = await prisma.learnArticle.findUnique({ where: { slug: art.slug } })
    if (!existing) {
      await prisma.learnArticle.create({
        data: {
          authorId: systemAuthor.id,
          ...art,
          published: true,
          reviewed: true,
          publishedAt: new Date(),
        },
      })
      articleCount++
    }
  }

  console.log(`Seeded ${articleCount} learning articles`)

  // ─── Lab Test Panels ─────────────────────────────────

  const labPanels = [
    {
      name: "Longevity Essentials Panel",
      category: "longevity",
      description: "Core aging biomarkers: telomere length, inflammatory markers, metabolic health.",
      biomarkers: JSON.stringify(["Telomere Length", "hs-CRP", "HbA1c", "Fasting Insulin", "IGF-1", "Homocysteine"]),
      priceCents: 29900,
      turnaroundDays: 7,
    },
    {
      name: "NAD+ & Sirtuin Panel",
      category: "longevity",
      description: "NAD+ levels and downstream sirtuin pathway markers.",
      biomarkers: JSON.stringify(["NAD+", "NADH", "CD38", "PARP Activity", "Sirtuin-1 Activity"]),
      priceCents: 34900,
      turnaroundDays: 10,
    },
    {
      name: "Comprehensive Metabolic Panel",
      category: "metabolic",
      description: "Fasting glucose, lipids, liver enzymes, kidney function.",
      biomarkers: JSON.stringify(["Glucose", "HbA1c", "Total Cholesterol", "LDL", "HDL", "Triglycerides", "ALT", "AST", "BUN", "Creatinine", "eGFR"]),
      priceCents: 14900,
      turnaroundDays: 3,
    },
    {
      name: "Hormonal Optimization Panel",
      category: "hormonal",
      description: "Full hormone panel for aging-related hormonal shifts.",
      biomarkers: JSON.stringify(["Total Testosterone", "Free Testosterone", "Estradiol", "DHEA-S", "Cortisol", "Thyroid (TSH)", "Free T3", "Free T4", "SHBG"]),
      priceCents: 24900,
      turnaroundDays: 5,
    },
    {
      name: "Inflammatory & Immune Panel",
      category: "inflammatory",
      description: "Chronic inflammation and immune system markers.",
      biomarkers: JSON.stringify(["hs-CRP", "IL-6", "TNF-α", "Ferritin", "D-Dimer", "WBC", "Neutrophil/Lymphocyte Ratio"]),
      priceCents: 19900,
      turnaroundDays: 5,
    },
    {
      name: "Epigenetic Age Panel",
      category: "longevity",
      description: "DNA methylation-based biological age estimation with Horvath, Hannum, and GrimAge clocks.",
      biomarkers: JSON.stringify(["Horvath Clock Age", "Hannum Clock Age", "GrimAge", "PhenoAge", "DunedinPACE"]),
      priceCents: 49900,
      turnaroundDays: 21,
    },
  ]

  let panelCount = 0
  for (const panel of labPanels) {
    const existing = await prisma.labTestPanel.findUnique({ where: { name: panel.name } })
    if (!existing) {
      await prisma.labTestPanel.create({ data: panel })
      panelCount++
    }
  }

  console.log(`Seeded ${panelCount} lab test panels`)

  // ─── Telemedicine Providers ──────────────────────────
  const telehealthProviders = [
    {
      name: "Dr. Sarah Chen",
      credentials: "MD, Board Certified Internal Medicine, Fellowship in Longevity Medicine",
      specialty: "longevity medicine",
      bio: "15+ years in preventive and longevity medicine. Specializes in biomarker optimization, hormone therapy, and evidence-based anti-aging protocols.",
      licenseStates: JSON.stringify(["CA", "NY", "TX", "FL", "WA"]),
      acceptingNew: true,
    },
    {
      name: "Dr. Michael Torres",
      credentials: "DO, Board Certified Endocrinology, Certified Functional Medicine",
      specialty: "endocrinology",
      bio: "Expert in hormonal optimization, metabolic health, and age-related endocrine changes. Research focus on NAD+ and sirtuin pathways.",
      licenseStates: JSON.stringify(["NY", "NJ", "CT", "PA", "MA"]),
      acceptingNew: true,
    },
    {
      name: "Dr. Priya Patel",
      credentials: "MD, PhD Molecular Biology, Board Certified Geriatrics",
      specialty: "geriatrics & epigenetics",
      bio: "Dual background in clinical geriatrics and molecular aging research. Specializes in epigenetic age interventions and senolytic protocols.",
      licenseStates: JSON.stringify(["CA", "OR", "NV", "AZ", "CO"]),
      acceptingNew: true,
    },
    {
      name: "Dr. James Wright",
      credentials: "MD, Board Certified Sports Medicine, Certified in Regenerative Medicine",
      specialty: "sports & regenerative medicine",
      bio: "Focuses on physical performance optimization, peptide therapies, and exercise-based longevity interventions.",
      licenseStates: JSON.stringify(["TX", "FL", "GA", "NC", "TN"]),
      acceptingNew: false,
    },
  ]

  let providerCount = 0
  for (const provider of telehealthProviders) {
    const existing = await prisma.telehealthProvider.findFirst({ where: { name: provider.name } })
    if (!existing) {
      await prisma.telehealthProvider.create({ data: provider })
      providerCount++
    }
  }
  console.log(`Seeded ${providerCount} telehealth providers`)

  // ─── Marketplace Products ────────────────────────────
  const products = [
    {
      name: "NMN 500mg",
      slug: "nmn-500mg",
      category: "SUPPLEMENT" as const,
      description: "Pharmaceutical-grade Nicotinamide Mononucleotide. Third-party tested for purity >99%. Supports NAD+ biosynthesis.",
      ingredients: JSON.stringify(["Nicotinamide Mononucleotide (NMN) 500mg", "Vegetable cellulose capsule"]),
      priceCents: 5999,
      thirdPartyTested: true,
    },
    {
      name: "Trans-Resveratrol 500mg",
      slug: "trans-resveratrol-500mg",
      category: "SUPPLEMENT" as const,
      description: "High-purity trans-resveratrol sourced from Japanese knotweed. Sirtuin activator with documented bioavailability.",
      ingredients: JSON.stringify(["Trans-Resveratrol 500mg", "BioPerine 5mg", "HPMC capsule"]),
      priceCents: 3499,
      thirdPartyTested: true,
    },
    {
      name: "Spermidine Complex",
      slug: "spermidine-complex",
      category: "SUPPLEMENT" as const,
      description: "Wheat germ-derived spermidine standardized to 1mg per capsule. Supports autophagy and cellular renewal.",
      ingredients: JSON.stringify(["Wheat Germ Extract (1mg spermidine)", "Rice flour", "Vegetable capsule"]),
      priceCents: 4499,
      thirdPartyTested: true,
    },
    {
      name: "Longevity Essentials At-Home Test Kit",
      slug: "longevity-essentials-test-kit",
      category: "TEST_KIT" as const,
      description: "Finger-prick collection kit for Longevity Essentials panel. Includes prepaid return shipping and digital results.",
      ingredients: JSON.stringify([]),
      priceCents: 14900,
      thirdPartyTested: false,
    },
    {
      name: "Fisetin 500mg",
      slug: "fisetin-500mg",
      category: "SUPPLEMENT" as const,
      description: "High-dose fisetin with documented senolytic properties. Liposomal delivery for enhanced absorption.",
      ingredients: JSON.stringify(["Fisetin 500mg (liposomal)", "Sunflower lecithin", "Vegetable capsule"]),
      priceCents: 3999,
      thirdPartyTested: true,
    },
    {
      name: "Comprehensive Biomarker Bundle",
      slug: "comprehensive-biomarker-bundle",
      category: "BUNDLE" as const,
      description: "Bundled lab panels: Longevity Essentials + NAD+/Sirtuin + Hormonal Optimization. Save 15% vs individual orders.",
      ingredients: JSON.stringify([]),
      priceCents: 42900,
      thirdPartyTested: false,
    },
  ]

  let productCount = 0
  for (const product of products) {
    const existing = await prisma.product.findFirst({ where: { slug: product.slug } })
    if (!existing) {
      await prisma.product.create({ data: product })
      productCount++
    }
  }
  console.log(`Seeded ${productCount} marketplace products`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
