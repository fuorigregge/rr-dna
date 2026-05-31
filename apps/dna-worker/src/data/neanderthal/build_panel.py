"""Liftover del pannello tag-SNP introgressi (Vernot & Akey 2016, EUR) da hg19 a
hg38, tenendo solo i SNP arcaico-informativi (base Neanderthal = allele derivato).

Input:  all_tag_snps.EUR.bed (hg19, 1000G phase3) — 16 colonne (vedi readme).
Output: panel_hg38.tsv — chrom, pos(hg38, 1-based), ancestrale, arcaico(derivato),
        eur_freq.  Gestisce lo strand: su strand '-' gli alleli sono complementati.
"""
import sys
from pathlib import Path
from pyliftover import LiftOver
from src.worker.genome_fasta import get_ref_base

HERE = Path(__file__).parent
RAW = "/media/ruzz/Maxtor/DNA/neanderthal/all_tag_snps.EUR.bed"
CHAIN = "/media/ruzz/Maxtor/DNA/neanderthal/hg19ToHg38.over.chain.gz"
OUT = HERE / "panel_hg38.tsv"

COMP = {"A": "T", "T": "A", "C": "G", "G": "C"}


def main():
    lo = LiftOver(CHAIN)
    n_in = n_snv = n_archaic = n_lifted = n_strand_flip = 0
    rows = []
    with open(RAW) as f:
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) < 16:
                continue
            n_in += 1
            chrom, start, anc, der = p[0], int(p[1]), p[3], p[4]
            eur_freq, nean_base = p[10], p[13]
            # solo SNV bi-allelici e arcaico-informativi (Neanderthal porta il derivato)
            if len(anc) != 1 or len(der) != 1 or anc not in COMP or der not in COMP:
                continue
            n_snv += 1
            if nean_base != der:
                continue
            n_archaic += 1
            res = lo.convert_coordinate(chrom, start)  # 0-based
            if not res:
                continue
            n_lifted += 1
            new_chrom, new_pos0, strand = res[0][0], res[0][1], res[0][2]
            a, d = anc, der
            if strand == "-":
                a, d = COMP[anc], COMP[der]
                n_strand_flip += 1
            chrom_clean = new_chrom[3:] if new_chrom.startswith("chr") else new_chrom
            try:
                eur = float(eur_freq)
            except ValueError:
                eur = 0.0
            rows.append((chrom_clean, new_pos0 + 1, a, d, eur))  # 1-based

    # dedup per (chrom,pos) tenendo la prima
    seen = set()
    uniq = []
    for r in rows:
        k = (r[0], r[1])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)

    # polarità via FASTA hg38: la base di riferimento è l'ancestrale o l'arcaica?
    # Se ref==arcaico, un genotipo hom-ref (0/0) conta 2 copie arcaiche.
    n_drop = ref_is_arch = 0
    with open(OUT, "w") as o:
        o.write("chrom\tpos\tancestral\tarchaic\teur_freq\tref_is_archaic\n")
        for c, pos, a, d, eur in uniq:
            ref = get_ref_base(c, pos)
            if ref is None or ref not in (a, d):
                n_drop += 1  # liftover incoerente con la FASTA: scarta (sicurezza)
                continue
            ria = 1 if ref == d else 0
            ref_is_arch += ria
            o.write(f"{c}\t{pos}\t{a}\t{d}\t{eur:.5f}\t{ria}\n")

    written = len(uniq) - n_drop
    print(f"[build] input {n_in:,} | SNV {n_snv:,} | arcaico-informativi {n_archaic:,} | "
          f"liftati {n_lifted:,} | strand-flip {n_strand_flip:,} | unici {len(uniq):,}")
    print(f"[build] scartati per FASTA incoerente {n_drop:,} | scritti {written:,} | "
          f"con ref=arcaico {ref_is_arch:,}")
    print(f"[build] media EUR freq (carico arcaico atteso per allele): "
          f"{sum(r[4] for r in uniq)/len(uniq):.4f}")


if __name__ == "__main__":
    main()
