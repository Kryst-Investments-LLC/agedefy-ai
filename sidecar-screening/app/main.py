from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .docking import run_docking
from .docking_schemas import DockRequest
from .schemas import BatchScreenRequest, BatchScreenResult, ScreenRequest
from .screening import MODEL_VERSION, screen_smiles

app = FastAPI(title="Screening Sidecar", version=MODEL_VERSION)


@app.get("/healthz")
async def healthz():
    from rdkit import __version__ as rdkit_version
    return {"status": "ok", "version": MODEL_VERSION, "rdkit_version": rdkit_version}


@app.post("/v1/screen")
async def screen(req: ScreenRequest):
    result = screen_smiles(req.smiles, req.include_pains)
    return JSONResponse(content=result.model_dump(by_alias=True, mode="json"))


@app.post("/v1/screen/batch")
async def screen_batch(req: BatchScreenRequest):
    results = [screen_smiles(s, req.include_pains) for s in req.smiles_list]
    batch = BatchScreenResult(results=results)
    return JSONResponse(content=batch.model_dump(by_alias=True, mode="json"))


@app.post("/v1/dock")
async def dock(req: DockRequest):
    try:
        result = run_docking(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return JSONResponse(content=result.model_dump(mode="json"))
