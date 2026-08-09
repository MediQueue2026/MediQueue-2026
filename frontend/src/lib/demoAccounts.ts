import type { ApiUserRole } from './api'

/**
 * Seeded demo accounts — one per role.
 *
 * These are real rows created by backend/src/db/migrations/003_auth.sql, not
 * client-side fakes, so signing in with them goes through the ordinary login
 * call and produces an ordinary session.
 *
 * Shared by the login page's "Sign in as demo" button and the developer navbar,
 * so the two can't drift apart.
 *
 * ⚠️  These credentials are public by design: the team and the markers need to
 *     reach every console without being handed a password list. Delete the rows
 *     or change their passwords before this database holds anything real.
 */
export const DEMO_PASSWORD = 'MediQueue@2026'

export const DEMO_ACCOUNTS: Record<ApiUserRole, { email: string; name: string }> = {
  patient: { email: 'patient@mediqueue.io', name: 'Rajan Mehta' },
  doctor: { email: 'dr.carr@mediqueue.io', name: 'Dr. Ethan Carr' },
  receptionist: { email: 'reception@mediqueue.io', name: 'Chamari Silva' },
  admin: { email: 'admin@mediqueue.io', name: 'System Administrator' },
}
