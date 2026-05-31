import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType('VcfFile')
export class VcfFileObject {
  @Field(() => ID)
  id!: string;

  @Field()
  filename!: string;

  @Field()
  status!: string;

  @Field(() => Int)
  totalVariants!: number;

  @Field(() => Int)
  snpCount!: number;

  @Field(() => Int)
  indelCount!: number;

  @Field()
  uploadDate!: Date;

  @Field()
  createdAt!: Date;
}
