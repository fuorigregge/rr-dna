import { Module } from '@nestjs/common';
import { DiseasesService } from './diseases.service';
import { DiseasesResolver } from './diseases.resolver';

@Module({
  providers: [DiseasesService, DiseasesResolver],
  exports: [DiseasesService],
})
export class DiseasesModule {}
