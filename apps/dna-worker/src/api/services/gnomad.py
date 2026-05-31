import httpx

GNOMAD_API = "https://gnomad.broadinstitute.org/api"
TIMEOUT = 10.0


async def query_gnomad(chromosome: str, position: int, ref: str, alt: str) -> dict | None:
    query = """
    query GnomadVariant($variantId: String!, $dataset: DatasetId!) {
      variant(variantId: $variantId, dataset: $dataset) {
        variant_id
        genome {
          ac
          an
          af
          populations {
            id
            ac
            an
            af
          }
        }
      }
    }
    """
    chrom = chromosome.replace("chr", "")
    variant_id = f"{chrom}-{position}-{ref}-{alt}"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            GNOMAD_API,
            json={
                "query": query,
                "variables": {"variantId": variant_id, "dataset": "gnomad_r4"},
            },
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        return data.get("data", {}).get("variant")
