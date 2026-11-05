'use client';

import { useState, useTransition } from 'react';
import { updateSetting } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';

/** One setting: its name, what it does, the current value, and an inline edit. */
export function SettingRow({
  settingKey,
  label,
  help,
  value,
  unit,
  editable = true,
}: {
  settingKey: string;
  label: string;
  help: string;
  value: number;
  unit: string;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function save() {
    setError('');
    startTransition(async () => {
      const result = await updateSetting(settingKey, Number(draft));
      if (result.ok) setEditing(false);
      else setError(result.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5">
      <div className="min-w-0 flex-1 basis-60">
        <p className="type-body font-semibold">{label}</p>
        <p className="type-body-s text-muted mt-0.5">{help}</p>
        {error ? (
          <p role="alert" className="type-caption text-danger mt-1">
            {error}
          </p>
        ) : null}
      </div>
      {editing ? (
        <form className="flex items-center gap-2" action={save}>
          <label className="flex items-center gap-2">
            <span className="sr-only">{label}</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="border-line-strong bg-page type-body-s h-11 w-28 rounded-md border px-3"
              autoFocus
            />
            <span className="type-body-s text-muted">{unit}</span>
          </label>
          <Button size="sm" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setDraft(String(value));
              setError('');
            }}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center gap-3">
          <span className="type-body font-semibold">
            {value} {unit}
          </span>
          {editable ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : (
            <span className="type-caption bg-subtle text-muted rounded-full px-3 py-1 font-semibold">
              Fixed
            </span>
          )}
        </div>
      )}
    </li>
  );
}
