import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('VariantAnnotation')
export class VariantAnnotationObject {
  @Field(() => ID)
  id!: string;

  @Field()
  variantId!: string;

  @Field()
  source!: string;

  @Field({ nullable: true })
  gene?: string;

  @Field({ nullable: true })
  consequence?: string;

  @Field({ nullable: true })
  impact?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  data?: any;
}
