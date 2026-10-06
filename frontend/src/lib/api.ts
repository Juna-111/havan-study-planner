import { clearAuth, getAuthToken } from '@/lib/auth'

const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
const API_BASE_URL = rawApiBaseUrl
  ? rawApiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '')
  : process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:8000'
const API_V1_PREFIX = '/api/v1'
const DEFAULT_TIMEOUT_MS = 15_000
const PUBLIC_AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/verify-reset-code',
  '/auth/reset-password',
])

export class ApiError extends Error {
  status: number
  detail?: string
  code?: string

  constructor(status: number, message: string, detail?: string, code?: string) {
    super(typeof message === 'string' ? message : 'API request failed.')
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.code = code
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, 'Havan backend URL is not configured.')

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE_URL}${API_V1_PREFIX}${normalizedPath}`
  const headers = new Headers(init.headers)
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (!isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const token = getAuthToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, headers, signal: init.signal ?? controller.signal })
    let body: { detail?: unknown; code?: unknown } | undefined
    if (response.status !== 204) {
      try {
        body = await response.json() as { detail?: unknown; code?: unknown }
      } catch {
        body = undefined
      }
    }

    if (response.status === 401) {
      const sentToken = Boolean(token)
      if (sentToken && !PUBLIC_AUTH_PATHS.has(normalizedPath)) {
        clearAuth()
        if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
          window.location.replace('/auth')
        }
      }
      const detail = typeof body?.detail === 'string' ? body.detail : 'Authentication required.'
      throw new ApiError(401, detail, detail, typeof body?.code === 'string' ? body.code : undefined)
    }

    if (!response.ok) {
      const detail = typeof body?.detail === 'string'
        ? body.detail
        : 'The request could not be completed.'
      const code = typeof body?.code === 'string' ? body.code : undefined
      throw new ApiError(response.status, detail, detail, code)
    }

    if (response.status === 204) return undefined as T
    return body as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'The request took too long. Please try again.')
    }
    throw new ApiError(0, 'Cannot reach the Havan backend. Check your connection and try again.')
  } finally {
    clearTimeout(timeout)
  }
}

export const getApiBaseUrl = () => API_BASE_URL
