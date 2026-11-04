'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { safeNext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type AuthState = {
  error?: string;
  notice?: string;
  fields?: Record<string, string>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto =
    h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = text(formData, 'email').toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  if (!EMAIL.test(email) || !password) {
    return { error: 'Enter your email and password.', fields: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === 'email_not_confirmed'
          ? 'Confirm your email first. We sent you a link when you signed up.'
          : 'That email and password do not match.',
      fields: { email },
    };
  }
  redirect(next);
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = text(formData, 'full_name');
  const email = text(formData, 'email').toLowerCase();
  const phone = text(formData, 'phone');
  const password = String(formData.get('password') ?? '');
  const role = formData.get('role') === 'provider' ? 'provider' : 'customer';
  const next = safeNext(formData.get('next'));
  const fields = { full_name: fullName, email, phone, role };

  if (fullName.length < 2) return { error: 'Enter your full name.', fields };
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.', fields };
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
    return { error: 'Enter a valid mobile number.', fields };
  }
  if (password.length < 8) {
    return { error: 'Your password needs at least 8 characters.', fields };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone, role },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    return {
      error:
        error.code === 'over_email_send_rate_limit'
          ? 'Too many emails sent. Please try again in a little while.'
          : 'We could not create your account. Please check your details and try again.',
      fields,
    };
  }
  if (data.session) redirect(next);
  return {
    notice: `We sent a confirmation link to ${email}. Open it to finish signing up.`,
  };
}

export async function requestPasswordReset(
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = text(formData, 'email').toLowerCase();
  if (!EMAIL.test(email))
    return { error: 'Enter a valid email address.', fields: { email } };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/callback?next=/account/settings`,
  });
  // Same answer whether or not the account exists.
  return { notice: 'If that email has an account, a reset link is on its way.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
