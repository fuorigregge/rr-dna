import { Module } from '@nestjs/common';
import { FitnessService } from './fitness.service';
import { FitnessResolver } from './fitness.resolver';

@Module({
  providers: [FitnessService, FitnessResolver],
  exports: [FitnessService],
})
export class FitnessModule {}
