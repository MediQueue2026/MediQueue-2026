export interface PatientProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  nic?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  allergies?: string;
  chronicConditions?: string;
  smsAlertsEnabled: boolean;
  delayAlertsEnabled: boolean;
}

export interface PrescriptionItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface HealthRecordItem {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  title: string;
  recordType: 'prescription' | 'lab_report' | 'ecg' | 'xray' | 'general';
  issuingAuthority: string;
  date: string;
  notes?: string;
  medications?: PrescriptionItem[];
  fileUrl?: string;
}

/**
 * `specialization`, `centerName`, `roomNumber` and `queueToken` are nullable
 * because the underlying rows genuinely can be missing them. They used to be
 * typed non-null and backfilled server-side with "General Medicine" /
 * "MediQueue Clinic" / a made-up token, which meant the dashboard confidently
 * displayed details nobody had entered. Render a dash when these are null.
 */
export interface AppointmentItem {
  id: string;
  doctorId: string;
  doctorName: string;
  specialization: string | null;
  centerId?: string | null;
  centerName: string | null;
  roomNumber?: string | null;
  appointmentDate: string;
  slotHour: number;
  timeLabel: string;
  queueToken: string | null;
  status: 'booked' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled';
  isLateNumber: boolean;
}
