'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function time(iso: string) {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** A live conversation. New messages from the other side appear without a refresh. */
export function ChatPanel({
  bookingId,
  userId,
  otherName,
  initial,
}: {
  bookingId: string;
  userId: string;
  otherName: string;
  initial: ChatMessage[];
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  function add(message: ChatMessage) {
    setMessages((current) =>
      current.some((m) => m.id === message.id) ? current : [...current, message],
    );
  }

  useEffect(() => {
    const supabase = createClient();
    void supabase.rpc('mark_thread_read', { p_booking: bookingId });

    const channel = supabase
      .channel(`messages:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage;
          add(message);
          if (message.sender_id !== userId) {
            void supabase.rpc('mark_thread_read', { p_booking: bookingId });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, userId]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    const { data, error: failure } = await createClient()
      .from('messages')
      .insert({ booking_id: bookingId, body })
      .select('id, sender_id, body, created_at')
      .single<ChatMessage>();
    setSending(false);
    if (failure || !data) {
      setError('Your message was not sent. Please try again.');
      return;
    }
    add(data);
    setDraft('');
  }

  return (
    <div className="border-line flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-xl border">
      <ol className="flex flex-1 flex-col gap-2 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <li className="type-body-s text-muted m-auto max-w-xs text-center">
            No messages yet. Say hello to {otherName}.
          </li>
        ) : null}
        {messages.map((message) => {
          const mine = message.sender_id === userId;
          return (
            <li
              key={message.id}
              className={cn(
                'flex max-w-[80%] flex-col',
                mine ? 'items-end self-end' : 'self-start',
              )}
            >
              <p
                className={cn(
                  'type-body-s rounded-2xl px-4 py-2.5 break-words whitespace-pre-wrap',
                  mine ? 'bg-dark text-on-dark' : 'bg-subtle',
                )}
              >
                {message.body}
              </p>
              <span className="type-caption text-muted mt-1">
                {time(message.created_at)}
              </span>
            </li>
          );
        })}
        <div ref={end} />
      </ol>

      <form onSubmit={send} className="border-line flex items-end gap-2 border-t p-3">
        <label className="sr-only" htmlFor="chat-draft">
          Message {otherName}
        </label>
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Write a message"
          className="border-line-strong bg-page type-body-s max-h-32 min-h-11 flex-1 resize-none rounded-lg border px-4 py-2.5"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Send
        </Button>
      </form>
      {error ? (
        <p role="alert" className="type-body-s text-danger px-4 pb-3">
          {error}
        </p>
      ) : null}
    </div>
  );
}
