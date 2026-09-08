import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, api } from '../lib/api'
import type { ApiDoctor, ApiQueueEntry } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  QueueError,
  RECEPTION_DOCTORS,
  callNext as callNextReducer,
  completeCurrent as completeCurrentReducer,
  currentFor,
  estimateWaitMinutes,
  forDoctor,
  formatToken,
  issueToken as issueTokenReducer,
  issuedNumbers as issuedNumbersFor,
  nextTokenNumber,
  setEntryStatus as setEntryStatusReducer,
  seedQueue,
  waitingFor,
} from '../lib/receptionQueue'
import type { IssueTokenInput, QueueEntry, QueueStatus, ReceptionDoctor } from '../lib/receptionQueue'

function fromApiEntry(e: ApiQueueEntry): QueueEntry {
  return {
    id: e.id,
    series: e.series,
    tokenNumber: e.tokenNumber,
    patientName: e.patientName,
    nic: e.nic,
    phone: e.phone,
    doctorId: e.doctorId,
    source: e.source,
    status: e.status,
    issuedAt: new Date(e.issuedAt),
    calledAt: e.calledAt ? new Date(e.calledAt) : undefined,
  }
}

/**
 * Live reception queue for one counter.
 *
 * Talks to the real backend (Supabase-backed `walk_in_queue` + `doctors`
 * tables — see backend/src/controllers/queueController.js) whenever it's
 * reachable. If the API can't be reached at all — e.g. previewing the
 * frontend standalone with no backend running — it transparently falls back
 * to the bundled in-memory demo data and the original pure reducers, so the
 * desk stays fully usable either way.
 */
