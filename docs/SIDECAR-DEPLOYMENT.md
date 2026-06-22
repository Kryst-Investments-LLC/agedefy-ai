# Science sidecar deployment — turning "ranked by evidence" into "ranked by real chemistry"

The candidate-prioritization engine (hypothesis agent, active-learning scorer)
works today on available evidence. To rank candidates by **real computational
chemistry**, deploy these sidecars and flip their feature flags. They are
quarantined microservices — the Next.js app only talks to them over HTTP and
**degrades gracefully** (returns the "sidecar not enabled" message) when off.

There are three layers, in order of value-per-effort:

| Layer | Sidecar | Compute | Effort | Deploy priority |
| --- | --- | --- | --- | --- |
| **1. Docking / screening** | `sidecar-screening/` (AutoDock Vina + RDKit) | **CPU only** | Low | **Deploy first** |
| **2. MM-GBSA refinement** | `sidecar-openmm/` (OpenMM) | **GPU** (CPU fallback, slow) | Medium | Deploy second |
| **3. FEP** | *not in repo* (`FEP_SIDECAR_URL`) | GPU, heavy | High | Future |

---

## Layer 1 — Screening / docking sidecar (deploy this first)

**What it does:** AutoDock Vina docking + RDKit/Meeko ligand prep. Ranks ligands
by predicted binding affinity. This is the single highest-value deploy — it turns
the "Run Docking" tab and the candidate triage into **real binding-score ranking**.

- **Stack:** Python 3.12 · FastAPI/uvicorn · `rdkit` · `vina==1.2.5` · `meeko`
- **Compute:** **CPU-only.** No GPU. ~2 CPU / 2–4 GB RAM is fine; docking time scales
  with `exhaustiveness` (15–300 s/ligand).
- **Endpoints:** `GET /healthz`, `POST /v1/screen`, `POST /v1/screen/batch`,
  `POST /v1/dock`
- **Image:** `sidecar-screening/Dockerfile` (already written), serves port `8080`.

**Deploy (any container host — Cloud Run, Fly.io, Render, ECS):**
```bash
cd sidecar-screening
docker build -t agedefy-screening .
# push to your registry, then deploy. Example (Cloud Run):
gcloud run deploy agedefy-screening --image .../agedefy-screening \
  --port 8080 --cpu 2 --memory 4Gi --min-instances 0
```

**Wire it into the app (env):**
```
ENABLE_SCREENING_SIDECAR=true
SCREENING_SIDECAR_URL=https://<your-screening-host>
```

**Prerequisite — prepared receptors:** `/v1/dock` takes a **base64 PDBQT receptor**
+ a docking **box** (center + size in Å) that the caller prepares offline (e.g., with
AutoDockTools/Meeko). The app does not prepare receptors; researchers supply them
(the docking UI already accepts the PDBQT + box).

**Verify:** hit `GET /healthz`, then use **/research/docking → Run Docking** with a
prepared receptor + a ligand SMILES. You should get back an affinity + pose scores
and see the docked pose render.

---

## Layer 2 — OpenMM MM-GBSA refinement sidecar (deploy second)

**What it does:** Re-scores the top docked poses with OpenMM MM-GBSA — a more
accurate (but more expensive) estimate than the raw Vina score. Use it to refine
the short-list, not to score everything.

- **Stack:** Python 3.11 · OpenMM 8.1.2 · openff-toolkit · pdbfixer · RDKit · FastAPI
- **Compute:** **GPU recommended** (CUDA 12.1 base image; auto-selects CUDA →
  OpenCL → CPU). CPU works but is slow. **Single worker** — a GPU isn't shareable
  across processes.
- **Endpoint:** `GET /healthz`, `POST /v1/refine` (takes the base64 PDBQT pose from
  `/v1/dock`).
- **Image:** `sidecar-openmm/Dockerfile` (micromamba CUDA base), port `8080`.

**Deploy (GPU host — Fly.io GPU, GCP GPU, Lambda Labs, RunPod, etc.):**
```bash
cd sidecar-openmm
docker build -t agedefy-openmm .
# deploy to a CUDA-capable host with a GPU attached; keep workers=1
```

**Wire it (env):**
```
ENABLE_OPENMM_SIDECAR=true
OPENMM_SIDECAR_URL=https://<your-openmm-host>
```

**Cost note:** GPU instances are the main expense here. Run this **on-demand**
(scale-to-zero) and only for the top N poses, not the whole library.

---

## Layer 3 — FEP (future, not in this repo)

`lib/chemistry/fep-triage.ts` gates on `ENABLE_FEP_SIDECAR` + `FEP_SIDECAR_URL`,
but **there is no FEP sidecar in the repo.** Full free-energy perturbation is a
heavy, separate build (commercial Schrödinger FEP+, or open tooling like OpenFE)
and is GPU-intensive. The MM-GBSA layer above is the cheaper rescoring step; treat
FEP as a later, optional upgrade once docking + MM-GBSA are paying off.

---

## Related sidecars (same pattern, separate concerns)

These also gate on flags/URLs and are deployed the same way when you need them:

| Flag | URL var | Powers |
| --- | --- | --- |
| `ENABLE_CAUSAL_SIDECAR` | `CAUSAL_SIDECAR_URL` | causal-effect estimates (the causal-inference routes) |
| *(mechanistic)* | `MECHANISTIC_SIDECAR_URL` | calibrated digital-twin simulation |
| `ENABLE_FEDERATED_LEARNING` | `FL_SERVER_URL` | federated learning aggregation |
| *(VC signer)* | `VC_SIGNER_URL` | external W3C VC signing (else in-process) |

---

## Recommended path

1. **Deploy `sidecar-screening` (CPU)** → set the two screening env vars → the
   docking/triage becomes real. Lowest cost, highest immediate value.
2. **Add `sidecar-openmm` (GPU, on-demand)** when you want to refine the short-list.
3. Leave **FEP** for later.

Each is independent and flag-gated, so deploy them one at a time and verify with
`/healthz` + the relevant route before flipping the flag in production.
