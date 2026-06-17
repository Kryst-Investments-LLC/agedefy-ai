/**
 * Typed vocabulary constants derived from metadata/compounds.yml,
 * metadata/pathways.yml, and metadata/biomarkers.yml.
 *
 * Kept as TypeScript instead of parsed YAML so there is no runtime
 * dependency on a YAML parser. Update here when the source YAML changes.
 */

export interface VocabCompound {
  id: string
  name: string
  aliases: string[]
  category: string
  pathways: string[]
  prescriptionOnly: boolean
}

export interface VocabPathway {
  id: string
  name: string
  hallmark: string
}

export interface VocabBiomarker {
  id: string
  name: string
  unit: string
  pathway: string
  modality?: string
}

export const COMPOUNDS: VocabCompound[] = [
  { id: 'nmn', name: 'Nicotinamide Mononucleotide', aliases: ['NMN'], category: 'NAD_precursor', pathways: ['nad_metabolism', 'sirtuin_activation'], prescriptionOnly: false },
  { id: 'nr', name: 'Nicotinamide Riboside', aliases: ['NR'], category: 'NAD_precursor', pathways: ['nad_metabolism'], prescriptionOnly: false },
  { id: 'rapamycin', name: 'Rapamycin', aliases: ['Sirolimus'], category: 'mtor_inhibitor', pathways: ['mtor', 'autophagy'], prescriptionOnly: true },
  { id: 'metformin', name: 'Metformin', aliases: [], category: 'ampk_activator', pathways: ['ampk', 'glucose_metabolism'], prescriptionOnly: true },
  { id: 'berberine', name: 'Berberine', aliases: [], category: 'ampk_activator', pathways: ['ampk', 'glucose_metabolism'], prescriptionOnly: false },
  { id: 'spermidine', name: 'Spermidine', aliases: [], category: 'autophagy_inducer', pathways: ['autophagy'], prescriptionOnly: false },
  { id: 'resveratrol', name: 'Resveratrol', aliases: [], category: 'sirtuin_activator', pathways: ['sirtuin_activation'], prescriptionOnly: false },
  { id: 'fisetin', name: 'Fisetin', aliases: [], category: 'senolytic', pathways: ['senescence_clearance'], prescriptionOnly: false },
  { id: 'quercetin', name: 'Quercetin', aliases: [], category: 'senolytic', pathways: ['senescence_clearance'], prescriptionOnly: false },
  { id: 'dasatinib', name: 'Dasatinib', aliases: [], category: 'senolytic', pathways: ['senescence_clearance'], prescriptionOnly: true },
  { id: 'glycine', name: 'Glycine', aliases: [], category: 'amino_acid', pathways: ['glutathione_synthesis', 'sleep_quality'], prescriptionOnly: false },
  { id: 'nac', name: 'N-Acetylcysteine', aliases: ['NAC'], category: 'antioxidant', pathways: ['glutathione_synthesis'], prescriptionOnly: false },
  { id: 'omega3', name: 'Omega-3 EPA/DHA', aliases: ['omega-3', 'fish oil', 'EPA', 'DHA'], category: 'lipid', pathways: ['inflammation', 'cardiovascular'], prescriptionOnly: false },
  { id: 'vitamin_d3', name: 'Vitamin D3', aliases: ['vitamin D', 'cholecalciferol'], category: 'vitamin', pathways: ['bone_health', 'immune_modulation'], prescriptionOnly: false },
  { id: 'magnesium_glycinate', name: 'Magnesium Glycinate', aliases: ['magnesium'], category: 'mineral', pathways: ['sleep_quality', 'neuromuscular'], prescriptionOnly: false },
]

