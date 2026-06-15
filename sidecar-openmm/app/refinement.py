"""
OpenMM molecular-dynamics refinement.

Entry point: ``run_refinement(req)`` → ``RefineResult``.

All OpenMM-related symbols are imported at module level with try/except so
that test code can patch them via ``app.refinement.<Symbol>`` without
import-time errors, and so the sidecar starts (returns 503) even when
optional GPU libraries are absent.
"""
from __future__ import annotations

import base64
import io
import os
from typing import Optional

import numpy as np

from .mmgbsa import compute_single_frame_mmgbsa, compute_trajectory_mmgbsa
from .ranking import compute_md_ranking_score
from .receptor_prep import decode_receptor, fix_receptor_pdb
from .schemas import ForceFieldConfig, MdRankingWeights, RefineRequest, RefineResult

OPENMM_SIDECAR_VERSION = os.environ.get("OPENMM_SIDECAR_VERSION", "1.0.0")
MODEL_VERSION = f"openmm-sidecar@{OPENMM_SIDECAR_VERSION}"

_KJ_PER_KCAL = 4.184

try:
    import openmm as mm
    from openmm import app as omm_app
    from openmm import unit
    _HAS_OPENMM = True
except ImportError:
    mm = None  # type: ignore[assignment]
    omm_app = None  # type: ignore[assignment]
    unit = None  # type: ignore[assignment]
    _HAS_OPENMM = False

try:
    from openmmforcefields.generators import SystemGenerator  # type: ignore[import]
    _HAS_OPENMMFF = True
except ImportError:
    SystemGenerator = None  # type: ignore[assignment]
    _HAS_OPENMMFF = False

try:
    from openff.toolkit import Molecule as OFFMolecule  # type: ignore[import]
    _HAS_OPENFF = True
except ImportError:
    OFFMolecule = None  # type: ignore[assignment]
    _HAS_OPENFF = False

try:
    from meeko import PDBQTMolecule, RDKitMolCreate  # type: ignore[import]
    _HAS_MEEKO = True
except ImportError:
    PDBQTMolecule = None  # type: ignore[assignment]
    RDKitMolCreate = None  # type: ignore[assignment]
    _HAS_MEEKO = False


# ── Platform selection ─────────────────────────────────────────────────────────

def _get_platform():
    """Return the fastest available OpenMM Platform and its property dict."""
    for name in ("CUDA", "OpenCL", "CPU"):
        try:
            platform = mm.Platform.getPlatformByName(name)
            props = {"Precision": "mixed"} if name in ("CUDA", "OpenCL") else {}
            return platform, props
        except Exception:
            continue
    raise RuntimeError("No OpenMM platform is available")


# ── Ligand parsing ─────────────────────────────────────────────────────────────

def _parse_docked_pose(docked_pose_b64: str):
    """
    Decode base64 PDBQT and return an RDKit mol with docked 3D coordinates.
    Uses Meeko to preserve bond connectivity through PDBQT round-trip.
    """
    try:
        raw = base64.b64decode(docked_pose_b64).decode("utf-8", errors="replace")
    except Exception as exc:
        raise ValueError(f"docked_pose_pdbqt is not valid base64: {exc}") from exc

    if not _HAS_MEEKO:
        raise RuntimeError("meeko is not installed; cannot parse docked pose PDBQT")

    try:
        pdbqt_mol = PDBQTMolecule(raw, skip_typing=True)
        rdkit_mol, _ = RDKitMolCreate.from_pdbqt_mol(pdbqt_mol)
    except Exception as exc:
        raise ValueError(f"Could not parse docked pose PDBQT: {exc}") from exc

    if rdkit_mol is None:
        raise ValueError("Meeko could not reconstruct molecule from docked PDBQT")
    return rdkit_mol


