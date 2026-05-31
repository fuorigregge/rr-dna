import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../../common/dto/pagination.input';
import { TraitCategory } from '@prisma/client';

@Injectable()
export class TraitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vcfFileId?: string, category?: string, pagination?: PaginationInput) {
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? 50;

    const where = {
      ...(vcfFileId && { variant: { vcfFileId } }),
      ...(category && { category: category as TraitCategory }),
    };

    const [items, total] = await Promise.all([
      this.prisma.phenotypeTrait.findMany({
        where,
        include: { variant: true },
        skip: offset,
        take: limit,
        orderBy: { trait: 'asc' },
      }),
      this.prisma.phenotypeTrait.count({ where }),
    ]);

    return { items, total, hasMore: offset + limit < total };
  }

  async getCounts(vcfFileId: string) {
    const where = { variant: { vcfFileId } };
    const [total, metabolism, physical, cognitive] = await Promise.all([
      this.prisma.phenotypeTrait.count({ where }),
      this.prisma.phenotypeTrait.count({ where: { ...where, category: 'METABOLISM' } }),
      this.prisma.phenotypeTrait.count({ where: { ...where, category: 'PHYSICAL' } }),
      this.prisma.phenotypeTrait.count({ where: { ...where, category: 'COGNITIVE' } }),
    ]);
    return { total, metabolism, physical, cognitive };
  }
}
