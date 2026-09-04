import type { TagVO } from "@/api/tags"

// 对应后端Result类的返回结构
export interface ApiResponse<T> {
    code: number
    message: string
    data: T
}

// PageResult
export interface PageResult<T> {
    records: T[]
    total: number
    page: number
    size: number
}

export interface UserVO {
    id: number
    username: string
    email: string
    avatarUrl?: string
    role: string
    createdAt: string
}

export interface LoginResponse {
    token: string
    user: UserVO
}

export interface AssetVO {
    id: number
    name: string
    url: string
    path: string
    size: number
    type: string
    createdAt: string
    tags?: TagVO[]
}

export interface AssetStatsVO {
  total: number
  last7DaysCount: number
  prev7DaysCount: number
  knowledgeDocCount: number
}

export interface AssetUploadVO {
    id: number
    name: string
    url: string
    path: string
    size: number
    type: string
}