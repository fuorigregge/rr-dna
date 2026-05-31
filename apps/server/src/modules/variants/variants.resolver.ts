import { Resolver, Query, Args, ID, Mutation } from '@nestjs/graphql';
import { VariantsService } from './variants.service';
import { VariantObject, PaginatedVariants } from './dto/variant.object';
import { VariantFilterInput } from './dto/variant-filter.input';
import { PaginationInput } from '../../common/dto/pagination.input';

@Resolver(() => VariantObject)
export class VariantsResolver {
  constructor(private readonly variantsService: VariantsService) {}

  @Query(() => PaginatedVariants, { name: 'variants' })
  async findAll(
    @Args('filter', { nullable: true }) filter?: VariantFilterInput,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.variantsService.findAll(filter, pagination);
  }

  @Query(() => VariantObject, { name: 'variant', nullable: true })
  async findOne(@Args('id', { type: () => ID }) id: string) {
    return this.variantsService.findOne(id);
  }

  @Mutation(() => VariantObject, { name: 'updateVariantNotes' })
  async updateNotes(
    @Args('id', { type: () => ID }) id: string,
    @Args('notes', { nullable: true }) notes?: string,
  ) {
    return this.variantsService.updateNotes(id, notes ?? null);
  }
}
