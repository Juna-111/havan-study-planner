import { describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/api'
import { planAction } from './plan'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }))

describe('plan api client', () => {
  it('sends a task action to the current-plan task endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValue({})
    await planAction(11, { action: 'COMPLETE' })
    expect(apiFetch).toHaveBeenCalledWith('/plans/current/tasks/11/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'COMPLETE' }),
    })
  })
})
