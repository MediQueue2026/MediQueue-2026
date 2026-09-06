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

export interface AppointmentItem {
  id: string;
  doctorId: string;
  doctorName: string;
  specialization: string;
  centerName: string;
  appointmentDate: string;
  slotHour: number;
  timeLabel: string;
  queueToken: string;
  status: 'booked' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled';
  isLateNumber: boolean;
}
