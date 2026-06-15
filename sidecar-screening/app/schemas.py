from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ScreenRequest(BaseModel):
    smiles: str = Field(min_length=1, max_length=4000)
    include_pains: bool = False


class BatchScreenRequest(BaseModel):
    smiles_list: list[str] = Field(min_length=1, max_length=50)
    include_pains: bool = False


class ScreenDescriptors(BaseModel):
    molecular_weight: float
    exact_molecular_weight: float
    mol_log_p: float
    hbd: int
    hba: int
    tpsa: float
    rotatable_bonds: int
    aromatic_rings: int
    rings: int
    heavy_atom_count: int
    stereocenters: int
    frac_csp3: float
    qed: float
    sa_score: Optional[float] = None


class FilterResult(BaseModel):
    # `pass` is a Python keyword; use serialization_alias so the JSON key is "pass"
    model_config = ConfigDict(populate_by_name=True)

    pass_filter: bool = Field(serialization_alias="pass")
    details: dict[str, bool]
    violations: Optional[int] = None
    alerts: Optional[list[str]] = None
    checked: Optional[bool] = None


class Filters(BaseModel):
    lipinski: FilterResult
    veber: FilterResult
    ghose: FilterResult
    lead_like: FilterResult
    pains: FilterResult


class AdmetFlag(BaseModel):
    likely: Optional[bool] = None
    flag: Optional[bool] = None
    basis: str


class AdmetFlags(BaseModel):
    bbb_penetrant: AdmetFlag
    oral_absorption_risk: AdmetFlag
    pgp_substrate_risk: AdmetFlag
    herg_liability_risk: AdmetFlag


class ScreenResult(BaseModel):
    smiles: str
    canonical_smiles: Optional[str] = None
    inchi: Optional[str] = None
    inchi_key: Optional[str] = None
    valid: bool
    sanitization_error: Optional[str] = None
    descriptors: Optional[ScreenDescriptors] = None
    filters: Optional[Filters] = None
    admet_flags: Optional[AdmetFlags] = None
    model_version: str


class BatchScreenResult(BaseModel):
    results: list[ScreenResult]
