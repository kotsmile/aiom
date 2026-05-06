import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  children: string
}

export function Markdown({ children }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        h1: ({ children }) => <h1 className="text-base font-bold mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-zinc-400 dark:border-zinc-500 pl-2 my-1 text-zinc-600 dark:text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-zinc-900 dark:text-zinc-100 underline underline-offset-2 decoration-zinc-400 dark:decoration-zinc-500 hover:decoration-zinc-700 dark:hover:decoration-zinc-300">
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-') || String(children).includes('\n')
          if (isBlock) {
            return <code className="font-mono text-[12.5px]">{children}</code>
          }
          return (
            <code className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded px-1.5 py-0.5 text-[12.5px] font-mono">
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="block bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 my-2 font-mono overflow-x-auto whitespace-pre">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <table className="border-collapse text-xs my-1">{children}</table>
        ),
        th: ({ children }) => (
          <th className="border border-zinc-300 dark:border-zinc-600 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 font-semibold text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-zinc-300 dark:border-zinc-600 px-2 py-1">{children}</td>
        ),
        hr: () => <hr className="border-zinc-300 dark:border-zinc-600 my-2" />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
