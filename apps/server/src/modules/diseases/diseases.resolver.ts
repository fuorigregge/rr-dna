import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { DiseasesService } from './diseases.service';
import { DiseaseRiskObject, PaginatedDiseaseRisks } from './dto/disease-risk.object';
import { DiseaseRiskCountsObject } from './dto/disease-counts.object';
import { AcmgResultObject } from './dto/acmg-result.object';
import { PaginationInput } from '../../common/dto/pagination.input';

@Resolver(() => DiseaseRiskObject)
export class DiseasesResolver {
  constructor(private readonly diseasesService: DiseasesService) {}

  @Query(() => PaginatedDiseaseRisks, { name: 'diseaseRisks' })
  async findAll(
    @Args('vcfFileId', { nullable: true }) vcfFileId?: string,
    @Args('significance', { nullable: true }) significance?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.diseasesService.findAll(vcfFileId, significance, pagination);
  }

  @Query(() => DiseaseRiskCountsObject, { name: 'diseaseRiskCounts' })
  async getCounts(@Args('vcfFileId', { nullable: true }) vcfFileId?: string) {
    return this.diseasesService.getCounts(vcfFileId!);
  }

  @Query(() => [DiseaseRiskObject], { name: 'diseaseRisksByVariant' })
  async findByVariant(@Args('variantId', { type: () => ID }) variantId: string) {
    return this.diseasesService.findByVariant(variantId);
  }

  @Query(() => [AcmgResultObject], { name: 'acmgPanel' })
  async acmgPanel(@Args('vcfFileId') vcfFileId: string) {
    return this.diseasesService.findAcmgPanel(vcfFileId);
  }
}
