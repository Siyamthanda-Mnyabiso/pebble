'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton, TextField } from '@/components/auth/fields';
import { sendMessage, type ContactState } from '@/app/contact/actions';

const initial: ContactState = {};
const topics = ['General', 'A booking', 'Becoming a provider', 'Safety concern', 'Press'];

export function ContactForm() {
  const [state, action] = useActionState(sendMessage, initial);

  if (state.sent) {
    return (
      <div className="bg-subtle mt-10 rounded-lg p-6" role="status">
        <h2 className="type-h3">Message sent</h2>
        <p className="type-body text-muted mt-2">
          Thanks for getting in touch. We will reply by email.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-10 flex max-w-[520px] flex-col gap-4">
      <TextField
        label="Name"
        name="name"
        autoComplete="name"
        required
        maxLength={100}
        defaultValue={state.fields?.name}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={200}
        defaultValue={state.fields?.email}
      />
      <label className="block">
        <span className="type-body-s mb-2 block font-semibold">Topic</span>
        <select
          name="topic"
          defaultValue={state.fields?.topic ?? 'General'}
          className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
        >
          {topics.map((topic) => (
            <option key={topic}>{topic}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="type-body-s mb-2 block font-semibold">Message</span>
        <textarea
          name="message"
          required
          rows={5}
          maxLength={2000}
          defaultValue={state.fields?.message}
          className="border-line-strong bg-page focus:border-ink type-body-s w-full rounded-md border p-4 outline-none"
        />
      </label>
      <FormMessage error={state.error} />
      <SubmitButton>Send message</SubmitButton>
    </form>
  );
}
