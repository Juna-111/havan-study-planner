const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const headers = new Headers(init?.headers)
  if (!isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(API_BASE_URL + path, {...init, headers})
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
