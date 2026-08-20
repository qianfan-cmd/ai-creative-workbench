import request from '@/api/request'
import type { ApiResponse, LoginResponse, UserVO } from '@/types/api'

export interface LoginRequest {
    username: string
    password: string
}

export interface RegisterRequest {
    username: string
    password: string
    email?: string
}

export async function loginApi(data: LoginRequest) {
    const res = await request.post<ApiResponse<LoginResponse>>('/auth/login', data);
    return res.data.data;
}

export async function registerApi(data: RegisterRequest) {
    const res = await request.post<ApiResponse<UserVO>>('/auth/register', data);
    return res.data.data;
}

export async function getMeApi() {
    const res = await request.get<ApiResponse<UserVO>>('/auth/me');
    return res.data.data;
}