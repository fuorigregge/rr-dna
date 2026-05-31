import { TableRow, TableCell } from '@/components/ui/table';

interface MetadataLinks {
  [label: string]: string;
}

interface Metadata {
  description?: string;
  links?: MetadataLinks;
  reproductive_risk?: string;
}

interface MetadataRowProps {
  id: string;
  metadata: Metadata | null | undefined;
  colSpan: number;
  showReproductiveRisk?: boolean;
}

export function MetadataRow({ id, metadata, colSpan, showReproductiveRisk }: MetadataRowProps) {
  if (!metadata) return null;

  const hasContent = metadata.description || metadata.links || (showReproductiveRisk && metadata.reproductive_risk);
  if (!hasContent) return null;

  return (
    <TableRow key={`${id}-meta`}>
      <TableCell colSpan={colSpan} className="pt-0 pb-3 whitespace-normal">
        {metadata.description && (
          <p className="text-sm text-muted-foreground mb-2">{metadata.description}</p>
        )}
        {showReproductiveRisk && metadata.reproductive_risk && (
          <p className="text-sm text-orange-600 dark:text-orange-400 mb-2">{metadata.reproductive_risk}</p>
        )}
        {metadata.links && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(metadata.links).map(([label, url]) => (
              <a
                key={label}
                href={url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                {label} ↗
              </a>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
