import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../../common/dto/pagination.input';

@Injectable()
export class PharmacogenomicsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vcfFileId?: string, category?: string, pagination?: PaginationInput) {
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? 50;

    const categoryFilters: Record<string, any> = {
      contraindicated: { OR: [{ effect: { contains: 'Contraindicated', mode: 'insensitive' as const } }, { effect: { contains: 'Controindicato', mode: 'insensitive' as const } }, { effect: { contains: 'Controindicata', mode: 'insensitive' as const } }] },
      sensitivity: { OR: [{ effect: { contains: 'sensitivity', mode: 'insensitive' as const } }, { effect: { contains: 'sensibilit', mode: 'insensitive' as const } }] },
      altered: { NOT: { OR: [{ effect: { contains: 'Contraindicated', mode: 'insensitive' as const } }, { effect: { contains: 'Controindicato', mode: 'insensitive' as const } }, { effect: { contains: 'Controindicata', mode: 'insensitive' as const } }, { effect: { contains: 'sensitivity', mode: 'insensitive' as const } }, { effect: { contains: 'sensibilit', mode: 'insensitive' as const } }] } },
    };

    const where = {
      ...(vcfFileId && { variant: { vcfFileId } }),
      ...(category && categoryFilters[category]),
    };

    const [items, total] = await Promise.all([
      this.prisma.pharmacogenomics.findMany({
        where,
        include: { variant: true },
        skip: offset,
        take: limit,
        orderBy: { drug: 'asc' },
      }),
      this.prisma.pharmacogenomics.count({ where }),
    ]);

    return { items, total, hasMore: offset + limit < total };
  }

  async findPanel(vcfFileId: string) {
    return this.prisma.pharmacoResult.findMany({
      where: { vcfFileId },
      orderBy: { gene: 'asc' },
    });
  }

  async getCounts(vcfFileId: string) {
    const where = { variant: { vcfFileId } };
    const all = await this.prisma.pharmacogenomics.findMany({
      where,
      select: { effect: true },
    });

    let contraindicated = 0;
    let sensitivity = 0;
    let altered = 0;

    for (const { effect } of all) {
      const lower = (effect || '').toLowerCase();
      if (lower.includes('contraindicated') || lower.includes('controindicato') || lower.includes('controindicata')) {
        contraindicated++;
      } else if (lower.includes('sensitivity') || lower.includes('sensibilit')) {
        sensitivity++;
      } else {
        altered++;
      }
    }

    return { total: all.length, contraindicated, sensitivity, altered };
  }
}
