import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType('DiseaseRiskCounts')
export class DiseaseRiskCountsObject {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  pathogenic!: number;

  @Field(() => Int)
  likelyPathogenic!: number;

  @Field(() => Int)
  uncertain!: number;

  @Field(() => Int)
  likelyBenign!: number;

  @Field(() => Int)
  benign!: number;
}
