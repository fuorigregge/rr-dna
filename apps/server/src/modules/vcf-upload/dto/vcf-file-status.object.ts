import { ObjectType, Field, Int, Float } from '@nestjs/graphql';

@ObjectType('VcfFileProgress')
export class VcfFileProgressObject {
  @Field()
  status!: string;

  @Field()
  step!: string;

  @Field(() => Float)
  percentage!: number;

  @Field(() => Int, { nullable: true })
  currentBatch?: number;

  @Field(() => Int, { nullable: true })
  totalBatches?: number;

  @Field({ nullable: true })
  error?: string;
}
