-- Private documents are uploaded, read and signed exclusively by the
-- therapist-private-documents Edge Function with server-side authorization.
-- Do not leave a direct authenticated Storage path, even when constrained to
-- a user-owned folder: it bypasses the document command/audit boundary.
drop policy if exists "Therapists manage own private document folder"
  on storage.objects;
