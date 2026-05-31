import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VariantFilterInput } from './dto/variant-filter.input';
import { PaginationInput } from '../../common/dto/pagination.input';
import { Prisma, Zygosity, VariantImpact } from '@prisma/client';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter?: VariantFilterInput, pagination?: PaginationInput) {
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? 50;

    const where: Prisma.VariantWhereInput = {
      ...(filter?.vcfFileId && { vcfFileId: filter.vcfFileId }),
      ...(filter?.chromosome && { chromosome: filter.chromosome }),
      ...(filter?.rsId && { rsId: { contains: filter.rsId } }),
      ...(filter?.zygosity && { zygosity: filter.zygosity as Zygosity }),
      ...(filter?.gene && {
        annotations: { some: { gene: { contains: filter.gene, mode: 'insensitive' as const } } },
      }),
      ...(filter?.impact && {
        annotations: { some: { impact: filter.impact as VariantImpact } },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.variant.findMany({
        where,
        include: {
          annotations: true,
          diseases: true,
          pharma: true,
        },
        skip: offset,
        take: limit,
        orderBy: [{ chromosome: 'asc' }, { position: 'asc' }],
      }),
      this.prisma.variant.count({ where }),
    ]);

    return { items, total, hasMore: offset + limit < total };
  }

  async findOne(id: string) {
    return this.prisma.variant.findUnique({
      where: { id },
      include: {
        annotations: true,
        diseases: true,
        pharma: true,
        carrier: true,
        ancestry: true,
        traits: true,
      },
    });
  }

  async updateNotes(id: string, notes: string | null) {
    return this.prisma.variant.update({
      where: { id },
      data: { notes: notes && notes.trim().length > 0 ? notes : null },
    });
  }
}
