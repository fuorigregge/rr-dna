import { Module } from '@nestjs/common';
import { TraitsService } from './traits.service';
import { TraitsResolver } from './traits.resolver';

@Module({
  providers: [TraitsService, TraitsResolver],
  exports: [TraitsService],
})
export class TraitsModule {}
