"""Backfill dei PRS (PrsResult) per un VCF già processato, senza ri-upload.

Riscansiona il gVCF e ricalcola TUTTI gli score PGS caricati, facendo upsert
idempotente su PrsResult. Utile dopo aver aggiunto nuovi score a PGS_SCORES o
dopo aver rigenerato la calibrazione empirica (pgs_reference.json).

Uso:
    DATABASE_URL=postgresql://rr:rr@localhost:5432/rr_dna \\
        uv run python -m scripts.backfill_pgs [vcfFileId]

Se vcfFileId è omesso usa l'ultimo VcfFile COMPLETED. Il path del file viene
letto dal DB (nessun percorso personale hardcoded qui).
"""
import sys

from cyvcf2 import VCF

from src.db.connection import get_connection
from src.worker.pgs_panel import get_pgs_index, loaded_scores
from src.worker.vcf_parser import _observe_pgs_record, persist_pgs_results


def _resolve(conn, vcf_file_id: str | None):
    with conn.cursor() as cur:
        if vcf_file_id:
            cur.execute('SELECT id, "filePath" FROM "VcfFile" WHERE id=%s', (vcf_file_id,))
        else:
            cur.execute(
                'SELECT id, "filePath" FROM "VcfFile" '
                "WHERE status='COMPLETED' ORDER BY \"createdAt\" DESC LIMIT 1"
            )
        return cur.fetchone()


def main() -> None:
    vcf_file_id = sys.argv[1] if len(sys.argv) > 1 else None
    with get_connection() as conn:
        row = _resolve(conn, vcf_file_id)
        if not row:
            print("nessun VcfFile trovato", file=sys.stderr)
            sys.exit(1)
        vid, path = row
        print(f"[backfill_pgs] {len(loaded_scores())} score caricati")
        print(f"[backfill_pgs] VcfFile {vid}")

        pgs_index = get_pgs_index()
        pgs_obs: dict = {}
        pgs_ref: set = set()
        n = 0
        for record in VCF(path):
            _observe_pgs_record(pgs_obs, pgs_ref, pgs_index, record)
            n += 1
            if n % 2_000_000 == 0:
                print(f"  ...{n:,} record (obs={len(pgs_obs):,} ref={len(pgs_ref):,})")
        print(f"[backfill_pgs] scansionati {n:,} record; obs={len(pgs_obs):,} ref={len(pgs_ref):,}")

        persist_pgs_results(conn, vid, pgs_obs, pgs_ref)
        conn.commit()
        print("[backfill_pgs] PrsResult aggiornati.")


if __name__ == "__main__":
    main()
