import axios from 'axios'
import { message } from 'antd'
import { removeToken } from '@/utils/token'

/** 错误大类，方便拦截器 / 页面按类型分支（如 401 跳转登录） */
export type ApiErrorKind =
  | 'unauthorized'   // 401
  | 'timeout'        // 超时
  | 'network'        // 无响应 / 断网
  | 'server'         // 502/503/504 等网关/服务不可用
  | 'payload_too_large' // 413 或业务提示文件过大
  | 'business'       // 后端 Result.message 或 4xx 带文案
  | 'unknown'

export interface ParsedApiError {
  kind: ApiErrorKind
  /** 可直接展示给用户的中文 */
  message: string
  status?: number
}

/** 从 axios / fetch / 普通 Error 里抽出后端 message 字段 */
function readServerMessage(data: unknown): string | undefined {
  if (data == null || typeof data !== 'object') return undefined
  const msg = (data as { message?: unknown }).message
  return typeof msg === 'string' && msg.trim() ? msg.trim() : undefined
}

export function handleUnauthorized(): void {
  removeToken()
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

/** 把 unknown 错误解析为结构化结果（无副作用，不弹 message） */
export function parseApiError(error: unknown): ParsedApiError {
  if (error instanceof ApiRequestError) {
    return { kind: error.kind, message: error.message }
  }

  // axios 错误：有 request/response 信息
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const serverMsg = readServerMessage(error.response?.data)

    if (status === 401) {
      return { kind: 'unauthorized', message: serverMsg ?? '登录已过期，请重新登录', status }
    }
    if (status === 413) {
      return { kind: 'payload_too_large', message: serverMsg ?? '文件过大，请压缩后重试', status }
    }
    if (status === 502 || status === 503 || status === 504) {
      return {
        kind: 'server',
        message: serverMsg ?? '服务暂时不可用，请稍后重试',
        status,
      }
    }
    // 超时：axios 会把 code 设为 ECONNABORTED
    if (error.code === 'ECONNABORTED') {
      return { kind: 'timeout', message: '请求超时，请稍后重试', status }
    }
    // 有 response 的其他 HTTP 错误：优先用后端文案
    if (status != null) {
      return {
        kind: 'business',
        message: serverMsg ?? `请求失败（${status}）`,
        status,
      }
    }
    // 无 response：通常是断网、CORS、后端未启动
    return { kind: 'network', message: '网络异常，请检查连接或服务是否已启动' }
  }

  // fetch 断网、后端未启动等（非 axios）
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim()
    if (msg === 'Failed to fetch' || msg === 'Network Error') {
      return { kind: 'network', message: '网络异常，请检查连接或服务是否已启动' }
    }
    return { kind: 'business', message: msg }
  }

  return { kind: 'unknown', message: '操作失败，请稍后重试' }
}

/** 页面 / 拦截器用的快捷方法：只取展示文案 */
export function getApiErrorMessage(error: unknown): string {
  return parseApiError(error).message
}

/** 带 kind / toastShown 的请求错误，供拦截器与页面共用 */
export class ApiRequestError extends Error {
    readonly kind: ApiErrorKind

    /** true 表示拦截器已 message.error，页面不重复弹 */
    readonly toastShown: boolean

    constructor(parsed: ParsedApiError, toastShown = false) {
        super(parsed.message)
        this.name = 'ApiRequestError'
        this.kind = parsed.kind
        this.toastShown = toastShown
    }
}

/** 拦截器：基础设施类错误是否自动 toast */
export function shouldAutoToast(kind: ApiErrorKind): boolean {
    return (
      kind === 'network' ||
      kind === 'timeout' ||
      kind === 'server' ||
      kind === 'payload_too_large'
    )
}

/** 401 跳转、基础设施类错误自动 toast，返回供 reject/throw 的 ApiRequestError */
export function finalizeApiRequestError(parsed: ParsedApiError): ApiRequestError {
  if (parsed.kind === 'unauthorized') {
    handleUnauthorized()
  }
  const autoToast = shouldAutoToast(parsed.kind)
  if (autoToast) {
    message.error(parsed.message)
  }
  return new ApiRequestError(parsed, autoToast)
}

/**
 * 页面 catch 里调用：已全局 toast 或 401 跳转则跳过，避免重复
 * @param fallback 解析不出文案时的兜底（如「加载素材失败」）
 */
export function showApiError(error: unknown, fallback?: string): void {
  if (error instanceof ApiRequestError) {
    if (error.toastShown || error.kind === 'unauthorized') {
      return
    }
  }
  message.error(getApiErrorMessage(error) || fallback || '操作失败，请稍后重试')
}

/**
 * fetch / SSE 等非 axios 场景：按 HTTP status 映射（规则与 parseApiError 一致）
 */
export function parseHttpStatus(status: number, serverMsg?: string): ParsedApiError {
    const msg = serverMsg?.trim()
    if (status === 401) {
      return { kind: 'unauthorized', message: msg ?? '登录已过期，请重新登录', status }
    }
    if (status === 413) {
      return { kind: 'payload_too_large', message: msg ?? '文件过大，请压缩后重试', status }
    }
    if (status === 502 || status === 503 || status === 504) {
      return { kind: 'server', message: msg ?? '服务暂时不可用，请稍后重试', status }
    }
    return {
      kind: 'business',
      message: msg ?? `请求失败（${status}）`,
      status,
    }
}