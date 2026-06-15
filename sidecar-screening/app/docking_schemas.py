from __future__ import annotations

from pydantic import BaseModel, Field


class BoxCenter(BaseModel):
    x: float
    y: float
    z: float


class BoxSize(BaseModel):
    x: float = Field(gt=0, description="Box dimension along X axis (Å)")
    y: float = Field(gt=0, description="Box dimension along Y axis (Å)")
    z: float = Field(gt=0, description="Box dimension along Z axis (Å)")


class DockingBox(BaseModel):
    center: BoxCenter
    size: BoxSize


class DockRequest(BaseModel):
    smiles: str = Field(min_length=1, max_length=4000)
    receptor_pdbqt: str = Field(
        min_length=10,
        max_length=5_000_000,
        description="Base64-encoded PDBQT of the prepared receptor",
    )
    box: DockingBox
    exhaustiveness: int = Field(default=8, ge=1, le=32)
    n_poses: int = Field(default=5, ge=1, le=20)


class DockResult(BaseModel):
    ligand_smiles: str
    binding_affinity_kcal_mol: float
    pose_scores_kcal_mol: list[float]
    best_pose_pdbqt: str
    n_poses_returned: int
    exhaustiveness: int
    model_version: str
