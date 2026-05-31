import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('AcmgResult')
export class AcmgResultObject {
  @Field(() => ID)
  id!: string;

  @Field()
  rsId!: string;

  @Field()
  gene!: string;

  @Field()
  variantName!: string;

  @Field()
  condition!: string;

  @Field({ nullable: true })
  inheritance?: string;

  @Field()
  state!: string;

  @Field({ nullable: true })
  genotype?: string;

  @Field({ nullable: true })
  zygosity?: string;

  @Field({ nullable: true })
  interpretation?: string;

  @Field({ nullable: true })
  confidence?: string;
}
