import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type VerificationStatus =
  | 'draft'
  | 'pending_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type Verification = {
  provider_slug: string;
  status: VerificationStatus;
  note: string;
  video_path: string;
  approved_video_path: string;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  intro_video_reviewed: boolean;
  portfolio_reviewed: boolean;
  contact_verified: boolean;
  business_verified: boolean;
  category_requirements_met: boolean;
  documents_checked: boolean;
};

export type Blockers = { provider: string[]; admin: string[] };

export type DocumentKind =
  | 'id'
  | 'business'
  | 'certification'
  | 'reference'
  | 'screening'
  | 'safeguarding'
  | 'qualification';

export type ProviderDocument = {
  id: string;
  kind: DocumentKind;
  label: string;
  path: string;
  created_at: string;
};

export type ReviewEvent = {
  id: string;
  kind: string;
  note: string;
  created_at: string;
};

export const STATUS_META: Record<
  VerificationStatus,
  {
    label: string;
    tone: 'grey' | 'blue' | 'green' | 'red';
    headline: string;
    message: string;
  }
> = {
  draft: {
    label: 'Draft',
    tone: 'grey',
    headline: 'Finish your listing',
    message:
      'Complete the steps below and submit for review. Your listing is not public yet.',
  },
  pending_review: {
    label: 'Pending review',
    tone: 'blue',
    headline: 'Under review',
    message:
      'We are checking your listing. We will email you and notify you here when there is an update.',
  },
  changes_requested: {
    label: 'Changes requested',
    tone: 'red',
    headline: 'Action needed',
    message:
      'We need a few changes before we can approve your listing. Update it and resubmit.',
  },
  approved: {
    label: 'Approved',
    tone: 'green',
    headline: 'You are live',
    message: 'Your listing is approved and customers can find and book you.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'red',
    headline: 'Not approved',
    message: 'We could not approve this listing. See the reason below.',
  },
  suspended: {
    label: 'Suspended',
    tone: 'red',
    headline: 'Listing suspended',
    message: 'Your listing is hidden from customers for now. See the reason below.',
  },
};

export { ADMIN_CHECKS } from '@/lib/verification-meta';

export const DOC_KINDS = {
  id: 'ID document',
  certification: 'Trade certificate or registration',
  business: 'Business registration (optional)',
  reference: 'References',
  screening: 'Background screening',
  safeguarding: 'Safeguarding documents',
  qualification: 'Qualification',
} as const satisfies Record<DocumentKind, string>;

export type CategoryRequirements = {
  /** Some category of the provider needs a trade certificate or licence. */
  licence: boolean;
  /** Some category needs a business registration, which is otherwise optional. */
  business: boolean;
  /** Extra documents the provider's categories ask for, set by admins in the database. */
  documents: { key: string; label: string; kind: DocumentKind }[];
};

/** What the provider's categories require on top of the basics. Read from the database. */
export async function loadCategoryRequirements(
  slug: string,
): Promise<CategoryRequirements> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('provider_categories')
    .select(
      'category:service_categories(requires_licence, requires_business_registration, requirements)',
    )
    .eq('provider_slug', slug)
    .returns<
      {
        category: {
          requires_licence: boolean;
          requires_business_registration: boolean;
          requirements: {
            key: string;
            label: string;
            kind: DocumentKind;
            required?: boolean;
          }[];
        } | null;
      }[]
    >();
  const result: CategoryRequirements = { licence: false, business: false, documents: [] };
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const c = row.category;
    if (!c) continue;
    result.licence ||= c.requires_licence;
    result.business ||= c.requires_business_registration;
    for (const r of c.requirements) {
      if (r.kind === 'id' || r.required === false || seen.has(r.key)) continue;
      seen.add(r.key);
      result.documents.push({ key: r.key, label: r.label, kind: r.kind });
    }
  }
  return result;
}

export const EVENT_LABEL: Record<string, string> = {
  submitted: 'Submitted for review',
  resubmitted: 'Resubmitted for review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  reinstated: 'Reinstated',
  video_replaced: 'Intro video replaced',
  video_approved: 'New intro video approved',
  video_rejected: 'New intro video not accepted',
};

export async function loadVerification(slug: string) {
  const supabase = await createClient();
  const [
    { data: verification },
    { data: blockers },
    { data: documents },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('provider_verification')
      .select('*')
      .eq('provider_slug', slug)
      .maybeSingle<Verification>(),
    supabase.rpc('review_blockers', { p_slug: slug }),
    supabase
      .from('provider_documents')
      .select('id, kind, label, path, created_at')
      .eq('provider_slug', slug)
      .order('created_at')
      .returns<ProviderDocument[]>(),
    supabase
      .from('provider_review_events')
      .select('id, kind, note, created_at')
      .eq('provider_slug', slug)
      .order('created_at', { ascending: false })
      .returns<ReviewEvent[]>(),
  ]);
  return {
    verification,
    blockers: (blockers as Blockers | null) ?? { provider: [], admin: [] },
    documents: documents ?? [],
    events: events ?? [],
  };
}
