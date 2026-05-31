import os
from pathlib import Path

_env_file = Path(__file__).parent.parent / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://rr:rr@localhost:5432/rr_dna")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
API_PORT = int(os.environ.get("API_PORT", "8000"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "1000"))
