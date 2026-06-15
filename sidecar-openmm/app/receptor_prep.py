"""
Receptor preparation utilities.

`decode_receptor` is pure Python (base64 + string manipulation) and is
fully testable without OpenMM.  `fix_receptor_pdb` calls pdbfixer, which
requires OpenMM — mock it in unit tests.
"""
from __future__ import annotations

import base64
import io
from typing import Optional, Tuple

# PDBQT records that have no PDB equivalent; strip them during conversion
_PDBQT_ONLY = frozenset(("ROOT", "ENDROOT", "BRANCH", "ENDBRANCH", "TORSDOF"))

# PDB records that are valid and should be forwarded unchanged
_PDB_PASSTHROUGH = frozenset(("TER", "END", "MODEL", "ENDMDL", "REMARK", "HEADER", "CRYST1", "SEQRES"))


def decode_receptor(receptor_b64: str, receptor_format: str) -> Tuple[str, Optional[str]]:
    """
    Decode a base64-encoded receptor and return (pdb_string, conversion_warning).

    For ``receptor_format='pdb'`` the string is returned as-is.
    For ``receptor_format='pdbqt'`` a best-effort column-strip conversion is
    applied and a warning is returned so the caller can surface it to the user.
    """
    try:
        raw_bytes = base64.b64decode(receptor_b64)
    except Exception as exc:
        raise ValueError(f"receptor is not valid base64: {exc}") from exc

    raw_str = raw_bytes.decode("utf-8", errors="replace")

    if receptor_format == "pdb":
        return raw_str, None

    # PDBQT → PDB: strip atom-type/charge columns (cols 71-79), drop docking records
    pdb_lines: list[str] = []
    for line in raw_str.splitlines():
        record = line[:6].strip() if len(line) >= 6 else ""
        if record in _PDBQT_ONLY:
            continue
        if record in ("ATOM", "HETATM"):
            # PDBQT adds charge and atom-type in cols 71-79; PDB only uses 1-66
            pdb_lines.append(line[:66].rstrip())
        elif record in _PDB_PASSTHROUGH:
            pdb_lines.append(line.rstrip())

    warning = (
        "PDBQT receptor converted to PDB by stripping atom-type/charge columns. "
        "Verify protonation state and atom naming before trusting MD results."
    )
    return "\n".join(pdb_lines) + "\n", warning


def fix_receptor_pdb(pdb_string: str) -> str:
    """
    Apply pdbfixer to add missing atoms, cap termini, add polar hydrogens,
    and remove heterogens.  The returned string is a clean protein-only PDB
    ready for OpenMM parametrisation.
    """
    from pdbfixer import PDBFixer  # type: ignore[import]
    from openmm.app import PDBFile  # type: ignore[import]

    fixer = PDBFixer(pdbfile=io.StringIO(pdb_string))
    fixer.findMissingResidues()
    fixer.findNonstandardResidues()
    fixer.replaceNonstandardResidues()
    fixer.removeHeterogens(keepWater=False)
    fixer.findMissingAtoms()
    fixer.addMissingAtoms()
    fixer.addMissingHydrogens(pH=7.0)

    out = io.StringIO()
    PDBFile.writeFile(fixer.topology, fixer.positions, out)
    return out.getvalue()
