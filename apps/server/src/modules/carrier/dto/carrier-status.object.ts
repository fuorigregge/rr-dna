import { ObjectType, Field, ID } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Paginated } from '../../../common/dto/paginated.factory';

@ObjectType('CarrierStatusResult')
export class CarrierStatusObject {
  @Field(() => ID)
  id!: string;

  @Field()
  variantId!: string;

  @Field()
  condition!: string;

  @Field({ nullable: true })
  inheritancePattern?: string;

  @Field({ nullable: true })
  carrierType?: string;

  @Field()
  source!: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;
}

@ObjectType()
export class PaginatedCarrierStatus extends Paginated(CarrierStatusObject) {}
