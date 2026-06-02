import { ObjectType, Field, ID, Float, InputType } from '@nestjs/graphql';

@ObjectType('LabResult')
export class LabResultObject {
  @Field(() => ID)
  id!: string;

  @Field()
  analyte!: string;

  @Field(() => Float)
  value!: number;

  @Field()
  unit!: string;

  @Field(() => Date)
  measuredAt!: Date;

  @Field(() => Float, { nullable: true })
  refLow?: number;

  @Field(() => Float, { nullable: true })
  refHigh?: number;

  @Field({ nullable: true })
  refText?: string;

  // Collega l'esame al finding genomico (es. "LPA_PGS", "rs1801133").
  @Field({ nullable: true })
  geneticKey?: string;

  @Field({ nullable: true })
  notes?: string;
}

@InputType()
export class LabResultInput {
  @Field()
  analyte!: string;

  @Field(() => Float)
  value!: number;

  @Field()
  unit!: string;

  @Field(() => Date)
  measuredAt!: Date;

  @Field(() => Float, { nullable: true })
  refLow?: number;

  @Field(() => Float, { nullable: true })
  refHigh?: number;

  @Field({ nullable: true })
  refText?: string;

  @Field({ nullable: true })
  geneticKey?: string;

  @Field({ nullable: true })
  notes?: string;
}
