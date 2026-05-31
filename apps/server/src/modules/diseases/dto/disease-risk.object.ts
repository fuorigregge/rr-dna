import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { Paginated } from '../../../common/dto/paginated.factory';

// Minimal call-quality view of the underlying variant, so the diseases list can
// flag low-confidence calls (atypical allele balance / low depth) without a
// circular import of the full VariantObject.
@ObjectType('VariantCall')
export class VariantCallObject {
  @Field(() => ID)
  id!: string;

  @Field({ nullable: true })
  rsId?: string;

  @Field({ nullable: true })
  gene?: string;

  @Field({ nullable: true })
  genotype?: string;

  @Field({ nullable: true })
  zygosity?: string;

  @Field(() => Int, { nullable: true })
  depth?: number;

  @Field(() => Float, { nullable: true })
  vaf?: number;

  @Field()
  lowConfidence!: boolean;
}

@ObjectType('DiseaseRisk')
export class DiseaseRiskObject {
  @Field(() => ID)
  id!: string;

  @Field()
  variantId!: string;

  @Field()
  disease!: string;

  @Field()
  significance!: string;

  @Field()
  source!: string;

  @Field({ nullable: true })
  evidenceLevel?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: any;

  @Field(() => VariantCallObject, { nullable: true })
  variant?: VariantCallObject;
}

@ObjectType()
export class PaginatedDiseaseRisks extends Paginated(DiseaseRiskObject) {}
