import axios from 'axios';
import type { ApiResponse} from '@/types/api';
import { getToken } from '@/utils/token';
import { parseApiError, ApiRequestError, finalizeApiRequestError } from '@/utils/apiError';

const request = axios.create({
    baseURL: '/api',
    timeout: 15000,
});

// 请求拦截器：自动带Authorization请求头
request.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
})

// 响应拦截：统一处理Result返回结果
request.interceptors.response.use(
    (response) => {
        const result = response.data as ApiResponse<unknown>;

        // 业务失败
        if (result.code !== 200) {
            const parsed = parseApiError(new Error(result.message || '请求失败'))
            return Promise.reject(new ApiRequestError(parsed))
        }

        return response;
    },
    (error) => {
        return Promise.reject(finalizeApiRequestError(parseApiError(error)))
    },
)

export default request;
