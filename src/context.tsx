import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { SearchType } from './types'

const ADMIN_SESSION_KEY = 'scouting_admin_session'

interface AppState {
  competitionId: string | null
  setCompetitionId: (id: string | null) => void
  searchType: SearchType
  setSearchType: (t: SearchType) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  matchFilter: number | null
  setMatchFilter: (m: number | null) => void
  isAdminLoggedIn: boolean
  adminLogin: (password: string) => boolean
  adminLogout: () => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [searchType, setSearchType] = useState<SearchType>('team')
  const [searchQuery, setSearchQuery] = useState('')
  const [matchFilter, setMatchFilter] = useState<number | null>(null)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)

  useEffect(() => {
    try {
      setIsAdminLoggedIn(sessionStorage.getItem(ADMIN_SESSION_KEY) === '1')
    } catch {
      setIsAdminLoggedIn(false)
    }
  }, [])

  const adminLogin = useCallback((password: string): boolean => {
    const ok = password === getAdminPassword()
    if (ok) {
      try {
        sessionStorage.setItem(ADMIN_SESSION_KEY, '1')
      } catch {}
      setIsAdminLoggedIn(true)
    }
    return ok
  }, [])

  const adminLogout = useCallback(() => {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY)
    } catch {}
    setIsAdminLoggedIn(false)
  }, [])

  return (
    <AppContext.Provider
      value={{
        competitionId,
        setCompetitionId,
        searchType,
        setSearchType,
        searchQuery,
        setSearchQuery,
        matchFilter,
        setMatchFilter,
        isAdminLoggedIn,
        adminLogin,
        adminLogout,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

import { ADMIN_PASSWORD } from './admin/config'

function getAdminPassword(): string {
  return ADMIN_PASSWORD
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
