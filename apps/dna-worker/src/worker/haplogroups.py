"""Compute direct-lineage haplogroups from a GRCh38 (g)VCF, best-effort.

- mtDNA (maternal): HaploGrep on the MT calls (GRCh38 MT == rCRS, compatible).
- Y (paternal): liftOver GRCh38->GRCh37 of the Y SNPs, then yhaplo (ISOGG tree).

External tools live under tools/ (gitignored): haplogrep.jar, liftOver,
hg38ToHg19.chain.gz, and a yhaplo venv. If a tool is missing the corresponding
lineage is skipped (returns None) — haplogroups never block the ingest.
"""

import gzip
import os
import subprocess
import tempfile
from pathlib import Path

_TOOLS_DIR = Path(os.environ.get("HAPLO_TOOLS_DIR", Path(__file__).parent.parent.parent / "tools"))
_HAPLOGREP_JAR = _TOOLS_DIR / "haplogrep.jar"
_LIFTOVER = _TOOLS_DIR / "liftOver"
_CHAIN = _TOOLS_DIR / "hg38ToHg19.chain.gz"
_YHAPLO = _TOOLS_DIR / "yhaplo-venv" / "bin" / "yhaplo"


def parse_haplogrep_output(text: str) -> tuple[str | None, float | None]:
    """Parse HaploGrep classify TSV -> (haplogroup, quality) for the rank-1 row."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 2:
        return None, None
    cols = [c.strip().strip('"') for c in lines[1].split("\t")]
    if len(cols) < 4:
        return None, None
    try:
        quality = float(cols[3])
    except ValueError:
        quality = None
    return (cols[1] or None), quality


def parse_yhaplo_output(text: str) -> tuple[str | None, str | None]:
    """Parse yhaplo haplogroups file -> (haplogroup short-form, long-form detail)."""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None, None
    fields = lines[0].split()
    if len(fields) < 2:
        return None, None
    haplogroup = fields[1]
    detail = fields[3] if len(fields) >= 4 else None
    return haplogroup, detail


def tools_available() -> bool:
    return _HAPLOGREP_JAR.exists() or _YHAPLO.exists()


def _extract(file_path: str, mt_vcf: Path, y_bed: Path) -> None:
    """Single pass over the gVCF: write MT.vcf (header + MT PASS variants) and a
    BED of Y SNP positions (name = carried ALT allele) for liftover."""
    with gzip.open(file_path, "rt", encoding="utf-8", errors="replace") as f, \
         open(mt_vcf, "w") as mt, open(y_bed, "w") as bed:
        for line in f:
            if line.startswith("#"):
                mt.write(line)
                continue
            c = line.split("\t")
            if len(c) < 7:
                continue
            chrom, pos, ref, alt, filt = c[0], c[1], c[3], c[4], c[6]
            if chrom == "MT" and alt != "." and filt == "PASS":
                mt.write(line)
            elif chrom == "Y" and filt == "PASS" and len(ref) == 1 and len(alt) == 1:
                bed.write(f"chrY\t{int(pos) - 1}\t{pos}\t{alt}\n")


def _classify_mt(mt_vcf: Path, workdir: Path) -> dict | None:
    out = workdir / "mt_result.txt"
    subprocess.run(
        ["java", "-jar", str(_HAPLOGREP_JAR), "classify",
         "--in", str(mt_vcf), "--format", "vcf", "--out", str(out)],
        check=True, capture_output=True, text=True, timeout=300,
    )
    hg, quality = parse_haplogrep_output(out.read_text())
    if not hg:
        return None
    return {"haplogroup": hg, "detail": None, "quality": quality, "source": "HaploGrep"}


def _classify_y(y_bed: Path, workdir: Path) -> dict | None:
    lifted = workdir / "y19.bed"
    subprocess.run(
        [str(_LIFTOVER), str(y_bed), str(_CHAIN), str(lifted), str(workdir / "y.unmapped")],
        check=True, capture_output=True, text=True, timeout=300,
    )
    positions, bases = [], []
    for line in lifted.read_text().splitlines():
        p = line.split("\t")
        if len(p) >= 4:
            positions.append(p[2])
            bases.append(p[3])
    if not positions:
        return None
    genos = workdir / "sample.genos.txt"
    genos.write_text("ID\t" + "\t".join(positions) + "\nsample\t" + "\t".join(bases) + "\n")
    subprocess.run(
        [str(_YHAPLO), "-i", str(genos), "-o", str(workdir / "yout")],
        check=True, capture_output=True, text=True, timeout=600,
    )
    hg, detail = parse_yhaplo_output((workdir / "yout" / "haplogroups.sample.txt").read_text())
    if not hg:
        return None
    return {"haplogroup": hg, "detail": detail, "quality": None, "source": "yhaplo"}


def compute_haplogroups(file_path: str) -> dict:
    """Best-effort: return {"MT": {...}, "Y": {...}} for whichever succeeds."""
    if not tools_available():
        print("[haplogroups] tools not found under tools/, skipping", flush=True)
        return {}

    results: dict[str, dict] = {}
    with tempfile.TemporaryDirectory(prefix="haplo_") as tmp:
        workdir = Path(tmp)
        mt_vcf, y_bed = workdir / "MT.vcf", workdir / "y38.bed"
        _extract(file_path, mt_vcf, y_bed)

        if _HAPLOGREP_JAR.exists():
            try:
                mt = _classify_mt(mt_vcf, workdir)
                if mt:
                    results["MT"] = mt
            except Exception as e:
                print(f"[haplogroups] mtDNA failed: {e}", flush=True)

        if _YHAPLO.exists() and _LIFTOVER.exists() and _CHAIN.exists():
            try:
                y = _classify_y(y_bed, workdir)
                if y:
                    results["Y"] = y
            except Exception as e:
                print(f"[haplogroups] Y failed: {e}", flush=True)

    return results
