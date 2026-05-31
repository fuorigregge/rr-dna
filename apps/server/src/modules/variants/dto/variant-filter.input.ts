import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class VariantFilterInput {
  @Field({ nullable: true })
  vcfFileId?: string;

  @Field({ nullable: true })
  chromosome?: string;

  @Field({ nullable: true })
  gene?: string;

  @Field({ nullable: true })
  rsId?: string;

  @Field({ nullable: true })
  zygosity?: string;

  @Field({ nullable: true })
  impact?: string;
}
