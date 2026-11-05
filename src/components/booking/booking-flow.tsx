'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { createBooking } from '@/app/book/[slug]/actions';
import { Icon, type IconName } from '@/components/icons';
import { Button, ButtonLink } from '@/components/ui/button';
import type { Provider } from '@/data/providers';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';
import { Stepper } from './stepper';

const DRAFT_KEY = 'pebble-booking-draft';
const rand = new Intl.NumberFormat('en-ZA');

type Draft = {
  service: string;
  date: string;
  time: string;
  address: string;
  notes: string;
};

const field =
  'border-line-strong bg-page focus-within:border-ink flex min-h-14 items-center gap-3 rounded-md border px-4 transition-colors';

function Summary({
  provider,
  serviceName,
  price,
  action,
  note,
}: {
  provider: Provider;
  serviceName: string;
  price: number;
  action: React.ReactNode;
  note: React.ReactNode;
}) {
  return (
    <aside className="bg-page shadow-card h-fit rounded-xl p-6 lg:sticky lg:top-6">
      <div className="flex items-center gap-4">
        <Image
          src={provider.image}
          alt=""
          width={64}
          height={64}
          className="size-16 rounded-md object-cover"
        />
        <div>
          <p className="type-h4">{provider.name}</p>
          <p className="type-body-s text-muted mt-1 flex items-center gap-1.5">
            <Icon name="starFilled" size={14} className="text-ink" />
            {provider.rating.toFixed(1)} ({provider.reviewCount})
          </p>
        </div>
      </div>
      <dl className="border-line mt-5 flex flex-col gap-3 border-t pt-5">
        <div className="flex justify-between gap-4">
          <dt className="type-body text-muted">{serviceName}</dt>
          <dd className="type-body font-semibold">R{rand.format(price)}</dd>
        </div>
      </dl>
      <div className="border-ink mt-4 flex justify-between border-t pt-4">
        <p className="type-body font-semibold">Total</p>
        <p className="type-body font-semibold">R{rand.format(price)}</p>
      </div>
      <div className="mt-5">{action}</div>
      <p className="type-caption text-muted mt-4">{note}</p>
    </aside>
  );
}

