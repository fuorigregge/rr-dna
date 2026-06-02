import { ObjectType, Field, ID, Float, InputType, registerEnumType } from '@nestjs/graphql';
import { Sex } from '@prisma/client';

registerEnumType(Sex, { name: 'Sex' });

@ObjectType('PatientProfile')
export class PatientProfileObject {
  @Field(() => ID)
  id!: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field(() => Date, { nullable: true })
  birthDate?: Date;

  @Field(() => Sex, { nullable: true })
  sex?: Sex;

  @Field({ nullable: true })
  bloodType?: string;

  @Field(() => Float, { nullable: true })
  heightCm?: number;

  @Field(() => Float, { nullable: true })
  weightKg?: number;

  @Field({ nullable: true })
  notes?: string;
}

@InputType()
export class PatientProfileInput {
  @Field({ nullable: true })
  fullName?: string;

  @Field(() => Date, { nullable: true })
  birthDate?: Date;

  @Field(() => Sex, { nullable: true })
  sex?: Sex;

  @Field({ nullable: true })
  bloodType?: string;

  @Field(() => Float, { nullable: true })
  heightCm?: number;

  @Field(() => Float, { nullable: true })
  weightKg?: number;

  @Field({ nullable: true })
  notes?: string;
}
