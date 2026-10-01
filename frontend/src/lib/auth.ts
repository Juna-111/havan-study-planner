export type AuthAccount = { id: number; email: string; student_profile_id: number | null }
export type AuthResponse = { access_token: string; token_type: string; account: AuthAccount }

const TOKEN_KEY = 'havan_auth_token'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function saveAuth(response: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, response.access_token)
  localStorage.setItem('havan_auth_account', JSON.stringify(response.account))
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('havan_auth_account')
  localStorage.removeItem('havan_student_id')
}

export function getSavedAccount(): AuthAccount | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('havan_auth_account')
    return raw ? JSON.parse(raw) as AuthAccount : null
  } catch { return null }
}
