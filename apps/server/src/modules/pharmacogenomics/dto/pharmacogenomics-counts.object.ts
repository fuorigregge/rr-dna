import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType('PharmacogenomicsCounts')
export class PharmacogenomicsCountsObject {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  contraindicated!: number;

  @Field(() => Int)
  sensitivity!: number;

  @Field(() => Int)
  altered!: number;
}
