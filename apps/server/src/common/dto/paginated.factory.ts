import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Type } from '@nestjs/common';

export function Paginated<T>(classRef: Type<T>) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedType {
    @Field(() => [classRef])
    items!: T[];

    @Field(() => Int)
    total!: number;

    @Field()
    hasMore!: boolean;
  }
  return PaginatedType as Type<{ items: T[]; total: number; hasMore: boolean }>;
}
