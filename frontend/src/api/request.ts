import axios from 'axios';
import type { ApiResponse} from '@/types/api';
import { getToken, removeToken } from '@/utils/token';

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
            return Promise.reject(new Error(result.message || '请求失败'));
        }

        console.log('请求成功', response);
        return response;
    },
    (error) => {
        // 401: 清token，跳转登录
        if (error.response?.status === 401) {
            removeToken();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        
    const message = error.response?.data?.message ||
        error.message || 
        '网络异常';

    return Promise.reject(new Error(message)); // 对外抛出错误
    }
)

export default request;
