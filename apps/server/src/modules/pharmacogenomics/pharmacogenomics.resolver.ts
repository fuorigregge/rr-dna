import { Resolver, Query, Args } from '@nestjs/graphql';
import { PharmacogenomicsService } from './pharmacogenomics.service';
import { PharmacogenomicsObject, PaginatedPharmacogenomics } from './dto/pharmacogenomics.object';
import { PharmacogenomicsCountsObject } from './dto/pharmacogenomics-counts.object';
import { PharmacoResultObject } from './dto/pharmaco-result.object';
import { PaginationInput } from '../../common/dto/pagination.input';

@Resolver(() => PharmacogenomicsObject)
export class PharmacogenomicsResolver {
  constructor(private readonly pharmaService: PharmacogenomicsService) {}

  @Query(() => PaginatedPharmacogenomics, { name: 'pharmacogenomics' })
  async findAll(
    @Args('vcfFileId', { nullable: true }) vcfFileId?: string,
    @Args('category', { nullable: true }) category?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.pharmaService.findAll(vcfFileId, category, pagination);
  }

  @Query(() => PharmacogenomicsCountsObject, { name: 'pharmacogenomicsCounts' })
  async getCounts(@Args('vcfFileId', { nullable: true }) vcfFileId?: string) {
    return this.pharmaService.getCounts(vcfFileId!);
  }

  @Query(() => [PharmacoResultObject], { name: 'pharmacoPanel' })
  async pharmacoPanel(@Args('vcfFileId') vcfFileId: string) {
    return this.pharmaService.findPanel(vcfFileId);
  }
}
