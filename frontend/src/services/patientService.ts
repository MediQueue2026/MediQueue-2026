import { PatientProfile, HealthRecordItem, AppointmentItem } from '../types/patient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export function formatSlotTime(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour < 10 ? '0' + hour : hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  const pmHour = hour - 12;
  return `${pmHour < 10 ? '0' + pmHour : pmHour}:00 PM`;
}

/**
 * Approved medical centers.
 *
 * Returns `[]` when there are none or the API is unreachable. It used to fall
 * back to two invented clinics ("MediQueue Central Clinic" in Colombo 07 and a
 * "North Branch" in Kandy, complete with plausible coordinates and phone
 * numbers). Those rendered as real pins on the patient's clinic map and as
 * bookable options, then vanished as soon as a genuine center was approved —
 * and a patient who tried to book one got an error, because the ids didn't
 * exist in the database.
 */
export async function fetchCentersList(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/centers`);
    if (res.ok) {
      const data = await res.json();
      return (data.centers ?? []).map((c: any) => {
        const rawLat = c.latitude ?? c.lat;
        const rawLng = c.longitude ?? c.lng;
        const numLat = rawLat !== null && rawLat !== undefined && !isNaN(Number(rawLat)) ? Number(rawLat) : null;
        const numLng = rawLng !== null && rawLng !== undefined && !isNaN(Number(rawLng)) ? Number(rawLng) : null;
        return { ...c, latitude: numLat, longitude: numLng };
      });
    }
  } catch (e) {
    console.warn('Centers API error:', e);
  }
  return [];
}

/**
 * Upcoming dates a center is closed (public holidays etc. — see backend
 * center_closures). Returns the raw `YYYY-MM-DD` strings; `[]` on any failure so
 * the booking form degrades to "nothing is closed" rather than blocking.
 */
export async function fetchCenterClosures(centerId: string): Promise<string[]> {
  if (!centerId) return [];
  try {
    const res = await fetch(`${API_BASE}/centers/${centerId}/closures`);
    if (res.ok) {
      const data = await res.json();
      return (data.closures ?? []).map((c: any) => c.closedDate).filter(Boolean);
    }
  } catch (e) {
    console.warn('Center closures API error:', e);
  }
  return [];
}

/**
 * Upcoming date-specific hours overrides for a center (migration 014):
 * per-date doctor overrides (drive bookable slots) and a display-only centre
 * opening-hours label. `{ centerHours: [], doctorHours: [] }` on any failure.
 */
export async function fetchCenterDayHours(centerId: string): Promise<{
  centerHours: { openDate: string; hoursLabel: string; note: string }[]
  doctorHours: { doctorId: string; workDate: string; isWorking: boolean; startTime: string | null; endTime: string | null }[]
}> {
  const empty = { centerHours: [], doctorHours: [] };
  if (!centerId) return empty;
  try {
    const res = await fetch(`${API_BASE}/centers/${centerId}/day-hours`);
    if (res.ok) {
      const data = await res.json();
      return {
        centerHours: data.centerHours ?? [],
        doctorHours: data.doctorHours ?? [],
      };
    }
  } catch (e) {
    console.warn('Center day-hours API error:', e);
  }
  return empty;
}

export async function fetchPatientProfile(userId: string, defaultName?: string, defaultEmail?: string): Promise<PatientProfile> {
  try {
    const res = await fetch(`${API_BASE}/patient/profile/${userId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.profile) return data.profile;
    }
  } catch (e) {
    console.warn('Patient profile API fetch error:', e);
  }
  return {
    id: userId,
    email: defaultEmail || '',
    fullName: defaultName || 'Patient User',
    phone: '',
    nic: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bloodGroup: 'O+',
    allergies: '',
    chronicConditions: '',
    smsAlertsEnabled: true,
    delayAlertsEnabled: true,
  };
}