def _openff_mol_with_docked_coords(smiles: str, rdkit_docked_mol) -> "OFFMolecule":
    """
    Create an OpenFF Molecule from SMILES, injecting the docked atom coordinates
    from the Meeko-parsed RDKit molecule by substructure matching.

    If matching fails, a generated conformer is used as a fallback (the caller
    will observe a large RMSD indicating the coordinate assignment failed).
    """
    from openff.units import Quantity, unit as off_unit  # type: ignore[import]

    off_mol = OFFMolecule.from_smiles(smiles, allow_undefined_stereo=True)
    off_mol.generate_conformers(n_conformers=1)

    rdkit_ref = off_mol.to_rdkit()

    # Try forward match: reference (SMILES) → query (docked mol)
    match = rdkit_ref.GetSubstructMatch(rdkit_docked_mol)
    if match:
        conf = rdkit_docked_mol.GetConformer()
        positions_A = np.array([conf.GetAtomPosition(match[i]) for i in range(len(match))])
    else:
        # Try reverse match
        match = rdkit_docked_mol.GetSubstructMatch(rdkit_ref)
        if match:
            conf = rdkit_docked_mol.GetConformer()
            reverse = [0] * rdkit_ref.GetNumAtoms()
            for docked_i, ref_i in enumerate(match):
                reverse[ref_i] = docked_i
            positions_A = np.array([conf.GetAtomPosition(reverse[i])
                                    for i in range(rdkit_ref.GetNumAtoms())])
        else:
            # Fallback: keep the generated conformer; RMSD will be large
            return off_mol

    # Å → nm, wrap in OpenFF Quantity
    off_mol._conformers = [Quantity(positions_A * 0.1, off_unit.nanometer)]
    return off_mol


# ── Per-subsystem energy helpers ───────────────────────────────────────────────

def _build_protein_context(protein_pdb, ff_config: ForceFieldConfig):
    """
    Build a protein-only OpenMM Simulation (implicit OBC2) for single-point
    energy evaluation at complex-trajectory geometries.
    """
    ff = omm_app.ForceField(f"{ff_config.protein}.xml", "implicit/obc2.xml")
    system = ff.createSystem(
        protein_pdb.topology,
        nonbondedMethod=omm_app.NoCutoff,
        constraints=omm_app.HBonds,
    )
    integrator = mm.VerletIntegrator(0.001 * unit.picoseconds)
    platform, props = _get_platform()
    sim = omm_app.Simulation(protein_pdb.topology, system, integrator, platform, props)
    return sim


def _build_ligand_context(ligand_mol, ff_config: ForceFieldConfig):
    """
    Build a ligand-only OpenMM Simulation (implicit OBC2) for single-point
    energy evaluation at complex-trajectory geometries.
    """
    lig_top = ligand_mol.to_topology()
    lig_omm_top = lig_top.to_openmm()

    generator = SystemGenerator(
        forcefields=["implicit/obc2.xml"],
        small_molecule_forcefield=ff_config.small_molecule,
        molecules=[ligand_mol],
        forcefield_kwargs={"constraints": omm_app.HBonds},
    )
    system = generator.create_system(lig_omm_top)
    integrator = mm.VerletIntegrator(0.001 * unit.picoseconds)
    platform, props = _get_platform()
    sim = omm_app.Simulation(lig_omm_top, system, integrator, platform, props)
    return sim


def _get_energy_kj(context, positions_nm) -> float:
    context.setPositions(positions_nm * unit.nanometers)
    state = context.getState(getEnergy=True)
    return state.getPotentialEnergy().value_in_unit(unit.kilojoules_per_mole)


# ── Main entry point ───────────────────────────────────────────────────────────

