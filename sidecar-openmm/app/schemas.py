from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class ForceFieldConfig(BaseModel):
    protein: Literal["amber14-all", "charmm36m"] = "amber14-all"
    small_molecule: Literal["openff-2.0.0", "openff-1.3.1", "mmff94"] = "openff-2.0.0"
    water: Literal["tip3p", "tip3pfb"] = "tip3p"


class SimulationConfig(BaseModel):
    minimization_steps: int = Field(default=5000, ge=100, le=100_000)
    equilibration_ps: float = Field(default=100.0, ge=0.0, le=1000.0)
    production_ps: float = Field(default=500.0, ge=0.0, le=2000.0)
    temperature_K: float = Field(default=300.0, ge=200.0, le=400.0)
    pressure_bar: float = Field(default=1.0, ge=0.5, le=2.0)


class MdRankingWeights(BaseModel):
    mmgbsa: float = Field(default=0.65, ge=0.0, le=1.0)
    rmsd_penalty: float = Field(default=0.35, ge=0.0, le=1.0)


class RefineRequest(BaseModel):
    smiles: str = Field(min_length=1, max_length=4000)
    receptor: str = Field(
        min_length=10,
        max_length=5_000_000,
        description="Base64-encoded PDB (preferred) or PDBQT receptor",
    )
    receptor_format: Literal["pdb", "pdbqt"] = "pdb"
    docked_pose_pdbqt: str = Field(
        min_length=10,
        max_length=500_000,
        description="Base64-encoded PDBQT pose from /v1/dock",
    )
    force_field: ForceFieldConfig = Field(default_factory=ForceFieldConfig)
    simulation: SimulationConfig = Field(default_factory=SimulationConfig)
    refine_mode: Literal["minimize", "md"] = "minimize"
    compute_mmgbsa: bool = True
    ranking_weights: MdRankingWeights = Field(default_factory=MdRankingWeights)


class RefineResult(BaseModel):
    smiles: str
    refine_mode: str
    force_field_used: ForceFieldConfig
    receptor_format_received: str
    receptor_conversion_warning: Optional[str] = None
    initial_potential_energy_kj_mol: float
    minimized_potential_energy_kj_mol: float
    pose_rmsd_angstrom: Optional[float] = None
    mmgbsa_binding_energy_kcal_mol: Optional[float] = None
    mmgbsa_std_kcal_mol: Optional[float] = None
    convergence_flag: bool
    n_trajectory_frames: int
    refined_complex_pdb: str
    md_ranking_score: Optional[float] = None
    weights_used: MdRankingWeights
    mmgbsa_accuracy_note: Optional[str] = None
    model_version: str
