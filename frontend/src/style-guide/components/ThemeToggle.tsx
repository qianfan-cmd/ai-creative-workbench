import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import type { ThemeMode } from '../antdTheme'
import styles from './ThemeToggle.module.css'

interface ThemeToggleProps {
  mode: ThemeMode
  onChange: (mode: ThemeMode) => void
}

export default function ThemeToggle({ mode, onChange }: ThemeToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label="主题切换">
      <button
        type="button"
        className={`${styles.btn} ${mode === 'light' ? styles.btn_active : ''}`}
        onClick={() => onChange('light')}
        aria-pressed={mode === 'light'}
      >
        <SunOutlined />
        Light
      </button>
      <button
        type="button"
        className={`${styles.btn} ${mode === 'dark' ? styles.btn_active : ''}`}
        onClick={() => onChange('dark')}
        aria-pressed={mode === 'dark'}
      >
        <MoonOutlined />
        Dark
      </button>
    </div>
  )
}