export function useReceptionQueue() {
  // A receptionist only manages one medical center — the desk roster and the
  // queue's doctor picker are scoped to it. `centerId` is null for accounts not
  // yet linked to a center (and for the offline demo identity).
  const { user, loading: authLoading } = useAuth()
  const centerId = user?.centerId ?? null

  /** Doctors assigned to this receptionist's center — empty until one is linked. */
  const fetchCenterDoctors = useCallback(
    (): Promise<{ doctors: ApiDoctor[] }> =>
      centerId ? api.getDoctors({ centerId }) : Promise.resolve({ doctors: [] }),
    [centerId],
  )

  const [doctors, setDoctors] = useState<ReceptionDoctor[]>(RECEPTION_DOCTORS)
  const [entries, setEntries] = useState<QueueEntry[]>(seedQueue)
  const [selectedDoctorId, setSelectedDoctorId] = useState(RECEPTION_DOCTORS[0]?.id ?? '')

  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [migrationPending, setMigrationPending] = useState(false)

  const [issuing, setIssuing] = useState(false)
  const [calling, setCalling] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')

  // Load the real clinic roster + today's queue once the session is known
  // (we need the receptionist's center before we can scope the roster).
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    ;(async () => {
      try {
        const [doctorsRes, queueRes] = await Promise.all([fetchCenterDoctors(), api.getQueue({ centerId })])
        if (cancelled) return
        setDoctors(doctorsRes.doctors)
        setEntries(queueRes.entries.map(fromApiEntry))
        setMigrationPending(!!queueRes.migrationPending)
        setSelectedDoctorId(prev =>
          doctorsRes.doctors.some(d => d.id === prev) ? prev : (doctorsRes.doctors[0]?.id ?? ''),
        )
      } catch {
        if (cancelled) return
        setOffline(true) // keep the bundled demo data (RECEPTION_DOCTORS / seedQueue)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, fetchCenterDoctors])

  // Live 3-second doctor status & queue polling loop across doctor terminals
  useEffect(() => {
    if (offline) return
    const interval = setInterval(() => {
      Promise.all([fetchCenterDoctors(), api.getQueue({ centerId })]).then(([doctorsRes, queueRes]) => {
        setDoctors(doctorsRes.doctors)
        setEntries(queueRes.entries.map(fromApiEntry))
      }).catch(() => {})
    }, 3000)
    return () => clearInterval(interval)
  }, [offline, fetchCenterDoctors])

  const selectedDoctor = useMemo(() => doctors.find(d => d.id === selectedDoctorId), [doctors, selectedDoctorId])

  const doctorQueue = useMemo(() => forDoctor(entries, selectedDoctorId, selectedDoctor), [entries, selectedDoctorId, selectedDoctor])
  const waiting = useMemo(() => waitingFor(entries, selectedDoctorId, selectedDoctor), [entries, selectedDoctorId, selectedDoctor])
  const current = useMemo(() => currentFor(entries, selectedDoctorId, selectedDoctor), [entries, selectedDoctorId, selectedDoctor])
  const issuedNumbers = useMemo(() => issuedNumbersFor(entries, selectedDoctorId, selectedDoctor), [entries, selectedDoctorId, selectedDoctor])

  const nextNumber = useMemo(() => nextTokenNumber(entries, selectedDoctorId, selectedDoctor), [entries, selectedDoctorId, selectedDoctor])
  const nextToken = useMemo(
    () => formatToken(selectedDoctor?.series ?? '?', nextNumber),
    [selectedDoctor, nextNumber],
  )

  /** The token the "Call Next" button will pull in. */
  const upNext = waiting[0]

  const issue = useCallback(
    async (input: Omit<IssueTokenInput, 'doctorId'> & { doctorId?: string }) => {
      const doctorId = input.doctorId ?? selectedDoctorId
      setIssuing(true)
      setError('')

      if (offline) {
        try {
          const next = issueTokenReducer(entries, { ...input, doctorId })
          setEntries(next)
          const added = next.find(e => !entries.some(prev => prev.id === e.id))
          return { ok: true as const, entry: added }
        } catch (err) {
          const message = err instanceof QueueError ? err.message : 'Could not issue this token.'
          setError(message)
          return { ok: false as const, message }
        } finally {
          setIssuing(false)
        }
      }

      try {
        const { entry } = await api.issueWalkinToken({
          doctorId,
          centerId,
          patientName: input.patientName,
          nic: input.nic,
          phone: input.phone,
          source: input.source,
          tokenNumber: input.tokenNumber,
        })
        const mapped = fromApiEntry(entry)
        setEntries(prev => [...prev, mapped].sort((a, b) => a.tokenNumber - b.tokenNumber))
        return { ok: true as const, entry: mapped }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Could not issue this token.'
        setError(message)
        return { ok: false as const, message }
      } finally {
        setIssuing(false)
      }
    },
    [entries, offline, selectedDoctorId, centerId],
  )

  const callNext = useCallback(async () => {
    if (waiting.length === 0) return
    setCalling(true)

    if (offline) {
      setEntries(prev => callNextReducer(prev, selectedDoctorId))
      setCalling(false)
      return
    }

    try {
      const { entries: updated } = await api.callNext(selectedDoctorId, centerId)
      const mappedUpdated = updated.map(fromApiEntry)
      setEntries(prev =>
        [...prev.filter(e => e.doctorId !== selectedDoctorId), ...mappedUpdated].sort(
          (a, b) => a.tokenNumber - b.tokenNumber,
        ),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not call the next token.')
    } finally {
      setCalling(false)
    }
  }, [offline, selectedDoctorId, waiting.length, centerId])

  const completeCurrent = useCallback(async () => {
    if (!current) return
    setCompleting(true)

    if (offline) {
      setEntries(prev => completeCurrentReducer(prev, selectedDoctorId))
      setCompleting(false)
      return
    }

    try {
      const { entry } = await api.setQueueEntryStatus(current.id, 'completed')
      const mapped = fromApiEntry(entry)
      setEntries(prev => prev.map(e => (e.id === mapped.id ? mapped : e)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this token.')
    } finally {
      setCompleting(false)
    }
  }, [current, offline, selectedDoctorId])

  const setStatus = useCallback(
    async (id: string, status: Exclude<QueueStatus, 'cancelled'>) => {
      if (offline) {
        setEntries(prev => setEntryStatusReducer(prev, id, status))
        return
      }
      try {
        const { entry } = await api.setQueueEntryStatus(id, status)
        const mapped = fromApiEntry(entry)
        setEntries(prev => prev.map(e => (e.id === mapped.id ? mapped : e)))
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not update this token.')
      }
    },
    [offline],
  )

  /** Estimated wait for a waiting entry, by its place in line. */
  const waitFor = useCallback(
    (entry: QueueEntry) => {
      const position = waiting.findIndex(e => e.id === entry.id)
      return estimateWaitMinutes(position + 1, selectedDoctor)
    },
    [waiting, selectedDoctor],
  )

  /** Re-fetches doctors (and today's queue) from the server. Used after add/edit. */
  const refresh = useCallback(async () => {
    if (offline) return
    try {
      const [doctorsRes, queueRes] = await Promise.all([fetchCenterDoctors(), api.getQueue({ centerId })])
      setDoctors(doctorsRes.doctors)
      setEntries(queueRes.entries.map(fromApiEntry))
      setSelectedDoctorId(prev =>
        doctorsRes.doctors.some(d => d.id === prev) ? prev : (doctorsRes.doctors[0]?.id ?? ''),
      )
    } catch { /* silently ignore */ }
  }, [offline, fetchCenterDoctors])

  return {
    // data
    entries,
    doctorQueue,
    doctors,
    selectedDoctor,
    selectedDoctorId,
    waiting,
    current,
    upNext,
    issuedNumbers,
    nextNumber,
    nextToken,
    // connection state
    loading,
    offline,
    migrationPending,
    /** The medical center this desk is scoped to; null when the account isn't linked yet. */
    centerId,
    // flags
    issuing,
    calling,
    completing,
    error,
    // actions
    setSelectedDoctorId,
    issue,
    callNext,
    completeCurrent,
    setStatus,
    clearError: () => setError(''),
    waitFor,
    refresh,
  }
}
