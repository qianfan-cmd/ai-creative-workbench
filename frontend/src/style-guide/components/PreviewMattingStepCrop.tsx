import PreviewMattingStepFrame from './PreviewMattingStepFrame'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewMattingStepCrop.module.css'

interface CutRegion {
  id: string
  label: string
  left: string
  top: string
  width: string
  height: string
  locked?: boolean
}

interface SchemeMock {
  id: string
  title: string
  previewClass: string
  useOriginal: boolean
  showFullCut?: boolean
  showNon916Hint?: boolean
  regions: CutRegion[]
  status: string
  statusKind?: 'default' | 'original' | 'muted'
}

const SCHEMES: SchemeMock[] = [
  {
    id: '1',
    title: '方案 1 · 竖屏挖矿主题',
    previewClass: styles.previewFillA,
    useOriginal: false,
    regions: [
      { id: 'r1', label: '区域 1', left: '8%', top: '12%', width: '55%', height: '22%' },
      { id: 'r2', label: '区域 2', left: '18%', top: '48%', width: '62%', height: '28%' },
    ],
    status: '已定义 2 个切割区域 · 最多 6 个 · 点击图片空白处继续绘制',
  },
  {
    id: '2',
    title: '方案 2 · 竖屏东方神鸟',
    previewClass: styles.previewFillB,
    useOriginal: false,
    regions: [{ id: 'r1', label: '区域 1', left: '10%', top: '20%', width: '78%', height: '35%' }],
    status: '已定义 1 个切割区域 · 最多 6 个 · 点击图片空白处继续绘制',
  },
  {
    id: '3',
    title: '方案 3 · 吉祥物源图',
    previewClass: styles.previewFillC,
    useOriginal: true,
    regions: [
      {
        id: 'full',
        label: '原图',
        left: '0%',
        top: '0%',
        width: '100%',
        height: '100%',
        locked: true,
      },
    ],
    status: '✓ 使用原图（全部覆盖）',
    statusKind: 'original',
  },
  {
    id: '4',
    title: '方案 4 · banner 横图',
    previewClass: styles.previewFillD,
    useOriginal: false,
    showFullCut: true,
    showNon916Hint: true,
    regions: [{ id: 'r1', label: '区域 1', left: '12%', top: '30%', width: '70%', height: '40%' }],
    status: '已定义 1 个切割区域 · 最多 6 个 · 点击图片空白处继续绘制',
  },
]

export default function PreviewMattingStepCrop() {
  return (
    <div className={sectionStyles.section}>
      <PreviewMattingStepFrame activeStep="2" sectionTitle="抠图 Matting · 步骤 ② 框选">
        <div className={styles.cutStage}>
          <p className={styles.stats} role="status">
            单张最多 <strong>6</strong> 个区域。已确认 <strong>4</strong> 张来源整图，累计{' '}
            <strong>4</strong> 个切割区域，均已满足条件，可确认进入下一步。
          </p>

          <div className={styles.row}>
            {SCHEMES.map((scheme) => (
              <article key={scheme.id} className={styles.block}>
                <header className={styles.blockHead}>
                  <p className={styles.blockTitle} title={scheme.title}>
                    {scheme.title}
                  </p>
                  <button
                    type="button"
                    className={`${styles.useOriginalBtn} ${scheme.useOriginal ? styles.useOriginalBtn_on : ''}`}
                  >
                    {scheme.useOriginal && (
                      <span className={styles.useOriginalCheck} aria-hidden="true">
                        ✓
                      </span>
                    )}
                    {scheme.useOriginal ? '使用原图（全部覆盖）' : '使用原图'}
                  </button>
                  {scheme.showFullCut && (
                    <button type="button" className={styles.fullCutBtn}>
                      完整图裁剪
                    </button>
                  )}
                </header>

                {scheme.showNon916Hint && (
                  <p className={styles.non916Hint}>
                    当前图比例与 9:16 不一致，预览仅为局部放大，请使用「完整图裁剪」查看整张原图后再框选。
                  </p>
                )}

                <div className={styles.canvasFrame}>
                  <div className={scheme.previewClass} />
                  <div className={styles.overlay}>
                    {scheme.regions.map((region) => (
                      <div
                        key={region.id}
                        className={`${styles.region} ${region.locked ? styles.region_locked : ''}`}
                        style={{
                          left: region.left,
                          top: region.top,
                          width: region.width,
                          height: region.height,
                        }}
                      >
                        <span className={styles.regionBadge}>{region.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={`${styles.status} ${
                    scheme.statusKind === 'original' ? styles.status_original : ''
                  }`}
                >
                  {scheme.statusKind === 'original' ? (
                    <>
                      <span className={styles.statusIcon} aria-hidden="true">✓</span>
                      {scheme.status}
                    </>
                  ) : (
                    scheme.status
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </PreviewMattingStepFrame>
    </div>
  )
}
