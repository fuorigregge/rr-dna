import { useQuery } from '@tanstack/react-query';
import { gqlClient, VCF_FILES_QUERY } from './graphql-client';

/**
 * Returns the most recent completed VCF file.
 * Used across all analysis pages to scope queries to a specific genome.
 */
export function useActiveVcf() {
  const { data, isLoading } = useQuery({
    queryKey: ['vcfFiles'],
    queryFn: () => gqlClient.request<any>(VCF_FILES_QUERY),
    staleTime: 30_000,
  });

  const activeFile = data?.vcfFiles?.find((f: any) => f.status === 'COMPLETED') ?? null;

  return { activeFile, isLoading };
}
