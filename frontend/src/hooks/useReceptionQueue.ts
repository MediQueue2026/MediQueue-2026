import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, api } from '../lib/api'
import type { ApiDelayAlert, ApiDoctor, ApiQueueEntry } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  currentFor,
  estimateWaitMinutes,
  forDoctor,
  formatToken,
  issuedNumbers as issuedNumbersFor,
  nextTokenNumber,
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

/** `ApiDoctor` carries `delayMinutes` per posting; the wait projection needs it. */
function fromApiDoctor(d: ApiDoctor): ReceptionDoctor {
  return {
    id: d.id,
    name: d.name,
    dept: d.dept,
    room: d.room,
    series: d.series,
    status: d.status,
    avgConsultMinutes: d.avgConsultMinutes,
    maxAppointmentsPerHour: d.maxAppointmentsPerHour,
    delayMinutes: (d as ApiDoctor & { delayMinutes?: number }).delayMinutes ?? 0,
    centerId: d.centerId ?? null,
    centerName: d.centerName ?? null,
  }
}

const POLL_MS = 3000

/**
 * Live reception queue for one counter.
 *
 * The backend (`walk_in_queue` + `appointments`, see
 * backend/src/controllers/queueController.js) is the only source of truth.
 *
 * This hook used to initialise `doctors` and `entries` from a bundled demo
 * roster and a 14-row seed queue, and fell back to a set of in-memory reducers
 * whenever the API was unreachable. That made the desk *look* populated before
 * the first response landed and then blank out — and worse, while offline it
 * happily "issued" tokens that were never recorded anywhere. State now starts
 * empty, `loading` gates the first paint, and an unreachable backend is
 * reported rather than simulated.
 */
