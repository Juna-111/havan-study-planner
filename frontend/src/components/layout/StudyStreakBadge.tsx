'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSavedAccount } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import { getLocalStudyStreak, STUDY_COMPLETED_EVENT } from '@/lib/studyStreak'
import styles from './layout.module.css'

type StudyStreakResponse = {
  streak: number
  completed_today: boolean
}

export function StudyStreakBadge() {
  const [studentId, setStudentId] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    const account = getSavedAccount()
    if (account?.role === 'STUDENT') setStudentId(account.student_profile_id)
  }, [])

  const refreshStreak = useCallback(() => {
    if (!studentId) {
      setStreak(0)
      return
    }

    setStreak(getLocalStudyStreak(studentId))
    void apiFetch<StudyStreakResponse>('/students/me/study-streak')
      .then((value) => setStreak(value.streak))
      .catch(() => setStreak(getLocalStudyStreak(studentId)))
  }, [studentId])

  useEffect(() => {
    refreshStreak()
    window.addEventListener(STUDY_COMPLETED_EVENT, refreshStreak)
    window.addEventListener('focus', refreshStreak)
    return () => {
      window.removeEventListener(STUDY_COMPLETED_EVENT, refreshStreak)
      window.removeEventListener('focus', refreshStreak)
    }
  }, [refreshStreak])

  if (!studentId) return null

  return (
    <div className={styles.streakBadge} aria-label={`${streak}-day study streak`}>
      <span aria-hidden="true">🔥</span>
      <strong>{streak}</strong>
      <span className={styles.streakBadgeLabel}>day streak</span>
    </div>
  )
}
