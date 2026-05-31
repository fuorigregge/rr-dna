import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType('ChromosomeSummary')
export class ChromosomeSummaryObject {
  @Field(() => ID)
  id!: string;

  @Field()
  vcfFileId!: string;

  @Field()
  chromosome!: string;

  @Field(() => Int)
  variantCount!: number;

  @Field(() => Int)
  snpCount!: number;

  @Field(() => Int)
  indelCount!: number;

  @Field(() => Int)
  pathogenicCount!: number;

  @Field(() => Int)
  pharmacogenomicCount!: number;
}
