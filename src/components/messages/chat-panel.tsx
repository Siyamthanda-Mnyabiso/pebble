'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { createClient } from '@/lib/supabase/client';

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  image_path: string | null;
  /** A short-lived link to the photo, added when the message is loaded. */
  image_url?: string | null;
  created_at: string;
};

const MAX_IMAGE = 5 * 1024 * 1024;
const COLUMNS = 'id, sender_id, body, image_path, created_at';

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

/** A live conversation: new messages, photos and "typing" show up without a refresh. */
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
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const file = useRef<HTMLInputElement>(null);

  function add(message: ChatMessage) {
    setMessages((current) =>
      current.some((m) => m.id === message.id) ? current : [...current, message],
    );
  }

  useEffect(() => {
    const supabase = createClient();
    void supabase.rpc('mark_thread_read', { p_booking: bookingId });

    const live = supabase
      .channel(`chat:${bookingId}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        async (payload) => {
          const message = payload.new as ChatMessage;
          if (message.image_path) {
            const { data } = await supabase.storage
              .from('chat-images')
              .createSignedUrl(message.image_path, 3600);
            message.image_url = data?.signedUrl ?? null;
          }
          add(message);
          if (message.sender_id !== userId) {
            setTyping(false);
            void supabase.rpc('mark_thread_read', { p_booking: bookingId });
          }
        },
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.user === userId) return;
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3500);
      })
      .subscribe();
    channel.current = live;

    return () => {
      clearTimeout(typingTimer.current);
      channel.current = null;
      void supabase.removeChannel(live);
    };
  }, [bookingId, userId]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, typing]);

  function announceTyping() {
    const now = Date.now();
    if (now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    void channel.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user: userId },
    });
  }

  async function post(body: string, imagePath: string | null) {
    const supabase = createClient();
    const { data, error: failure } = await supabase
      .from('messages')
      .insert({ booking_id: bookingId, body, image_path: imagePath })
      .select(COLUMNS)
      .single<ChatMessage>();
    if (failure || !data) {
      setError('Your message was not sent. Please try again.');
      return false;
    }
    if (data.image_path) {
      const { data: signed } = await supabase.storage
        .from('chat-images')
        .createSignedUrl(data.image_path, 3600);
      data.image_url = signed?.signedUrl ?? null;
    }
    add(data);
    return true;
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    if (await post(body, null)) setDraft('');
    setSending(false);
  }

  async function sendPhoto(picked: File | undefined) {
    if (!picked || sending) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) {
      setError('Choose a JPEG, PNG or WebP photo.');
      return;
    }
    if (picked.size > MAX_IMAGE) {
      setError('That photo is over 5 MB. Choose a smaller one.');
      return;
    }
    setSending(true);
    setError('');
    const ext =
      picked.type === 'image/png' ? 'png' : picked.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${bookingId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await createClient()
      .storage.from('chat-images')
      .upload(path, picked, { contentType: picked.type });
    if (uploadError) {
      setError('The photo could not be uploaded. Please try again.');
    } else {
      await post(draft.trim(), path);
      setDraft('');
    }
    if (file.current) file.current.value = '';
    setSending(false);
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
              {message.image_url ? (
                <a href={message.image_url} target="_blank" rel="noreferrer">
                  {/* Short-lived signed URL, so a plain img is right here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.image_url}
                    alt="Photo sent in the chat"
                    className="max-h-64 rounded-2xl object-cover"
                  />
                </a>
              ) : message.image_path ? (
                <p className="bg-subtle type-body-s rounded-2xl px-4 py-2.5">
                  Photo unavailable
                </p>
              ) : null}
              {message.body ? (
                <p
                  className={cn(
                    'type-body-s rounded-2xl px-4 py-2.5 break-words whitespace-pre-wrap',
                    message.image_path && 'mt-1',
                    mine ? 'bg-dark text-on-dark' : 'bg-subtle',
                  )}
                >
                  {message.body}
                </p>
              ) : null}
              <span className="type-caption text-muted mt-1">
                {time(message.created_at)}
              </span>
            </li>
          );
        })}
        {typing ? (
          <li className="type-caption text-muted self-start" role="status">
            {otherName} is typing…
          </li>
        ) : null}
        <div ref={end} />
      </ol>

      <form onSubmit={send} className="border-line flex items-end gap-2 border-t p-3">
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void sendPhoto(e.target.files?.[0])}
        />
        <button
          type="button"
          aria-label="Attach a photo"
          disabled={sending}
          onClick={() => file.current?.click()}
          className="hover:bg-subtle inline-flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
        >
          <Icon name="camera" size={22} />
        </button>
        <label className="sr-only" htmlFor="chat-draft">
          Message {otherName}
        </label>
        <textarea
          id="chat-draft"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            announceTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Write a message"
          className="border-line-strong bg-page type-body-s max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-lg border px-4 py-2.5"
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
