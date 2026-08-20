import { create } from 'zustand'
import type { UserVO } from '@/types/api'
import { getToken, setToken, removeToken } from '@/utils/token'

interface AuthState {
    token: string | null
    user: UserVO | null
    setAuth: (token: string, user: UserVO) => void
    clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    token: getToken(),
    user: null,

    setAuth: (token, user) => {
        setToken(token);
        set({token, user});
    },

    clearAuth: () => {
        removeToken();
        set({token: null, user: null})
    },
}))