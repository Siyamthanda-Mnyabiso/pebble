'use server';

import { createClient } from '@/lib/supabase/server';

export type ContactState = {
  error?: string;
  sent?: boolean;
  fields?: Record<string, string>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPICS = ['General', 'A booking', 'Becoming a provider', 'Safety concern', 'Press'];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function sendMessage(
  _: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = text(formData, 'name');
  const email = text(formData, 'email').toLowerCase();
  const topic = text(formData, 'topic');
  const message = text(formData, 'message');
  const fields = { name, email, topic, message };

  if (!name || name.length > 100) return { error: 'Enter your name.', fields };
  if (!EMAIL.test(email) || email.length > 200) {
    return { error: 'Enter a valid email so we can reply.', fields };
  }
  if (message.length < 5) return { error: 'Write a short message.', fields };
  if (message.length > 2000) {
    return { error: 'Keep your message under 2000 characters.', fields };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('contact_messages').insert({
    name,
    email,
    topic: TOPICS.includes(topic) ? topic : 'General',
    message,
  });
  if (error) {
    return { error: 'We could not send that. Please try again.', fields };
  }
  return { sent: true };
}
