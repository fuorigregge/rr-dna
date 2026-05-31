import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { AiService } from './ai.service';
import { AiSummaryObject } from './dto/ai-summary.object';

@Resolver(() => AiSummaryObject)
export class AiResolver {
  constructor(private readonly aiService: AiService) {}

  @Query(() => AiSummaryObject, { name: 'aiSummary', nullable: true })
  async findSummary(
    @Args('vcfFileId') vcfFileId: string,
    @Args('type') type: string,
  ) {
    return this.aiService.findSummary(vcfFileId, type);
  }

  @Mutation(() => AiSummaryObject, { name: 'generateAiSummary' })
  async generateSummary(
    @Args('vcfFileId') vcfFileId: string,
    @Args('type') type: string,
  ) {
    return this.aiService.generateSummary(vcfFileId, type);
  }
}
