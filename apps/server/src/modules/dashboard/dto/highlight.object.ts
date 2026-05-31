import { ObjectType, Field } from '@nestjs/graphql';

// A single extracted "notable finding" surfaced on the dashboard and in the PDF
// report. Kept deliberately flat/generic so the UI can render a mixed list.
@ObjectType('Highlight')
export class HighlightObject {
  @Field()
  category!: string; // disease | acmg | carrier | pharma | trait | haplogroup

  @Field({ nullable: true })
  gene?: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  detail?: string;

  @Field()
  severity!: string; // high | medium | info
}
