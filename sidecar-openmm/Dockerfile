FROM mambaorg/micromamba:1.5.8-cuda12.1.0-ubuntu22.04

LABEL org.opencontainers.image.title="openmm-sidecar" \
      org.opencontainers.image.description="OpenMM MD refinement sidecar for agedefy"

WORKDIR /opt/openmm

COPY environment.yml .
RUN micromamba install -n base -f environment.yml && micromamba clean -afy

COPY app/ app/

ENV OPENMM_SIDECAR_VERSION=1.0.0 \
    PYTHONUNBUFFERED=1

EXPOSE 8080

# Single worker — GPU is not shareable across processes
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
