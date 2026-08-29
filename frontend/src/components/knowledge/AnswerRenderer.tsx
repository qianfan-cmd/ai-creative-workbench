import { Fragment, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.min.css'
import styles from '@/components/knowledge/AnswerRenderer.module.css'

/** 与 KnowledgePage RagPhase 对齐 */
type RagPhase = 'retrieving' | 'generating' | 'done' | 'error'

export interface AnswerRendererProps {
    answer: string
    phase?: RagPhase
    streaming?: boolean
}

/**
 * 把正文里的 [1]、[2] 拆成普通文字 + 角标 sup。
 * 流式 / Markdown 渲染共用，保证 References 编号与正文一致。
 */
function parseCiteBadges(text: string): ReactNode[] {
    const parts = text.split(/(\[\d+\])/)
    return parts.map((part, i) => {
        if (/^\[\d+\]$/.test(part)) {
            return (
                <sup key={i} className={styles.cite}>
                    {part}
                </sup>
            )
        }
        return part ? <Fragment key={i}>{part}</Fragment> : null
    })
}

/** ReactMarkdown 文本节点：在 Markdown 段落内也渲染 [n] 角标 */
function MarkdownText({ children }: { children?: ReactNode }) {
    if (typeof children !== 'string') return <>{children}</>
    return <>{parseCiteBadges(children)}</>
}

/**
 * Markdown 元素 → CSS Modules 映射
 * 配合 remark-gfm（表格）+ rehype-highlight（代码高亮）
 */
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
        <a
            href={href}
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
        >
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
        // rehype-highlight 会给 fenced code 加上 hljs class
        if (className) return <code className={className}>{children}</code>
        return <code className={styles.inlineCode}>{children}</code>
    },
    text: ({ children }) => <MarkdownText>{children}</MarkdownText>,
}

/**
 * Markdown 正文 — 流式与完成态共用同一套渲染（接近 Cursor 边生成边排版）
 * 极端情况下半个表格可能闪一下，流结束后会自动修正。
 */
function MarkdownBody({ answer, streaming }: { answer: string; streaming?: boolean }) {
    return (
        <div className={styles.prose}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
            >
                {answer}
            </ReactMarkdown>
            {streaming && answer && (
                <span className={styles.cursor} aria-hidden="true" />
            )}
        </div>
    )
}

/**
 * RAG 回答渲染器
 */
export default function AnswerRenderer({ answer, phase, streaming }: AnswerRendererProps) {
    if (phase === 'retrieving') {
        return <span className={styles.statusText}>正在检索相关文档…</span>
    }
    if (phase === 'generating' && !answer) {
        return <span className={styles.statusText}>正在生成回复…</span>
    }

    if (!answer && !streaming) return null

    return <MarkdownBody answer={answer} streaming={streaming} />
}
