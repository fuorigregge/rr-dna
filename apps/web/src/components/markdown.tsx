import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-sm text-muted-foreground leading-relaxed mb-2">{children}</p>,
        ul: ({ children }) => <ul className="text-sm text-muted-foreground list-disc pl-5 mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="text-sm text-muted-foreground list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
        em: ({ children }) => <em className="text-foreground/80">{children}</em>,
        code: ({ children }) => <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">{children}</code>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/30 pl-3 my-2 text-sm text-muted-foreground italic">{children}</blockquote>,
        table: ({ children }) => <table className="text-sm w-full border-collapse my-2">{children}</table>,
        th: ({ children }) => <th className="text-left font-medium text-foreground border-b border-border px-2 py-1">{children}</th>,
        td: ({ children }) => <td className="text-muted-foreground border-b border-border/50 px-2 py-1">{children}</td>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{children}</a>,
        hr: () => <hr className="border-border my-3" />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
