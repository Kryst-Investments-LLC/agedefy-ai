from __future__ import annotations

import os
from typing import Optional

from rdkit import Chem, rdBase
from rdkit.Chem import Descriptors, QED, rdMolDescriptors
from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams

from .schemas import (
    AdmetFlag,
    AdmetFlags,
    FilterResult,
    Filters,
    ScreenDescriptors,
    ScreenResult,
)

rdBase.DisableLog("rdApp.error")

SCREENING_VERSION = os.environ.get("SCREENING_VERSION", "1.0.0")
MODEL_VERSION = f"screening-sidecar@{SCREENING_VERSION}"

# ── SA scorer (Ertl & Schuffenhauer via RDKit Contrib) ───────────────────────
try:
    from rdkit.Contrib.SA_Score import sascorer as _sascorer  # type: ignore[import]
    _HAS_SA_SCORER = True
except ImportError:
    _HAS_SA_SCORER = False

# ── InChI support ─────────────────────────────────────────────────────────────
try:
    from rdkit.Chem.inchi import MolToInchi, InchiToInchiKey  # type: ignore[import]
    _HAS_INCHI = True
except ImportError:
    _HAS_INCHI = False

# ── PAINS filter catalog (built once at import time) ─────────────────────────
_pains_params = FilterCatalogParams()
_pains_params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
_PAINS_CATALOG = FilterCatalog(_pains_params)

# ── hERG liability: basic nitrogen SMARTS (non-amide, non-aromatic N) ─────────
_BASIC_N_SMARTS = Chem.MolFromSmarts("[N;!$(N-C=O);!$(N-S(=O));!n]")


def screen_smiles(smiles: str, include_pains: bool = False) -> ScreenResult:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return ScreenResult(
            smiles=smiles,
            valid=False,
            sanitization_error="RDKit could not parse this SMILES string",
            model_version=MODEL_VERSION,
        )

    canonical_smiles = Chem.MolToSmiles(mol, isomericSmiles=True)

    inchi: Optional[str] = None
    inchi_key: Optional[str] = None
    if _HAS_INCHI:
        try:
            inchi = MolToInchi(mol)  # type: ignore[call-arg]
            inchi_key = InchiToInchiKey(inchi) if inchi else None  # type: ignore[call-arg]
        except Exception:
            pass

    descriptors = _compute_descriptors(mol)
    filters = _compute_filters(mol, descriptors, include_pains)
    admet_flags = _compute_admet_flags(mol, descriptors)

    return ScreenResult(
        smiles=smiles,
        canonical_smiles=canonical_smiles,
        inchi=inchi,
        inchi_key=inchi_key,
        valid=True,
        sanitization_error=None,
        descriptors=descriptors,
        filters=filters,
        admet_flags=admet_flags,
        model_version=MODEL_VERSION,
    )


def _compute_descriptors(mol) -> ScreenDescriptors:
    sa_score: Optional[float] = None
    if _HAS_SA_SCORER:
        try:
            sa_score = round(_sascorer.calculateScore(mol), 2)  # type: ignore[union-attr]
        except Exception:
            pass

    return ScreenDescriptors(
        molecular_weight=round(Descriptors.MolWt(mol), 3),
        exact_molecular_weight=round(Descriptors.ExactMolWt(mol), 4),
        mol_log_p=round(Descriptors.MolLogP(mol), 3),
        hbd=rdMolDescriptors.CalcNumHBD(mol),
        hba=rdMolDescriptors.CalcNumHBA(mol),
        tpsa=round(rdMolDescriptors.CalcTPSA(mol), 2),
        rotatable_bonds=rdMolDescriptors.CalcNumRotatableBonds(mol),
        aromatic_rings=rdMolDescriptors.CalcNumAromaticRings(mol),
        rings=rdMolDescriptors.CalcNumRings(mol),
        heavy_atom_count=mol.GetNumHeavyAtoms(),
        stereocenters=rdMolDescriptors.CalcNumAtomStereoCenters(mol),
        frac_csp3=round(rdMolDescriptors.CalcFractionCSP3(mol), 3),
        qed=round(QED.qed(mol), 4),
        sa_score=sa_score,
    )


