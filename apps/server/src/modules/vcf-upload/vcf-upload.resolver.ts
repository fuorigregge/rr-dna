import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { VcfUploadService } from './vcf-upload.service';
import { VcfFileObject } from './dto/vcf-file.object';
import { VcfFileProgressObject } from './dto/vcf-file-status.object';

@Resolver(() => VcfFileObject)
export class VcfUploadResolver {
  constructor(private readonly vcfUploadService: VcfUploadService) {}

  @Query(() => [VcfFileObject], { name: 'vcfFiles' })
  async findAll() {
    return this.vcfUploadService.findAll();
  }

  @Query(() => VcfFileObject, { name: 'vcfFile', nullable: true })
  async findOne(@Args('id', { type: () => ID }) id: string) {
    return this.vcfUploadService.findOne(id);
  }

  @Mutation(() => Boolean, { name: 'deleteVcfFile' })
  async deleteVcfFile(@Args('id', { type: () => ID }) id: string) {
    await this.vcfUploadService.delete(id);
    return true;
  }

  @Query(() => VcfFileProgressObject, { name: 'vcfFileProgress' })
  async getProgress(@Args('id', { type: () => ID }) id: string) {
    return this.vcfUploadService.getProgress(id);
  }
}
