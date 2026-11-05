'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  saveCategory,
  saveCategoryService,
  setCategoryActive,
  setCategoryServiceActive,
  type CategoryResult,
} from '@/app/admin/category-actions';
import { Pill } from '@/components/admin/parts';
import { Button } from '@/components/ui/button';
import type { AdminCategory } from '@/lib/admin-categories';

type Event = { id: string; text: string; when: string };

const input = 'border-line-strong bg-page type-body-s h-[52px] w-full rounded-md border px-4';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-page shadow-card rounded-xl p-5 sm:p-6">
      <h2 className="type-h3">{title}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Switch({
  name,
  label,
  help,
  defaultChecked,
}: {
  name: string;
  label: string;
  help: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="type-body-s block font-semibold">{label}</span>
        <span className="type-caption text-muted block">{help}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="accent-dark mt-1 size-5 shrink-0"
      />
    </label>
  );
}

function requirementsText(c: AdminCategory | null) {
  return (c?.requirements ?? [])
    .map((r) => `${r.label} | ${r.kind}${r.required === false ? ' | optional' : ''}`)
    .join('\n');
}

/** Create or edit one category: its details, booking rules, checks and services. */
export function CategoryEditor({
  category,
  history,
}: {
  category: AdminCategory | null;
  history: Event[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(work: () => Promise<CategoryResult>, then?: (r: CategoryResult) => void) {
    setError('');
    setSaved(false);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) setError(result.error);
      else {
        setSaved(true);
        then?.(result);
        router.refresh();
      }
    });
  }

  function submit(formData: FormData) {
    run(
      () => saveCategory(category?.id ?? null, formData),
      (r) => {
        if (!category && r.ok && r.id) router.replace(`/admin/categories/${r.id}`);
      },
    );
  }

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <form action={submit} className="flex flex-col gap-6">
        <Card title="Details">
          <label className="block">
            <span className="type-body-s mb-2 block font-semibold">Name</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={60}
              defaultValue={category?.name ?? ''}
              className={input}
            />
          </label>
          <label className="block">
            <span className="type-body-s mb-2 block font-semibold">Description</span>
            <input
              name="description"
              maxLength={300}
              defaultValue={category?.description ?? ''}
              className={input}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="type-body-s mb-2 block font-semibold">Icon</span>
              <input name="icon" defaultValue={category?.icon ?? 'sparkles'} className={input} />
            </label>
            <label className="block">
              <span className="type-body-s mb-2 block font-semibold">Order in lists</span>
              <input
                name="sort_order"
                type="number"
                min={0}
                defaultValue={category?.sort_order ?? 200}
                className={input}
              />
            </label>
          </div>
        </Card>

        <Card title="Booking rules">
          <Switch
            name="allow_instant_booking"
            label="Instant booking permitted"
            help="When off, providers in this category approve every request themselves. The database enforces it."
            defaultChecked={category?.allow_instant_booking ?? true}
          />
          <Switch
            name="requires_licence"
            label="Requires a licence or registration"
            help="Providers must upload a trade licence or registration before approval."
            defaultChecked={category?.requires_licence ?? false}
          />
          <Switch
            name="enhanced_verification"
            label="Enhanced verification"
            help="Extra identity, reference and screening checks. Used for childcare."
            defaultChecked={category?.enhanced_verification ?? false}
          />
          <Switch
            name="requires_business_registration"
            label="Requires business registration"
            help="Only switch on where the law needs it. Providers do not need a business by default."
            defaultChecked={category?.requires_business_registration ?? false}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="type-body-s mb-2 block font-semibold">
                Minimum notice (hours)
              </span>
              <input
                name="min_notice_hours"
                type="number"
                min={0}
                max={720}
                defaultValue={category?.min_notice_hours ?? 0}
                className={input}
              />
            </label>
            <label className="block">
              <span className="type-body-s mb-2 block font-semibold">
                Longest job (minutes)
              </span>
              <input
                name="max_duration_minutes"
                type="number"
                min={15}
                max={720}
                placeholder="No limit"
                defaultValue={category?.max_duration_minutes ?? ''}
                className={input}
              />
            </label>
          </div>
        </Card>

        <Card title="Extra verification documents">
          <p className="type-body-s text-muted -mt-2">
            Providers must upload these before the listing can be approved. ID is always
            required. One per line: name | type (id, business, certification, reference,
            screening, safeguarding, qualification). Add | optional to make one optional.
          </p>
          <label className="block">
            <span className="sr-only">Extra documents</span>
            <textarea
              name="requirements"
              rows={4}
              defaultValue={requirementsText(category)}
              placeholder="Reference letter | reference"
              className="border-line-strong bg-page type-body-s w-full rounded-md border p-4"
            />
          </label>
        </Card>

        {error ? (
          <p role="alert" className="type-body-s text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : category ? 'Save changes' : 'Create category'}
          </Button>
          {saved ? <span className="type-body-s text-muted">Saved.</span> : null}
        </div>
      </form>

      {category ? (
        <aside className="flex flex-col gap-6">
          <Card title="Status">
            <div className="flex items-center justify-between gap-4">
              <Pill tone={category.active ? 'green' : 'grey'}>
                {category.active ? 'Active' : 'Inactive'}
              </Pill>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => setCategoryActive(category.id, !category.active))}
              >
                {category.active ? 'Turn off' : 'Turn on'}
              </Button>
            </div>
            <p className="type-caption text-muted">
              Turning a category off hides it from browsing and new sign ups. Existing
              providers, services and bookings stay exactly as they are.
            </p>
            <p className="type-caption text-muted">
              {category.providers_total} providers, {category.providers_live} live
            </p>
          </Card>

          <Card title="Services">
            <ul className="flex flex-col gap-3">
              {category.services.map((s) => (
                <ServiceRow
                  key={s.id}
                  service={s}
                  categoryId={category.id}
                  busy={pending}
                  run={run}
                />
              ))}
            </ul>
            <AddService categoryId={category.id} busy={pending} run={run} />
          </Card>

          <Card title="Change history">
            {history.length === 0 ? (
              <p className="type-body-s text-muted">No changes yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {history.map((e) => (
                  <li key={e.id}>
                    <p className="type-body-s font-semibold">{e.text}</p>
                    <p className="type-caption text-muted">{e.when}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      ) : null}
    </div>
  );
}

type Run = (work: () => Promise<CategoryResult>, then?: (r: CategoryResult) => void) => void;

function ServiceRow({
  service,
  categoryId,
  busy,
  run,
}: {
  service: AdminCategory['services'][number];
  categoryId: string;
  busy: boolean;
  run: Run;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(service.name);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3">
      {renaming ? (
        <form
          className="flex flex-1 items-center gap-2"
          action={() => {
            const data = new FormData();
            data.set('name', name);
            data.set('description', service.description);
            data.set('duration', String(service.suggested_duration_minutes));
            data.set('sort_order', String(service.sort_order));
            run(() => saveCategoryService(service.id, categoryId, data), () => setRenaming(false));
          }}
        >
          <input
            aria-label="Service name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-line-strong bg-page type-body-s h-10 min-w-0 flex-1 rounded-md border px-3"
          />
          <Button size="sm" type="submit" disabled={busy}>
            Save
          </Button>
        </form>
      ) : (
        <>
          <span className={service.active ? '' : 'text-muted'}>
            <span className="type-body-s block font-semibold">{service.name}</span>
            <span className="type-caption text-muted block">
              {service.providers} {service.providers === 1 ? 'provider' : 'providers'}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setRenaming(true)}>
              Rename
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              aria-pressed={service.active}
              onClick={() =>
                run(() => setCategoryServiceActive(service.id, !service.active))
              }
            >
              {service.active ? 'On' : 'Off'}
            </Button>
          </span>
        </>
      )}
    </li>
  );
}

function AddService({
  categoryId,
  busy,
  run,
}: {
  categoryId: string;
  busy: boolean;
  run: Run;
}) {
  const [name, setName] = useState('');
  return (
    <form
      className="flex items-center gap-2"
      action={() => {
        const data = new FormData();
        data.set('name', name);
        run(() => saveCategoryService(null, categoryId, data), () => setName(''));
      }}
    >
      <input
        aria-label="New service name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New service name"
        className="border-line-strong bg-page type-body-s h-11 min-w-0 flex-1 rounded-md border px-3"
      />
      <Button size="sm" type="submit" disabled={busy || name.trim().length < 2}>
        Add
      </Button>
    </form>
  );
}
