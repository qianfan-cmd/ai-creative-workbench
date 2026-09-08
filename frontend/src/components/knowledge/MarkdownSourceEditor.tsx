import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { githubLight } from '@uiw/codemirror-theme-github'
import styles from './MarkdownSourceEditor.module.css'

interface MarkdownSourceEditorProps {
  value: string
  onChange: (value: string) => void
  plainText?: boolean
  /** 父组件拿到底层 scroll 容器，后面做滚动同步用 */
  onScrollContainerReady?: (el: HTMLElement | null) => void
}

export default function MarkdownSourceEditor({
  value,
  onChange,
  plainText,
  onScrollContainerReady,
}: MarkdownSourceEditorProps) {
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
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
      }}
      onCreateEditor={(view) => {
        onScrollContainerReady?.(view.scrollDOM)
      }}
    />
  )
}
