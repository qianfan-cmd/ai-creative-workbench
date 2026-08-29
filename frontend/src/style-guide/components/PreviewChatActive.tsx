import { PauseCircleOutlined } from '@ant-design/icons'
import PreviewConversationSidebar from './PreviewConversationSidebar'
import PreviewMessageRow from './PreviewMessageRow'
import sectionStyles from './previewSection.module.css'
import styles from './PreviewChatActive.module.css'

const HISTORY = [
  { id: '1', title: '夏日活动推送文案', active: true },
  { id: '2', title: '游戏版本更新公告', active: false },
  { id: '3', title: '素材描述生成：角色立绘', active: false },
  { id: '4', title: '运营短视频脚本', active: false },
]

export default function PreviewChatActive() {
  return (
    <section className={sectionStyles.section}>
      <div className={sectionStyles.sectionTitle}>AI 对话 Chat · 对话态（历史 + 头像 + SSE）</div>
      <div className={`${sectionStyles.previewFrame} ${styles.frame}`}>
        <PreviewConversationSidebar items={HISTORY} />

        <div className={styles.main}>
          <div className={styles.messages}>
            <PreviewMessageRow role="assistant" showActions>
              你好！我是 Workbench AI 助手，可以帮你写活动文案、素材描述或回答创意相关问题。
            </PreviewMessageRow>

            <PreviewMessageRow role="user">
              帮我写一段游戏夏日活动推送文案，语气活泼，100 字以内。
            </PreviewMessageRow>

            <PreviewMessageRow role="assistant" streaming showActions>
              夏日冒险已开启！登录即领限定泳装皮肤，完成每日任务还可抽取稀有道具——
            </PreviewMessageRow>
          </div>

          <div className={styles.composer}>
            <div className={styles.inputMock}>输入消息，Enter 发送…</div>
            <button type="button" className={styles.stopBtn}>
              <PauseCircleOutlined />
              停止生成
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
