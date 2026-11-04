'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  addTimeOff,
  createListing,
  deleteService,
  removeTimeOff,
  saveHours,
  saveService,
  updateListing,
  type FormState,
} from '@/app/dashboard/actions';
import { FormMessage, TextField } from '@/components/auth/fields';
import { Button } from '@/components/ui/button';
import { serviceCategories } from '@/data/home';
import { BOOKING_TIMES } from '@/lib/booking';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/dates';

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
      <TextField
        label="Area you work in"
        name="area"
        defaultValue="Cape Town"
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
      <TextField
        label="Area"
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

export function ServiceForm({
  service,
  onDone,
}: {
  service?: { id: string; name: string; detail: string; fromPrice: number };
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
          label="From (R)"
          name="price"
          type="number"
          inputMode="numeric"
          min={0}
          max={100000}
          step={1}
          defaultValue={service?.fromPrice}
          required
        />
      </div>
      <TextField
        label="Details"
        name="detail"
        defaultValue={service?.detail}
        maxLength={120}
        hint="For example: 3 to 5 hours · Supplies included"
      />
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
}: {
  service: { id: string; name: string; detail: string; fromPrice: number };
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <div className="py-5">
        <ServiceForm service={service} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-5">
      <div className="min-w-0">
        <p className="type-h4">{service.name}</p>
        <p className="type-body-s text-muted mt-0.5">
          From R{service.fromPrice}
          {service.detail ? ` · ${service.detail}` : ''}
        </p>
        {error ? (
          <p role="alert" className="type-caption text-danger mt-1">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
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

export function AddServiceCard() {
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
      <ServiceForm onDone={() => setOpen(false)} />
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

export function HoursForm({ hours }: { hours: Record<number, string[]> }) {
  const [state, action, pending] = useActionState(saveHours, initial);
  return (
    <form action={action} className="mt-6 max-w-[760px]">
      <ul className="bg-page shadow-card divide-line divide-y rounded-xl px-4 sm:px-6">
        {ORDER.map((weekday) => (
          <li key={weekday} className="py-4">
            <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <legend className="sr-only">{DAY_NAMES[weekday]}</legend>
              <span className="type-body-s w-28 font-semibold" aria-hidden="true">
                {DAY_NAMES[weekday]}
              </span>
              <div className="flex flex-wrap gap-2">
                {BOOKING_TIMES.map((time) => (
                  <label key={time} className="cursor-pointer">
                    <input
                      type="checkbox"
                      name={`day-${weekday}`}
                      value={time}
                      defaultChecked={hours[weekday]?.includes(time)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        'type-body-s border-line-strong inline-flex h-10 items-center rounded-full border px-4 font-semibold transition-colors',
                        'peer-checked:bg-dark peer-checked:text-on-dark peer-checked:border-transparent',
                        'peer-focus-visible:outline-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                      )}
                    >
                      {time}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ul>
      <p className="type-caption text-muted mt-3">
        Tap the start times you take bookings for. A day with none selected is a day off.
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
