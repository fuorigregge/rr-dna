import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Paginated } from '../../../common/dto/paginated.factory';

@ObjectType('PharmacogenomicsResult')
export class PharmacogenomicsObject {
  @Field(() => ID)
  id!: string;

  @Field()
  variantId!: string;

  @Field()
  drug!: string;

  @Field({ nullable: true })
  effect?: string;

  @Field({ nullable: true })
  metabolizerStatus?: string;

  @Field()
  source!: string;

  @Field({ nullable: true })
  evidenceLevel?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;
}

@ObjectType()
export class PaginatedPharmacogenomics extends Paginated(PharmacogenomicsObject) {}
