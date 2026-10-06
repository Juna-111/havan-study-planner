import { getAuthToken, clearAuth } from '@/lib/auth'

const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
const API_BASE_URL = rawApiBaseUrl
  ? rawApiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '')
  : process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:8000'
const API_V1_PREFIX = '/api/v1'
const DEFAULT_TIMEOUT_MS = 12_000

export class ApiError extends Error {
  status: number
  detail?: string

  constructor(status: number, message: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(0, 'Havan backend URL is not configured.')
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE_URL}${API_V1_PREFIX}${normalizedPath}`
  const headers = new Headers(init.headers)
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (!isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const token = getAuthToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, headers, signal: init.signal ?? controller.signal })
    if (response.status === 401) {
      clearAuth()
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    if (!response.ok) {
      let detail: string | undefined
      try {
        const body = await response.json() as { detail?: string }
        detail = body.detail
      } catch {}
      throw new ApiError(response.status, detail || `API request failed: ${response.status}`, detail)
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'The request took too long. Please try again.')
    }
    throw new ApiError(0, 'Cannot reach the Havan backend. Check your connection and try again.')
  } finally {
    window.clearTimeout(timeout)
  }
}

export const getApiBaseUrl = () => API_BASE_URL
