type TherapistAvatarIdentity = {
  name?: string | null;
  slug?: string | null;
};

export const DEFAULT_THERAPIST_AVATAR_URL =
  "/therapists/avatar-terapeuta.jpeg";

const versionedAvatarUrlByPath: Record<string, string> = {
  "/therapists/rafael-santos.png": "/therapists/rafael-santos-avatar.png",
  "/therapists/lucas-pereira.png": "/therapists/lucas-pereira-avatar.png",
};

export function getTherapistAvatarUrl(
  photoUrl?: string | null,
  _identity: TherapistAvatarIdentity = {},
) {
  if (photoUrl && versionedAvatarUrlByPath[photoUrl]) {
    return versionedAvatarUrlByPath[photoUrl];
  }

  if (photoUrl) return photoUrl;

  return DEFAULT_THERAPIST_AVATAR_URL;
}
