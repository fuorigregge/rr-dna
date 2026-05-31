import { Module } from '@nestjs/common';
import { CarrierService } from './carrier.service';
import { CarrierResolver } from './carrier.resolver';

@Module({
  providers: [CarrierService, CarrierResolver],
  exports: [CarrierService],
})
export class CarrierModule {}
