"""Backfill dei PharmacoResult per un VCF già processato, senza ri-upload.

Riscansiona il gVCF, cattura i genotipi ai SNP farmacogene e ricalcola i
diplotipi/fenotipi (upsert idempotente). Utile dopo aver aggiunto geni a
PHARMACOGENES.

Uso:
    DATABASE_URL=postgresql://rr:rr@localhost:5432/rr_dna \\
        uv run python -m scripts.backfill_pharma [vcfFileId]

Se vcfFileId è omesso usa l'ultimo VcfFile COMPLETED. Il path è letto dal DB.
"""
import sys

from cyvcf2 import VCF

from src.db.connection import get_connection
from src.worker.pharmacogenes import PHARMACOGENES
from src.worker.vcf_parser import _observe_pharmaco_record, persist_pharmaco_results


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
        print(f"[backfill_pharma] {len(PHARMACOGENES)} geni nel pannello")
        print(f"[backfill_pharma] VcfFile {vid}")

        pharmaco_obs: dict = {}
        n = 0
        for record in VCF(path):
            _observe_pharmaco_record(pharmaco_obs, record)
            n += 1
            if n % 4_000_000 == 0:
                print(f"  ...{n:,} record (catturati {len(pharmaco_obs)} SNP)")
        print(f"[backfill_pharma] scansionati {n:,} record; SNP catturati: {len(pharmaco_obs)}")

        persist_pharmaco_results(conn, vid, pharmaco_obs)
        conn.commit()
        print("[backfill_pharma] PharmacoResult aggiornati.")


if __name__ == "__main__":
    main()
