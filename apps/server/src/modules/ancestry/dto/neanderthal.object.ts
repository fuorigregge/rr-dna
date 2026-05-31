import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

// Stima dell'eredità neandertaliana dai tag-SNP introgressi (Vernot & Akey 2016, EUR).
@ObjectType('NeanderthalResult')
export class NeanderthalResultObject {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  panelSites!: number;

  @Field(() => Int)
  coveredSites!: number;

  @Field(() => Int)
  archaicAlleles!: number;

  @Field(() => Float)
  observedFraction!: number;

  @Field(() => Float)
  expectedFraction!: number;

  // carico relativo vs media europea (1.0 = media)
  @Field(() => Float)
  relativeLoad!: number;

  // stima % di DNA neandertaliano del genoma (calibrata su media EUR ~1.9%)
  @Field(() => Float)
  estPercent!: number;
}
