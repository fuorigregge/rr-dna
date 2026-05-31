#!/usr/bin/env bash
# Idempotent setup of the haplogroup tools used by src/worker/haplogroups.py.
# Downloads only what's missing, into this directory (tools/). Safe to re-run.
#
#   mtDNA: HaploGrep 2.4 (Java jar)         -> haplogrep.jar
#   Y:     UCSC liftOver + hg38->hg19 chain -> liftOver, hg38ToHg19.chain.gz
#   Y:     yhaplo (Python, ISOGG tree)      -> yhaplo-venv/
#
# Requires: curl, unzip, java (run-time), python3.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ ! -f haplogrep.jar ]; then
  echo "[setup-haplo] downloading HaploGrep..."
  curl -sL -f -o haplogrep.zip "https://github.com/seppinho/haplogrep-cmd/releases/download/v2.4.0/haplogrep.zip"
  unzip -o -q haplogrep.zip haplogrep.jar
  rm -f haplogrep.zip
fi

if [ ! -f liftOver ]; then
  echo "[setup-haplo] downloading liftOver..."
  curl -sL -f -o liftOver "https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/liftOver"
  chmod +x liftOver
fi

if [ ! -f hg38ToHg19.chain.gz ]; then
  echo "[setup-haplo] downloading hg38->hg19 chain..."
  curl -sL -f -o hg38ToHg19.chain.gz "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/liftOver/hg38ToHg19.over.chain.gz"
fi

if [ ! -x yhaplo-venv/bin/yhaplo ]; then
  echo "[setup-haplo] creating yhaplo venv..."
  python3 -m venv yhaplo-venv
  yhaplo-venv/bin/pip install -q --disable-pip-version-check "git+https://github.com/23andMe/yhaplo.git"
fi

echo "[setup-haplo] haplogroup tools ready in $DIR"
