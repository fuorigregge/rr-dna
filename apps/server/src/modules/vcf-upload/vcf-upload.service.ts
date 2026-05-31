import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class VcfUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue('vcf') private readonly vcfQueue: Queue,
  ) {}

  async uploadFromDisk(filename: string, filePath: string, ancestryMode: string = 'none') {
    const vcfFile = await this.prisma.vcfFile.create({
      data: { filename, filePath },
    });

    await this.vcfQueue.add('vcf:parse', {
      vcfFileId: vcfFile.id,
      filePath,
      ancestryMode,
    }, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    });

    return vcfFile;
  }

  async findAll() {
    return this.prisma.vcfFile.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.vcfFile.findUnique({ where: { id } });
  }

  async delete(id: string) {
    return this.prisma.vcfFile.delete({ where: { id } });
  }

  async getProgress(id: string) {
    const raw = await this.redis.get(`vcf:${id}:progress`);
    const error = await this.redis.get(`vcf:${id}:error`);
    if (!raw) {
      const file = await this.prisma.vcfFile.findUnique({ where: { id } });
      return {
        status: file?.status || 'UNKNOWN',
        step: 'waiting',
        percentage: 0,
        error: error || null,
      };
    }
    const progress = JSON.parse(raw);
    return { ...progress, error: error || null };
  }
}
