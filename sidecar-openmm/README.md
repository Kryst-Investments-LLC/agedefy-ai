# sidecar-openmm

OpenMM molecular-dynamics refinement sidecar for the agedefy platform.
Accepts a docked ligand pose from `/v1/dock` (screening-sidecar) and
refines it with energy minimisation and optional short MD, returning
MM-GBSA binding energy estimates and a stability-weighted ranking score.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Liveness probe — reports OpenMM version and GPU availability |
| POST | `/v1/refine` | Minimise / MD-refine a docked pose; compute MM-GBSA |

## Quick start

```bash
docker build -t openmm-sidecar .
docker run --gpus all -p 8080:8080 openmm-sidecar
```

CPU-only (no GPU):

```bash
docker run -p 8080:8080 openmm-sidecar
```

## `/v1/refine` request

```json
{
  "smiles": "CC(=O)Oc1ccccc1C(=O)O",
  "receptor": "<base64-PDB>",
  "receptor_format": "pdb",
  "docked_pose_pdbqt": "<base64-PDBQT from /v1/dock>",
  "refine_mode": "minimize",
  "force_field": {
    "protein": "amber14-all",
    "small_molecule": "openff-2.0.0"
  },
  "simulation": {
    "minimization_steps": 5000,
    "equilibration_ps": 100.0,
    "production_ps": 500.0,
    "temperature_K": 300.0
  },
  "compute_mmgbsa": true,
  "ranking_weights": {
    "mmgbsa": 0.65,
    "rmsd_penalty": 0.35
  }
}
```

### Receptor formats

| `receptor_format` | Behaviour |
|---|---|
| `"pdb"` (default) | Forwarded directly to pdbfixer → OpenMM |
| `"pdbqt"` | Best-effort column-strip to PDB + warning in response |

### `refine_mode` values

| Mode | Description | Typical runtime |
|---|---|---|
| `"minimize"` (default) | L-BFGS energy minimisation only; single-point MM-GBSA | 15–60 s |
| `"md"` | Minimisation + NVT equilibration + NVT production MD; trajectory-averaged MM-GBSA | 5–60 min |

**Recommended workflow (funnel):**

1. `/v1/dock` — screen thousands of compounds (CPU, ~30 s each)
2. `/v1/refine` with `"minimize"` — energy-minimise top 100 hits (~30 s each)
3. `/v1/refine` with `"md"` — full MD/MM-GBSA for top 10–20 candidates (~10 min each)

### Ranking score

`md_ranking_score` (0–1) combines MM-GBSA and pose RMSD:

```
md_ranking_score = weights.mmgbsa × normalize_mmgbsa(ΔG)
                 + weights.rmsd_penalty × rmsd_stability(RMSD)
```

where `normalize_mmgbsa` maps −3 to −20 kcal/mol → 0 to 1, and
`rmsd_stability` maps 0 Å → 1.0 and ≥5 Å → 0.0.

`weights_used` is always echoed in the response for reproducibility.

## MM-GBSA accuracy note

- **minimize mode**: single-point estimate from the minimised geometry.
  No solute entropy correction.  Useful for ranking; not publication-grade.
- **md mode**: single-trajectory MM-GBSA averaged over production frames.
  The `mmgbsa_std_kcal_mol` field reflects frame-to-frame variance.
  The `convergence_flag` is true when the last-half energy std < 5 kJ/mol.

## GPU / compute sizing

| Platform | Notes |
|---|---|
| CUDA (NVIDIA) | Fastest. `docker run --gpus all` required. |
| OpenCL (AMD/Intel) | Supported via conda-forge OpenMM build. |
| CPU | Fallback. Suitable for development and minimize mode. |

Sizing guidance:
- `minimize` mode: ≥4 vCPU or any GPU
- `md` mode with production_ps ≤ 500 ps: ≥1× NVIDIA A100 40 GB (≈10 min)
- `md` mode with production_ps = 2000 ps: ≥1× NVIDIA A100 80 GB (≈40 min)

## Running tests (local)

```bash
cd sidecar-openmm
micromamba run -n base pytest tests/ -v
```

Python tests that call `run_refinement` directly require the full conda
environment (OpenMM + openmmforcefields + openff-toolkit + meeko).
All endpoint tests mock `run_refinement` and run without any GPU dependency.
