import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { AncestryService } from './ancestry.service';

const prisma = new PrismaService();
const service = new AncestryService(prisma);
const VCF_ID = 'test-affinity-vcf-0001';

async function cleanup() {
  await prisma.vcfFile.delete({ where: { id: VCF_ID } }).catch(() => {});
}

async function makeVariant(id: string, zygosity: 'HOMOZYGOUS' | 'HETEROZYGOUS' | null) {
  await prisma.variant.create({
    data: { id, vcfFileId: VCF_ID, chromosome: '1', position: 1, ref: 'A', alt: 'G', zygosity: zygosity ?? undefined },
  });
}

// I marcatori reali gnomAD hanno metadata.source = 'gnomAD_v4'; il ranking
// considera solo quelli, quindi i test devono replicare quella sorgente.
async function makeMarker(variantId: string, population: string, frequency: number) {
  await prisma.ancestryMarker.create({
    data: { variantId, population, frequency, metadata: { source: 'gnomAD_v4' } },
  });
}

beforeAll(async () => {
  await cleanup();
  await prisma.vcfFile.create({ data: { id: VCF_ID, filename: 'test.vcf.gz', filePath: '/tmp/test.vcf.gz' } });
  // v1 (omo): X e Y entrambe presenti
  await makeVariant('test-v1', 'HOMOZYGOUS');
  await makeMarker('test-v1', 'X', 0.9);
  await makeMarker('test-v1', 'Y', 0.1);
  // v2 (omo): X presente, Y ASSENTE → Y viene imputata e penalizzata
  await makeVariant('test-v2', 'HOMOZYGOUS');
  await makeMarker('test-v2', 'X', 0.8);
  // v3 (etero): X con f=1.0 (test clamp lato alto del termine eterozigote), Y assente
  await makeVariant('test-v3', 'HETEROZYGOUS');
  await makeMarker('test-v3', 'X', 1.0);
  // v4 SENZA zygosity: non deve essere un sito valutato
  await makeVariant('test-v4', null);
  await makeMarker('test-v4', 'X', 0.5);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('AncestryService.affinity', () => {
  it('classifica come best-fit la popolazione dove gli alleli portati sono comuni', async () => {
    const res = await service.affinity(VCF_ID, 1);
    expect(res[0].population).toBe('X');
    expect(res[0].relativeScore).toBeCloseTo(1, 6);
    const x = res.find((r) => r.population === 'X')!;
    const y = res.find((r) => r.population === 'Y')!;
    expect(x.meanLogLik).toBeGreaterThan(y.meanLogLik);
    expect(y.relativeScore).toBeLessThan(1);
  });

  it('valuta tutte le popolazioni sullo STESSO set di siti (markerCount uguale)', async () => {
    const res = await service.affinity(VCF_ID, 1);
    const x = res.find((r) => r.population === 'X')!;
    const y = res.find((r) => r.population === 'Y')!;
    // siti = v1, v2, v3 (v4 escluso: zygosity nulla) → 3 per ogni popolazione
    expect(x.markerCount).toBe(3);
    expect(y.markerCount).toBe(3);
  });

  it('imputa e penalizza una popolazione assente a un sito', async () => {
    const res = await service.affinity(VCF_ID, 1);
    const y = res.find((r) => r.population === 'Y')!;
    const f = 0.001; // IMPUTED_ABSENT_AF
    // Y: v1 omo f=0.1; v2 omo imputata f; v3 etero imputata f
    const expected = (2 * Math.log(0.1) + 2 * Math.log(f) + (Math.log(2) + Math.log(f) + Math.log(1 - f))) / 3;
    expect(y.meanLogLik).toBeCloseTo(expected, 4);
  });

  it('clampa f=1 senza produrre -Infinity sul termine eterozigote', async () => {
    const res = await service.affinity(VCF_ID, 1);
    const x = res.find((r) => r.population === 'X')!;
    expect(Number.isFinite(x.meanLogLik)).toBe(true);
  });

  it('esclude dal ranking le popolazioni sotto la soglia di marcatori', async () => {
    // 3 siti per popolazione; con soglia 100 nessuna popolazione qualifica
    const res = await service.affinity(VCF_ID, 100);
    expect(res).toEqual([]);
  });
});
