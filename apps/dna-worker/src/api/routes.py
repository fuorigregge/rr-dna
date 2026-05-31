from fastapi import APIRouter
from pydantic import BaseModel
from src.api.services.clinvar import search_clinvar
from src.api.services.gnomad import query_gnomad
from src.api.services.pharmgkb import search_pharmgkb
from src.api.services.snpedia import search_snpedia
from src.db.connection import get_connection
from src.db.queries import insert_annotation, insert_phenotype_trait, delete_annotations_by_source

router = APIRouter()


class EnrichRequest(BaseModel):
    variantId: str
    chromosome: str
    position: int
    ref: str
    alt: str
    rsId: str | None = None


class EnrichResponse(BaseModel):
    clinvar: dict | None = None
    gnomad: dict | None = None
    pharmgkb: list[dict] = []


def _extract_clinvar_summary(data: dict) -> tuple[str | None, str | None]:
    """Extract gene and consequence from ClinVar esummary response."""
    for uid, entry in data.items():
        if isinstance(entry, dict) and "genes" in entry:
            genes = entry.get("genes", [])
            gene = genes[0].get("symbol") if genes else None
            sig = entry.get("clinical_significance", {}).get("description")
            return gene, sig
    return None, None


@router.post("/enrich", response_model=EnrichResponse)
async def enrich_variant(req: EnrichRequest):
    clinvar_data = await search_clinvar(rs_id=req.rsId)
    gnomad_data = await query_gnomad(req.chromosome, req.position, req.ref, req.alt)
    pharmgkb_data = await search_pharmgkb(req.rsId)

    with get_connection() as conn:
        if clinvar_data:
            delete_annotations_by_source(conn, req.variantId, "CLINVAR")
            gene, consequence = _extract_clinvar_summary(clinvar_data)
            insert_annotation(conn, req.variantId, "CLINVAR", gene, consequence, None, clinvar_data)
        if gnomad_data:
            delete_annotations_by_source(conn, req.variantId, "GNOMAD")
            genome = gnomad_data.get("genome", {})
            af = genome.get("af")
            consequence = f"AF globale: {af:.4f}" if af is not None else None
            insert_annotation(conn, req.variantId, "GNOMAD", None, consequence, None, gnomad_data)
        if pharmgkb_data:
            delete_annotations_by_source(conn, req.variantId, "PHARMGKB")
            first = pharmgkb_data[0] if pharmgkb_data else {}
            gene = None
            related_genes = first.get("relatedGenes", [])
            if related_genes:
                gene = related_genes[0].get("symbol")
            n = len(pharmgkb_data)
            consequence = f"{n} annotazione/i clinica/e" if n else None
            insert_annotation(conn, req.variantId, "PHARMGKB", gene, consequence, None, {"annotations": pharmgkb_data})
        conn.commit()

    return EnrichResponse(clinvar=clinvar_data, gnomad=gnomad_data, pharmgkb=pharmgkb_data)


class EnrichTraitsRequest(BaseModel):
    variantId: str
    rsId: str | None = None


class TraitResult(BaseModel):
    trait: str
    effect: str | None = None
    source: str
    url: str | None = None


class EnrichTraitsResponse(BaseModel):
    traits: list[TraitResult] = []
    saved: int = 0


@router.post("/enrich-traits", response_model=EnrichTraitsResponse)
async def enrich_traits(req: EnrichTraitsRequest):
    snpedia_traits = await search_snpedia(req.rsId)

    saved = 0
    if snpedia_traits:
        with get_connection() as conn:
            for t in snpedia_traits:
                insert_phenotype_trait(
                    conn, req.variantId, t["trait"],
                    t.get("effect"), None, t["source"],
                    {"description": t.get("effect"), "links": {"SNPedia": t.get("url", "")}},
                )
                saved += 1
            conn.commit()

    return EnrichTraitsResponse(
        traits=[TraitResult(**t) for t in snpedia_traits],
        saved=saved,
    )


@router.get("/health")
async def health():
    return {"status": "ok"}
