# sidecar-screening

Python microservice providing cheminformatics endpoints for the agedefy platform.
Built on FastAPI + RDKit. Runs on **CPU only** (see GPU note below).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Liveness probe — returns RDKit version |
| POST | `/v1/screen` | RDKit descriptors + drug-likeness filters for a single SMILES |
| POST | `/v1/screen/batch` | Same for up to 50 SMILES |
| POST | `/v1/dock` | AutoDock Vina docking — ligand SMILES + prepared receptor PDBQT + box |

## Quick start

```bash
docker build -t screening-sidecar .
docker run -p 8080:8080 -e SCREENING_VERSION=1.0.0 screening-sidecar
```

## `/v1/dock` — docking endpoint

### Receptor preparation

The sidecar accepts the receptor as a **base64-encoded PDBQT** string. Receptor
preparation (adding polar hydrogens, assigning Gasteiger charges, converting to
PDBQT) must be done offline before calling the endpoint. Standard tools:

```bash
# Using AutoDockTools (MGLTools)
prepare_receptor4.py -r target.pdb -o target.pdbqt -A hydrogens

# Then encode:
base64 -w0 target.pdbqt > target.pdbqt.b64
```

### Docking box

`center` and `size` (all in Ångströms) must be specified explicitly on every
call. A typical active-site box is 20×20×20 Å. You can determine the center
from the co-crystallised ligand coordinates or from a known binding-site
residue centroid.

### Exhaustiveness

| `exhaustiveness` | Wall-clock time (drug-like ligand) | Use case |
|---|---|---|
| 4 | ~5–8 s | Rapid virtual screening |
| 8 (default) | ~15–30 s | Standard docking |
| 16 | ~60–120 s | More thorough search |
| 32 | ~3–5 min | High-confidence single target |

## GPU note

**AutoDock Vina is CPU-only.** The `vina` PyPI package (v1.2.x) and the
upstream Vina 1.2 binary contain no GPU code path. Docking speed scales
linearly with CPU core count (via `exhaustiveness` parallelism), so prefer
instances with ≥4 vCPU.

For GPU-accelerated docking at scale, see
[AutoDock-GPU](https://github.com/ccsb-scripps/AutoDock-GPU), which uses
OpenCL/CUDA. It requires a different build pipeline, different receptor/ligand
prep conventions (`.maps` grid files), and is **not** compatible with this
sidecar's `/v1/dock` interface.

## Running tests

```bash
# From sidecar-screening/
pip install -r requirements.txt
pytest tests/ -v
```
