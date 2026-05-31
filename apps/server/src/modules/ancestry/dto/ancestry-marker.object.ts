import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Paginated } from '../../../common/dto/paginated.factory';

@ObjectType('AncestryMarkerResult')
export class AncestryMarkerObject {
  @Field(() => ID)
  id!: string;

  @Field()
  variantId!: string;

  @Field({ nullable: true })
  haplogroup?: string;

  @Field({ nullable: true })
  population?: string;

  @Field(() => Float, { nullable: true })
  frequency?: number;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;
}

@ObjectType()
export class PaginatedAncestryMarkers extends Paginated(AncestryMarkerObject) {}
