import { apiFetch } from '@/lib/api'
import { clearAuth, getSavedAccount, getAuthToken, type AuthAccount } from '@/lib/auth'

export async function getSessionAccount(): Promise<AuthAccount | null> {
  if (!getAuthToken()) return null
  try {
    return await apiFetch<AuthAccount>('/auth/me')
  } catch (error) {
    if (error instanceof Error && error.message.includes('401')) {
      clearAuth()
      return null
    }
    return getSavedAccount()
  }
}

export async function getMyStudentProfile<T>(): Promise<T> {
  return apiFetch<T>('/students/me/profile')
}

export { clearAuth, getAuthToken }
