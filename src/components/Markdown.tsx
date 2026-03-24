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
          <blockquote className="border-l-2 border-gray-400 pl-2 my-1 text-gray-600 italic">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block bg-gray-800 text-gray-100 rounded px-2.5 py-2 my-1 text-xs font-mono overflow-x-auto whitespace-pre">
                {children}
              </code>
            )
          }
          return (
            <code className="bg-gray-300/50 text-red-700 rounded px-1 py-0.5 text-xs font-mono">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="my-1 last:my-0">{children}</pre>,
        table: ({ children }) => (
          <table className="border-collapse text-xs my-1">{children}</table>
        ),
        th: ({ children }) => (
          <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-semibold text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 px-2 py-1">{children}</td>
        ),
        hr: () => <hr className="border-gray-300 my-2" />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
