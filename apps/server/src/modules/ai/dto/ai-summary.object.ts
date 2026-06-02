import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('AiSummary')
export class AiSummaryObject {
  @Field(() => ID)
  id!: string;

  @Field()
  vcfFileId!: string;

  @Field()
  type!: string;

  @Field()
  summary!: string;

  @Field({ nullable: true })
  detail?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
