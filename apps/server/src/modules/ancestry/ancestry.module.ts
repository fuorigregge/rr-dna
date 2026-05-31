import { Module } from '@nestjs/common';
import { AncestryService } from './ancestry.service';
import { AncestryResolver } from './ancestry.resolver';

@Module({
  providers: [AncestryService, AncestryResolver],
  exports: [AncestryService],
})
export class AncestryModule {}
