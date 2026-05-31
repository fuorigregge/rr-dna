import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TraitPanelService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(vcfFileId: string) {
    return this.prisma.traitPanelResult.findMany({
      where: { vcfFileId },
      orderBy: [{ category: 'asc' }, { gene: 'asc' }],
    });
  }
}
