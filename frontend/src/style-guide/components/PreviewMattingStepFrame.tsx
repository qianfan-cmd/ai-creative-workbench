import type { ReactNode } from 'react'
import PreviewTaskSidebar from './PreviewTaskSidebar'
import PreviewMattingStageNav, { type MattingStageNavStep } from './PreviewMattingStageNav'
import styles from './PreviewMattingStepFrame.module.css'

export type MattingStepId = '1' | '2' | '3' | '4' | '5'

interface PreviewMattingStepFrameProps {
  activeStep: MattingStepId
  sectionTitle: string
  children: ReactNode
  footerExtra?: ReactNode
  className?: string
}

export default function PreviewMattingStepFrame({
  activeStep,
  sectionTitle,
  children,
  footerExtra,
  className,
}: PreviewMattingStepFrameProps) {
  const stepNum = Number(activeStep) as MattingStageNavStep

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
          <PreviewMattingStageNav activeStep={stepNum} farthestStep={5} />

          <div className={styles.body}>{children}</div>

          <div className={styles.footer}>
            {footerExtra}
            {activeStep === '1' && (
              <button type="button" className={styles.primaryBtn}>下一步</button>
            )}
            {activeStep === '2' && (
              <>
                <button type="button" className={styles.cancelBtn}>上一步</button>
                <button type="button" className={styles.primaryBtn}>确认框选，进入元素识别</button>
              </>
            )}
            {activeStep === '3' && (
              <>
                <button type="button" className={styles.cancelBtn}>上一步</button>
                <div className={styles.footerSelect}>每元素候选数 · 4</div>
                <button type="button" className={styles.primaryBtn}>开始提取</button>
              </>
            )}
            {activeStep === '4' && (
              <>
                <button type="button" className={styles.cancelBtn}>返回元素清单</button>
                <button type="button" className={styles.linkBtn}>历史生成</button>
                <button type="button" className={styles.primaryBtn}>下一步：保存</button>
              </>
            )}
            {activeStep === '5' && (
              <>
                <button type="button" className={styles.cancelBtn}>返回选图</button>
                <label className={styles.footerCheck}>
                  <span className={styles.checkboxMock} />
                  同时保存源图到素材库
                </label>
                <button type="button" className={styles.primaryBtn}>保存到 Assets · matted</button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
