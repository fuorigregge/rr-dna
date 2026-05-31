import asyncio
import json
import redis
from bullmq import Worker
from src.config import REDIS_URL
from src.worker.jobs import JOB_VCF_PARSE, JOB_VCF_ANNOTATE
from src.worker.vcf_parser import parse_vcf
from src.worker.annotator import annotate_variants
from src.db.connection import get_connection
from src.db.queries import update_vcf_file

_redis = redis.from_url(REDIS_URL)


PROGRESS_TTL = 3600  # 1 hour

def set_progress(vcf_file_id: str, step: str, percentage: float, current_batch: int = 0, total_batches: int = 0):
    _redis.set(f"vcf:{vcf_file_id}:progress", json.dumps({
        "status": "PROCESSING",
        "step": step,
        "percentage": round(percentage, 1),
        "currentBatch": current_batch,
        "totalBatches": total_batches,
    }), ex=PROGRESS_TTL)


async def process_job(job, token):
    job_name = job.name
    data = job.data

    try:
        if job_name == JOB_VCF_PARSE:
            await handle_parse(data)
        elif job_name == JOB_VCF_ANNOTATE:
            await handle_annotate(data)
    except Exception as e:
        print(f"Job {job_name} failed: {e}")
        vcf_file_id = data.get("vcfFileId")
        if vcf_file_id:
            with get_connection() as conn:
                update_vcf_file(conn, vcf_file_id, status="FAILED")
                conn.commit()
            set_progress(vcf_file_id, "failed", 0)
        raise


async def handle_parse(data: dict):
    vcf_file_id = data["vcfFileId"]
    file_path = data["filePath"]
    ancestry_mode = data.get("ancestryMode", "none")

    set_progress(vcf_file_id, "parsing", 0)

    estimated_total = data.get("estimatedVariants", 5_000_000)

    def on_progress(count):
        pct = min(60, (count / estimated_total) * 100)
        set_progress(vcf_file_id, "parsing", pct)

    # Run the blocking parse in a worker thread so the asyncio event loop stays
    # free to renew the BullMQ job lock. A WGS parse can exceed lockDuration; if
    # the loop is blocked the lock expires, the job is marked stalled and
    # reprocessed, duplicating every variant (Variant has no coordinate unique key).
    result = await asyncio.to_thread(parse_vcf, vcf_file_id, file_path, on_progress)

    # If gnomAD ancestry requested, build DB if needed
    if ancestry_mode == "gnomad":
        from src.data.ensure_databases import ancestry_gnomad_exists, build_ancestry_gnomad

        if not ancestry_gnomad_exists():
            set_progress(vcf_file_id, "download database gnomAD ancestry (prima volta, ~30-60 min)", 62)
            print(f"[consumer] Building gnomAD ancestry DB for first time...", flush=True)

            def on_ancestry_build(msg: str):
                set_progress(vcf_file_id, msg, 65)

            # Offloaded to a thread like parse/annotate: this download runs for HOURS
            # and would otherwise block the event loop, expiring the BullMQ lock ->
            # job stalls -> reprocessed -> duplicated variants.
            success = await asyncio.to_thread(build_ancestry_gnomad, on_ancestry_build)
            if success:
                from src.data.clinvar_loader import reload_ancestry_gnomad
                reload_ancestry_gnomad()
                print(f"[consumer] gnomAD ancestry DB loaded", flush=True)
            else:
                print(f"[consumer] gnomAD ancestry DB build failed, continuing without", flush=True)
                ancestry_mode = "none"
        else:
            from src.data.clinvar_loader import reload_ancestry_gnomad
            reload_ancestry_gnomad()
            print(f"[consumer] gnomAD ancestry DB loaded", flush=True)

    set_progress(vcf_file_id, "annotating", 70)

    def on_annotate_progress(current, total):
        pct = 70 + (current / max(total, 1)) * 25
        set_progress(vcf_file_id, "annotating", pct)

    def _run_annotation():
        with get_connection() as conn:
            return annotate_variants(
                conn, vcf_file_id,
                progress_callback=on_annotate_progress,
                ancestry_mode=ancestry_mode,
            )

    # Offloaded to a thread for the same lock-renewal reason as the parse step above.
    annotation_stats = await asyncio.to_thread(_run_annotation)

    # Direct-lineage haplogroups (mtDNA + Y) — best-effort, must never block the ingest.
    def _run_haplogroups():
        from src.worker.haplogroups import compute_haplogroups
        from src.db.queries import upsert_haplogroup
        res = compute_haplogroups(file_path)
        if res:
            with get_connection() as conn:
                for lineage, h in res.items():
                    upsert_haplogroup(conn, vcf_file_id, lineage, h["haplogroup"],
                                      h.get("detail"), h.get("quality"), h.get("source"))
                conn.commit()
        return res

    set_progress(vcf_file_id, "haplogroups", 97)
    try:
        haplo = await asyncio.to_thread(_run_haplogroups)
        print(f"Haplogroups: {haplo}", flush=True)
    except Exception as e:
        print(f"[consumer] haplogroups skipped: {e}", flush=True)

    with get_connection() as conn:
        update_vcf_file(conn, vcf_file_id, status="COMPLETED")
        conn.commit()

    set_progress(vcf_file_id, "completed", 100)

    ancestry_info = f"{annotation_stats['ancestry_markers']} ancestry (ref_db)"
    if ancestry_mode == "gnomad":
        ancestry_info += f", {annotation_stats['ancestry_gnomad']} ancestry (gnomAD)"

    print(
        f"Parsed {result['total']} variants ({result['snp']} SNP, {result['indel']} indel, "
        f"{result.get('rsid_resolved', 0)} rsID resolved). "
        f"Annotated: {annotation_stats['total_annotated']} variants, "
        f"{annotation_stats['disease_risks']} disease risks, "
        f"{annotation_stats['pharmacogenomics']} pharma, "
        f"{annotation_stats['carrier_status']} carrier, "
        f"{ancestry_info}, "
        f"{annotation_stats['phenotype_traits']} traits",
        flush=True,
    )


async def handle_annotate(data: dict):
    """Re-annotate a VCF file's variants using the local reference database."""
    vcf_file_id = data.get("vcfFileId", "")
    set_progress(vcf_file_id, "annotating", 0)

    def _run_annotation():
        with get_connection() as conn:
            return annotate_variants(conn, vcf_file_id)

    stats = await asyncio.to_thread(_run_annotation)

    set_progress(vcf_file_id, "completed", 100)
    print(f"Re-annotated vcf {vcf_file_id}: {stats}", flush=True)


def _parse_redis_url(url: str) -> dict:
    """Parse Redis URL into host/port/password/db for bullmq Worker."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 6379,
        **({"password": parsed.password} if parsed.password else {}),
        "db": int(parsed.path.lstrip("/") or 0),
    }


async def start_consumer():
    opts = _parse_redis_url(REDIS_URL)
    worker = Worker("vcf", process_job, {
        "connection": opts,
        "lockDuration": 600_000,      # 10 min lock (VCF parsing can take minutes)
        "stalledInterval": 300_000,   # check stalled every 5 min
    })
    print(f"BullMQ worker listening on queue 'vcf' (redis: {opts['host']}:{opts['port']})")

    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        await worker.close()
