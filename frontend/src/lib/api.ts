const rawApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

// The frontend talks to FastAPI through /api/v1 routes. Keep the configured
// value as the backend origin, even if someone accidentally includes /api/v1.
const API_BASE_URL = rawApiBaseUrl
  ? rawApiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1$/, '')
  : process.env.NODE_ENV === 'production'
    ? ''
    : 'http://localhost:8000'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured for the deployed frontend.')
  }

  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const headers = new Headers(init?.headers)
  if (!isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(API_BASE_URL + path, {...init, headers})
  } catch {
    throw new Error('Cannot reach the Havan backend. Check NEXT_PUBLIC_API_URL and the backend CORS settings.')
  }

  if (!response.ok) {
    let message = 'API request failed: ' + response.status
    try {
      const body = await response.json() as { detail?: string }
      if (body.detail) message = body.detail
    } catch {}
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const getApiBaseUrl = () => API_BASE_URL
