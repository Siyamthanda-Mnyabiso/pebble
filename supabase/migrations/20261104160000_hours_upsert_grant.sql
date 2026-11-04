-- An upsert updates every column it sets, so the key columns need update rights
-- too. Row level security still limits rows to the provider's own listing.
grant update (provider_slug, weekday, times) on public.provider_hours to authenticated;
