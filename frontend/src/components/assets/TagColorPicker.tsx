import { ColorPicker } from 'antd'
import type { AggregationColor } from 'antd/es/color-picker/color'
import styles from './TagColorPicker.module.css'

/** Studio Neutral 推荐标签色（非 UI 主色 Indigo） */
export const TAG_COLOR_PRESETS = [
  '#0D9488',
  '#18181B',
  '#059669',
  '#D97706',
  '#DC2626',
  '#2563EB',
  '#71717A',
  '#BE185D',
] as const

interface TagColorPickerProps {
  value?: string
  onChange?: (hex?: string) => void
}

export default function TagColorPicker({ value, onChange }: TagColorPickerProps) {
  const handleChange = (color: AggregationColor, hex: string) => {
    const next = hex?.trim() || color?.toHexString?.() || undefined
    onChange?.(next || undefined)
  }

  const handleClear = () => {
    onChange?.(undefined)
  }

  return (
    <div className={styles.wrap}>
      <ColorPicker
        value={value}
        format="hex"
        disabledAlpha
        showText
        allowClear
        onChange={handleChange}
        onClear={handleClear}
        presets={[{ label: '推荐', colors: [...TAG_COLOR_PRESETS] }]}
      />
      <span className={styles.hint}>留空使用系统默认色</span>
      {value ? (
        <span
          className={styles.previewDot}
          style={{ backgroundColor: value }}
          title={value}
          aria-hidden
        />
      ) : null}
    </div>
  )
}
