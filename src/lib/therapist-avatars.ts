type TherapistAvatarIdentity = {
  name?: string | null;
  slug?: string | null;
};

const avatarUrlBySlug: Record<string, string> = {
  "andre-lima": "/therapists/andre-lima.png",
  "lucas-pereira": "/therapists/lucas-pereira-avatar.png",
  "rafael-santos": "/therapists/rafael-santos-avatar.png",
};

const versionedAvatarUrlByPath: Record<string, string> = {
  "/therapists/rafael-santos.png": "/therapists/rafael-santos-avatar.png",
  "/therapists/lucas-pereira.png": "/therapists/lucas-pereira-avatar.png",
};

function normalizeName(value?: string | null) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getTherapistAvatarUrl(
  photoUrl?: string | null,
  identity: TherapistAvatarIdentity = {},
) {
  if (photoUrl && versionedAvatarUrlByPath[photoUrl]) {
    return versionedAvatarUrlByPath[photoUrl];
  }

  if (photoUrl) return photoUrl;

  if (identity.slug && avatarUrlBySlug[identity.slug]) {
    return avatarUrlBySlug[identity.slug];
  }

  if (normalizeName(identity.name) === "andre lima") {
    return avatarUrlBySlug["andre-lima"];
  }

  return null;
}
