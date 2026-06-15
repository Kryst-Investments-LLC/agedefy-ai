"""
MD ranking score helpers.

All functions are pure math — no OpenMM dependency — testable without
the full simulation stack.
"""
from __future__ import annotations

from typing import Optional

from .schemas import MdRankingWeights


def normalize_mmgbsa(energy_kcal_mol: float) -> float:
    """
    Map MM-GBSA binding energy (kcal/mol) → [0, 1].

    Calibration range: -3 kcal/mol (weak) → 0.0, -20 kcal/mol (strong) → 1.0.
    Values outside this range are clamped.
    """
    return max(0.0, min(1.0, (-energy_kcal_mol - 3.0) / 17.0))


def rmsd_to_stability(rmsd_angstrom: float) -> float:
    """
    Map ligand pose RMSD (Å) → stability score [0, 1].

    0 Å → 1.0 (pose unchanged, fully stable)
    ≥5 Å → 0.0 (pose collapsed / binding mode changed)
    """
    return max(0.0, 1.0 - min(1.0, rmsd_angstrom / 5.0))


def compute_md_ranking_score(
    mmgbsa_kcal_mol: Optional[float],
    pose_rmsd_angstrom: Optional[float],
    weights: MdRankingWeights,
) -> Optional[float]:
    """
    Weighted combination of normalised MM-GBSA and RMSD stability.

    Returns None when both inputs are None (no data available).
    The result is on a [0, 1] scale; higher is better.
    """
    if mmgbsa_kcal_mol is None and pose_rmsd_angstrom is None:
        return None

    mmgbsa_factor = normalize_mmgbsa(mmgbsa_kcal_mol) if mmgbsa_kcal_mol is not None else 0.0
    rmsd_factor = rmsd_to_stability(pose_rmsd_angstrom) if pose_rmsd_angstrom is not None else 0.0

    return round(weights.mmgbsa * mmgbsa_factor + weights.rmsd_penalty * rmsd_factor, 4)
