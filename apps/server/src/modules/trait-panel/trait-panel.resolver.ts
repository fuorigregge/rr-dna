import { Resolver, Query, Args } from '@nestjs/graphql';
import { TraitPanelService } from './trait-panel.service';
import { TraitPanelResultObject } from './dto/trait-panel.object';

@Resolver(() => TraitPanelResultObject)
export class TraitPanelResolver {
  constructor(private readonly traitPanelService: TraitPanelService) {}

  @Query(() => [TraitPanelResultObject], { name: 'traitPanel' })
  async traitPanel(@Args('vcfFileId') vcfFileId: string) {
    return this.traitPanelService.findAll(vcfFileId);
  }
}
