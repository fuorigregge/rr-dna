import { Module } from '@nestjs/common';
import { PharmacogenomicsService } from './pharmacogenomics.service';
import { PharmacogenomicsResolver } from './pharmacogenomics.resolver';

@Module({
  providers: [PharmacogenomicsService, PharmacogenomicsResolver],
  exports: [PharmacogenomicsService],
})
export class PharmacogenomicsModule {}
