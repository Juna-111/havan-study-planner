import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/api'

afterEach(() => vi.unstubAllGlobals())

describe('API rate-limit feedback', () => {
  it('tells the user how long to wait when Retry-After is present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Too many requests.', code: 'TOO_MANY_REQUESTS' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '125' } },
    )))

    await expect(apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'student@example.com' }),
    })).rejects.toMatchObject({
      status: 429,
      message: 'Too many requests. Please try again in 3 minutes.',
      retryAfterSeconds: 125,
    })
  })

  it('gives useful guidance when a rate-limit response has no retry header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Too many requests.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )))

    await expect(apiFetch('/auth/forgot-password', { method: 'POST' })).rejects.toMatchObject({
      status: 429,
      message: 'Too many requests. Please wait a few minutes before trying again.',
    })
  })
})
