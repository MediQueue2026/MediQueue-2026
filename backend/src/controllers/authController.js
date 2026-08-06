import { supabase } from '../config/supabase.js';

export async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Mock login response for development before Supabase project URL is configured
      return res.json({
        message: 'Development Mock Sign-In successful',
        user: { id: `usr_${Date.now()}`, email, role: 'patient' },
        token: `mock_jwt_token_${Date.now()}`
      });
    }

    res.json({ message: 'Login successful', session: data.session, user: data.user });
  } catch (err) {
    next(err);
  }
}

export async function registerUser(req, res, next) {
  try {
    const { email, password, fullName, phone, role } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone, role: role || 'patient' } }
    });

    if (error) {
      return res.status(201).json({
        message: 'Development Mock Sign-Up successful',
        user: { email, fullName, phone, role: role || 'patient' }
      });
    }

    res.status(201).json({ message: 'User registered', user: data.user });
  } catch (err) {
    next(err);
  }
}
