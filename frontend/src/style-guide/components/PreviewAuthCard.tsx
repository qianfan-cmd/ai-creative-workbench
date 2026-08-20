import styles from './PreviewAuthCard.module.css'

/** 静态登录卡片预览 — 展示未来 Login/Register 页风格 */
export default function PreviewAuthCard() {
  return (
    <section className={styles.authSection}>
      <div className={styles.authSectionTitle}>Auth 登录页预览</div>
      <div className={styles.authPreview}>
        <div className={styles.authCard}>
          <div className={styles.authCardHeader}>
            <div className={styles.authCardLogo}>W</div>
            <h2 className={styles.authCardTitle}>登录工作台</h2>
            <p className={styles.authCardDesc}>Sign in to AI Creative Workbench</p>
          </div>
          <div className={styles.authFormMock}>
            <div className={styles.mockField}>
              <label>用户名</label>
              <div className={styles.mockInput}>请输入用户名</div>
            </div>
            <div className={styles.mockField}>
              <label>密码</label>
              <div className={styles.mockInput}>请输入密码</div>
            </div>
            <div className={styles.mockButton}>登录</div>
          </div>
          <p className={styles.authFooter}>
            还没有账号？<a href="#">立即注册</a>
          </p>
        </div>
      </div>
    </section>
  )
}
