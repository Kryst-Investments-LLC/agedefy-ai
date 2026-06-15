"""
MM-GBSA binding energy computation.

Both functions operate on pre-collected energy floats — no OpenMM import —
so they can be unit-tested independently of the simulation layer.
"""
from __future__ import annotations

import numpy as np

_KJ_PER_KCAL = 4.184


def compute_single_frame_mmgbsa(
    complex_energy_kj: float,
    protein_energy_kj: float,
    ligand_energy_kj: float,
) -> float:
    """
    Single-point MM-GBSA: ΔG ≈ E_complex − E_protein − E_ligand.
    Inputs are kJ/mol; return value is kcal/mol.

    This is a rough estimate (no entropy term, no solute reorganisation
    energy correction).  Use ``compute_trajectory_mmgbsa`` over MD frames
    for a more reliable estimate.
    """
    delta_kj = complex_energy_kj - protein_energy_kj - ligand_energy_kj
    return delta_kj / _KJ_PER_KCAL


def compute_trajectory_mmgbsa(
    complex_energies_kj: list[float],
    protein_energies_kj: list[float],
    ligand_energies_kj: list[float],
) -> tuple[float, float]:
    """
    Multi-frame MM-GBSA: mean and std-dev of ΔG across production frames.
    All inputs are kJ/mol; return values are kcal/mol.
    """
    c = np.asarray(complex_energies_kj, dtype=float)
    p = np.asarray(protein_energies_kj, dtype=float)
    lg = np.asarray(ligand_energies_kj, dtype=float)
    deltas_kcal = (c - p - lg) / _KJ_PER_KCAL
    return float(np.mean(deltas_kcal)), float(np.std(deltas_kcal))
