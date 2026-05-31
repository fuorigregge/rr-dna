import { Module } from '@nestjs/common';
import { TraitPanelService } from './trait-panel.service';
import { TraitPanelResolver } from './trait-panel.resolver';

@Module({
  providers: [TraitPanelService, TraitPanelResolver],
  exports: [TraitPanelService],
})
export class TraitPanelModule {}
