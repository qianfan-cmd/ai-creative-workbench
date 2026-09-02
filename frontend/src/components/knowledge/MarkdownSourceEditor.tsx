import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { githubLight } from '@uiw/codemirror-theme-github'
import styles from './MarkdownSourceEditor.module.css'

interface MarkdownSourceEditorProps {
  value: string
  onChange: (value: string) => void
  plainText?: boolean // .txt 时不做 Markdown 高亮
  /** 父组件拿到底层 scroll 容器，后面做滚动同步用 */
  onScrollContainerReady?: (el: HTMLElement | null) => void
}

export default function MarkdownSourceEditor({
  value,
  onChange,
  plainText,
  onScrollContainerReady,
}: MarkdownSourceEditorProps) {
  // plainText 用空扩展；否则启用 Markdown +  fenced code 语言包
  const extensions = useMemo(
    () =>
      plainText
        ? []
        : [markdown({ base: markdownLanguage, codeLanguages: languages })],
    [plainText],
  )

  return (
    <CodeMirror
      className={styles.editor}
      value={value}
      theme={githubLight}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,       // 行号，和飞书/VS Code 类似
        foldGutter: false,         // 先关掉折叠，减少复杂度
        highlightActiveLine: true,
      }}
      onCreateEditor={(view) => {
        // CodeMirror 真正滚动的 DOM 是 view.scrollDOM，不是外层 div
        onScrollContainerReady?.(view.scrollDOM)
      }}
    />
  )
}