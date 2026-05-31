FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libhts-dev zlib1g-dev libbz2-dev liblzma-dev curl \
    git unzip default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
COPY src/ src/
COPY scripts/ scripts/
COPY tools/setup.sh tools/setup.sh
RUN pip install --no-cache-dir . && \
    if [ ! -f src/data/clinvar_db.json.gz ]; then \
      python scripts/build_clinvar_db.py; \
    else \
      echo "ClinVar DB already present, skipping download"; \
    fi && \
    rm -rf /tmp/variant_summary.txt.gz

# Haplogroup tools (HaploGrep/liftOver/yhaplo) baked into the image; the worker's
# ensure_haplo_tools() startup check then just verifies (re-downloads only if missing).
RUN bash tools/setup.sh

CMD ["python", "-m", "src.main"]
