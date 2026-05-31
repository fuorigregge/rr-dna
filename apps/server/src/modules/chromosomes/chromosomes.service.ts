import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChromosomesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByVcfFile(vcfFileId: string) {
    return this.prisma.chromosomeSummary.findMany({
      where: { vcfFileId },
      orderBy: { chromosome: 'asc' },
    });
  }

  async findOne(vcfFileId: string, chromosome: string) {
    return this.prisma.chromosomeSummary.findUnique({
      where: { vcfFileId_chromosome: { vcfFileId, chromosome } },
    });
  }
}
