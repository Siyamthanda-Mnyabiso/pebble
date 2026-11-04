export const PHOTO_BUCKET = 'provider-photos';
/** Main photo plus the rest of the gallery. */
export const MAX_PHOTOS = 8;

const base = () =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}`;

export function publicPhotoUrl(path: string) {
  return `${base()}/${path}`;
}

/** True when the URL is a photo inside this provider's own storage folder. */
export function isOwnUpload(url: string, slug: string) {
  return url.startsWith(`${base()}/${slug}/`);
}

/** Storage path (folder/file) for one of our own upload URLs. */
export function uploadPath(url: string) {
  return url.slice(base().length + 1);
}
