import { Module } from '@nestjs/common';
import { VariantsService } from './variants.service';
import { VariantsResolver } from './variants.resolver';

@Module({
  providers: [VariantsService, VariantsResolver],
  exports: [VariantsService],
})
export class VariantsModule {}
