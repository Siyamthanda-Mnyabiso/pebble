'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/icons';
import { CITIES, CITY_COOKIE, DEFAULT_CITY, isCity, nearestCity } from '@/data/cities';
import { cn } from '@/lib/cn';

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
function notify() {
  listeners.forEach((l) => l());
}

function readCookie() {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${CITY_COOKIE}=([^;]*)`));
    const value = match ? decodeURIComponent(match[1]) : '';
    return isCity(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Shows the visitor's city and lets them change it, by list or by their location.
 * The choice is remembered in a cookie so the server can filter providers by city.
 */
export function LocationPicker({
  city: serverCity,
  active = [],
  className,
}: {
  /** The city the server used. Leave out where the page cannot read the cookie. */
  city?: string;
  /** Cities that have providers. They are listed first. */
  active?: string[];
  className?: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  // Without a server value (the static home page) the saved choice is read in the browser.
  const saved = useSyncExternalStore(subscribe, readCookie, () => null);
  const [picked, setPicked] = useState<string | null>(null);
  const city = picked ?? serverCity ?? saved ?? DEFAULT_CITY;
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);

  function choose(name: string) {
    try {
      document.cookie = `${CITY_COOKIE}=${encodeURIComponent(name)}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked: the choice still applies to this page */
    }
    setPicked(name);
    notify();
    dialog.current?.close();
    // A ?city= in the address would override the new choice.
    const url = new URL(window.location.href);
    if (url.searchParams.has('city')) {
      url.searchParams.delete('city');
      router.replace(`${url.pathname}${url.search}`);
    }
    router.refresh();
  }

  function locate() {
    setStatus('');
    if (!('geolocation' in navigator)) {
      setStatus('Your browser cannot share its location. Pick a city instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { name, km } = nearestCity(pos.coords.latitude, pos.coords.longitude);
        if (km > 150) {
          setStatus(`We are not in your area yet. The closest city is ${name}.`);
        }
        choose(name);
      },
      () => {
        setLocating(false);
        setStatus('We could not get your location. Pick a city instead.');
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  const sorted = [...CITIES].sort(
    (a, b) => Number(active.includes(b.name)) - Number(active.includes(a.name)),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={cn(
          'type-body-s inline-flex items-center gap-2 font-semibold',
          className,
        )}
        aria-haspopup="dialog"
      >
        <Icon name="pin" size={18} />
        {city}
      </button>

      <dialog
        ref={dialog}
        aria-label="Choose your city"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className="bg-page m-auto w-[calc(100%-32px)] max-w-[420px] rounded-xl p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="type-h3">Where do you need help?</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
              className="hover:bg-subtle inline-flex size-9 items-center justify-center rounded-full"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="bg-dark text-on-dark type-body-s mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-60"
          >
            <Icon name="pin" size={16} />
            {locating ? 'Finding you…' : 'Use my current location'}
          </button>
          {status ? (
            <p role="status" className="type-body-s text-muted mt-3">
              {status}
            </p>
          ) : null}

          <p className="type-caption text-muted mt-5 font-semibold">Or choose a city</p>
          <ul className="mt-2 grid max-h-[40vh] grid-cols-2 gap-2 overflow-y-auto">
            {sorted.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  aria-pressed={c.name === city}
                  onClick={() => choose(c.name)}
                  className={cn(
                    'type-body-s h-11 w-full rounded-lg border px-3 text-left',
                    c.name === city
                      ? 'border-ink font-semibold'
                      : 'border-line hover:bg-subtle',
                  )}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="type-caption text-muted mt-4">
            You see providers who work in your city, so you are never limited to a small
            radius.
          </p>
        </div>
      </dialog>
    </>
  );
}