def run_refinement(req: RefineRequest) -> RefineResult:  # noqa: C901 (complex but single responsibility)
    """
    Prepare receptor + ligand, build the protein-ligand OpenMM system, run
    energy minimisation (and optionally short MD), compute MM-GBSA estimate,
    return RefineResult.
    """
    if not _HAS_OPENMM:
        raise RuntimeError("openmm is not installed in this environment")
    if not _HAS_OPENMMFF:
        raise RuntimeError("openmmforcefields is not installed")
    if not _HAS_OPENFF:
        raise RuntimeError("openff-toolkit is not installed")
    if not _HAS_MEEKO:
        raise RuntimeError("meeko is not installed")

    # ── 1. Receptor ──────────────────────────────────────────────────────────
    receptor_pdb_str, conversion_warning = decode_receptor(req.receptor, req.receptor_format)
    receptor_pdb_str = fix_receptor_pdb(receptor_pdb_str)
    protein_pdb = omm_app.PDBFile(io.StringIO(receptor_pdb_str))

    # ── 2. Ligand ────────────────────────────────────────────────────────────
    rdkit_docked = _parse_docked_pose(req.docked_pose_pdbqt)
    ligand_mol = _openff_mol_with_docked_coords(req.smiles, rdkit_docked)
    initial_lig_pos_nm = np.array(ligand_mol.conformers[0].magnitude)  # shape (n_atoms, 3)

    # ── 3. Combined system ───────────────────────────────────────────────────
    ff_files = [f"{req.force_field.protein}.xml", "implicit/obc2.xml"]
    generator = SystemGenerator(
        forcefields=ff_files,
        small_molecule_forcefield=req.force_field.small_molecule,
        molecules=[ligand_mol],
        forcefield_kwargs={"constraints": omm_app.HBonds, "rigidWater": True},
    )
    modeller = omm_app.Modeller(protein_pdb.topology, protein_pdb.positions)
    lig_omm_top = ligand_mol.to_topology().to_openmm()
    lig_positions = ligand_mol.conformers[0].magnitude * unit.nanometers
    modeller.add(lig_omm_top, lig_positions)

    system = generator.create_system(modeller.topology)

    # ── 4. Minimisation ──────────────────────────────────────────────────────
    platform, props = _get_platform()
    integrator = mm.LangevinMiddleIntegrator(
        req.simulation.temperature_K * unit.kelvin,
        1.0 / unit.picoseconds,
        0.002 * unit.picoseconds,
    )
    sim = omm_app.Simulation(modeller.topology, system, integrator, platform, props)
    sim.context.setPositions(modeller.positions)

    state0 = sim.context.getState(getEnergy=True)
    initial_energy = state0.getPotentialEnergy().value_in_unit(unit.kilojoules_per_mole)

    sim.minimizeEnergy(maxIterations=req.simulation.minimization_steps)

    state_min = sim.context.getState(getEnergy=True, getPositions=True)
    minimized_energy = state_min.getPotentialEnergy().value_in_unit(unit.kilojoules_per_mole)
    min_positions_nm = state_min.getPositions(asNumpy=True).value_in_unit(unit.nanometers)

    # ── 5. Ligand RMSD ───────────────────────────────────────────────────────
    n_lig = ligand_mol.n_atoms
    n_total = len(min_positions_nm)
    final_lig_pos = min_positions_nm[n_total - n_lig:]
    rmsd_nm = float(np.sqrt(np.mean(np.sum((final_lig_pos - initial_lig_pos_nm) ** 2, axis=1))))
    rmsd_angstrom: Optional[float] = round(rmsd_nm * 10.0, 3)

    # ── 6. Convergence flag ──────────────────────────────────────────────────
    convergence_flag = minimized_energy < initial_energy
    trajectory_frames = 0

    # ── 7. MM-GBSA ───────────────────────────────────────────────────────────
    mmgbsa_mean: Optional[float] = None
    mmgbsa_std: Optional[float] = None
    mmgbsa_note: Optional[str] = None

    if req.compute_mmgbsa:
        protein_sim = _build_protein_context(protein_pdb, req.force_field)
        ligand_sim = _build_ligand_context(ligand_mol, req.force_field)

        n_protein = n_total - n_lig
        protein_positions = min_positions_nm[:n_protein]
        ligand_positions = min_positions_nm[n_protein:]

        protein_e = _get_energy_kj(protein_sim.context, protein_positions)
        ligand_e = _get_energy_kj(ligand_sim.context, ligand_positions)
        mmgbsa_mean = compute_single_frame_mmgbsa(minimized_energy, protein_e, ligand_e)

        if req.refine_mode == "minimize":
            mmgbsa_note = (
                "Single-point MM-GBSA from minimized geometry. "
                "Use refine_mode='md' for trajectory-averaged ΔG."
            )

    # ── 8. MD production (optional) ──────────────────────────────────────────
    if req.refine_mode == "md":
        (
            mmgbsa_mean,
            mmgbsa_std,
            trajectory_frames,
            convergence_flag,
            min_positions_nm,
        ) = _run_md(req, sim, protein_pdb, ligand_mol, minimized_energy)

    # ── 9. Write refined PDB ─────────────────────────────────────────────────
    out_pdb = io.StringIO()
    sim.context.setPositions(min_positions_nm * unit.nanometers)
    omm_app.PDBFile.writeFile(modeller.topology, min_positions_nm * unit.nanometers, out_pdb)
    refined_complex_b64 = base64.b64encode(out_pdb.getvalue().encode()).decode()

    # ── 10. Ranking score ─────────────────────────────────────────────────────
    md_ranking_score = compute_md_ranking_score(mmgbsa_mean, rmsd_angstrom, req.ranking_weights)

    return RefineResult(
        smiles=req.smiles,
        refine_mode=req.refine_mode,
        force_field_used=req.force_field,
        receptor_format_received=req.receptor_format,
        receptor_conversion_warning=conversion_warning,
        initial_potential_energy_kj_mol=round(initial_energy, 3),
        minimized_potential_energy_kj_mol=round(minimized_energy, 3),
        pose_rmsd_angstrom=rmsd_angstrom,
        mmgbsa_binding_energy_kcal_mol=round(mmgbsa_mean, 3) if mmgbsa_mean is not None else None,
        mmgbsa_std_kcal_mol=round(mmgbsa_std, 3) if mmgbsa_std is not None else None,
        convergence_flag=convergence_flag,
        n_trajectory_frames=trajectory_frames,
        refined_complex_pdb=refined_complex_b64,
        md_ranking_score=md_ranking_score,
        weights_used=req.ranking_weights,
        mmgbsa_accuracy_note=mmgbsa_note,
        model_version=MODEL_VERSION,
    )


