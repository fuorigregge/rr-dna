import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType('DashboardStats')
export class DashboardStatsObject {
  @Field(() => Int)
  totalVariants!: number;

  @Field(() => Int)
  snpCount!: number;

  @Field(() => Int)
  indelCount!: number;

  @Field(() => Int)
  heterozygousCount!: number;

  @Field(() => Int)
  homozygousCount!: number;

  @Field(() => Int)
  pathogenicCount!: number;

  @Field(() => Int)
  pharmacogenomicCount!: number;

  @Field(() => Int)
  carrierCount!: number;

  @Field(() => Int)
  traitCount!: number;

  @Field(() => Int)
  ancestryCount!: number;

  @Field(() => Int)
  fitnessCount!: number;
}
