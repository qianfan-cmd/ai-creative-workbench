import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const AuthGuard = () => {
    const token = useAuthStore(state => state.token);

    if (!token) {    
        return <Navigate to="/login" replace />
    }

    return <Outlet /> // 用于渲染子路由组件的占位符
}

export default AuthGuard