def _run_md(req: RefineRequest, sim, protein_pdb, ligand_mol, minimized_energy: float):
    """
    NVT equilibration + NVT production MD with per-frame MM-GBSA collection.
    Returns (mmgbsa_mean, mmgbsa_std, n_frames, convergence_flag, final_positions_nm).
    """
    steps_per_ps = 500  # 2 fs step
    eq_steps = int(req.simulation.equilibration_ps * steps_per_ps)
    prod_steps = int(req.simulation.production_ps * steps_per_ps)
    sample_interval = max(1, 10 * steps_per_ps)  # sample every 10 ps

    if eq_steps > 0:
        sim.step(eq_steps)

    protein_sim = _build_protein_context(protein_pdb, req.force_field)
    ligand_sim = _build_ligand_context(ligand_mol, req.force_field)

    n_lig = ligand_mol.n_atoms
    complex_energies: list[float] = []
    protein_energies: list[float] = []
    ligand_energies: list[float] = []

    remaining = prod_steps
    while remaining > 0:
        steps = min(sample_interval, remaining)
        sim.step(steps)
        remaining -= steps

        state = sim.context.getState(getEnergy=True, getPositions=True)
        pos = state.getPositions(asNumpy=True).value_in_unit(unit.nanometers)
        n_total = len(pos)
        n_protein = n_total - n_lig

        e_complex = state.getPotentialEnergy().value_in_unit(unit.kilojoules_per_mole)
        e_protein = _get_energy_kj(protein_sim.context, pos[:n_protein])
        e_ligand = _get_energy_kj(ligand_sim.context, pos[n_protein:])

        complex_energies.append(e_complex)
        protein_energies.append(e_protein)
        ligand_energies.append(e_ligand)

    n_frames = len(complex_energies)
    mmgbsa_mean, mmgbsa_std = compute_trajectory_mmgbsa(
        complex_energies, protein_energies, ligand_energies
    )

    last_half = complex_energies[n_frames // 2:]
    convergence_flag = float(np.std(last_half)) < 5.0 if last_half else True

    final_state = sim.context.getState(getPositions=True)
    final_positions = final_state.getPositions(asNumpy=True).value_in_unit(unit.nanometers)

    return mmgbsa_mean, mmgbsa_std, n_frames, convergence_flag, final_positions
