import { Outlet } from 'react-router-dom'
import { useCallback, useEffect, useState, Suspense } from 'react'
import { getMeApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import AppSidebar from '@/components/layout/AppSidebar'
import AppTopBar from '@/components/layout/AppTopBar'
import styles from './MainLayout.module.css'
import { useAppBreadcrumbs } from '@/hooks/useAppBreadcrumbs'
import { Spin } from 'antd'

const SIDEBAR_COLLAPSED_KEY = 'workbench-sidebar-collapsed'

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export default function MainLayout() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const breadcrumbItems = useAppBreadcrumbs()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (token && !user) {
      getMeApi()
        .then((me) => setAuth(token, me))
        .catch(() => clearAuth())
    }
  }, [token, user, setAuth, clearAuth])

  return (
    <div className={styles.shell}>
      <AppSidebar collapsed={sidebarCollapsed} />
      <div className={styles.mainColumn}>
        <AppTopBar
          items={breadcrumbItems}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
        <main id="main-content" className={styles.content}>
          <div id="content-inner" className={styles.contentInner}>
            <Suspense
              fallback={
                <div className={styles.routeFallback}>
                  <Spin size="large" />
                </div>
              }>
            <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}