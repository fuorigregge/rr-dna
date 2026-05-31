import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnnotationsService {
  private readonly workerUrl: string;

  constructor(private readonly prisma: PrismaService) {
    this.workerUrl = process.env.DNA_WORKER_URL || 'http://localhost:8000';
  }

  async findByVariant(variantId: string) {
    return this.prisma.variantAnnotation.findMany({
      where: { variantId },
    });
  }

  async enrichVariant(variantId: string) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(`${this.workerUrl}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          chromosome: variant.chromosome,
          position: variant.position,
          ref: variant.ref,
          alt: variant.alt,
          rsId: variant.rsId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }

  async enrichTraits(variantId: string) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant || !variant.rsId) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch(`${this.workerUrl}/enrich-traits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variant.id, rsId: variant.rsId }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  }
}
