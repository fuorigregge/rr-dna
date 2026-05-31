import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiResolver } from './ai.resolver';
import { AncestryModule } from '../ancestry/ancestry.module';
import { CarrierModule } from '../carrier/carrier.module';

@Module({
  imports: [AncestryModule, CarrierModule],
  providers: [AiService, AiResolver],
  exports: [AiService],
})
export class AiModule {}
