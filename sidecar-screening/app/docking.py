from __future__ import annotations

import base64
import os
import tempfile
from typing import Optional

from rdkit import Chem
from rdkit.Chem import AllChem

from .docking_schemas import DockRequest, DockResult
from .screening import MODEL_VERSION

# Import Vina at module level so tests can patch `app.docking.Vina`
try:
    from vina import Vina  # type: ignore[import]
    _HAS_VINA = True
except ImportError:
    Vina = None  # type: ignore[assignment,misc]
    _HAS_VINA = False

# Import Meeko at module level for the same reason
try:
    from meeko import MoleculePreparation, PDBQTWriterLegacy  # type: ignore[import]
    _HAS_MEEKO = True
except ImportError:
    MoleculePreparation = None  # type: ignore[assignment,misc]
    PDBQTWriterLegacy = None  # type: ignore[assignment,misc]
    _HAS_MEEKO = False


def prepare_ligand_pdbqt(smiles: str) -> tuple[str, Optional[str]]:
    """
    Convert a SMILES string to a PDBQT-formatted string via:
      RDKit 3D embed (ETKDGv3) → MMFF94 optimisation → Meeko PDBQT writer.

    Returns (pdbqt_string, error_message).  error_message is None on success.
    """
    if not _HAS_MEEKO:
        return "", "Meeko is not installed; ligand preparation unavailable"

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return "", f"RDKit could not parse SMILES: {smiles!r}"

    mol = Chem.AddHs(mol)
    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    if AllChem.EmbedMolecule(mol, params) == -1:
        return "", "Could not generate a 3D conformer for this SMILES"

    AllChem.MMFFOptimizeMolecule(mol)

    preparator = MoleculePreparation()
    mol_setups = preparator.prepare(mol)
    pdbqt_string, is_ok, error_msg = PDBQTWriterLegacy.write_string(mol_setups[0])
    if not is_ok:
        return "", f"Meeko PDBQT preparation failed: {error_msg}"

    return pdbqt_string, None


def run_docking(req: DockRequest) -> DockResult:
    """
    Prepare the ligand from SMILES, decode the receptor PDBQT, configure
    the search box, run AutoDock Vina, and return scores + best pose.
    """
    if not _HAS_VINA:
        raise RuntimeError("AutoDock Vina is not installed")

    # --- Decode receptor ---
    try:
        receptor_bytes = base64.b64decode(req.receptor_pdbqt)
    except Exception as exc:
        raise ValueError(f"receptor_pdbqt is not valid base64: {exc}") from exc

    # --- Prepare ligand ---
    ligand_pdbqt, err = prepare_ligand_pdbqt(req.smiles)
    if err:
        raise ValueError(err)

    # --- Write temp files ---
    receptor_path: str = ""
    ligand_path: str = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdbqt", mode="wb", delete=False) as rf:
            rf.write(receptor_bytes)
            receptor_path = rf.name

        with tempfile.NamedTemporaryFile(suffix=".pdbqt", mode="w", delete=False) as lf:
            lf.write(ligand_pdbqt)
            ligand_path = lf.name

        # --- Run Vina ---
        v = Vina(sf_name="vina", verbosity=0)
        v.set_receptor(receptor_path)
        v.set_ligand_from_file(ligand_path)
        v.compute_vina_maps(
            center=[req.box.center.x, req.box.center.y, req.box.center.z],
            box_size=[req.box.size.x, req.box.size.y, req.box.size.z],
        )
        v.dock(exhaustiveness=req.exhaustiveness, n_poses=req.n_poses)

        energies = v.energies(n_poses=req.n_poses)
        if energies is None or len(energies) == 0:
            raise RuntimeError("AutoDock Vina returned no docking poses")

        # energies shape: (n_actual_poses, n_energy_terms); col 0 = total score
        all_scores = [round(float(row[0]), 3) for row in energies]
        best_pose_pdbqt = v.poses(n_poses=1)

    finally:
        for path in (receptor_path, ligand_path):
            if path and os.path.exists(path):
                os.unlink(path)

    return DockResult(
        ligand_smiles=req.smiles,
        binding_affinity_kcal_mol=all_scores[0],
        pose_scores_kcal_mol=all_scores,
        best_pose_pdbqt=best_pose_pdbqt,
        n_poses_returned=len(all_scores),
        exhaustiveness=req.exhaustiveness,
        model_version=MODEL_VERSION,
    )
