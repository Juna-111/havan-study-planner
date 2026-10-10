import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, apiFetchAllPages } from '@/lib/api'

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

describe('apiFetchAllPages', () => {
  it('loads every university page beyond the first 100 records', async () => {
    const requestedPages: number[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const page = Number(url.searchParams.get('page'))
      requestedPages.push(page)
      const start = (page - 1) * 100
      const end = Math.min(start + 100, 201)
      const items = Array.from({ length: end - start }, (_, index) => ({ id: start + index + 1 }))
      return new Response(JSON.stringify({ items, pages: 3 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }))

    const universities = await apiFetchAllPages<{ id: number }>('/universities')

    expect(universities).toHaveLength(201)
    expect(universities[0].id).toBe(1)
    expect(universities[200].id).toBe(201)
    expect(requestedPages).toEqual([1, 2, 3])
  })
})
