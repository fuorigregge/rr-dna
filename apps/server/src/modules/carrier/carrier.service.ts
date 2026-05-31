import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../../common/dto/pagination.input';
import { geneInheritance, isCarrierGene, CARRIER_GENE_NOTE } from './gene-inheritance';

@Injectable()
export class CarrierService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vcfFileId?: string, pagination?: PaginationInput) {
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? 50;

    const where = {
      ...(vcfFileId && { variant: { vcfFileId } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.carrierStatus.findMany({
        where,
        include: { variant: true },
        skip: offset,
        take: limit,
        orderBy: { condition: 'asc' },
      }),
      this.prisma.carrierStatus.count({ where }),
    ]);

    return { items, total, hasMore: offset + limit < total };
  }

  // Curated carrier-screening panel: explicit per-variant verdict
  // (CLEAR / CARRIER / AFFECTED / NOT_COVERED), including reassuring negatives.
  // String ordering of `state` sorts AFFECTED < CARRIER < CLEAR < NOT_COVERED.
  async findPanel(vcfFileId: string) {
    return this.prisma.carrierPanelResult.findMany({
      where: { vcfFileId },
      orderBy: [{ state: 'asc' }, { gene: 'asc' }],
    });
  }

  // Lista PULITA dei portatori di malattie recessive, sorgente unica per pagina,
  // referto e AI. Unisce due fonti, escludendo il rumore:
  //  1) portatori curati (CarrierStatus carrierType='carrier', es. Xeroderma) —
  //     hand-curated con ereditarietà nota;
  //  2) portatori derivati dai reperti ClinVar patogenici ETEROZIGOTI in geni
  //     recessivi/X-linked (es. ATM, DNAI1), che il pannello curato non copre.
  // Esclusi: i falsi positivi comuni (ACMG BS1), i geni dominanti (l'eterozigosi
  // è un reperto di rischio, non un portatore) e le voci ClinVar 'at risk' grezze.
  async findDerivedCarriers(vcfFileId: string) {
    type Carrier = {
      id: string; gene: string; condition: string; rsId: string | null;
      genotype: string | null; zygosity: string | null; inheritance: string;
      state: string; stars: number | null; note: string | null;
    };
    const seen = new Set<string>();
    const out: Carrier[] = [];
    const inhLabel = (g: string | null, pattern?: string | null) => {
      const inh = geneInheritance(g);
      if (inh === 'XL') return 'X-linked';
      if (inh === 'AR') return 'Autosomica recessiva';
      if (pattern === 'X_LINKED') return 'X-linked';
      return 'Autosomica recessiva';
    };

    // 1) Portatori curati (carrierType = 'carrier').
    const curated = await this.prisma.carrierStatus.findMany({
      where: { variant: { vcfFileId }, carrierType: 'carrier' },
      include: { variant: { select: { rsId: true, genotype: true, zygosity: true, annotations: { select: { gene: true } } } } },
    });
    for (const c of curated) {
      const v = c.variant;
      const gene: string | null = v?.annotations.find((a) => a.gene)?.gene ?? null;
      const key = `${gene ?? c.condition}|${c.condition}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: c.id,
        gene: gene ?? '—',
        condition: c.condition,
        rsId: v?.rsId ?? null,
        genotype: v?.genotype ?? null,
        zygosity: v?.zygosity ?? null,
        inheritance: inhLabel(gene, c.inheritancePattern),
        state: v?.zygosity === 'HOMOZYGOUS' ? 'AFFECTED' : 'CARRIER',
        stars: null,
        note: gene ? CARRIER_GENE_NOTE[gene.toUpperCase()] ?? null : null,
      });
    }

    // 2) Portatori derivati dai reperti patogenici eterozigoti (BS1-filtrati).
    const rows = await this.prisma.diseaseRisk.findMany({
      where: { variant: { vcfFileId }, significance: { in: ['PATHOGENIC', 'LIKELY_PATHOGENIC'] } },
      include: {
        variant: { select: { rsId: true, genotype: true, zygosity: true, annotations: { select: { gene: true } } } },
      },
      orderBy: { significance: 'asc' },
    });
    for (const d of rows) {
      const meta = (d.metadata as any) ?? {};
      if (meta.bs1_level === 'common') continue; // falso positivo comune (ACMG BS1)
      const v = d.variant;
      if (!v) continue;
      const gene: string | null = meta.gene ?? v.annotations.find((a) => a.gene)?.gene ?? null;
      if (!isCarrierGene(gene)) continue; // solo recessivi / X-linked (esclude i dominanti)
      const key = `${gene}|${d.disease}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: d.id,
        gene: gene!,
        condition: d.disease,
        rsId: v.rsId ?? null,
        genotype: v.genotype ?? null,
        zygosity: v.zygosity ?? null,
        inheritance: inhLabel(gene),
        state: v.zygosity === 'HOMOZYGOUS' ? 'AFFECTED' : 'CARRIER',
        stars: typeof meta.stars === 'number' ? meta.stars : null,
        note: CARRIER_GENE_NOTE[gene!.toUpperCase()] ?? null,
      });
    }

    // AFFECTED prima, poi per gene
    return out.sort((a, b) => (a.state === b.state ? a.gene.localeCompare(b.gene) : a.state === 'AFFECTED' ? -1 : 1));
  }
}
