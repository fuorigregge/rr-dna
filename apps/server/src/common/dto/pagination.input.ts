import { InputType, Field, Int } from '@nestjs/graphql';
import { Min, Max, IsInt } from 'class-validator';

@InputType()
export class PaginationInput {
  @Min(0)
  @IsInt()
  @Field(() => Int, { defaultValue: 0 })
  offset!: number;

  @Min(1)
  @Max(500)
  @IsInt()
  @Field(() => Int, { defaultValue: 50 })
  limit!: number;
}
