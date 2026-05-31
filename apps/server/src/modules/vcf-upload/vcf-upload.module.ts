import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VcfUploadService } from './vcf-upload.service';
import { VcfUploadResolver } from './vcf-upload.resolver';
import { VcfUploadController } from './vcf-upload.controller';

@Module({
  imports: [BullModule.registerQueue({ name: 'vcf' })],
  controllers: [VcfUploadController],
  providers: [VcfUploadService, VcfUploadResolver],
})
export class VcfUploadModule {}
