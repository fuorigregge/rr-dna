"""Backfill dei TraitPanelResult per un VCF già processato, senza ri-upload.

Riscansiona il gVCF, risolve lo stato di ogni SNP del pannello tratti e fa
upsert idempotente. Utile dopo aver aggiunto voci a TRAIT_PANEL.

Uso:
    DATABASE_URL=postgresql://rr:rr@localhost:5432/rr_dna \\
        uv run python -m scripts.backfill_traits [vcfFileId]
"""
import sys

from cyvcf2 import VCF

from src.db.connection import get_connection
from src.worker.trait_panel import TRAIT_PANEL
from src.worker.vcf_parser import _observe_panel_record, persist_panel_results


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
        print(f"[backfill_traits] {len(TRAIT_PANEL)} voci nel pannello")
        print(f"[backfill_traits] VcfFile {vid}")

        panel_results: dict = {}
        n = 0
        for record in VCF(path):
            _observe_panel_record(panel_results, record)
            n += 1
            if n % 4_000_000 == 0:
                print(f"  ...{n:,} record (risolti {len(panel_results)} SNP)")
        print(f"[backfill_traits] scansionati {n:,} record; SNP risolti: {len(panel_results)}")

        persist_panel_results(conn, vid, panel_results)
        conn.commit()
        print("[backfill_traits] TraitPanelResult aggiornati.")


if __name__ == "__main__":
    main()
