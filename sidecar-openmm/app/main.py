from __future__ import annotations

import os
import time

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .refinement import MODEL_VERSION, _HAS_OPENMM, run_refinement
from .schemas import RefineRequest

app = FastAPI(title="openmm-sidecar", version=os.environ.get("OPENMM_SIDECAR_VERSION", "1.0.0"))


@app.get("/healthz")
async def healthz():
    openmm_version: str | None = None
    if _HAS_OPENMM:
        try:
            import openmm as mm  # type: ignore[import]
            openmm_version = mm.__version__
        except Exception:
            pass

    return {
        "status": "ok",
        "version": MODEL_VERSION,
        "openmm_version": openmm_version,
        "openmm_available": _HAS_OPENMM,
    }


@app.post("/v1/refine")
async def refine(req: RefineRequest):
    try:
        result = run_refinement(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return JSONResponse(content=result.model_dump(mode="json"))
