import { Resolver, Query, Args } from '@nestjs/graphql';
import { FitnessService } from './fitness.service';
import { PaginatedPhenotypeTraits } from '../traits/dto/phenotype-trait.object';
import { PaginationInput } from '../../common/dto/pagination.input';

@Resolver()
export class FitnessResolver {
  constructor(private readonly fitnessService: FitnessService) {}

  @Query(() => PaginatedPhenotypeTraits, { name: 'fitnessTraits' })
  async findAll(
    @Args('vcfFileId', { nullable: true }) vcfFileId?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.fitnessService.findAll(vcfFileId, pagination);
  }
}
