import { GraphQLClient } from 'graphql-request';

export const gqlClient = new GraphQLClient(new URL('/graphql', window.location.origin).href);

// Shared queries used across multiple pages
export const VCF_FILES_QUERY = `
  query VcfFiles {
    vcfFiles { id filename status totalVariants snpCount indelCount uploadDate }
  }
`;

export const DASHBOARD_STATS_QUERY = `
  query DashboardStats($vcfFileId: ID!) {
    dashboardStats(vcfFileId: $vcfFileId) {
      totalVariants snpCount indelCount heterozygousCount homozygousCount
      pathogenicCount pharmacogenomicCount carrierCount traitCount ancestryCount fitnessCount
    }
  }
`;

export const CHROMOSOME_SUMMARIES_QUERY = `
  query ChromosomeSummaries($vcfFileId: ID!) {
    chromosomeSummaries(vcfFileId: $vcfFileId) { chromosome variantCount pathogenicCount }
  }
`;

export const VCF_PROGRESS_QUERY = `
  query VcfFileProgress($id: ID!) {
    vcfFileProgress(id: $id) { status step percentage error }
  }
`;

// Notable findings extracted across all sections (dashboard + PDF report).
export const REPORT_HIGHLIGHTS_QUERY = `
  query ReportHighlights($vcfFileId: ID!) {
    reportHighlights(vcfFileId: $vcfFileId) { category gene title detail severity }
  }
`;

// Polygenic risk scores: include sia i curati (10 SNP top-hit) sia i PGS Catalog.
export const PRS_RESULTS_QUERY = `
  query PrsResults($vcfFileId: ID!) {
    prsResults(vcfFileId: $vcfFileId) {
      id traitKey trait label description pgsId source calibrationSource rawScore expectedMean expectedSd zScore percentile markersUsed markersTotal interpretation
    }
  }
`;
