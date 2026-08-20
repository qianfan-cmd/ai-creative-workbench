import { PauseCircleOutlined, SendOutlined } from '@ant-design/icons'
import styles from './PreviewChatPanel.module.css'

export default function PreviewChatPanel() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>AI 对话 Chat · SSE 流式预览</div>
      <div className={styles.panel}>
        <div className={styles.messages}>
          <div className={`${styles.message} ${styles.message_user}`}>
            <div className={styles.messageLabel}>你</div>
            <div className={styles.bubble}>
              帮我写一段游戏夏日活动推送文案，语气活泼，100 字以内。
            </div>
          </div>

          <div className={`${styles.message} ${styles.message_assistant}`}>
            <div className={styles.messageLabel}>Assistant · SSE</div>
            <div className={styles.bubble}>
              <p>夏日冒险已开启！登录即领限定泳装皮肤，完成每日任务还可抽取</p>
              <p className={styles.streamingLine}>
                稀有道具——<span className={styles.cursor} aria-hidden="true" />
              </p>
            </div>
          </div>
        </div>

        <div className={styles.composer}>
          <div className={styles.inputMock}>输入消息，Enter 发送…</div>
          <div className={styles.composerActions}>
            <button type="button" className={styles.stopBtn}>
              <PauseCircleOutlined />
              停止生成
            </button>
            <button type="button" className={styles.sendBtn}>
              <SendOutlined />
              发送
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
