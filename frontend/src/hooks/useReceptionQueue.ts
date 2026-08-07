import { useCallback, useMemo, useState } from 'react'
import {
  QueueError,
  RECEPTION_DOCTORS,
  callNext as callNextReducer,
  completeCurrent as completeCurrentReducer,
  currentFor,
  estimateWaitMinutes,
  findDoctor,
  forDoctor,
  formatToken,
  issueToken as issueTokenReducer,
  issuedNumbers as issuedNumbersFor,
  nextTokenNumber,
  setEntryStatus as setEntryStatusReducer,
  seedQueue,
  waitingFor,
} from '../lib/receptionQueue'
import type { IssueTokenInput, QueueEntry, QueueStatus } from '../lib/receptionQueue'

/**
 * Live reception queue for one counter.
 *
 * Holds the whole clinic's queue but exposes the selected doctor's slice, so
 * the desk can switch doctors without losing the other queues. State is
 * in-memory; when the API is ready, swap each handler's reducer call for the
 * matching request (the SQL is documented in `lib/receptionQueue.ts`) and keep
 * the same return shape.
 */
export function useReceptionQueue(initialDoctorId = RECEPTION_DOCTORS[0]?.id ?? '') {
  const [entries, setEntries] = useState<QueueEntry[]>(seedQueue)
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId)

  // Pending flags — the buttons stay disabled while a transition is in flight,
  // which is also what we'll want once these become real requests.
  const [issuing, setIssuing] = useState(false)
  const [calling, setCalling] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState('')

  const selectedDoctor = useMemo(() => findDoctor(selectedDoctorId), [selectedDoctorId])

  const doctorQueue = useMemo(() => forDoctor(entries, selectedDoctorId), [entries, selectedDoctorId])
  const waiting = useMemo(() => waitingFor(entries, selectedDoctorId), [entries, selectedDoctorId])
  const current = useMemo(() => currentFor(entries, selectedDoctorId), [entries, selectedDoctorId])
  const issuedNumbers = useMemo(() => issuedNumbersFor(entries, selectedDoctorId), [entries, selectedDoctorId])

  const nextNumber = useMemo(() => nextTokenNumber(entries, selectedDoctorId), [entries, selectedDoctorId])
  const nextToken = useMemo(
    () => formatToken(selectedDoctor?.series ?? '?', nextNumber),
    [selectedDoctor, nextNumber],
  )

  /** The token the "Call Next" button will pull in. */
  const upNext = waiting[0]

  const issue = useCallback(
    (input: Omit<IssueTokenInput, 'doctorId'> & { doctorId?: string }) => {
      setIssuing(true)
      setError('')
      try {
        const next = issueTokenReducer(entries, { ...input, doctorId: input.doctorId ?? selectedDoctorId })
        setEntries(next)
        // The new row is the one this call added.
        const added = next.find((e) => !entries.some((prev) => prev.id === e.id))
        return { ok: true as const, entry: added }
      } catch (err) {
        const message = err instanceof QueueError ? err.message : 'Could not issue this token.'
        setError(message)
        return { ok: false as const, message }
      } finally {
        setIssuing(false)
      }
    },
    [entries, selectedDoctorId],
  )

  const callNext = useCallback(() => {
    if (waiting.length === 0) return
    setCalling(true)
    setEntries((prev) => callNextReducer(prev, selectedDoctorId))
    setCalling(false)
  }, [selectedDoctorId, waiting.length])

  const completeCurrent = useCallback(() => {
    if (!current) return
    setCompleting(true)
    setEntries((prev) => completeCurrentReducer(prev, selectedDoctorId))
    setCompleting(false)
  }, [current, selectedDoctorId])

  const setStatus = useCallback((id: string, status: QueueStatus) => {
    setEntries((prev) => setEntryStatusReducer(prev, id, status))
  }, [])

  /** Estimated wait for a waiting entry, by its place in line. */
  const waitFor = useCallback(
    (entry: QueueEntry) => {
      const position = waiting.findIndex((e) => e.id === entry.id)
      return estimateWaitMinutes(position + 1, selectedDoctor)
    },
    [waiting, selectedDoctor],
  )

  return {
    // data
    entries,
    doctorQueue,
    doctors: RECEPTION_DOCTORS,
    selectedDoctor,
    selectedDoctorId,
    waiting,
    current,
    upNext,
    issuedNumbers,
    nextNumber,
    nextToken,
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
  }
}
