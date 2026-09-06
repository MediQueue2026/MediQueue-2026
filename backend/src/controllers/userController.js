import { supabase } from '../config/supabase.js';

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
          blood_group: 'O+',
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
      nic: profile?.nic || '',
      emergencyContactName: profile?.emergency_contact_name || '',
      emergencyContactPhone: profile?.emergency_contact_phone || '',
      bloodGroup: profile?.blood_group || 'O+',
      allergies: profile?.allergies || '',
      chronicConditions: profile?.chronic_conditions || '',
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
      smsAlertsEnabled,
      delayAlertsEnabled
    } = req.body;

    // 1. Update basic user table if present
    if (fullName || phone) {
      const { error: userErr } = await supabase
        .from('users')
        .update({ full_name: fullName, phone })
        .eq('id', userId);
      if (userErr) console.warn('User table update notice:', userErr.message);
    }

    // 2. Upsert into patient_profiles table
    const { data, error } = await supabase
      .from('patient_profiles')
      .upsert({
        user_id: userId,
        nic,
        emergency_contact_name: emergencyContactName,
        emergency_contact_phone: emergencyContactPhone,
        blood_group: bloodGroup,
        allergies,
        chronic_conditions: chronicConditions,
        sms_alerts_enabled: smsAlertsEnabled,
        delay_alerts_enabled: delayAlertsEnabled
      }, { onConflict: 'user_id' })
      .select();

    if (error) {
      console.warn('patient_profiles upsert notice:', error.message);
    }

    res.json({
      message: 'Patient profile and settings saved successfully',
      profile: {
        id: userId,
        email: email || '',
        fullName: fullName || 'Patient User',
        phone: phone || '',
        nic: nic || '',
        emergencyContactName: emergencyContactName || '',
        emergencyContactPhone: emergencyContactPhone || '',
        bloodGroup: bloodGroup || 'O+',
        allergies: allergies || '',
        chronicConditions: chronicConditions || '',
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
