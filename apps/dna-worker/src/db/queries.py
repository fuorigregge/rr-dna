import json
import psycopg


def insert_variants_batch(conn: psycopg.Connection, vcf_file_id: str, variants: list[dict]):
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO "Variant" (id, "vcfFileId", chromosome, position, "rsId", ref, alt, quality, filter, genotype, zygosity, depth, vaf, "lowConfidence")
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT DO NOTHING""",
            [
                (
                    v["id"], vcf_file_id, v["chromosome"], v["position"],
                    v.get("rs_id"), v["ref"], v["alt"], v.get("quality"),
                    v.get("filter"), v.get("genotype"), v.get("zygosity"),
                    v.get("depth"), v.get("vaf"), v.get("low_confidence", False),
                )
                for v in variants
            ],
        )


def update_vcf_file(conn: psycopg.Connection, vcf_file_id: str, **fields):
    """Update VcfFile fields dynamically. Accepted keys: status, totalVariants, snpCount, indelCount."""
    col_map = {
        "status": "status",
        "totalVariants": '"totalVariants"',
        "snpCount": '"snpCount"',
        "indelCount": '"indelCount"',
    }
    sets = [f'{col_map[k]} = %s' for k in fields if k in col_map]
    vals = [fields[k] for k in fields if k in col_map]
    if not sets:
        return
    sets.append('"updatedAt" = NOW()')
    with conn.cursor() as cur:
        cur.execute(f'UPDATE "VcfFile" SET {", ".join(sets)} WHERE id = %s', (*vals, vcf_file_id))


def upsert_chromosome_summary(conn: psycopg.Connection, vcf_file_id: str, chromosome: str, stats: dict):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "ChromosomeSummary" (id, "vcfFileId", chromosome, "variantCount", "snpCount", "indelCount", "pathogenicCount", "pharmacogenomicCount")
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, 0, 0)
               ON CONFLICT ("vcfFileId", chromosome)
               DO UPDATE SET "variantCount" = EXCLUDED."variantCount", "snpCount" = EXCLUDED."snpCount", "indelCount" = EXCLUDED."indelCount"
            """,
            (vcf_file_id, chromosome, stats["variant_count"], stats["snp_count"], stats["indel_count"]),
        )


def upsert_trait_panel_result(
    conn: psycopg.Connection, vcf_file_id: str, rs_id: str, gene: str | None, trait: str,
    category: str | None, state: str, genotype: str | None, zygosity: str | None,
    interpretation: str | None, confidence: str | None, metadata: dict | None = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "TraitPanelResult"
                 (id, "vcfFileId", "rsId", gene, trait, category, state, genotype, zygosity, interpretation, confidence, metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s::"TraitCategory", %s::"TraitPanelState", %s, %s::"Zygosity", %s, %s, %s)
               ON CONFLICT ("vcfFileId", "rsId") DO UPDATE SET
                 gene = EXCLUDED.gene, trait = EXCLUDED.trait, category = EXCLUDED.category,
                 state = EXCLUDED.state, genotype = EXCLUDED.genotype, zygosity = EXCLUDED.zygosity,
                 interpretation = EXCLUDED.interpretation, confidence = EXCLUDED.confidence, metadata = EXCLUDED.metadata
            """,
            (vcf_file_id, rs_id, gene, trait, category, state, genotype, zygosity,
             interpretation, confidence, json.dumps(metadata) if metadata else None),
        )


def upsert_haplogroup(
    conn: psycopg.Connection, vcf_file_id: str, lineage: str, haplogroup: str,
    detail: str | None, quality: float | None, source: str | None,
):
    # On conflict update only the computed fields, preserving any curated interpretation.
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "Haplogroup" (id, "vcfFileId", lineage, haplogroup, detail, quality, source)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s)
               ON CONFLICT ("vcfFileId", lineage) DO UPDATE SET
                 haplogroup = EXCLUDED.haplogroup, detail = EXCLUDED.detail,
                 quality = EXCLUDED.quality, source = EXCLUDED.source
            """,
            (vcf_file_id, lineage, haplogroup, detail, quality, source),
        )


