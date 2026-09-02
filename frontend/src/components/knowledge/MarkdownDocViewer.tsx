import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.min.css'
import styles from '@/components/knowledge/AnswerRenderer.module.css'

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={styles.h4}>{children}</h4>,
  p: ({ children }) => <p className={styles.paragraph}>{children}</p>,
  ul: ({ children }) => <ul className={styles.list}>{children}</ul>,
  ol: ({ children }) => <ol className={styles.listOrdered}>{children}</ol>,
  li: ({ children }) => <li className={styles.listItem}>{children}</li>,
  strong: ({ children }) => <strong className={styles.strong}>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className={styles.blockquote}>{children}</blockquote>
  ),
  hr: () => <hr className={styles.hr} />,
  a: ({ href, children }) => (
    <a href={href} className={styles.link} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className={styles.thead}>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th className={styles.th}>{children}</th>,
  td: ({ children }) => <td className={styles.td}>{children}</td>,
  pre: ({ children }) => <pre className={styles.pre}>{children}</pre>,
  code: ({ className, children }) => {
    if (className) return <code className={className}>{children}</code>
    return <code className={styles.inlineCode}>{children}</code>
  },
}

interface MarkdownDocViewerProps {
  content: string
  plainText?: boolean
  className?: string
}

export default function MarkdownDocViewer({
  content,
  plainText,
  className,
}: MarkdownDocViewerProps) {
  if (plainText) {
    return (
      <pre className={[styles.pre, className].filter(Boolean).join(' ')}>{content}</pre>
    )
  }

  return (
    <div className={[styles.prose, className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
