'use server';

import { revalidatePath } from 'next/cache';
import { isCity } from '@/data/cities';
import { serviceCategories } from '@/data/home';
import { getUser } from '@/lib/auth';
import { BOOKING_TIMES } from '@/lib/booking';
import { isOwnUpload, MAX_PHOTOS, PHOTO_BUCKET, uploadPath } from '@/lib/photos';
import { requireProvider } from '@/lib/dashboard';
import { createClient } from '@/lib/supabase/server';

export type StatusResult = { ok: true } | { ok: false; error: string };

const ALLOWED = ['confirmed', 'completed', 'cancelled'] as const;

/**
 * Providers confirm, complete or cancel bookings for their listing. Customers
 * cancel their own. Which changes are legal is enforced in the database.
 */
export async function setBookingStatus(
  bookingId: string,
  status: (typeof ALLOWED)[number],
): Promise<StatusResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  if (!ALLOWED.includes(status)) return { ok: false, error: 'That is not allowed.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select('id');

  if (error) {
    return {
      ok: false,
      error: error.message.includes('on or after')
        ? 'You can mark a job complete on or after its date.'
        : 'That change is not allowed for this booking.',
    };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'We could not find that booking.' };
  }
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/account', 'layout');
  return { ok: true };
}

// Listing editing ------------------------------------------------------------

export type FormState = { error?: string; saved?: boolean; slug?: string };

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function refresh(slug?: string) {
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/explore');
  revalidatePath('/');
  if (slug) {
    revalidatePath(`/providers/${slug}`);
    revalidatePath(`/book/${slug}`);
  }
}

const categories = serviceCategories.map((c) => c.slug);

export async function createListing(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getUser();
  if (!user) return { error: 'Please sign in again.' };
  const name = field(formData, 'name');
  const category = field(formData, 'category');
  const area = field(formData, 'area');
  const city = field(formData, 'city');
  if (name.length < 2 || name.length > 80) return { error: 'Enter your business name.' };
  if (!categories.includes(category)) return { error: 'Choose a category.' };
  if (area.length < 2 || area.length > 60)
    return { error: 'Enter the suburb or area you work in.' };
  if (!isCity(city)) return { error: 'Choose your city.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_my_listing', {
    p_name: name,
    p_category: category,
    p_area: area,
    p_city: city,
  });
  if (error) return { error: 'We could not create your listing. Please try again.' };
  refresh();
  return { saved: true, slug: data as string };
}

