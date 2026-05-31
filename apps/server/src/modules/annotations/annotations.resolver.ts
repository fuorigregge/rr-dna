import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { AnnotationsService } from './annotations.service';
import { VariantAnnotationObject } from './dto/variant-annotation.object';

@Resolver(() => VariantAnnotationObject)
export class AnnotationsResolver {
  constructor(private readonly annotationsService: AnnotationsService) {}

  @Query(() => [VariantAnnotationObject], { name: 'variantAnnotations' })
  async findByVariant(@Args('variantId', { type: () => ID }) variantId: string) {
    return this.annotationsService.findByVariant(variantId);
  }

  @Mutation(() => Boolean, { name: 'enrichVariant' })
  async enrichVariant(@Args('variantId', { type: () => ID }) variantId: string) {
    const result = await this.annotationsService.enrichVariant(variantId);
    return result !== null;
  }

  @Mutation(() => Boolean, { name: 'enrichTraits' })
  async enrichTraits(@Args('variantId', { type: () => ID }) variantId: string) {
    const result = await this.annotationsService.enrichTraits(variantId);
    return result !== null;
  }
}
