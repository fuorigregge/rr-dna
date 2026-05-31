import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../../common/dto/pagination.input';

// Frequenza imputata per le popolazioni assenti a un sito. Il build gnomAD
// (build_ancestry_db.py, MIN_AF=0.001) salva una popolazione solo se l'allele ha
// AF >= 0.001; dove la riga manca, in quella popolazione l'allele è < 0.001.
// Imputiamo questo limite superiore così OGNI popolazione è valutata sullo stesso
// set di siti (confronto alla pari) e riceve la penalità dove non condivide l'allele.
const IMPUTED_ABSENT_AF = 0.001;

// Soglia minima di siti perché una popolazione entri nel ranking best-fit.
const MIN_AFFINITY_MARKERS = 1000;

@Injectable()
export class AncestryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vcfFileId?: string, pagination?: PaginationInput) {
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? 50;

    const where = {
      ...(vcfFileId && { variant: { vcfFileId } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.ancestryMarker.findMany({
        where,
        include: { variant: true },
        skip: offset,
        take: limit,
      }),
      this.prisma.ancestryMarker.count({ where }),
    ]);

    return { items, total, hasMore: offset + limit < total };
  }

  async findHaplogroups(vcfFileId: string) {
    return this.prisma.haplogroup.findMany({
      where: { vcfFileId },
      orderBy: { lineage: 'asc' },
    });
  }

  async affinity(vcfFileId: string, minMarkers: number = MIN_AFFINITY_MARKERS) {
    // Log-verosimiglianza del genotipo per popolazione (modello HWE) su tutti i
    // siti gnomAD che il soggetto porta. Tutte le popolazioni sono valutate sullo
    // STESSO set di siti (CROSS JOIN sites × pops); dove una popolazione manca al
    // sito, la sua frequenza è imputata a IMPUTED_ABSENT_AF. f è clampata a
    // [1e-6, 1-1e-6] per evitare ln(0) sul termine eterozigote.
    const rows = await this.prisma.$queryRaw<
      Array<{ population: string; markerCount: number; totalLogLik: number }>
    >(Prisma.sql`
      WITH sites AS (
        SELECT DISTINCT v.id AS variant_id, v.zygosity::text AS zygosity
        FROM "Variant" v
        JOIN "AncestryMarker" am ON am."variantId" = v.id
        WHERE v."vcfFileId" = ${vcfFileId}
          AND v.zygosity IS NOT NULL
          AND am.metadata->>'source' = 'gnomAD_v4'
      ),
      pops AS (
        SELECT DISTINCT am.population AS population
        FROM "AncestryMarker" am
        JOIN "Variant" v ON v.id = am."variantId"
        WHERE v."vcfFileId" = ${vcfFileId}
          AND am.metadata->>'source' = 'gnomAD_v4'
          AND am.population IS NOT NULL
      ),
      grid AS (
        SELECT s.zygosity AS zygosity,
               p.population AS population,
               LEAST(GREATEST(COALESCE(am.frequency, ${IMPUTED_ABSENT_AF}), 1e-6), 1 - 1e-6) AS f
        FROM sites s
        CROSS JOIN pops p
        LEFT JOIN "AncestryMarker" am
          ON am."variantId" = s.variant_id
         AND am.population = p.population
         AND am.metadata->>'source' = 'gnomAD_v4'
      )
      SELECT population,
             COUNT(*)::int AS "markerCount",
             SUM(
               CASE zygosity
                 WHEN 'HOMOZYGOUS' THEN 2 * ln(f)
                 WHEN 'HETEROZYGOUS' THEN ln(2::float8) + ln(f) + ln(1 - f)
                 ELSE 0
               END
             )::float8 AS "totalLogLik"
      FROM grid
      GROUP BY population
      HAVING COUNT(*) >= ${minMarkers}
    `);

    if (rows.length === 0) return [];

    const withMean = rows.map((r) => ({
      population: r.population,
      totalLogLik: r.totalLogLik,
      markerCount: r.markerCount,
      meanLogLik: r.totalLogLik / r.markerCount,
    }));
    const maxMean = Math.max(...withMean.map((r) => r.meanLogLik));

    return withMean
      .map((r) => ({ ...r, relativeScore: Math.exp(r.meanLogLik - maxMean) }))
      .sort((a, b) => b.meanLogLik - a.meanLogLik);
  }
}
