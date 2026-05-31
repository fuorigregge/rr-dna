import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationInput } from '../../common/dto/pagination.input';

@Injectable()
export class FitnessService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vcfFileId?: string, pagination?: PaginationInput) {
    const offset = pagination?.offset ?? 0;
    const limit = pagination?.limit ?? 50;

    const where = {
      category: 'PHYSICAL' as const,
      ...(vcfFileId && { variant: { vcfFileId } }),
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
}
