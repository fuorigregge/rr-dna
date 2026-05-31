import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../../common/dto/pagination.input';
import { ClinicalSignificance } from '@prisma/client';

@Injectable()
export class DiseasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vcfFileId?: string, significance?: string, pagination?: PaginationInput) {
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? 50;

    const where = {
      ...(vcfFileId && { variant: { vcfFileId } }),
      ...(significance && { significance: significance as ClinicalSignificance }),
    };

    // Collapse compound-het noise: a 1/2 site yields two distinct Variant rows that
    // map to the same (disease, significance) — show that condition once. The distinct
    // variants are preserved in the DB and still reachable via diseaseRisksByVariant.
    const [rawItems, groups] = await Promise.all([
      this.prisma.diseaseRisk.findMany({
        where,
        // pull the gene off the linked VariantAnnotation in a single query
        include: { variant: { include: { annotations: { where: { gene: { not: null } }, select: { gene: true }, take: 1 } } } },
        distinct: ['disease', 'significance'],
        skip: offset,
        take: limit,
        orderBy: [{ disease: 'asc' }, { significance: 'asc' }],
      }),
      this.prisma.diseaseRisk.groupBy({ by: ['disease', 'significance'], where }),
    ]);

    // Flatten annotations[0].gene onto variant for a simple GraphQL field path.
    const items = rawItems.map((d) => {
      if (!d.variant) return d;
      const { annotations, ...rest } = d.variant as any;
      return { ...d, variant: { ...rest, gene: annotations?.[0]?.gene ?? null } };
    });

    const total = groups.length;
    return { items, total, hasMore: offset + limit < total };
  }

  async getCounts(vcfFileId: string) {
    // Count distinct (disease, significance) so the breakdown matches the deduped list.
    const groups = await this.prisma.diseaseRisk.groupBy({
      by: ['disease', 'significance'],
      where: { variant: { vcfFileId } },
    });
    const counts = { total: groups.length, pathogenic: 0, likelyPathogenic: 0, uncertain: 0, likelyBenign: 0, benign: 0 };
    for (const g of groups) {
      switch (g.significance) {
        case 'PATHOGENIC': counts.pathogenic++; break;
        case 'LIKELY_PATHOGENIC': counts.likelyPathogenic++; break;
        case 'UNCERTAIN': counts.uncertain++; break;
        case 'LIKELY_BENIGN': counts.likelyBenign++; break;
        case 'BENIGN': counts.benign++; break;
      }
    }
    return counts;
  }

  async findByVariant(variantId: string) {
    return this.prisma.diseaseRisk.findMany({
      where: { variantId },
      include: { variant: true },
    });
  }

  // Curated ACMG actionable-variant panel: explicit per-variant verdict
  // (CARRIED / NOT_CARRIED / NOT_COVERED), including reassuring negatives.
  // String ordering of `state` happens to sort CARRIED < NOT_CARRIED < NOT_COVERED.
  async findAcmgPanel(vcfFileId: string) {
    return this.prisma.acmgResult.findMany({
      where: { vcfFileId },
      orderBy: [{ state: 'asc' }, { gene: 'asc' }],
    });
  }
}
