import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Paginated } from '../../../common/dto/paginated.factory';
import { VariantAnnotationObject } from '../../annotations/dto/variant-annotation.object';
import { DiseaseRiskObject } from '../../diseases/dto/disease-risk.object';
import { PharmacogenomicsObject } from '../../pharmacogenomics/dto/pharmacogenomics.object';
import { CarrierStatusObject } from '../../carrier/dto/carrier-status.object';
import { AncestryMarkerObject } from '../../ancestry/dto/ancestry-marker.object';
import { PhenotypeTraitObject } from '../../traits/dto/phenotype-trait.object';

@ObjectType('Variant')
export class VariantObject {
  @Field(() => ID)
  id!: string;

  @Field()
  vcfFileId!: string;

  @Field()
  chromosome!: string;

  @Field(() => Int)
  position!: number;

  @Field({ nullable: true })
  rsId?: string;

  @Field()
  ref!: string;

  @Field()
  alt!: string;

  @Field(() => Float, { nullable: true })
  quality?: number;

  @Field({ nullable: true })
  filter?: string;

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

  @Field({ nullable: true })
  notes?: string;

  @Field(() => [VariantAnnotationObject], { nullable: true })
  annotations?: VariantAnnotationObject[];

  @Field(() => [DiseaseRiskObject], { nullable: true })
  diseases?: DiseaseRiskObject[];

  @Field(() => [PharmacogenomicsObject], { nullable: true })
  pharma?: PharmacogenomicsObject[];

  @Field(() => [CarrierStatusObject], { nullable: true })
  carrier?: CarrierStatusObject[];

  @Field(() => [AncestryMarkerObject], { nullable: true })
  ancestry?: AncestryMarkerObject[];

  @Field(() => [PhenotypeTraitObject], { nullable: true })
  traits?: PhenotypeTraitObject[];
}

@ObjectType()
export class PaginatedVariants extends Paginated(VariantObject) {}