export const PATHWAYS: VocabPathway[] = [
  { id: 'nad_metabolism', name: 'NAD+ Metabolism', hallmark: 'mitochondrial_dysfunction' },
  { id: 'sirtuin_activation', name: 'Sirtuin Activation', hallmark: 'epigenetic_alterations' },
  { id: 'mtor', name: 'mTOR Signaling', hallmark: 'deregulated_nutrient_sensing' },
  { id: 'ampk', name: 'AMPK Signaling', hallmark: 'deregulated_nutrient_sensing' },
  { id: 'autophagy', name: 'Autophagy', hallmark: 'loss_of_proteostasis' },
  { id: 'senescence_clearance', name: 'Cellular Senescence Clearance', hallmark: 'cellular_senescence' },
  { id: 'glutathione_synthesis', name: 'Glutathione Synthesis', hallmark: 'oxidative_stress' },
  { id: 'inflammation', name: 'Chronic Inflammation', hallmark: 'chronic_inflammation' },
  { id: 'glucose_metabolism', name: 'Glucose Metabolism', hallmark: 'deregulated_nutrient_sensing' },
  { id: 'cardiovascular', name: 'Cardiovascular Health', hallmark: 'chronic_inflammation' },
  { id: 'sleep_quality', name: 'Sleep Quality', hallmark: 'circadian_disruption' },
  { id: 'bone_health', name: 'Bone Health', hallmark: 'stem_cell_exhaustion' },
  { id: 'immune_modulation', name: 'Immune Modulation', hallmark: 'altered_intercellular_communication' },
  { id: 'neuromuscular', name: 'Neuromuscular Function', hallmark: 'stem_cell_exhaustion' },
]

export const BIOMARKERS: VocabBiomarker[] = [
  { id: 'hba1c', name: 'Hemoglobin A1c', unit: '%', pathway: 'glucose_metabolism' },
  { id: 'fasting_glucose', name: 'Fasting Glucose', unit: 'mg/dL', pathway: 'glucose_metabolism' },
  { id: 'ldl_c', name: 'LDL Cholesterol', unit: 'mg/dL', pathway: 'cardiovascular' },
  { id: 'hdl_c', name: 'HDL Cholesterol', unit: 'mg/dL', pathway: 'cardiovascular' },
  { id: 'apob', name: 'Apolipoprotein B', unit: 'mg/dL', pathway: 'cardiovascular' },
  { id: 'lp_a', name: 'Lipoprotein(a)', unit: 'nmol/L', pathway: 'cardiovascular' },
  { id: 'hs_crp', name: 'hs-CRP', unit: 'mg/L', pathway: 'inflammation' },
  { id: 'homocysteine', name: 'Homocysteine', unit: 'umol/L', pathway: 'inflammation' },
  { id: 'vitamin_d', name: '25-OH Vitamin D', unit: 'ng/mL', pathway: 'immune_modulation' },
  { id: 'ferritin', name: 'Ferritin', unit: 'ng/mL', pathway: 'inflammation' },
  { id: 'vo2_max', name: 'VO2 Max', unit: 'mL/kg/min', pathway: 'cardiovascular' },
  { id: 'grip_strength', name: 'Grip Strength', unit: 'kg', pathway: 'neuromuscular' },
  { id: 'epi_age', name: 'Epigenetic Age (DNAmAge)', unit: 'years', pathway: 'sirtuin_activation' },
  { id: 'dunedin_pace', name: 'DunedinPACE (Pace of Aging)', unit: 'ratio', pathway: 'epigenetic_aging', modality: 'epigenetics' },
  { id: 'telomere_length', name: 'Mean Telomere Length', unit: 'kb', pathway: 'telomere_maintenance', modality: 'epigenetics' },
  { id: 'gdf15', name: 'GDF15 (Growth Differentiation Factor 15)', unit: 'pg/mL', pathway: 'mitochondrial_stress', modality: 'proteomics' },
  { id: 'il6_hs', name: 'IL-6 (high-sensitivity)', unit: 'pg/mL', pathway: 'inflammation', modality: 'proteomics' },
  { id: 'nad_plus', name: 'Whole-blood NAD+', unit: 'umol/L', pathway: 'sirtuin_activation', modality: 'metabolomics' },
]
