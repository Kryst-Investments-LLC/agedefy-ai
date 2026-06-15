import sys
from pathlib import Path

# Makes `app` importable when pytest is run from sidecar-screening/
sys.path.insert(0, str(Path(__file__).parent))
