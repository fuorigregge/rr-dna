import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { classifyDiseaseFinding } from './disease-verdict';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(vcfFileId: string) {
    const vcfFile = await this.prisma.vcfFile.findUnique({
      where: { id: vcfFileId },
    });

    if (!vcfFile) return null;

    const variantIds = { variants: { some: { vcfFileId } } };

    const [
      heterozygousCount,
      homozygousCount,
      pathogenicCount,
      pharmacogenomicCount,
      carrierCount,
      traitCount,
      ancestryCount,
      fitnessCount,
    ] = await Promise.all([
      this.prisma.variant.count({ where: { vcfFileId, zygosity: 'HETEROZYGOUS' } }),
      this.prisma.variant.count({ where: { vcfFileId, zygosity: 'HOMOZYGOUS' } }),
      this.prisma.diseaseRisk.count({ where: { variant: { vcfFileId }, significance: { in: ['PATHOGENIC', 'LIKELY_PATHOGENIC'] } } }),
      this.prisma.pharmacogenomics.count({ where: { variant: { vcfFileId } } }),
      this.prisma.carrierStatus.count({ where: { variant: { vcfFileId } } }),
      this.prisma.phenotypeTrait.count({ where: { variant: { vcfFileId }, NOT: { category: 'PHYSICAL' } } }),
      this.prisma.ancestryMarker.count({ where: { variant: { vcfFileId } } }),
      this.prisma.phenotypeTrait.count({ where: { variant: { vcfFileId }, category: 'PHYSICAL' } }),
    ]);

    return {
      totalVariants: vcfFile.totalVariants,
      snpCount: vcfFile.snpCount,
      indelCount: vcfFile.indelCount,
      heterozygousCount,
      homozygousCount,
      pathogenicCount,
      pharmacogenomicCount,
      carrierCount,
      traitCount,
      ancestryCount,
      fitnessCount,
    };
  }

  // Extracted "notable findings" across sections, for the dashboard highlights
  // panel and the PDF report. A flat, pre-sorted (severity) list.
  async getHighlights(vcfFileId: string) {
    const out: Array<{ category: string; gene?: string; title: string; detail?: string; severity: string }> = [];

    // Clinically significant diseases (distinct condition), weighted by ClinVar
    // stars and call confidence.
    const diseases = await this.prisma.diseaseRisk.findMany({
      where: { variant: { vcfFileId }, significance: { in: ['PATHOGENIC', 'LIKELY_PATHOGENIC'] } },
      include: { variant: { select: { lowConfidence: true, vaf: true, zygosity: true } } },
      distinct: ['disease', 'significance'],
      orderBy: { significance: 'asc' },
    });
    for (const d of diseases) {
      const meta = (d.metadata as any) ?? {};
      const stars = typeof meta.stars === 'number' ? meta.stars : null;
      const af = typeof meta.gnomad_af_grpmax === 'number' ? meta.gnomad_af_grpmax : null;
      const low = d.variant?.lowConfidence ?? false;
      const { verdict } = classifyDiseaseFinding({
        significance: d.significance, stars, lowConfidence: low,
        vaf: d.variant?.vaf ?? null, zygosity: d.variant?.zygosity ?? null, populationAf: af,
      });
      const parts = [d.significance === 'PATHOGENIC' ? 'Patogenica' : 'Probabilmente patogenica'];
      if (stars != null) parts.push(`${stars}★ ClinVar`);
      if (af != null && af >= 0.01) parts.push(`gnomAD ${af >= 0.1 ? Math.round(af * 100) : (af * 100).toFixed(1)}%`);
      if (low) parts.push('bassa confidenza');
      if (verdict === 'likely_false_positive') parts.push('probabile falso positivo');
      // solido -> rilevante (rosso); altrimenti da verificare (ambra)
      out.push({
        category: 'disease',
        title: d.disease,
        detail: parts.join(' · '),
        severity: verdict === 'solid' ? 'high' : 'medium',
      });
    }

    // ACMG actionable variants actually carried.
    const acmg = await this.prisma.acmgResult.findMany({ where: { vcfFileId, state: 'CARRIED' } });
    for (const a of acmg) {
      out.push({
        category: 'acmg',
        gene: a.gene,
        title: a.condition,
        detail: [a.variantName, a.zygosity].filter(Boolean).join(' · '),
        severity: 'high',
      });
    }

    // Carrier-screening positives.
    const carrier = await this.prisma.carrierPanelResult.findMany({
      where: { vcfFileId, state: { in: ['CARRIER', 'AFFECTED'] } },
    });
    for (const c of carrier) {
      out.push({
        category: 'carrier',
        gene: c.gene,
        title: c.condition,
        detail: `${c.state === 'AFFECTED' ? 'Due copie / emizigote' : 'Portatore'} · ${c.variantName}`,
        severity: c.state === 'AFFECTED' ? 'high' : 'medium',
      });
    }

    // Pharmacogenes with a non-normal phenotype (actionable).
    const pharma = await this.prisma.pharmacoResult.findMany({ where: { vcfFileId } });
    for (const p of pharma) {
      if (p.phenotype && !/normale|standard/i.test(p.phenotype)) {
        out.push({
          category: 'pharma',
          gene: p.gene,
          title: p.diplotype ?? 'diplotipo non determinato',
          detail: [p.phenotype, p.drugs].filter(Boolean).join(' · '),
          severity: 'medium',
        });
      }
    }

    // Notable carried traits.
    const traits = await this.prisma.traitPanelResult.findMany({
      where: { vcfFileId, state: 'CARRIED' },
      orderBy: [{ category: 'asc' }, { gene: 'asc' }],
    });
    for (const t of traits) {
      out.push({
        category: 'trait',
        gene: t.gene ?? undefined,
        title: t.trait,
        detail: t.genotype ? `genotipo ${t.genotype}` : undefined,
        severity: 'info',
      });
    }

    // Direct lineages.
    const haplo = await this.prisma.haplogroup.findMany({ where: { vcfFileId }, orderBy: { lineage: 'asc' } });
    for (const h of haplo) {
      out.push({
        category: 'haplogroup',
        title: h.lineage === 'MT' ? `Aplogruppo materno (mtDNA): ${h.haplogroup}` : `Aplogruppo paterno (Y): ${h.haplogroup}`,
        detail: h.detail ?? undefined,
        severity: 'info',
      });
    }

    return out;
  }

  // Polygenic Risk Scores per VCF, ordered T2D-then-CAD by trait key.
  // Espone la distribuzione empirica (per la curva nel dettaglio) estraendola da metadata.
  async getPrsResults(vcfFileId: string) {
    const rows = await this.prisma.prsResult.findMany({
      where: { vcfFileId },
      orderBy: { traitKey: 'asc' },
    });
    return rows.map((r) => ({
      ...r,
      distribution: (r.metadata as { distribution?: unknown } | null)?.distribution ?? null,
    }));
  }

  // Reperti malattia per il referto PDF, arricchiti col verdetto di attendibilità.
  // Enumera le PATOGENICHE/PROBABILMENTE PATOGENICHE (dove la distinzione dai falsi
  // positivi è il punto chiave) e solo le VUS meglio caratterizzate (>=3★): le 300+
  // VUS a 0-2★ sono rumore di fondo non azionabile, riportate solo come conteggio.
  // Benigne/prob. benigne restano fuori del tutto (solo conteggio nel referto).
  async getReportDiseases(vcfFileId: string) {
    const rows = await this.prisma.diseaseRisk.findMany({
      where: {
        variant: { vcfFileId },
        significance: { in: ['PATHOGENIC', 'LIKELY_PATHOGENIC', 'UNCERTAIN'] },
      },
      include: {
        variant: {
          select: { rsId: true, genotype: true, zygosity: true, vaf: true, depth: true, lowConfidence: true },
        },
      },
      distinct: ['disease', 'significance'],
      orderBy: { significance: 'asc' },
    });

    const mapped = rows.map((d) => {
      const meta = (d.metadata as any) ?? {};
      const stars: number | null = typeof meta.stars === 'number' ? meta.stars : null;
      const links = (meta.links as Record<string, string> | undefined) ?? {};
      const afGrpmax: number | null = typeof meta.gnomad_af_grpmax === 'number' ? meta.gnomad_af_grpmax : null;
      const afNfe: number | null = typeof meta.gnomad_af_nfe === 'number' ? meta.gnomad_af_nfe : null;
      const v = d.variant;
      const { verdict, reason } = classifyDiseaseFinding({
        significance: d.significance,
        stars,
        lowConfidence: v?.lowConfidence ?? false,
        vaf: v?.vaf ?? null,
        zygosity: v?.zygosity ?? null,
        populationAf: afGrpmax,
      });
      return {
        id: d.id,
        disease: d.disease,
        gene: meta.gene ?? null,
        significance: d.significance,
        stars,
        rsId: v?.rsId ?? null,
        genotype: v?.genotype ?? null,
        zygosity: v?.zygosity ?? null,
        vaf: v?.vaf ?? null,
        depth: v?.depth ?? null,
        lowConfidence: v?.lowConfidence ?? false,
        populationAf: afGrpmax,
        populationAfNfe: afNfe,
        verdict,
        reason,
        description: typeof meta.description === 'string' ? meta.description : null,
        clinvarUrl: links.ClinVar ?? null,
        omimUrl: links.OMIM ?? null,
      };
    });

    // Tieni tutte le patogeniche/probabili; tra le VUS solo le meglio caratterizzate.
    return mapped.filter(
      (d) => d.significance !== 'UNCERTAIN' || (d.stars != null && d.stars >= 3),
    );
  }
}
