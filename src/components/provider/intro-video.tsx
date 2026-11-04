import { connection } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';

/**
 * The provider's approved intro video, shown first on their public profile so
 * customers can see and hear who they are inviting in. The video file is private
 * storage: the link is signed fresh for each visit and works for an hour.
 */
export async function IntroVideo({ slug, name }: { slug: string; name: string }) {
  await connection();
  const supabase = createPublicClient();
  const { data: path } = await supabase.rpc('public_intro_video', { p_slug: slug });
  if (!path) return null;
  const { data } = await supabase.storage
    .from('provider-videos')
    .createSignedUrl(path as string, 3600);
  if (!data?.signedUrl) return null;

  return (
    <section aria-labelledby="intro-video" className="mb-8">
      <h2 id="intro-video" className="type-h2">
        Meet {name}
      </h2>
      <p className="type-body-s text-muted mt-1">
        A short introduction, in their own words.
      </p>
      <video
        src={data.signedUrl}
        controls
        playsInline
        preload="metadata"
        className="mt-4 aspect-video w-full max-w-[720px] rounded-lg bg-black"
      >
        Your browser cannot play this video.
      </video>
    </section>
  );
}
