#!/bin/bash
# Download gnomAD v4.1 exomes (sites only), salva il file full su HD esterno
# Maxtor e crea localmente un subset slim con solo i campi AF essenziali
# (AF + frequenze per popolazione + FAF + filters). Necessario per ACMG BS1.
# NB: niente `set -e` — un singolo cromosoma fallito non deve abortire tutto.
URL_BASE='https://storage.googleapis.com/gcp-public-data--gnomad/release/4.1/vcf/exomes'
ARCHIVE=/media/ruzz/Maxtor/DNA/gnomad/exomes_full
LOCAL_SLIM=/home/ruzz/Code/rr-dna/apps/dna-worker/src/data/gnomad/exomes
mkdir -p "$ARCHIVE" "$LOCAL_SLIM"
cd "$ARCHIVE"

# Campi INFO mantenuti nel subset slim. Sintassi bcftools annotate -x complemento:
# "^INFO/X,INFO/Y" = tieni SOLO X,Y, rimuovi tutto il resto. Il caret va all'inizio
# e ogni campo va prefissato con INFO/. Nomi verificati sull'header gnomAD v4.1.
KEEP_FIELDS='^INFO/AF,INFO/AF_grpmax,INFO/AF_nfe,INFO/AF_afr,INFO/AF_amr,INFO/AF_eas,INFO/AF_sas,INFO/AF_fin,INFO/AF_mid,INFO/AF_remaining,INFO/grpmax,INFO/fafmax_faf95_max,INFO/nhomalt,INFO/allele_type'

for c in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 X Y; do
  FULL=chr${c}.vcf.bgz
  TBI=chr${c}.vcf.bgz.tbi
  SLIM=$LOCAL_SLIM/chr${c}.af.bcf
  SLIM_CSI=$LOCAL_SLIM/chr${c}.af.bcf.csi
  if [ -f "$SLIM" ] && [ $(stat -c %s "$SLIM") -gt 1000 ] && [ -f "$SLIM_CSI" ]; then
    echo "[gnomad] skip chr${c} (slim already exists)"
    continue
  fi
  if [ -f "$FULL" ] && [ $(stat -c %s "$FULL") -gt 1000000 ]; then
    echo "[gnomad] chr${c}: skip download (already on Maxtor)"
  else
    echo "[gnomad] chr${c}: download exomes full..."
    curl -fL --retry 3 --retry-delay 30 --max-time 10800 -o "$FULL" "$URL_BASE/gnomad.exomes.v4.1.sites.chr${c}.vcf.bgz" || { echo "[gnomad] chr${c}: download FAILED"; rm -f "$FULL"; continue; }
    curl -fL --retry 3 --retry-delay 30 --max-time 600 -o "$TBI" "$URL_BASE/gnomad.exomes.v4.1.sites.chr${c}.vcf.bgz.tbi" || { echo "[gnomad] chr${c}: tbi FAILED"; rm -f "$FULL" "$TBI"; continue; }
  fi
  echo "[gnomad] chr${c}: subset slim (only AF fields)..."
  if bcftools annotate -x "$KEEP_FIELDS" --threads 4 -Ob -o "$SLIM" "$FULL" 2> >(tail -3 >&2); then
    bcftools index "$SLIM"
    echo "[gnomad] chr${c} slim: $(stat -c %s "$SLIM" | numfmt --to=iec) (full on Maxtor: $(stat -c %s "$FULL" | numfmt --to=iec))"
  else
    echo "[gnomad] chr${c}: SUBSET FAILED, removing partial output"
    rm -f "$SLIM" "$SLIM_CSI"
    continue
  fi
done
echo "[gnomad] DONE. local slim: $(du -sh "$LOCAL_SLIM" | cut -f1) | archive: $(du -sh "$ARCHIVE" | cut -f1)"
