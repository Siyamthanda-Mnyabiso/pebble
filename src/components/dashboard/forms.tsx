'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  addTimeOff,
  createListing,
  deleteService,
  removeTimeOff,
  saveHours,
  savePreferences,
  saveService,
  setServiceActive,
  updateListing,
  type FormState,
} from '@/app/dashboard/actions';
import { FormMessage, TextField } from '@/components/auth/fields';
import { Button } from '@/components/ui/button';
import { CITY_NAMES } from '@/data/cities';
import { serviceCategories } from '@/data/home';
import { BOOKING_TIMES, describeTimes } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';
import { formatRand, splitPrice } from '@/lib/money';

const initial: FormState = {};

function Save({
  pending,
  children = 'Save changes',
}: {
  pending: boolean;
  children?: string;
}) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : children}
    </Button>
  );
}

function Feedback({ state, ok = 'Saved.' }: { state: FormState; ok?: string }) {
  return <FormMessage error={state.error} notice={state.saved ? ok : undefined} />;
}

function CitySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="block">
      <span className="type-body-s mb-2 block font-semibold">City</span>
      <select
        name="city"
        defaultValue={defaultValue ?? 'Cape Town'}
        className="border-line-strong bg-page type-body-s h-12 w-full rounded-md border px-4"
      >
        {CITY_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CategorySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="block">
      <span className="type-body-s mb-2 block font-semibold">Category</span>
      <select
        name="category"
        defaultValue={defaultValue ?? 'cleaning'}
        className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
      >
        {serviceCategories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CreateListingForm() {
  const [state, action, pending] = useActionState(createListing, initial);
  return (
    <form
      action={action}
      className="mx-auto mt-6 flex max-w-[460px] flex-col gap-4 text-left"
    >
      <TextField label="Business name" name="name" required maxLength={80} />
      <CategorySelect />
      <CitySelect />
      <TextField
        label="Suburb or area"
        name="area"
        defaultValue=""
        placeholder="For example Sea Point"
        required
        maxLength={60}
      />
      <Feedback state={state} ok="Listing created." />
      <Save pending={pending}>Create my listing</Save>
    </form>
  );
}

export function ListingForm({
  listing,
}: {
  listing: {
    name: string;
    category: string;
    tagline: string;
    about: string;
    area: string;
    city: string;
    replyTime: string;
  };
}) {
  const [state, action, pending] = useActionState(updateListing, initial);
  return (
    <form action={action} className="mt-8 flex max-w-[620px] flex-col gap-4">
      <TextField
        label="Business name"
        name="name"
        defaultValue={listing.name}
        required
        maxLength={80}
      />
      <CategorySelect defaultValue={listing.category} />
      <TextField
        label="Tagline"
        name="tagline"
        defaultValue={listing.tagline}
        maxLength={120}
        hint="One line under your name, for example: Leaks, geysers and blocked drains."
      />
      <label className="block">
        <span className="type-body-s mb-2 block font-semibold">About</span>
        <textarea
          name="about"
          rows={5}
          maxLength={1000}
          defaultValue={listing.about}
          className="border-line-strong bg-page focus:border-ink type-body-s w-full rounded-md border p-4 outline-none"
        />
      </label>
      <CitySelect defaultValue={listing.city} />
      <TextField
        label="Suburb or area"
        name="area"
        defaultValue={listing.area}
        required
        maxLength={60}
      />
      <TextField
        label="How fast do you reply?"
        name="reply_time"
        defaultValue={listing.replyTime}
        maxLength={80}
      />
      <Feedback state={state} />
      <div>
        <Save pending={pending} />
      </div>
    </form>
  );
}

const DURATIONS = [
  [30, '30 minutes'],
  [60, '1 hour'],
  [90, '1 hour 30 minutes'],
  [120, '2 hours'],
  [180, '3 hours'],
  [240, '4 hours'],
  [300, '5 hours'],
  [360, '6 hours'],
  [480, '8 hours'],
] as const;

export function durationLabel(minutes: number) {
  return DURATIONS.find(([m]) => m === minutes)?.[1] ?? `${minutes} minutes`;
}

type ServiceData = {
  id: string;
  name: string;
  detail: string;
  fromPrice: number;
  durationMinutes: number;
  active: boolean;
  instantBooking: boolean;
};

function Switch({
  name,
  label,
  defaultChecked,
  onChange,
  disabled,
}: {
  name?: string;
  label: string;
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <span
        aria-hidden="true"
        className={cn(
          'bg-line-strong relative h-6 w-10 rounded-full transition-colors',
          'after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform',
          'peer-checked:bg-dark peer-checked:after:translate-x-4',
          'peer-focus-visible:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
          'peer-disabled:opacity-50',
        )}
      />
    </label>
  );
}

export function ServiceForm({
  service,
  commissionPercent,
  paymentsEnabled,
  onDone,
}: {
  service?: ServiceData;
  commissionPercent: number;
  paymentsEnabled: boolean;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const result = await saveService(prev, formData);
      if (result.saved) onDone?.();
      return result;
    },
    initial,
  );
  const [price, setPrice] = useState(String(service?.fromPrice ?? ''));
  const rand = Number(price);
  const earn =
    Number.isFinite(rand) && rand > 0 ? splitPrice(rand * 100, commissionPercent) : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <TextField
          label="Service name"
          name="name"
          defaultValue={service?.name}
          required
          maxLength={60}
        />
        <TextField
          label="Price (R)"
          name="price"
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          step={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>
      {earn ? (
        <p className="type-body-s text-muted -mt-2">
          Customers pay {formatRand(rand * 100)}. Pebble takes {commissionPercent}% (
          {formatRand(earn.commission)}). You receive {formatRand(earn.earning)}.
        </p>
      ) : null}
      <label className="block">
        <span className="type-body-s mb-2 block font-semibold">How long it takes</span>
        <select
          name="duration"
          defaultValue={service?.durationMinutes ?? 60}
          className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
        >
          {DURATIONS.map(([m, label]) => (
            <option key={m} value={m}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Details"
        name="detail"
        defaultValue={service?.detail}
        maxLength={120}
        hint="For example: Supplies included"
      />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="type-body-s font-semibold">Instant booking</p>
          <p className="type-caption text-muted">
            {paymentsEnabled
              ? 'Customers book and pay without waiting for you.'
              : 'Takes effect once payments go live. Until then you approve each request.'}
          </p>
        </div>
        <Switch
          name="instant"
          label="Instant booking"
          defaultChecked={service?.instantBooking}
        />
      </div>
      <Feedback state={state} />
      <div className="flex gap-3">
        <Save pending={pending}>{service ? 'Save service' : 'Add service'}</Save>
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ServiceItem({
  service,
  canDelete,
  commissionPercent,
  paymentsEnabled,
}: {
  service: ServiceData;
  canDelete: boolean;
  commissionPercent: number;
  paymentsEnabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const earn = splitPrice(service.fromPrice * 100, commissionPercent);

  if (editing) {
    return (
      <div className="py-5">
        <ServiceForm
          service={service}
          commissionPercent={commissionPercent}
          paymentsEnabled={paymentsEnabled}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 py-5',
        !service.active && 'opacity-60',
      )}
    >
      <div className="min-w-0">
        <p className="type-h4">{service.name}</p>
        <p className="type-body-s text-muted mt-0.5">
          {formatRand(service.fromPrice * 100)} · {durationLabel(service.durationMinutes)}{' '}
          · {service.instantBooking ? 'Instant booking' : 'Request to book'}
        </p>
        <p className="type-caption text-muted mt-0.5">
          You receive {formatRand(earn.earning)} after {commissionPercent}% commission
          {service.detail ? ` · ${service.detail}` : ''}
        </p>
        {error ? (
          <p role="alert" className="type-caption text-danger mt-1">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2">
          <Switch
            label={
              service.active ? `Turn off ${service.name}` : `Turn on ${service.name}`
            }
            defaultChecked={service.active}
            disabled={pending}
            onChange={(on) =>
              startTransition(async () => {
                setError('');
                const result = await setServiceActive(service.id, on);
                if (!result.ok) setError(result.error);
              })
            }
          />
          <span className="type-caption text-muted w-12">
            {service.active ? 'Active' : 'Paused'}
          </span>
        </span>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        {canDelete ? (
          confirming ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteService(service.id);
                    if (!result.ok) setError(result.error);
                    setConfirming(false);
                  })
                }
              >
                {pending ? 'Removing…' : 'Yes, remove'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
              Remove
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
}

export function AddServiceCard({
  commissionPercent,
  paymentsEnabled,
}: {
  commissionPercent: number;
  paymentsEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button className="mt-6" onClick={() => setOpen(true)}>
        Add a service
      </Button>
    );
  }
  return (
    <div className="bg-page shadow-card mt-6 max-w-[620px] rounded-xl p-6">
      <h3 className="type-h4 mb-4">New service</h3>
      <ServiceForm
        commissionPercent={commissionPercent}
        paymentsEnabled={paymentsEnabled}
        onDone={() => setOpen(false)}
      />
    </div>
  );
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function TimeSelect({
  name,
  label,
  defaultValue,
  empty,
}: {
  name: string;
  label: string;
  defaultValue: string;
  empty?: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="type-caption text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-line-strong bg-page type-body-s h-10 rounded-md border px-3"
      >
        {empty ? <option value="">{empty}</option> : null}
        {BOOKING_TIMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export function HoursForm({ hours }: { hours: Record<number, string[]> }) {
  const [state, action, pending] = useActionState(saveHours, initial);
  return (
    <form action={action} className="mt-6 max-w-[760px]">
      <ul className="bg-page shadow-card divide-line divide-y rounded-xl px-4 sm:px-6">
        {ORDER.map((weekday) => {
          const d = describeTimes(hours[weekday] ?? []);
          return (
            <li key={weekday} className="py-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <span className="flex w-36 items-center gap-3">
                  <Switch
                    name={`on-${weekday}`}
                    label={`Work on ${DAY_NAMES[weekday]}`}
                    defaultChecked={d.on}
                  />
                  <span className="type-body-s font-semibold">{DAY_NAMES[weekday]}</span>
                </span>
                <TimeSelect
                  name={`first-${weekday}`}
                  label="First job"
                  defaultValue={d.first}
                />
                <TimeSelect
                  name={`last-${weekday}`}
                  label="Last job"
                  defaultValue={d.last}
                />
                <TimeSelect
                  name={`break-${weekday}`}
                  label="Break"
                  defaultValue={d.skip}
                  empty="None"
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="type-caption text-muted mt-3">
        Customers can book the times between your first and last job, apart from your
        break. Turn a day off to take it as a day off.
      </p>
      <div className="mt-4 flex flex-col gap-4">
        <Feedback state={state} ok="Hours saved." />
        <div>
          <Save pending={pending}>Save hours</Save>
        </div>
      </div>
    </form>
  );
}

export function PreferencesForm({
  bufferMinutes,
  maxDaily,
}: {
  bufferMinutes: number;
  maxDaily: number | null;
}) {
  const [state, action, pending] = useActionState(savePreferences, initial);
  return (
    <form
      action={action}
      className="bg-page shadow-card mt-6 flex max-w-[460px] flex-col gap-4 rounded-xl p-6"
    >
      <label className="block">
        <span className="type-body-s mb-2 block font-semibold">Gap between jobs</span>
        <select
          name="buffer"
          defaultValue={bufferMinutes}
          className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
        >
          {[0, 15, 30, 45, 60, 90, 120].map((m) => (
            <option key={m} value={m}>
              {m === 0 ? 'No gap' : `${m} minutes`}
            </option>
          ))}
        </select>
        <span className="type-caption text-muted mt-1 block">
          Time for travel and a short break. Customers cannot book inside it.
        </span>
      </label>
      <TextField
        label="Most bookings in a day"
        name="max"
        type="number"
        inputMode="numeric"
        min={1}
        max={50}
        defaultValue={maxDaily ?? ''}
        hint="Leave empty for no limit."
      />
      <Feedback state={state} ok="Preferences saved." />
      <div>
        <Save pending={pending}>Save preferences</Save>
      </div>
    </form>
  );
}

export function TimeOffForm({ today, days }: { today: string; days: string[] }) {
  const [state, action, pending] = useActionState(addTimeOff, initial);
  const [error, setError] = useState('');
  const [removing, startTransition] = useTransition();

  return (
    <div className="max-w-[460px]">
      <form action={action} className="flex items-end gap-3">
        <label className="block flex-1">
          <span className="type-body-s mb-2 block font-semibold">Block a date</span>
          <input
            type="date"
            name="day"
            min={today}
            required
            className="border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4"
          />
        </label>
        <Save pending={pending}>Add</Save>
      </form>
      <div className="mt-3">
        <Feedback state={state} ok="Date blocked." />
      </div>
      {error ? (
        <p role="alert" className="type-caption text-danger mt-2">
          {error}
        </p>
      ) : null}
      {days.length > 0 ? (
        <ul className="bg-page shadow-card divide-line mt-4 divide-y rounded-xl px-4">
          {days.map((day) => (
            <li key={day} className="flex items-center justify-between py-3">
              <span className="type-body-s font-semibold">
                {formatDay(day, { year: true })}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={removing}
                onClick={() =>
                  startTransition(async () => {
                    setError('');
                    const result = await removeTimeOff(day);
                    if (!result.ok) setError(result.error);
                  })
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-body-s text-muted mt-4">No dates blocked.</p>
      )}
    </div>
  );
}