def upsert_pharmaco_result(
    conn: psycopg.Connection, vcf_file_id: str, gene: str, diplotype: str | None,
    phenotype: str | None, drugs: str | None, confidence: str | None = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "PharmacoResult" (id, "vcfFileId", gene, diplotype, phenotype, drugs, confidence)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s)
               ON CONFLICT ("vcfFileId", gene) DO UPDATE SET
                 diplotype = EXCLUDED.diplotype, phenotype = EXCLUDED.phenotype,
                 drugs = EXCLUDED.drugs, confidence = EXCLUDED.confidence
            """,
            (vcf_file_id, gene, diplotype, phenotype, drugs, confidence),
        )


def upsert_prs_result(
    conn: psycopg.Connection, vcf_file_id: str, trait_key: str, trait: str, label: str,
    description: str | None, raw_score: float, expected_mean: float, expected_sd: float,
    z_score: float, percentile: float, markers_used: int, markers_total: int,
    interpretation: str | None, metadata: dict | None = None,
    pgs_id: str | None = None, source: str | None = None,
    calibration_source: str | None = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "PrsResult"
                 (id, "vcfFileId", "traitKey", trait, label, description, "pgsId", source, "calibrationSource",
                  "rawScore", "expectedMean", "expectedSd", "zScore", percentile,
                  "markersUsed", "markersTotal", interpretation, metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT ("vcfFileId", "traitKey") DO UPDATE SET
                 trait = EXCLUDED.trait, label = EXCLUDED.label, description = EXCLUDED.description,
                 "pgsId" = EXCLUDED."pgsId", source = EXCLUDED.source, "calibrationSource" = EXCLUDED."calibrationSource",
                 "rawScore" = EXCLUDED."rawScore", "expectedMean" = EXCLUDED."expectedMean",
                 "expectedSd" = EXCLUDED."expectedSd", "zScore" = EXCLUDED."zScore",
                 percentile = EXCLUDED.percentile, "markersUsed" = EXCLUDED."markersUsed",
                 "markersTotal" = EXCLUDED."markersTotal", interpretation = EXCLUDED.interpretation,
                 metadata = EXCLUDED.metadata
            """,
            (vcf_file_id, trait_key, trait, label, description, pgs_id, source, calibration_source,
             raw_score, expected_mean, expected_sd, z_score, percentile,
             markers_used, markers_total, interpretation,
             json.dumps(metadata) if metadata else None),
        )


def upsert_acmg_result(
    conn: psycopg.Connection, vcf_file_id: str, rs_id: str, gene: str, variant_name: str,
    condition: str, inheritance: str | None, state: str, genotype: str | None,
    zygosity: str | None, interpretation: str | None, confidence: str | None,
    metadata: dict | None = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "AcmgResult"
                 (id, "vcfFileId", "rsId", gene, "variantName", condition, inheritance, state, genotype, zygosity, interpretation, confidence, metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s::"Zygosity", %s, %s, %s)
               ON CONFLICT ("vcfFileId", "rsId") DO UPDATE SET
                 gene = EXCLUDED.gene, "variantName" = EXCLUDED."variantName", condition = EXCLUDED.condition,
                 inheritance = EXCLUDED.inheritance, state = EXCLUDED.state, genotype = EXCLUDED.genotype,
                 zygosity = EXCLUDED.zygosity, interpretation = EXCLUDED.interpretation,
                 confidence = EXCLUDED.confidence, metadata = EXCLUDED.metadata
            """,
            (vcf_file_id, rs_id, gene, variant_name, condition, inheritance, state, genotype,
             zygosity, interpretation, confidence, json.dumps(metadata) if metadata else None),
        )


def upsert_carrier_result(
    conn: psycopg.Connection, vcf_file_id: str, rs_id: str, gene: str, variant_name: str,
    condition: str, inheritance: str | None, state: str, genotype: str | None,
    zygosity: str | None, interpretation: str | None, confidence: str | None,
    metadata: dict | None = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "CarrierPanelResult"
                 (id, "vcfFileId", "rsId", gene, "variantName", condition, inheritance, state, genotype, zygosity, interpretation, confidence, metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s::"Zygosity", %s, %s, %s)
               ON CONFLICT ("vcfFileId", "rsId") DO UPDATE SET
                 gene = EXCLUDED.gene, "variantName" = EXCLUDED."variantName", condition = EXCLUDED.condition,
                 inheritance = EXCLUDED.inheritance, state = EXCLUDED.state, genotype = EXCLUDED.genotype,
                 zygosity = EXCLUDED.zygosity, interpretation = EXCLUDED.interpretation,
                 confidence = EXCLUDED.confidence, metadata = EXCLUDED.metadata
            """,
            (vcf_file_id, rs_id, gene, variant_name, condition, inheritance, state, genotype,
             zygosity, interpretation, confidence, json.dumps(metadata) if metadata else None),
        )


