#!/usr/bin/env python3
"""
Build-time ETL: downloads gnomAD v4 exome sites VCFs per-chromosome,
extracts per-population allele frequencies keyed by rsID,
and compresses into a compact JSON lookup database.

Output: src/data/ancestry_gnomad_db.json.gz (~30-60MB)
Downloads ~2-3 GB per chromosome (deleted after processing).
"""

import gzip
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

GNOMAD_VERSION = os.environ.get("GNOMAD_VERSION", "4.1")
GNOMAD_BASE_URL = os.environ.get(
    "GNOMAD_BASE_URL",
    f"https://storage.googleapis.com/gcp-public-data--gnomad/release/{GNOMAD_VERSION}/vcf/exomes",
)
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "ancestry_gnomad_db.json.gz"
DOWNLOAD_DIR = Path("/tmp/gnomad_ancestry")

CHROMOSOMES = [str(i) for i in range(1, 23)] + ["X", "Y"]

# Top-level gnomAD population IDs we want to extract
TARGET_POPS = {"afr", "amr", "asj", "eas", "fin", "mid", "nfe", "sas"}

# Minimum allele frequency to consider (skip ultra-rare variants)
MIN_AF = 0.001

# Progress callback type
_progress_cb = None


def set_progress_callback(cb):
    global _progress_cb
    _progress_cb = cb


def log(msg: str):
    print(f"[ancestry_db] {msg}", flush=True)
    if _progress_cb:
        _progress_cb(msg)


