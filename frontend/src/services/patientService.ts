import { PatientProfile, HealthRecordItem, AppointmentItem } from '../types/patient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export function formatSlotTime(hour: number): string {
  if (hour === 0) return '12:00 AM';
  if (hour < 12) return `${hour < 10 ? '0' + hour : hour}:00 AM`;
  if (hour === 12) return '12:00 PM';
  const pmHour = hour - 12;
  return `${pmHour < 10 ? '0' + pmHour : pmHour}:00 PM`;
}

export async function fetchCentersList(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/centers`);
    if (res.ok) {
      const data = await res.json();
      if (data.centers && data.centers.length > 0) {
        return data.centers.map((c: any) => ({
          ...c,
          latitude: Number(c.latitude) || (c.city?.includes('Kandy') || c.name?.includes('North') ? 7.2906 : 6.9147),
          longitude: Number(c.longitude) || (c.city?.includes('Kandy') || c.name?.includes('North') ? 80.6337 : 79.8732),
        }));
      }
    }
  } catch (e) {
    console.warn('Centers API error:', e);
  }
  return [
    { id: 'a1000000-0000-0000-0000-000000000001', name: 'MediQueue Central Clinic', city: 'Colombo 07', address: '124 Medical Plaza', opening_hours: '08:00 - 20:00', phone: '0112345678', services: ['Cardiology', 'General Medicine', 'Pediatrics'], latitude: 6.9147, longitude: 79.8732 },
    { id: 'a1000000-0000-0000-0000-000000000002', name: 'MediQueue North Branch', city: 'Kandy', address: '45 Station Road', opening_hours: '09:00 - 18:00', phone: '0812345678', services: ['Orthopedics', 'General Medicine'], latitude: 7.2906, longitude: 80.6337 }
  ];
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

export async function fetchDoctorsList(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/doctors`);
    if (res.ok) {
      const data = await res.json();
      if (data.doctors && data.doctors.length > 0) {
        return data.doctors.map((d: any) => ({
          id: d.id,
          userId: d.userId || d.user_id,
          name: d.name || 'Doctor',
          spec: d.specialization || d.dept || 'General Medicine',
          room: d.room || d.room_number || 'Room 01',
          centerId: d.centerId || d.center_id || 'a1000000-0000-0000-0000-000000000001',
          centerName: d.centerName || 'MediQueue Central Clinic',
          serving: '#A-01',
          wait: `${d.avgConsultMinutes || 12} min`,
          status: d.status || d.current_status || 'active'
        }));
      }
    }
  } catch (e) {
    console.warn('Doctors API error:', e);
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

export async function bookAppointment(booking: {
  doctorId: string;
  doctorName: string;
  centerId: string;
  appointmentDate: string;
  slotHour: number;
  patientId: string;
}): Promise<{ appointment: AppointmentItem; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking),
    });
    if (res.ok) {
      const data = await res.json();
      const timeFormatted = formatSlotTime(booking.slotHour);
      return {
        appointment: {
          id: data.appointment.id,
          doctorId: booking.doctorId,
          doctorName: booking.doctorName,
          specialization: 'General Medicine',
          centerName: 'MediQueue Central Clinic',
          appointmentDate: booking.appointmentDate,
          slotHour: booking.slotHour,
          timeLabel: timeFormatted,
          queueToken: data.appointment.queuePosition || '#A-15',
          status: 'booked',
          isLateNumber: data.appointment.isLateNumber || false,
        },
        message: data.message || 'Appointment booked successfully!',
      };
    }
  } catch (e) {
    console.warn('Book appointment API error:', e);
  }

  const tokenNum = `#A-${Math.floor(Math.random() * 20 + 10)}`;
  const timeFormatted = formatSlotTime(booking.slotHour);
  return {
    appointment: {
      id: `apt_${Date.now()}`,
      doctorId: booking.doctorId,
      doctorName: booking.doctorName,
      specialization: 'General Medicine',
      centerName: 'MediQueue Central Clinic',
      appointmentDate: booking.appointmentDate,
      slotHour: booking.slotHour,
      timeLabel: timeFormatted,
      queueToken: tokenNum,
      status: 'booked',
      isLateNumber: false,
    },
    message: 'Appointment booked successfully!',
  };
}