export async function savePatientProfile(userId: string, profile: Partial<PatientProfile>): Promise<PatientProfile> {
  try {
    const res = await fetch(`${API_BASE}/patient/profile/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.profile) return data.profile;
    }
  } catch (e) {
    console.warn('Save patient profile API error:', e);
  }

  return {
    id: userId,
    email: profile.email || '',
    fullName: profile.fullName || 'Patient User',
    phone: profile.phone || '',
    nic: profile.nic || '',
    emergencyContactName: profile.emergencyContactName || '',
    emergencyContactPhone: profile.emergencyContactPhone || '',
    bloodGroup: profile.bloodGroup || 'O+',
    allergies: profile.allergies || '',
    chronicConditions: profile.chronicConditions || '',
    smsAlertsEnabled: profile.smsAlertsEnabled ?? true,
    delayAlertsEnabled: profile.delayAlertsEnabled ?? true,
  };
}

/**
 * The public doctor roster.
 *
 * Every field now comes from the row itself. Previously each doctor was given
 * `serving: '#A-01'` (a token nobody was actually being seen under),
 * `room: 'Room 01'`, `spec: 'General Medicine'` and — worst of all — a
 * hardcoded `centerId` pointing at a clinic that may not exist, so "Book Slot"
 * submitted a booking against a bogus center. Missing values are `null` and
 * the UI shows a dash.
 */
export async function fetchDoctorsList(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/doctors`);
    if (res.ok) {
      const data = await res.json();
      return (data.doctors ?? []).map((d: any) => ({
        id: d.id,
        userId: d.userId ?? d.user_id ?? null,
        name: d.name ?? 'Doctor',
        spec: d.specialization ?? d.dept ?? null,
        room: d.room && d.room !== '—' ? d.room : null,
        series: d.series && d.series !== '?' ? d.series : null,
        centerId: d.centerId ?? d.center_id ?? null,
        centerName: d.centerName ?? null,
        centers: d.centers ?? [],
        // Scheduled consult length, not a live queue position — the caller
        // labels it as an estimate.
        avgConsultMinutes: typeof d.avgConsultMinutes === 'number' ? d.avgConsultMinutes : null,
        delayMinutes: typeof d.delayMinutes === 'number' ? d.delayMinutes : 0,
        status: d.status ?? d.current_status ?? 'active',
      }));
    }
  } catch (e) {
    console.warn('Doctors API error:', e);
  }
  return [];
}

/**
 * Live delay notices for doctors this patient subscribes to (BR-05 / FR-07).
 * Scoping happens server-side: a patient with no subscriptions gets nothing.
 */
export async function fetchPatientDelayAlerts(patientId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/delay-alerts?patientId=${encodeURIComponent(patientId)}&limit=20`);
    if (res.ok) {
      const data = await res.json();
      return data.alerts ?? [];
    }
  } catch (e) {
    console.warn('Delay alerts API error:', e);
  }
  return [];
}

export async function fetchPatientSubscriptions(patientId: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/subscriptions/patient/${patientId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.subscriptions) return data.subscriptions;
    }
  } catch (e) {
    console.warn('Subscriptions API error:', e);
  }
  return [];
}

export async function toggleDoctorSubscriptionAPI(patientId: string, doctorId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/subscriptions/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, doctorId }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.subscribed;
    }
  } catch (e) {
    console.warn('Toggle subscription API error:', e);
  }
  return false;
}

export async function fetchPatientAppointments(patientId: string): Promise<AppointmentItem[]> {
  try {
    const res = await fetch(`${API_BASE}/appointments/patient/${patientId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.appointments) return data.appointments;
    }
  } catch (e) {
    console.warn('Appointments API error:', e);
  }

  return [];
}

export async function cancelPatientAppointment(appointmentId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/appointments/${appointmentId}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.ok;
  } catch (e) {
    console.warn('Cancel appointment API error:', e);
    return false;
  }
}

