import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  ApiOfflineError,
  api,
  setAccessToken,
  setSessionExpiredHandler,
} from '../lib/api'
import type { ApiUser, ApiUserRole } from '../lib/api'

/**
 * Session state for the whole app.
 *
 * Replaces the previous mock (which accepted any email with no password and
 * kept the "session" in localStorage) with the real credential flow ported from
 * QueueManagementProto:
 *
 *   - `login()` posts real credentials; a wrong password is a 401 the caller
 *     must show, not a silent success.
 *   - The access token is held in memory by lib/api.ts. On reload we call
 *     `/auth/refresh`, which reads the httpOnly cookie the browser kept, so the
 *     session survives a refresh without any token being readable by scripts.
 *   - Suspended accounts are refused by the backend at login and at refresh.
 *
 * Demo mode: if the backend can't be reached at all — previewing the frontend
 * with no API running — the login page offers an explicit opt-in. It is never
 * automatic: a real 401 stays a real 401, and demo mode is labelled in the UI so
 * it can't be mistaken for a genuine session.
 */

export type UserRole = ApiUserRole | null

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  /** True when this session came from the offline demo fallback. */
  isDemo?: boolean
}

interface AuthContextType {
  user: User | null
  /** True until the initial session-restore attempt finishes. */
  loading: boolean
  /** True when the backend is unreachable, so the UI can offer demo mode. */
  backendOffline: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<User>
  /** Self-registration. `role` is gated server-side by ALLOW_STAFF_SELF_REGISTER. */
  register: (input: {
    email: string; password: string; fullName: string; phone?: string; role?: Exclude<UserRole, null>
  }) => Promise<User>
  loginAsDemo: (role: Exclude<UserRole, null>) => User
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_STORAGE_KEY = 'mediqueue_demo_user'

/** Stand-in identities for offline preview only — these carry no real access. */
const DEMO_USERS: Record<Exclude<UserRole, null>, { id: string; name: string; email: string }> = {
  patient: { id: 'demo-patient', name: 'Rajan Mehta', email: 'patient@mediqueue.io' },
  doctor: { id: 'demo-doctor', name: 'Dr. Ethan Carr', email: 'dr.carr@mediqueue.io' },
  receptionist: { id: 'demo-reception', name: 'Chamari Silva', email: 'reception@mediqueue.io' },
  admin: { id: 'demo-admin', name: 'System Administrator', email: 'admin@mediqueue.io' },
}

function fromApiUser(u: ApiUser): User {
  return { id: u.id, name: u.fullName, email: u.email, role: u.role }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [backendOffline, setBackendOffline] = useState(false)

  // Restore the session once on mount.
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await api.refreshSession()
        if (cancelled) return
        setAccessToken(res.accessToken)
        setUser(fromApiUser(res.user))
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiOfflineError) {
          setBackendOffline(true)
          // Only in offline preview do we restore a stored demo identity.
          const saved = localStorage.getItem(DEMO_STORAGE_KEY)
          if (saved) {
            try { setUser(JSON.parse(saved) as User) } catch { /* corrupt — ignore */ }
          }
        }
        // A 401 here just means "no active session" — the expected cold start.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [])

  // If a refresh fails mid-session, drop the user so guards send them to sign-in.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null)
      setAccessToken(null)
    })
    return () => setSessionExpiredHandler(null)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    try {
      const res = await api.login(email, password)
      setAccessToken(res.accessToken)
      setBackendOffline(false)
      const next = fromApiUser(res.user)
      setUser(next)
      return next
    } catch (err) {
      if (err instanceof ApiOfflineError) setBackendOffline(true)
      // Rethrown so the login form can show the real reason.
      throw err instanceof ApiError ? err : new ApiError('Sign-in failed. Please try again.')
    }
  }, [])

  const register = useCallback(
    async (input: {
      email: string; password: string; fullName: string; phone?: string; role?: Exclude<UserRole, null>
    }): Promise<User> => {
      try {
        const res = await api.register(input)
        setAccessToken(res.accessToken)
        setBackendOffline(false)
        const next = fromApiUser(res.user)
        setUser(next)
        return next
      } catch (err) {
        if (err instanceof ApiOfflineError) setBackendOffline(true)
        throw err instanceof ApiError ? err : new ApiError('Could not create your account.')
      }
    },
    [],
  )

  const loginAsDemo = useCallback((role: Exclude<UserRole, null>): User => {
    const profile = DEMO_USERS[role]
    const demoUser: User = { ...profile, role, isDemo: true }
    setUser(demoUser)
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser))
    return demoUser
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem(DEMO_STORAGE_KEY)
    try {
      if (!user?.isDemo) await api.logout()
    } catch {
      // Already signed out server-side, or the server is unreachable — either
      // way the local session must still be cleared.
    }
    setAccessToken(null)
    setUser(null)
  }, [user])

  const value = useMemo(
    () => ({
      user,
      loading,
      backendOffline,
      isAuthenticated: !!user,
      login,
      register,
      loginAsDemo,
      logout,
    }),
    [user, loading, backendOffline, login, register, loginAsDemo, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/** Where each role lands after signing in. */
export const HOME_PATH: Record<Exclude<UserRole, null>, string> = {
  patient: '/patient',
  doctor: '/doctor',
  receptionist: '/receptionist',
  admin: '/admin',
}
