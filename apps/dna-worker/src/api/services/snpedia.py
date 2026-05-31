import httpx
import re

SNPEDIA_API = "https://bots.snpedia.com/api.php"
TIMEOUT = 15.0


async def search_snpedia(rs_id: str | None) -> list[dict]:
    """Fetch trait information from SNPedia for a given rsID."""
    if not rs_id:
        return []

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Get the wiki page content for this rsID
        resp = await client.get(SNPEDIA_API, params={
            "action": "parse",
            "page": rs_id.capitalize(),
            "prop": "wikitext",
            "format": "json",
        })
        if resp.status_code != 200:
            return []

        data = resp.json()
        wikitext = data.get("parse", {}).get("wikitext", {}).get("*", "")
        if not wikitext:
            return []

        traits = []

        # Extract genotype entries like {{rsnum ... geno1=A ... geno2=A ... summary=... }}
        # and also look for plain text descriptions
        summary_match = re.search(r'\|summary\s*=\s*(.+?)[\n|}]', wikitext)
        if summary_match:
            summary = summary_match.group(1).strip()
            if summary and len(summary) > 10:
                traits.append({
                    "trait": f"SNPedia: {rs_id}",
                    "effect": summary,
                    "source": "SNPedia",
                    "url": f"https://www.snpedia.com/index.php/{rs_id.capitalize()}",
                })

        # Extract genotype-specific info: ((rs12345;A;G)) patterns
        geno_pattern = re.findall(r'\(\(' + rs_id + r'\(([^)]+)\)\)\)', wikitext, re.IGNORECASE)
        if not geno_pattern:
            # Try alternate format
            geno_pages = re.findall(r'\[\[' + rs_id + r'\([^]]+\)\]\]', wikitext, re.IGNORECASE)

        # Also get categories which indicate trait types
        cat_resp = await client.get(SNPEDIA_API, params={
            "action": "query",
            "titles": rs_id.capitalize(),
            "prop": "categories",
            "format": "json",
        })
        if cat_resp.status_code == 200:
            pages = cat_resp.json().get("query", {}).get("pages", {})
            for page in pages.values():
                categories = [c.get("title", "").replace("Category:", "") for c in page.get("categories", [])]
                for cat in categories:
                    if cat.lower() not in ("is a snp", "on chip 23andme v3", "on chip 23andme v4", "on chip 23andme v5"):
                        if not any(t["trait"] == cat for t in traits):
                            traits.append({
                                "trait": cat,
                                "effect": f"Categoria SNPedia per {rs_id}",
                                "source": "SNPedia",
                                "url": f"https://www.snpedia.com/index.php/Category:{cat}",
                            })

    return traits
