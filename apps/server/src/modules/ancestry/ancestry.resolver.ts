import { Resolver, Query, Args } from '@nestjs/graphql';
import { AncestryService } from './ancestry.service';
import { AncestryMarkerObject, PaginatedAncestryMarkers } from './dto/ancestry-marker.object';
import { AncestryAffinityObject } from './dto/ancestry-affinity.object';
import { HaplogroupObject } from './dto/haplogroup.object';
import { NeanderthalResultObject } from './dto/neanderthal.object';
import { PaginationInput } from '../../common/dto/pagination.input';

@Resolver(() => AncestryMarkerObject)
export class AncestryResolver {
  constructor(private readonly ancestryService: AncestryService) {}

  @Query(() => PaginatedAncestryMarkers, { name: 'ancestryMarkers' })
  async findAll(
    @Args('vcfFileId', { nullable: true }) vcfFileId?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationInput,
  ) {
    return this.ancestryService.findAll(vcfFileId, pagination);
  }

  @Query(() => [AncestryAffinityObject], { name: 'ancestryAffinity' })
  async affinity(@Args('vcfFileId') vcfFileId: string) {
    return this.ancestryService.affinity(vcfFileId);
  }

  @Query(() => [HaplogroupObject], { name: 'haplogroups' })
  async haplogroups(@Args('vcfFileId') vcfFileId: string) {
    return this.ancestryService.findHaplogroups(vcfFileId);
  }

  @Query(() => NeanderthalResultObject, { name: 'neanderthal', nullable: true })
  async neanderthal(@Args('vcfFileId') vcfFileId: string) {
    return this.ancestryService.findNeanderthal(vcfFileId);
  }
}
