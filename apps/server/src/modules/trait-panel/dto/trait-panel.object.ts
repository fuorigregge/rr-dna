import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('TraitPanelResult')
export class TraitPanelResultObject {
  @Field(() => ID)
  id!: string;

  @Field()
  rsId!: string;

  @Field({ nullable: true })
  gene?: string;

  @Field()
  trait!: string;

  @Field({ nullable: true })
  category?: string;

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

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;
}
