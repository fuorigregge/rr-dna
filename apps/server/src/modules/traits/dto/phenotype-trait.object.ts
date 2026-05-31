import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Paginated } from '../../../common/dto/paginated.factory';

@ObjectType('PhenotypeTraitResult')
export class PhenotypeTraitObject {
  @Field(() => ID)
  id!: string;

  @Field()
  variantId!: string;

  @Field()
  trait!: string;

  @Field({ nullable: true })
  effect?: string;

  @Field({ nullable: true })
  category?: string;

  @Field()
  source!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;
}

@ObjectType()
export class PaginatedPhenotypeTraits extends Paginated(PhenotypeTraitObject) {}
