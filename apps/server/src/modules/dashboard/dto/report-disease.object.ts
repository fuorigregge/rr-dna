import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

// Reperto malattia arricchito col verdetto di attendibilità (vedi disease-verdict.ts).
// Usato dal referto PDF per separare i reperti solidi dai probabili falsi positivi.
@ObjectType('ReportDisease')
export class ReportDiseaseObject {
  @Field(() => ID)
  id!: string;

  @Field()
  disease!: string;

  @Field({ nullable: true })
  gene?: string;

  @Field()
  significance!: string;

  @Field(() => Int, { nullable: true })
  stars?: number;

  @Field({ nullable: true })
  rsId?: string;

  @Field({ nullable: true })
  genotype?: string;

  @Field({ nullable: true })
  zygosity?: string;

  @Field(() => Float, { nullable: true })
  vaf?: number;

  @Field(() => Int, { nullable: true })
  depth?: number;

  @Field()
  lowConfidence!: boolean;

  // Frequenza allelica gnomAD: popmax (grpmax) e non-Finnish European.
  @Field(() => Float, { nullable: true })
  populationAf?: number;

  @Field(() => Float, { nullable: true })
  populationAfNfe?: number;

  // 'solid' | 'review' | 'likely_false_positive'
  @Field()
  verdict!: string;

  @Field()
  reason!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  clinvarUrl?: string;

  @Field({ nullable: true })
  omimUrl?: string;
}
