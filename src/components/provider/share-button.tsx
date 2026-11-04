'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons';

export function ShareButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed or clipboard unavailable: nothing to do.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? 'Link copied' : `Share ${name}`}
      title={copied ? 'Link copied' : 'Share'}
      className="bg-subtle hover:bg-charcoal-200 inline-flex size-10 items-center justify-center rounded-full transition-colors"
    >
      <Icon name={copied ? 'check' : 'share'} size={18} />
    </button>
  );
}
