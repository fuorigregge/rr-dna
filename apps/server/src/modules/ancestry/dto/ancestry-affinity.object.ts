import { ObjectType, Field, Float, Int } from '@nestjs/graphql';

@ObjectType('AncestryAffinity')
export class AncestryAffinityObject {
  @Field()
  population!: string;

  @Field(() => Float)
  totalLogLik!: number;

  @Field(() => Float)
  meanLogLik!: number;

  @Field(() => Float)
  relativeScore!: number;

  @Field(() => Int)
  markerCount!: number;
}
