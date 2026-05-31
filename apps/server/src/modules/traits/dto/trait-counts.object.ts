import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType('TraitCounts')
export class TraitCountsObject {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  metabolism!: number;

  @Field(() => Int)
  physical!: number;

  @Field(() => Int)
  cognitive!: number;
}
