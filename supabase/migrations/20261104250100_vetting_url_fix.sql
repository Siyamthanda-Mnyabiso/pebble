-- Postgres regular expressions allow at most 255 repetitions.
alter table public.provider_verification drop constraint provider_verification_intro_video_url_check;
alter table public.provider_verification add constraint provider_verification_intro_video_url_check
  check (intro_video_url = '' or intro_video_url ~ '^https://[^[:space:]]{4,255}$');
