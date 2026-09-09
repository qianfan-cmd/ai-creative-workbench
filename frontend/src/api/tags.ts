import request from '@/api/request'
import { API_TIMEOUT_BATCH } from '@/api/timeouts'
import type { ApiResponse } from '@/types/api'

export interface TagVO {
    id: number
    name: string
    color: string
    createdAt: string
}

let tagsInflight: Promise<TagVO[]> | null = null

export async function listTagsApi() {
    if (!tagsInflight) {
        tagsInflight = request
            .get<ApiResponse<TagVO[]>>('/tags')
            .then((res) => res.data.data)
            .finally(() => {
                tagsInflight = null
            })
    }
    return tagsInflight
}

export async function createTagApi(data: { name: string; color?: string }) {
    const res = await request.post<ApiResponse<TagVO>>('/tags', data);
    return res.data.data;
}

export async function updateTagApi(id: number, data: { name: string; color?: string }) {
    const res = await request.put<ApiResponse<TagVO>>(`/tags/${id}`, data);
    return res.data.data;
}

export async function deleteTagApi(id: number) {
    await request.delete<ApiResponse<void>>(`/tags/${id}`);
}

export async function batchDeleteTagsApi(ids: number[]) {
    await request.post<ApiResponse<void>>('/tags/batch-delete', { ids }, {
        timeout: API_TIMEOUT_BATCH,
    });
}