export function BookingFlow({ provider }: { provider: Provider }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('service');
  const openDays = provider.availability.filter((d) => d.slots > 0);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [draft, setDraft] = useState<Draft>(() => ({
    service:
      provider.services.find((s) => s.name === requested)?.name ??
      provider.services[0].name,
    date: openDays[0]?.iso ?? '',
    time: openDays[0]?.times[0] ?? '',
    address: '',
    notes: '',
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [reference, setReference] = useState('');
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  // Coming back from sign in: restore what they had filled in and go to review.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Draft;
      if (parsed.address && provider.services.some((s) => s.name === parsed.service)) {
        // Keep the saved date and time only if that slot is still open.
        const day = openDays.find((d) => d.iso === parsed.date);
        const time = day?.times.includes(parsed.time) ? parsed.time : '';
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDraft({ ...parsed, date: day ? parsed.date : '', time });
        setStep(2);
      }
    } catch {
      // Storage can be unavailable or hold stale data; start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.services]);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const service = provider.services.find((s) => s.name === draft.service)!;
  const dayTimes = openDays.find((d) => d.iso === draft.date)?.times ?? [];
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === 'date') {
        const times = openDays.find((day) => day.iso === value)?.times ?? [];
        if (!times.includes(next.time)) next.time = times[0] ?? '';
      }
      return next;
    });
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function next() {
    const found: typeof errors = {};
    if (!draft.date) found.date = 'Choose a date.';
    if (draft.address.trim().length < 5) {
      found.address = 'Enter the address where the job takes place.';
    }
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(2);
  }

  function confirm() {
    setSubmitError('');
    startTransition(async () => {
      const result = await createBooking({
        providerSlug: provider.slug,
        service: draft.service,
        date: draft.date,
        time: draft.time,
        address: draft.address,
        notes: draft.notes,
      });
      if (result.ok) {
        setReference(result.reference);
        sessionStorage.removeItem(DRAFT_KEY);
        setStep(3);
      } else if (result.needsSignIn) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        router.push(`/sign-in?next=${encodeURIComponent(`/book/${provider.slug}`)}`);
      } else {
        setSubmitError(result.error);
      }
    });
  }

  const categoryName = provider.category;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pt-6 pb-24 md:px-8">
      <Stepper current={step} />

      {step === 3 ? (
        <section className="mx-auto mt-12 flex max-w-[540px] flex-col items-center text-center">
          <span className="bg-dark text-on-dark inline-flex size-[88px] items-center justify-center rounded-full">
            <Icon name="check" size={40} />
          </span>
          <h1 ref={heading} tabIndex={-1} className="type-display mt-8 outline-none">
            You are booked!
          </h1>
          <p className="type-body-l text-muted mt-5">
            {provider.name} will confirm your booking. You can follow it under Bookings in
            your account.
          </p>

          <div className="bg-page shadow-card mt-8 w-full rounded-xl p-6 text-left">
            <div className="flex items-center gap-4">
              <Image
                src={provider.image}
                alt=""
                width={64}
                height={64}
                className="size-16 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="type-h3">{draft.service}</p>
                <p className="type-body-s text-muted">{provider.name}</p>
              </div>
              <p className="type-h3">R{rand.format(service.fromPrice)}</p>
            </div>
            <ul className="border-line mt-5 flex flex-col gap-4 border-t pt-5">
              {(
                [
                  [
                    'calendar',
                    `${formatDay(draft.date, { year: true })} · ${draft.time}`,
                  ],
                  ['pin', draft.address],
                  ['info', `Booking reference ${reference}`],
                ] as [IconName, string][]
              ).map(([icon, text]) => (
                <li key={icon} className="type-body flex items-center gap-3">
                  <Icon name={icon} size={20} />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Emails are not sent yet. */}
          <p className="type-caption text-muted bg-subtle mt-6 rounded-md px-4 py-3">
            Your booking is saved to your account. Provider notifications and confirmation
            emails are not switched on yet.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink
              href="/account/bookings"
              size="lg"
              arrow
              className="min-w-[200px]"
            >
              View booking
            </ButtonLink>
            <ButtonLink href="/" variant="secondary" size="lg">
              Back to home
            </ButtonLink>
          </div>
        </section>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-12">
          <section>
            {step === 1 ? (
              <>
                <h1 ref={heading} tabIndex={-1} className="type-h1 outline-none">
                  Book a {categoryName} service
                </h1>
                <p className="type-body-l text-muted mt-3">
                  Tell us when and where. You will not be charged yet.
                </p>

                <form
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    next();
                  }}
                  className="mt-8 flex flex-col gap-4"
                  id="details"
                >
                  <label className={field}>
                    <Icon name="sparkles" size={20} />
                    <span className="sr-only">Service</span>
                    <select
                      value={draft.service}
                      onChange={(e) => set('service', e.target.value)}
                      className="type-body-s w-full bg-transparent py-4 font-semibold outline-none"
                    >
                      {provider.services.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={field}>
                        <Icon name="calendar" size={20} />
                        <span className="sr-only">Date</span>
                        <select
                          value={draft.date}
                          onChange={(e) => set('date', e.target.value)}
                          className="type-body-s w-full bg-transparent py-4 font-semibold outline-none"
                        >
                          {openDays.map((d) => (
                            <option key={d.iso} value={d.iso}>
                              {formatDay(d.iso)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {errors.date ? (
                        <p className="type-caption text-danger mt-1.5">{errors.date}</p>
                      ) : null}
                    </div>
                    <div className={field}>
                      <Icon name="clock" size={20} />
                      <span className="type-body-s py-4 font-semibold">{draft.time}</span>
                    </div>
                  </div>

                  <fieldset className="flex flex-wrap gap-3">
                    <legend className="sr-only">Start time</legend>
                    {dayTimes.map((time) => (
                      <button
                        key={time}
                        type="button"
                        aria-pressed={draft.time === time}
                        onClick={() => set('time', time)}
                        className={cn(
                          'type-body-s h-11 rounded-full border px-5 font-semibold transition-colors',
                          draft.time === time
                            ? 'bg-dark text-on-dark border-transparent'
                            : 'border-line-strong hover:bg-subtle',
                        )}
                      >
                        {time}
                      </button>
                    ))}
                  </fieldset>

                  <div>
                    <label className={cn(field, errors.address && 'border-danger')}>
                      <Icon name="pin" size={20} />
                      <span className="sr-only">Address</span>
                      <input
                        value={draft.address}
                        onChange={(e) => set('address', e.target.value)}
                        autoComplete="street-address"
                        maxLength={200}
                        placeholder="Street address, suburb"
                        aria-invalid={Boolean(errors.address)}
                        className="type-body-s placeholder:text-faint w-full bg-transparent py-4 font-semibold outline-none"
                      />
                    </label>
                    {errors.address ? (
                      <p className="type-caption text-danger mt-1.5" role="alert">
                        {errors.address}
                      </p>
                    ) : null}
                  </div>

                  <label className={cn(field, 'items-start py-4')}>
                    <Icon name="message" size={20} className="mt-0.5 shrink-0" />
                    <span className="sr-only">Special instructions</span>
                    <textarea
                      value={draft.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      maxLength={500}
                      rows={4}
                      placeholder="Add any special instructions (optional)"
                      className="type-body-s placeholder:text-faint w-full resize-none bg-transparent outline-none"
                    />
                  </label>
                </form>
              </>
            ) : (
              <>
                <h1 ref={heading} tabIndex={-1} className="type-h1 outline-none">
                  Review your booking
                </h1>
                <p className="type-body-l text-muted mt-3">
                  Check everything looks right before you confirm.
                </p>

                <dl className="bg-page shadow-card mt-8 rounded-xl px-6">
                  {[
                    ['Service', `${draft.service}, ${service.detail.split(' · ')[0]}`],
                    [
                      'Date and time',
                      `${formatDay(draft.date, { year: true })} · ${draft.time}`,
                    ],
                    ['Address', draft.address],
                    ['Instructions', draft.notes || 'None'],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="border-line grid grid-cols-[110px_1fr_auto] items-center gap-4 border-b py-5 last:border-b-0 sm:grid-cols-[150px_1fr_auto]"
                    >
                      <dt className="type-body-s text-muted">{label}</dt>
                      <dd className="type-body font-semibold break-words">{value}</dd>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        aria-label={`Edit ${label.toLowerCase()}`}
                        className="type-body-s font-semibold underline-offset-4 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </dl>

                <section className="bg-page shadow-card mt-6 rounded-xl p-6">
                  <h2 className="type-h3">Payment</h2>
                  <div className="mt-4 flex items-start gap-3">
                    <span
                      className="border-ink mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-[6px]"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="type-body font-semibold">Nothing to pay yet</p>
                      <p className="type-body-s text-muted mt-0.5">
                        You pay the provider&apos;s listed price, with no booking fee.
                        Payments are not switched on in this preview.
                      </p>
                    </div>
                  </div>
                </section>
                {submitError ? (
                  <p className="type-body-s text-danger mt-4" role="alert">
                    {submitError}
                  </p>
                ) : null}
              </>
            )}
          </section>

          <Summary
            provider={provider}
            serviceName={draft.service}
            price={service.fromPrice}
            action={
              step === 1 ? (
                <Button
                  type="submit"
                  form="details"
                  size="lg"
                  className="w-full justify-between pr-5"
                >
                  Continue
                  <Icon name="skip" size={20} />
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={confirm}
                  disabled={pending}
                  className="w-full justify-between pr-5"
                >
                  {pending ? 'Confirming…' : 'Confirm booking'}
                  <Icon name="skip" size={20} />
                </Button>
              )
            }
            note={
              step === 1 ? (
                'Free cancellation up to 24 hours before your booking.'
              ) : (
                <>
                  By confirming you agree to the{' '}
                  <Link href="/terms" className="underline">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/cancellation-policy" className="underline">
                    Cancellation policy
                  </Link>
                  .
                </>
              )
            }
          />
        </div>
      )}
    </main>
  );
}