def _compute_filters(mol, d: ScreenDescriptors, include_pains: bool) -> Filters:
    # Lipinski Rule of Five
    li_mw = d.molecular_weight <= 500
    li_logp = d.mol_log_p <= 5
    li_hbd = d.hbd <= 5
    li_hba = d.hba <= 10
    li_violations = sum([not li_mw, not li_logp, not li_hbd, not li_hba])
    lipinski = FilterResult(
        pass_filter=li_violations <= 1,
        details={"mw_ok": li_mw, "logp_ok": li_logp, "hbd_ok": li_hbd, "hba_ok": li_hba},
        violations=li_violations,
    )

    # Veber oral-bioavailability rules
    veb_rot = d.rotatable_bonds <= 10
    veb_tpsa = d.tpsa <= 140
    veber = FilterResult(
        pass_filter=veb_rot and veb_tpsa,
        details={"rotatable_bonds_ok": veb_rot, "tpsa_ok": veb_tpsa},
    )

    # Ghose filter
    mr = round(Descriptors.MolMR(mol), 2)
    gh_mw = 160 <= d.molecular_weight <= 480
    gh_logp = -0.4 <= d.mol_log_p <= 5.6
    gh_mr = 40 <= mr <= 130
    gh_atoms = 20 <= d.heavy_atom_count <= 70
    ghose = FilterResult(
        pass_filter=gh_mw and gh_logp and gh_mr and gh_atoms,
        details={
            "mw_ok": gh_mw,
            "logp_ok": gh_logp,
            "molar_refractivity_ok": gh_mr,
            "atom_count_ok": gh_atoms,
        },
    )

    # Lead-like (fragment-to-lead optimisation space)
    ll_mw = d.molecular_weight <= 350
    ll_logp = d.mol_log_p <= 3.5
    ll_hbd = d.hbd <= 3
    ll_hba = d.hba <= 7
    lead_like = FilterResult(
        pass_filter=ll_mw and ll_logp and ll_hbd and ll_hba,
        details={"mw_ok": ll_mw, "logp_ok": ll_logp, "hbd_ok": ll_hbd, "hba_ok": ll_hba},
    )

    # PAINS (opt-in; skipped by default because it adds ~5 ms/mol)
    pains_alerts: list[str] = []
    if include_pains:
        entries = _PAINS_CATALOG.GetMatches(mol)
        pains_alerts = [e.GetDescription() for e in entries]
    pains = FilterResult(
        pass_filter=len(pains_alerts) == 0,
        details={},
        alerts=pains_alerts,
        checked=include_pains,
    )

    return Filters(
        lipinski=lipinski,
        veber=veber,
        ghose=ghose,
        lead_like=lead_like,
        pains=pains,
    )


def _compute_admet_flags(mol, d: ScreenDescriptors) -> AdmetFlags:
    # BBB penetrant proxy — simplified Egan model
    bbb_likely = d.tpsa <= 90 and d.molecular_weight <= 400
    bbb = AdmetFlag(
        likely=bbb_likely,
        basis="TPSA≤90 Å² and MW≤400",
    )

    # Oral absorption risk
    li_viol = sum([d.molecular_weight > 500, d.mol_log_p > 5, d.hbd > 5, d.hba > 10])
    oral_flag = d.tpsa > 130 or li_viol >= 2
    oral = AdmetFlag(
        flag=oral_flag,
        basis="TPSA>130 Å² or ≥2 Lipinski violations",
    )

    # P-gp substrate risk
    pgp_flag = d.molecular_weight > 400 and d.tpsa > 100
    pgp = AdmetFlag(
        flag=pgp_flag,
        basis="MW>400 and TPSA>100",
    )

    # hERG liability risk: basic nitrogen + LogP > 3.5 + MW > 250
    has_basic_n = (
        mol.HasSubstructMatch(_BASIC_N_SMARTS)
        if _BASIC_N_SMARTS is not None
        else False
    )
    herg_flag = has_basic_n and d.mol_log_p > 3.5 and d.molecular_weight > 250
    herg = AdmetFlag(
        flag=herg_flag,
        basis="Basic-N + LogP>3.5 + MW>250" if herg_flag else "No basic-N+LogP>3.5 pattern",
    )

    return AdmetFlags(
        bbb_penetrant=bbb,
        oral_absorption_risk=oral,
        pgp_substrate_risk=pgp,
        herg_liability_risk=herg,
    )
