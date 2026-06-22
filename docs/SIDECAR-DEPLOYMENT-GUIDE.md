# Sidecar deployment — step-by-step guide

A hands-on runbook to deploy the chemistry sidecars in order. Follow Layer 1
first (it's CPU-only and gives the biggest win), verify it, then add Layer 2
when you want refinement. Layer 3 (FEP) is a future build.

Ready-to-run configs are committed: `sidecar-screening/fly.toml`,
`sidecar-openmm/fly.toml`.

---

## 0. One-time prerequisites

1. **Docker Desktop** running locally (to build/test the images).
2. A host account. This guide uses **Fly.io** (handles both CPU *and* GPU and
   scales to zero); a **Google Cloud Run** alternative is given for Layer 1.
   - Fly: `iwr https://fly.io/install.ps1 -useb | iex` (Win) → `fly auth login`
   - Cloud Run: install `gcloud`, `gcloud auth login`, `gcloud config set project <PROJ>`
3. Where the **Next.js app** runs (Vercel / your host) — you'll add env vars there.
4. (Layer 1 docking only) a way to **prepare a receptor** — see §3.

---

## LAYER 1 — Screening / docking sidecar (CPU) ← do this first

### 1.1 Build & smoke-test locally
```bash
cd sidecar-screening
docker build -t agedefy-screening .
docker run --rm -p 8080:8080 agedefy-screening
# in another terminal:
curl http://localhost:8080/healthz
# → {"status":"ok",...}
curl -X POST http://localhost:8080/v1/screen \
  -H "content-type: application/json" \
  -d '{"smiles":"CC(=O)Oc1ccccc1C(=O)O"}'
# → druglikeness descriptors + filters for aspirin
```
If those two return JSON, the image works. Stop the container (Ctrl-C).

### 1.2 Deploy to Fly.io  (recommended — scales to zero)
```bash
cd sidecar-screening
fly launch --copy-config --no-deploy   # uses the committed fly.toml; pick an org
fly deploy
fly status                              # note the hostname, e.g. agedefy-screening.fly.dev
curl https://agedefy-screening.fly.dev/healthz
```

**…or Google Cloud Run** (also scales to zero):
```bash
cd sidecar-screening
gcloud builds submit --tag gcr.io/<PROJ>/agedefy-screening
gcloud run deploy agedefy-screening \
  --image gcr.io/<PROJ>/agedefy-screening \
  --port 8080 --cpu 2 --memory 4Gi \
  --min-instances 0 --max-instances 3 --no-allow-unauthenticated
# grab the URL it prints
```

### 1.3 Wire it into the app
Set these where the Next.js app runs (Vercel → Project → Settings → Env, or your
`.env`):
```
ENABLE_SCREENING_SIDECAR=true
SCREENING_SIDECAR_URL=https://agedefy-screening.fly.dev
```
Redeploy / restart the app so it picks them up.

### 1.4 Verify end-to-end in the product
1. Sign in as a RESEARCHER, open **/research/docking → Run Docking** tab.
2. Paste a prepared receptor PDBQT (see §3), a ligand SMILES, and a box.
3. Run → you should get a **binding affinity + pose scores** and a rendered pose.
   (Before deploy this tab showed "sidecar not enabled" — that message is gone now.)

✅ **Layer 1 done.** Candidate triage now ranks by real Vina binding scores.

---

## 2. Receptor prep (needed for `/v1/dock`)

The app does **not** prepare receptors — `/v1/dock` expects a **base64 PDBQT**
receptor + a **box** (pocket center + size in Å). Prepare once per target:

1. Get the protein from RCSB (e.g. `1HSG.pdb`).
2. Remove waters/ligands, add hydrogens, convert to PDBQT with **Meeko** or
   AutoDockTools:
   ```bash
   pip install meeko
   mk_prepare_receptor.py -i 1HSG.pdb -o receptor.pdbqt -p
   ```
3. Define the **box** around the binding pocket (center x/y/z + size x/y/z in Å);
   a 20–25 Å cube centered on the known ligand is typical.
4. Base64-encode the PDBQT for the API:
   ```bash
   base64 -w0 receptor.pdbqt        # paste this as receptor_pdbqt
   ```
The docking UI accepts the raw PDBQT (it base64-encodes for you) + the box fields.

Direct API check:
```bash
curl -X POST https://agedefy-screening.fly.dev/v1/dock \
  -H "content-type: application/json" \
  -d '{
    "smiles":"CC(=O)Oc1ccccc1C(=O)O",
    "receptor_pdbqt":"<BASE64_PDBQT>",
    "box":{"center":{"x":0,"y":0,"z":0},"size":{"x":20,"y":20,"z":20}},
    "exhaustiveness":8, "n_poses":5
  }'
# → { binding_affinity_kcal_mol, pose_scores_kcal_mol[], best_pose_pdbqt, ... }
```

---

## LAYER 2 — OpenMM MM-GBSA sidecar (GPU) ← when refining the short-list

Re-scores the **top N** docked poses more accurately. Run it **on-demand** and
only for the short-list — GPU minutes are the cost.

### 2.1 Build locally (CPU build is fine; it auto-selects CUDA→OpenCL→CPU at run)
```bash
cd sidecar-openmm
docker build -t agedefy-openmm .
```

### 2.2 Deploy to a GPU host (Fly.io GPU)
```bash
cd sidecar-openmm
fly launch --copy-config --no-deploy
fly deploy --vm-gpu-kind a100-40gb     # or l40s; keep one machine
fly status
curl https://agedefy-openmm.fly.dev/healthz
```
> Other GPU options: GCP GPU on GKE/Compute, RunPod, Lambda Labs, Modal. Any
> CUDA-12-capable host works — the image is built on `micromamba cuda12.1`.

### 2.3 Wire it in
```
ENABLE_OPENMM_SIDECAR=true
OPENMM_SIDECAR_URL=https://agedefy-openmm.fly.dev
```

### 2.4 Verify
`/v1/refine` takes the **base64 PDBQT pose** returned by `/v1/dock`:
```bash
curl -X POST https://agedefy-openmm.fly.dev/v1/refine \
  -H "content-type: application/json" \
  -d '{"docked_pose_pdbqt":"<BASE64_POSE_FROM_DOCK>", ...}'
```
Confirm `/healthz` reports the GPU platform (CUDA), not CPU, or refinement will be slow.

✅ **Layer 2 done.** Short-listed poses now get an MM-GBSA re-score.

---

## LAYER 3 — FEP (future, not in this repo)

`lib/chemistry/fep-triage.ts` gates on `ENABLE_FEP_SIDECAR` + `FEP_SIDECAR_URL`,
but **there is no FEP sidecar in the repo.** To add it later you'd stand up a
separate service (commercial **Schrödinger FEP+**, or open **OpenFE**), expose a
compatible HTTP endpoint, then set the flag + URL the same way. It's GPU-heavy and
expensive — only worth it once docking + MM-GBSA are demonstrably paying off.

---

## Production hardening (do before real traffic)

- **Lock down the sidecars.** The endpoints have no auth. Either keep them on a
  private network (Fly private networking / Cloud Run `--no-allow-unauthenticated`
  + IAM) or add a shared-secret header the app sends and the sidecar checks.
- **Secrets, not plaintext.** Set the `*_SIDECAR_URL` (and any shared secret) as
  managed secrets in the app host, not committed.
- **Rate-limit & cap.** Docking time grows with `exhaustiveness`; the app already
  rate-limits `/api/agents/chemistry/dock` to 3/min — keep it.
- **Scale-to-zero both.** `auto_stop_machines = "stop"` (already set) means you pay
  only while a job runs. Expect a cold-start delay on the first call (esp. OpenMM).
- **Verify flags per environment.** Both sidecars are off unless
  `ENABLE_SCREENING_SIDECAR` / `ENABLE_OPENMM_SIDECAR` are `true` — set them only
  where the URLs are reachable.

---

## Quick reference

| | Screening (Layer 1) | OpenMM (Layer 2) |
| --- | --- | --- |
| Compute | CPU | GPU (CUDA→OpenCL→CPU fallback) |
| Image | `sidecar-screening/Dockerfile` | `sidecar-openmm/Dockerfile` |
| Fly config | `sidecar-screening/fly.toml` | `sidecar-openmm/fly.toml` |
| Health | `GET /healthz` | `GET /healthz` |
| Main endpoint | `POST /v1/dock`, `/v1/screen` | `POST /v1/refine` |
| Enable flag | `ENABLE_SCREENING_SIDECAR=true` | `ENABLE_OPENMM_SIDECAR=true` |
| URL var | `SCREENING_SIDECAR_URL` | `OPENMM_SIDECAR_URL` |
