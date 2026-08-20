import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { getMeApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import AppSidebar from '@/components/layout/AppSidebar'
import AppTopBar from '@/components/layout/AppTopBar'
import styles from './MainLayout.module.css'
import { useAppBreadcrumbs } from '@/hooks/useAppBreadcrumbs'

export default function MainLayout() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const breadcrumbItems = useAppBreadcrumbs()
  
  useEffect(() => {
    if (token && !user) {
      getMeApi()
        .then((me) => setAuth(token, me))
        .catch(() => clearAuth())
    }
  }, [token, user, setAuth, clearAuth])

  return (
    <div className={styles.shell}>
      <AppSidebar />
      <div className={styles.mainColumn}>
        <AppTopBar items={breadcrumbItems} />
        <main className={styles.content}>
          <div className={styles.contentInner}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}