import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

// Portatore di malattia recessiva derivato da un reperto patogenico eterozigote
// ClinVar (non coperto dal pannello curato): es. ATM, DNAI1.
@ObjectType('DerivedCarrier')
export class DerivedCarrierObject {
  @Field(() => ID)
  id!: string;

  @Field()
  gene!: string;

  @Field()
  condition!: string;

  @Field({ nullable: true })
  rsId?: string;

  @Field({ nullable: true })
  genotype?: string;

  @Field({ nullable: true })
  zygosity?: string;

  @Field()
  inheritance!: string;

  // 'CARRIER' | 'AFFECTED'
  @Field()
  state!: string;

  @Field(() => Int, { nullable: true })
  stars?: number;

  @Field({ nullable: true })
  note?: string;
}
