import { Resolver, Query, Args } from '@nestjs/graphql';
import { CarrierService } from './carrier.service';
import { CarrierStatusObject, PaginatedCarrierStatus } from './dto/carrier-status.object';
import { CarrierPanelResultObject } from './dto/carrier-panel-result.object';
import { DerivedCarrierObject } from './dto/derived-carrier.object';
import { PaginationInput } from '../../common/dto/pagination.input';

@Resolver(() => CarrierStatusObject)
export class CarrierResolver {
  constructor(private readonly carrierService: CarrierService) {}

  @Query(() => PaginatedCarrierStatus, { name: 'carrierStatus' })
  async findAll(
    @Args('vcfFileId', { nullable: true }) vcfFileId?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.carrierService.findAll(vcfFileId, pagination);
  }

  @Query(() => [CarrierPanelResultObject], { name: 'carrierPanel' })
  async carrierPanel(@Args('vcfFileId') vcfFileId: string) {
    return this.carrierService.findPanel(vcfFileId);
  }

  @Query(() => [DerivedCarrierObject], { name: 'derivedCarriers' })
  async derivedCarriers(@Args('vcfFileId') vcfFileId: string) {
    return this.carrierService.findDerivedCarriers(vcfFileId);
  }
}
