import { SendOutlined } from '@ant-design/icons'
import PreviewConversationSidebar from './PreviewConversationSidebar'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewChatEmpty.module.css'

const HISTORY = [
  { id: '1', title: '夏日活动推送文案', active: false },
  { id: '2', title: '游戏版本更新公告', active: false },
  { id: '3', title: '素材描述生成：角色立绘', active: false },
  { id: '4', title: '运营短视频脚本', active: false },
]

export default function PreviewChatEmpty() {
  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionTitle}>AI 对话 Chat · 初始空态</div>
      <div className={`${sectionStyles.previewFrame} ${styles.frame}`}>
        <PreviewConversationSidebar items={HISTORY} />

        <div className={styles.main}>
          <div className={styles.center}>
            <h2 className={styles.greeting}>有什么可以帮你？</h2>
            <p className={styles.subtitle}>基于 SSE 的 AI 创意助手 Chat</p>
          </div>

          <div className={styles.composerWrap}>
            <div className={styles.composer}>
              <div className={styles.inputMock}>输入消息，Enter 发送…</div>
              <button type="button" className={styles.sendBtn}>
                <SendOutlined />
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
