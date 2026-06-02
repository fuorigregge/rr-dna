import { Module } from '@nestjs/common';
import { CartellaService } from './cartella.service';
import { CartellaResolver } from './cartella.resolver';

@Module({
  providers: [CartellaService, CartellaResolver],
})
export class CartellaModule {}
