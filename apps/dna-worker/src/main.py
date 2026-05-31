import asyncio
import threading
import uvicorn
from src.config import API_PORT


def run_api():
    from src.api.app import app as fastapi_app
    uvicorn.run(fastapi_app, host="0.0.0.0", port=API_PORT)


def main():
    # Ensure ClinVar/PharmGKB databases exist before loading them
    from src.data.ensure_databases import ensure, ensure_haplo_tools, ensure_pgs_catalog
    ensure()
    # Ensure haplogroup tools (HaploGrep/liftOver/yhaplo) are present for the
    # automatic mtDNA/Y step during ingest.
    ensure_haplo_tools()
    # Download configured PGS Catalog scoring files (idempotent).
    ensure_pgs_catalog()

    from src.worker.consumer import start_consumer

    api_thread = threading.Thread(target=run_api, daemon=True)
    api_thread.start()

    print(f"FastAPI running on http://localhost:{API_PORT}")
    print("Starting BullMQ consumer...")

    asyncio.run(start_consumer())


if __name__ == "__main__":
    main()
