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
  intro_video_url: string;
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

export type ProviderDocument = {
  id: string;
  kind: 'id' | 'business' | 'certification';
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

export const ADMIN_CHECKS = [
  { field: 'intro_video_reviewed', label: 'Intro video reviewed' },
  { field: 'portfolio_reviewed', label: 'Portfolio reviewed' },
  { field: 'contact_verified', label: 'Contact details verified' },
  { field: 'business_verified', label: 'Business info verified' },
  { field: 'category_requirements_met', label: 'Category requirements met' },
  { field: 'documents_checked', label: 'Documents checked' },
] as const;

export const DOC_KINDS = {
  id: 'ID document',
  certification: 'Trade certificate or registration',
  business: 'Business registration (optional)',
} as const;

/** Plumbers and electricians must show a trade certificate. */
export const NEEDS_CERTIFICATE = ['plumbing', 'electrical'];

export const EVENT_LABEL: Record<string, string> = {
  submitted: 'Submitted for review',
  resubmitted: 'Resubmitted for review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
  reinstated: 'Reinstated',
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