export function useReceptionQueue() {
  // A receptionist manages one medical center — the desk roster and the queue's
  // doctor picker are scoped to it. `centerId` is null for accounts not yet
  // linked to a center.
  const { user, loading: authLoading } = useAuth()
  const centerId = user?.centerId ?? null

  const [doctors, setDoctors] = useState<ReceptionDoctor[]>([])
  const [entries, setEntries] = useState<QueueEntry[]>([])
  const [delayAlerts, setDelayAlerts] = useState<ApiDelayAlert[]>([])
  const [selectedDoctorId, setSelectedDoctorId] = useState('')

  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [migrationPending, setMigrationPending] = useState(false)

  const [issuing, setIssuing] = useState(false)
  const [calling, setCalling] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')

  /** Ticks once a minute so "waiting 12 min" ages without a full refetch. */
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  /**
   * One fetch of everything the desk shows. Held in a ref so the polling
   * effect doesn't re-subscribe whenever a piece of state changes — the old
   * version listed a `useCallback` in its dependency array and tore the
   * interval down and back up on every tick.
   */
  const loadRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {})

  loadRef.current = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const [doctorsRes, queueRes, alertsRes] = await Promise.all([
        centerId ? api.getDoctors({ centerId }) : Promise.resolve({ doctors: [] as ApiDoctor[] }),
        api.getQueue({ centerId }),
        centerId
          ? api.getDelayAlerts({ centerId, activeOnly: true, limit: 20 })
          : Promise.resolve({ alerts: [] as ApiDelayAlert[] }),
      ])

      const mappedDoctors = doctorsRes.doctors.map(fromApiDoctor)
      setDoctors(mappedDoctors)
      setEntries(queueRes.entries.map(fromApiEntry))
      setDelayAlerts(alertsRes.alerts ?? [])
      setMigrationPending(!!queueRes.migrationPending)
      setOffline(false)
      setSelectedDoctorId(prev =>
        mappedDoctors.some(d => d.id === prev) ? prev : (mappedDoctors[0]?.id ?? ''),
      )
    } catch (err) {
      // A polling failure shouldn't wipe the desk mid-shift; only report it.
      setOffline(true)
      if (!silent) {
        setDoctors([])
        setEntries([])
        setDelayAlerts([])
      }
      if (err instanceof ApiError && err.status !== 0) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // First load, once the session is known — we need the receptionist's center
  // before the roster can be scoped.
  useEffect(() => {
    if (authLoading) return
    loadRef.current?.()
  }, [authLoading, centerId])

  // Live polling so a doctor calling the next patient from their own console
  // shows up at the desk within a few seconds.
  useEffect(() => {
    if (authLoading) return
    const interval = setInterval(() => { loadRef.current?.({ silent: true }) }, POLL_MS)
    return () => clearInterval(interval)
  }, [authLoading])

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

  /** Live delay notice for the doctor whose queue is on screen, if any. */
  const selectedDoctorDelay = useMemo(
    () => delayAlerts.find(a => a.isActive && a.doctorId === selectedDoctorId) ?? null,
    [delayAlerts, selectedDoctorId],
  )

  const issue = useCallback(
    async (input: Omit<IssueTokenInput, 'doctorId'> & { doctorId?: string }) => {
      const doctorId = input.doctorId ?? selectedDoctorId
      if (!doctorId) {
        const message = 'Select a doctor before issuing a token.'
        setError(message)
        return { ok: false as const, message }
      }

      setIssuing(true)
      setError('')
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
    [selectedDoctorId, centerId],
  )

  const callNext = useCallback(async () => {
    if (waiting.length === 0 || !selectedDoctorId) return
    setCalling(true)
    setError('')
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
  }, [selectedDoctorId, waiting.length, centerId])

  const completeCurrent = useCallback(async () => {
    if (!current) return
    setCompleting(true)
    setError('')
    try {
      const { entry } = await api.setQueueEntryStatus(current.id, 'completed')
      const mapped = fromApiEntry(entry)
      setEntries(prev => prev.map(e => (e.id === mapped.id ? mapped : e)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete this token.')
    } finally {
      setCompleting(false)
    }
  }, [current])

  const setStatus = useCallback(
    async (id: string, status: Exclude<QueueStatus, 'cancelled'>) => {
      setError('')
      try {
        const { entry } = await api.setQueueEntryStatus(id, status)
        const mapped = fromApiEntry(entry)
        setEntries(prev => prev.map(e => (e.id === mapped.id ? mapped : e)))
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not update this token.')
      }
    },
    [],
  )

  /** Estimated wait for a waiting entry, by its place in line. */
  const waitFor = useCallback(
    (entry: QueueEntry) => {
      const position = waiting.findIndex(e => e.id === entry.id)
      return estimateWaitMinutes(position + 1, selectedDoctor)
    },
    [waiting, selectedDoctor],
  )

  /** Publishes a delay for the doctor currently on screen. */
  const raiseDelay = useCallback(
    async (delayMinutes: number, reason: string) => {
      if (!selectedDoctorId) return { ok: false as const, message: 'Select a doctor first.' }
      try {
        const res = await api.createDelayAlert(selectedDoctorId, { delayMinutes, reason, centerId })
        setDelayAlerts(prev => [res.alert, ...prev.filter(a => a.id !== res.alert.id)])
        await loadRef.current?.({ silent: true })
        return { ok: true as const, notifiedCount: res.notifiedCount, message: res.message }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Could not publish the delay alert.'
        setError(message)
        return { ok: false as const, message }
      }
    },
    [selectedDoctorId, centerId],
  )

  const clearDelay = useCallback(async (alertId: string) => {
    try {
      const res = await api.clearDelayAlert(alertId)
      setDelayAlerts(prev => prev.filter(a => a.id !== res.alert.id))
      await loadRef.current?.({ silent: true })
      return { ok: true as const, message: res.message }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not clear the delay alert.'
      setError(message)
      return { ok: false as const, message }
    }
  }, [])

  /** Re-fetches everything. Used after add/edit and by the manual refresh control. */
  const refresh = useCallback(async () => { await loadRef.current?.({ silent: true }) }, [])

  return {
    // data
    entries,
    doctorQueue,
    doctors,
    delayAlerts,
    selectedDoctor,
    selectedDoctorId,
    selectedDoctorDelay,
    waiting,
    current,
    upNext,
    issuedNumbers,
    nextNumber,
    nextToken,
    /** Ticks every 30s so elapsed-time labels stay current. */
    now,
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
    raiseDelay,
    clearDelay,
    clearError: () => setError(''),
    waitFor,
    refresh,
  }
}
