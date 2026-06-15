"""
Docking endpoint tests.

Strategy:
- Ligand preparation (prepare_ligand_pdbqt) is tested with real RDKit + Meeko.
  These tests are skipped if Meeko is not installed.
- Endpoint tests mock `app.docking.Vina` so no real receptor file is needed
  and tests run in milliseconds regardless of CPU.
"""

import base64
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O"
CAFFEINE = "Cn1cnc2c1c(=O)n(C)c(=O)n2C"
INVALID = "invalid_smiles_xyz"

# Minimal fake receptor PDBQT (Vina is mocked, so content doesn't matter)
FAKE_RECEPTOR_PDBQT = "ATOM      1  CA  ALA A   1       1.000   1.000   1.000  1.00  0.00    +0.000 C\nTER\n"
FAKE_RECEPTOR_B64 = base64.b64encode(FAKE_RECEPTOR_PDBQT.encode()).decode()

VALID_BOX = {
    "center": {"x": 15.19, "y": 53.90, "z": 16.92},
    "size": {"x": 20.0, "y": 20.0, "z": 20.0},
}

# Simulates what v.energies() returns: list of [total, ...] rows
MOCK_ENERGIES = [
    [-7.2, 0.0, 0.0, 0.0, 0.0],
    [-6.8, 0.0, 0.0, 0.0, 0.0],
    [-6.5, 0.0, 0.0, 0.0, 0.0],
]
MOCK_POSE_PDBQT = (
    "REMARK VINA RESULT:     -7.200      0.000      0.000\n"
    "ATOM      1  C   LIG A   1       0.000   0.000   0.000  0.00  0.00    +0.000 C\n"
    "ENDMDL\n"
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_vina_instance():
    inst = MagicMock()
    inst.energies.return_value = MOCK_ENERGIES
    inst.poses.return_value = MOCK_POSE_PDBQT
    return inst


def _dock_payload(**overrides):
    payload = {
        "smiles": ASPIRIN,
        "receptor_pdbqt": FAKE_RECEPTOR_B64,
        "box": VALID_BOX,
    }
    payload.update(overrides)
    return payload


# ── Ligand preparation (real RDKit + Meeko) ───────────────────────────────────

meeko_available = pytest.importorskip("meeko", reason="Meeko not installed")


def test_prepare_ligand_pdbqt_aspirin():
    from app.docking import prepare_ligand_pdbqt
    pdbqt, err = prepare_ligand_pdbqt(ASPIRIN)
    assert err is None, f"unexpected error: {err}"
    assert "ROOT" in pdbqt or "ATOM" in pdbqt, "PDBQT should contain structural records"


def test_prepare_ligand_pdbqt_caffeine():
    from app.docking import prepare_ligand_pdbqt
    pdbqt, err = prepare_ligand_pdbqt(CAFFEINE)
    assert err is None
    assert len(pdbqt) > 0


def test_prepare_ligand_pdbqt_invalid_smiles():
    from app.docking import prepare_ligand_pdbqt
    _, err = prepare_ligand_pdbqt(INVALID)
    assert err is not None
    assert "parse" in err.lower() or "RDKit" in err


# ── /v1/dock — schema validation (no Vina needed) ────────────────────────────

def test_dock_missing_smiles_returns_422():
    r = client.post("/v1/dock", json={
        "receptor_pdbqt": FAKE_RECEPTOR_B64,
        "box": VALID_BOX,
    })
    assert r.status_code == 422


def test_dock_missing_receptor_returns_422():
    r = client.post("/v1/dock", json={"smiles": ASPIRIN, "box": VALID_BOX})
    assert r.status_code == 422


def test_dock_missing_box_returns_422():
    r = client.post("/v1/dock", json={"smiles": ASPIRIN, "receptor_pdbqt": FAKE_RECEPTOR_B64})
    assert r.status_code == 422


def test_dock_zero_box_size_returns_422():
    r = client.post("/v1/dock", json=_dock_payload(box={
        "center": {"x": 0, "y": 0, "z": 0},
        "size": {"x": 0.0, "y": 20.0, "z": 20.0},  # x=0 violates gt=0
    }))
    assert r.status_code == 422


def test_dock_negative_box_size_returns_422():
    r = client.post("/v1/dock", json=_dock_payload(box={
        "center": {"x": 0, "y": 0, "z": 0},
        "size": {"x": 20.0, "y": -5.0, "z": 20.0},
    }))
    assert r.status_code == 422


def test_dock_exhaustiveness_too_low_returns_422():
    r = client.post("/v1/dock", json=_dock_payload(exhaustiveness=0))
    assert r.status_code == 422


def test_dock_exhaustiveness_too_high_returns_422():
    r = client.post("/v1/dock", json=_dock_payload(exhaustiveness=33))
    assert r.status_code == 422


def test_dock_n_poses_too_high_returns_422():
    r = client.post("/v1/dock", json=_dock_payload(n_poses=21))
    assert r.status_code == 422


def test_dock_invalid_base64_returns_422():
    r = client.post("/v1/dock", json=_dock_payload(receptor_pdbqt="not-valid-base64!!!"))
    assert r.status_code == 422


# ── /v1/dock — mocked Vina (success path) ────────────────────────────────────

@patch("app.docking.Vina")
@patch("app.docking.prepare_ligand_pdbqt", return_value=("FAKE PDBQT\n", None))
def test_dock_success_shape(mock_prep, MockVina):
    MockVina.return_value = _mock_vina_instance()
    r = client.post("/v1/dock", json=_dock_payload())
    assert r.status_code == 200
    data = r.json()
    assert data["ligand_smiles"] == ASPIRIN
    assert data["binding_affinity_kcal_mol"] == pytest.approx(-7.2)
    assert data["pose_scores_kcal_mol"] == pytest.approx([-7.2, -6.8, -6.5])
    assert data["best_pose_pdbqt"] == MOCK_POSE_PDBQT
    assert data["n_poses_returned"] == 3
    assert data["exhaustiveness"] == 8  # default
    assert data["model_version"].startswith("screening-sidecar@")


@patch("app.docking.Vina")
@patch("app.docking.prepare_ligand_pdbqt", return_value=("FAKE PDBQT\n", None))
def test_dock_custom_exhaustiveness_and_n_poses(mock_prep, MockVina):
    inst = _mock_vina_instance()
    inst.energies.return_value = [[-8.1, 0, 0, 0, 0]]
    inst.poses.return_value = "MODEL 1\nATOM...\nENDMDL\n"
    MockVina.return_value = inst
    r = client.post("/v1/dock", json=_dock_payload(exhaustiveness=16, n_poses=1))
    assert r.status_code == 200
    data = r.json()
    assert data["exhaustiveness"] == 16
    assert data["n_poses_returned"] == 1
    # Verify Vina.dock was called with the requested params
    inst.dock.assert_called_once_with(exhaustiveness=16, n_poses=1)


@patch("app.docking.Vina")
@patch("app.docking.prepare_ligand_pdbqt", return_value=("FAKE PDBQT\n", None))
def test_dock_box_forwarded_to_vina(mock_prep, MockVina):
    inst = _mock_vina_instance()
    MockVina.return_value = inst
    custom_box = {
        "center": {"x": 10.0, "y": 20.0, "z": 30.0},
        "size": {"x": 15.0, "y": 25.0, "z": 35.0},
    }
    client.post("/v1/dock", json=_dock_payload(box=custom_box))
    inst.compute_vina_maps.assert_called_once_with(
        center=[10.0, 20.0, 30.0],
        box_size=[15.0, 25.0, 35.0],
    )


@patch("app.docking.Vina")
@patch("app.docking.prepare_ligand_pdbqt", return_value=("FAKE PDBQT\n", None))
def test_dock_vina_runtime_error_returns_500(mock_prep, MockVina):
    inst = _mock_vina_instance()
    inst.dock.side_effect = RuntimeError("Vina internal error")
    MockVina.return_value = inst
    r = client.post("/v1/dock", json=_dock_payload())
    assert r.status_code == 500


@patch("app.docking.prepare_ligand_pdbqt", return_value=("", "RDKit could not parse SMILES"))
def test_dock_invalid_smiles_returns_422(mock_prep):
    r = client.post("/v1/dock", json=_dock_payload(smiles=INVALID))
    assert r.status_code == 422
    assert "parse" in r.json()["detail"].lower() or "RDKit" in r.json()["detail"]
