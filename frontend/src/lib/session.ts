export type AppIdentity = {
  id: string
  name: string
  username?: string
  source: 'telegram' | 'browser'
}

const browserProfileKey = 'havan-study-planner-browser-profile-v1'
const plannerStoragePrefix = 'havan-study-planner-v3'
const legacyStoragePrefix = 'havan-study-planner-v2'

/**
 * Repairs a stored PlannerState:
 * - legacy v2 keys are read transparently (same data, new prefix)
 * - old single `assessment` is folded into `assessments`
 */
export function migrateState(parsed: unknown): unknown | null {
  if (!parsed || typeof parsed !== 'object') return null
  const state = parsed as Record<string, unknown>
  const profile = state.profile as Record<string, unknown> | undefined
  if (!profile) return null

  if (!Array.isArray(profile.assessments)) {
    profile.assessments =
      profile.assessment && typeof profile.assessment === 'object'
        ? [profile.assessment]
        : []
  }
  return state
}

export function readPlannerStorage(identity: AppIdentity): string | null {
  try {
    return (
      window.localStorage.getItem(`${plannerStoragePrefix}:${identity.id}`) ??
      window.localStorage.getItem(`${legacyStoragePrefix}:${identity.id}`)
    )
  } catch {
    return null
  }
}

export function getPlannerStorageKey(identity: AppIdentity) {
  return `${plannerStoragePrefix}:${identity.id}`
}

export function loadBrowserIdentity(): AppIdentity | null {
  try {
    const stored = window.localStorage.getItem(browserProfileKey)
    if (!stored) return null

    const parsed = JSON.parse(stored) as AppIdentity
    if (parsed.source !== 'browser' || !parsed.id.startsWith('browser-') || !parsed.name.trim()) return null

    return { id: parsed.id, name: parsed.name.trim(), source: 'browser' }
  } catch {
    return null
  }
}

export function createBrowserIdentity(name: string): AppIdentity {
  const identity: AppIdentity = {
    id: `browser-${crypto.randomUUID()}`,
    name: name.trim(),
    source: 'browser',
  }

  try {
    window.localStorage.setItem(browserProfileKey, JSON.stringify(identity))
  } catch {
    // Continue with a session that lasts until the page is closed.
  }

  return identity
}

export function clearLocalSession(identity: AppIdentity) {
  try {
    window.localStorage.removeItem(getPlannerStorageKey(identity))
    window.localStorage.removeItem(`${legacyStoragePrefix}:${identity.id}`)
    if (identity.source === 'browser') window.localStorage.removeItem(browserProfileKey)
  } catch {
    // The in-memory session still ends even if storage is unavailable.
  }
}
