import { Module } from '@nestjs/common';
import { AnnotationsService } from './annotations.service';
import { AnnotationsResolver } from './annotations.resolver';

@Module({
  providers: [AnnotationsService, AnnotationsResolver],
  exports: [AnnotationsService],
})
export class AnnotationsModule {}
