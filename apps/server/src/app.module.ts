import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './health/health.module';
import { VcfUploadModule } from './modules/vcf-upload/vcf-upload.module';
import { VariantsModule } from './modules/variants/variants.module';
import { AnnotationsModule } from './modules/annotations/annotations.module';
import { DiseasesModule } from './modules/diseases/diseases.module';
import { PharmacogenomicsModule } from './modules/pharmacogenomics/pharmacogenomics.module';
import { CarrierModule } from './modules/carrier/carrier.module';
import { AncestryModule } from './modules/ancestry/ancestry.module';
import { TraitsModule } from './modules/traits/traits.module';
import { FitnessModule } from './modules/fitness/fitness.module';
import { ChromosomesModule } from './modules/chromosomes/chromosomes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { TraitPanelModule } from './modules/trait-panel/trait-panel.module';
import { CartellaModule } from './modules/cartella/cartella.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HealthModule,
    VcfUploadModule,
    VariantsModule,
    AnnotationsModule,
    DiseasesModule,
    PharmacogenomicsModule,
    CarrierModule,
    AncestryModule,
    TraitsModule,
    FitnessModule,
    ChromosomesModule,
    DashboardModule,
    AiModule,
    TraitPanelModule,
    CartellaModule,
    BullModule.forRootAsync({
      useFactory: () => {
        const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            ...(url.password && { password: decodeURIComponent(url.password) }),
          },
        };
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      playground: true,
    }),
  ],
})
export class AppModule {}
