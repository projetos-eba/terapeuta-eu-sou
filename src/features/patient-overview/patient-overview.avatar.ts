export function resolvePatientAvatarUrl(
  patientAvatarUrl: string | null,
  profileAvatarUrl: string | null,
) {
  return patientAvatarUrl ?? profileAvatarUrl;
}
