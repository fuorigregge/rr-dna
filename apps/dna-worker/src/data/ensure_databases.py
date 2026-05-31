"""
Ensures ClinVar and PharmGKB databases are built before the worker starts.
If the .json.gz files are missing, runs the build script automatically.
gnomAD ancestry DB is built on-demand (triggered by VCF upload with ancestryMode='gnomad').
"""

import subprocess
import sys
from pathlib import Path

_DATA_DIR = Path(__file__).parent
_CLINVAR_DB = _DATA_DIR / "clinvar_db.json.gz"
_PHARMGKB_DB = _DATA_DIR / "pharmgkb_db.json.gz"
_CLINVAR_COORDS = _DATA_DIR / "clinvar_coords.json.gz"
_ANCESTRY_GNOMAD_DB = _DATA_DIR / "ancestry_gnomad_db.json.gz"
_BUILD_CLINVAR_SCRIPT = _DATA_DIR.parent.parent / "scripts" / "build_clinvar_db.py"
_BUILD_ANCESTRY_SCRIPT = _DATA_DIR.parent.parent / "scripts" / "build_ancestry_db.py"
_TOOLS_DIR = _DATA_DIR.parent.parent / "tools"


def ensure():
    """Check if ClinVar databases exist, build them if missing."""
    if _CLINVAR_DB.exists() and _PHARMGKB_DB.exists() and _CLINVAR_COORDS.exists():
        return

    missing = []
    if not _CLINVAR_DB.exists():
        missing.append("clinvar_db.json.gz")
    if not _PHARMGKB_DB.exists():
        missing.append("pharmgkb_db.json.gz")
    if not _CLINVAR_COORDS.exists():
        missing.append("clinvar_coords.json.gz")

    print(f"[ensure_databases] Missing: {', '.join(missing)}")

    if not _BUILD_CLINVAR_SCRIPT.exists():
        print(f"[ensure_databases] Build script not found at {_BUILD_CLINVAR_SCRIPT}, skipping")
        return

    print("[ensure_databases] Building databases (this may take a few minutes on first run)...")
    result = subprocess.run(
        [sys.executable, str(_BUILD_CLINVAR_SCRIPT)],
        cwd=str(_BUILD_CLINVAR_SCRIPT.parent.parent),
    )

    if result.returncode != 0:
        print("[ensure_databases] Build failed! Worker will start with limited annotation data.")
    else:
        print("[ensure_databases] Databases built successfully.")


def ensure_haplo_tools():
    """Run tools/setup.sh if the haplogroup tools are missing. Idempotent, best-effort.

    Called at worker startup so the automatic haplogroup step has its tools ready
    (HaploGrep + liftOver + chain + yhaplo). If setup fails, haplogroups are simply
    skipped during ingest — never fatal.
    """
    setup = _TOOLS_DIR / "setup.sh"
    jar = _TOOLS_DIR / "haplogrep.jar"
    yhaplo = _TOOLS_DIR / "yhaplo-venv" / "bin" / "yhaplo"
    if jar.exists() and yhaplo.exists():
        return
    if not setup.exists():
        print(f"[ensure_databases] {setup} not found, haplogroups will be skipped")
        return
    print("[ensure_databases] Setting up haplogroup tools (first run, ~1-2 min)...")
    result = subprocess.run(["bash", str(setup)])
    if result.returncode != 0:
        print("[ensure_databases] Haplogroup tools setup failed; haplogroups will be skipped")


def ensure_pgs_catalog():
    """Download the configured PGS Catalog scoring files into src/data/pgs/.

    Idempotent: skips files already present (with non-trivial size). Best-effort:
    a failed download just leaves the score unavailable in the worker, not fatal.
    """
    import urllib.request
    from src.worker.pgs_panel import PGS_SCORES, PGS_DATA_DIR

    PGS_DATA_DIR.mkdir(exist_ok=True)
    for score in PGS_SCORES:
        pgs_id = score["pgs_id"]
        target = PGS_DATA_DIR / f"{pgs_id}_hmPOS_GRCh38.txt.gz"
        if target.exists() and target.stat().st_size > 1000:
            continue
        url = f"https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/{pgs_id}/ScoringFiles/Harmonized/{pgs_id}_hmPOS_GRCh38.txt.gz"
        print(f"[ensure_pgs] downloading {pgs_id} ({score['label']})...", flush=True)
        try:
            urllib.request.urlretrieve(url, target)
            print(f"[ensure_pgs] {pgs_id} ok ({target.stat().st_size:,} bytes)", flush=True)
        except Exception as e:
            print(f"[ensure_pgs] {pgs_id} FAILED: {e}", flush=True)


def ancestry_gnomad_exists() -> bool:
    """Check if gnomAD ancestry DB is available."""
    return _ANCESTRY_GNOMAD_DB.exists()


def build_ancestry_gnomad(progress_callback=None) -> bool:
    """Build gnomAD ancestry DB on-demand. Runs in-process for progress feedback."""
    if _ANCESTRY_GNOMAD_DB.exists():
        print("[ensure_databases] gnomAD ancestry DB already exists, skipping build")
        return True

    if not _BUILD_ANCESTRY_SCRIPT.exists():
        print(f"[ensure_databases] Ancestry build script not found at {_BUILD_ANCESTRY_SCRIPT}")
        return False

    print("[ensure_databases] Building gnomAD ancestry database (this will take 30-60 minutes on first run)...")

    try:
        # Import and run in-process so progress callback works
        sys.path.insert(0, str(_BUILD_ANCESTRY_SCRIPT.parent))
        from build_ancestry_db import main as build_main, set_progress_callback
        if progress_callback:
            set_progress_callback(progress_callback)
        build_main()
        return True
    except Exception as e:
        print(f"[ensure_databases] gnomAD ancestry build failed: {e}")
        return False
