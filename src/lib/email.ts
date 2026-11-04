import 'server-only';

/**
 * Sends a plain email through Resend. Without RESEND_API_KEY and EMAIL_FROM (no
 * sending domain yet) nothing is sent and this returns false, so callers can
 * say so. A failed send never blocks the action that triggered it.
 */
export async function sendEmail(
  to: string | null | undefined,
  subject: string,
  text: string,
) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!to || !key || !from) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const SITE = 'https://pebble-bice.vercel.app';

/** The email a provider gets when their verification status changes. */
export function verificationEmail(
  kind:
    | 'submitted'
    | 'approved'
    | 'changes_requested'
    | 'rejected'
    | 'suspended'
    | 'reinstated',
  business: string,
  note = '',
) {
  const link = `${SITE}/dashboard/verification`;
  const copy = {
    submitted: [
      'We received your Pebble listing',
      `Thanks. ${business} is now under review. We will email you as soon as there is an update. You cannot be booked until the review is finished.`,
    ],
    approved: [
      'Your Pebble listing is approved',
      `Good news: ${business} has been approved and is now live on Pebble. Customers can find and book you.`,
    ],
    changes_requested: [
      'Action needed on your Pebble listing',
      `We reviewed ${business} and need a few changes before we can approve it:\n\n${note}\n\nUpdate your listing and resubmit it from your dashboard.`,
    ],
    rejected: [
      'Your Pebble listing was not approved',
      `We could not approve ${business}.\n\n${note}\n\nIf you think this is a mistake, reply to this email.`,
    ],
    suspended: [
      'Your Pebble listing was suspended',
      `${business} has been taken off Pebble for now.\n\n${note}\n\nReply to this email if you would like to talk about it.`,
    ],
    reinstated: [
      'Your Pebble listing is live again',
      `${business} has been reinstated and customers can book you again.`,
    ],
  } as const;
  const [subject, body] = copy[kind];
  return { subject, text: `${body}\n\nSee the details: ${link}\n\nThe Pebble team` };
}
