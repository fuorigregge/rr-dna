import { Resolver, Query, Args } from '@nestjs/graphql';
import { TraitsService } from './traits.service';
import { PhenotypeTraitObject, PaginatedPhenotypeTraits } from './dto/phenotype-trait.object';
import { TraitCountsObject } from './dto/trait-counts.object';
import { PaginationInput } from '../../common/dto/pagination.input';

@Resolver(() => PhenotypeTraitObject)
export class TraitsResolver {
  constructor(private readonly traitsService: TraitsService) {}

  @Query(() => PaginatedPhenotypeTraits, { name: 'phenotypeTraits' })
  async findAll(
    @Args('vcfFileId', { nullable: true }) vcfFileId?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.traitsService.findAll(vcfFileId, category, pagination);
  }

  @Query(() => TraitCountsObject, { name: 'traitCounts' })
  async getCounts(@Args('vcfFileId', { nullable: true }) vcfFileId?: string) {
    return this.traitsService.getCounts(vcfFileId!);
  }
}