def download_chromosome(chrom: str) -> Path:
    """Download gnomAD exome sites VCF for one chromosome."""
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"gnomad.exomes.v{GNOMAD_VERSION}.sites.chr{chrom}.vcf.bgz"
    url = f"{GNOMAD_BASE_URL}/{filename}"
    dest = DOWNLOAD_DIR / filename

    if dest.exists():
        size_mb = dest.stat().st_size / (1024 * 1024)
        log(f"  chr{chrom}: usando cache ({size_mb:.0f} MB)")
        return dest

    log(f"  chr{chrom}: download da gnomAD...")

    start = time.time()
    last_report = [0.0]

    def progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        now = time.time()
        if total_size > 0 and (now - last_report[0]) > 5:
            pct = min(100, downloaded * 100 // total_size)
            mb = downloaded / (1024 * 1024)
            elapsed = now - start
            speed = mb / elapsed if elapsed > 0 else 0
            log(f"  chr{chrom}: {mb:.0f} MB ({pct}%) - {speed:.1f} MB/s")
            last_report[0] = now

    try:
        urllib.request.urlretrieve(url, dest, reporthook=progress)
    except Exception as e:
        log(f"  chr{chrom}: ERRORE download - {e}")
        if dest.exists():
            dest.unlink()
        raise

    elapsed = time.time() - start
    size_mb = dest.stat().st_size / (1024 * 1024)
    log(f"  chr{chrom}: completato ({size_mb:.0f} MB in {elapsed:.0f}s)")
    return dest


def parse_info_field(info: str, target_fields: set[str]) -> dict[str, str]:
    """Parse VCF INFO field, extracting only target fields."""
    result = {}
    for part in info.split(";"):
        if "=" not in part:
            continue
        key, _, val = part.partition("=")
        if key in target_fields:
            result[key] = val
    return result


def process_chromosome(chrom: str, vcf_path: Path, db: dict) -> dict:
    """Stream-process one chromosome VCF, extracting rsID -> pop frequencies."""
    stats = {"total_lines": 0, "with_rsid": 0, "kept": 0, "skipped_low_af": 0}

    # Build set of INFO fields we care about
    af_fields = {f"AF_{pop}" for pop in TARGET_POPS}

    # bgzipped VCFs are gzip-compatible for sequential reading
    opener = gzip.open if str(vcf_path).endswith((".gz", ".bgz")) else open

    with opener(vcf_path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("#"):
                continue

            stats["total_lines"] += 1

            if stats["total_lines"] % 1_000_000 == 0:
                log(f"  chr{chrom}: {stats['total_lines']:,} varianti processate, {stats['kept']:,} tenute")

            cols = line.split("\t", 8)  # Only need first 8 columns
            if len(cols) < 8:
                continue

            # Column 2 (0-indexed) is ID (rsID)
            rs_id = cols[2]
            if rs_id == "." or not rs_id.startswith("rs"):
                continue

            stats["with_rsid"] += 1

            # Parse INFO field for population AFs
            info_data = parse_info_field(cols[7], af_fields)
            if not info_data:
                continue

            # Extract population frequencies
            freqs = {}
            for pop in TARGET_POPS:
                af_key = f"AF_{pop}"
                if af_key in info_data:
                    val = info_data[af_key]
                    # Handle multi-allelic: take first value
                    if "," in val:
                        val = val.split(",")[0]
                    try:
                        af = float(val)
                        if af >= MIN_AF:
                            freqs[pop] = round(af, 6)
                    except (ValueError, TypeError):
                        continue

            if not freqs:
                stats["skipped_low_af"] += 1
                continue

            # Store compact entry (overwrite if duplicate rsID — keep last seen)
            db[rs_id] = freqs
            stats["kept"] += 1

    return stats


def main():
    log("=== gnomAD Ancestry Database Builder ===")
    log(f"Versione gnomAD: v{GNOMAD_VERSION}")
    log(f"Popolazioni: {', '.join(sorted(TARGET_POPS))}")
    log(f"Output: {OUTPUT_PATH}")
    log("")

    db: dict[str, dict] = {}
    total_stats = {
        "total_lines": 0, "with_rsid": 0, "kept": 0,
        "skipped_low_af": 0, "chromosomes_ok": 0, "chromosomes_failed": 0,
    }

    start_time = time.time()

    for i, chrom in enumerate(CHROMOSOMES, 1):
        log(f"--- Cromosoma {chrom} ({i}/{len(CHROMOSOMES)}) ---")
        chrom_start = time.time()

        try:
            vcf_path = download_chromosome(chrom)
            stats = process_chromosome(chrom, vcf_path, db)

            for k in ("total_lines", "with_rsid", "kept", "skipped_low_af"):
                total_stats[k] += stats[k]
            total_stats["chromosomes_ok"] += 1

            log(f"  chr{chrom}: {stats['total_lines']:,} varianti, {stats['with_rsid']:,} con rsID, {stats['kept']:,} tenute")

            # Delete downloaded file to free disk space
            vcf_path.unlink(missing_ok=True)
            log(f"  chr{chrom}: file temporaneo cancellato")

        except Exception as e:
            log(f"  chr{chrom}: ERRORE - {e}")
            total_stats["chromosomes_failed"] += 1
            continue

        chrom_elapsed = time.time() - chrom_start
        log(f"  chr{chrom}: completato in {chrom_elapsed:.0f}s (DB totale: {len(db):,} rsID)")
        log("")

    # Write output
    log("--- Salvataggio database ---")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with gzip.open(OUTPUT_PATH, "wt", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    elapsed = time.time() - start_time

    log("")
    log("=== Completato ===")
    log(f"  Tempo totale: {elapsed / 60:.1f} minuti")
    log(f"  Cromosomi OK: {total_stats['chromosomes_ok']}/{len(CHROMOSOMES)}")
    if total_stats["chromosomes_failed"]:
        log(f"  Cromosomi falliti: {total_stats['chromosomes_failed']}")
    log(f"  Varianti processate: {total_stats['total_lines']:,}")
    log(f"  Con rsID: {total_stats['with_rsid']:,}")
    log(f"  Nel database finale: {len(db):,}")
    log(f"  File output: {size_mb:.1f} MB compressi")

    # Cleanup download directory
    if DOWNLOAD_DIR.exists():
        import shutil
        shutil.rmtree(DOWNLOAD_DIR, ignore_errors=True)
        log("  Directory temporanea rimossa")

    log("Done!")


if __name__ == "__main__":
    main()
