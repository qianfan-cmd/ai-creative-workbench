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

export interface ProfileUpdateRequest {
    username: string
    email: string
}

export interface ChangePasswordRequest {
    currentPassword: string
    newPassword: string
}

export interface ForgotPasswordRequest {
    email: string
}

export interface ResetPasswordRequest {
    token: string
    newPassword: string
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

export async function updateProfileApi(data: ProfileUpdateRequest) {
    const res = await request.patch<ApiResponse<UserVO>>('/auth/profile', data);
    return res.data.data;
}

export async function uploadAvatarApi(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await request.post<ApiResponse<UserVO>>('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data;
}

export async function changePasswordApi(data: ChangePasswordRequest) {
    await request.put<ApiResponse<null>>('/auth/password', data);
}

export async function forgotPasswordApi(data: ForgotPasswordRequest) {
    const res = await request.post<ApiResponse<null>>('/auth/forgot-password', data);
    return res.data.message;
}

export async function resetPasswordApi(data: ResetPasswordRequest) {
    const res = await request.post<ApiResponse<null>>('/auth/reset-password', data);
    return res.data.message;
}
