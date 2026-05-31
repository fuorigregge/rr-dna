import { Link } from '@tanstack/react-router';

export function VariantLink({ variantId }: { variantId?: string }) {
  if (!variantId) return null;
  return (
    <Link
      to="/variants/$id"
      params={{ id: variantId }}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>
      Vedi variante
    </Link>
  );
}
