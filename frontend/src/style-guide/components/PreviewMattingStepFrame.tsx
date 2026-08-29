import type { ReactNode } from 'react'
import PreviewTaskSidebar from './PreviewTaskSidebar'
import PreviewStepNav from './PreviewStepNav'
import type { StepItem } from './PreviewStepNav'
import styles from './PreviewMattingStepFrame.module.css'

export type MattingStepId = '1' | '2' | '3' | '4'

const STEP_LABELS: Record<MattingStepId, string> = {
  '1': '① 源图',
  '2': '② 配置',
  '3': '③ 候选',
  '4': '④ 保存',
}

function buildSteps(activeStep: MattingStepId): StepItem[] {
  const order: MattingStepId[] = ['1', '2', '3', '4']
  const activeIndex = order.indexOf(activeStep)

  return order.map((id, index) => ({
    id,
    label: STEP_LABELS[id],
    active: id === activeStep,
    done: index < activeIndex,
  }))
}

interface PreviewMattingStepFrameProps {
  activeStep: MattingStepId
  sectionTitle: string
  children: ReactNode
  className?: string
}

export default function PreviewMattingStepFrame({
  activeStep,
  sectionTitle,
  children,
  className,
}: PreviewMattingStepFrameProps) {
  return (
    <section className={className}>
      <div className={styles.sectionTitle}>{sectionTitle}</div>
      <div className={styles.frame}>
        <PreviewTaskSidebar
          pinned={[{ id: 'p1', title: '牛客吉祥物抠图', pinned: true, active: true, status: 'running' }]}
          ungrouped={[{ id: 'u1', title: '道具图标 batch', status: 'done' }]}
          groups={[
            {
              id: 'g1',
              name: '活动素材',
              tasks: [{ id: 't1', title: '夏日 banner 源图' }],
            },
          ]}
          activeTaskId="p1"
        />

        <div className={styles.main}>
          <PreviewStepNav steps={buildSteps(activeStep)} />

          <div className={styles.body}>{children}</div>

          <div className={styles.footer}>
            {activeStep === '1' && (
              <button type="button" className={styles.primaryBtn}>下一步</button>
            )}
            {activeStep === '2' && (
              <>
                <button type="button" className={styles.cancelBtn}>上一步</button>
                <button type="button" className={styles.primaryBtn}>开始抠图</button>
              </>
            )}
            {activeStep === '3' && (
              <>
                <button type="button" className={styles.cancelBtn}>重新生成</button>
                <button type="button" className={styles.linkBtn}>历史生成</button>
                <button type="button" className={styles.primaryBtn}>下一步</button>
              </>
            )}
            {activeStep === '4' && (
              <>
                <button type="button" className={styles.cancelBtn}>取消</button>
                <button type="button" className={styles.primaryBtn}>保存到 Assets · matted</button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
