import httpx

PHARMGKB_API = "https://api.pharmgkb.org/v1/data"
TIMEOUT = 10.0


async def search_pharmgkb(rs_id: str | None) -> list[dict]:
    if not rs_id:
        return []

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            f"{PHARMGKB_API}/clinicalAnnotation",
            params={"location.rsids": rs_id},
        )
        if resp.status_code != 200:
            return []

        data = resp.json()
        return data.get("data", [])
