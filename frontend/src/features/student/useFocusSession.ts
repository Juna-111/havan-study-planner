'use client'

import { useContext } from 'react'
import { FocusSessionContext } from './focusSessionContext'

export function useFocusSession() {
  const value = useContext(FocusSessionContext)
  if (!value) throw new Error('useFocusSession must be used inside FocusSessionProvider.')
  return value
}
