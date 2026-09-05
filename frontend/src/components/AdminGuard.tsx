import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

export default function AdminGuard() {
  const user = useAuthStore((s) => s.user)

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/assets" replace />
  }

  return <Outlet />
}
