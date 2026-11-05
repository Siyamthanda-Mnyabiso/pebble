'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export type CategoryResult = { ok: true; id?: string } | { ok: false; error: string };

/** The database says what is wrong in plain words; show those, not internals. */
const KNOWN =
  /(already exists|already has a service|at least one active service|Enter a|not valid|Choose a longer|cannot point|not found)/;

function fail(error: { message: string }): CategoryResult {
  return {
    ok: false,
    error: KNOWN.test(error.message)
      ? error.message
      : 'That did not work. Please try again.',
  };
}

function refresh() {
  // Categories are cached for browsing and onboarding; an admin change shows at once.
  updateTag('categories');
  revalidatePath('/admin/categories');
  revalidatePath('/explore');
  revalidatePath('/');
  revalidatePath('/dashboard', 'layout');
}

function flag(formData: FormData, name: string) {
  return formData.get(name) === 'on';
}

function whole(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Document kinds a requirement can ask for. */
const KINDS = [
  'id',
  'business',
  'certification',
  'reference',
  'screening',
  'safeguarding',
  'qualification',
];

/** One requirement per line: "label | kind" or "label | kind | optional". */
export async function parseRequirements(text: string) {
  const items: { key: string; label: string; kind: string; required: boolean }[] = [];
  for (const line of text.split('\n')) {
    const [label, kind, mode] = line.split('|').map((part) => part.trim());
    if (!label) continue;
    if (!KINDS.includes(kind)) return null;
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    if (key.length < 2) return null;
    items.push({ key, label, kind, required: mode !== 'optional' });
  }
  return items;
}

/** Create a category (no id, starts inactive) or edit one. */
export async function saveCategory(
  id: string | null,
  formData: FormData,
): Promise<CategoryResult> {
  await requireAdmin('/admin/categories');
  const requirements = await parseRequirements(
    String(formData.get('requirements') ?? ''),
  );
  if (!requirements) {
    return {
      ok: false,
      error: `Each requirement is a line like "Reference letter | reference". Kinds: ${KINDS.join(', ')}.`,
    };
  }
  const payload = {
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    icon: String(formData.get('icon') ?? '').trim(),
    sort_order: whole(formData, 'sort_order') ?? 200,
    allow_instant_booking: flag(formData, 'allow_instant_booking'),
    requires_licence: flag(formData, 'requires_licence'),
    enhanced_verification: flag(formData, 'enhanced_verification'),
    requires_business_registration: flag(formData, 'requires_business_registration'),
    min_notice_hours: whole(formData, 'min_notice_hours') ?? 0,
    max_duration_minutes: whole(formData, 'max_duration_minutes'),
    requirements,
  };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_save_category', {
    p_id: id,
    p: payload,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true, id: data as string };
}

export async function setCategoryActive(
  id: string,
  active: boolean,
): Promise<CategoryResult> {
  await requireAdmin('/admin/categories');
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_category_active', {
    p_id: id,
    p_active: active,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Add a service to a category (no id) or rename and edit one. */
export async function saveCategoryService(
  id: string | null,
  categoryId: string,
  formData: FormData,
): Promise<CategoryResult> {
  await requireAdmin('/admin/categories');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_save_category_service', {
    p_id: id,
    p_category: categoryId,
    p_name: String(formData.get('name') ?? '').trim(),
    p_description: String(formData.get('description') ?? '').trim(),
    p_duration: whole(formData, 'duration'),
    p_sort: whole(formData, 'sort_order'),
  });
  if (error) return fail(error);
  refresh();
  return { ok: true, id: data as string };
}

export async function setCategoryServiceActive(
  id: string,
  active: boolean,
): Promise<CategoryResult> {
  await requireAdmin('/admin/categories');
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_set_category_service_active', {
    p_id: id,
    p_active: active,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}
