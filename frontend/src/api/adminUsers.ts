import request from '@/api/request'
import type { ApiResponse, PageResult } from '@/types/api'

export interface AdminUserListItem {
  id: number
  username: string
  email: string
  avatarUrl?: string
  role: string
  status: string
  createdAt: string
}

export interface AdminUserDetail extends AdminUserListItem {
  updatedAt: string
}

export interface AdminUserCreateRequest {
  username: string
  email: string
  password: string
  role: string
}

export interface AdminUserUpdateRequest {
  username: string
  email: string
  role: string
  status: string
  password?: string
}

export interface ModelUsageItem {
  model: string
  modelDisplayName?: string
  provider?: string
  callCount: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostCny: number
  estimatedCostCnyMin?: number
  estimatedCostCnyMax?: number
  sourceUrl?: string
  sourceStatus?: 'official' | 'missing_pricing' | 'legacy_incomplete'
}

export interface SceneUsageItem {
  scene: string
  sceneLabel?: string
  callCount: number
  totalTokens: number
  estimatedCostCny: number
  estimatedCostCnyMin?: number
  estimatedCostCnyMax?: number
}

export interface PricingSourceItem {
  model: string
  sourceUrl: string
  formula?: string
}

export interface UserUsageSummary {
  days: number
  totalTokens: number
  totalCostCny: number
  totalCostCnyMin?: number
  totalCostCnyMax?: number
  byModel: ModelUsageItem[]
  byScene: SceneUsageItem[]
  pricingSources?: PricingSourceItem[]
}

export async function listAdminUsersApi(params: {
  page?: number
  size?: number
  keyword?: string
}) {
  const res = await request.get<ApiResponse<PageResult<AdminUserListItem>>>('/admin/users', {
    params,
  })
  return res.data.data
}

export async function getAdminUserApi(id: number) {
  const res = await request.get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`)
  return res.data.data
}

export async function createAdminUserApi(data: AdminUserCreateRequest) {
  const res = await request.post<ApiResponse<AdminUserDetail>>('/admin/users', data)
  return res.data.data
}

export async function updateAdminUserApi(id: number, data: AdminUserUpdateRequest) {
  const res = await request.patch<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`, data)
  return res.data.data
}

export async function disableAdminUserApi(id: number) {
  await request.delete<ApiResponse<null>>(`/admin/users/${id}`)
}

export async function getAdminUserUsageApi(id: number, days = 30) {
  const res = await request.get<ApiResponse<UserUsageSummary>>(`/admin/users/${id}/usage`, {
    params: { days },
  })
  return res.data.data
}
