export type PublicTherapistTherapyInput = {
  id?: string | null;
  name: string | null;
  slug?: string | null;
  sortOrder?: number | null;
};

export type PublicTherapistTherapyChip = {
  id: string;
  label: string;
  slug: string;
};

export function buildPublicTherapistTherapyChips(
  therapies: PublicTherapistTherapyInput[],
  limit = 3,
): PublicTherapistTherapyChip[] {
  const uniqueTherapies = new Map<string, PublicTherapistTherapyChip>();

  therapies
    .filter((therapy) => Boolean(therapy.name?.trim()))
    .sort((first, second) => {
      const firstOrder = first.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const secondOrder = second.sortOrder ?? Number.MAX_SAFE_INTEGER;

      if (firstOrder !== secondOrder) return firstOrder - secondOrder;

      return (first.name ?? "").localeCompare(second.name ?? "", "pt-BR");
    })
    .forEach((therapy) => {
      const label = therapy.name?.trim();
      if (!label) return;

      const stableKey = therapy.id ?? therapy.slug;
      if (!stableKey) return;

      if (!uniqueTherapies.has(stableKey)) {
        uniqueTherapies.set(stableKey, {
          id: stableKey,
          label,
          slug: therapy.slug ?? stableKey,
        });
      }
    });

  return Array.from(uniqueTherapies.values()).slice(0, Math.max(0, limit));
}
