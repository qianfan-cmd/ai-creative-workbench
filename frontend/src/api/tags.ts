import request from '@/api/request'
import type { ApiResponse } from '@/types/api'

export interface TagVO {
    id: number
    name: string
    color: string
    createdAt: string
}

export async function listTagsApi() {
    const res = await request.get<ApiResponse<TagVO[]>>('/tags');
    return res.data.data;
}

export async function createTagApi(data: { name: string; color?: string }) {
    const res = await request.post<ApiResponse<TagVO>>('/tags', data);
    return res.data.data;
}