import request from '@/api/request'
import type { ApiResponse, AssetVO, PageResult,AssetStatsVO,AssetUploadVO } from '@/types/api'

/**列表查询参数 */
export interface ListAssetsParams {
    page?: number
    size?: number
    tagId?: number
    keyword?: string
    type?: string
    sort?: 'asc' | 'desc'
    includeTags?: boolean
}

/**分页列表 */
export async function listAssetsApi(params: ListAssetsParams = {}) {
    const res = await request.get<ApiResponse<PageResult<AssetVO>>>('/assets', {
        params: {
            page: params.page,
            size: params.size,
            tagId: params.tagId,
            keyword: params.keyword,
            type: params.type,
            sort: params.sort,
            includeTags: params.includeTags,
        },
    })
    return res.data.data;
}

/** 删除素材 */
export async function deleteAssetApi(id: number) {
    await request.delete<ApiResponse<void>>(`/assets/${id}`);
}

/** 批量删除素材 */
export async function batchDeleteAssetsApi(ids: number[]) {
    await request.post<ApiResponse<void>>('/assets/batch-delete', { ids });
}

/** 素材统计 */
export async function getAssetStatsApi() {
    const res = await request.get<ApiResponse<AssetStatsVO>>('/assets/stats');
    return res.data.data;
}

/** 素材详情（含 tags，编辑弹窗用） */
export async function getAssetDetailApi(id: number) {
    const res = await request.get<ApiResponse<AssetVO>>(`/assets/${id}`)
    return res.data.data
}

/**修改文件名 */
export async function updateAssetNameApi(id: number, name: string) {
    const res = await request.patch<ApiResponse<AssetVO>>(`/assets/${id}`, { name });
    return res.data.data;
}

/**批量替换素材标签 */
export async function replaceAssetTagsApi(id: number, tagIds: number[]) {
    await request.put<ApiResponse<void>>(`/assets/${id}/tags`, { tagIds });
}

export interface UploadAssetOptions {
    onProgress?: (percent: number) => void
}

export async function uploadAssetApi(file: File, options?: UploadAssetOptions) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await request.post<ApiResponse<AssetUploadVO>>('/assets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
            if (!e.total) return;
            options?.onProgress?.(Math.round((e.loaded / e.total) * 100));
        },
    })
    return res.data.data;
}

export async function importAssetFromUrlApi(url: string, name?: string, tags?: string[]) {
    const res = await request.post<ApiResponse<AssetVO>>('/assets/import-url', { url, name, tags })
    return res.data.data
}