import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Everything an admin sees about categories, including inactive and old ones. */

export type AdminRequirement = {
  key: string;
  label: string;
  kind: string;
  required?: boolean;
};

export type AdminCatalogService = {
  id: string;
  name: string;
  description: string;
  suggested_duration_minutes: number;
  sort_order: number;
  active: boolean;
  /** Providers who offer this service. */
  providers: number;
};

export type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  sort_order: number;
  active: boolean;
  is_legacy: boolean;
  open_to_new_providers: boolean;
  alias_of: string | null;
  allow_instant_booking: boolean;
  requires_licence: boolean;
  enhanced_verification: boolean;
  requires_business_registration: boolean;
  min_notice_hours: number;
  max_duration_minutes: number | null;
  requirements: AdminRequirement[];
  /** Providers in the category, and how many of them are live. */
  providers_total: number;
  providers_live: number;
  services: AdminCatalogService[];
};

export async function loadAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('admin_category_overview');
  return (data ?? []) as AdminCategory[];
}
