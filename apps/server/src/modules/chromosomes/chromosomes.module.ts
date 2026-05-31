import { Module } from '@nestjs/common';
import { ChromosomesService } from './chromosomes.service';
import { ChromosomesResolver } from './chromosomes.resolver';

@Module({
  providers: [ChromosomesService, ChromosomesResolver],
  exports: [ChromosomesService],
})
export class ChromosomesModule {}
