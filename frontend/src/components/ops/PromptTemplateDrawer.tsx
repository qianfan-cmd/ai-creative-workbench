import { useState } from 'react'
import { Drawer, Segmented } from 'antd'
import { useNavigate } from 'react-router-dom'
import PromptTemplateManager from '@/components/settings/PromptTemplateManager'
import styles from '@/components/ops/PromptTemplateDrawer.module.css'

type StyleKind = 'copy_style' | 'campaign_visual'

interface PromptTemplateDrawerProps {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

export default function PromptTemplateDrawer({
  open,
  onClose,
  onChanged,
}: PromptTemplateDrawerProps) {
  const navigate = useNavigate()
  const [activeKind, setActiveKind] = useState<StyleKind>('copy_style')

  return (
    <Drawer
      title="管理风格模板"
      width={520}
      open={open}
      onClose={onClose}
      destroyOnClose
      footer={
        <div className={styles.drawerFooter}>
          <button
            type="button"
            className={styles.settingsLink}
            onClick={() => {
              onClose()
              navigate('/settings', { state: { tab: 'prompts' } })
            }}
          >
            在 Settings 中管理全部模板 →
          </button>
        </div>
      }
    >
      <div className={styles.kindTabs}>
        <Segmented<StyleKind>
          block
          value={activeKind}
          onChange={setActiveKind}
          options={[
            { label: '文案风格', value: 'copy_style' },
            { label: '视觉风格', value: 'campaign_visual' },
          ]}
        />
      </div>
      <PromptTemplateManager
        key={activeKind}
        sceneFilter={activeKind}
        compact
        onChanged={onChanged}
      />
    </Drawer>
  )
}
