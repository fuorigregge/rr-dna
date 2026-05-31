import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType('PharmacoResult')
export class PharmacoResultObject {
  @Field(() => ID)
  id!: string;

  @Field()
  gene!: string;

  @Field({ nullable: true })
  diplotype?: string;

  @Field({ nullable: true })
  phenotype?: string;

  @Field({ nullable: true })
  drugs?: string;

  @Field({ nullable: true })
  confidence?: string;
}
