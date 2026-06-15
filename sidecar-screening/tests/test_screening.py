import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ASPIRIN = "CC(=O)Oc1ccccc1C(=O)O"
CAFFEINE = "Cn1cnc2c1c(=O)n(C)c(=O)n2C"
INVALID = "invalid_smiles_xyz"
BENZENE = "c1ccccc1"
# Verapamil — basic nitrogen + high LogP → hERG risk flag expected
VERAPAMIL = "COc1ccc(CCN(C)CCCC(C#N)(C(C)C)c2ccc(OC)c(OC)c2)cc1OC"


# ── /healthz ─────────────────────────────────────────────────────────────────

def test_healthz_status():
    r = client.get("/healthz")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "rdkit_version" in data
    assert data["version"].startswith("screening-sidecar@")


# ── /v1/screen — valid SMILES ─────────────────────────────────────────────────

def test_screen_valid_smiles_shape():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert data["canonical_smiles"] is not None
    assert data["sanitization_error"] is None
    assert data["descriptors"] is not None
    assert data["filters"] is not None
    assert data["admet_flags"] is not None
    assert data["model_version"].startswith("screening-sidecar@")


def test_screen_aspirin_descriptors():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    desc = r.json()["descriptors"]
    assert abs(desc["molecular_weight"] - 180.16) < 0.5
    assert desc["hbd"] == 1
    assert desc["hba"] == 3
    assert desc["aromatic_rings"] == 1
    assert desc["heavy_atom_count"] == 13
    assert 0.0 < desc["qed"] <= 1.0
    assert 0.0 < desc["frac_csp3"] <= 1.0


def test_screen_aspirin_inchi():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    data = r.json()
    # InChI may be None if RDKit InChI module is absent, but should be present in 2024
    if data["inchi"] is not None:
        assert data["inchi"].startswith("InChI=")
        assert data["inchi_key"] is not None
        assert len(data["inchi_key"]) == 27  # standard InChIKey length


def test_screen_caffeine_molecular_weight():
    r = client.post("/v1/screen", json={"smiles": CAFFEINE})
    assert r.status_code == 200
    desc = r.json()["descriptors"]
    assert abs(desc["molecular_weight"] - 194.19) < 0.5


def test_screen_sa_score_range():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    sa = r.json()["descriptors"]["sa_score"]
    if sa is not None:
        assert 1.0 <= sa <= 10.0


# ── /v1/screen — filters ──────────────────────────────────────────────────────

def test_screen_lipinski_aspirin_passes():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    lip = r.json()["filters"]["lipinski"]
    assert lip["pass"] is True
    assert lip["violations"] == 0
    assert lip["details"]["mw_ok"] is True
    assert lip["details"]["logp_ok"] is True


def test_screen_veber_aspirin_passes():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    veber = r.json()["filters"]["veber"]
    assert veber["pass"] is True
    assert veber["details"]["rotatable_bonds_ok"] is True
    assert veber["details"]["tpsa_ok"] is True


def test_screen_pains_unchecked_by_default():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    pains = r.json()["filters"]["pains"]
    assert pains["checked"] is False
    assert pains["alerts"] == []


def test_screen_pains_checked_when_requested():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN, "include_pains": True})
    pains = r.json()["filters"]["pains"]
    assert pains["checked"] is True


# ── /v1/screen — ADMET flags ─────────────────────────────────────────────────

def test_screen_bbb_aspirin():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    bbb = r.json()["admet_flags"]["bbb_penetrant"]
    # Aspirin: TPSA ~63.6, MW ~180 → likely BBB penetrant
    assert bbb["likely"] is True


def test_screen_herg_flag_verapamil():
    r = client.post("/v1/screen", json={"smiles": VERAPAMIL})
    assert r.status_code == 200
    herg = r.json()["admet_flags"]["herg_liability_risk"]
    # Verapamil has tertiary amine + high LogP → flag expected
    assert herg["flag"] is True


def test_screen_herg_flag_absent_aspirin():
    r = client.post("/v1/screen", json={"smiles": ASPIRIN})
    herg = r.json()["admet_flags"]["herg_liability_risk"]
    assert herg["flag"] is False


# ── /v1/screen — invalid SMILES ──────────────────────────────────────────────

def test_screen_invalid_smiles_returns_200_with_invalid_flag():
    r = client.post("/v1/screen", json={"smiles": INVALID})
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is False
    assert data["sanitization_error"] is not None
    assert data["descriptors"] is None
    assert data["filters"] is None
    assert data["admet_flags"] is None


def test_screen_missing_smiles_returns_422():
    r = client.post("/v1/screen", json={})
    assert r.status_code == 422


def test_screen_empty_smiles_returns_422():
    r = client.post("/v1/screen", json={"smiles": ""})
    assert r.status_code == 422


def test_screen_smiles_too_long_returns_422():
    r = client.post("/v1/screen", json={"smiles": "C" * 4001})
    assert r.status_code == 422


# ── /v1/screen/batch ─────────────────────────────────────────────────────────

def test_batch_screen_mixed():
    r = client.post("/v1/screen/batch", json={"smiles_list": [ASPIRIN, INVALID, CAFFEINE]})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 3
    assert results[0]["valid"] is True
    assert results[1]["valid"] is False
    assert results[2]["valid"] is True


def test_batch_screen_empty_list_returns_422():
    r = client.post("/v1/screen/batch", json={"smiles_list": []})
    assert r.status_code == 422


def test_batch_screen_too_many_returns_422():
    r = client.post("/v1/screen/batch", json={"smiles_list": ["C"] * 51})
    assert r.status_code == 422


def test_batch_screen_single_item():
    r = client.post("/v1/screen/batch", json={"smiles_list": [BENZENE]})
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) == 1
    assert results[0]["valid"] is True
