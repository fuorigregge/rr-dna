import httpx

CLINVAR_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
TIMEOUT = 10.0


async def search_clinvar(rs_id: str | None = None, chromosome: str | None = None, position: int | None = None) -> dict | None:
    if not rs_id:
        return None

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        search_resp = await client.get(
            f"{CLINVAR_BASE}/esearch.fcgi",
            params={"db": "clinvar", "term": rs_id, "retmode": "json"},
        )
        if search_resp.status_code != 200:
            return None

        data = search_resp.json()
        id_list = data.get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return None

        summary_resp = await client.get(
            f"{CLINVAR_BASE}/esummary.fcgi",
            params={"db": "clinvar", "id": ",".join(id_list[:5]), "retmode": "json"},
        )
        if summary_resp.status_code != 200:
            return None

        return summary_resp.json().get("result", {})
