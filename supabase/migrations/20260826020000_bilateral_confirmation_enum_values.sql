-- Canonical bilateral service confirmation states. Kept separate from the
-- lifecycle migration because PostgreSQL enum values must be committed before
-- they are referenced by functions and data changes.

alter type public.session_service_status
  add value if not exists 'confirmed_bilateral';

alter type public.session_confirmation_source
  add value if not exists 'bilateral';
