import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType('Haplogroup')
export class HaplogroupObject {
  @Field(() => ID)
  id!: string;

  @Field()
  lineage!: string;

  @Field()
  haplogroup!: string;

  @Field({ nullable: true })
  detail?: string;

  @Field(() => Float, { nullable: true })
  quality?: number;

  @Field({ nullable: true })
  source?: string;

  @Field({ nullable: true })
  interpretation?: string;
}
