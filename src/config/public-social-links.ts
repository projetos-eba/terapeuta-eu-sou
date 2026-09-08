import { Instagram, Linkedin, Youtube, type LucideIcon } from "lucide-react";

export type PublicSocialLink = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const instagramLink: PublicSocialLink = {
  href: "https://www.instagram.com/terapeutaeusou?igsi=YWh6NmQ5bXJnNG00",
  icon: Instagram,
  label: "Instagram do Terapeuta Eu Sou",
};

const socialLinkConfig: Array<{
  envKey: string;
  icon: LucideIcon;
  label: string;
}> = [
  {
    envKey: "NEXT_PUBLIC_TES_LINKEDIN_URL",
    icon: Linkedin,
    label: "LinkedIn do Terapeuta Eu Sou",
  },
  {
    envKey: "NEXT_PUBLIC_TES_YOUTUBE_URL",
    icon: Youtube,
    label: "YouTube do Terapeuta Eu Sou",
  },
];

function isSafeExternalUrl(value: string | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function getPublicInstagramLink() {
  return instagramLink;
}

export function getPublicSocialLinks(): PublicSocialLink[] {
  return [
    instagramLink,
    ...socialLinkConfig.flatMap((item) => {
      const href = process.env[item.envKey];

      if (!href || !isSafeExternalUrl(href)) return [];

      const safeHref = href;

      return [
        {
          href: safeHref,
          icon: item.icon,
          label: item.label,
        },
      ];
    }),
  ];
}
