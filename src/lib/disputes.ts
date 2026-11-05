import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EvidenceItem = {
  id: string;
  url: string;
  by: 'customer' | 'provider';
  created_at: string;
};

/**
 * The photos on a dispute, as short-lived links. The bucket is private, so each link is signed for
 * the person asking, and only the two people on the booking and admins can get one.
 */
export async function loadEvidence(
  supabase: SupabaseClient,
  disputeId: string,
  customerId: string,
): Promise<EvidenceItem[]> {
  const { data } = await supabase
    .from('dispute_evidence')
    .select('id, path, uploaded_by, created_at')
    .eq('dispute_id', disputeId)
    .order('created_at');
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: signed } = await supabase.storage
    .from('dispute-evidence')
    .createSignedUrls(
      rows.map((r) => r.path as string),
      3600,
    );
  const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.flatMap((r) => {
    const link = url.get(r.path as string);
    return link
      ? [
          {
            id: r.id as string,
            url: link,
            by: (r.uploaded_by === customerId ? 'customer' : 'provider') as
              'customer' | 'provider',
            created_at: r.created_at as string,
          },
        ]
      : [];
  });
}