export async function updateListing(
  _: FormState,
  formData: FormData,
): Promise<FormState> {
  const { provider } = await requireProvider('/dashboard/profile');
  if (!provider) return { error: 'Create your listing first.' };

  const next = {
    name: field(formData, 'name'),
    category: field(formData, 'category'),
    tagline: field(formData, 'tagline'),
    about: field(formData, 'about'),
    area: field(formData, 'area'),
    city: field(formData, 'city'),
    reply_time: field(formData, 'reply_time'),
  };
  if (next.name.length < 2 || next.name.length > 80)
    return { error: 'Enter your business name.' };
  if (!categories.includes(next.category)) return { error: 'Choose a category.' };
  if (next.tagline.length > 120)
    return { error: 'Keep the tagline under 120 characters.' };
  if (next.about.length > 1000)
    return { error: 'Keep the description under 1000 characters.' };
  if (next.area.length < 2 || next.area.length > 60)
    return { error: 'Enter the area you work in.' };
  if (!isCity(next.city)) return { error: 'Choose your city.' };
  if (next.reply_time.length > 80)
    return { error: 'Keep the reply time under 80 characters.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('providers')
    .update(next)
    .eq('slug', provider.slug);
  if (error) return { error: 'We could not save your changes. Please try again.' };
  refresh(provider.slug);
  return { saved: true };
}

export async function saveService(_: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider('/dashboard/services');
  if (!provider) return { error: 'Create your listing first.' };

  const id = field(formData, 'id');
  const name = field(formData, 'name');
  const detail = field(formData, 'detail');
  const price = Number(field(formData, 'price'));
  if (name.length < 2 || name.length > 60) return { error: 'Enter a service name.' };
  if (detail.length > 120) return { error: 'Keep the details under 120 characters.' };
  if (!Number.isInteger(price) || price < 0 || price > 100000) {
    return { error: 'Enter a starting price in whole rand.' };
  }

  const supabase = await createClient();
  const { error } = id
    ? await supabase
        .from('provider_services')
        .update({ name, detail, from_price: price })
        .eq('id', id)
        .eq('provider_slug', provider.slug)
    : await supabase.from('provider_services').insert({
        provider_slug: provider.slug,
        name,
        detail,
        from_price: price,
        position: provider.services.length,
      });
  if (error) {
    return {
      error:
        error.code === '23505'
          ? 'You already have a service with that name.'
          : 'We could not save that service. Please try again.',
    };
  }
  refresh(provider.slug);
  return { saved: true };
}

export async function deleteService(serviceId: string): Promise<StatusResult> {
  const { provider } = await requireProvider('/dashboard/services');
  if (!provider) return { ok: false, error: 'Create your listing first.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('provider_services')
    .delete()
    .eq('id', serviceId)
    .eq('provider_slug', provider.slug);
  if (error) return { ok: false, error: 'We could not remove that service.' };
  refresh(provider.slug);
  return { ok: true };
}

export async function saveHours(_: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider('/dashboard/availability');
  if (!provider) return { error: 'Create your listing first.' };

  const rows = Array.from({ length: 7 }, (_, weekday) => ({
    provider_slug: provider.slug,
    weekday,
    times: BOOKING_TIMES.filter((t) => formData.getAll(`day-${weekday}`).includes(t)),
  }));
  const supabase = await createClient();
  const { error } = await supabase
    .from('provider_hours')
    .upsert(rows, { onConflict: 'provider_slug,weekday' });
  if (error) return { error: 'We could not save your hours. Please try again.' };
  refresh(provider.slug);
  return { saved: true };
}

export async function addTimeOff(_: FormState, formData: FormData): Promise<FormState> {
  const { provider } = await requireProvider('/dashboard/availability');
  if (!provider) return { error: 'Create your listing first.' };
  const day = field(formData, 'day');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: 'Choose a date.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('provider_time_off')
    .upsert(
      { provider_slug: provider.slug, day },
      { onConflict: 'provider_slug,day', ignoreDuplicates: true },
    );
  if (error) return { error: 'We could not save that date.' };
  refresh(provider.slug);
  return { saved: true };
}

export async function removeTimeOff(day: string): Promise<StatusResult> {
  const { provider } = await requireProvider('/dashboard/availability');
  if (!provider) return { ok: false, error: 'Create your listing first.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('provider_time_off')
    .delete()
    .eq('provider_slug', provider.slug)
    .eq('day', day);
  if (error) return { ok: false, error: 'We could not remove that date.' };
  refresh(provider.slug);
  return { ok: true };
}

export async function requestPayout(): Promise<StatusResult> {
  const { provider } = await requireProvider('/dashboard/earnings');
  if (!provider) return { ok: false, error: 'Create your listing first.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_payout');
  if (error) {
    return {
      ok: false,
      error: error.message.includes('minimum')
        ? 'The minimum payout is R100.'
        : error.code === '23505'
          ? 'You already have a payout request open.'
          : 'We could not request a payout. Please try again.',
    };
  }
  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}

// Photos ---------------------------------------------------------------------

async function loadPhotos(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('providers')
    .select('image, work')
    .eq('slug', slug)
    .single<{ image: string; work: string[] }>();
  const image = data?.image ?? '';
  // The main photo is stored separately; older rows also repeated it in the list.
  const work = [...new Set(data?.work ?? [])].filter((u) => u !== image);
  return { supabase, image, work };
}

async function writePhotos(
  slug: string,
  image: string,
  work: string[],
): Promise<StatusResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('providers')
    .update({ image, work, gallery: [image, ...work.slice(0, 3)] })
    .eq('slug', slug);
  if (error)
    return { ok: false, error: 'We could not save your photos. Please try again.' };
  refresh(slug);
  return { ok: true };
}

/** Records a photo the browser has already uploaded to the provider's folder. */
export async function addPhoto(url: string): Promise<StatusResult> {
  const { provider } = await requireProvider('/dashboard/photos');
  if (!provider) return { ok: false, error: 'Create your listing first.' };
  if (!isOwnUpload(url, provider.slug))
    return { ok: false, error: 'That photo is not valid.' };

  const { image, work } = await loadPhotos(provider.slug);
  if (work.includes(url) || image === url) return { ok: true };
  if (1 + work.length >= MAX_PHOTOS) {
    return {
      ok: false,
      error: `You can have up to ${MAX_PHOTOS} photos. Remove one first.`,
    };
  }
  return writePhotos(provider.slug, image, [...work, url]);
}

export async function setMainPhoto(url: string): Promise<StatusResult> {
  const { provider } = await requireProvider('/dashboard/photos');
  if (!provider) return { ok: false, error: 'Create your listing first.' };
  const { image, work } = await loadPhotos(provider.slug);
  if (url === image) return { ok: true };
  if (!work.includes(url)) return { ok: false, error: 'We could not find that photo.' };
  // The old main photo goes back into the list; the chosen one becomes main.
  return writePhotos(provider.slug, url, [...work.filter((u) => u !== url), image]);
}

export async function removePhoto(url: string): Promise<StatusResult> {
  const { provider } = await requireProvider('/dashboard/photos');
  if (!provider) return { ok: false, error: 'Create your listing first.' };
  const { supabase, image, work } = await loadPhotos(provider.slug);
  if (url === image) {
    return { ok: false, error: 'Choose another main photo before removing this one.' };
  }
  if (!work.includes(url)) return { ok: true };

  const result = await writePhotos(
    provider.slug,
    image,
    work.filter((u) => u !== url),
  );
  // Free the storage space too. Built-in images have nothing to delete.
  if (result.ok && isOwnUpload(url, provider.slug)) {
    await supabase.storage.from(PHOTO_BUCKET).remove([uploadPath(url)]);
  }
  return result;
}
