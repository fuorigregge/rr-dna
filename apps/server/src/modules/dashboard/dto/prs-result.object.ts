import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType('PrsResult')
export class PrsResultObject {
  @Field(() => ID)
  id!: string;

  @Field()
  traitKey!: string;

  @Field()
  trait!: string;

  @Field()
  label!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  pgsId?: string;

  @Field({ nullable: true })
  source?: string;

  @Field({ nullable: true })
  calibrationSource?: string; // empirical_1000G_EUR | hardy_weinberg_file_AF | null

  @Field(() => Float)
  rawScore!: number;

  @Field(() => Float, { nullable: true })
  expectedMean?: number;

  @Field(() => Float, { nullable: true })
  expectedSd?: number;

  @Field(() => Float, { nullable: true })
  zScore?: number;

  @Field(() => Float, { nullable: true })
  percentile?: number;

  @Field(() => Int)
  markersUsed!: number;

  @Field(() => Int)
  markersTotal!: number;

  @Field({ nullable: true })
  interpretation?: string;
}
