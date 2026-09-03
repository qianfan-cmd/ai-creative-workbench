import { QuestionCircleOutlined } from '@ant-design/icons'
import { Modal } from 'antd'
import { useState } from 'react'
import {
  PROMPT_TEMPLATE_GUIDE_SECTIONS,
  type PromptTemplateHelpVariant,
} from '@/components/settings/promptTemplateGuide'
import styles from '@/components/settings/PromptTemplateHelp.module.css'

interface PromptTemplateHelpProps {
  variant?: PromptTemplateHelpVariant
  className?: string
}

const MODAL_TITLES: Record<PromptTemplateHelpVariant, string> = {
  copyStyle: '文案风格模板说明',
  visualStyle: '视觉风格说明',
  full: 'Prompt 模板使用说明',
}

export default function PromptTemplateHelp({
  variant = 'full',
  className,
}: PromptTemplateHelpProps) {
  const [open, setOpen] = useState(false)
  const sections = PROMPT_TEMPLATE_GUIDE_SECTIONS[variant]

  return (
    <>
      <button
        type="button"
        className={[styles.trigger, className].filter(Boolean).join(' ')}
        aria-label="模板使用说明"
        onClick={() => setOpen(true)}
      >
        <QuestionCircleOutlined />
      </button>
      <Modal
        title={MODAL_TITLES[variant]}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <div className={styles.modalBody}>
          {sections.map((section) => (
            <section key={section.id} className={styles.section}>
              <h4 className={styles.sectionTitle}>{section.title}</h4>
              {section.paragraphs?.map((p) => (
                <p key={p} className={styles.paragraph}>
                  {p}
                </p>
              ))}
              {section.bullets ? (
                <ul className={styles.list}>
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.example ? (
                <pre className={styles.example}>{section.example}</pre>
              ) : null}
            </section>
          ))}
        </div>
      </Modal>
    </>
  )
}