export async function fetchHealthRecords(userId: string): Promise<HealthRecordItem[]> {
  try {
    const res = await fetch(`${API_BASE}/records/${userId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.records && Array.isArray(data.records)) {
        return data.records.map((r: any) => ({
          id: r.id,
          title: r.title,
          notes: r.notes,
          fileUrl: r.file_url,
          recordType: r.record_type || r.recordType || 'prescription',
          record_type: r.record_type || r.recordType || 'prescription',
          issuingAuthority: r.issuing_authority || r.issuingAuthority || 'MediQueue EHR',
          issuing_authority: r.issuing_authority || r.issuingAuthority || 'MediQueue EHR',
          date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Recent',
          rxMedications: r.rx_medications || r.rxMedications || [],
          rx_medications: r.rx_medications || r.rxMedications || []
        }));
      }
    }
  } catch (e) {
    console.warn('Health records API error:', e);
  }

  return [];
}

export async function uploadHealthRecord(record: Partial<HealthRecordItem>): Promise<HealthRecordItem> {
  try {
    const res = await fetch(`${API_BASE}/records/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (res.ok) {
      const data = await res.json();
      return data.record;
    }
  } catch (e) {
    console.warn('Upload report API error:', e);
  }

  return {
    id: `rec_${Date.now()}`,
    patientId: record.patientId || '',
    title: record.title || 'Diagnostic Report',
    recordType: record.recordType || 'lab_report',
    issuingAuthority: record.issuingAuthority || 'MediQueue Diagnostics',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    notes: record.notes || 'Uploaded by patient',
  };
}

/**
 * Books a slot. **Throws** when the booking did not happen.
 *
 * The old version swallowed every failure and returned a fabricated
 * appointment: a random token like `#A-17`, a local `apt_<timestamp>` id, a
 * hardcoded clinic name, and the message "Appointment booked successfully!".
 * The patient saw a confirmed booking with a queue token that existed nowhere
 * — no row in `appointments`, nothing at the reception desk, no slot held —
 * and it disappeared on the next refresh. A failed booking must surface as a
 * failure.
 *
 * `specialization` and `centerName` come from the server response so the
 * confirmation shows the real clinic rather than a placeholder.
 */
export async function bookAppointment(booking: {
  doctorId: string;
  doctorName: string;
  centerId: string;
  appointmentDate: string;
  slotHour: number;
  patientId: string;
}): Promise<{ appointment: AppointmentItem; message: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    });
  } catch {
    throw new Error('Cannot reach the MediQueue server. Your appointment was not booked — please try again.');
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    throw new Error(data?.error || `Could not book this slot (${res.status}). Please pick another time.`);
  }
  if (!data?.appointment?.id) {
    throw new Error('The server did not confirm this booking. Please check your appointments before retrying.');
  }

  const a = data.appointment;
  return {
    appointment: {
      id: a.id,
      doctorId: a.doctorId ?? booking.doctorId,
      doctorName: a.doctorName ?? booking.doctorName,
      specialization: a.specialization ?? null,
      centerName: a.centerName ?? null,
      appointmentDate: a.appointmentDate ?? booking.appointmentDate,
      slotHour: a.slotHour ?? booking.slotHour,
      timeLabel: formatSlotTime(a.slotHour ?? booking.slotHour),
      queueToken: a.queueToken ?? a.queuePosition ?? null,
      status: a.status ?? 'booked',
      isLateNumber: a.isLateNumber ?? false,
    },
    message: data.message || 'Appointment booked successfully!',
  };
}

export async function fetchDoctorHours(doctorId: string): Promise<{ hours: any[]; maxAppointmentsPerHour: number; advanceBookingDays: number }> {
  try {
    const res = await fetch(`${API_BASE}/doctors/${doctorId}/hours`);
    if (res.ok) {
      const data = await res.json();
      return {
        hours: data.hours || [],
        maxAppointmentsPerHour: data.maxAppointmentsPerHour || 4,
        advanceBookingDays: data.advanceBookingDays || 7,
      };
    }
  } catch (e) {
    console.warn('Fetch doctor hours API error:', e);
  }
  return { hours: [], maxAppointmentsPerHour: 4, advanceBookingDays: 7 };
}

export async function fetchAllAppointments(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/appointments`);
    if (res.ok) {
      const data = await res.json();
      return data.appointments || [];
    }
  } catch (e) {
    console.warn('Fetch all appointments API error:', e);
  }
  return [];
}