def delete_annotations_by_source(conn: psycopg.Connection, variant_id: str, source: str):
    """Remove existing annotations for a variant+source before re-enriching."""
    with conn.cursor() as cur:
        cur.execute(
            """DELETE FROM "VariantAnnotation" WHERE "variantId" = %s AND source = %s""",
            (variant_id, source),
        )


def insert_annotation(conn: psycopg.Connection, variant_id: str, source: str, gene: str | None, consequence: str | None, impact: str | None, data: dict | None):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "VariantAnnotation" (id, "variantId", source, gene, consequence, impact, data)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s)""",
            (variant_id, source, gene, consequence, impact, json.dumps(data) if data else None),
        )


def insert_disease_risk(conn: psycopg.Connection, variant_id: str, disease: str, significance: str, source: str, evidence_level: str | None, metadata: dict | None = None):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "DiseaseRisk" (id, "variantId", disease, significance, source, "evidenceLevel", metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s)""",
            (variant_id, disease, significance, source, evidence_level, json.dumps(metadata) if metadata else None),
        )


def insert_pharmacogenomics(conn: psycopg.Connection, variant_id: str, drug: str, effect: str | None, metabolizer_status: str | None, source: str, evidence_level: str | None, metadata: dict | None = None):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "Pharmacogenomics" (id, "variantId", drug, effect, "metabolizerStatus", source, "evidenceLevel", metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s)""",
            (variant_id, drug, effect, metabolizer_status, source, evidence_level, json.dumps(metadata) if metadata else None),
        )


def insert_carrier_status(conn: psycopg.Connection, variant_id: str, condition: str, inheritance_pattern: str | None, carrier_type: str | None, source: str, metadata: dict | None = None):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "CarrierStatus" (id, "variantId", condition, "inheritancePattern", "carrierType", source, metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s)""",
            (variant_id, condition, inheritance_pattern, carrier_type, source, json.dumps(metadata) if metadata else None),
        )


def insert_ancestry_marker(conn: psycopg.Connection, variant_id: str, haplogroup: str | None, population: str | None, frequency: float | None, metadata: dict | None = None):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "AncestryMarker" (id, "variantId", haplogroup, population, frequency, metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s)
               ON CONFLICT ("variantId", population) DO NOTHING""",
            (variant_id, haplogroup, population, frequency, json.dumps(metadata) if metadata else None),
        )


def insert_phenotype_trait(conn: psycopg.Connection, variant_id: str, trait: str, effect: str | None, category: str | None, source: str, metadata: dict | None = None):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO "PhenotypeTrait" (id, "variantId", trait, effect, category, source, metadata)
               VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s)""",
            (variant_id, trait, effect, category, source, json.dumps(metadata) if metadata else None),
        )


def get_variants_with_rsid(conn: psycopg.Connection, vcf_file_id: str) -> list[tuple]:
    """Fetch variants for annotation. Returns (id, rsId, chromosome, position, ref, alt).

    position/ref/alt are required for allele-specific ClinVar lookup; rsId still drives
    PharmGKB and hand-curated lookups.
    """
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, "rsId", chromosome, position, ref, alt FROM "Variant"
               WHERE "vcfFileId" = %s AND "rsId" IS NOT NULL""",
            (vcf_file_id,),
        )
        return cur.fetchall()


def update_chromosome_summary_counts(conn: psycopg.Connection, vcf_file_id: str, chrom_pathogenic: dict, chrom_pharma: dict):
    chromosomes = set(chrom_pathogenic.keys()) | set(chrom_pharma.keys())
    with conn.cursor() as cur:
        for chrom in chromosomes:
            cur.execute(
                """UPDATE "ChromosomeSummary"
                   SET "pathogenicCount" = %s, "pharmacogenomicCount" = %s
                   WHERE "vcfFileId" = %s AND chromosome = %s""",
                (chrom_pathogenic.get(chrom, 0), chrom_pharma.get(chrom, 0), vcf_file_id, chrom),
            )
