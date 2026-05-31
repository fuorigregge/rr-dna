import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { DashboardService } from './dashboard.service';
import { DashboardStatsObject } from './dto/dashboard.object';
import { HighlightObject } from './dto/highlight.object';
import { PrsResultObject } from './dto/prs-result.object';
import { ReportDiseaseObject } from './dto/report-disease.object';

@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => DashboardStatsObject, { name: 'dashboardStats', nullable: true })
  async getStats(@Args('vcfFileId', { type: () => ID }) vcfFileId: string) {
    return this.dashboardService.getStats(vcfFileId);
  }

  @Query(() => [HighlightObject], { name: 'reportHighlights' })
  async getHighlights(@Args('vcfFileId', { type: () => ID }) vcfFileId: string) {
    return this.dashboardService.getHighlights(vcfFileId);
  }

  @Query(() => [PrsResultObject], { name: 'prsResults' })
  async getPrsResults(@Args('vcfFileId', { type: () => ID }) vcfFileId: string) {
    return this.dashboardService.getPrsResults(vcfFileId);
  }

  @Query(() => [ReportDiseaseObject], { name: 'reportDiseases' })
  async getReportDiseases(@Args('vcfFileId', { type: () => ID }) vcfFileId: string) {
    return this.dashboardService.getReportDiseases(vcfFileId);
  }
}
