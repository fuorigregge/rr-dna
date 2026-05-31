import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { ChromosomesService } from './chromosomes.service';
import { ChromosomeSummaryObject } from './dto/chromosome-summary.object';

@Resolver(() => ChromosomeSummaryObject)
export class ChromosomesResolver {
  constructor(private readonly chromosomesService: ChromosomesService) {}

  @Query(() => [ChromosomeSummaryObject], { name: 'chromosomeSummaries' })
  async findByVcfFile(@Args('vcfFileId', { type: () => ID }) vcfFileId: string) {
    return this.chromosomesService.findByVcfFile(vcfFileId);
  }

  @Query(() => ChromosomeSummaryObject, { name: 'chromosomeSummary', nullable: true })
  async findOne(
    @Args('vcfFileId', { type: () => ID }) vcfFileId: string,
    @Args('chromosome') chromosome: string,
  ) {
    return this.chromosomesService.findOne(vcfFileId, chromosome);
  }
}
