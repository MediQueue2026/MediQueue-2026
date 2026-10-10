import { supabase } from '../config/supabase.js';
import { writeAuditLog } from '../services/auditService.js';

// Get Patient Profile (Users JOIN Patient Profiles)
export async function getPatientProfile(req, res, next) {
  try {
    const { userId } = req.params;

    // Fetch user basic info from users table
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (uErr) {
      console.warn('User fetch error:', uErr.message);
    }

    // Fetch patient profile info from patient_profiles table
    let { data: profile, error: pErr } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile && user?.id) {
      const { data: createdProfile } = await supabase
        .from('patient_profiles')
        .insert([{
          user_id: userId,
          blood_group: null,
          sms_alerts_enabled: true,
          delay_alerts_enabled: true
        }])
        .select()
        .maybeSingle();
      if (createdProfile) profile = createdProfile;
    }

    const mergedProfile = {
      id: userId,
      email: user?.email || '',
      fullName: user?.full_name || 'Patient User',
      phone: user?.phone || '',
      avatarUrl: user?.avatar_url || null,
      nic: profile?.nic || '',
      emergencyContactName: profile?.emergency_contact_name || '',
      emergencyContactPhone: profile?.emergency_contact_phone || '',
      bloodGroup: profile?.blood_group || '',
      allergies: profile?.allergies || '',
      chronicConditions: profile?.chronic_conditions || '',
      dateOfBirth: profile?.date_of_birth || '',
      gender: profile?.gender || '',
      smsAlertsEnabled: profile?.sms_alerts_enabled ?? true,
      delayAlertsEnabled: profile?.delay_alerts_enabled ?? true,
    };

    res.json({ profile: mergedProfile });
  } catch (err) {
    next(err);
  }
}

// Update Patient Profile (Upsert into patient_profiles and update users)
export async function updatePatientProfile(req, res, next) {
  try {
    const { userId } = req.params;
    const {
      fullName,
      email,
      phone,
      nic,
      emergencyContactName,
      emergencyContactPhone,
      bloodGroup,
      allergies,
      chronicConditions,
      dateOfBirth,
      gender,
      smsAlertsEnabled,
      delayAlertsEnabled
    } = req.body;

    const cleanBloodGroup = (bloodGroup && typeof bloodGroup === 'string' && bloodGroup.trim()) ? bloodGroup.trim() : null;

    // 1. Update basic user table if present
    if (fullName || phone) {
      const { error: userErr } = await supabase
        .from('users')
        .update({ full_name: fullName, phone })
        .eq('id', userId);
      if (userErr) console.warn('User table update notice:', userErr.message);
    }

    // 2. Persist into patient_profiles table (Check existing -> update or insert)
    const { data: existing } = await supabase
      .from('patient_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const profileData = {
      user_id: userId,
      nic: nic || '',
      emergency_contact_name: emergencyContactName || '',
      emergency_contact_phone: emergencyContactPhone || '',
      blood_group: cleanBloodGroup,
      allergies: allergies || '',
      chronic_conditions: chronicConditions || '',
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
      sms_alerts_enabled: smsAlertsEnabled ?? true,
      delay_alerts_enabled: delayAlertsEnabled ?? true
    };

    let pData, pError;
    if (existing?.id) {
      ({ data: pData, error: pError } = await supabase
        .from('patient_profiles')
        .update(profileData)
        .eq('user_id', userId)
        .select()
        .maybeSingle());
    } else {
      ({ data: pData, error: pError } = await supabase
        .from('patient_profiles')
        .insert([profileData])
        .select()
        .maybeSingle());
    }

    if (pError) {
      console.warn('patient_profiles save error:', pError.message);
    } else {
      try {
        await writeAuditLog({
          actorName: req.user?.fullName || fullName || 'Patient',
          actorRole: req.user?.role || 'patient',
          eventType: 'profile_updated',
          action: `Patient profile updated: ${fullName || req.user?.fullName || 'Patient'}`,
          centerName: 'Platform',
          status: 'completed',
        });
      } catch (auditErr) {
        console.warn('[updatePatientProfile audit log error]', auditErr?.message);
      }
    }

    res.json({
      message: 'Patient profile and settings saved successfully',
      profile: {
        id: userId,
        email: email || '',
        fullName: fullName || 'Patient User',
        phone: phone || '',
        avatarUrl: req.body?.avatarUrl || null,
        nic: nic || '',
        emergencyContactName: emergencyContactName || '',
        emergencyContactPhone: emergencyContactPhone || '',
        bloodGroup: cleanBloodGroup || '',
        allergies: allergies || '',
        chronicConditions: chronicConditions || '',
        dateOfBirth: dateOfBirth || '',
        gender: gender || '',
        smsAlertsEnabled: smsAlertsEnabled ?? true,
        delayAlertsEnabled: delayAlertsEnabled ?? true
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get Patient Doctor Subscriptions
export async function getDoctorSubscriptions(req, res, next) {
  try {
    const { patientId } = req.params;
    const { data, error } = await supabase
      .from('doctor_subscriptions')
      .select('*, doctor:doctors(*, user:users(full_name))')
      .eq('patient_id', patientId);

    if (error || !data) {
      return res.json({ subscriptions: [] });
    }

    const subscribedNames = data.map(s => s.doctor?.user?.full_name).filter(Boolean);
    res.json({ subscriptions: subscribedNames });
  } catch (err) {
    next(err);
  }
}

// Toggle Doctor Subscription
export async function toggleDoctorSubscription(req, res, next) {
  try {
    const { patientId, doctorId } = req.body;

    const { data: existing } = await supabase
      .from('doctor_subscriptions')
      .select('id')
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .maybeSingle();

    if (existing) {
      await supabase.from('doctor_subscriptions').delete().eq('id', existing.id);
      return res.json({ message: 'Unsubscribed successfully', subscribed: false });
    } else {
      await supabase.from('doctor_subscriptions').insert([{ patient_id: patientId, doctor_id: doctorId }]);
      return res.json({ message: 'Subscribed successfully', subscribed: true });
    }
  } catch (err) {
    next(err);
  }
}
